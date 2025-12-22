"use client";

import { useEffect, useState } from "react";
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

    useEffect(() => {
        // Only run on client
        setMapReady(true);
    }, []);

    useEffect(() => {
        if (!mapReady) return;

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

        if (startLocation) {
            routePoints.push([startLocation.lat, startLocation.lng]);
        }

        validStops.forEach((stop) => {
            if (stop.latitude && stop.longitude) {
                const point: [number, number] = [stop.latitude, stop.longitude];
                routePoints.push(point);

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
                        `商品数: ${stop.items_count}件<br/>` +
                        `状態: ${stop.stop_status === "completed" ? "完了" : stop.stop_status === "current" ? "現在地" : "待機中"}`
                    );
            }
        });

        // Draw route line
        if (routePoints.length > 1) {
            L.polyline(routePoints, {
                color: "#14b8a6",
                weight: 3,
                opacity: 0.7,
                dashArray: "5, 10",
            }).addTo(map);
        }

        // Fit bounds to show all markers
        if (routePoints.length > 0) {
            const bounds = L.latLngBounds(routePoints);
            map.fitBounds(bounds, { padding: [50, 50] });
        }

        // Cleanup
        return () => {
            map.remove();
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
