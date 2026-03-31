"use client";

import { useState, useEffect } from "react";
import { Loader2, Trash2, Plus, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Store {
    store_id: number;
    store_name: string;
}

interface StoreMapping {
    mapping_id: number;
    product_id: number;
    store_id: number;
    store_name: string;
    is_primary_store: boolean;
    priority: number;
    stock_status: string;
    max_daily_quantity?: number;
    current_available?: number;
}

interface ProductStoreMappingModalProps {
    isOpen: boolean;
    onClose: () => void;
    productId: number;
    productName: string;
    accessToken: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function ProductStoreMappingModal({
    isOpen,
    onClose,
    productId,
    productName,
    accessToken,
}: ProductStoreMappingModalProps) {
    const [stores, setStores] = useState<Store[]>([]);
    const [mappings, setMappings] = useState<StoreMapping[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedStore, setSelectedStore] = useState<number | null>(null);
    const [priority, setPriority] = useState(1);
    const [maxDaily, setMaxDaily] = useState<string>("");
    const [isPrimary, setIsPrimary] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchData();
        }
    }, [isOpen]);

    async function fetchData() {
        try {
            setLoading(true);
            setError(null);

            // Fetch available stores
            const storesRes = await fetch(`${API_BASE_URL}/api/stores`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (!storesRes.ok) throw new Error("店舗の取得に失敗しました");
            const storesData = await storesRes.json();
            setStores(Array.isArray(storesData) ? storesData : []);

            // Fetch current mappings
            const mappingsRes = await fetch(`${API_BASE_URL}/api/products/${productId}/stores`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (!mappingsRes.ok) throw new Error("マッピングの取得に失敗しました");
            const mappingsData = await mappingsRes.json();
            setMappings(Array.isArray(mappingsData) ? mappingsData : []);
        } catch (err) {
            setError(err instanceof Error ? err.message : "エラーが発生しました");
        } finally {
            setLoading(false);
        }
    }

    async function handleAddMapping() {
        if (!selectedStore) {
            setError("店舗を選択してください");
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const res = await fetch(`${API_BASE_URL}/api/products/${productId}/stores`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    store_id: selectedStore,
                    priority: priority,
                    is_primary_store: isPrimary,
                    max_daily_quantity: maxDaily ? parseInt(maxDaily) : null,
                }),
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.detail || "マッピングの追加に失敗しました");
            }

            setSuccess("店舗を追加しました");
            setSelectedStore(null);
            setPriority(1);
            setMaxDaily("");
            setIsPrimary(false);
            await fetchData();

            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : "エラーが発生しました");
        } finally {
            setLoading(false);
        }
    }

    async function handleDeleteMapping(storeId: number) {
        if (!confirm("この店舗を削除してもよろしいですか？")) return;

        try {
            setLoading(true);
            const res = await fetch(`${API_BASE_URL}/api/products/${productId}/stores/${storeId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${accessToken}` },
            });

            if (!res.ok) throw new Error("削除に失敗しました");

            setSuccess("店舗を削除しました");
            await fetchData();
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : "エラーが発生しました");
        } finally {
            setLoading(false);
        }
    }

    async function handleUpdatePrimary(storeId: number, wasPrimary: boolean) {
        try {
            setLoading(true);
            const res = await fetch(`${API_BASE_URL}/api/products/${productId}/stores/${storeId}`, {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    is_primary_store: !wasPrimary,
                }),
            });

            if (!res.ok) throw new Error("更新に失敗しました");

            setSuccess("更新しました");
            await fetchData();
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : "エラーが発生しました");
        } finally {
            setLoading(false);
        }
    }

    const mappedStoreIds = mappings.map((m) => m.store_id);
    const availableStores = stores.filter((s) => !mappedStoreIds.includes(s.store_id));

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold">店舗マッピング</h2>
                        <p className="text-sm text-gray-600 mt-1">{productName}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
                    >
                        ×
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded p-3 flex items-start gap-2 text-red-800">
                            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                            <span className="text-sm">{error}</span>
                        </div>
                    )}
                    {success && (
                        <div className="bg-green-50 border border-green-200 rounded p-3 text-green-800 text-sm">
                            {success}
                        </div>
                    )}

                    {/* Add New Mapping Section */}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold mb-4 flex items-center gap-2">
                            <Plus className="w-4 h-4" />
                            新規店舗を追加
                        </h3>

                        <div className="space-y-3">
                            {/* Store Select */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    店舗を選択
                                </label>
                                {availableStores.length > 0 ? (
                                    <select
                                        value={selectedStore || ""}
                                        onChange={(e) => setSelectedStore(e.target.value ? parseInt(e.target.value) : null)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">-- 店舗を選択 --</option>
                                        {availableStores.map((store) => (
                                            <option key={store.store_id} value={store.store_id}>
                                                {store.store_name}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <p className="text-sm text-gray-500">
                                        {stores.length === 0
                                            ? "利用可能な店舗がありません"
                                            : "全ての店舗が既に追加されています"}
                                    </p>
                                )}
                            </div>

                            {/* Priority */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        優先度
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="10"
                                        value={priority}
                                        onChange={(e) => setPriority(parseInt(e.target.value) || 1)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                {/* Max Daily Quantity */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        最大数量（日）
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={maxDaily}
                                        onChange={(e) => setMaxDaily(e.target.value)}
                                        placeholder="制限なし"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            {/* Primary Store Checkbox */}
                            <div>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={isPrimary}
                                        onChange={(e) => setIsPrimary(e.target.checked)}
                                        className="w-4 h-4"
                                    />
                                    <span className="text-sm font-medium text-gray-700">
                                        プライマリ店舗として設定
                                    </span>
                                </label>
                            </div>

                            {/* Add Button */}
                            <Button
                                onClick={handleAddMapping}
                                disabled={!selectedStore || loading}
                                className="w-full"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        追加中...
                                    </>
                                ) : (
                                    "店舗を追加"
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* Current Mappings List */}
                    <div>
                        <h3 className="font-semibold mb-3">割り当て済み店舗（{mappings.length}）</h3>
                        {mappings.length === 0 ? (
                            <p className="text-gray-500 text-sm text-center py-4">
                                まだ店舗が割り当てられていません
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {mappings.map((mapping) => (
                                    <div
                                        key={mapping.mapping_id}
                                        className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 transition"
                                    >
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">{mapping.store_name}</span>
                                                {mapping.is_primary_store && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                        プライマリ
                                                    </span>
                                                )}
                                                <span className="text-xs text-gray-500">
                                                    優先度: {mapping.priority}
                                                </span>
                                                {mapping.max_daily_quantity && (
                                                    <span className="text-xs text-gray-500">
                                                        最大: {mapping.max_daily_quantity}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() =>
                                                    handleUpdatePrimary(
                                                        mapping.store_id,
                                                        mapping.is_primary_store
                                                    )
                                                }
                                                disabled={loading}
                                                className={cn(
                                                    "px-3 py-1 rounded text-sm font-medium transition",
                                                    mapping.is_primary_store
                                                        ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                                                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                                                )}
                                            >
                                                {mapping.is_primary_store ? "プライマリ" : "セカンダリ"}
                                            </button>
                                            <button
                                                onClick={() => handleDeleteMapping(mapping.store_id)}
                                                disabled={loading}
                                                className="text-red-600 hover:text-red-800 p-1 hover:bg-red-50 rounded transition"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-4 flex justify-end gap-2">
                    <Button onClick={onClose} variant="outline">
                        閉じる
                    </Button>
                </div>
            </div>
        </div>
    );
}
