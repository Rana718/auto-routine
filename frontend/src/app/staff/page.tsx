"use client";

import { UserPlus, MapPin, Package, Route as RouteIcon, MoreVertical } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StaffMember {
    id: string;
    name: string;
    email: string;
    phone: string;
    avatar: string;
    role: "buyer" | "supervisor" | "admin";
    assignedOrders: number;
    assignedStores: number;
    completedToday: number;
    status: "active" | "en-route" | "idle" | "off-duty";
    startLocation: string;
    currentLocation?: string;
}

const mockStaff: StaffMember[] = [
    {
        id: "1",
        name: "田中 宏",
        email: "tanaka@company.com",
        phone: "090-1234-5678",
        avatar: "田",
        role: "buyer",
        assignedOrders: 12,
        assignedStores: 4,
        completedToday: 8,
        status: "en-route",
        startLocation: "オフィス（六本木）",
        currentLocation: "渋谷エリア",
    },
    {
        id: "2",
        name: "鈴木 由紀",
        email: "suzuki@company.com",
        phone: "090-2345-6789",
        avatar: "鈴",
        role: "buyer",
        assignedOrders: 8,
        assignedStores: 3,
        completedToday: 5,
        status: "active",
        startLocation: "オフィス（六本木）",
        currentLocation: "新宿駅周辺",
    },
    {
        id: "3",
        name: "山本 健",
        email: "yamamoto@company.com",
        phone: "090-3456-7890",
        avatar: "山",
        role: "supervisor",
        assignedOrders: 15,
        assignedStores: 5,
        completedToday: 10,
        status: "en-route",
        startLocation: "自宅（池袋）",
        currentLocation: "銀座エリア",
    },
    {
        id: "4",
        name: "渡辺 芽衣",
        email: "watanabe@company.com",
        phone: "090-4567-8901",
        avatar: "渡",
        role: "buyer",
        assignedOrders: 6,
        assignedStores: 2,
        completedToday: 6,
        status: "idle",
        startLocation: "オフィス（六本木）",
    },
    {
        id: "5",
        name: "伊藤 猛",
        email: "ito@company.com",
        phone: "090-5678-9012",
        avatar: "伊",
        role: "buyer",
        assignedOrders: 10,
        assignedStores: 4,
        completedToday: 7,
        status: "active",
        startLocation: "オフィス（六本木）",
        currentLocation: "秋葉原",
    },
    {
        id: "6",
        name: "佐藤 健二",
        email: "sato@company.com",
        phone: "090-6789-0123",
        avatar: "佐",
        role: "buyer",
        assignedOrders: 0,
        assignedStores: 0,
        completedToday: 0,
        status: "off-duty",
        startLocation: "オフィス（六本木）",
    },
];

const statusConfig = {
    active: { label: "稼働中", color: "bg-success", textColor: "text-success" },
    "en-route": { label: "移動中", color: "bg-primary", textColor: "text-primary" },
    idle: { label: "待機中", color: "bg-warning", textColor: "text-warning" },
    "off-duty": { label: "休み", color: "bg-muted-foreground", textColor: "text-muted-foreground" },
};

const roleConfig = {
    buyer: { label: "バイヤー", className: "bg-secondary text-secondary-foreground" },
    supervisor: { label: "スーパーバイザー", className: "bg-primary/20 text-primary" },
    admin: { label: "管理者", className: "bg-accent/20 text-accent" },
};

export default function StaffPage() {
    return (
        <MainLayout title="スタッフ管理" subtitle="バイヤーの管理と割当状況">
            {/* Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
                <div className="rounded-xl border border-border bg-card p-4 card-shadow">
                    <p className="text-sm text-muted-foreground">スタッフ総数</p>
                    <p className="text-2xl font-bold text-foreground">{mockStaff.length}</p>
                </div>
                <div className="rounded-xl border border-success/20 bg-success/10 p-4">
                    <p className="text-sm text-muted-foreground">本日稼働</p>
                    <p className="text-2xl font-bold text-success">
                        {mockStaff.filter((s) => s.status !== "off-duty").length}
                    </p>
                </div>
                <div className="rounded-xl border border-primary/20 bg-primary/10 p-4">
                    <p className="text-sm text-muted-foreground">移動中</p>
                    <p className="text-2xl font-bold text-primary">
                        {mockStaff.filter((s) => s.status === "en-route").length}
                    </p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 card-shadow">
                    <p className="text-sm text-muted-foreground">完了注文数</p>
                    <p className="text-2xl font-bold text-foreground">
                        {mockStaff.reduce((acc, s) => acc + s.completedToday, 0)}
                    </p>
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mb-6">
                <Button className="gap-2">
                    <UserPlus className="h-4 w-4" />
                    スタッフ追加
                </Button>
                <Button variant="secondary" className="gap-2">
                    <RouteIcon className="h-4 w-4" />
                    全員自動割当
                </Button>
            </div>

            {/* Staff Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {mockStaff.map((staff, index) => (
                    <div
                        key={staff.id}
                        className="rounded-xl border border-border bg-card p-5 card-shadow hover:elevated-shadow transition-all duration-200 animate-slide-up"
                        style={{ animationDelay: `${index * 50}ms` }}
                    >
                        {/* Header */}
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-lg">
                                        {staff.avatar}
                                    </div>
                                    <span
                                        className={cn(
                                            "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card",
                                            statusConfig[staff.status].color
                                        )}
                                    />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-foreground">{staff.name}</h3>
                                    <Badge className={cn("text-xs", roleConfig[staff.role].className)}>
                                        {roleConfig[staff.role].label}
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
                                    statusConfig[staff.status].textColor
                                )}
                            >
                                {statusConfig[staff.status].label}
                            </span>
                            {staff.currentLocation && (
                                <>
                                    <span className="text-muted-foreground">•</span>
                                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                        <MapPin className="h-3 w-3" />
                                        {staff.currentLocation}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-3 gap-3 mb-4">
                            <div className="text-center p-2 rounded-lg bg-muted/30">
                                <p className="text-lg font-bold text-foreground">{staff.assignedOrders}</p>
                                <p className="text-xs text-muted-foreground">注文</p>
                            </div>
                            <div className="text-center p-2 rounded-lg bg-muted/30">
                                <p className="text-lg font-bold text-foreground">{staff.assignedStores}</p>
                                <p className="text-xs text-muted-foreground">店舗</p>
                            </div>
                            <div className="text-center p-2 rounded-lg bg-success/10">
                                <p className="text-lg font-bold text-success">{staff.completedToday}</p>
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
        </MainLayout>
    );
}
