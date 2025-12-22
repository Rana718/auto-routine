"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Modal, FormField, Input, Select } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { staffApi } from "@/lib/api";
import type { StaffRole, StaffCreate } from "@/lib/types";

interface CreateStaffModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function CreateStaffModal({ isOpen, onClose, onSuccess }: CreateStaffModalProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [staffName, setStaffName] = useState("");
    const [staffCode, setStaffCode] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState<StaffRole>("buyer");
    const [startLocation, setStartLocation] = useState("オフィス（六本木）");
    const [maxCapacity, setMaxCapacity] = useState(20);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        if (!staffName.trim()) {
            setError("スタッフ名は必須です");
            return;
        }

        try {
            setLoading(true);
            const data: StaffCreate = {
                staff_name: staffName,
                staff_code: staffCode || undefined,
                email: email || undefined,
                phone: phone || undefined,
                password: password || undefined,
                role,
                start_location_name: startLocation,
                max_daily_capacity: maxCapacity,
            };
            await staffApi.create(data);
            onSuccess();
            onClose();
            resetForm();
        } catch (err) {
            setError(err instanceof Error ? err.message : "スタッフの作成に失敗しました");
        } finally {
            setLoading(false);
        }
    }

    function resetForm() {
        setStaffName("");
        setStaffCode("");
        setEmail("");
        setPhone("");
        setPassword("");
        setRole("buyer");
        setStartLocation("オフィス（六本木）");
        setMaxCapacity(20);
        setError(null);
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="新規スタッフ登録">
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                        {error}
                    </div>
                )}

                <FormField label="スタッフ名" required>
                    <Input
                        value={staffName}
                        onChange={(e) => setStaffName(e.target.value)}
                        placeholder="山田 太郎"
                    />
                </FormField>

                <FormField label="スタッフコード">
                    <Input
                        value={staffCode}
                        onChange={(e) => setStaffCode(e.target.value)}
                        placeholder="S001"
                    />
                </FormField>

                <FormField label="メールアドレス">
                    <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="yamada@example.com"
                    />
                </FormField>

                <FormField label="電話番号">
                    <Input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="090-xxxx-xxxx"
                    />
                </FormField>

                <FormField label="パスワード">
                    <Input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="ログイン用パスワード"
                    />
                </FormField>

                <FormField label="役割">
                    <Select value={role} onChange={(e) => setRole(e.target.value as StaffRole)}>
                        <option value="buyer">買付スタッフ</option>
                        <option value="supervisor">スーパーバイザー</option>
                        <option value="admin">管理者</option>
                    </Select>
                </FormField>

                <FormField label="出発地点">
                    <Input
                        value={startLocation}
                        onChange={(e) => setStartLocation(e.target.value)}
                        placeholder="オフィス（六本木）"
                    />
                </FormField>

                <FormField label="最大注文数/日">
                    <Input
                        type="number"
                        min={1}
                        max={100}
                        value={maxCapacity}
                        onChange={(e) => setMaxCapacity(Number(e.target.value))}
                    />
                </FormField>

                <div className="flex gap-3 pt-4">
                    <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                        キャンセル
                    </Button>
                    <Button type="submit" className="flex-1" disabled={loading}>
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                登録中...
                            </>
                        ) : (
                            "登録"
                        )}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
