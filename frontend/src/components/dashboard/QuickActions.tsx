"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { FileSpreadsheet, UserPlus, MapPin, RefreshCw, Loader2, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { automationApi } from "@/lib/api";
import { AlertModal } from "@/components/modals/AlertModal";
import { readFileAsCSVText } from "@/lib/excel";
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
    const [alertModal, setAlertModal] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

    const userRole = session?.user?.role || "buyer";
    const isAdmin = userRole === "admin" || userRole === "supervisor";

    // Use Japan timezone for today's date
    const now = new Date();
    const japanTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
    const today = japanTime.toISOString().split("T")[0];

    async function handleAction(actionType: string) {
        console.log("Action triggered:", actionType);

        if (actionType === "import") {
            // Open file picker for purchase list CSV
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.csv,.xlsx,.xls';
            input.onchange = async (ev) => {
                const file = (ev.target as HTMLInputElement).files?.[0];
                if (!file) return;
                const token = (session as any)?.accessToken;
                if (!token) {
                    setAlertModal({ message: "認証トークンが見つかりません", type: "error" });
                    return;
                }
                setLoading("import");
                try {
                    const text = await readFileAsCSVText(file);
                    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/settings/data/import-purchase-list`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ csv_data: text, target_date: today })
                    });
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.detail || "インポートに失敗しました");
                    setAlertModal({ message: result.message || "購入リストをインポートしました", type: "success" });
                    setTimeout(() => window.location.reload(), 1500);
                } catch (err) {
                    setAlertModal({ message: err instanceof Error ? err.message : "インポートに失敗しました", type: "error" });
                } finally {
                    setLoading(null);
                }
            };
            input.click();
            return;
        }

        setLoading(actionType);
        try {
            switch (actionType) {
                case "assign":
                    console.log("Starting staff assignment for:", today);
                    const assignResult = await automationApi.autoAssignDaily(today);
                    console.log("Assignment result:", assignResult);
                    setAlertModal({ message: "スタッフ割当が完了しました", type: "success" });
                    setTimeout(() => window.location.reload(), 1500);
                    break;
                case "routes":
                    console.log("Starting route generation for:", today);
                    const routeResult = await automationApi.generateAllRoutes(today);
                    console.log("Route result:", routeResult);
                    setAlertModal({ message: "ルート生成が完了しました", type: "success" });
                    setTimeout(() => window.location.reload(), 1500);
                    break;
                case "sync":
                    console.log("Refreshing page...");
                    window.location.reload();
                    break;
                default:
                    console.warn("Unknown action type:", actionType);
                    setAlertModal({ message: "不明なアクションです", type: "error" });
            }
        } catch (err) {
            console.error("Action failed:", err);
            const errorMessage = err instanceof Error ? err.message : "操作に失敗しました";
            setAlertModal({ message: errorMessage, type: "error" });
        } finally {
            setLoading(null);
        }
    }

    // Admin actions - only visible to admin/supervisor
    const adminActions: ActionItem[] = [
        {
            id: "import",
            icon: FileSpreadsheet,
            label: "購入リスト取込",
            description: "CSV/Excelから取込",
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
            <div className="rounded-xl border border-border bg-card card-shadow p-4 md:p-5">
                <h3 className="text-base md:text-lg font-semibold text-foreground mb-3 md:mb-4">
                    クイックアクション
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3">
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

            {/* Alert Modal */}
            <AlertModal
                isOpen={alertModal !== null}
                onClose={() => setAlertModal(null)}
                message={alertModal?.message || ""}
                type={alertModal?.type || "info"}
            />
        </>
    );
}

