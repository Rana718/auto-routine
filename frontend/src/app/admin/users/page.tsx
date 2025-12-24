"use client";

import { useState, useEffect } from "react";
import { UserPlus, Shield, Trash2, Loader2, CheckCircle, XCircle } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface User {
    staff_id: number;
    staff_name: string;
    email: string;
    role: string;
    status: string;
    is_active: boolean;
    created_at: string;
}

const roleConfig: Record<string, { label: string; className: string }> = {
    buyer: { label: "バイヤー", className: "bg-secondary text-secondary-foreground" },
    supervisor: { label: "スーパーバイザー", className: "bg-primary/20 text-primary" },
    admin: { label: "管理者", className: "bg-accent/20 text-accent" },
};

export default function AdminUsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "buyer" });

    useEffect(() => {
        fetchUsers();
    }, []);

    async function fetchUsers() {
        try {
            setLoading(true);
            const response = await fetch(`${API_BASE_URL}/api/admin/users?include_inactive=true`, {
                headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
            });
            if (!response.ok) throw new Error("ユーザーの取得に失敗しました");
            const data = await response.json();
            setUsers(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "エラーが発生しました");
        } finally {
            setLoading(false);
        }
    }

    async function createUser() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${localStorage.getItem("token")}`
                },
                body: JSON.stringify(newUser)
            });
            if (!response.ok) throw new Error("ユーザー作成に失敗しました");
            setShowCreateModal(false);
            setNewUser({ name: "", email: "", password: "", role: "buyer" });
            await fetchUsers();
        } catch (err) {
            alert(err instanceof Error ? err.message : "エラーが発生しました");
        }
    }

    async function toggleActive(userId: number, active: boolean) {
        try {
            const response = await fetch(
                `${API_BASE_URL}/api/admin/users/${userId}/activate?active=${active}`,
                {
                    method: "PATCH",
                    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
                }
            );
            if (!response.ok) throw new Error("更新に失敗しました");
            await fetchUsers();
        } catch (err) {
            alert(err instanceof Error ? err.message : "エラーが発生しました");
        }
    }

    async function updateRole(userId: number, role: string) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/role`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${localStorage.getItem("token")}`
                },
                body: JSON.stringify({ role })
            });
            if (!response.ok) throw new Error("ロール更新に失敗しました");
            await fetchUsers();
        } catch (err) {
            alert(err instanceof Error ? err.message : "エラーが発生しました");
        }
    }

    async function deleteUser(userId: number) {
        if (!confirm("本当にこのユーザーを削除しますか？")) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
            });
            if (!response.ok) throw new Error("削除に失敗しました");
            await fetchUsers();
        } catch (err) {
            alert(err instanceof Error ? err.message : "エラーが発生しました");
        }
    }

    if (loading) {
        return (
            <MainLayout title="ユーザー管理" subtitle="システムユーザーの管理">
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout title="ユーザー管理" subtitle="システムユーザーの管理">
            {error && (
                <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
                    {error}
                </div>
            )}

            <div className="mb-6">
                <Button onClick={() => setShowCreateModal(true)} className="gap-2">
                    <UserPlus className="h-4 w-4" />
                    ユーザー追加
                </Button>
            </div>

            <div className="rounded-xl border border-border bg-card card-shadow overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-border bg-muted/30">
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                                名前
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                                メール
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                                ロール
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                                ステータス
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                                操作
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {users.map((user) => (
                            <tr key={user.staff_id} className="hover:bg-muted/20">
                                <td className="px-6 py-4">
                                    <p className="font-medium text-foreground">{user.staff_name}</p>
                                </td>
                                <td className="px-6 py-4 text-sm text-muted-foreground">
                                    {user.email}
                                </td>
                                <td className="px-6 py-4">
                                    <select
                                        value={user.role}
                                        onChange={(e) => updateRole(user.staff_id, e.target.value)}
                                        className="rounded border border-border bg-secondary px-2 py-1 text-sm"
                                    >
                                        <option value="buyer">バイヤー</option>
                                        <option value="supervisor">スーパーバイザー</option>
                                        <option value="admin">管理者</option>
                                    </select>
                                </td>
                                <td className="px-6 py-4">
                                    <Badge
                                        className={cn(
                                            user.is_active
                                                ? "bg-success/20 text-success"
                                                : "bg-destructive/20 text-destructive"
                                        )}
                                    >
                                        {user.is_active ? "有効" : "無効"}
                                    </Badge>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => toggleActive(user.staff_id, !user.is_active)}
                                        >
                                            {user.is_active ? (
                                                <XCircle className="h-4 w-4" />
                                            ) : (
                                                <CheckCircle className="h-4 w-4" />
                                            )}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => deleteUser(user.staff_id)}
                                        >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Create User Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
                        <h2 className="text-lg font-semibold text-foreground mb-4">ユーザー追加</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">名前</label>
                                <input
                                    type="text"
                                    value={newUser.name}
                                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                                    className="w-full rounded-lg border border-border bg-secondary px-3 py-2"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">メール</label>
                                <input
                                    type="email"
                                    value={newUser.email}
                                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                    className="w-full rounded-lg border border-border bg-secondary px-3 py-2"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">パスワード</label>
                                <input
                                    type="password"
                                    value={newUser.password}
                                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                    className="w-full rounded-lg border border-border bg-secondary px-3 py-2"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">ロール</label>
                                <select
                                    value={newUser.role}
                                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                                    className="w-full rounded-lg border border-border bg-secondary px-3 py-2"
                                >
                                    <option value="buyer">バイヤー</option>
                                    <option value="supervisor">スーパーバイザー</option>
                                    <option value="admin">管理者</option>
                                </select>
                            </div>
                            <div className="flex gap-3">
                                <Button variant="outline" onClick={() => setShowCreateModal(false)} className="flex-1">
                                    キャンセル
                                </Button>
                                <Button onClick={createUser} className="flex-1">
                                    作成
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </MainLayout>
    );
}
