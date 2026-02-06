"use client";

import { useEffect, useRef, useCallback } from "react";
import L from "leaflet";
// @ts-ignore - CSS import works at runtime via Next.js
import "leaflet/dist/leaflet.css";

// Fix for default marker icons in Next.js
const DefaultIcon = L.icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});

const CurrentIcon = L.icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});

const CompletedIcon = L.icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});

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

    // Generate a key from stops to detect actual data changes
    const getStopsKey = useCallback((stops: Stop[]) => {
        return stops.map(s => `${s.stop_id}-${s.stop_status}`).join(",");
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
        // Clear existing markers and routes
        markersLayer.clearLayers();
        routeLayer.clearLayers();

        // Add start location marker
        if (startLocation) {
            L.marker([startLocation.lat, startLocation.lng], { icon: CurrentIcon })
                .bindPopup(`<b>出発地点</b><br/>${startLocation.name}`)
                .addTo(markersLayer);
        }

        // Add stop markers
        const routePoints: [number, number][] = [];
        const waypoints: string[] = [];
        const validStops = stops.filter((s) => s.latitude && s.longitude);

        if (startLocation) {
            routePoints.push([startLocation.lat, startLocation.lng]);
            waypoints.push(`${startLocation.lng},${startLocation.lat}`);
        }

        // Detect overlapping coordinates and apply small offsets for marker visibility
        const coordKey = (lat: number, lng: number) => `${lat.toFixed(4)},${lng.toFixed(4)}`;
        const coordGroups = new Map<string, number[]>();
        validStops.forEach((stop, idx) => {
            if (stop.latitude && stop.longitude) {
                const key = coordKey(stop.latitude, stop.longitude);
                if (!coordGroups.has(key)) coordGroups.set(key, []);
                coordGroups.get(key)!.push(idx);
            }
        });

        // Get display point with offset for overlapping markers
        const getDisplayPoint = (stop: Stop, idx: number): [number, number] => {
            const lat = stop.latitude!;
            const lng = stop.longitude!;
            const key = coordKey(lat, lng);
            const group = coordGroups.get(key);
            if (!group || group.length <= 1) return [lat, lng];
            const posInGroup = group.indexOf(idx);
            const angle = (posInGroup * 2 * Math.PI) / group.length - Math.PI / 2;
            const offset = 0.0004; // ~40 meters
            return [lat + offset * Math.cos(angle), lng + offset * Math.sin(angle)];
        };

        validStops.forEach((stop, idx) => {
            if (stop.latitude && stop.longitude) {
                const displayPoint = getDisplayPoint(stop, idx);
                // Use original coords for routing, display coords for markers
                routePoints.push([stop.latitude, stop.longitude]);
                waypoints.push(`${stop.longitude},${stop.latitude}`);

                // Choose icon based on status
                let icon = DefaultIcon;
                if (stop.stop_status === "completed") {
                    icon = CompletedIcon;
                } else if (stop.stop_status === "current") {
                    icon = CurrentIcon;
                }

                L.marker(displayPoint, { icon })
                    .bindPopup(
                        `<b>${stop.stop_sequence}. ${stop.store_name || `店舗 #${stop.store_id}`}</b><br/>` +
                        `${stop.store_address || ""}<br/>` +
                        `購入数量: ${stop.total_quantity || stop.items_count}個<br/>` +
                        `状態: ${stop.stop_status === "completed" ? "完了" : stop.stop_status === "current" ? "現在地" : "待機中"}`
                    )
                    .addTo(markersLayer);
            }
        });

        // Fetch and draw road route using single OSRM call with full geometry
        if (waypoints.length > 1) {
            const coordinates = waypoints.join(";");
            fetch(`https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`)
                .then(response => response.json())
                .then(data => {
                    if (!routeLayer) return;

                    if (data.code === "Ok" && data.routes && data.routes.length > 0) {
                        const route = data.routes[0];

                        // Draw full continuous route from the overview geometry
                        if (route.geometry?.coordinates) {
                            const allCoords: [number, number][] = route.geometry.coordinates.map(
                                (coord: [number, number]) => [coord[1], coord[0]] as [number, number]
                            );

                            // Check if any stops are completed for coloring
                            const hasCompleted = validStops.some(s => s.stop_status === "completed");
                            const allCompleted = validStops.every(s => s.stop_status === "completed");

                            L.polyline(allCoords, {
                                color: allCompleted ? "#10b981" : hasCompleted ? "#6366f1" : "#2563eb",
                                weight: 5,
                                opacity: 0.8,
                            }).addTo(routeLayer);
                        }
                    } else {
                        drawFallbackRoutes(routePoints, validStops, startLocation, routeLayer);
                    }
                })
                .catch(err => {
                    console.error("Routing error:", err);
                    if (routeLayer) {
                        drawFallbackRoutes(routePoints, validStops, startLocation, routeLayer);
                    }
                });
        }

        // Fit bounds
        if (routePoints.length > 0 && fitBoundsOnDraw) {
            const bounds = L.latLngBounds(routePoints);
            map.fitBounds(bounds, { padding: [50, 50] });
        } else if (routePoints.length > 0) {
            // Only fit if points are outside current view
            const currentBounds = map.getBounds();
            const allPointsVisible = routePoints.every(p => currentBounds.contains(p));
            if (!allPointsVisible) {
                const bounds = L.latLngBounds(routePoints);
                map.fitBounds(bounds, { padding: [50, 50] });
            }
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
        lastStopsKeyRef.current = getStopsKey(stops);
        hasInitialDrawRef.current = true;

        // Cleanup on unmount
        return () => {
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
        const currentStopsKey = getStopsKey(stops);
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

// Helper function for fallback straight-line routes
function drawFallbackRoutes(
    routePoints: [number, number][],
    validStops: Stop[],
    startLocation: { lat: number; lng: number; name: string } | undefined,
    routeLayer: L.LayerGroup
) {
    for (let i = 0; i < routePoints.length - 1; i++) {
        const currentStop = validStops[i - (startLocation ? 1 : 0)];
        const isCompleted = currentStop?.stop_status === "completed";

        L.polyline([routePoints[i], routePoints[i + 1]], {
            color: isCompleted ? "#10b981" : "#2563eb",
            weight: 4,
            opacity: isCompleted ? 0.8 : 0.6,
            dashArray: "10, 5",
        }).addTo(routeLayer);
    }
}
