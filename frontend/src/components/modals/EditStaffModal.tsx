"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Modal, FormField, Input, Select } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { adminApi } from "@/lib/api";
import type { StaffRole, StaffWithStats } from "@/lib/types";

interface EditStaffModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    staff: StaffWithStats | null;
}

export function EditStaffModal({ isOpen, onClose, onSuccess, staff }: EditStaffModalProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [staffName, setStaffName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState<StaffRole>("buyer");

    useEffect(() => {
        if (staff && isOpen) {
            setStaffName(staff.staff_name);
            setEmail(staff.email || "");
            setRole(staff.role);
            setPassword("");
            setError(null);
        }
    }, [staff, isOpen]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!staff) return;
        setError(null);

        if (!staffName.trim()) {
            setError("スタッフ名は必須です");
            return;
        }

        try {
            setLoading(true);
            const data: { staff_name?: string; email?: string; password?: string; role?: string } = {};

            if (staffName !== staff.staff_name) data.staff_name = staffName;
            if (email !== (staff.email || "")) data.email = email || undefined;
            if (password) data.password = password;
            if (role !== staff.role) data.role = role;

            if (Object.keys(data).length === 0) {
                onClose();
                return;
            }

            await adminApi.updateUser(staff.staff_id, data);
            onSuccess();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : "更新に失敗しました");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="スタッフ編集">
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

                <FormField label="メールアドレス">
                    <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="yamada@example.com"
                    />
                </FormField>

                <FormField label="パスワード">
                    <Input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="変更する場合のみ入力"
                    />
                </FormField>

                <FormField label="役割">
                    <Select value={role} onChange={(e) => setRole(e.target.value as StaffRole)}>
                        <option value="buyer">バイヤー</option>
                        <option value="supervisor">スーパーバイザー</option>
                        <option value="admin">管理者</option>
                    </Select>
                </FormField>

                <div className="flex gap-3 pt-4">
                    <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                        キャンセル
                    </Button>
                    <Button type="submit" className="flex-1" disabled={loading}>
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                更新中...
                            </>
                        ) : (
                            "更新"
                        )}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
