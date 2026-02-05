"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Upload, Download, Database, Store, Package, FileSpreadsheet, Loader2, Trash2 } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { AlertModal } from "@/components/modals/AlertModal";
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { settingsApi } from "@/lib/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function AdminDataPage() {
    const { data: session } = useSession();
    const [alertModal, setAlertModal] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
    const [loading, setLoading] = useState<string | null>(null);
    const [confirmClear, setConfirmClear] = useState(false);

    async function handleImportPurchaseList() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv';
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file || !session?.accessToken) return;
            try {
                setLoading('purchase-list');
                const text = await file.text();
                const response = await fetch(`${API_BASE_URL}/api/settings/data/import-purchase-list`, {
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
                    message: `${result.message}${result.errors?.length > 0 ? `\nエラー: ${result.errors.slice(0, 3).join(', ')}` : ''}`,
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

    async function handleImportStores() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv';
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file || !session?.accessToken) return;
            try {
                setLoading('stores');
                const text = await file.text();
                const response = await fetch(`${API_BASE_URL}/api/settings/data/import-stores`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${session.accessToken}`
                    },
                    body: JSON.stringify({ csv_data: text })
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.detail || "インポートに失敗しました");
                setAlertModal({ message: result.message, type: "success" });
            } catch (err) {
                setAlertModal({ message: err instanceof Error ? err.message : "インポートに失敗しました", type: "error" });
            } finally {
                setLoading(null);
            }
        };
        input.click();
    }

    async function handleImportMappings() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv';
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file || !session?.accessToken) return;
            try {
                setLoading('mappings');
                const text = await file.text();
                const response = await fetch(`${API_BASE_URL}/api/settings/data/import-mappings`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${session.accessToken}`
                    },
                    body: JSON.stringify({ csv_data: text })
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.detail || "インポートに失敗しました");
                setAlertModal({ message: result.message, type: "success" });
            } catch (err) {
                setAlertModal({ message: err instanceof Error ? err.message : "インポートに失敗しました", type: "error" });
            } finally {
                setLoading(null);
            }
        };
        input.click();
    }

    async function handleExportStores() {
        try {
            setLoading('export-stores');
            await settingsApi.exportStores();
            setAlertModal({ message: "店舗データのエクスポートが完了しました", type: "success" });
        } catch (err) {
            setAlertModal({ message: err instanceof Error ? err.message : "エクスポートに失敗しました", type: "error" });
        } finally {
            setLoading(null);
        }
    }

    async function handleExportOrders() {
        try {
            setLoading('export-orders');
            await settingsApi.exportOrders();
            setAlertModal({ message: "注文データのエクスポートが完了しました", type: "success" });
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
                headers: {
                    Authorization: `Bearer ${session.accessToken}`
                }
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.detail || "削除に失敗しました");
            setAlertModal({ message: "全データを削除しました", type: "success" });
        } catch (err) {
            setAlertModal({ message: err instanceof Error ? err.message : "削除に失敗しました", type: "error" });
        } finally {
            setLoading(null);
            setConfirmClear(false);
        }
    }

    return (
        <MainLayout title="データ管理" subtitle="データのインポート・エクスポート・管理">
            <div className="space-y-6">
                {/* Import Section */}
                <div className="rounded-xl border border-border bg-card p-6 card-shadow">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 rounded-lg bg-primary/10">
                            <Upload className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-foreground">データインポート</h2>
                            <p className="text-sm text-muted-foreground">CSVファイルからデータを取り込みます</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Purchase List Import */}
                        <div className="p-4 rounded-lg border border-border bg-muted/20 space-y-3">
                            <div className="flex items-center gap-2">
                                <FileSpreadsheet className="h-5 w-5 text-primary" />
                                <h3 className="font-medium text-foreground">購入リストCSV</h3>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                商品・店舗・マッピング情報を含む購入リストをインポートします
                            </p>
                            <Button
                                variant="default"
                                className="w-full gap-2"
                                onClick={handleImportPurchaseList}
                                disabled={loading !== null}
                            >
                                {loading === 'purchase-list' ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        インポート中...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="h-4 w-4" />
                                        インポート
                                    </>
                                )}
                            </Button>
                        </div>

                        {/* Stores Import */}
                        <div className="p-4 rounded-lg border border-border bg-muted/20 space-y-3">
                            <div className="flex items-center gap-2">
                                <Store className="h-5 w-5 text-blue-500" />
                                <h3 className="font-medium text-foreground">店舗CSV</h3>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                店舗マスタデータをインポートします
                            </p>
                            <Button
                                variant="outline"
                                className="w-full gap-2"
                                onClick={handleImportStores}
                                disabled={loading !== null}
                            >
                                {loading === 'stores' ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        インポート中...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="h-4 w-4" />
                                        インポート
                                    </>
                                )}
                            </Button>
                        </div>

                        {/* Mappings Import */}
                        <div className="p-4 rounded-lg border border-border bg-muted/20 space-y-3">
                            <div className="flex items-center gap-2">
                                <Package className="h-5 w-5 text-green-500" />
                                <h3 className="font-medium text-foreground">商品-店舗マッピング</h3>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                商品と店舗の在庫情報をインポートします
                            </p>
                            <Button
                                variant="outline"
                                className="w-full gap-2"
                                onClick={handleImportMappings}
                                disabled={loading !== null}
                            >
                                {loading === 'mappings' ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        インポート中...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="h-4 w-4" />
                                        インポート
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Export Section */}
                <div className="rounded-xl border border-border bg-card p-6 card-shadow">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 rounded-lg bg-blue-500/10">
                            <Download className="h-5 w-5 text-blue-500" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-foreground">データエクスポート</h2>
                            <p className="text-sm text-muted-foreground">データをCSVファイルでダウンロードします</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Button
                            variant="outline"
                            className="gap-2 justify-start h-auto py-3"
                            onClick={handleExportStores}
                            disabled={loading !== null}
                        >
                            {loading === 'export-stores' ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Store className="h-4 w-4" />
                            )}
                            <div className="text-left">
                                <p className="font-medium">店舗データ</p>
                                <p className="text-xs text-muted-foreground">店舗マスタをエクスポート</p>
                            </div>
                        </Button>

                        <Button
                            variant="outline"
                            className="gap-2 justify-start h-auto py-3"
                            onClick={handleExportOrders}
                            disabled={loading !== null}
                        >
                            {loading === 'export-orders' ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <FileSpreadsheet className="h-4 w-4" />
                            )}
                            <div className="text-left">
                                <p className="font-medium">注文データ</p>
                                <p className="text-xs text-muted-foreground">注文一覧をエクスポート</p>
                            </div>
                        </Button>
                    </div>
                </div>

                {/* Danger Zone */}
                <div className="rounded-xl border border-destructive/30 bg-card p-6 card-shadow">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 rounded-lg bg-destructive/10">
                            <Trash2 className="h-5 w-5 text-destructive" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-foreground">データ削除</h2>
                            <p className="text-sm text-muted-foreground">全データを削除してテスト環境をリセットします</p>
                        </div>
                    </div>

                    <div className="p-4 rounded-lg border border-destructive/20 bg-destructive/5">
                        <p className="text-sm text-muted-foreground mb-4">
                            注文、商品、店舗、マッピング、ルートなど全てのデータが削除されます。この操作は取り消せません。
                        </p>
                        <Button
                            variant="destructive"
                            className="gap-2"
                            onClick={() => setConfirmClear(true)}
                            disabled={loading !== null}
                        >
                            {loading === 'clear' ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    削除中...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="h-4 w-4" />
                                    全データを削除
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Confirm Clear Modal */}
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

            {/* Alert Modal */}
            <AlertModal
                isOpen={alertModal !== null}
                onClose={() => setAlertModal(null)}
                message={alertModal?.message || ""}
                type={alertModal?.type || "info"}
            />
        </MainLayout>
    );
}
