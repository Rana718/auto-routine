"use client";

import { useState, useEffect } from "react";
import { Upload, Filter, Search, ChevronDown, Loader2, Plus, Download, Eye, Trash2 } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ordersApi } from "@/lib/api";
import { ImportOrdersModal } from "@/components/modals/ImportOrdersModal";
import { CreateOrderModal } from "@/components/modals/CreateOrderModal";
import type { OrderWithItems, OrderStatus } from "@/lib/types";
import { useSession } from "next-auth/react";
import { AlertModal } from "@/components/modals/AlertModal";
import { ConfirmModal } from "@/components/modals/ConfirmModal";

const statusConfig: Record<OrderStatus | string, { label: string; className: string }> = {
    pending: { label: "待機中", className: "bg-muted text-muted-foreground" },
    processing: { label: "処理中", className: "bg-blue-500/20 text-blue-400" },
    assigned: { label: "割当済", className: "bg-primary/20 text-primary" },
    in_progress: { label: "進行中", className: "bg-primary/20 text-primary" },
    completed: { label: "完了", className: "bg-success/20 text-success" },
    partially_completed: { label: "一部完了", className: "bg-warning/20 text-warning" },
    failed: { label: "失敗", className: "bg-destructive/20 text-destructive" },
    cancelled: { label: "キャンセル", className: "bg-muted text-muted-foreground" },
};

