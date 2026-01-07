"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Upload, UserPlus, MapPin, RefreshCw, Loader2, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { automationApi } from "@/lib/api";
import { ImportOrdersModal } from "@/components/modals/ImportOrdersModal";
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
    const [showImportModal, setShowImportModal] = useState(false);

    const userRole = session?.user?.role || "buyer";
    const isAdmin = userRole === "admin" || userRole === "supervisor";

    // Use Japan timezone for today's date
    const now = new Date();
    const japanTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
    const today = japanTime.toISOString().split("T")[0];

    async function handleAction(actionType: string) {
        console.log("Action triggered:", actionType);

        if (actionType === "import") {
            setShowImportModal(true);
            return;
        }

        setLoading(actionType);
        try {
            switch (actionType) {
                case "assign":
                    console.log("Starting staff assignment for:", today);
                    const assignResult = await automationApi.autoAssignDaily(today);
                    console.log("Assignment result:", assignResult);
                    alert("スタッフ割当が完了しました");
                    window.location.reload();
                    break;
                case "routes":
                    console.log("Starting route generation for:", today);
                    const routeResult = await automationApi.generateAllRoutes(today);
                    console.log("Route result:", routeResult);
                    alert("ルート生成が完了しました");
                    window.location.reload();
                    break;
                case "sync":
                    console.log("Refreshing page...");
                    window.location.reload();
                    break;
                default:
                    console.warn("Unknown action type:", actionType);
                    alert("不明なアクションです");
            }
        } catch (err) {
            console.error("Action failed:", err);
            const errorMessage = err instanceof Error ? err.message : "操作に失敗しました";
            alert(errorMessage);
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
            description: "Robot-inから取込",
            variant: "default",
        },
        {
            id: "assign",
            icon: UserPlus,
            label: "スタッフ割当",
            description: "本日分を自動割当",
            variant: "secondary",
        },
        {
            id: "routes",
            icon: MapPin,
            label: "ルート生成",
            description: "全ルート最適化",
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
            description: "今日のルート",
            href: "/routes/my-route",
        },
        {
            id: "sync",
            icon: RefreshCw,
            label: "状態更新",
            description: "最新に更新",
            variant: "secondary",
        },
    ];

    const actions = isAdmin ? adminActions : buyerActions;

    return (
        <>
            <div className="rounded-xl border border-border bg-card card-shadow p-5">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                    クイックアクション
                </h3>
                <div className="grid grid-cols-2 gap-3">
                    {actions.map((action, index) => {
                        const Icon = action.icon;

                        if (action.href) {
                            return (
                                <Button
                                    key={action.id}
                                    variant={action.variant || "default"}
                                    className="h-auto flex-col items-start gap-2 p-3 animate-fade-in overflow-hidden"
                                    style={{ animationDelay: `${index * 50}ms` }}
                                    asChild
                                >
                                    <Link href={action.href}>
                                        <Icon className="h-5 w-5 shrink-0" />
                                        <div className="text-left w-full min-w-0">
                                            <p className="font-medium text-sm truncate">{action.label}</p>
                                            <p className="text-xs opacity-70 font-normal truncate">
                                                {action.description}
                                            </p>
                                        </div>
                                    </Link>
                                </Button>
                            );
                        }

                        return (
                            <Button
                                key={action.id}
                                variant={action.variant || "default"}
                                className="h-auto flex-col items-start gap-2 p-3 animate-fade-in overflow-hidden"
                                style={{ animationDelay: `${index * 50}ms` }}
                                onClick={() => handleAction(action.id)}
                                disabled={loading !== null}
                            >
                                {loading === action.id ? (
                                    <Loader2 className="h-5 w-5 animate-spin shrink-0" />
                                ) : (
                                    <Icon className="h-5 w-5 shrink-0" />
                                )}
                                <div className="text-left w-full min-w-0">
                                    <p className="font-medium text-sm truncate">{action.label}</p>
                                    <p className="text-xs opacity-70 font-normal truncate">
                                        {action.description}
                                    </p>
                                </div>
                            </Button>
                        );
                    })}
                </div>
            </div>

            {/* Import Orders Modal */}
            <ImportOrdersModal
                isOpen={showImportModal}
                onClose={() => setShowImportModal(false)}
                onSuccess={() => window.location.reload()}
            />
        </>
    );
}

