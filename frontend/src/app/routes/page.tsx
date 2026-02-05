"use client";

import { useState, useEffect } from "react";
import { ChevronRight, RefreshCw, Loader2, MapPin, Clock, CheckCircle, Calendar } from "lucide-react";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";

const RouteMap = dynamic(
    () => import("@/components/map/RouteMap").then((mod) => mod.RouteMap),
    { ssr: false, loading: () => <div className="h-75 flex items-center justify-center bg-muted/20 rounded-lg"><p className="text-sm text-muted-foreground">マップ読込中...</p></div> }
);
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { routesApi, automationApi } from "@/lib/api";
import type { Route, RouteStatus } from "@/lib/types";
import { AlertModal } from "@/components/modals/AlertModal";
import { DraggableStopList } from "@/components/routes/DraggableStopList";

const statusConfig: Record<RouteStatus, { label: string; className: string }> = {
    not_started: { label: "未開始", className: "bg-muted/50 text-muted-foreground" },
    in_progress: { label: "進行中", className: "bg-blue-500/10 text-blue-500" },
    completed: { label: "完了", className: "bg-green-500/10 text-green-500" },
    cancelled: { label: "中止", className: "bg-red-500/10 text-red-500" },
};

export default function RoutesPage() {
    const { data: session } = useSession();
    const [routes, setRoutes] = useState<Route[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedRoute, setSelectedRoute] = useState<number | null>(null);
    const [generating, setGenerating] = useState(false);
    const [alertModal, setAlertModal] = useState<{ message: string; type: "success" | "error" | "info" | "warning" } | null>(null);
    const [targetDate, setTargetDate] = useState<string>(new Date().toISOString().split("T")[0]);

    const activeRoute = routes.find((r) => r.route_id === selectedRoute);

    const canEditRoute = () => {
        if (!session?.user || !activeRoute) return false;
        const userRole = session.user.role;
        const userId = Number(session.user.id);
        if (userRole === "admin" || userRole === "supervisor") return true;
        if (userRole === "buyer" && activeRoute.staff_id === userId) return true;
        return false;
    };

    useEffect(() => {
        fetchRoutes();
    }, [targetDate]);

    async function fetchRoutes() {
        try {
            setLoading(true);
            setError(null);
            const data = await routesApi.getAll({ route_date: targetDate });
            setRoutes(data);
            if (data.length > 0) {
                const currentRouteExists = data.some(r => r.route_id === selectedRoute);
                if (!selectedRoute || !currentRouteExists) {
                    setSelectedRoute(data[0].route_id);
                }
            } else {
                setSelectedRoute(null);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "ルートの取得に失敗しました");
        } finally {
            setLoading(false);
        }
    }

    async function handleGenerateRoutes() {
        try {
            setGenerating(true);
            const result = await automationApi.generateAllRoutes(targetDate);
            await fetchRoutes();
            setAlertModal({ message: result.message || "ルートを生成しました", type: "success" });
        } catch (err) {
            setAlertModal({ message: err instanceof Error ? err.message : "ルート生成に失敗しました", type: "error" });
        } finally {
            setGenerating(false);
        }
    }

    async function handleStopUpdate(stopId: number, newStatus: string) {
        if (!activeRoute) return;
        await routesApi.updateStop(activeRoute.route_id, stopId, newStatus);
        await fetchRoutes();
    }

    async function handleReorder(stopIds: number[]) {
        if (!activeRoute) return;
        await routesApi.reorderStops(activeRoute.route_id, stopIds);
        await fetchRoutes();
    }

    const changeDate = (days: number) => {
        const d = new Date(targetDate);
        d.setDate(d.getDate() + days);
        setTargetDate(d.toISOString().split('T')[0]);
    };

    return (
        <MainLayout title="ルート" subtitle="買付ルート管理">
            {/* Header */}
            <div className="mb-5 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-1">
                    <button onClick={() => changeDate(-1)} className="px-3 py-1.5 text-sm hover:bg-muted rounded transition-colors">前日</button>
                    <div className="relative flex items-center">
                        <Calendar className="absolute left-2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <input
                            type="date"
                            value={targetDate}
                            onChange={(e) => setTargetDate(e.target.value)}
                            className="pl-8 pr-3 py-1.5 text-sm bg-transparent border-0 focus:outline-none cursor-pointer [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-inner-spin-button]:hidden"
                        />
                    </div>
                    <button onClick={() => setTargetDate(new Date().toISOString().split('T')[0])} className="px-3 py-1.5 text-sm hover:bg-muted rounded transition-colors">今日</button>
                    <button onClick={() => changeDate(1)} className="px-3 py-1.5 text-sm hover:bg-muted rounded transition-colors">翌日</button>
                </div>
                <Button onClick={handleGenerateRoutes} disabled={generating} className="gap-2">
                    {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    <span>生成</span>
                </Button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : error ? (
                <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                        <p className="text-sm text-destructive mb-2">{error}</p>
                        <button onClick={fetchRoutes} className="text-sm text-primary hover:underline">再試行</button>
                    </div>
                </div>
            ) : routes.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 gap-4">
                    <p className="text-muted-foreground">ルートがありません</p>
                    <Button onClick={handleGenerateRoutes} disabled={generating} className="gap-2">
                        {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        <span>ルート生成</span>
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:items-start">
                    {/* Route List */}
                    <div className="rounded-lg border border-border bg-card p-3 lg:sticky lg:top-4">
                        <div className="space-y-2 max-h-96 lg:max-h-[calc(100vh-180px)] overflow-y-auto scrollbar-hide">
                        {routes.map((route) => (
                            <button
                                key={route.route_id}
                                onClick={() => setSelectedRoute(route.route_id)}
                                className={cn(
                                    "w-full rounded-lg border p-3 text-left transition-all",
                                    selectedRoute === route.route_id
                                        ? "border-primary bg-primary/5"
                                        : "border-border bg-card hover:border-primary/30"
                                )}
                            >
                                <div className="flex items-center gap-2.5">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-medium shrink-0">
                                        {route.staff_avatar}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-medium truncate">{route.staff_name}</p>
                                            <Badge className={cn("text-xs px-1.5 py-0", statusConfig[route.route_status]?.className)}>
                                                {statusConfig[route.route_status]?.label}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-foreground/70 mt-0.5">
                                            <span className="flex items-center gap-1">
                                                <MapPin className="h-3 w-3 text-primary" />
                                                {route.total_stops}店舗
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <CheckCircle className="h-3 w-3 text-success" />
                                                {route.completed_stops}完了
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Clock className="h-3 w-3 text-yellow-400" />
                                                {route.estimated_duration}
                                            </span>
                                        </div>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                                </div>
                            </button>
                        ))}
                        </div>
                    </div>

                    {/* Route Details */}
                    <div className="lg:col-span-2 space-y-3">
                        {/* Map */}
                        <div className="rounded-lg border border-border bg-card overflow-hidden">
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
                                        total_quantity: stop.total_quantity || stop.items_count,
                                        latitude: stop.store_latitude,
                                        longitude: stop.store_longitude,
                                    }))}
                                    startLocation={{ lat: 35.6762, lng: 139.6503, name: "オフィス" }}
                                    className="h-75"
                                />
                            ) : (
                                <div className="h-75 bg-muted/20 flex items-center justify-center">
                                    <p className="text-muted-foreground">ルートを選択</p>
                                </div>
                            )}
                        </div>

                        {/* Stop List */}
                        {activeRoute && (
                            <div className="rounded-lg border border-border bg-card p-3">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-sm font-medium">{activeRoute.staff_name}</h3>
                                    {canEditRoute() && (
                                        <span className="text-xs text-muted-foreground">ドラッグで並替</span>
                                    )}
                                </div>
                                <div className="max-h-150 overflow-y-auto scrollbar-hide">
                                    <DraggableStopList
                                        stops={activeRoute.stops}
                                        routeId={activeRoute.route_id}
                                        onStopUpdate={handleStopUpdate}
                                        onReorder={handleReorder}
                                        canEdit={canEditRoute()}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <AlertModal
                isOpen={alertModal !== null}
                onClose={() => setAlertModal(null)}
                message={alertModal?.message || ""}
                type={alertModal?.type || "info"}
            />
        </MainLayout>
    );
}
