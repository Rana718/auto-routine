"use client";

import { useState, useEffect } from "react";
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

export default function BundlesPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchProducts();
    }, []);

    async function fetchProducts() {
        try {
            setLoading(true);
            const response = await fetch(`${API_BASE_URL}/api/products`, {
                headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
            });
            const data = await response.json();
            setProducts(data.filter((p: Product) => p.is_set_product));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
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
                <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    セット商品を追加
                </Button>
            </div>

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
                                <div key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Package className="h-3 w-3" />
                                    <span>{item.name} × {item.quantity}</span>
                                </div>
                            )) || <p className="text-sm text-muted-foreground">未設定</p>}
                        </div>

                        <div className="flex gap-2 mt-4">
                            <Button variant="outline" size="sm" className="flex-1">
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
