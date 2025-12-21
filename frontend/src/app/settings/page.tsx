"use client";

import { Clock, Users, MapPin, Bell, Database } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SettingSection {
    title: string;
    description: string;
    icon: React.ElementType;
    settings: {
        label: string;
        description: string;
        value: string | boolean;
        type: "text" | "toggle" | "select";
        options?: string[];
    }[];
}

const settingsSections: SettingSection[] = [
    {
        title: "注文締切",
        description: "日次の注文処理時間を設定",
        icon: Clock,
        settings: [
            {
                label: "日次締切時間",
                description: "この時間以降の注文は翌営業日に処理",
                value: "13:10",
                type: "text",
            },
            {
                label: "週末処理",
                description: "週末の注文処理を許可",
                value: false,
                type: "toggle",
            },
            {
                label: "祝日オーバーライド",
                description: "繁忙期の処理を有効化",
                value: true,
                type: "toggle",
            },
        ],
    },
    {
        title: "スタッフ設定",
        description: "スタッフ割当のデフォルト設定",
        icon: Users,
        settings: [
            {
                label: "デフォルト出発地点",
                description: "ルートの開始地点",
                value: "オフィス（六本木）",
                type: "text",
            },
            {
                label: "スタッフあたり最大注文数",
                description: "1人に割り当てる最大注文数",
                value: "20",
                type: "text",
            },
            {
                label: "自動割当",
                description: "空きスタッフに自動で注文を割当",
                value: true,
                type: "toggle",
            },
        ],
    },
    {
        title: "ルート最適化",
        description: "ルート生成の設定",
        icon: MapPin,
        settings: [
            {
                label: "最適化優先度",
                description: "ルート最適化の方針",
                value: "速度優先",
                type: "select",
                options: ["速度優先", "距離優先", "コスト優先", "バランス"],
            },
            {
                label: "最大ルート時間",
                description: "1ルートの最大時間",
                value: "4時間",
                type: "text",
            },
            {
                label: "復路を含む",
                description: "出発地点への帰還時間を計算",
                value: true,
                type: "toggle",
            },
        ],
    },
    {
        title: "通知",
        description: "アラートと通知の設定",
        icon: Bell,
        settings: [
            {
                label: "締切前警告",
                description: "日次締切前にアラート",
                value: true,
                type: "toggle",
            },
            {
                label: "注文失敗アラート",
                description: "購入失敗時に通知",
                value: true,
                type: "toggle",
            },
            {
                label: "ルート完了通知",
                description: "スタッフがルートを完了したら通知",
                value: false,
                type: "toggle",
            },
        ],
    },
];

export default function SettingsPage() {
    return (
        <MainLayout title="設定" subtitle="システム設定の構成">
            <div className="max-w-4xl space-y-6">
                {settingsSections.map((section, sectionIndex) => (
                    <div
                        key={section.title}
                        className="rounded-xl border border-border bg-card card-shadow overflow-hidden animate-slide-up"
                        style={{ animationDelay: `${sectionIndex * 50}ms` }}
                    >
                        {/* Section Header */}
                        <div className="flex items-center gap-4 p-5 border-b border-border bg-muted/20">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                                <section.icon className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-foreground">{section.title}</h3>
                                <p className="text-sm text-muted-foreground">{section.description}</p>
                            </div>
                        </div>

                        {/* Settings Items */}
                        <div className="divide-y divide-border">
                            {section.settings.map((setting) => (
                                <div
                                    key={setting.label}
                                    className="flex items-center justify-between p-5 hover:bg-muted/10 transition-colors"
                                >
                                    <div className="flex-1">
                                        <p className="font-medium text-foreground">{setting.label}</p>
                                        <p className="text-sm text-muted-foreground">{setting.description}</p>
                                    </div>

                                    {setting.type === "toggle" ? (
                                        <button
                                            className={cn(
                                                "relative h-6 w-11 rounded-full transition-colors",
                                                setting.value ? "bg-primary" : "bg-muted"
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                                                    setting.value ? "left-[22px]" : "left-0.5"
                                                )}
                                            />
                                        </button>
                                    ) : setting.type === "select" ? (
                                        <select className="h-9 rounded-lg border border-border bg-secondary px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary">
                                            {setting.options?.map((option) => (
                                                <option key={option} value={option} selected={option === setting.value}>
                                                    {option}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            defaultValue={setting.value as string}
                                            className="h-9 w-32 rounded-lg border border-border bg-secondary px-3 text-sm text-foreground text-right focus:outline-none focus:ring-2 focus:ring-primary"
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}

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

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <Button variant="outline">店舗インポート</Button>
                        <Button variant="outline">注文エクスポート</Button>
                        <Button variant="outline">データバックアップ</Button>
                    </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end gap-3">
                    <Button variant="outline">キャンセル</Button>
                    <Button>変更を保存</Button>
                </div>
            </div>
        </MainLayout>
    );
}
