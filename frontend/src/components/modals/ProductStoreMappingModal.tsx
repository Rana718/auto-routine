"use client";

import { useState, useEffect } from "react";
import { Loader2, Trash2, Plus, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal, FormField, Input, Select } from "@/components/ui/modal";
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

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="店舗マッピング"
            className="max-w-xl max-h-[90vh]"
        >
            <div className="space-y-3">
                <p className="text-sm text-muted-foreground wrap-break-word">{productName}</p>

                {error && (
                    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}
                {success && (
                    <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 text-primary text-sm">
                        {success}
                    </div>
                )}

                <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-3">
                    <h3 className="text-base font-semibold flex items-center gap-2 text-foreground">
                        <Plus className="h-4 w-4" />
                        新規店舗を追加
                    </h3>

                    <FormField label="店舗を選択">
                        {availableStores.length > 0 ? (
                            <Select
                                value={selectedStore || ""}
                                onChange={(e) => setSelectedStore(e.target.value ? parseInt(e.target.value, 10) : null)}
                            >
                                <option value="">-- 店舗を選択 --</option>
                                {availableStores.map((store) => (
                                    <option key={store.store_id} value={store.store_id}>
                                        {store.store_name}
                                    </option>
                                ))}
                            </Select>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                {stores.length === 0
                                    ? "利用可能な店舗がありません"
                                    : "全ての店舗が既に追加されています"}
                            </p>
                        )}
                    </FormField>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <FormField label="優先度">
                            <Input
                                type="number"
                                min="1"
                                max="10"
                                value={priority}
                                onChange={(e) => setPriority(parseInt(e.target.value, 10) || 1)}
                            />
                        </FormField>

                        <FormField label="最大数量（日）">
                            <Input
                                type="number"
                                min="0"
                                value={maxDaily}
                                onChange={(e) => setMaxDaily(e.target.value)}
                                placeholder="制限なし"
                            />
                        </FormField>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
                        <input
                            type="checkbox"
                            checked={isPrimary}
                            onChange={(e) => setIsPrimary(e.target.checked)}
                            className="h-4 w-4"
                        />
                        プライマリ店舗として設定
                    </label>

                    <Button
                        onClick={handleAddMapping}
                        disabled={!selectedStore || loading}
                        className="w-full"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                追加中...
                            </>
                        ) : (
                            "店舗を追加"
                        )}
                    </Button>
                </div>

                <div>
                    <h3 className="text-base font-semibold mb-2 text-foreground">割り当て済み店舗（{mappings.length}）</h3>
                    {mappings.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-5 border border-dashed border-border rounded-lg">
                            まだ店舗が割り当てられていません
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {mappings.map((mapping) => (
                                <div
                                    key={mapping.mapping_id}
                                    className="p-2.5 rounded-lg border border-border bg-secondary/40"
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-medium text-foreground">{mapping.store_name}</span>
                                                {mapping.is_primary_store && (
                                                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-primary/20 text-primary">
                                                        プライマリ
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                優先度: {mapping.priority}
                                                {mapping.max_daily_quantity ? ` / 最大: ${mapping.max_daily_quantity}` : ""}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleUpdatePrimary(mapping.store_id, mapping.is_primary_store)}
                                                disabled={loading}
                                                className={cn(
                                                    "px-3 py-1 rounded-md text-xs font-medium border transition",
                                                    mapping.is_primary_store
                                                        ? "bg-primary/20 text-primary border-primary/30"
                                                        : "bg-secondary text-foreground border-border hover:bg-secondary/70"
                                                )}
                                            >
                                                {mapping.is_primary_store ? "プライマリ" : "セカンダリ"}
                                            </button>
                                            <button
                                                onClick={() => handleDeleteMapping(mapping.store_id)}
                                                disabled={loading}
                                                className="p-2 rounded-md border border-destructive/30 text-destructive hover:bg-destructive/10 transition"
                                                aria-label="マッピング削除"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex justify-end pt-2">
                    <Button onClick={onClose} variant="outline">
                        閉じる
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
