"use client";

import { useEffect, useRef, useCallback } from "react";
import L from "leaflet";
// @ts-ignore - CSS import works at runtime via Next.js
import "leaflet/dist/leaflet.css";

// Office/start marker (green)
const StartIcon = L.icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});

// Marker image URLs by status (same style as green StartIcon)
const MARKER_URLS: Record<string, string> = {
    pending: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
    current: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
    completed: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png",
};
// Create a proper marker icon with a number label
function createNumberedIcon(num: number, status: string): L.DivIcon {
    const iconUrl = MARKER_URLS[status] || MARKER_URLS.pending;

    return L.divIcon({
        className: "",
        html: `<div style="position:relative;width:25px;height:41px;">
            <img src="${iconUrl}" style="width:25px;height:41px;" />
            <div style="position:absolute;top:3px;left:0;width:25px;text-align:center;color:white;font-size:11px;font-weight:bold;font-family:Arial,sans-serif;text-shadow:0 1px 2px rgba(0,0,0,0.5);">${num}</div>
        </div>`,
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
    });
}

const POPUP_STYLE = "background:#1a2235;color:#e2e8f0;padding:10px 14px;border-radius:10px;font-size:13px;line-height:1.6;border:1px solid #2a3550;box-shadow:0 8px 24px rgba(0,0,0,0.6);min-width:160px;";

interface Stop {
    stop_id: number;
    store_id: number;
    store_name?: string;
    store_address?: string;
    stop_sequence: number;
    stop_status: string;
    items_count: number;
    total_quantity?: number;
    latitude?: number;
    longitude?: number;
}

interface RouteMapProps {
    stops: Stop[];
    startLocation?: { lat: number; lng: number; name: string };
    className?: string;
}

