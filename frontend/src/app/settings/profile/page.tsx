"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { authApi } from "@/lib/api";
import type { UpdateEmailRequest, UpdatePasswordRequest } from "@/lib/api";

export default function ProfilePage() {
    const { data: session, update } = useSession();
    const [emailForm, setEmailForm] = useState({
        new_email: "",
        password: "",
    });
    const [passwordForm, setPasswordForm] = useState({
        current_password: "",
        new_password: "",
        confirm_password: "",
    });
    const [emailLoading, setEmailLoading] = useState(false);
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [emailMessage, setEmailMessage] = useState<{
        type: "success" | "error";
        text: string;
    } | null>(null);
    const [passwordMessage, setPasswordMessage] = useState<{
        type: "success" | "error";
        text: string;
    } | null>(null);

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setEmailMessage(null);
        setEmailLoading(true);

        try {
            const result = await authApi.updateEmail(emailForm);
            setEmailMessage({ type: "success", text: result.message });
            setEmailForm({ new_email: "", password: "" });

            // Update session with new email
            await update({
                ...session,
                user: {
                    ...session?.user,
                    email: result.email,
                },
            });
        } catch (error: any) {
            setEmailMessage({
                type: "error",
                text: error.message || "メールアドレスの更新に失敗しました",
            });
        } finally {
            setEmailLoading(false);
        }
    };

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordMessage(null);

        // Validate passwords match
        if (passwordForm.new_password !== passwordForm.confirm_password) {
            setPasswordMessage({
                type: "error",
                text: "新しいパスワードが一致しません",
            });
            return;
        }

        // Validate password length
        if (passwordForm.new_password.length < 6) {
            setPasswordMessage({
                type: "error",
                text: "パスワードは6文字以上である必要があります",
            });
            return;
        }

        setPasswordLoading(true);

        try {
            const result = await authApi.updatePassword({
                current_password: passwordForm.current_password,
                new_password: passwordForm.new_password,
            });
            setPasswordMessage({ type: "success", text: result.message });
            setPasswordForm({
                current_password: "",
                new_password: "",
                confirm_password: "",
            });
        } catch (error: any) {
            setPasswordMessage({
                type: "error",
                text: error.message || "パスワードの更新に失敗しました",
            });
        } finally {
            setPasswordLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">プロフィール設定</h1>

            {/* User Info */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-lg font-semibold mb-4">アカウント情報</h2>
                <div className="space-y-2 text-sm">
                    <div className="flex">
                        <span className="w-32 text-gray-600">名前:</span>
                        <span className="font-medium">{session?.user?.name}</span>
                    </div>
                    <div className="flex">
                        <span className="w-32 text-gray-600">メール:</span>
                        <span className="font-medium">{session?.user?.email}</span>
                    </div>
                    <div className="flex">
                        <span className="w-32 text-gray-600">役割:</span>
                        <span className="font-medium capitalize">{session?.user?.role}</span>
                    </div>
                </div>
            </div>

            {/* Email Change Form */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-lg font-semibold mb-4">メールアドレスの変更</h2>
                <form onSubmit={handleEmailSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="new_email" className="block text-sm font-medium text-gray-700 mb-1">
                            新しいメールアドレス
                        </label>
                        <input
                            type="email"
                            id="new_email"
                            value={emailForm.new_email}
                            onChange={(e) =>
                                setEmailForm({ ...emailForm, new_email: e.target.value })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                            disabled={emailLoading}
                        />
                    </div>
                    <div>
                        <label htmlFor="email_password" className="block text-sm font-medium text-gray-700 mb-1">
                            現在のパスワード（確認用）
                        </label>
                        <input
                            type="password"
                            id="email_password"
                            value={emailForm.password}
                            onChange={(e) =>
                                setEmailForm({ ...emailForm, password: e.target.value })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                            disabled={emailLoading}
                        />
                    </div>
                    {emailMessage && (
                        <div
                            className={`p-3 rounded-md text-sm ${emailMessage.type === "success"
                                    ? "bg-green-50 text-green-800 border border-green-200"
                                    : "bg-red-50 text-red-800 border border-red-200"
                                }`}
                        >
                            {emailMessage.text}
                        </div>
                    )}
                    <button
                        type="submit"
                        disabled={emailLoading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {emailLoading ? "更新中..." : "メールアドレスを更新"}
                    </button>
                </form>
            </div>

            {/* Password Change Form */}
            <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4">パスワードの変更</h2>
                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="current_password" className="block text-sm font-medium text-gray-700 mb-1">
                            現在のパスワード
                        </label>
                        <input
                            type="password"
                            id="current_password"
                            value={passwordForm.current_password}
                            onChange={(e) =>
                                setPasswordForm({ ...passwordForm, current_password: e.target.value })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                            disabled={passwordLoading}
                        />
                    </div>
                    <div>
                        <label htmlFor="new_password" className="block text-sm font-medium text-gray-700 mb-1">
                            新しいパスワード
                        </label>
                        <input
                            type="password"
                            id="new_password"
                            value={passwordForm.new_password}
                            onChange={(e) =>
                                setPasswordForm({ ...passwordForm, new_password: e.target.value })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                            minLength={6}
                            disabled={passwordLoading}
                        />
                        <p className="text-xs text-gray-500 mt-1">6文字以上</p>
                    </div>
                    <div>
                        <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-700 mb-1">
                            新しいパスワード（確認）
                        </label>
                        <input
                            type="password"
                            id="confirm_password"
                            value={passwordForm.confirm_password}
                            onChange={(e) =>
                                setPasswordForm({ ...passwordForm, confirm_password: e.target.value })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                            minLength={6}
                            disabled={passwordLoading}
                        />
                    </div>
                    {passwordMessage && (
                        <div
                            className={`p-3 rounded-md text-sm ${passwordMessage.type === "success"
                                    ? "bg-green-50 text-green-800 border border-green-200"
                                    : "bg-red-50 text-red-800 border border-red-200"
                                }`}
                        >
                            {passwordMessage.text}
                        </div>
                    )}
                    <button
                        type="submit"
                        disabled={passwordLoading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {passwordLoading ? "更新中..." : "パスワードを更新"}
                    </button>
                </form>
            </div>
        </div>
    );
}
