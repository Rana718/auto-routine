"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Package, Plus, Trash2, Loader2 } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Product {
    product_id: number;
    sku: string;
    product_name: string;
    is_set_product: boolean;
    set_split_rule: any;
}

interface BundleItem {
    sku: string;
    name: string;
    quantity: number;
}

export default function BundlesPage() {
    const { data: session } = useSession();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [creating, setCreating] = useState(false);
    const [editingProductId, setEditingProductId] = useState<number | null>(null);

    // Form state
    const [bundleSku, setBundleSku] = useState("");
    const [bundleName, setBundleName] = useState("");
    const [bundleCategory, setBundleCategory] = useState("家電");
    const [bundleItems, setBundleItems] = useState<BundleItem[]>([
        { sku: "", name: "", quantity: 1 }
    ]);

    useEffect(() => {
        if (session?.accessToken) {
            fetchProducts();
        }
    }, [session]);

    async function fetchProducts() {
        if (!session?.accessToken) return;
        try {
            setLoading(true);
            const response = await fetch(`${API_BASE_URL}/api/products`, {
                headers: { Authorization: `Bearer ${session.accessToken}` }
            });
            const data = await response.json();
            setProducts(Array.isArray(data) ? data.filter((p: Product) => p.is_set_product) : []);
        } catch (err) {
            console.error(err);
            setProducts([]);
        } finally {
            setLoading(false);
        }
    }

    function addBundleItem() {
        setBundleItems([...bundleItems, { sku: "", name: "", quantity: 1 }]);
    }

    function removeBundleItem(index: number) {
        setBundleItems(bundleItems.filter((_, i) => i !== index));
    }

    function updateBundleItem(index: number, field: keyof BundleItem, value: string | number) {
        const updated = [...bundleItems];
        updated[index] = { ...updated[index], [field]: value };
        setBundleItems(updated);
    }

    async function handleCreateBundle() {
        if (!bundleSku || !bundleName || bundleItems.some(item => !item.sku || !item.name)) {
            alert("全ての項目を入力してください");
            return;
        }

        try {
            setCreating(true);

            // Create the bundle product
            const productResponse = await fetch(`${API_BASE_URL}/api/products`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session?.accessToken}`
                },
                body: JSON.stringify({
                    sku: bundleSku,
                    product_name: bundleName,
                    category: bundleCategory
                })
            });

            if (!productResponse.ok) throw new Error("商品作成に失敗しました");

            const product = await productResponse.json();

            // Update product to be a bundle with split rules
            const updateResponse = await fetch(`${API_BASE_URL}/api/products/${product.product_id}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session?.accessToken}`
                },
                body: JSON.stringify({
                    is_set_product: true,
                    set_split_rule: {
                        items: bundleItems.map(item => ({
                            sku: item.sku,
                            name: item.name,
                            qty: item.quantity
                        }))
                    }
                })
            });

            if (!updateResponse.ok) throw new Error("バンドル設定に失敗しました");

            alert("セット商品を作成しました");
            setShowCreateModal(false);
            resetForm();
            await fetchProducts();
        } catch (err) {
            alert(err instanceof Error ? err.message : "エラーが発生しました");
        } finally {
            setCreating(false);
        }
    }

    function resetForm() {
        setBundleSku("");
        setBundleName("");
        setBundleCategory("家電");
        setBundleItems([{ sku: "", name: "", quantity: 1 }]);
        setEditingProductId(null);
    }

    function openEditModal(product: Product) {
        setEditingProductId(product.product_id);
        setBundleSku(product.sku);
        setBundleName(product.product_name);
        // Populate bundle items from set_split_rule
        if (product.set_split_rule?.items) {
            setBundleItems(product.set_split_rule.items.map((item: any) => ({
                sku: item.sku || "",
                name: item.name || "",
                quantity: item.qty || item.quantity || 1
            })));
        }
        setShowEditModal(true);
    }

    async function handleUpdateBundle() {
        if (!editingProductId || !bundleSku || !bundleName || bundleItems.some(item => !item.sku || !item.name)) {
            alert("全ての項目を入力してください");
            return;
        }

        try {
            setCreating(true);

            const updateResponse = await fetch(`${API_BASE_URL}/api/products/${editingProductId}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session?.accessToken}`
                },
                body: JSON.stringify({
                    sku: bundleSku,
                    product_name: bundleName,
                    is_set_product: true,
                    set_split_rule: {
                        items: bundleItems.map(item => ({
                            sku: item.sku,
                            name: item.name,
                            qty: item.quantity
                        }))
                    }
                })
            });

            if (!updateResponse.ok) throw new Error("バンドル更新に失敗しました");

            alert("セット商品を更新しました");
            setShowEditModal(false);
            resetForm();
            await fetchProducts();
        } catch (err) {
            alert(err instanceof Error ? err.message : "エラーが発生しました");
        } finally {
            setCreating(false);
        }
    }

    if (loading) {
        return (
            <MainLayout title="セット商品管理" subtitle="バンドル商品の設定">
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout title="セット商品管理" subtitle="バンドル商品の設定">
            <div className="mb-6">
                <Button className="gap-2" onClick={() => setShowCreateModal(true)}>
                    <Plus className="h-4 w-4" />
                    セット商品を追加
                </Button>
            </div>

            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-lg">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-foreground">セット商品を追加</h2>
                            <button onClick={() => setShowCreateModal(false)} className="text-muted-foreground hover:text-foreground">
                                ✕
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Bundle Info */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-2">
                                        SKU <span className="text-destructive">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={bundleSku}
                                        onChange={(e) => setBundleSku(e.target.value)}
                                        placeholder="BUNDLE-001"
                                        className="w-full h-10 rounded-lg border border-border bg-secondary px-3 text-foreground"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-2">
                                        カテゴリ
                                    </label>
                                    <select
                                        value={bundleCategory}
                                        onChange={(e) => setBundleCategory(e.target.value)}
                                        className="w-full h-10 rounded-lg border border-border bg-secondary px-3 text-foreground"
                                    >
                                        <option value="家電">家電</option>
                                        <option value="食品・飲料">食品・飲料</option>
                                        <option value="ドラッグストア">ドラッグストア</option>
                                        <option value="日用品">日用品</option>
                                        <option value="衣料品">衣料品</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">
                                    商品名 <span className="text-destructive">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={bundleName}
                                    onChange={(e) => setBundleName(e.target.value)}
                                    placeholder="スターターキット A"
                                    className="w-full h-10 rounded-lg border border-border bg-secondary px-3 text-foreground"
                                />
                            </div>

                            {/* Bundle Items */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <label className="block text-sm font-medium text-foreground">
                                        含まれる商品 <span className="text-destructive">*</span>
                                    </label>
                                    <Button size="sm" onClick={addBundleItem} className="gap-1">
                                        <Plus className="h-3 w-3" />
                                        商品追加
                                    </Button>
                                </div>

                                <div className="space-y-3">
                                    {bundleItems.map((item, index) => (
                                        <div key={`item-${index}`} className="flex gap-2 p-3 rounded-lg border border-border bg-secondary/50">
                                            <div className="flex-1 grid grid-cols-2 gap-2">
                                                <input
                                                    type="text"
                                                    value={item.sku}
                                                    onChange={(e) => updateBundleItem(index, "sku", e.target.value)}
                                                    placeholder="SKU"
                                                    className="h-9 rounded border border-border bg-background px-2 text-sm"
                                                />
                                                <input
                                                    type="text"
                                                    value={item.name}
                                                    onChange={(e) => updateBundleItem(index, "name", e.target.value)}
                                                    placeholder="商品名"
                                                    className="h-9 rounded border border-border bg-background px-2 text-sm"
                                                />
                                            </div>
                                            <input
                                                type="number"
                                                min="1"
                                                value={item.quantity}
                                                onChange={(e) => updateBundleItem(index, "quantity", parseInt(e.target.value) || 1)}
                                                className="w-16 h-9 rounded border border-border bg-background px-2 text-sm text-center"
                                            />
                                            {bundleItems.length > 1 && (
                                                <button
                                                    onClick={() => removeBundleItem(index)}
                                                    className="h-9 w-9 rounded border border-destructive/30 hover:bg-destructive/10 text-destructive"
                                                >
                                                    <Trash2 className="h-4 w-4 mx-auto" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-4">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => {
                                        setShowCreateModal(false);
                                        resetForm();
                                    }}
                                >
                                    キャンセル
                                </Button>
                                <Button
                                    className="flex-1"
                                    onClick={handleCreateBundle}
                                    disabled={creating}
                                >
                                    {creating ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            作成中...
                                        </>
                                    ) : (
                                        "作成"
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showEditModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-lg">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-foreground">セット商品を編集</h2>
                            <button onClick={() => { setShowEditModal(false); resetForm(); }} className="text-muted-foreground hover:text-foreground">
                                ✕
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Bundle Info */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-2">
                                        SKU <span className="text-destructive">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={bundleSku}
                                        onChange={(e) => setBundleSku(e.target.value)}
                                        placeholder="BUNDLE-001"
                                        className="w-full h-10 rounded-lg border border-border bg-secondary px-3 text-foreground"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-2">
                                        カテゴリ
                                    </label>
                                    <select
                                        value={bundleCategory}
                                        onChange={(e) => setBundleCategory(e.target.value)}
                                        className="w-full h-10 rounded-lg border border-border bg-secondary px-3 text-foreground"
                                    >
                                        <option value="家電">家電</option>
                                        <option value="食品・飲料">食品・飲料</option>
                                        <option value="ドラッグストア">ドラッグストア</option>
                                        <option value="日用品">日用品</option>
                                        <option value="衣料品">衣料品</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">
                                    商品名 <span className="text-destructive">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={bundleName}
                                    onChange={(e) => setBundleName(e.target.value)}
                                    placeholder="スターターキット A"
                                    className="w-full h-10 rounded-lg border border-border bg-secondary px-3 text-foreground"
                                />
                            </div>

                            {/* Bundle Items */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <label className="block text-sm font-medium text-foreground">
                                        含まれる商品 <span className="text-destructive">*</span>
                                    </label>
                                    <Button size="sm" onClick={addBundleItem} className="gap-1">
                                        <Plus className="h-3 w-3" />
                                        商品追加
                                    </Button>
                                </div>

                                <div className="space-y-3">
                                    {bundleItems.map((item, index) => (
                                        <div key={`item-${index}`} className="flex gap-2 p-3 rounded-lg border border-border bg-secondary/50">
                                            <div className="flex-1 grid grid-cols-2 gap-2">
                                                <input
                                                    type="text"
                                                    value={item.sku}
                                                    onChange={(e) => updateBundleItem(index, "sku", e.target.value)}
                                                    placeholder="SKU"
                                                    className="h-9 rounded border border-border bg-background px-2 text-sm"
                                                />
                                                <input
                                                    type="text"
                                                    value={item.name}
                                                    onChange={(e) => updateBundleItem(index, "name", e.target.value)}
                                                    placeholder="商品名"
                                                    className="h-9 rounded border border-border bg-background px-2 text-sm"
                                                />
                                            </div>
                                            <input
                                                type="number"
                                                min="1"
                                                value={item.quantity}
                                                onChange={(e) => updateBundleItem(index, "quantity", parseInt(e.target.value) || 1)}
                                                className="w-16 h-9 rounded border border-border bg-background px-2 text-sm text-center"
                                            />
                                            {bundleItems.length > 1 && (
                                                <button
                                                    onClick={() => removeBundleItem(index)}
                                                    className="h-9 w-9 rounded border border-destructive/30 hover:bg-destructive/10 text-destructive"
                                                >
                                                    <Trash2 className="h-4 w-4 mx-auto" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-4">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => {
                                        setShowEditModal(false);
                                        resetForm();
                                    }}
                                >
                                    キャンセル
                                </Button>
                                <Button
                                    className="flex-1"
                                    onClick={handleUpdateBundle}
                                    disabled={creating}
                                >
                                    {creating ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            更新中...
                                        </>
                                    ) : (
                                        "更新"
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {products.map((product) => (
                    <div
                        key={product.product_id}
                        className="rounded-xl border border-border bg-card p-4 card-shadow"
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div>
                                <h3 className="font-semibold text-foreground">{product.product_name}</h3>
                                <p className="text-sm text-muted-foreground font-mono">{product.sku}</p>
                            </div>
                            <Badge className="bg-purple-500/20 text-purple-400">セット</Badge>
                        </div>

                        <div className="space-y-2">
                            <p className="text-sm font-medium text-foreground">含まれる商品:</p>
                            {product.set_split_rule?.items?.map((item: any, idx: number) => (
                                <div key={`split-${idx}-${item.sku || idx}`} className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Package className="h-3 w-3" />
                                    <span>{item.name} × {item.quantity}</span>
                                </div>
                            )) || <p className="text-sm text-muted-foreground">未設定</p>}
                        </div>

                        <div className="flex gap-2 mt-4">
                            <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => openEditModal(product)}
                            >
                                編集
                            </Button>
                            <Button variant="ghost" size="sm">
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                        </div>
                    </div>
                ))}

                {products.length === 0 && (
                    <div className="col-span-full text-center py-12 text-muted-foreground">
                        セット商品が登録されていません
                    </div>
                )}
            </div>
        </MainLayout>
    );
}
