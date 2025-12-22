"use client";

import { useState, useEffect } from "react";
import { MapPin, Clock, ChevronRight, Play, RefreshCw, Loader2 } from "lucide-react";
import dynamic from "next/dynamic";

// Dynamically import RouteMap to avoid SSR issues with Leaflet
const RouteMap = dynamic(
    () => import("@/components/map/RouteMap").then((mod) => mod.RouteMap),
    { ssr: false, loading: () => <div className="h-[300px] flex items-center justify-center bg-muted/30"><p className="text-muted-foreground">マップを読み込み中...</p></div> }
);
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { routesApi, automationApi } from "@/lib/api";
import type { Route, RouteStatus, StopStatus } from "@/lib/types";

const routeStatusConfig: Record<RouteStatus, { label: string; className: string }> = {
    not_started: { label: "未開始", className: "bg-muted text-muted-foreground" },
    in_progress: { label: "進行中", className: "bg-primary/20 text-primary" },
    completed: { label: "完了", className: "bg-success/20 text-success" },
    cancelled: { label: "キャンセル", className: "bg-destructive/20 text-destructive" },
};

const stopStatusConfig: Record<StopStatus, string> = {
    pending: "border-border bg-muted/30",
    current: "border-primary bg-primary/10",
    completed: "border-success/30 bg-success/10",
    skipped: "border-warning/30 bg-warning/10",
};