export default function OrdersPage() {
    const { data: session } = useSession();
    const userRole = session?.user?.role || "buyer";
    const canManageOrders = userRole === "admin" || userRole === "supervisor";

    const [orders, setOrders] = useState<OrderWithItems[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [page, setPage] = useState(0);
    const [total, setTotal] = useState(0);
    const [showImportModal, setShowImportModal] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [alertModal, setAlertModal] = useState<{ message: string; type: "success" | "error" } | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
    const [deleting, setDeleting] = useState(false);
    const limit = 20;

    useEffect(() => {
        fetchOrders();
    }, [statusFilter, page]);

    async function fetchOrders() {
        try {
            setLoading(true);
            setError(null);
            const data = await ordersApi.getAll({
                status: statusFilter !== "all" ? statusFilter as OrderStatus : undefined,
                search: searchTerm || undefined,
                skip: page * limit,
                limit,
            });
            setOrders(data);
            setTotal(data.length);
        } catch (err) {
            setError(err instanceof Error ? err.message : "注文の取得に失敗しました");
        } finally {
            setLoading(false);
        }
    }

    function handleSearch(e: React.FormEvent) {
        e.preventDefault();
        setPage(0);
        fetchOrders();
    }

    async function confirmDeleteOrder() {
        if (confirmDelete === null) return;

        try {
            setDeleting(true);
            await ordersApi.delete(confirmDelete);
            setAlertModal({ message: "注文を削除しました", type: "success" });
            await fetchOrders();
        } catch (err) {
            setAlertModal({ message: err instanceof Error ? err.message : "削除に失敗しました", type: "error" });
        } finally {
            setDeleting(false);
            setConfirmDelete(null);
        }
    }

    const filteredOrders = orders.filter((order) => {
        if (!searchTerm) return true;
        const matchesSearch =
            (order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (order.robot_in_order_id?.toLowerCase().includes(searchTerm.toLowerCase())) ||
            String(order.order_id).includes(searchTerm);
        return matchesSearch;
    });

    return (
        <MainLayout title="注文管理" subtitle="すべての買付注文を管理・追跡">
            {/* Toolbar */}
            <form onSubmit={handleSearch} className="flex flex-col gap-3 mb-4 md:mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="顧客名、注文IDで検索..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full h-10 rounded-lg border border-border bg-secondary pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background transition-all"
                    />
                </div>
                <div className="flex flex-wrap gap-2">
                    <select
                        value={statusFilter}
                        onChange={(e) => {
                            setStatusFilter(e.target.value);
                            setPage(0);
                        }}
                        className="h-10 rounded-lg border border-border bg-secondary px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary flex-1 sm:flex-none"
                    >
                        <option value="all">全てのステータス</option>
                        <option value="pending">待機中</option>
                        <option value="assigned">割当済</option>
                        <option value="completed">完了</option>
                        <option value="failed">失敗</option>
                    </select>
                    <Button variant="outline" className="gap-2 flex-1 sm:flex-none" type="button" onClick={() => setShowCreateModal(true)}>
                        <Plus className="h-4 w-4" />
                        <span className="hidden sm:inline">手動追加</span>
                        <span className="sm:hidden">追加</span>
                    </Button>
                    {canManageOrders && (
                        <Button variant="outline" className="gap-2 flex-1 sm:flex-none" type="button" onClick={() => {
                            const token = (session as any)?.accessToken;
                            if (!token) {
                                setAlertModal({ message: "認証トークンが見つかりません。再度ログインしてください。", type: "error" });
                                return;
                            }
                            window.open(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/settings/data/export-orders?token=${token}`, "_blank");
                        }}>
                            <Download className="h-4 w-4" />
                            <span className="hidden sm:inline">CSV出力</span>
                            <span className="sm:hidden">CSV</span>
                        </Button>
                    )}
                    <Button className="gap-2 flex-1 sm:flex-none" type="button" onClick={() => setShowImportModal(true)}>
                        <Upload className="h-4 w-4" />
                        <span className="hidden sm:inline">注文取込</span>
                        <span className="sm:hidden">取込</span>
                    </Button>
                </div>
            </form>

            {/* Orders Table */}
            <div className="rounded-xl border border-border bg-card card-shadow overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : error ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="text-center">
                            <p className="text-destructive mb-2">{error}</p>
                            <button onClick={fetchOrders} className="text-primary hover:underline">
                                再試行
                            </button>
                        </div>
                    </div>
                ) : filteredOrders.length === 0 ? (
                    <div className="flex items-center justify-center h-64 text-muted-foreground">
                        注文が見つかりません
                    </div>
                ) : (
                    <>
                        {/* Mobile card layout */}
                        <div className="md:hidden divide-y divide-border">
                            {filteredOrders.map((order, index) => (
                                <div
                                    key={order.order_id}
                                    className="p-4 hover:bg-muted/20 transition-colors animate-fade-in"
                                    style={{ animationDelay: `${index * 30}ms` }}
                                    onClick={() => window.location.href = `/orders/${order.order_id}`}
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <span className="font-mono text-sm text-primary font-medium">
                                            {order.robot_in_order_id || `#${order.order_id}`}
                                        </span>
                                        <Badge
                                            className={cn(
                                                "border-none font-medium text-xs",
                                                statusConfig[order.order_status]?.className || statusConfig.pending.className
                                            )}
                                        >
                                            {statusConfig[order.order_status]?.label || order.order_status}
                                        </Badge>
                                    </div>
                                    <p className="text-sm font-medium text-foreground truncate mb-1">
                                        {order.customer_name || "—"}
                                    </p>
                                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                        <span>商品数: {order.items?.length || 0}</span>
                                        <span>モール: {order.mall_name || "—"}</span>
                                    </div>
                                    {order.order_date && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {new Date(order.order_date).toLocaleDateString("ja-JP")}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Desktop table layout */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-border bg-muted/30">
                                        <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                            注文ID
                                        </th>
                                        <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                            顧客名
                                        </th>
                                        <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                            商品数
                                        </th>
                                        <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                            モール
                                        </th>
                                        <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                            注文日
                                        </th>
                                        <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                            ステータス
                                        </th>
                                        <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                            操作
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {filteredOrders.map((order, index) => (
                                        <tr
                                            key={order.order_id}
                                            className="hover:bg-muted/20 transition-colors animate-fade-in"
                                            style={{ animationDelay: `${index * 30}ms` }}
                                        >
                                            <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                                                <span className="font-mono text-sm text-primary">
                                                    {order.robot_in_order_id || `#${order.order_id}`}
                                                </span>
                                            </td>
                                            <td className="px-4 lg:px-6 py-4">
                                                <p className="text-sm font-medium text-foreground truncate max-w-[150px] lg:max-w-[200px]">
                                                    {order.customer_name || "—"}
                                                </p>
                                            </td>
                                            <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                                                <span className="text-sm font-medium text-foreground">
                                                    {order.items?.length || 0}
                                                </span>
                                            </td>
                                            <td className="px-4 lg:px-6 py-4">
                                                <span className="text-sm text-foreground truncate max-w-[120px] lg:max-w-[150px] block">
                                                    {order.mall_name || "—"}
                                                </span>
                                            </td>
                                            <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                                                <span className="text-sm text-muted-foreground">
                                                    {order.order_date ? new Date(order.order_date).toLocaleDateString("ja-JP") : "—"}
                                                </span>
                                            </td>
                                            <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                                                <Badge
                                                    className={cn(
                                                        "border-none font-medium",
                                                        statusConfig[order.order_status]?.className || statusConfig.pending.className
                                                    )}
                                                >
                                                    {statusConfig[order.order_status]?.label || order.order_status}
                                                </Badge>
                                            </td>
                                            <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0"
                                                        onClick={() => window.location.href = `/orders/${order.order_id}`}
                                                        title="詳細を見る"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                    {canManageOrders && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                            onClick={() => setConfirmDelete(order.order_id)}
                                                            title="削除"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {/* Pagination */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border px-4 md:px-6 py-3 md:py-4 bg-muted/20">
                    <p className="text-sm text-muted-foreground">
                        {filteredOrders.length}件を表示
                    </p>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page === 0}
                            onClick={() => setPage((p) => Math.max(0, p - 1))}
                        >
                            前へ
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={filteredOrders.length < limit}
                            onClick={() => setPage((p) => p + 1)}
                        >
                            次へ
                        </Button>
                    </div>
                </div>
            </div>

            {/* Create Order Modal */}
            <CreateOrderModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onSuccess={fetchOrders}
            />

            {/* Import Orders Modal */}
            <ImportOrdersModal
                isOpen={showImportModal}
                onClose={() => setShowImportModal(false)}
                onSuccess={fetchOrders}
            />

            {/* Confirm Delete Modal */}
            <ConfirmModal
                isOpen={confirmDelete !== null}
                onClose={() => !deleting && setConfirmDelete(null)}
                onConfirm={confirmDeleteOrder}
                title="注文削除"
                message="この注文を削除してもよろしいですか？"
                confirmText="削除"
                cancelText="キャンセル"
                variant="destructive"
                loading={deleting}
            />

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
