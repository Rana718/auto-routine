"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Modal, FormField, Input, Select } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { storesApi } from "@/lib/api";
import type { Store, StoreCreate } from "@/lib/types";

interface CreateStoreModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    editStore?: Store | null;
}

export function CreateStoreModal({ isOpen, onClose, onSuccess, editStore }: CreateStoreModalProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [storeName, setStoreName] = useState("");
    const [storeCode, setStoreCode] = useState("");
    const [address, setAddress] = useState("");
    const [district, setDistrict] = useState("");
    const [latitude, setLatitude] = useState("");
    const [longitude, setLongitude] = useState("");
    const [category, setCategory] = useState("");
    const [priorityLevel, setPriorityLevel] = useState(2);
    const [weekdayHours, setWeekdayHours] = useState("");
    const [weekendHours, setWeekendHours] = useState("");

    useEffect(() => {
        if (editStore) {
            setStoreName(editStore.store_name);
            setStoreCode(editStore.store_code || "");
            setAddress(editStore.address || "");
            setDistrict(editStore.district || "");
            setLatitude(editStore.latitude?.toString() || "");
            setLongitude(editStore.longitude?.toString() || "");
            setCategory(editStore.category || "");
            setPriorityLevel(editStore.priority_level);
            // Extract weekday and weekend hours
            setWeekdayHours(editStore.opening_hours?.weekday || "");
            setWeekendHours(editStore.opening_hours?.weekend || "");
        } else {
            resetForm();
        }
    }, [editStore, isOpen]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        if (!storeName.trim()) {
            setError("店舗名は必須です");
            return;
        }

        try {
            setLoading(true);

            let parsedOpeningHours: Record<string, string> | undefined;
            if (weekdayHours || weekendHours) {
                parsedOpeningHours = {};
                if (weekdayHours) parsedOpeningHours.weekday = weekdayHours;
                if (weekendHours) parsedOpeningHours.weekend = weekendHours;
            }

            const data: StoreCreate = {
                store_name: storeName,
                store_code: storeCode || undefined,
                address: address || undefined,
                district: district || undefined,
                latitude: latitude ? parseFloat(latitude) : undefined,
                longitude: longitude ? parseFloat(longitude) : undefined,
                category: category || undefined,
                priority_level: priorityLevel,
                opening_hours: parsedOpeningHours,
            };

            if (editStore) {
                await storesApi.update(editStore.store_id, data);
            } else {
                await storesApi.create(data);
            }

            onSuccess();
            onClose();
            resetForm();
        } catch (err) {
            setError(err instanceof Error ? err.message : "店舗の保存に失敗しました");
        } finally {
            setLoading(false);
        }
    }

    function resetForm() {
        setStoreName("");
        setStoreCode("");
        setAddress("");
        setDistrict("");
        setLatitude("");
        setLongitude("");
        setCategory("");
        setPriorityLevel(2);
        setWeekdayHours("");
        setWeekendHours("");
        setError(null);
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={editStore ? "店舗を編集" : "新規店舗登録"}
            className="max-w-lg max-h-[90vh]"
        >
            <form onSubmit={handleSubmit} className="space-y-4 px-1">
                {error && (
                    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                        {error}
                    </div>
                )}

                <FormField label="店舗名" required>
                    <Input
                        value={storeName}
                        onChange={(e) => setStoreName(e.target.value)}
                        placeholder="ドン・キホーテ 渋谷店"
                    />
                </FormField>

                <FormField label="店舗コード">
                    <Input
                        value={storeCode}
                        onChange={(e) => setStoreCode(e.target.value)}
                        placeholder="DK-SBY01"
                    />
                </FormField>

                <FormField label="住所">
                    <Input
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="東京都渋谷区道玄坂2-25-12"
                    />
                </FormField>

                <div className="grid grid-cols-2 gap-3">
                    <FormField label="地区">
                        <Input
                            value={district}
                            onChange={(e) => setDistrict(e.target.value)}
                            placeholder="渋谷区"
                        />
                    </FormField>
                    <FormField label="カテゴリ">
                        <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                            <option value="">選択してください</option>
                            <option value="家電">家電</option>
                            <option value="食品・飲料">食品・飲料</option>
                            <option value="ドラッグストア">ドラッグストア</option>
                            <option value="雑貨">雑貨</option>
                            <option value="衣料品">衣料品</option>
                            <option value="スーパー">スーパー</option>
                            <option value="コンビニ">コンビニ</option>
                            <option value="その他">その他</option>
                        </Select>
                    </FormField>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <FormField label="緯度">
                        <Input
                            type="number"
                            step="0.0000001"
                            value={latitude}
                            onChange={(e) => setLatitude(e.target.value)}
                            placeholder="35.6595"
                        />
                    </FormField>
                    <FormField label="経度">
                        <Input
                            type="number"
                            step="0.0000001"
                            value={longitude}
                            onChange={(e) => setLongitude(e.target.value)}
                            placeholder="139.6999"
                        />
                    </FormField>
                </div>

                <FormField label="優先度 (1=最高, 5=最低)">
                    <Select
                        value={priorityLevel.toString()}
                        onChange={(e) => setPriorityLevel(Number(e.target.value))}
                    >
                        <option value="1">1 - 最高優先度</option>
                        <option value="2">2 - 高優先度</option>
                        <option value="3">3 - 通常</option>
                        <option value="4">4 - 低優先度</option>
                        <option value="5">5 - 最低優先度</option>
                    </Select>
                </FormField>

                <div className="space-y-3">
                    <FormField label="平日営業時間">
                        <Input
                            value={weekdayHours}
                            onChange={(e) => setWeekdayHours(e.target.value)}
                            placeholder="10:00-21:00"
                        />
                    </FormField>
                    <FormField label="週末営業時間">
                        <Input
                            value={weekendHours}
                            onChange={(e) => setWeekendHours(e.target.value)}
                            placeholder="10:00-20:00"
                        />
                    </FormField>
                </div>

                <div className="flex gap-3 pt-4">
                    <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                        キャンセル
                    </Button>
                    <Button type="submit" className="flex-1" disabled={loading}>
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                保存中...
                            </>
                        ) : editStore ? (
                            "更新"
                        ) : (
                            "登録"
                        )}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
