import { MapPin, Package, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { StaffWithStats, StaffStatus } from "@/lib/types";

interface StaffOverviewProps {
    staff: StaffWithStats[];
}

const statusConfig: Record<StaffStatus, { label: string; color: string }> = {
    active: { label: "稼働中", color: "bg-success" },
    en_route: { label: "移動中", color: "bg-primary" },
    idle: { label: "待機中", color: "bg-muted-foreground" },
    off_duty: { label: "非稼働", color: "bg-muted-foreground/50" },
};

export function StaffOverview({ staff }: StaffOverviewProps) {
    const activeCount = staff.filter((s) => s.status !== "off_duty" && s.status !== "idle").length;

    // Show only top 5 staff members
    const displayedStaff = staff.slice(0, 5);
    const hasMore = staff.length > 5;

    return (
        <div className="rounded-xl border border-border bg-card card-shadow">
            <div className="border-b border-border px-4 md:px-6 py-3 md:py-4">
                <h3 className="text-base md:text-lg font-semibold text-foreground">スタッフ状況</h3>
                <p className="text-xs md:text-sm text-muted-foreground">
                    本日稼働: {activeCount}名
                </p>
            </div>
            {staff.length === 0 ? (
                <div className="flex items-center justify-center h-24 text-muted-foreground">
                    スタッフがいません
                </div>
            ) : (
                <>
                    <div className="divide-y divide-border">
                        {displayedStaff.map((member, index) => (
                            <div
                                key={member.staff_id}
                                className="flex items-center gap-3 md:gap-4 px-4 md:px-6 py-3 md:py-4 hover:bg-muted/20 transition-colors animate-fade-in"
                                style={{ animationDelay: `${index * 50}ms` }}
                            >
                                {/* Avatar */}
                                <div className="relative shrink-0">
                                    <div className="flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-sm md:text-base">
                                        {member.staff_name[0]}
                                    </div>
                                    <span
                                        className={cn(
                                            "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card",
                                            statusConfig[member.status]?.color || statusConfig.idle.color
                                        )}
                                    />
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium text-foreground truncate">
                                            {member.staff_name}
                                        </p>
                                        <span className="text-xs text-muted-foreground px-1.5 py-0.5 rounded bg-muted shrink-0">
                                            {statusConfig[member.status]?.label || member.status}
                                        </span>
                                    </div>
                                    {member.current_location_name && (
                                        <div className="flex items-center gap-1 mt-0.5">
                                            <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                                            <p className="text-xs text-muted-foreground truncate">
                                                {member.current_location_name}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Stats - hidden on small mobile */}
                                <div className="hidden sm:flex items-center gap-3 md:gap-4 text-xs md:text-sm shrink-0">
                                    <div className="flex items-center gap-1.5 text-muted-foreground">
                                        <Package className="h-4 w-4" />
                                        <span>{member.assigned_orders}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-muted-foreground">
                                        <MapPin className="h-4 w-4" />
                                        <span>{member.assigned_stores}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* More button */}
                    {hasMore && (
                        <div className="border-t border-border px-6 py-3">
                            <Button
                                variant="ghost"
                                className="w-full justify-center gap-2 text-primary hover:text-primary"
                                asChild
                            >
                                <Link href="/staff">
                                    もっと見る ({staff.length - 5}名)
                                    <ChevronRight className="h-4 w-4" />
                                </Link>
                            </Button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

