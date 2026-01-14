import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { OrderWithItems, OrderStatus } from "@/lib/types";

interface OrdersTableProps {
    orders: OrderWithItems[];
}

const statusConfig: Record<OrderStatus, { label: string; className: string }> = {
    pending: { label: "待機中", className: "bg-muted text-muted-foreground" },
    processing: { label: "処理中", className: "bg-blue-500/20 text-blue-400" },
    assigned: { label: "割当済", className: "bg-primary/20 text-primary" },
    in_progress: { label: "進行中", className: "bg-primary/20 text-primary" },
    completed: { label: "完了", className: "bg-success/20 text-success" },
    partially_completed: { label: "一部完了", className: "bg-warning/20 text-warning" },
    failed: { label: "失敗", className: "bg-destructive/20 text-destructive" },
    cancelled: { label: "キャンセル", className: "bg-muted text-muted-foreground" },
};

export function OrdersTable({ orders }: OrdersTableProps) {
    return (
        <div className="rounded-xl border border-border bg-card card-shadow overflow-hidden">
            <div className="border-b border-border px-4 md:px-6 py-3 md:py-4">
                <h3 className="text-base md:text-lg font-semibold text-foreground">本日の注文</h3>
                <p className="text-xs md:text-sm text-muted-foreground">
                    処理対象: {orders.length}件
                </p>
            </div>

            {orders.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                    本日の注文はありません
                </div>
            ) : (
                <>
                    {/* Mobile card layout */}
                    <div className="md:hidden divide-y divide-border">
                        {orders.map((order) => (
                            <div key={order.order_id} className="p-4 hover:bg-muted/20 transition-colors">
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
                                        ステータス
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {orders.map((order) => (
                                    <tr
                                        key={order.order_id}
                                        className="hover:bg-muted/20 transition-colors"
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
                                            <span className="text-sm text-foreground">
                                                {order.items?.length || 0}
                                            </span>
                                        </td>
                                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm text-foreground">
                                                {order.mall_name || "—"}
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
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}
