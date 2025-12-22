"use client";

import { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ordersApi } from "@/lib/api";

interface CreateOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function CreateOrderModal({ isOpen, onClose, onSuccess }: CreateOrderModalProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [orderNumber, setOrderNumber] = useState("");
    const [customerName, setCustomerName] = useState("");
    const [items, setItems] = useState([
        { sku: "", product_name: "", quantity: 1, unit_price: 0 }
    ]);

    if (!isOpen) return null;

    const handleAddItem = () => {
        setItems([...items, { sku: "", product_name: "", quantity: 1, unit_price: 0 }]);
    };

    const handleRemoveItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const handleItemChange = (index: number, field: string, value: string | number) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const today = new Date().toISOString();
            await ordersApi.create({
                order_number: orderNumber,
                customer_name: customerName,
                order_date: today,
                target_date: today.split("T")[0],
                items: items.map(item => ({
                    sku: item.sku,
                    product_name: item.product_name,
                    quantity: Number(item.quantity),
                    unit_price: Number(item.unit_price),
                })),
            });
            onSuccess();
            onClose();
            // Reset form
            setOrderNumber("");
            setCustomerName("");
            setItems([{ sku: "", product_name: "", quantity: 1, unit_price: 0 }]);
        } catch (err) {
            setError(err instanceof Error ? err.message : "注文の作成に失敗しました");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-2xl rounded-xl border border-border bg-card p-6 shadow-lg">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-foreground">注文を追加</h2>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-2 hover:bg-secondary transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">注文番号</label>
                            <input
                                type="text"
                                value={orderNumber}
                                onChange={(e) => setOrderNumber(e.target.value)}
                                placeholder="ORD-001"
                                className="w-full h-10 rounded-lg border border-border bg-secondary px-3 text-sm"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">顧客名</label>
                            <input
                                type="text"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                placeholder="顧客名"
                                className="w-full h-10 rounded-lg border border-border bg-secondary px-3 text-sm"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium">商品</label>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleAddItem}
                                className="gap-1"
                            >
                                <Plus className="h-3 w-3" />
                                商品追加
                            </Button>
                        </div>

                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {items.map((item, index) => (
                                <div key={index} className="flex gap-2 p-3 rounded-lg border border-border bg-secondary/50">
                                    <div className="flex-1 grid grid-cols-4 gap-2">
                                        <input
                                            type="text"
                                            value={item.sku}
                                            onChange={(e) => handleItemChange(index, "sku", e.target.value)}
                                            placeholder="SKU"
                                            className="h-9 rounded border border-border bg-background px-2 text-sm"
                                            required
                                        />
                                        <input
                                            type="text"
                                            value={item.product_name}
                                            onChange={(e) => handleItemChange(index, "product_name", e.target.value)}
                                            placeholder="商品名"
                                            className="h-9 rounded border border-border bg-background px-2 text-sm"
                                            required
                                        />
                                        <input
                                            type="number"
                                            value={item.quantity}
                                            onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                                            placeholder="数量"
                                            min="1"
                                            className="h-9 rounded border border-border bg-background px-2 text-sm"
                                            required
                                        />
                                        <input
                                            type="number"
                                            value={item.unit_price}
                                            onChange={(e) => handleItemChange(index, "unit_price", e.target.value)}
                                            placeholder="単価"
                                            min="0"
                                            className="h-9 rounded border border-border bg-background px-2 text-sm"
                                            required
                                        />
                                    </div>
                                    {items.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveItem(index)}
                                            className="p-2 rounded hover:bg-destructive/10 text-destructive"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={loading}
                            className="flex-1"
                        >
                            キャンセル
                        </Button>
                        <Button type="submit" disabled={loading} className="flex-1">
                            {loading ? "作成中..." : "注文を作成"}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
