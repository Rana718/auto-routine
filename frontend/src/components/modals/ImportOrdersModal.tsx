"use client";

import { useState } from "react";
import { Upload, Loader2, FileSpreadsheet, AlertCircle } from "lucide-react";
import { Modal, FormField, Input } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { ordersApi } from "@/lib/api";
import { formatDateJP } from "@/lib/date";
import type { OrderCreate } from "@/lib/types";
import { readFileAsCSVText } from "@/lib/excel";

interface ImportOrdersModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

interface ParsedOrder {
    robot_in_order_id?: string;
    mall_name?: string;
    customer_name?: string;
    order_date: string;
    target_purchase_date?: string;
    items?: Array<{
        sku: string;
        product_name: string;
        quantity: number;
    }>;
}

export function ImportOrdersModal({ isOpen, onClose, onSuccess }: ImportOrdersModalProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [step, setStep] = useState<"upload" | "preview">("upload");
    const [parsedOrders, setParsedOrders] = useState<ParsedOrder[]>([]);
    const [csvText, setCsvText] = useState("");

    function parseCSV(text: string): ParsedOrder[] {
        const lines = text.trim().split("\n");
        if (lines.length < 2) return [];

        const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
        const orders: ParsedOrder[] = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(",").map((v) => v.trim());
            if (values.length < headers.length) continue;

            const order: ParsedOrder = {
                order_date: new Date().toISOString(),
                items: [],
            };

            let sku = "";
            let product_name = "";
            let quantity = 1;

            headers.forEach((header, idx) => {
                const value = values[idx];
                if (header.includes("robot") || header.includes("order_id") || header.includes("注文番号")) {
                    order.robot_in_order_id = value;
                } else if (header.includes("mall") || header.includes("モール")) {
                    order.mall_name = value;
                } else if (header.includes("customer") || header.includes("顧客") || header.includes("お客様")) {
                    order.customer_name = value;
                } else if (header.includes("order_date") || header.includes("注文日")) {
                    order.order_date = new Date(value).toISOString();
                } else if (header.includes("target") || header.includes("purchase") || header.includes("買付予定日")) {
                    order.target_purchase_date = value;
                } else if (header.includes("sku") || header.includes("商品コード")) {
                    sku = value;
                } else if (header.includes("product_name") || header.includes("商品名")) {
                    product_name = value;
                } else if (header.includes("quantity") || header.includes("数量")) {
                    quantity = parseInt(value) || 1;
                }
            });

            // Add item if we have product data
            if (sku || product_name) {
                order.items = [{ sku, product_name, quantity }];
            }

            // If target_purchase_date not provided, use order_date
            if (!order.target_purchase_date) {
                order.target_purchase_date = order.order_date.split("T")[0];
            }

            if (order.robot_in_order_id || order.customer_name) {
                orders.push(order);
            }
        }

        return orders;
    }

    async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        const text = await readFileAsCSVText(file);
        setCsvText(text);
        const orders = parseCSV(text);
        setParsedOrders(orders);
        setStep("preview");
    }

    function handlePasteCSV() {
        const orders = parseCSV(csvText);
        setParsedOrders(orders);
        setStep("preview");
    }

    async function handleImport() {
        if (parsedOrders.length === 0) {
            setError("インポートする注文がありません");
            return;
        }

        try {
            setLoading(true);
            setError(null);

            // Convert to API format
            const orders: OrderCreate[] = parsedOrders.map((order) => ({
                robot_in_order_id: order.robot_in_order_id,
                mall_name: order.mall_name,
                customer_name: order.customer_name,
                order_date: order.order_date,
                target_purchase_date: order.target_purchase_date,
                items: order.items || [],
            }));

            await ordersApi.import(orders);
            onSuccess();
            onClose();
            resetForm();
        } catch (err) {
            setError(err instanceof Error ? err.message : "インポートに失敗しました");
        } finally {
            setLoading(false);
        }
    }

    function resetForm() {
        setCsvText("");
        setParsedOrders([]);
        setStep("upload");
        setError(null);
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="注文インポート"
            className="max-w-2xl"
        >
            {error && (
                <div className="p-3 mb-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                </div>
            )}

            {step === "upload" && (
                <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        CSV/Excelファイルをアップロードするか、データを直接貼り付けてください。
                    </p>
                    
                    <div className="p-3 rounded-lg bg-muted/30 text-xs space-y-1">
                        <p className="font-medium">必須列:</p>
                        <p>• <code>customer_name</code> - 顧客名</p>
                        <p>• <code>order_date</code> - 注文日 (例: 2026-01-15)</p>
                        <p>• <code>sku</code> - 商品コード</p>
                        <p>• <code>product_name</code> - 商品名</p>
                        <p className="font-medium mt-2">任意列:</p>
                        <p>• <code>robot_in_order_id</code> - 注文番号</p>
                        <p>• <code>mall_name</code> - モール名</p>
                        <p>• <code>target_purchase_date</code> - 買付予定日 (例: 2026-01-16)</p>
                        <p>• <code>quantity</code> - 数量 (デフォルト: 1)</p>
                        <p className="text-muted-foreground mt-2">※ target_purchase_dateを省略した場合、order_dateと同じ日になります</p>
                    </div>

                    {/* File Upload */}
                    <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                        <input
                            type="file"
                            accept=".csv,.txt,.xlsx,.xls"
                            onChange={handleFileUpload}
                            className="hidden"
                            id="csv-upload"
                        />
                        <label htmlFor="csv-upload" className="cursor-pointer">
                            <FileSpreadsheet className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                            <p className="text-foreground font-medium">ファイルをドロップまたはクリック</p>
                            <p className="text-sm text-muted-foreground mt-1">.csv, .txt, .xlsx, .xls ファイル対応</p>
                        </label>
                    </div>

                    {/* Or Paste */}
                    <div className="flex items-center gap-4">
                        <hr className="flex-1 border-border" />
                        <span className="text-sm text-muted-foreground">または</span>
                        <hr className="flex-1 border-border" />
                    </div>

                    <FormField label="CSVデータを貼り付け">
                        <textarea
                            value={csvText}
                            onChange={(e) => setCsvText(e.target.value)}
                            placeholder="robot_in_order_id,mall_name,customer_name,order_date&#10;ORD-001,楽天,山田太郎,2026-01-15&#10;ORD-002,Amazon,鈴木花子,2026-01-15"
                            rows={5}
                            className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                        />
                    </FormField>

                    <div className="flex gap-3 pt-4">
                        <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                            キャンセル
                        </Button>
                        <Button
                            type="button"
                            className="flex-1"
                            onClick={handlePasteCSV}
                            disabled={!csvText.trim()}
                        >
                            プレビュー
                        </Button>
                    </div>
                </div>
            )}

            {step === "preview" && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                            {parsedOrders.length}件の注文を読み込みました
                        </p>
                        <Button variant="ghost" size="sm" onClick={() => setStep("upload")}>
                            やり直す
                        </Button>
                    </div>

                    {/* Preview Table */}
                    <div className="max-h-64 overflow-auto rounded-lg border border-border">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 sticky top-0">
                                <tr>
                                    <th className="p-2 text-left font-medium text-muted-foreground">注文ID</th>
                                    <th className="p-2 text-left font-medium text-muted-foreground">モール</th>
                                    <th className="p-2 text-left font-medium text-muted-foreground">顧客名</th>
                                    <th className="p-2 text-left font-medium text-muted-foreground">注文日</th>
                                </tr>
                            </thead>
                            <tbody>
                                {parsedOrders.slice(0, 20).map((order, idx) => (
                                    <tr key={idx} className="border-t border-border">
                                        <td className="p-2 font-mono text-xs">{order.robot_in_order_id || "-"}</td>
                                        <td className="p-2">{order.mall_name || "-"}</td>
                                        <td className="p-2">{order.customer_name || "-"}</td>
                                        <td className="p-2 text-xs text-muted-foreground">
                                            {formatDateJP(order.order_date)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {parsedOrders.length > 20 && (
                            <p className="p-2 text-center text-xs text-muted-foreground bg-muted/30">
                                他 {parsedOrders.length - 20}件...
                            </p>
                        )}
                    </div>

                    <div className="flex gap-3 pt-4">
                        <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                            キャンセル
                        </Button>
                        <Button
                            type="button"
                            className="flex-1 gap-2"
                            onClick={handleImport}
                            disabled={loading || parsedOrders.length === 0}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    インポート中...
                                </>
                            ) : (
                                <>
                                    <Upload className="h-4 w-4" />
                                    {parsedOrders.length}件をインポート
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            )}
        </Modal>
    );
}
