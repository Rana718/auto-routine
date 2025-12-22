"use client";

import { useState } from "react";
import { Upload, UserPlus, MapPin, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { automationApi } from "@/lib/api";

export function QuickActions() {
    const [loading, setLoading] = useState<string | null>(null);

    const today = new Date().toISOString().split("T")[0];

    async function handleAction(actionType: string) {
        setLoading(actionType);
        try {
            switch (actionType) {
                case "import":
                    // Would open import dialog - for now just reload
                    window.location.reload();
                    break;
                case "assign":
                    await automationApi.autoAssignDaily(today);
                    window.location.reload();
                    break;
                case "routes":
                    await automationApi.generateAllRoutes(today);
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

    const actions = [
        {
            id: "import",
            icon: Upload,
            label: "注文取込",
            description: "Robot-inからインポート",
            variant: "default" as const,
        },
        {
            id: "assign",
            icon: UserPlus,
            label: "スタッフ割当",
            description: "本日の注文を自動割当",
            variant: "secondary" as const,
        },
        {
            id: "routes",
            icon: MapPin,
            label: "ルート生成",
            description: "全ルートを最適化",
            variant: "secondary" as const,
        },
        {
            id: "sync",
            icon: RefreshCw,
            label: "状態同期",
            description: "購入状況を更新",
            variant: "secondary" as const,
        },
    ];

    return (
        <div className="rounded-xl border border-border bg-card card-shadow p-5">
            <h3 className="text-lg font-semibold text-foreground mb-4">
                クイックアクション
            </h3>
            <div className="grid grid-cols-2 gap-3">
                {actions.map((action, index) => (
                    <Button
                        key={action.id}
                        variant={action.variant}
                        className="h-auto flex-col items-start gap-2 p-4 animate-fade-in"
                        style={{ animationDelay: `${index * 50}ms` }}
                        onClick={() => handleAction(action.id)}
                        disabled={loading !== null}
                    >
                        {loading === action.id ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <action.icon className="h-5 w-5" />
                        )}
                        <div className="text-left">
                            <p className="font-medium">{action.label}</p>
                            <p className="text-xs opacity-70 font-normal">
                                {action.description}
                            </p>
                        </div>
                    </Button>
                ))}
            </div>
        </div>
    );
}
