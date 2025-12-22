"use client";

import { useState, useEffect } from "react";
import { UserPlus, MapPin, Package, Route as RouteIcon, MoreVertical, Loader2 } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { staffApi, automationApi } from "@/lib/api";
import { CreateStaffModal } from "@/components/modals/CreateStaffModal";
import type { StaffWithStats, StaffStatus, StaffRole } from "@/lib/types";

const statusConfig: Record<StaffStatus, { label: string; color: string; textColor: string }> = {
    active: { label: "稼働中", color: "bg-success", textColor: "text-success" },
    en_route: { label: "移動中", color: "bg-primary", textColor: "text-primary" },
    idle: { label: "待機中", color: "bg-warning", textColor: "text-warning" },
    off_duty: { label: "休み", color: "bg-muted-foreground", textColor: "text-muted-foreground" },
};

const roleConfig: Record<StaffRole, { label: string; className: string }> = {
    buyer: { label: "バイヤー", className: "bg-secondary text-secondary-foreground" },
    supervisor: { label: "スーパーバイザー", className: "bg-primary/20 text-primary" },
    admin: { label: "管理者", className: "bg-accent/20 text-accent" },
};

export default function StaffPage() {
    const [staff, setStaff] = useState<StaffWithStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [autoAssigning, setAutoAssigning] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);

    useEffect(() => {
        fetchStaff();
    }, []);

    async function fetchStaff() {
        try {
            setLoading(true);
            setError(null);
            const data = await staffApi.getAll({ active_only: false });
            setStaff(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "スタッフの取得に失敗しました");
        } finally {
            setLoading(false);
        }
    }

    async function handleAutoAssignAll() {
        try {
            setAutoAssigning(true);
            const today = new Date().toISOString().split("T")[0];
            await automationApi.autoAssignDaily(today);
            await fetchStaff(); // Refresh data
        } catch (err) {
            setError(err instanceof Error ? err.message : "自動割当に失敗しました");
        } finally {
            setAutoAssigning(false);
        }
    }

    const activeCount = staff.filter((s) => s.status !== "off_duty").length;
    const enRouteCount = staff.filter((s) => s.status === "en_route").length;
    const completedTotal = staff.reduce((acc, s) => acc + s.completed_today, 0);

    return (
        <MainLayout title="スタッフ管理" subtitle="バイヤーの管理と割当状況">
            {/* Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
                <div className="rounded-xl border border-border bg-card p-4 card-shadow">
                    <p className="text-sm text-muted-foreground">スタッフ総数</p>
                    <p className="text-2xl font-bold text-foreground">{staff.length}</p>
                </div>
                <div className="rounded-xl border border-success/20 bg-success/10 p-4">
                    <p className="text-sm text-muted-foreground">本日稼働</p>
                    <p className="text-2xl font-bold text-success">{activeCount}</p>
                </div>
                <div className="rounded-xl border border-primary/20 bg-primary/10 p-4">
                    <p className="text-sm text-muted-foreground">移動中</p>
                    <p className="text-2xl font-bold text-primary">{enRouteCount}</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 card-shadow">
                    <p className="text-sm text-muted-foreground">完了注文数</p>
                    <p className="text-2xl font-bold text-foreground">{completedTotal}</p>
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mb-6">
                <Button className="gap-2" onClick={() => setShowCreateModal(true)}>
                    <UserPlus className="h-4 w-4" />
                    スタッフ追加
                </Button>
                <Button
                    variant="secondary"
                    className="gap-2"
                    onClick={handleAutoAssignAll}
                    disabled={autoAssigning}
                >
                    {autoAssigning ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            処理中...
                        </>
                    ) : (
                        <>
                            <RouteIcon className="h-4 w-4" />
                            全員自動割当
                        </>
                    )}
                </Button>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : error ? (
                <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                        <p className="text-destructive mb-2">{error}</p>
                        <button onClick={fetchStaff} className="text-primary hover:underline">
                            再試行
                        </button>
                    </div>
                </div>
            ) : staff.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                    スタッフが登録されていません
                </div>
            ) : (
                /* Staff Grid */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {staff.map((member, index) => (
                        <div
                            key={member.staff_id}
                            className="rounded-xl border border-border bg-card p-5 card-shadow hover:elevated-shadow transition-all duration-200 animate-slide-up"
                            style={{ animationDelay: `${index * 50}ms` }}
                        >
                            {/* Header */}
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-lg">
                                            {member.staff_name[0]}
                                        </div>
                                        <span
                                            className={cn(
                                                "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card",
                                                statusConfig[member.status]?.color || statusConfig.idle.color
                                            )}
                                        />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-foreground">{member.staff_name}</h3>
                                        <Badge className={cn("text-xs", roleConfig[member.role]?.className || roleConfig.buyer.className)}>
                                            {roleConfig[member.role]?.label || member.role}
                                        </Badge>
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </div>

                            {/* Status */}
                            <div className="flex items-center gap-2 mb-4">
                                <span
                                    className={cn(
                                        "text-sm font-medium",
                                        statusConfig[member.status]?.textColor || statusConfig.idle.textColor
                                    )}
                                >
                                    {statusConfig[member.status]?.label || member.status}
                                </span>
                                {member.current_location_name && (
                                    <>
                                        <span className="text-muted-foreground">•</span>
                                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                            <MapPin className="h-3 w-3" />
                                            {member.current_location_name}
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Stats */}
                            <div className="grid grid-cols-3 gap-3 mb-4">
                                <div className="text-center p-2 rounded-lg bg-muted/30">
                                    <p className="text-lg font-bold text-foreground">{member.assigned_orders}</p>
                                    <p className="text-xs text-muted-foreground">注文</p>
                                </div>
                                <div className="text-center p-2 rounded-lg bg-muted/30">
                                    <p className="text-lg font-bold text-foreground">{member.assigned_stores}</p>
                                    <p className="text-xs text-muted-foreground">店舗</p>
                                </div>
                                <div className="text-center p-2 rounded-lg bg-success/10">
                                    <p className="text-lg font-bold text-success">{member.completed_today}</p>
                                    <p className="text-xs text-muted-foreground">完了</p>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" className="flex-1 gap-1">
                                    <Package className="h-3 w-3" />
                                    割当
                                </Button>
                                <Button variant="outline" size="sm" className="flex-1 gap-1">
                                    <RouteIcon className="h-3 w-3" />
                                    ルート
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Staff Modal */}
            <CreateStaffModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onSuccess={fetchStaff}
            />
        </MainLayout>
    );
}
