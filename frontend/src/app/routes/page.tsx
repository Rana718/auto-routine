"use client";

import { useState, useEffect } from "react";
import { MapPin, Clock, ChevronRight, Play, RefreshCw, Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";

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
import { AlertModal } from "@/components/modals/AlertModal";
import { DraggableStopList } from "@/components/routes/DraggableStopList";

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
    const { data: session } = useSession();
    const [routes, setRoutes] = useState<Route[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedRoute, setSelectedRoute] = useState<number | null>(null);
    const [regenerating, setRegenerating] = useState(false);
    const [startingAll, setStartingAll] = useState(false);
    const [autoAssigning, setAutoAssigning] = useState(false);
    const [alertModal, setAlertModal] = useState<{ message: string; type: "success" | "error" | "info" | "warning" } | null>(null);
    const [targetDate, setTargetDate] = useState<string>(new Date().toISOString().split("T")[0]);

    const activeRoute = routes.find((r) => r.route_id === selectedRoute);
    
    // Check if user can edit the current route
    const canEditRoute = () => {
        if (!session?.user || !activeRoute) return false;
        const userRole = session.user.role;
        const userId = Number(session.user.id);
        
        // ADMIN and SUPERVISOR can edit all routes
        if (userRole === "admin" || userRole === "supervisor") return true;
        
        // BUYER can only edit their own routes
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
            
            // If there are routes, select the first one if:
            // 1. No route is currently selected, OR
            // 2. The currently selected route is not in the new data
            if (data.length > 0) {
                const currentRouteExists = data.some(r => r.route_id === selectedRoute);
                if (!selectedRoute || !currentRouteExists) {
                    setSelectedRoute(data[0].route_id);
                }
            } else {
                // No routes available, clear selection
                setSelectedRoute(null);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "ルートの取得に失敗しました");
        } finally {
            setLoading(false);
        }
    }

    async function handleAutoAssign() {
        try {
            setAutoAssigning(true);
            const result = await automationApi.autoAssignDaily(targetDate);
            setAlertModal({ message: result.message || "注文を割り当てました", type: "success" });
        } catch (err) {
            setAlertModal({ message: err instanceof Error ? err.message : "自動割り当てに失敗しました", type: "error" });
        } finally {
            setAutoAssigning(false);
        }
    }

    async function handleRegenerateAll() {
        try {
            setRegenerating(true);
            const result = await automationApi.generateAllRoutes(targetDate);
            await fetchRoutes();
            setAlertModal({ message: result.message || "ルートを再生成しました", type: "success" });
        } catch (err) {
            setAlertModal({ message: err instanceof Error ? err.message : "ルート再生成に失敗しました", type: "error" });
        } finally {
            setRegenerating(false);
        }
    }

    async function handleStartAll() {
        try {
            setStartingAll(true);
            const result = await routesApi.startAll(targetDate);
            // Small delay to let backend commit changes
            await new Promise(resolve => setTimeout(resolve, 300));
            await fetchRoutes(); // Refresh to show updated status
            setAlertModal({ message: result.message || `${result.count}件のルートを開始しました`, type: "success" });
        } catch (err) {
            setAlertModal({ message: err instanceof Error ? err.message : "ルート開始に失敗しました", type: "error" });
        } finally {
            setStartingAll(false);
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

    return (
        <MainLayout title="ルート計画" subtitle="スタッフルートの最適化と追跡">
            {/* Date Selector */}
            <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                <label className="text-sm font-medium text-foreground">対象日:</label>
                <input
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="w-full sm:w-auto px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <div className="flex gap-2 w-full sm:w-auto">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setTargetDate(new Date(new Date(targetDate).setDate(new Date(targetDate).getDate() - 1)).toISOString().split('T')[0])}
                    >
                        前日
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setTargetDate(new Date().toISOString().split('T')[0])}
                    >
                        今日
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setTargetDate(new Date(new Date(targetDate).setDate(new Date(targetDate).getDate() + 1)).toISOString().split('T')[0])}
                    >
                        翌日
                    </Button>
                </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 sm:gap-3 mb-6">
                <Button variant="outline" className="gap-2 flex-1 sm:flex-initial" onClick={handleAutoAssign} disabled={autoAssigning}>
                    {autoAssigning ? (
                        <span className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            割り当て中...
                        </span>
                    ) : (
                        <span className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            自動割り当て
                        </span>
                    )}
                </Button>
                <Button className="gap-2 flex-1 sm:flex-initial" onClick={handleRegenerateAll} disabled={regenerating}>
                    {regenerating ? (
                        <span className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            生成中...
                        </span>
                    ) : (
                        <span className="flex items-center gap-2">
                            <RefreshCw className="h-4 w-4" />
                            全ルート再生成
                        </span>
                    )}
                </Button>
                <Button variant="secondary" className="gap-2 flex-1 sm:flex-initial" onClick={handleStartAll} disabled={startingAll}>
                    {startingAll ? (
                        <span className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            処理中...
                        </span>
                    ) : (
                        <span className="flex items-center gap-2">
                            <Play className="h-4 w-4" />
                            全ルート開始
                        </span>
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
                <div className="flex flex-col items-center justify-center h-64 gap-4">
                    <p className="text-muted-foreground text-lg">本日のルートはありません</p>
                    <p className="text-sm text-muted-foreground">ルートを生成するには、まず注文を割り当ててください</p>
                    <Button onClick={handleRegenerateAll} disabled={regenerating} className="gap-2">
                        {regenerating ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                生成中...
                            </>
                        ) : (
                            <>
                                <RefreshCw className="h-4 w-4" />
                                ルートを生成
                            </>
                        )}
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
                    {/* Route List */}
                    <div className="space-y-4 max-h-[600px] lg:max-h-none overflow-y-auto lg:overflow-visible">
                        <h3 className="text-lg font-semibold text-foreground sticky top-0 bg-background py-2 lg:static">本日のルート</h3>
                        {routes.map((route, index) => (
                            <button
                                key={route.route_id}
                                onClick={() => setSelectedRoute(route.route_id)}
                                className={cn(
                                    "w-full rounded-xl border p-4 text-left transition-all duration-200",
                                    selectedRoute === route.route_id
                                        ? "border-primary bg-primary/10 shadow-lg"
                                        : "border-border bg-card hover:border-primary/50 card-shadow"
                                )}
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
                                    {canEditRoute() && (
                                        <span className="ml-2 text-xs text-muted-foreground font-normal">
                                            ドラッグして並び替え
                                        </span>
                                    )}
                                </h3>
                                <DraggableStopList
                                    stops={activeRoute.stops}
                                    routeId={activeRoute.route_id}
                                    onStopUpdate={handleStopUpdate}
                                    onReorder={handleReorder}
                                    canEdit={canEditRoute()}
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Alert Modal */}
            <AlertModal
                isOpen={alertModal !== null}
                onClose={() => setAlertModal(null)}
                message={alertModal?.message || ""}
                type={alertModal?.type || "info"}
            />
        </MainLayout>
    );
}
