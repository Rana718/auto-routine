"use client";

import { useState, useEffect } from "react";
import { Clock, Users, MapPin, Bell, Database, Loader2, Calendar } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { settingsApi, extendedSettingsApi } from "@/lib/api";
import type { AllSettings } from "@/lib/types";
import Link from "next/link";

export default function SettingsPage() {
    const [settings, setSettings] = useState<AllSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Local form state
    const [cutoffTime, setCutoffTime] = useState("13:10");
    const [weekendProcessing, setWeekendProcessing] = useState(false);
    const [holidayOverride, setHolidayOverride] = useState(true);
    const [defaultStartLocation, setDefaultStartLocation] = useState("オフィス（六本木）");
    const [maxOrdersPerStaff, setMaxOrdersPerStaff] = useState(20);
    const [autoAssign, setAutoAssign] = useState(true);
    const [optimizationPriority, setOptimizationPriority] = useState("speed");
    const [maxRouteTimeHours, setMaxRouteTimeHours] = useState(4);
    const [includeReturn, setIncludeReturn] = useState(true);
    const [cutoffWarning, setCutoffWarning] = useState(true);
    const [orderFailureAlert, setOrderFailureAlert] = useState(true);
    const [routeCompletionNotification, setRouteCompletionNotification] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    async function fetchSettings() {
        try {
            setLoading(true);
            setError(null);
            const data = await settingsApi.getAll();
            setSettings(data);

            // Update form state
            if (data.cutoff) {
                setCutoffTime(data.cutoff.cutoff_time);
                setWeekendProcessing(data.cutoff.weekend_processing);
                setHolidayOverride(data.cutoff.holiday_override);
            }
            if (data.staff) {
                setDefaultStartLocation(data.staff.default_start_location);
                setMaxOrdersPerStaff(data.staff.max_orders_per_staff);
                setAutoAssign(data.staff.auto_assign);
            }
            if (data.route) {
                setOptimizationPriority(data.route.optimization_priority);
                setMaxRouteTimeHours(data.route.max_route_time_hours);
                setIncludeReturn(data.route.include_return);
            }
            if (data.notification) {
                setCutoffWarning(data.notification.cutoff_warning);
                setOrderFailureAlert(data.notification.order_failure_alert);
                setRouteCompletionNotification(data.notification.route_completion_notification);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "設定の取得に失敗しました");
        } finally {
            setLoading(false);
        }
    }

    async function handleSave() {
        try {
            setSaving(true);
            setError(null);

            await Promise.all([
                settingsApi.updateCutoff({
                    cutoff_time: cutoffTime,
                    weekend_processing: weekendProcessing,
                    holiday_override: holidayOverride,
                }),
                settingsApi.updateStaff({
                    default_start_location: defaultStartLocation,
                    max_orders_per_staff: maxOrdersPerStaff,
                    auto_assign: autoAssign,
                }),
                settingsApi.updateRoute({
                    optimization_priority: optimizationPriority,
                    max_route_time_hours: maxRouteTimeHours,
                    include_return: includeReturn,
                }),
                settingsApi.updateNotification({
                    cutoff_warning: cutoffWarning,
                    order_failure_alert: orderFailureAlert,
                    route_completion_notification: routeCompletionNotification,
                }),
            ]);

            await fetchSettings();
        } catch (err) {
            setError(err instanceof Error ? err.message : "設定の保存に失敗しました");
        } finally {
            setSaving(false);
        }
    }

    async function handleImportStores() {
        try {
            await settingsApi.importStores();
            alert("店舗データのインポートが完了しました");
        } catch (err) {
            alert(err instanceof Error ? err.message : "インポートに失敗しました");
        }
    }

    async function handleExportOrders() {
        try {
            await settingsApi.exportOrders();
            alert("注文データのエクスポートが完了しました");
        } catch (err) {
            alert(err instanceof Error ? err.message : "エクスポートに失敗しました");
        }
    }

    async function handleBackup() {
        try {
            await settingsApi.backup();
            alert("バックアップが完了しました");
        } catch (err) {
            alert(err instanceof Error ? err.message : "バックアップに失敗しました");
        }
    }

    if (loading) {
        return (
            <MainLayout title="設定" subtitle="システム設定の構成">
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout title="設定" subtitle="システム設定の構成">
            <div className="max-w-4xl space-y-6">
                {error && (
                    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                        {error}
                    </div>
                )}

                {/* Cutoff Settings */}
                <div className="rounded-xl border border-border bg-card card-shadow overflow-hidden animate-slide-up">
                    <div className="flex items-center gap-4 p-5 border-b border-border bg-muted/20">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                            <Clock className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-foreground">注文締切</h3>
                            <p className="text-sm text-muted-foreground">日次の注文処理時間を設定</p>
                        </div>
                    </div>
                    <div className="divide-y divide-border">
                        <div className="flex items-center justify-between p-5 hover:bg-muted/10 transition-colors">
                            <div className="flex-1">
                                <p className="font-medium text-foreground">日次締切時間</p>
                                <p className="text-sm text-muted-foreground">この時間以降の注文は翌営業日に処理</p>
                            </div>
                            <input
                                type="time"
                                value={cutoffTime}
                                onChange={(e) => setCutoffTime(e.target.value)}
                                className="h-9 w-32 rounded-lg border border-border bg-secondary px-3 text-sm text-foreground text-right focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>
                        <div className="flex items-center justify-between p-5 hover:bg-muted/10 transition-colors">
                            <div className="flex-1">
                                <p className="font-medium text-foreground">週末処理</p>
                                <p className="text-sm text-muted-foreground">週末の注文処理を許可</p>
                            </div>
                            <button
                                onClick={() => setWeekendProcessing(!weekendProcessing)}
                                className={cn(
                                    "relative h-6 w-11 rounded-full transition-colors",
                                    weekendProcessing ? "bg-primary" : "bg-muted"
                                )}
                            >
                                <span
                                    className={cn(
                                        "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                                        weekendProcessing ? "left-[22px]" : "left-0.5"
                                    )}
                                />
                            </button>
                        </div>
                        <div className="flex items-center justify-between p-5 hover:bg-muted/10 transition-colors">
                            <div className="flex-1">
                                <p className="font-medium text-foreground">祝日オーバーライド</p>
                                <p className="text-sm text-muted-foreground">繁忙期の処理を有効化</p>
                            </div>
                            <button
                                onClick={() => setHolidayOverride(!holidayOverride)}
                                className={cn(
                                    "relative h-6 w-11 rounded-full transition-colors",
                                    holidayOverride ? "bg-primary" : "bg-muted"
                                )}
                            >
                                <span
                                    className={cn(
                                        "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                                        holidayOverride ? "left-[22px]" : "left-0.5"
                                    )}
                                />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Staff Settings */}
                <div className="rounded-xl border border-border bg-card card-shadow overflow-hidden animate-slide-up" style={{ animationDelay: "50ms" }}>
                    <div className="flex items-center gap-4 p-5 border-b border-border bg-muted/20">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                            <Users className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-foreground">スタッフ設定</h3>
                            <p className="text-sm text-muted-foreground">スタッフ割当のデフォルト設定</p>
                        </div>
                    </div>
                    <div className="divide-y divide-border">
                        <div className="flex items-center justify-between p-5 hover:bg-muted/10 transition-colors">
                            <div className="flex-1">
                                <p className="font-medium text-foreground">デフォルト出発地点</p>
                                <p className="text-sm text-muted-foreground">ルートの開始地点</p>
                            </div>
                            <input
                                type="text"
                                value={defaultStartLocation}
                                onChange={(e) => setDefaultStartLocation(e.target.value)}
                                className="h-9 w-48 rounded-lg border border-border bg-secondary px-3 text-sm text-foreground text-right focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>
                        <div className="flex items-center justify-between p-5 hover:bg-muted/10 transition-colors">
                            <div className="flex-1">
                                <p className="font-medium text-foreground">スタッフあたり最大注文数</p>
                                <p className="text-sm text-muted-foreground">1人に割り当てる最大注文数</p>
                            </div>
                            <input
                                type="number"
                                value={maxOrdersPerStaff}
                                onChange={(e) => setMaxOrdersPerStaff(Number(e.target.value))}
                                className="h-9 w-20 rounded-lg border border-border bg-secondary px-3 text-sm text-foreground text-right focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>
                        <div className="flex items-center justify-between p-5 hover:bg-muted/10 transition-colors">
                            <div className="flex-1">
                                <p className="font-medium text-foreground">自動割当</p>
                                <p className="text-sm text-muted-foreground">空きスタッフに自動で注文を割当</p>
                            </div>
                            <button
                                onClick={() => setAutoAssign(!autoAssign)}
                                className={cn(
                                    "relative h-6 w-11 rounded-full transition-colors",
                                    autoAssign ? "bg-primary" : "bg-muted"
                                )}
                            >
                                <span
                                    className={cn(
                                        "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                                        autoAssign ? "left-[22px]" : "left-0.5"
                                    )}
                                />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Route Settings */}
                <div className="rounded-xl border border-border bg-card card-shadow overflow-hidden animate-slide-up" style={{ animationDelay: "100ms" }}>
                    <div className="flex items-center gap-4 p-5 border-b border-border bg-muted/20">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                            <MapPin className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-foreground">ルート最適化</h3>
                            <p className="text-sm text-muted-foreground">ルート生成の設定</p>
                        </div>
                    </div>
                    <div className="divide-y divide-border">
                        <div className="flex items-center justify-between p-5 hover:bg-muted/10 transition-colors">
                            <div className="flex-1">
                                <p className="font-medium text-foreground">最適化優先度</p>
                                <p className="text-sm text-muted-foreground">ルート最適化の方針</p>
                            </div>
                            <select
                                value={optimizationPriority}
                                onChange={(e) => setOptimizationPriority(e.target.value)}
                                className="h-9 rounded-lg border border-border bg-secondary px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                                <option value="speed">速度優先</option>
                                <option value="distance">距離優先</option>
                                <option value="cost">コスト優先</option>
                                <option value="balanced">バランス</option>
                            </select>
                        </div>
                        <div className="flex items-center justify-between p-5 hover:bg-muted/10 transition-colors">
                            <div className="flex-1">
                                <p className="font-medium text-foreground">最大ルート時間（時間）</p>
                                <p className="text-sm text-muted-foreground">1ルートの最大時間</p>
                            </div>
                            <input
                                type="number"
                                value={maxRouteTimeHours}
                                onChange={(e) => setMaxRouteTimeHours(Number(e.target.value))}
                                className="h-9 w-20 rounded-lg border border-border bg-secondary px-3 text-sm text-foreground text-right focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>
                        <div className="flex items-center justify-between p-5 hover:bg-muted/10 transition-colors">
                            <div className="flex-1">
                                <p className="font-medium text-foreground">復路を含む</p>
                                <p className="text-sm text-muted-foreground">出発地点への帰還時間を計算</p>
                            </div>
                            <button
                                onClick={() => setIncludeReturn(!includeReturn)}
                                className={cn(
                                    "relative h-6 w-11 rounded-full transition-colors",
                                    includeReturn ? "bg-primary" : "bg-muted"
                                )}
                            >
                                <span
                                    className={cn(
                                        "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                                        includeReturn ? "left-[22px]" : "left-0.5"
                                    )}
                                />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Notification Settings */}
                <div className="rounded-xl border border-border bg-card card-shadow overflow-hidden animate-slide-up" style={{ animationDelay: "150ms" }}>
                    <div className="flex items-center gap-4 p-5 border-b border-border bg-muted/20">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                            <Bell className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-foreground">通知</h3>
                            <p className="text-sm text-muted-foreground">アラートと通知の設定</p>
                        </div>
                    </div>
                    <div className="divide-y divide-border">
                        <div className="flex items-center justify-between p-5 hover:bg-muted/10 transition-colors">
                            <div className="flex-1">
                                <p className="font-medium text-foreground">締切前警告</p>
                                <p className="text-sm text-muted-foreground">日次締切前にアラート</p>
                            </div>
                            <button
                                onClick={() => setCutoffWarning(!cutoffWarning)}
                                className={cn(
                                    "relative h-6 w-11 rounded-full transition-colors",
                                    cutoffWarning ? "bg-primary" : "bg-muted"
                                )}
                            >
                                <span
                                    className={cn(
                                        "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                                        cutoffWarning ? "left-[22px]" : "left-0.5"
                                    )}
                                />
                            </button>
                        </div>
                        <div className="flex items-center justify-between p-5 hover:bg-muted/10 transition-colors">
                            <div className="flex-1">
                                <p className="font-medium text-foreground">注文失敗アラート</p>
                                <p className="text-sm text-muted-foreground">購入失敗時に通知</p>
                            </div>
                            <button
                                onClick={() => setOrderFailureAlert(!orderFailureAlert)}
                                className={cn(
                                    "relative h-6 w-11 rounded-full transition-colors",
                                    orderFailureAlert ? "bg-primary" : "bg-muted"
                                )}
                            >
                                <span
                                    className={cn(
                                        "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                                        orderFailureAlert ? "left-[22px]" : "left-0.5"
                                    )}
                                />
                            </button>
                        </div>
                        <div className="flex items-center justify-between p-5 hover:bg-muted/10 transition-colors">
                            <div className="flex-1">
                                <p className="font-medium text-foreground">ルート完了通知</p>
                                <p className="text-sm text-muted-foreground">スタッフがルートを完了したら通知</p>
                            </div>
                            <button
                                onClick={() => setRouteCompletionNotification(!routeCompletionNotification)}
                                className={cn(
                                    "relative h-6 w-11 rounded-full transition-colors",
                                    routeCompletionNotification ? "bg-primary" : "bg-muted"
                                )}
                            >
                                <span
                                    className={cn(
                                        "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                                        routeCompletionNotification ? "left-[22px]" : "left-0.5"
                                    )}
                                />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Data Management */}
                <div className="rounded-xl border border-border bg-card card-shadow p-5">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-foreground">
                            <Database className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-foreground">データ管理</h3>
                            <p className="text-sm text-muted-foreground">データのインポート、エクスポート、管理</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                        <Button variant="outline" onClick={handleImportStores}>店舗インポート</Button>
                        <Button variant="outline" onClick={handleExportOrders}>注文エクスポート</Button>
                        <Button variant="outline" onClick={handleBackup}>データバックアップ</Button>
                        <Button variant="outline" onClick={async () => {
                            try {
                                const result = await extendedSettingsApi.calculateDistances();
                                alert(result.message);
                            } catch (err) {
                                alert(err instanceof Error ? err.message : "距離計算に失敗しました");
                            }
                        }}>距離マトリックス計算</Button>
                    </div>

                    {/* Holiday Calendar Link */}
                    <div className="mt-4 pt-4 border-t border-border">
                        <Link href="/settings/holidays" className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                <Calendar className="h-5 w-5" />
                            </div>
                            <div className="flex-1">
                                <h4 className="font-medium text-foreground">祝日カレンダー</h4>
                                <p className="text-sm text-muted-foreground">注文締切に影響する祝日を管理</p>
                            </div>
                            <span className="text-muted-foreground">→</span>
                        </Link>
                    </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={fetchSettings}>キャンセル</Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                保存中...
                            </>
                        ) : (
                            "変更を保存"
                        )}
                    </Button>
                </div>
            </div>
        </MainLayout>
    );
}
