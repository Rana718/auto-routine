"use client";

import { useState } from "react";
import { X, Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import toast from "react-hot-toast";
import { useSession } from "next-auth/react";

interface ChangeEmailModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ChangeEmailModal({ isOpen, onClose }: ChangeEmailModalProps) {
    const { data: session, update } = useSession();
    const [newEmail, setNewEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!newEmail || !password) {
            toast.error("すべてのフィールドを入力してください");
            return;
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(newEmail)) {
            toast.error("有効なメールアドレスを入力してください");
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/me/email`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
                body: JSON.stringify({
                    new_email: newEmail,
                    password: password,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || "メールアドレスの更新に失敗しました");
            }

            toast.success("メールアドレスを更新しました");

            // Update session with new email
            await update({
                ...session,
                user: {
                    ...session?.user,
                    email: newEmail,
                },
            });

            setNewEmail("");
            setPassword("");
            onClose();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "エラーが発生しました");
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setNewEmail("");
        setPassword("");
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-card rounded-xl shadow-xl w-full max-w-md border border-border my-auto">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                    <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                        <Mail className="h-5 w-5 text-primary" />
                        メールアドレス変更
                    </h2>
                    <button
                        onClick={handleClose}
                        className="p-1 rounded-lg hover:bg-muted transition-colors"
                        disabled={isLoading}
                    >
                        <X className="h-5 w-5 text-muted-foreground" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Current Email (read-only) */}
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                            現在のメールアドレス
                        </label>
                        <input
                            type="email"
                            value={session?.user?.email || ""}
                            className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-muted-foreground"
                            disabled
                            readOnly
                        />
                    </div>

                    {/* New Email */}
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                            新しいメールアドレス
                        </label>
                        <input
                            type="email"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="新しいメールアドレスを入力"
                            disabled={isLoading}
                            required
                        />
                    </div>

                    {/* Password Confirmation */}
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                            パスワード（確認用）
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="現在のパスワードを入力"
                            disabled={isLoading}
                            required
                        />
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-3 pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleClose}
                            className="flex-1"
                            disabled={isLoading}
                        >
                            キャンセル
                        </Button>
                        <Button
                            type="submit"
                            className="flex-1"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    更新中...
                                </>
                            ) : (
                                "メールアドレスを更新"
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
