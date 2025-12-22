import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: LucideIcon;
    trend?: {
        value: number;
        positive: boolean;
    };
    variant?: "default" | "primary" | "success" | "warning" | "destructive";
}

const variantStyles = {
    default: "bg-card border-border",
    primary: "bg-primary/10 border-primary/20",
    success: "bg-success/10 border-success/20",
    warning: "bg-warning/10 border-warning/20",
    destructive: "bg-destructive/10 border-destructive/20",
};

const iconStyles = {
    default: "bg-secondary text-foreground",
    primary: "bg-primary text-primary-foreground",
    success: "bg-success text-success-foreground",
    warning: "bg-warning text-warning-foreground",
    destructive: "bg-destructive text-destructive-foreground",
};

export function StatCard({
    title,
    value,
    subtitle,
    icon: Icon,
    trend,
    variant = "default",
}: StatCardProps) {
    return (
        <div
            className={cn(
                "rounded-xl border p-5 card-shadow transition-all duration-200 hover:elevated-shadow animate-slide-up",
                variantStyles[variant]
            )}
        >
            <div className="flex items-start justify-between">
                <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">{title}</p>
                    <p className="text-3xl font-bold text-foreground">{value}</p>
                    {subtitle && (
                        <p className="text-sm text-muted-foreground">{subtitle}</p>
                    )}
                    {trend && (
                        <div
                            className={cn(
                                "flex items-center gap-1 text-sm font-medium",
                                trend.positive ? "text-success" : "text-destructive"
                            )}
                        >
                            <span>{trend.positive ? "↑" : "↓"}</span>
                            <span>{Math.abs(trend.value)}%</span>
                            <span className="text-muted-foreground font-normal">前日比</span>
                        </div>
                    )}
                </div>
                <div
                    className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-xl",
                        iconStyles[variant]
                    )}
                >
                    <Icon className="h-6 w-6" />
                </div>
            </div>
        </div>
    );
}
