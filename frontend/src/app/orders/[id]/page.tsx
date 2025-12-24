"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Package, Store, Clock, Loader2 } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ordersApi } from "@/lib/api";
import type { OrderWithItems } from "@/lib/types";

const itemStatusConfig: Record<string, { label: string; className: string }> = {
    pending: { label: "待機中", className: "bg-muted text-muted-foreground" },
    assigned: { label: "割当済", className: "bg-primary/20 text-primary" },
    purchased: { label: "購入済", className: "bg-success/20 text-success" },
    failed: { label: "失敗", className: "bg-destructive/20 text-destructive" },
    discontinued: { label: "廃盤", className: "bg-warning/20 text-warning" },
    out_of_stock: { label: "在庫切れ", className: "bg-warning/20 text-warning" },
};

export default function OrderDetailPage() {
    const params = useParams();
    const router = useRouter();
    const orderId = Number(params.id);
    
    const [order, setOrder] = useState<OrderWithItems | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (orderId) {
            fetchOrder();
        }
    }, [orderId]);

    async function fetchOrder() {
        try {
            setLoading(true);
            const data = await ordersApi.getById(orderId);
            setOrder(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "注文の取得に失敗しました");
        } finally {
            setLoading(false);
        }
    }

    async function updateItemStatus(itemId: number, status: string) {
        try {
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/api/orders/${orderId}/items/${itemId}/status?status=${status}`,
                {
                    method: "PATCH",
                    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
                }
            );
            if (!response.ok) throw new Error("更新に失敗しました");
            await fetchOrder();
        } catch (err) {
            alert(err instanceof Error ? err.message : "エラーが発生しました");
        }
    }

    if (loading) {
        return (
            <MainLayout title="注文詳細" subtitle="読み込み中...">
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            </MainLayout>
        );
    }

    if (error || !order) {
        return (
            <MainLayout title="注文詳細" subtitle="エラー">
                <div className="text-center py-12">
                    <p className="text-destructive mb-4">{error || "注文が見つかりません"}</p>
                    <Button onClick={() => router.push("/orders")}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        注文一覧に戻る
                    </Button>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout
            title={`注文 #${order.robot_in_order_id || order.order_id}`}
            subtitle={order.customer_name || ""}
        >
            <Button variant="ghost" onClick={() => router.push("/orders")} className="mb-6">
                <ArrowLeft className="h-4 w-4 mr-2" />
                戻る
            </Button>

            {/* Order Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="rounded-xl border border-border bg-card p-4 card-shadow">
                    <p className="text-sm text-muted-foreground mb-1">注文日</p>
                    <p className="text-lg font-semibold text-foreground">
                        {new Date(order.order_date).toLocaleDateString("ja-JP")}
                    </p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 card-shadow">
                    <p className="text-sm text-muted-foreground mb-1">モール</p>
                    <p className="text-lg font-semibold text-foreground">{order.mall_name || "—"}</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 card-shadow">
                    <p className="text-sm text-muted-foreground mb-1">商品数</p>
                    <p className="text-lg font-semibold text-foreground">{order.items?.length || 0}</p>
                </div>
            </div>

            {/* Items Table */}
            <div className="rounded-xl border border-border bg-card card-shadow overflow-hidden">
                <div className="p-4 border-b border-border">
                    <h3 className="text-lg font-semibold text-foreground">注文商品</h3>
                </div>
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-border bg-muted/30">
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                                SKU
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                                商品名
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                                数量
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                                ステータス
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                                操作
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {order.items?.map((item) => (
                            <tr key={item.item_id} className="hover:bg-muted/20">
                                <td className="px-6 py-4">
                                    <span className="font-mono text-sm text-foreground">{item.sku}</span>
                                </td>
                                <td className="px-6 py-4">
                                    <p className="text-sm font-medium text-foreground">{item.product_name}</p>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-sm text-foreground">{item.quantity}</span>
                                </td>
                                <td className="px-6 py-4">
                                    <Badge
                                        className={cn(
                                            itemStatusConfig[item.item_status]?.className ||
                                            itemStatusConfig.pending.className
                                        )}
                                    >
                                        {itemStatusConfig[item.item_status]?.label || item.item_status}
                                    </Badge>
                                </td>
                                <td className="px-6 py-4">
                                    <select
                                        value={item.item_status}
                                        onChange={(e) => updateItemStatus(item.item_id, e.target.value)}
                                        className="rounded border border-border bg-secondary px-2 py-1 text-sm"
                                    >
                                        <option value="pending">待機中</option>
                                        <option value="assigned">割当済</option>
                                        <option value="purchased">購入済</option>
                                        <option value="failed">失敗</option>
                                        <option value="discontinued">廃盤</option>
                                        <option value="out_of_stock">在庫切れ</option>
                                    </select>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </MainLayout>
    );
}
