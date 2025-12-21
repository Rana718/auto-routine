import { MapPin, Package } from "lucide-react";
import { cn } from "@/lib/utils";

interface StaffMember {
    id: string;
    name: string;
    avatar: string;
    assignedOrders: number;
    assignedStores: number;
    status: "active" | "en-route" | "idle";
    currentLocation?: string;
}

const mockStaff: StaffMember[] = [
    {
        id: "1",
        name: "田中",
        avatar: "田",
        assignedOrders: 12,
        assignedStores: 4,
        status: "en-route",
        currentLocation: "渋谷エリア",
    },
    {
        id: "2",
        name: "鈴木",
        avatar: "鈴",
        assignedOrders: 8,
        assignedStores: 3,
        status: "active",
        currentLocation: "新宿駅周辺",
    },
    {
        id: "3",
        name: "山本",
        avatar: "山",
        assignedOrders: 15,
        assignedStores: 5,
        status: "en-route",
        currentLocation: "銀座エリア",
    },
    {
        id: "4",
        name: "渡辺",
        avatar: "渡",
        assignedOrders: 6,
        assignedStores: 2,
        status: "idle",
    },
    {
        id: "5",
        name: "伊藤",
        avatar: "伊",
        assignedOrders: 10,
        assignedStores: 4,
        status: "active",
        currentLocation: "秋葉原",
    },
];

const statusConfig = {
    active: { label: "稼働中", color: "bg-success" },
    "en-route": { label: "移動中", color: "bg-primary" },
    idle: { label: "待機中", color: "bg-muted-foreground" },
};

export function StaffOverview() {
    return (
        <div className="rounded-xl border border-border bg-card card-shadow">
            <div className="border-b border-border px-6 py-4">
                <h3 className="text-lg font-semibold text-foreground">スタッフ状況</h3>
                <p className="text-sm text-muted-foreground">
                    本日稼働: {mockStaff.filter((s) => s.status !== "idle").length}名
                </p>
            </div>
            <div className="divide-y divide-border">
                {mockStaff.map((staff, index) => (
                    <div
                        key={staff.id}
                        className="flex items-center gap-4 px-6 py-4 hover:bg-muted/20 transition-colors animate-fade-in"
                        style={{ animationDelay: `${index * 50}ms` }}
                    >
                        {/* Avatar */}
                        <div className="relative">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                                {staff.avatar}
                            </div>
                            <span
                                className={cn(
                                    "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card",
                                    statusConfig[staff.status].color
                                )}
                            />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-foreground">
                                    {staff.name}
                                </p>
                                <span className="text-xs text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
                                    {statusConfig[staff.status].label}
                                </span>
                            </div>
                            {staff.currentLocation && (
                                <div className="flex items-center gap-1 mt-0.5">
                                    <MapPin className="h-3 w-3 text-muted-foreground" />
                                    <p className="text-xs text-muted-foreground">
                                        {staff.currentLocation}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Stats */}
                        <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                <Package className="h-4 w-4" />
                                <span>{staff.assignedOrders}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                <MapPin className="h-4 w-4" />
                                <span>{staff.assignedStores}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
