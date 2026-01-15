"use client";

import { useState } from "react";
import { X, Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import toast from "react-hot-toast";

interface ChangePasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!currentPassword || !newPassword || !confirmPassword) {
            toast.error("すべてのフィールドを入力してください");
            return;
        }

        if (newPassword.length < 6) {
            toast.error("新しいパスワードは6文字以上で入力してください");
            return;
        }

        if (newPassword !== confirmPassword) {
            toast.error("新しいパスワードが一致しません");
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/me/password`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
                body: JSON.stringify({
                    current_password: currentPassword,
                    new_password: newPassword,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || "パスワードの更新に失敗しました");
            }

            toast.success("パスワードを更新しました");
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            onClose();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "エラーが発生しました");
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4">
            <div className="bg-card rounded-xl shadow-xl w-full max-w-md max-h-[90vh] border border-border my-auto flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border flex-shrink-0">
                    <h2 className="text-base sm:text-lg font-semibold text-foreground flex items-center gap-2">
                        <Lock className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                        パスワード変更
                    </h2>
                    <button
                        onClick={handleClose}
                        className="p-1 rounded-lg hover:bg-muted transition-colors"
                        disabled={isLoading}
                    >
                        <X className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-3 sm:p-4 space-y-2 overflow-y-auto flex-1">
                    {/* Current Password */}
                    <div>
                        <label className="block text-xs sm:text-sm font-medium text-foreground mb-1">
                            現在のパスワード
                        </label>
                        <input
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-sm bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="現在のパスワードを入力"
                            disabled={isLoading}
                            required
                        />
                    </div>

                    {/* New Password */}
                    <div>
                        <label className="block text-xs sm:text-sm font-medium text-foreground mb-1">
                            新しいパスワード
                        </label>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-sm bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="新しいパスワード（6文字以上）"
                            disabled={isLoading}
                            required
                            minLength={6}
                        />
                    </div>

                    {/* Confirm Password */}
                    <div>
                        <label className="block text-xs sm:text-sm font-medium text-foreground mb-1">
                            新しいパスワード（確認）
                        </label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-sm bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="新しいパスワードを再入力"
                            disabled={isLoading}
                            required
                        />
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-2 pt-1">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleClose}
                            className="flex-1 h-9 text-sm"
                            disabled={isLoading}
                        >
                            キャンセル
                        </Button>
                        <Button
                            type="submit"
                            className="flex-1 h-9 text-sm"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    更新中...
                                </>
                            ) : (
                                "更新"
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
