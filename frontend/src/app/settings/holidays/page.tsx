"use client";

import { useState, useEffect } from "react";
import { Calendar, Plus, Trash2, Download, Loader2, ChevronLeft } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { holidaysApi, type Holiday, type HolidayCreate } from "@/lib/api";
import Link from "next/link";
import { AlertModal } from "@/components/modals/AlertModal";
import { ConfirmModal } from "@/components/modals/ConfirmModal";

export default function HolidaysPage() {
    const [holidays, setHolidays] = useState<Holiday[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [importing, setImporting] = useState(false);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [alertModal, setAlertModal] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
    const [deleting, setDeleting] = useState(false);

    const [newHoliday, setNewHoliday] = useState<HolidayCreate>({
        holiday_date: "",
        holiday_name: "",
        is_working: false,
    });

    useEffect(() => {
        fetchHolidays();
    }, [selectedYear]);

    async function fetchHolidays() {
        try {
            setLoading(true);
            setError(null);
            const data = await holidaysApi.getAll(selectedYear);
            setHolidays(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "祝日の取得に失敗しました");
        } finally {
            setLoading(false);
        }
    }

    async function handleCreate() {
        try {
            await holidaysApi.create(newHoliday);
            setShowCreateModal(false);
            setNewHoliday({ holiday_date: "", holiday_name: "", is_working: false });
            await fetchHolidays();
            setAlertModal({ message: "祝日を作成しました", type: "success" });
        } catch (err) {
            setAlertModal({ message: err instanceof Error ? err.message : "祝日の作成に失敗しました", type: "error" });
        }
    }

    async function handleDelete(holidayId: number) {
        setConfirmDelete(holidayId);
    }

    async function confirmDeleteHoliday() {
        if (confirmDelete === null) return;

        try {
            setDeleting(true);
            await holidaysApi.delete(confirmDelete);
            await fetchHolidays();
            setAlertModal({ message: "祝日を削除しました", type: "success" });
        } catch (err) {
            setAlertModal({ message: err instanceof Error ? err.message : "祝日の削除に失敗しました", type: "error" });
        } finally {
            setDeleting(false);
            setConfirmDelete(null);
        }
    }

    async function handleImportJapanHolidays() {
        try {
            setImporting(true);
            const result = await holidaysApi.importJapanHolidays(selectedYear);
            setAlertModal({ message: result.message, type: "success" });
            await fetchHolidays();
        } catch (err) {
            setAlertModal({ message: err instanceof Error ? err.message : "インポートに失敗しました", type: "error" });
        } finally {
            setImporting(false);
        }
    }

    async function toggleWorking(holiday: Holiday) {
        try {
            await holidaysApi.update(holiday.holiday_id, {
                holiday_date: holiday.holiday_date,
                holiday_name: holiday.holiday_name || undefined,
                is_working: !holiday.is_working,
            });
            await fetchHolidays();
        } catch (err) {
            setAlertModal({ message: err instanceof Error ? err.message : "更新に失敗しました", type: "error" });
        }
    }

    const currentYear = new Date().getFullYear();
    const years = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

    return (
        <MainLayout title="祝日カレンダー" subtitle="注文締切の祝日設定">
            {/* Back Link */}
            <Link href="/settings" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-4">
                <ChevronLeft className="h-4 w-4" />
                設定に戻る
            </Link>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="rounded-xl border border-border bg-card p-4 card-shadow">
                    <p className="text-sm text-muted-foreground">登録祝日数</p>
                    <p className="text-2xl font-bold text-foreground">{holidays.length}</p>
                </div>
                <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4">
                    <p className="text-sm text-muted-foreground">休業日</p>
                    <p className="text-2xl font-bold text-destructive">
                        {holidays.filter(h => !h.is_working).length}
                    </p>
                </div>
                <div className="rounded-xl border border-success/20 bg-success/10 p-4">
                    <p className="text-sm text-muted-foreground">営業日（祝日営業）</p>
                    <p className="text-2xl font-bold text-success">
                        {holidays.filter(h => h.is_working).length}
                    </p>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="h-10 rounded-lg border border-border bg-secondary px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                    {years.map((year) => (
                        <option key={year} value={year}>
                            {year}年
                        </option>
                    ))}
                </select>
                <div className="flex gap-3 flex-1 justify-end">
                    <Button
                        variant="outline"
                        className="gap-2"
                        onClick={handleImportJapanHolidays}
                        disabled={importing}
                    >
                        {importing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Download className="h-4 w-4" />
                        )}
                        日本の祝日をインポート
                    </Button>
                    <Button className="gap-2" onClick={() => setShowCreateModal(true)}>
                        <Plus className="h-4 w-4" />
                        祝日追加
                    </Button>
                </div>
            </div>

            {/* Content */}
            <div className="rounded-xl border border-border bg-card card-shadow overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : error ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="text-center">
                            <p className="text-destructive mb-2">{error}</p>
                            <button onClick={fetchHolidays} className="text-primary hover:underline">
                                再試行
                            </button>
                        </div>
                    </div>
                ) : holidays.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                        <Calendar className="h-12 w-12 mb-3 opacity-30" />
                        <p>{selectedYear}年の祝日が登録されていません</p>
                        <Button variant="outline" className="mt-4 gap-2" onClick={handleImportJapanHolidays}>
                            <Download className="h-4 w-4" />
                            日本の祝日をインポート
                        </Button>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-border bg-muted/30">
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                                    日付
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                                    祝日名
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                                    営業状況
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                                    操作
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {holidays.map((holiday) => (
                                <tr key={holiday.holiday_id} className="hover:bg-muted/20">
                                    <td className="px-6 py-4">
                                        <span className="font-medium text-foreground">
                                            {new Date(holiday.holiday_date).toLocaleDateString("ja-JP", {
                                                year: "numeric",
                                                month: "long",
                                                day: "numeric",
                                                weekday: "short",
                                            })}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-foreground">
                                            {holiday.holiday_name || "—"}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <button onClick={() => toggleWorking(holiday)}>
                                            <Badge
                                                className={cn(
                                                    "cursor-pointer transition-colors",
                                                    holiday.is_working
                                                        ? "bg-success/20 text-success hover:bg-success/30"
                                                        : "bg-destructive/20 text-destructive hover:bg-destructive/30"
                                                )}
                                            >
                                                {holiday.is_working ? "営業" : "休業"}
                                            </Badge>
                                        </button>
                                    </td>
                                    <td className="px-6 py-4">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDelete(holiday.holiday_id)}
                                        >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Create Holiday Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
                        <h2 className="text-lg font-semibold text-foreground mb-4">祝日追加</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">日付</label>
                                <input
                                    type="date"
                                    value={newHoliday.holiday_date}
                                    onChange={(e) => setNewHoliday({ ...newHoliday, holiday_date: e.target.value })}
                                    className="w-full rounded-lg border border-border bg-secondary px-3 py-2"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">祝日名</label>
                                <input
                                    type="text"
                                    value={newHoliday.holiday_name}
                                    onChange={(e) => setNewHoliday({ ...newHoliday, holiday_name: e.target.value })}
                                    placeholder="例：元日"
                                    className="w-full rounded-lg border border-border bg-secondary px-3 py-2"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="is_working"
                                    checked={newHoliday.is_working}
                                    onChange={(e) => setNewHoliday({ ...newHoliday, is_working: e.target.checked })}
                                    className="h-4 w-4"
                                />
                                <label htmlFor="is_working" className="text-sm">
                                    この祝日は営業日にする
                                </label>
                            </div>
                            <div className="flex gap-3">
                                <Button variant="outline" onClick={() => setShowCreateModal(false)} className="flex-1">
                                    キャンセル
                                </Button>
                                <Button onClick={handleCreate} className="flex-1">
                                    追加
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Delete Modal */}
            <ConfirmModal
                isOpen={confirmDelete !== null}
                onClose={() => !deleting && setConfirmDelete(null)}
                onConfirm={confirmDeleteHoliday}
                title="祝日削除"
                message="この祝日を削除してもよろしいですか？"
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
                type={alertModal?.type || "info"}
            />
        </MainLayout>
    );
}
