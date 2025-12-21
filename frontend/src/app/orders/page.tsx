"use client";

import { useState } from "react";
import { Upload, Filter, Search, ChevronDown } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Order {
    id: string;
    sku: string;
    productName: string;
    quantity: number;
    store: string;
    assignedTo: string;
    status: "pending" | "assigned" | "purchased" | "failed" | "discontinued" | "restocking";
    orderDate: string;
    priority: "high" | "normal" | "low";
}

const mockOrders: Order[] = [
    { id: "ORD-001", sku: "SKU-12345", productName: "プレミアムワイヤレスヘッドホン Sony WH-1000XM5", quantity: 2, store: "家電プラザ渋谷", assignedTo: "田中", status: "assigned", orderDate: "2024-01-15", priority: "high" },
    { id: "ORD-002", sku: "SKU-67890", productName: "有機抹茶セット プレミアム", quantity: 5, store: "グルメマーケット銀座", assignedTo: "鈴木", status: "pending", orderDate: "2024-01-15", priority: "normal" },
    { id: "ORD-003", sku: "SKU-11111", productName: "Anker PowerCore 20000mAh モバイルバッテリー", quantity: 3, store: "テックハブ秋葉原", assignedTo: "山本", status: "purchased", orderDate: "2024-01-15", priority: "normal" },
    { id: "ORD-004", sku: "SKU-22222", productName: "ブルーボトル シングルオリジン コーヒー豆 1kg", quantity: 4, store: "特選食品 代官山", assignedTo: "渡辺", status: "failed", orderDate: "2024-01-15", priority: "low" },
    { id: "ORD-005", sku: "SKU-33333", productName: "無印良品 竹製デスクオーガナイザー 大", quantity: 1, store: "無印良品 新宿", assignedTo: "伊藤", status: "assigned", orderDate: "2024-01-15", priority: "high" },
    { id: "ORD-006", sku: "SKU-44444", productName: "Nintendo Switch 有機ELモデル ホワイト", quantity: 1, store: "ビックカメラ有楽町", assignedTo: "", status: "pending", orderDate: "2024-01-15", priority: "high" },
    { id: "ORD-007", sku: "SKU-55555", productName: "ユニクロ ヒートテック ウルトラウォームセット", quantity: 6, store: "ユニクロ銀座", assignedTo: "田中", status: "discontinued", orderDate: "2024-01-15", priority: "normal" },
    { id: "ORD-008", sku: "SKU-66666", productName: "パイロット カクノ 万年筆セット", quantity: 10, store: "伊東屋", assignedTo: "鈴木", status: "restocking", orderDate: "2024-01-15", priority: "low" },
];

const statusConfig = {
    pending: { label: "待機中", className: "bg-muted text-muted-foreground" },
    assigned: { label: "割当済", className: "bg-primary/20 text-primary" },
    purchased: { label: "購入済", className: "bg-success/20 text-success" },
    failed: { label: "失敗", className: "bg-destructive/20 text-destructive" },
    discontinued: { label: "廃番", className: "bg-destructive/20 text-destructive" },
    restocking: { label: "入荷待ち", className: "bg-warning/20 text-warning" },
};

const priorityConfig = {
    high: "border-l-warning",
    normal: "border-l-primary",
    low: "border-l-muted-foreground",
};

export default function OrdersPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");

    const filteredOrders = mockOrders.filter((order) => {
        const matchesSearch =
            order.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.id.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === "all" || order.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    return (
        <MainLayout title="注文管理" subtitle="すべての買付注文を管理・追跡">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="商品名、SKU、注文IDで検索..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full h-10 rounded-lg border border-border bg-secondary pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background transition-all"
                    />
                </div>
                <div className="flex gap-3">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="h-10 rounded-lg border border-border bg-secondary px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                        <option value="all">全てのステータス</option>
                        <option value="pending">待機中</option>
                        <option value="assigned">割当済</option>
                        <option value="purchased">購入済</option>
                        <option value="failed">失敗</option>
                        <option value="discontinued">廃番</option>
                        <option value="restocking">入荷待ち</option>
                    </select>
                    <Button variant="outline" className="gap-2">
                        <Filter className="h-4 w-4" />
                        詳細フィルター
                    </Button>
                    <Button className="gap-2">
                        <Upload className="h-4 w-4" />
                        注文取込
                    </Button>
                </div>
            </div>

            {/* Orders Table */}
            <div className="rounded-xl border border-border bg-card card-shadow overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-border bg-muted/30">
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                    注文
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                    商品
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                    数量
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                    店舗
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                    担当者
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                    ステータス
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                    操作
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filteredOrders.map((order, index) => (
                                <tr
                                    key={order.id}
                                    className={cn(
                                        "hover:bg-muted/20 transition-colors border-l-4 animate-fade-in",
                                        priorityConfig[order.priority]
                                    )}
                                    style={{ animationDelay: `${index * 30}ms` }}
                                >
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="font-mono text-sm text-primary">{order.id}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div>
                                            <p className="text-sm font-medium text-foreground truncate max-w-[250px]">
                                                {order.productName}
                                            </p>
                                            <p className="text-xs text-muted-foreground font-mono">{order.sku}</p>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="text-sm font-medium text-foreground">{order.quantity}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-sm text-foreground truncate max-w-[180px] block">
                                            {order.store}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {order.assignedTo ? (
                                            <span className="text-sm text-foreground">{order.assignedTo}</span>
                                        ) : (
                                            <span className="text-sm text-muted-foreground italic">未割当</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <Badge
                                            className={cn("border-none font-medium", statusConfig[order.status].className)}
                                        >
                                            {statusConfig[order.status].label}
                                        </Badge>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <Button variant="ghost" size="sm" className="gap-1">
                                            操作
                                            <ChevronDown className="h-3 w-3" />
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between border-t border-border px-6 py-4 bg-muted/20">
                    <p className="text-sm text-muted-foreground">
                        {mockOrders.length}件中 {filteredOrders.length}件を表示
                    </p>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" disabled>
                            前へ
                        </Button>
                        <Button variant="outline" size="sm">
                            次へ
                        </Button>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
