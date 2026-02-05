"use client";

import { useEffect, useState, useRef } from "react";
import L from "leaflet";
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
    const [mapReady, setMapReady] = useState(false);
    const mapRef = useRef<L.Map | null>(null);

    useEffect(() => {
        // Only run on client
        setMapReady(true);
    }, []);

    useEffect(() => {
        if (!mapReady) return;

        if (mapRef.current) {
            mapRef.current.remove();
            mapRef.current = null;
        }

        const container = document.getElementById("route-map");
        if (!container) return;
        
        (container as any)._leaflet_id = null;

        // Default center: Tokyo
        const defaultCenter: [number, number] = [35.6762, 139.6503];

        // Calculate center from stops or use default
        const validStops = stops.filter((s) => s.latitude && s.longitude);
        let center = defaultCenter;

        if (startLocation) {
            center = [startLocation.lat, startLocation.lng];
        } else if (validStops.length > 0) {
            const avgLat = validStops.reduce((acc, s) => acc + (s.latitude || 0), 0) / validStops.length;
            const avgLng = validStops.reduce((acc, s) => acc + (s.longitude || 0), 0) / validStops.length;
            center = [avgLat, avgLng];
        }

        // Initialize map
        const map = L.map("route-map").setView(center, 13);
        mapRef.current = map;

        // Add OpenStreetMap tiles
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);

        // Add start location marker
        if (startLocation) {
            L.marker([startLocation.lat, startLocation.lng], { icon: CurrentIcon })
                .addTo(map)
                .bindPopup(`<b>出発地点</b><br/>${startLocation.name}`);
        }

        // Add stop markers
        const routePoints: [number, number][] = [];
        const waypoints: string[] = [];

        if (startLocation) {
            routePoints.push([startLocation.lat, startLocation.lng]);
            waypoints.push(`${startLocation.lng},${startLocation.lat}`);
        }

        validStops.forEach((stop) => {
            if (stop.latitude && stop.longitude) {
                const point: [number, number] = [stop.latitude, stop.longitude];
                routePoints.push(point);
                waypoints.push(`${stop.longitude},${stop.latitude}`);

                // Choose icon based on status
                let icon = DefaultIcon;
                if (stop.stop_status === "completed") {
                    icon = CompletedIcon;
                } else if (stop.stop_status === "current") {
                    icon = CurrentIcon;
                }

                L.marker(point, { icon })
                    .addTo(map)
                    .bindPopup(
                        `<b>${stop.stop_sequence}. ${stop.store_name || `店舗 #${stop.store_id}`}</b><br/>` +
                        `${stop.store_address || ""}<br/>` +
                        `購入数量: ${stop.total_quantity || stop.items_count}個<br/>` +
                        `状態: ${stop.stop_status === "completed" ? "完了" : stop.stop_status === "current" ? "現在地" : "待機中"}`
                    );
            }
        });

        // Fetch and draw actual road route using OSRM
        if (waypoints.length > 1) {
            const coordinates = waypoints.join(";");
            fetch(`https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`)
                .then(response => response.json())
                .then(data => {
                    if (data.code === "Ok" && data.routes && data.routes.length > 0) {
                        const route = data.routes[0];
                        const routeCoordinates = route.geometry.coordinates.map(
                            (coord: [number, number]) => [coord[1], coord[0]] as [number, number]
                        );
                        
                        // Draw route segments between stops with different colors based on completion
                        for (let i = 0; i < validStops.length; i++) {
                            const currentStop = validStops[i];
                            const isCompleted = currentStop.stop_status === "completed";
                            
                            // Get the segment of coordinates for this leg
                            const startIdx = startLocation ? i : i;
                            const endIdx = startIdx + 1;
                            
                            if (endIdx < waypoints.length) {
                                // Request route for this specific segment
                                const segmentWaypoints = [waypoints[startIdx], waypoints[endIdx]].join(";");
                                fetch(`https://router.project-osrm.org/route/v1/driving/${segmentWaypoints}?overview=full&geometries=geojson`)
                                    .then(res => res.json())
                                    .then(segData => {
                                        if (!mapRef.current) return; // Check if map still exists
                                        if (segData.code === "Ok" && segData.routes && segData.routes.length > 0) {
                                            const segRoute = segData.routes[0];
                                            const segCoordinates = segRoute.geometry.coordinates.map(
                                                (coord: [number, number]) => [coord[1], coord[0]] as [number, number]
                                            );
                                            
                                            L.polyline(segCoordinates, {
                                                color: isCompleted ? "#10b981" : "#2563eb",
                                                weight: 5,
                                                opacity: isCompleted ? 0.9 : 0.7,
                                            }).addTo(mapRef.current);
                                        }
                                    })
                                    .catch(err => console.error("Segment routing error:", err));
                            }
                        }
                    } else {
                        // Fallback to straight lines if routing fails
                        console.warn("Road routing failed, using straight lines");
                        if (!mapRef.current) return; // Check if map still exists
                        for (let i = 0; i < routePoints.length - 1; i++) {
                            const currentStop = validStops[i - (startLocation ? 1 : 0)];
                            const isCompleted = currentStop?.stop_status === "completed";
                            
                            L.polyline([routePoints[i], routePoints[i + 1]], {
                                color: isCompleted ? "#10b981" : "#2563eb",
                                weight: 4,
                                opacity: isCompleted ? 0.8 : 0.6,
                                dashArray: "10, 5",
                            }).addTo(mapRef.current);
                        }
                    }
                })
                .catch(err => {
                    console.error("Routing error:", err);
                    // Fallback to straight lines with color coding
                    if (!mapRef.current) return; // Check if map still exists
                    for (let i = 0; i < routePoints.length - 1; i++) {
                        const currentStop = validStops[i - (startLocation ? 1 : 0)];
                        const isCompleted = currentStop?.stop_status === "completed";
                        
                        L.polyline([routePoints[i], routePoints[i + 1]], {
                            color: isCompleted ? "#10b981" : "#2563eb",
                            weight: 4,
                            opacity: isCompleted ? 0.8 : 0.6,
                            dashArray: "10, 5",
                        }).addTo(mapRef.current);
                    }
                });
        }

        // Fit bounds to show all markers
        if (routePoints.length > 0) {
            const bounds = L.latLngBounds(routePoints);
            map.fitBounds(bounds, { padding: [50, 50] });
        }

        // Cleanup
        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, [mapReady, stops, startLocation]);

    if (!mapReady) {
        return (
            <div className={`bg-muted/50 flex items-center justify-center ${className}`}>
                <p className="text-muted-foreground">マップを読み込み中...</p>
            </div>
        );
    }

    return (
        <div
            id="route-map"
            className={`rounded-lg ${className}`}
            style={{ minHeight: "300px", zIndex: 0 }}
        />
    );
}
