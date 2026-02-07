"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { MapPin, CheckCircle, Clock, AlertTriangle, Loader2, Navigation, Store } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getJSTDateString } from "@/lib/date";
import dynamic from "next/dynamic";
import { AlertModal } from "@/components/modals/AlertModal";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Dynamic import for map to avoid SSR issues
const RouteMap = dynamic(
    () => import("@/components/map/RouteMap").then(mod => mod.RouteMap),
    { ssr: false, loading: () => <div className="h-100 bg-muted rounded-xl animate-pulse" /> }
);

interface RouteStop {
    stop_id: number;
    store_id: number;
    store_name: string;
    store_address: string;
    store_latitude: number;
    store_longitude: number;
    stop_sequence: number;
    stop_status: string;
    items_count: number;
    total_quantity?: number;
}

interface MyRoute {
    route_id: number;
    route_date: string;
    status: string;
    start_location: string;
    start_latitude: number;
    start_longitude: number;
    stops: RouteStop[];
    total_distance_km: number;
    estimated_time_minutes: number;
}

const statusConfig: Record<string, { label: string; icon: React.ElementType; className: string }> = {
    pending: { label: "待機中", icon: Clock, className: "bg-warning/20 text-warning" },
    current: { label: "移動中", icon: Navigation, className: "bg-primary/20 text-primary" },
    completed: { label: "完了", icon: CheckCircle, className: "bg-success/20 text-success" },
    failed: { label: "失敗", icon: AlertTriangle, className: "bg-destructive/20 text-destructive" },
};