export default function RoutesPage() {
    const [routes, setRoutes] = useState<Route[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedRoute, setSelectedRoute] = useState<number | null>(null);
    const [regenerating, setRegenerating] = useState(false);
    const [startingAll, setStartingAll] = useState(false);

    const today = new Date().toISOString().split("T")[0];

    useEffect(() => {
        fetchRoutes();
    }, []);

    async function fetchRoutes() {
        try {
            setLoading(true);
            setError(null);
            const data = await routesApi.getAll({ route_date: today });
            setRoutes(data);
            if (data.length > 0 && !selectedRoute) {
                setSelectedRoute(data[0].route_id);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "ルートの取得に失敗しました");
        } finally {
            setLoading(false);
        }
    }

    async function handleRegenerateAll() {
        try {
            setRegenerating(true);
            await automationApi.generateAllRoutes(today);
            await fetchRoutes();
        } catch (err) {
            setError(err instanceof Error ? err.message : "ルート再生成に失敗しました");
        } finally {
            setRegenerating(false);
        }
    }

    async function handleStartAll() {
        try {
            setStartingAll(true);
            await routesApi.startAll(today);
            await fetchRoutes();
        } catch (err) {
            setError(err instanceof Error ? err.message : "ルート開始に失敗しました");
        } finally {
            setStartingAll(false);
        }
    }

    const activeRoute = routes.find((r) => r.route_id === selectedRoute);

    return (
        <MainLayout title="ルート計画" subtitle="スタッフルートの最適化と追跡">
            {/* Actions */}
            <div className="flex gap-3 mb-6">
                <Button className="gap-2" onClick={handleRegenerateAll} disabled={regenerating}>
                    {regenerating ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            生成中...
                        </>
                    ) : (
                        <>
                            <RefreshCw className="h-4 w-4" />
                            全ルート再生成
                        </>
                    )}
                </Button>
                <Button variant="secondary" className="gap-2" onClick={handleStartAll} disabled={startingAll}>
                    {startingAll ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            処理中...
                        </>
                    ) : (
                        <>
                            <Play className="h-4 w-4" />
                            全ルート開始
                        </>
                    )}
                </Button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : error ? (
                <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                        <p className="text-destructive mb-2">{error}</p>
                        <button onClick={fetchRoutes} className="text-primary hover:underline">
                            再試行
                        </button>
                    </div>
                </div>
            ) : routes.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                    本日のルートはありません
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Route List */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-foreground">本日のルート</h3>
                        {routes.map((route, index) => (
                            <button
                                key={route.route_id}
                                onClick={() => setSelectedRoute(route.route_id)}
                                className={cn(
                                    "w-full rounded-xl border p-4 text-left transition-all duration-200 animate-slide-up",
                                    selectedRoute === route.route_id
                                        ? "border-primary bg-primary/10 shadow-lg"
                                        : "border-border bg-card hover:border-primary/50 card-shadow"
                                )}
                                style={{ animationDelay: `${index * 50}ms` }}
                            >
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                                        {route.staff_avatar}
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-medium text-foreground">{route.staff_name}</p>
                                        <Badge className={cn("text-xs", routeStatusConfig[route.route_status]?.className || "")}>
                                            {routeStatusConfig[route.route_status]?.label || route.route_status}
                                        </Badge>
                                    </div>
                                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                                </div>

                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div className="p-2 rounded bg-muted/30">
                                        <p className="text-lg font-bold text-foreground">{route.total_stops}</p>
                                        <p className="text-xs text-muted-foreground">店舗</p>
                                    </div>
                                    <div className="p-2 rounded bg-success/10">
                                        <p className="text-lg font-bold text-success">{route.completed_stops}</p>
                                        <p className="text-xs text-muted-foreground">完了</p>
                                    </div>
                                    <div className="p-2 rounded bg-muted/30">
                                        <p className="text-lg font-bold text-foreground">{route.estimated_duration}</p>
                                        <p className="text-xs text-muted-foreground">予定</p>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Route Details and Map */}
                    <div className="lg:col-span-2 space-y-4">
                        {/* Map */}
                        <div className="rounded-xl border border-border bg-card card-shadow overflow-hidden">
                            {activeRoute && activeRoute.stops.length > 0 ? (
                                <RouteMap
                                    stops={activeRoute.stops.map((stop) => ({
                                        stop_id: stop.stop_id,
                                        store_id: stop.store_id,
                                        store_name: stop.store_name,
                                        store_address: stop.store_address,
                                        stop_sequence: stop.stop_sequence,
                                        stop_status: stop.stop_status,
                                        items_count: stop.items_count,
                                        latitude: stop.store_latitude,
                                        longitude: stop.store_longitude,
                                    }))}
                                    startLocation={{ lat: 35.6762, lng: 139.6503, name: "オフィス（六本木）" }}
                                    className="h-[300px]"
                                />
                            ) : (
                                <div className="h-[300px] bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                                    <p className="text-muted-foreground">ルートを選択してください</p>
                                </div>
                            )}
                        </div>

                        {/* Stop List */}
                        {activeRoute && (
                            <div className="rounded-xl border border-border bg-card card-shadow p-5">
                                <h3 className="text-lg font-semibold text-foreground mb-4">
                                    {activeRoute.staff_name}のルート
                                </h3>
                                {activeRoute.stops.length === 0 ? (
                                    <p className="text-muted-foreground text-center py-8">
                                        このルートには店舗がありません
                                    </p>
                                ) : (
                                    <div className="space-y-3">
                                        {activeRoute.stops.map((stop, index) => (
                                            <div
                                                key={stop.stop_id}
                                                className={cn(
                                                    "flex items-center gap-4 p-4 rounded-lg border-l-4 transition-all animate-fade-in",
                                                    stopStatusConfig[stop.stop_status as StopStatus] || stopStatusConfig.pending
                                                )}
                                                style={{ animationDelay: `${index * 50}ms` }}
                                            >
                                                {/* Step Number */}
                                                <div
                                                    className={cn(
                                                        "flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold shrink-0",
                                                        stop.stop_status === "completed"
                                                            ? "bg-success text-success-foreground"
                                                            : stop.stop_status === "current"
                                                                ? "bg-primary text-primary-foreground"
                                                                : "bg-muted text-muted-foreground"
                                                    )}
                                                >
                                                    {index + 1}
                                                </div>

                                                {/* Store Info */}
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-foreground">
                                                        {stop.store_name || `店舗 #${stop.store_id}`}
                                                    </p>
                                                    <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
                                                        {stop.store_address && (
                                                            <span className="flex items-center gap-1">
                                                                <MapPin className="h-3 w-3" />
                                                                {stop.store_address}
                                                            </span>
                                                        )}
                                                        {stop.estimated_arrival && (
                                                            <span className="flex items-center gap-1">
                                                                <Clock className="h-3 w-3" />
                                                                {new Date(stop.estimated_arrival).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Orders Count */}
                                                <div className="text-right shrink-0">
                                                    <p className="text-lg font-bold text-foreground">{stop.items_count}</p>
                                                    <p className="text-xs text-muted-foreground">件</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </MainLayout>
    );
}
