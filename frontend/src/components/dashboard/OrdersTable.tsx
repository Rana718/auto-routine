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
            <div className="border-b border-border px-6 py-4">
                <h3 className="text-lg font-semibold text-foreground">本日の注文</h3>
                <p className="text-sm text-muted-foreground">
                    処理対象: {orders.length}件
                </p>
            </div>
            <div className="overflow-x-auto">
                {orders.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-muted-foreground">
                        本日の注文はありません
                    </div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-border bg-muted/30">
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                    注文ID
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                    顧客名
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                    商品数
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                    モール
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                    ステータス
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {orders.map((order, index) => (
                                <tr
                                    key={order.order_id}
                                    className="hover:bg-muted/20 transition-colors animate-fade-in"
                                    style={{ animationDelay: `${index * 50}ms` }}
                                >
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="font-mono text-sm text-primary">
                                            {order.robot_in_order_id || `#${order.order_id}`}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-sm font-medium text-foreground truncate max-w-[200px]">
                                            {order.customer_name || "—"}
                                        </p>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="text-sm text-foreground">
                                            {order.items?.length || 0}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="text-sm text-foreground">
                                            {order.mall_name || "—"}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
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
                )}
            </div>
        </div>
    );
}
