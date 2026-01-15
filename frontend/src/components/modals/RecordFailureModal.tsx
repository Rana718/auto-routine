"use client";

import { useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertModal } from "@/components/modals/AlertModal";

interface RecordFailureModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    listItemId: number;
    itemId: number;
    storeId: number;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function RecordFailureModal({
    isOpen,
    onClose,
    onSuccess,
    listItemId,
    itemId,
    storeId,
}: RecordFailureModalProps) {
    const [failureType, setFailureType] = useState("out_of_stock");
    const [restockDate, setRestockDate] = useState("");
    const [notes, setNotes] = useState("");
    const [loading, setLoading] = useState(false);
    const [alertModal, setAlertModal] = useState<{ message: string; type: "success" | "error" } | null>(null);

    if (!isOpen) return null;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await fetch(`${API_BASE_URL}/api/purchase/failures`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
                body: JSON.stringify({
                    list_item_id: listItemId,
                    item_id: itemId,
                    store_id: storeId,
                    failure_type: failureType,
                    expected_restock_date: restockDate || null,
                    notes,
                }),
            });

            if (!response.ok) throw new Error("記録に失敗しました");

            onSuccess();
            onClose();
        } catch (err) {
            setAlertModal({ message: err instanceof Error ? err.message : "エラーが発生しました", type: "error" });
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-warning" />
                        <h2 className="text-lg font-semibold text-foreground">購入失敗を記録</h2>
                    </div>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                            失敗理由
                        </label>
                        <select
                            value={failureType}
                            onChange={(e) => setFailureType(e.target.value)}
                            className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-foreground"
                            required
                        >
                            <option value="out_of_stock">在庫切れ</option>
                            <option value="discontinued">廃盤</option>
                            <option value="store_closed">店舗休業</option>
                            <option value="price_mismatch">価格不一致</option>
                            <option value="product_not_found">商品未発見</option>
                            <option value="other">その他</option>
                        </select>
                    </div>

                    {(failureType === "out_of_stock" || failureType === "discontinued") && (
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-2">
                                再入荷予定日
                            </label>
                            <input
                                type="date"
                                value={restockDate}
                                onChange={(e) => setRestockDate(e.target.value)}
                                className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-foreground"
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                            備考
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                            className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-foreground"
                            placeholder="詳細情報を入力..."
                        />
                    </div>

                    <div className="flex gap-3">
                        <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                            キャンセル
                        </Button>
                        <Button type="submit" disabled={loading} className="flex-1">
                            {loading ? "記録中..." : "記録"}
                        </Button>
                    </div>
                </form>

                {/* Alert Modal */}
                <AlertModal
                    isOpen={alertModal !== null}
                    onClose={() => setAlertModal(null)}
                    message={alertModal?.message || ""}
                    type={alertModal?.type || "error"}
                />
            </div>
        </div>
    );
}
