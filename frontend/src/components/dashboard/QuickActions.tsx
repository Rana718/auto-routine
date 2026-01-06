"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Upload, UserPlus, MapPin, RefreshCw, Loader2, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { automationApi } from "@/lib/api";
import Link from "next/link";

interface ActionItem {
    id: string;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    description: string;
    variant?: "default" | "secondary";
    href?: string;
}

export function QuickActions() {
    const { data: session } = useSession();
    const [loading, setLoading] = useState<string | null>(null);

    const userRole = session?.user?.role || "buyer";
    const isAdmin = userRole === "admin" || userRole === "supervisor";

    const today = new Date().toISOString().split("T")[0];

    async function handleAction(actionType: string) {
        setLoading(actionType);
        try {
            switch (actionType) {
                case "import":
                    alert("注文取込機能は開発中です");
                    break;
                case "assign":
                    await automationApi.autoAssignDaily(today);
                    alert("スタッフ割当が完了しました");
                    window.location.reload();
                    break;
                case "routes":
                    await automationApi.generateAllRoutes(today);
                    alert("ルート生成が完了しました");
                    window.location.reload();
                    break;
                case "sync":
                    window.location.reload();
                    break;
            }
        } catch (err) {
            alert(err instanceof Error ? err.message : "操作に失敗しました");
        } finally {
            setLoading(null);
        }
    }

    // Admin actions - only visible to admin/supervisor
    const adminActions: ActionItem[] = [
        {
            id: "import",
            icon: Upload,
            label: "注文取込",
            description: "Robot-inからインポート",
            variant: "default",
        },
        {
            id: "assign",
            icon: UserPlus,
            label: "スタッフ割当",
            description: "本日の注文を自動割当",
            variant: "secondary",
        },
        {
            id: "routes",
            icon: MapPin,
            label: "ルート生成",
            description: "全ルートを最適化",
            variant: "secondary",
        },
        {
            id: "sync",
            icon: RefreshCw,
            label: "状態同期",
            description: "購入状況を更新",
            variant: "secondary",
        },
    ];

    // Buyer actions - only for field staff
    const buyerActions: ActionItem[] = [
        {
            id: "my-route",
            icon: Navigation,
            label: "ルート開始",
            description: "今日のルートを表示",
            href: "/routes/my-route",
        },
        {
            id: "sync",
            icon: RefreshCw,
            label: "状態更新",
            description: "購入状況を最新に",
            variant: "secondary",
        },
    ];

    const actions = isAdmin ? adminActions : buyerActions;

    return (
        <div className="rounded-xl border border-border bg-card card-shadow p-5">
            <h3 className="text-lg font-semibold text-foreground mb-4">
                クイックアクション
            </h3>
            <div className="grid grid-cols-2 gap-3">
                {actions.map((action, index) => {
                    const Icon = action.icon;

                    if (action.href) {
                        return (
                            <Link
                                key={action.id}
                                href={action.href}
                                className="h-auto flex flex-col items-start gap-2 p-4 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors animate-fade-in"
                                style={{ animationDelay: `${index * 50}ms` }}
                            >
                                <Icon className="h-5 w-5" />
                                <div className="text-left">
                                    <p className="font-medium">{action.label}</p>
                                    <p className="text-xs opacity-70 font-normal">
                                        {action.description}
                                    </p>
                                </div>
                            </Link>
                        );
                    }

                    return (
                        <Button
                            key={action.id}
                            variant={action.variant || "default"}
                            className="h-auto flex-col items-start gap-2 p-4 animate-fade-in"
                            style={{ animationDelay: `${index * 50}ms` }}
                            onClick={() => handleAction(action.id)}
                            disabled={loading !== null}
                        >
                            {loading === action.id ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <Icon className="h-5 w-5" />
                            )}
                            <div className="text-left">
                                <p className="font-medium">{action.label}</p>
                                <p className="text-xs opacity-70 font-normal">
                                    {action.description}
                                </p>
                            </div>
                        </Button>
                    );
                })}
            </div>
        </div>
    );
}
