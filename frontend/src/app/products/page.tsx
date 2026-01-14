"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Package, Store, Filter, Loader2 } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
                alert("店舗が登録されていません");
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
            alert(err instanceof Error ? err.message : "エラーが発生しました");
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
            alert(err instanceof Error ? err.message : "エラーが発生しました");
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
            <div className="rounded-xl border border-border bg-card card-shadow overflow-hidden">
                {/* Mobile card layout */}
                <div className="md:hidden divide-y divide-border">
                    {products.map((product) => (
                        <div key={product.product_id} className="p-4 space-y-3">
                            <div>
                                <span className="font-mono text-xs text-muted-foreground block mb-1">{product.sku}</span>
                                <p className="text-sm font-medium">{product.product_name}</p>
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
                                        className="h-5 w-5 touch-target"
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
                                        className="h-5 w-5 touch-target"
                                    />
                                </label>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Desktop table layout */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-border bg-muted/30">
                                <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                                    SKU
                                </th>
                                <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                                    商品名
                                </th>
                                <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                                    店舗固定
                                </th>
                                <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                                    固定店舗
                                </th>
                                <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                                    ルーティング除外
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {products.map((product) => (
                                <tr key={product.product_id} className="hover:bg-muted/20">
                                    <td className="px-4 lg:px-6 py-4">
                                        <span className="font-mono text-sm">{product.sku}</span>
                                    </td>
                                    <td className="px-4 lg:px-6 py-4">
                                        <p className="text-sm font-medium">{product.product_name}</p>
                                        {product.is_set_product && (
                                            <Badge className="mt-1 bg-purple-500/20 text-purple-400">
                                                セット商品
                                            </Badge>
                                        )}
                                    </td>
                                    <td className="px-4 lg:px-6 py-4">
                                        <input
                                            type="checkbox"
                                            checked={product.is_store_fixed}
                                            onChange={(e) => toggleStoreFixed(
                                                product.product_id,
                                                e.target.checked,
                                                product.fixed_store_id
                                            )}
                                            className="h-4 w-4"
                                        />
                                    </td>
                                    <td className="px-4 lg:px-6 py-4">
                                        {product.is_store_fixed ? (
                                            <select
                                                value={product.fixed_store_id || ""}
                                                onChange={(e) => toggleStoreFixed(
                                                    product.product_id,
                                                    true,
                                                    Number(e.target.value)
                                                )}
                                                className="rounded border border-border bg-secondary px-2 py-1 text-sm"
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
                                    <td className="px-4 lg:px-6 py-4">
                                        <input
                                            type="checkbox"
                                            checked={product.exclude_from_routing}
                                            onChange={(e) => toggleRouting(
                                                product.product_id,
                                                e.target.checked
                                            )}
                                            className="h-4 w-4"
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </MainLayout>
    );
}
