"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Search, MapPin, Clock, Star, Plus, Loader2, Edit, Upload, Download, Trash2 } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { storesApi } from "@/lib/api";
import { CreateStoreModal } from "@/components/modals/CreateStoreModal";
import { AlertModal } from "@/components/modals/AlertModal";
import type { StoreWithOrders, Store } from "@/lib/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const categoryColors: Record<string, string> = {
    家電: "bg-blue-500/20 text-blue-400",
    "食品・飲料": "bg-green-500/20 text-green-400",
    生活雑貨: "bg-purple-500/20 text-purple-400",
    ファッション: "bg-pink-500/20 text-pink-400",
    文房具: "bg-amber-500/20 text-amber-400",
};

export default function StoresPage() {
    const { data: session } = useSession();
    const [stores, setStores] = useState<StoreWithOrders[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editStore, setEditStore] = useState<Store | null>(null);
    const [alertModal, setAlertModal] = useState<{ message: string; type: "success" | "error" } | null>(null);
    const [deleteStore, setDeleteStore] = useState<Store | null>(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        fetchData();
    }, [categoryFilter]);

    async function fetchData() {
        try {
            setLoading(true);
            setError(null);
            const [storesData, categoriesData] = await Promise.all([
                storesApi.getAll({
                    category: categoryFilter !== "all" ? categoryFilter : undefined,
                    search: searchTerm || undefined,
                }),
                storesApi.getCategories().catch(() => ({ categories: [] })),
            ]);
            setStores(storesData);
            setCategories(categoriesData.categories);
        } catch (err) {
            setError(err instanceof Error ? err.message : "店舗の取得に失敗しました");
        } finally {
            setLoading(false);
        }
    }

    function handleSearch(e: React.FormEvent) {
        e.preventDefault();
        fetchData();
    }

    async function handleDelete() {
        if (!deleteStore) return;
        try {
            setDeleting(true);
            await storesApi.delete(deleteStore.store_id);
            setAlertModal({ message: "店舗を削除しました", type: "success" });
            setDeleteStore(null);
            await fetchData();
        } catch (err) {
            setAlertModal({ message: err instanceof Error ? err.message : "削除に失敗しました", type: "error" });
        } finally {
            setDeleting(false);
        }
    }

    const filteredStores = stores.filter((store) => {
        if (!searchTerm) return true;
        return (
            store.store_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            store.district?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    });

    const activeStores = stores.filter((s) => s.is_active).length;
    const storesWithOrders = stores.filter((s) => s.orders_today > 0).length;
    const totalOrders = stores.reduce((acc, s) => acc + s.orders_today, 0);

    return (
        <MainLayout title="店舗一覧" subtitle={`登録店舗 ${stores.length}店舗`}>
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
                <div className="rounded-xl border border-border bg-card p-4 card-shadow">
                    <p className="text-sm text-muted-foreground">店舗総数</p>
                    <p className="text-2xl font-bold text-foreground">{stores.length}</p>
                </div>
                <div className="rounded-xl border border-success/20 bg-success/10 p-4">
                    <p className="text-sm text-muted-foreground">有効</p>
                    <p className="text-2xl font-bold text-success">{activeStores}</p>
                </div>
                <div className="rounded-xl border border-primary/20 bg-primary/10 p-4">
                    <p className="text-sm text-muted-foreground">本日訪問予定</p>
                    <p className="text-2xl font-bold text-primary">{storesWithOrders}</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 card-shadow">
                    <p className="text-sm text-muted-foreground">総注文数</p>
                    <p className="text-2xl font-bold text-foreground">{totalOrders}</p>
                </div>
            </div>

            {/* Import/Export Buttons */}
            <div className="mb-6 flex gap-3">
                <Button
                    onClick={async () => {
                        if (!session?.accessToken) return;
                        try {
                            const response = await fetch(`${API_BASE_URL}/api/settings/data/export-stores`, {
                                headers: { Authorization: `Bearer ${session.accessToken}` }
                            });
                            const blob = await response.blob();
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `stores_${new Date().toISOString().split('T')[0]}.csv`;
                            document.body.appendChild(a);
                            a.click();
                            window.URL.revokeObjectURL(url);
                            document.body.removeChild(a);
                            setAlertModal({ message: "CSVをエクスポートしました", type: "success" });
                        } catch (err) {
                            setAlertModal({ message: err instanceof Error ? err.message : "エラーが発生しました", type: "error" });
                        }
                    }}
                    variant="outline"
                    className="gap-2"
                >
                    <Download className="h-4 w-4" />
                    CSVエクスポート
                </Button>
                <Button
                    onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = '.csv';
                        input.onchange = async (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (!file || !session?.accessToken) return;
                            try {
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
                                await fetchData();
                            } catch (err) {
                                setAlertModal({ message: err instanceof Error ? err.message : "エラーが発生しました", type: "error" });
                            }
                        };
                        input.click();
                    }}
                    variant="outline"
                    className="gap-2"
                >
                    <Upload className="h-4 w-4" />
                    CSVインポート
                </Button>
            </div>

            {/* Toolbar */}
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="店舗名またはエリアで検索..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full h-10 rounded-lg border border-border bg-secondary pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background transition-all"
                    />
                </div>
                <div className="flex gap-3">
                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="h-10 rounded-lg border border-border bg-secondary px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                        <option value="all">全カテゴリ</option>
                        {categories.map((cat) => (
                            <option key={cat} value={cat}>
                                {cat}
                            </option>
                        ))}
                    </select>
                    {/* <Button variant="outline" className="gap-2" type="button">
                        <Filter className="h-4 w-4" />
                        詳細フィルター
                    </Button> */}
                    <Button className="gap-2" type="button" onClick={() => setShowCreateModal(true)}>
                        <Plus className="h-4 w-4" />
                        店舗追加
                    </Button>
                </div>
            </form>

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : error ? (
                <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                        <p className="text-destructive mb-2">{error}</p>
                        <button onClick={fetchData} className="text-primary hover:underline">
                            再試行
                        </button>
                    </div>
                </div>
            ) : filteredStores.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                    店舗が見つかりません
                </div>
            ) : (
                /* Store Grid */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredStores.map((store, index) => (
                        <div
                            key={store.store_id}
                            className="rounded-xl border border-border bg-card p-4 card-shadow hover:elevated-shadow transition-all duration-200 animate-slide-up flex flex-col"
                            style={{ animationDelay: `${index * 30}ms` }}
                        >
                            {/* Header */}
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-foreground truncate">{store.store_name}</p>
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                                        <MapPin className="h-3 w-3" />
                                        <span className="truncate">{store.district || "—"}</span>
                                    </div>
                                </div>
                                <Badge
                                    className={cn(
                                        "shrink-0 ml-2",
                                        store.is_active
                                            ? "bg-success/20 text-success"
                                            : "bg-destructive/20 text-destructive"
                                    )}
                                >
                                    {store.is_active ? "有効" : "無効"}
                                </Badge>
                            </div>

                            {/* Category */}
                            {store.category && (
                                <Badge className={cn("mb-3", categoryColors[store.category] || "bg-secondary")}>
                                    {store.category}
                                </Badge>
                            )}

                            {/* Details */}
                            <div className="space-y-2 mb-4 text-sm flex-1">
                                {store.address && (
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                                        <span className="truncate">{store.address}</span>
                                    </div>
                                )}
                                {store.opening_hours && (
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <Clock className="h-3.5 w-3.5" />
                                        <span>{store.opening_hours.weekday || "—"}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Star className="h-3.5 w-3.5" />
                                    <span>優先度: {store.priority_level}</span>
                                </div>
                            </div>

                            {/* Orders Badge */}
                            {store.orders_today > 0 && (
                                <div className="flex items-center justify-between p-2 rounded-lg bg-primary/10 border border-primary/20 mb-3">
                                    <span className="text-sm text-primary font-medium">
                                        本日 {store.orders_today}件の注文
                                    </span>
                                    <Button variant="ghost" size="sm" className="h-7 text-primary hover:text-primary">
                                        表示
                                    </Button>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex gap-2 mt-auto">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 gap-2"
                                    onClick={() => {
                                        setEditStore(store);
                                        setShowCreateModal(true);
                                    }}
                                >
                                    <Edit className="h-3.5 w-3.5" />
                                    編集
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => setDeleteStore(store)}
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create/Edit Store Modal */}
            <CreateStoreModal
                isOpen={showCreateModal}
                onClose={() => {
                    setShowCreateModal(false);
                    setEditStore(null);
                }}
                onSuccess={fetchData}
                editStore={editStore}
            />

            {/* Alert Modal */}
            <AlertModal
                isOpen={alertModal !== null}
                onClose={() => setAlertModal(null)}
                message={alertModal?.message || ""}
                type={alertModal?.type || "error"}
            />

            {/* Delete Confirmation Modal */}
            {deleteStore && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => setDeleteStore(null)}
                    />
                    <div className="relative z-10 w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl">
                        <h3 className="text-lg font-semibold text-foreground mb-2">店舗を削除</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            「{deleteStore.store_name}」を削除してもよろしいですか？この操作は取り消せません。
                        </p>
                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={() => setDeleteStore(null)}
                                disabled={deleting}
                            >
                                キャンセル
                            </Button>
                            <Button
                                variant="destructive"
                                className="flex-1"
                                onClick={handleDelete}
                                disabled={deleting}
                            >
                                {deleting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        削除中...
                                    </>
                                ) : (
                                    "削除"
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </MainLayout>
    );
}
