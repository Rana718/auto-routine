"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Store, Loader2, Upload } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AlertModal } from "@/components/modals/AlertModal";
import { ExportButton } from "@/components/ui/ExportButton";
import { readFileAsCSVText } from "@/lib/excel";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Product {
    product_id: number;
    sku: string;
    product_name: string;
    category: string;
    is_store_fixed: boolean;
    fixed_store_id: number | null;
    exclude_from_routing: boolean;
    is_set_product: boolean;
}

interface Store {
    store_id: number;
    store_name: string;
}

export default function ProductsPage() {
    const { data: session } = useSession();
    const [products, setProducts] = useState<Product[]>([]);
    const [stores, setStores] = useState<Store[]>([]);
    const [loading, setLoading] = useState(true);
    const [alertModal, setAlertModal] = useState<{ message: string; type: "success" | "error" } | null>(null);

    useEffect(() => {
        if (session?.accessToken) {
            fetchData();
        }
    }, [session]);

    async function fetchData() {
        if (!session?.accessToken) return;

        try {
            setLoading(true);
            const [productsRes, storesRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/products`, {
                    headers: { Authorization: `Bearer ${session.accessToken}` }
                }),
                fetch(`${API_BASE_URL}/api/stores`, {
                    headers: { Authorization: `Bearer ${session.accessToken}` }
                })
            ]);

            const productsData = await productsRes.json();
            const storesData = await storesRes.json();

            setProducts(Array.isArray(productsData) ? productsData : []);
            setStores(Array.isArray(storesData) ? storesData : []);
        } catch (err) {
            console.error(err);
            setProducts([]);
            setStores([]);
        } finally {
            setLoading(false);
        }
    }

    async function toggleStoreFixed(productId: number, isFixed: boolean, storeId: number | null) {
        if (!session?.accessToken) return;

        // If enabling store-fixed but no store selected, auto-select first store
        if (isFixed && !storeId) {
            if (stores.length === 0) {
                setAlertModal({ message: "店舗が登録されていません", type: "error" });
                await fetchData();
                return;
            }
            // Auto-select first store
            storeId = stores[0].store_id;
        }

        try {
            const url = isFixed
                ? `${API_BASE_URL}/api/products/${productId}/store-fixed?is_fixed=true&store_id=${storeId}`
                : `${API_BASE_URL}/api/products/${productId}/store-fixed?is_fixed=false`;

            const response = await fetch(url, {
                method: "PATCH",
                headers: { Authorization: `Bearer ${session.accessToken}` }
            });
            if (!response.ok) throw new Error("更新に失敗しました");
            await fetchData();
        } catch (err) {
           setAlertModal({ message: err instanceof Error ? err.message : "エラーが発生しました", type: "error" }); 
        }
    }

    async function toggleRouting(productId: number, exclude: boolean) {
        if (!session?.accessToken) return;

        try {
            const response = await fetch(
                `${API_BASE_URL}/api/products/${productId}/routing?exclude=${exclude}`,
                {
                    method: "PATCH",
                    headers: { Authorization: `Bearer ${session.accessToken}` }
                }
            );
            if (!response.ok) throw new Error("更新に失敗しました");
            await fetchData();
        } catch (err) {
            setAlertModal({ message: err instanceof Error ? err.message : "エラーが発生しました", type: "error" });
        }
    }

    if (loading) {
        return (
            <MainLayout title="商品設定" subtitle="商品の店舗固定とルーティング設定">
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout title="商品設定" subtitle="商品の店舗固定とルーティング設定">
            {/* Import/Export Buttons */}
            <div className="mb-6 flex gap-3">
                <ExportButton
                    fetchCsv={() => fetch(`${API_BASE_URL}/api/products/export`, {
                        headers: { Authorization: `Bearer ${session?.accessToken}` }
                    })}
                    filenameBase={`products_${new Date().toISOString().split('T')[0]}`}
                    onError={(msg) => setAlertModal({ message: msg, type: "error" })}
                />
                <Button
                    onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = '.csv,.xlsx,.xls';
                        input.onchange = async (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (!file || !session?.accessToken) return;
                            try {
                                const text = await readFileAsCSVText(file);
                                const response = await fetch(`${API_BASE_URL}/api/products/import`, {
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
                    インポート
                </Button>
            </div>

            <div className="rounded-xl border border-border bg-card card-shadow overflow-hidden">
                {/* Mobile card layout */}
                <div className="md:hidden divide-y divide-border">
                    {products.map((product) => (
                        <div key={product.product_id} className="p-4 space-y-3">
                            <div>
                                <span className="font-mono text-xs text-muted-foreground block mb-1">{product.sku}</span>
                                <p className="text-sm font-medium truncate">{product.product_name}</p>
                                {product.is_set_product && (
                                    <Badge className="mt-1 bg-purple-500/20 text-purple-400 text-xs">
                                        セット商品
                                    </Badge>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">店舗固定</span>
                                    <input
                                        type="checkbox"
                                        checked={product.is_store_fixed}
                                        onChange={(e) => toggleStoreFixed(
                                            product.product_id,
                                            e.target.checked,
                                            product.fixed_store_id
                                        )}
                                        className="h-4 w-4 cursor-pointer"
                                    />
                                </label>

                                {product.is_store_fixed && (
                                    <div>
                                        <label className="block text-xs text-muted-foreground mb-1">固定店舗</label>
                                        <select
                                            value={product.fixed_store_id || ""}
                                            onChange={(e) => toggleStoreFixed(
                                                product.product_id,
                                                true,
                                                Number(e.target.value)
                                            )}
                                            className="w-full rounded border border-border bg-secondary px-3 py-2 text-sm"
                                        >
                                            <option value="">選択...</option>
                                            {stores.map((store) => (
                                                <option key={store.store_id} value={store.store_id}>
                                                    {store.store_name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <label className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">ルーティング除外</span>
                                    <input
                                        type="checkbox"
                                        checked={product.exclude_from_routing}
                                        onChange={(e) => toggleRouting(
                                            product.product_id,
                                            e.target.checked
                                        )}
                                        className="h-4 w-4 cursor-pointer"
                                    />
                                </label>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Desktop table layout */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full table-fixed">
                        <thead>
                            <tr className="border-b border-border bg-muted/30">
                                <th className="px-3 lg:px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground w-35 lg:w-45">
                                    SKU
                                </th>
                                <th className="px-3 lg:px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                                    商品名
                                </th>
                                <th className="px-3 lg:px-4 py-3 text-center text-xs font-medium uppercase text-muted-foreground w-20">
                                    店舗固定
                                </th>
                                <th className="px-3 lg:px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground w-37.5 lg:w-45">
                                    固定店舗
                                </th>
                                <th className="px-3 lg:px-4 py-3 text-center text-xs font-medium uppercase text-muted-foreground w-25">
                                    除外
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {products.map((product) => (
                                <tr key={product.product_id} className="hover:bg-muted/20">
                                    <td className="px-3 lg:px-4 py-3">
                                        <span className="font-mono text-xs lg:text-sm truncate block" title={product.sku}>
                                            {product.sku}
                                        </span>
                                    </td>
                                    <td className="px-3 lg:px-4 py-3">
                                        <p className="text-sm font-medium truncate" title={product.product_name}>
                                            {product.product_name}
                                        </p>
                                        {product.is_set_product && (
                                            <Badge className="mt-1 bg-purple-500/20 text-purple-400 text-xs">
                                                セット
                                            </Badge>
                                        )}
                                    </td>
                                    <td className="px-3 lg:px-4 py-3 text-center">
                                        <input
                                            type="checkbox"
                                            checked={product.is_store_fixed}
                                            onChange={(e) => toggleStoreFixed(
                                                product.product_id,
                                                e.target.checked,
                                                product.fixed_store_id
                                            )}
                                            className="h-4 w-4 cursor-pointer"
                                        />
                                    </td>
                                    <td className="px-3 lg:px-4 py-3">
                                        {product.is_store_fixed ? (
                                            <select
                                                value={product.fixed_store_id || ""}
                                                onChange={(e) => toggleStoreFixed(
                                                    product.product_id,
                                                    true,
                                                    Number(e.target.value)
                                                )}
                                                className="w-full rounded border border-border bg-secondary px-2 py-1 text-xs lg:text-sm truncate"
                                            >
                                                <option value="">選択...</option>
                                                {stores.map((store) => (
                                                    <option key={store.store_id} value={store.store_id}>
                                                        {store.store_name}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <span className="text-muted-foreground text-sm">—</span>
                                        )}
                                    </td>
                                    <td className="px-3 lg:px-4 py-3 text-center">
                                        <input
                                            type="checkbox"
                                            checked={product.exclude_from_routing}
                                            onChange={(e) => toggleRouting(
                                                product.product_id,
                                                e.target.checked
                                            )}
                                            className="h-4 w-4 cursor-pointer"
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Alert Modal */}
            <AlertModal
                isOpen={alertModal !== null}
                onClose={() => setAlertModal(null)}
                message={alertModal?.message || ""}
                type={alertModal?.type || "error"}
            />
        </MainLayout>
    );
}