export function RouteMap({ stops, startLocation, className = "" }: RouteMapProps) {
    const mapRef = useRef<L.Map | null>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const markersLayerRef = useRef<L.LayerGroup | null>(null);
    const routeLayerRef = useRef<L.LayerGroup | null>(null);
    const lastStopsKeyRef = useRef<string>("");
    const hasInitialDrawRef = useRef(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Generate a key from stops to detect actual data changes (include stop_sequence and coordinates)
    const getStopsKey = useCallback((stops: Stop[], startLoc?: { lat: number; lng: number }) => {
        const startKey = startLoc ? `start:${startLoc.lat},${startLoc.lng}` : "no-start";
        return startKey + "|" + stops.map(s => `${s.stop_id}-${s.stop_status}-${s.stop_sequence}`).join(",");
    }, []);

    // Draw markers and routes on the map
    const drawMarkersAndRoutes = useCallback((
        map: L.Map,
        markersLayer: L.LayerGroup,
        routeLayer: L.LayerGroup,
        stops: Stop[],
        startLocation?: { lat: number; lng: number; name: string },
        fitBoundsOnDraw = false
    ) => {
        // Abort any in-flight route request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        // Clear existing markers and routes
        markersLayer.clearLayers();
        routeLayer.clearLayers();

        // Add start location marker (office)
        if (startLocation) {
            L.marker([startLocation.lat, startLocation.lng], { icon: StartIcon })
                .bindPopup(`<div style="${POPUP_STYLE}"><b>出発地点</b><br/>${startLocation.name}</div>`, { className: "dark-popup" })
                .addTo(markersLayer);
        }

        // Add stop markers with order numbers
        const routePoints: [number, number][] = [];
        const waypoints: string[] = [];
        // Sort by stop_sequence so waypoints and numbering follow the correct route order
        const validStops = stops
            .filter((s) => s.latitude && s.longitude)
            .sort((a, b) => a.stop_sequence - b.stop_sequence);

        if (startLocation) {
            routePoints.push([startLocation.lat, startLocation.lng]);
            waypoints.push(`${startLocation.lng},${startLocation.lat}`);
        }

        // Detect overlapping coordinates and apply small offset for marker visibility
        const coordKey = (lat: number, lng: number) => `${lat.toFixed(5)},${lng.toFixed(5)}`;
        const coordGroups = new Map<string, number[]>();
        validStops.forEach((_, idx) => {
            const s = validStops[idx];
            const key = coordKey(s.latitude!, s.longitude!);
            if (!coordGroups.has(key)) coordGroups.set(key, []);
            coordGroups.get(key)!.push(idx);
        });

        validStops.forEach((stop, idx) => {
            const lat = stop.latitude!;
            const lng = stop.longitude!;
            // Use original coords for routing
            routePoints.push([lat, lng]);
            waypoints.push(`${lng},${lat}`);

            // Offset marker only if multiple stops share the same location
            let markerLat = lat;
            let markerLng = lng;
            const key = coordKey(lat, lng);
            const group = coordGroups.get(key);
            if (group && group.length > 1) {
                const posInGroup = group.indexOf(idx);
                const angle = (posInGroup * 2 * Math.PI) / group.length - Math.PI / 2;
                const offset = 0.00012; // ~13 meters - visible but close to route
                markerLat += offset * Math.cos(angle);
                markerLng += offset * Math.sin(angle);
            }

            const icon = createNumberedIcon(stop.stop_sequence, stop.stop_status);

            L.marker([markerLat, markerLng], { icon })
                .bindPopup(
                    `<div style="${POPUP_STYLE}">` +
                    `<b>${stop.stop_sequence}. ${stop.store_name || `店舗 #${stop.store_id}`}</b><br/>` +
                    `${stop.store_address || ""}<br/>` +
                    `購入数量: ${stop.total_quantity || stop.items_count}個<br/>` +
                    `状態: ${stop.stop_status === "completed" ? "完了" : stop.stop_status === "current" ? "現在地" : "待機中"}` +
                    `</div>`,
                    { className: "dark-popup" }
                )
                .addTo(markersLayer);
        });

        // Helper: fetch OSRM route and draw polyline
        function fetchAndDrawRoute(
            waypointList: string[],
            fallbackPoints: [number, number][],
            style: L.PolylineOptions
        ) {
            if (waypointList.length < 2) return;
            const coordinates = waypointList.join(";");
            fetch(`https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`, {
                signal: abortController.signal,
            })
                .then(response => response.json())
                .then(data => {
                    if (abortController.signal.aborted || !routeLayer) return;
                    if (data.code === "Ok" && data.routes?.[0]?.geometry?.coordinates) {
                        const coords: [number, number][] = data.routes[0].geometry.coordinates.map(
                            (coord: [number, number]) => [coord[1], coord[0]] as [number, number]
                        );
                        L.polyline(coords, style).addTo(routeLayer);
                    } else {
                        L.polyline(fallbackPoints, { ...style, weight: style.weight ? style.weight - 1 : 4 }).addTo(routeLayer);
                    }
                })
                .catch(() => {
                    if (abortController.signal.aborted || !routeLayer) return;
                    L.polyline(fallbackPoints, { ...style, weight: style.weight ? style.weight - 1 : 4 }).addTo(routeLayer);
                });
        }

        // Split route into completed (green) and pending (blue) segments
        // Find the last completed stop index (contiguous from start)
        let lastCompletedIdx = -1;
        for (let i = 0; i < validStops.length; i++) {
            if (validStops[i].stop_status === "completed") {
                lastCompletedIdx = i;
            } else {
                break;
            }
        }

        // Build waypoints for completed segment (office → ... → last completed stop)
        const completedWaypoints: string[] = [];
        const completedFallback: [number, number][] = [];
        if (lastCompletedIdx >= 0) {
            if (startLocation) {
                completedWaypoints.push(`${startLocation.lng},${startLocation.lat}`);
                completedFallback.push([startLocation.lat, startLocation.lng]);
            }
            for (let i = 0; i <= lastCompletedIdx; i++) {
                completedWaypoints.push(`${validStops[i].longitude},${validStops[i].latitude}`);
                completedFallback.push([validStops[i].latitude!, validStops[i].longitude!]);
            }
            fetchAndDrawRoute(completedWaypoints, completedFallback, {
                color: "#22c55e", weight: 6, opacity: 0.9,
            });
        }

        // Build waypoints for pending segment (last completed stop → ... → last stop)
        const pendingWaypoints: string[] = [];
        const pendingFallback: [number, number][] = [];
        const pendingStartIdx = lastCompletedIdx >= 0 ? lastCompletedIdx : -1;
        // Start from last completed stop (or office if none completed)
        if (pendingStartIdx >= 0) {
            pendingWaypoints.push(`${validStops[pendingStartIdx].longitude},${validStops[pendingStartIdx].latitude}`);
            pendingFallback.push([validStops[pendingStartIdx].latitude!, validStops[pendingStartIdx].longitude!]);
        } else if (startLocation) {
            pendingWaypoints.push(`${startLocation.lng},${startLocation.lat}`);
            pendingFallback.push([startLocation.lat, startLocation.lng]);
        }
        for (let i = lastCompletedIdx + 1; i < validStops.length; i++) {
            pendingWaypoints.push(`${validStops[i].longitude},${validStops[i].latitude}`);
            pendingFallback.push([validStops[i].latitude!, validStops[i].longitude!]);
        }
        fetchAndDrawRoute(pendingWaypoints, pendingFallback, {
            color: "#3b82f6", weight: 5, opacity: 0.8,
        });

        // Fetch return route (last stop → office) separately
        if (startLocation && validStops.length > 0) {
            const lastStop = validStops[validStops.length - 1];
            if (lastStop.latitude && lastStop.longitude) {
                fetchAndDrawRoute(
                    [`${lastStop.longitude},${lastStop.latitude}`, `${startLocation.lng},${startLocation.lat}`],
                    [[lastStop.latitude, lastStop.longitude], [startLocation.lat, startLocation.lng]],
                    { color: "#f97316", weight: 4, opacity: 0.85, dashArray: "10, 6" }
                );
                // Add return point to bounds calculation
                routePoints.push([startLocation.lat, startLocation.lng]);
            }
        }

        // Fit bounds only on initial draw — never re-zoom on data updates
        if (routePoints.length > 0 && fitBoundsOnDraw) {
            const bounds = L.latLngBounds(routePoints);
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    }, []);

    // Initialize map and draw initial markers
    useEffect(() => {
        if (!mapContainerRef.current || mapRef.current) return;

        // Default center: Osaka (primary operating city)
        const defaultCenter: [number, number] = [34.6937, 135.5023];

        // Calculate initial center
        const validStops = stops.filter((s) => s.latitude && s.longitude);
        let center = defaultCenter;

        if (startLocation) {
            center = [startLocation.lat, startLocation.lng];
        } else if (validStops.length > 0) {
            const avgLat = validStops.reduce((acc, s) => acc + (s.latitude || 0), 0) / validStops.length;
            const avgLng = validStops.reduce((acc, s) => acc + (s.longitude || 0), 0) / validStops.length;
            center = [avgLat, avgLng];
        }

        // Initialize map without attribution control
        const map = L.map(mapContainerRef.current, {
            attributionControl: false
        }).setView(center, 13);
        mapRef.current = map;

        // Add OpenStreetMap tiles
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

        // Create layer groups for markers and routes
        const markersLayer = L.layerGroup().addTo(map);
        const routeLayer = L.layerGroup().addTo(map);
        markersLayerRef.current = markersLayer;
        routeLayerRef.current = routeLayer;

        // Draw initial markers and routes
        drawMarkersAndRoutes(map, markersLayer, routeLayer, stops, startLocation, true);
        lastStopsKeyRef.current = getStopsKey(stops, startLocation);
        hasInitialDrawRef.current = true;

        // Cleanup on unmount
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
            markersLayerRef.current = null;
            routeLayerRef.current = null;
            hasInitialDrawRef.current = false;
            lastStopsKeyRef.current = "";
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Update markers and routes when stops change (after initial render)
    useEffect(() => {
        // Skip if not initialized yet
        if (!hasInitialDrawRef.current) return;

        const map = mapRef.current;
        const markersLayer = markersLayerRef.current;
        const routeLayer = routeLayerRef.current;

        if (!map || !markersLayer || !routeLayer) return;

        // Check if stops actually changed
        const currentStopsKey = getStopsKey(stops, startLocation);
        if (currentStopsKey === lastStopsKeyRef.current) {
            return; // No actual change, skip update
        }
        lastStopsKeyRef.current = currentStopsKey;

        // Redraw markers and routes
        drawMarkersAndRoutes(map, markersLayer, routeLayer, stops, startLocation, false);
    }, [stops, startLocation, getStopsKey, drawMarkersAndRoutes]);

    return (
        <div
            ref={mapContainerRef}
            className={`rounded-lg ${className}`}
            style={{ minHeight: "300px", zIndex: 0 }}
        />
    );
}

