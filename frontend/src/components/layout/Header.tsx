"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Bell, Search, User, Settings, LogOut, X, Clock, AlertTriangle, CheckCircle, Loader2, Mail, Key, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { notificationsApi, NotificationItem } from "@/lib/api";
import { ChangePasswordModal } from "@/components/modals/ChangePasswordModal";
import { ChangeEmailModal } from "@/components/modals/ChangeEmailModal";

interface HeaderProps {
    title: string;
    subtitle?: string;
    onMenuClick?: () => void;
}

export function Header({ title, subtitle, onMenuClick }: HeaderProps) {
    const router = useRouter();
    const { data: session } = useSession();
    const [showNotifications, setShowNotifications] = useState(false);
    const [showProfile, setShowProfile] = useState(false);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [loadingNotifications, setLoadingNotifications] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [showChangePassword, setShowChangePassword] = useState(false);
    const [showChangeEmail, setShowChangeEmail] = useState(false);

    const notifRef = useRef<HTMLDivElement>(null);
    const profileRef = useRef<HTMLDivElement>(null);

    const unreadCount = notifications.filter(n => !n.read).length;

    // Fetch notifications only once on mount (no polling)
    useEffect(() => {
        async function fetchNotifications() {
            try {
                setLoadingNotifications(true);
                const data = await notificationsApi.getAll();
                setNotifications(data);
            } catch (error) {
                console.error("Failed to fetch notifications:", error);
            } finally {
                setLoadingNotifications(false);
            }
        }

        fetchNotifications();
    }, []); // Only run once on mount

    // Close dropdowns when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
                setShowNotifications(false);
            }
            if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
                setShowProfile(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && searchQuery.trim()) {
            router.push(`/orders?search=${encodeURIComponent(searchQuery.trim())}`);
        }
    };

    const markAllRead = () => {
        setNotifications(notifications.map(n => ({ ...n, read: true })));
    };

    const handleLogout = () => {
        signOut({ callbackUrl: "/signin" });
    };

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case "warning": return <AlertTriangle className="h-4 w-4 text-warning" />;
            case "success": return <CheckCircle className="h-4 w-4 text-success" />;
            default: return <Clock className="h-4 w-4 text-primary" />;
        }
    };

    return (
        <header className="sticky top-0 z-30 flex h-14 md:h-16 items-center justify-between border-b border-border bg-background/80 backdrop-blur-xl px-3 sm:px-4 md:px-6">
            <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
                {/* Hamburger menu for mobile */}
                {onMenuClick && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="md:hidden shrink-0"
                        onClick={onMenuClick}
                    >
                        <Menu className="h-5 w-5" />
                    </Button>
                )}
                <div className="min-w-0">
                    <p className="text-base md:text-xl font-semibold text-foreground truncate">{title}</p>
                    {subtitle && (
                        <p className="text-xs md:text-sm text-muted-foreground truncate hidden sm:block">{subtitle}</p>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 shrink-0">
                {/* Search - hidden on mobile, shown on md+ */}
                <div className="relative hidden lg:block">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={handleSearch}
                        placeholder="注文・店舗を検索..."
                        className="h-9 w-48 xl:w-64 rounded-lg border border-border bg-secondary pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background transition-all"
                    />
                </div>

                {/* Notifications Dropdown */}
                <div className="relative" ref={notifRef}>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="relative"
                        onClick={() => {
                            setShowNotifications(!showNotifications);
                            setShowProfile(false);
                        }}
                    >
                        <Bell className="h-5 w-5" />
                        {unreadCount > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
                                {unreadCount}
                            </span>
                        )}
                    </Button>

                    {showNotifications && (
                        <div className="absolute right-0 top-full mt-2 w-[calc(100vw-1rem)] sm:w-96 max-w-md rounded-xl border border-border bg-card shadow-lg overflow-hidden z-50">
                            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
                                <p className="font-semibold text-sm">通知</p>
                                {unreadCount > 0 && (
                                    <button
                                        onClick={markAllRead}
                                        className="text-xs text-primary hover:underline"
                                    >
                                        すべて既読にする
                                    </button>
                                )}
                            </div>
                            <div className="max-h-80 overflow-y-auto">
                                {notifications.length === 0 ? (
                                    <p className="text-center text-muted-foreground py-6 text-sm">通知はありません</p>
                                ) : (
                                    notifications.map((notif) => (
                                        <div
                                            key={notif.id}
                                            className={cn(
                                                "flex gap-3 px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer border-b border-border last:border-0",
                                                !notif.read && "bg-primary/5"
                                            )}
                                        >
                                            <div className="shrink-0 mt-0.5">
                                                {getNotificationIcon(notif.type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-foreground">{notif.title}</p>
                                                <p className="text-xs text-muted-foreground truncate">{notif.message}</p>
                                                <p className="text-xs text-muted-foreground/60 mt-1">{notif.time}</p>
                                            </div>
                                            {!notif.read && (
                                                <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* User Profile Dropdown */}
                <div className="relative" ref={profileRef}>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                            setShowProfile(!showProfile);
                            setShowNotifications(false);
                        }}
                    >
                        <User className="h-5 w-5" />
                    </Button>

                    {showProfile && (
                        <div className="absolute right-0 top-full mt-2 w-[calc(100vw-1rem)] sm:w-72 md:w-64 max-w-sm rounded-xl border border-border bg-card shadow-lg overflow-hidden z-50">
                            {/* User Info */}
                            <div className="px-4 py-3 border-b border-border bg-muted/30">
                                <p className="font-medium text-sm text-foreground truncate">{session?.user?.name || "ユーザー"}</p>
                                <p className="text-xs text-muted-foreground truncate">{session?.user?.email}</p>
                                <p className="text-xs text-primary mt-1 truncate">
                                    {session?.user?.role === "admin" ? "管理者" :
                                        session?.user?.role === "supervisor" ? "スーパーバイザー" : "バイヤー"}
                                </p>
                            </div>

                            {/* Menu Items */}
                            <div className="py-1">
                                <button
                                    onClick={() => {
                                        setShowChangeEmail(true);
                                        setShowProfile(false);
                                    }}
                                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-foreground hover:bg-muted/50 transition-colors"
                                >
                                    <Mail className="h-4 w-4" />
                                    メールアドレス変更
                                </button>
                                <button
                                    onClick={() => {
                                        setShowChangePassword(true);
                                        setShowProfile(false);
                                    }}
                                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-foreground hover:bg-muted/50 transition-colors"
                                >
                                    <Key className="h-4 w-4" />
                                    パスワード変更
                                </button>
                                <button
                                    onClick={handleLogout}
                                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-destructive hover:bg-muted/50 transition-colors"
                                >
                                    <LogOut className="h-4 w-4" />
                                    ログアウト
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            <ChangePasswordModal
                isOpen={showChangePassword}
                onClose={() => setShowChangePassword(false)}
            />
            <ChangeEmailModal
                isOpen={showChangeEmail}
                onClose={() => setShowChangeEmail(false)}
            />
        </header>
    );
}
