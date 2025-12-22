"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
    LayoutDashboard,
    ShoppingCart,
    Users,
    Store,
    Route,
    Settings,
    ChevronLeft,
    ChevronRight,
    Package,
    LogOut,
    User,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
    { icon: LayoutDashboard, label: "ダッシュボード", path: "/" },
    { icon: ShoppingCart, label: "注文", path: "/orders" },
    { icon: Users, label: "スタッフ", path: "/staff" },
    { icon: Store, label: "店舗", path: "/stores" },
    { icon: Route, label: "ルート", path: "/routes" },
    { icon: Settings, label: "設定", path: "/settings" },
];

export function Sidebar() {
    const [collapsed, setCollapsed] = useState(false);
    const pathname = usePathname();
    const { data: session } = useSession();

    const handleLogout = () => {
        signOut({ callbackUrl: "/signin" });
    };

    return (
        <aside
            className={cn(
                "fixed left-0 top-0 z-40 h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300",
                collapsed ? "w-16" : "w-64"
            )}
        >
            {/* Logo */}
            <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border">
                <div className={cn("flex items-center gap-3", collapsed && "justify-center w-full")}>
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                        <Package className="h-5 w-5" />
                    </div>
                    {!collapsed && (
                        <span className="font-semibold text-sidebar-foreground">
                            買付フロー
                        </span>
                    )}
                </div>
                {!collapsed && (
                    <button
                        onClick={() => setCollapsed(true)}
                        className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex flex-col gap-1 p-3">
                {navItems.map((item) => {
                    const isActive = pathname === item.path;
                    return (
                        <Link
                            key={item.path}
                            href={item.path}
                            className={cn(
                                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                                isActive
                                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md"
                                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                            )}
                        >
                            <item.icon className="h-5 w-5 shrink-0" />
                            {!collapsed && <span>{item.label}</span>}
                        </Link>
                    );
                })}
            </nav>

            {/* Expand button */}
            {collapsed && (
                <button
                    onClick={() => setCollapsed(false)}
                    className="absolute bottom-4 left-1/2 -translate-x-1/2 p-2 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
                >
                    <ChevronRight className="h-4 w-4" />
                </button>
            )}

            {/* User & Logout */}
            {!collapsed && (
                <div className="absolute bottom-4 left-3 right-3 space-y-2">
                    {/* User Info */}
                    {session?.user && (
                        <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 bg-sidebar-accent/50">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                                {session.user.name?.[0] || <User className="h-4 w-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-sidebar-foreground truncate">
                                    {session.user.name}
                                </p>
                                <p className="text-xs text-sidebar-foreground/60 truncate">
                                    {session.user.role === "admin" ? "管理者" : session.user.role === "supervisor" ? "スーパーバイザー" : "バイヤー"}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Logout Button */}
                    <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all duration-200"
                    >
                        <LogOut className="h-5 w-5 shrink-0" />
                        <span>ログアウト</span>
                    </button>
                </div>
            )}
        </aside>
    );
}
