"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Upload, Download, Store, Package, FileSpreadsheet, Loader2, Trash2, ShoppingCart } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { AlertModal } from "@/components/modals/AlertModal";
import { ConfirmModal } from "@/components/modals/ConfirmModal";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function AdminDataPage() {
    const { data: session } = useSession();
    const [alertModal, setAlertModal] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
    const [loading, setLoading] = useState<string | null>(null);
    const [confirmClear, setConfirmClear] = useState(false);

    async function handleImport(endpoint: string, loadingKey: string) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv';
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file || !session?.accessToken) return;
            try {
                setLoading(loadingKey);
                const text = await file.text();
                const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${session.accessToken}`
                    },
                    body: JSON.stringify({ csv_data: text })
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.detail || "インポートに失敗しました");
                setAlertModal({
                    message: result.message || "インポート完了",
                    type: result.errors?.length > 0 ? "info" : "success"
                });
            } catch (err) {
                setAlertModal({ message: err instanceof Error ? err.message : "インポートに失敗しました", type: "error" });
            } finally {
                setLoading(null);
            }
        };
        input.click();
    }

    async function handleExport(endpoint: string, filename: string, loadingKey: string) {
        if (!session?.accessToken) return;
        try {
            setLoading(loadingKey);
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                headers: { Authorization: `Bearer ${session.accessToken}` }
            });
            if (!response.ok) throw new Error("エクスポートに失敗しました");
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            setAlertModal({ message: "エクスポート完了", type: "success" });
        } catch (err) {
            setAlertModal({ message: err instanceof Error ? err.message : "エクスポートに失敗しました", type: "error" });
        } finally {
            setLoading(null);
        }
    }

    async function handleClearAllData() {
        if (!session?.accessToken) return;
        try {
            setLoading('clear');
            const response = await fetch(`${API_BASE_URL}/api/settings/data/clear-all`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${session.accessToken}` }
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.detail || "削除に失敗しました");
            setAlertModal({ message: result.message || "全データを削除しました", type: "success" });
        } catch (err) {
            setAlertModal({ message: err instanceof Error ? err.message : "削除に失敗しました", type: "error" });
        } finally {
            setLoading(null);
            setConfirmClear(false);
        }
    }

    const importItems = [
        {
            key: 'purchase-list',
            icon: FileSpreadsheet,
            iconColor: 'text-primary',
            title: '購入リストCSV',
            desc: '商品・店舗・マッピング',
            endpoint: '/api/settings/data/import-purchase-list',
            primary: true
        },
        {
            key: 'orders',
            icon: ShoppingCart,
            iconColor: 'text-orange-500',
            title: '注文CSV',
            desc: '注文データ取込',
            endpoint: '/api/orders/import',
            primary: true
        },
        {
            key: 'stores',
            icon: Store,
            iconColor: 'text-blue-500',
            title: '店舗CSV',
            desc: '店舗マスタ',
            endpoint: '/api/settings/data/import-stores',
            primary: false
        },
        {
            key: 'mappings',
            icon: Package,
            iconColor: 'text-green-500',
            title: 'マッピングCSV',
            desc: '商品-店舗紐付け',
            endpoint: '/api/settings/data/import-mappings',
            primary: false
        }
    ];

    return (
        <MainLayout title="データ管理" subtitle="インポート・エクスポート">
            <div className="space-y-6">
                {/* Import Section */}
                <div className="rounded-xl border border-border bg-card p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <Upload className="h-5 w-5 text-primary" />
                        <h2 className="text-base font-medium">インポート</h2>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {importItems.map((item) => (
                            <button
                                key={item.key}
                                onClick={() => handleImport(item.endpoint, item.key)}
                                disabled={loading !== null}
                                className={`p-4 rounded-lg border text-left transition-colors ${
                                    item.primary
                                        ? 'border-primary/30 bg-primary/5 hover:bg-primary/10'
                                        : 'border-border bg-muted/30 hover:bg-muted/50'
                                } disabled:opacity-50`}
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    {loading === item.key ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <item.icon className={`h-5 w-5 ${item.iconColor}`} />
                                    )}
                                    <span className="text-sm font-medium">{item.title}</span>
                                </div>
                                <p className="text-xs text-muted-foreground">{item.desc}</p>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Export Section */}
                <div className="rounded-xl border border-border bg-card p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <Download className="h-5 w-5 text-blue-500" />
                        <h2 className="text-base font-medium">エクスポート</h2>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <Button
                            variant="outline"
                            className="gap-2 justify-start h-12"
                            onClick={() => handleExport('/api/settings/data/export-stores', 'stores.csv', 'export-stores')}
                            disabled={loading !== null}
                        >
                            {loading === 'export-stores' ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Store className="h-4 w-4" />
                            )}
                            <span className="text-sm">店舗データ</span>
                        </Button>

                        <Button
                            variant="outline"
                            className="gap-2 justify-start h-12"
                            onClick={() => handleExport('/api/products/export', 'products.csv', 'export-products')}
                            disabled={loading !== null}
                        >
                            {loading === 'export-products' ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Package className="h-4 w-4" />
                            )}
                            <span className="text-sm">商品データ</span>
                        </Button>
                    </div>
                </div>

                {/* Danger Zone */}
                {/* <div className="rounded-xl border border-destructive/30 bg-card p-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Trash2 className="h-5 w-5 text-destructive" />
                            <div>
                                <h2 className="text-base font-medium">データ削除</h2>
                                <p className="text-sm text-muted-foreground">全データをリセット</p>
                            </div>
                        </div>
                        <Button
                            variant="destructive"
                            className="gap-2"
                            onClick={() => setConfirmClear(true)}
                            disabled={loading !== null}
                        >
                            {loading === 'clear' ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Trash2 className="h-4 w-4" />
                            )}
                            <span>削除</span>
                        </Button>
                    </div>
                </div> */}
            </div>

            <ConfirmModal
                isOpen={confirmClear}
                onClose={() => !loading && setConfirmClear(false)}
                onConfirm={handleClearAllData}
                title="全データ削除"
                message="本当に全てのデータを削除しますか？この操作は取り消せません。"
                confirmText="削除する"
                cancelText="キャンセル"
                variant="destructive"
                loading={loading === 'clear'}
            />

            <AlertModal
                isOpen={alertModal !== null}
                onClose={() => setAlertModal(null)}
                message={alertModal?.message || ""}
                type={alertModal?.type || "info"}
            />
        </MainLayout>
    );
}