export default function MyRoutePage() {
    const { data: session } = useSession();
    const [route, setRoute] = useState<MyRoute | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [updatingStop, setUpdatingStop] = useState<number | null>(null);
    const [alertModal, setAlertModal] = useState<{ message: string; type: "error" } | null>(null);

    const today = getJSTDateString();

    useEffect(() => {
        if (session?.accessToken) {
            fetchMyRoute();
        }
    }, [session]);

    async function fetchMyRoute() {
        if (!session?.accessToken || !session?.user?.id) return;

        try {
            setLoading(true);
            setError(null);

            // Fetch routes for today and find the one assigned to current user
            const response = await fetch(
                `${API_BASE_URL}/api/routes?route_date=${today}&staff_id=${session.user.id}`,
                { headers: { Authorization: `Bearer ${session.accessToken}` } }
            );

            if (!response.ok) throw new Error("ルートの取得に失敗しました");

            const routes = await response.json();
            if (routes.length > 0) {
                setRoute(routes[0]);
            } else {
                setRoute(null);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "エラーが発生しました");
        } finally {
            setLoading(false);
        }
    }

    async function updateStopStatus(stopId: number, newStatus: string) {
        if (!session?.accessToken || !route) return;

        // Optimistic update — apply immediately for fast UI feedback
        setRoute(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                stops: prev.stops.map(s =>
                    s.stop_id === stopId ? { ...s, stop_status: newStatus } : s
                ),
            };
        });

        try {
            setUpdatingStop(stopId);
            const res = await fetch(
                `${API_BASE_URL}/api/routes/${route.route_id}/stops/${stopId}`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${session.accessToken}`
                    },
                    body: JSON.stringify({ stop_status: newStatus })
                }
            );
            if (!res.ok) throw new Error("更新に失敗しました");
            // Background sync — no need to wait
            fetchMyRoute();
        } catch (err) {
            // Revert on error
            fetchMyRoute();
            setAlertModal({ message: err instanceof Error ? err.message : "更新に失敗しました", type: "error" });
        } finally {
            setUpdatingStop(null);
        }
    }

    if (loading) {
        return (
            <MainLayout title="今日のルート" subtitle={`${today} の買付ルート`}>
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            </MainLayout>
        );
    }

    if (error) {
        return (
            <MainLayout title="今日のルート" subtitle={`${today} の買付ルート`}>
                <div className="text-center py-12">
                    <p className="text-destructive mb-4">{error}</p>
                    <Button onClick={fetchMyRoute}>再読み込み</Button>
                </div>
            </MainLayout>
        );
    }

    if (!route) {
        return (
            <MainLayout title="今日のルート" subtitle={`${today} の買付ルート`}>
                <div className="text-center py-12">
                    <MapPin className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-foreground mb-2">本日のルートはありません</h2>
                    <p className="text-muted-foreground">まだルートが割り当てられていないか、本日の買付はありません</p>
                </div>
            </MainLayout>
        );
    }

    const completedStops = route.stops.filter(s => s.stop_status === "completed").length;
    const totalStops = route.stops.length;
    const progressPercent = totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0;

    return (
        <MainLayout title="今日のルート" subtitle={`${today} の買付ルート`}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Route Map */}
                <div className="rounded-xl border border-border bg-card card-shadow overflow-hidden">
                    <div className="p-4 border-b border-border bg-muted/20">
                        <h3 className="font-semibold text-foreground">ルートマップ</h3>
                        <p className="text-sm text-muted-foreground">
                            {totalStops}店舗 • 約{route.total_distance_km || 0}km • 約{route.estimated_time_minutes || 0}分
                        </p>
                    </div>
                    <div className="h-100">
                        <RouteMap
                            startLocation={{
                                lat: route.start_latitude,
                                lng: route.start_longitude,
                                name: route.start_location
                            }}
                            stops={route.stops.map(s => ({
                                ...s,
                                total_quantity: s.total_quantity || s.items_count,
                                latitude: s.store_latitude,
                                longitude: s.store_longitude
                            }))}
                        />
                    </div>
                </div>

                {/* Right: Stop List */}
                <div className="space-y-4">
                    {/* Progress Card */}
                    <div className="rounded-xl border border-border bg-card p-4 card-shadow">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-foreground">進捗状況</h3>
                            <span className="text-2xl font-bold text-primary">{progressPercent}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                                className="h-full bg-primary transition-all duration-500"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">
                            {completedStops}/{totalStops} 店舗完了
                        </p>
                    </div>

                    {/* Stop List */}
                    <div className="rounded-xl border border-border bg-card card-shadow overflow-hidden">
                        <div className="p-4 border-b border-border bg-muted/20">
                            <h3 className="font-semibold text-foreground">訪問リスト</h3>
                        </div>
                        <div className="divide-y divide-border max-h-125 overflow-y-auto">
                            {route.stops
                                .sort((a, b) => a.stop_sequence - b.stop_sequence)
                                .map((stop) => {
                                    const StatusIcon = statusConfig[stop.stop_status]?.icon || Clock;
                                    return (
                                        <div key={stop.stop_id} className="p-4 hover:bg-muted/20">
                                            <div className="flex items-start gap-3">
                                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                                                    {stop.stop_sequence}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium text-foreground truncate">
                                                            {stop.store_name}
                                                        </span>
                                                        <Badge className={cn("text-xs", statusConfig[stop.stop_status]?.className)}>
                                                            <StatusIcon className="h-3 w-3 mr-1" />
                                                            {statusConfig[stop.stop_status]?.label || stop.stop_status}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-sm text-muted-foreground truncate">
                                                        {stop.store_address}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        {stop.total_quantity || stop.items_count}個の商品
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Action Buttons */}
                                            {stop.stop_status !== "completed" && (
                                                <div className="flex gap-2 mt-3 ml-11">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => updateStopStatus(stop.stop_id, "completed")}
                                                        disabled={updatingStop === stop.stop_id}
                                                    >
                                                        {updatingStop === stop.stop_id ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <>
                                                                <CheckCircle className="h-4 w-4 mr-1" />
                                                                完了
                                                            </>
                                                        )}
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => updateStopStatus(stop.stop_id, "failed")}
                                                        disabled={updatingStop === stop.stop_id}
                                                    >
                                                        <AlertTriangle className="h-4 w-4 mr-1" />
                                                        購入不可
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Alert Modal */}
            <AlertModal
                isOpen={alertModal !== null}
                onClose={() => setAlertModal(null)}
                message={alertModal?.message || ""}
                type="error"
            />
        </MainLayout>
    );
}
