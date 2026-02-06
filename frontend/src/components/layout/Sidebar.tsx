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
    Shield,
    Box,
    MapPin,
    ClipboardCheck,
    X,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Navigation items for buyers (field staff) - minimal view
const buyerNavItems = [
    { icon: LayoutDashboard, label: "ダッシュボード", path: "/" },
    { icon: MapPin, label: "今日のルート", path: "/routes/my-route" },
    { icon: ClipboardCheck, label: "買付状況", path: "/routes" },
];

// Navigation items for admin/supervisor - full management view
const adminNavItems = [
    { icon: LayoutDashboard, label: "ダッシュボード", path: "/" },
    { icon: ShoppingCart, label: "注文", path: "/orders" },
    { icon: Users, label: "スタッフ", path: "/staff" },
    { icon: Store, label: "店舗", path: "/stores" },
    { icon: Package, label: "商品", path: "/products" },
    { icon: Box, label: "セット商品", path: "/products/bundles" },
    { icon: Route, label: "ルート", path: "/routes" },
    // { icon: Settings, label: "設定", path: "/settings" },
];


interface SidebarProps {
    mobileOpen: boolean;
    onMobileClose: () => void;
    onCollapsedChange?: (collapsed: boolean) => void;
}

export function Sidebar({ mobileOpen, onMobileClose, onCollapsedChange }: SidebarProps) {
    const [collapsed, setCollapsed] = useState(false);
    const pathname = usePathname();
    const { data: session } = useSession();

    const userRole = session?.user?.role || "buyer";
    const isAdmin = userRole === "admin" || userRole === "supervisor";
    
    // Debug logging to help troubleshoot role issues
    console.log("Sidebar - User Role:", userRole, "Is Admin:", isAdmin, "Session:", session?.user);

    // Choose nav items based on role
    const navItems = isAdmin ? adminNavItems : buyerNavItems;

    const handleLogout = () => {
        signOut({ callbackUrl: "/signin" });
    };

    const handleToggleCollapse = () => {
        setCollapsed(!collapsed);
        onCollapsedChange?.(!collapsed);
    };

    return (
        <>
            {/* Mobile backdrop overlay */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 z-30 bg-black/50 md:hidden"
                    onClick={onMobileClose}
                />
            )}

            <aside
                className={cn(
                    "fixed left-0 top-0 z-40 h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300",
                    // Mobile: hidden by default, full-width when open
                    "max-md:-translate-x-full max-md:w-64",
                    mobileOpen && "max-md:translate-x-0",
                    // Tablet and desktop: always visible
                    collapsed ? "md:w-16" : "md:w-64"
                )}
            >
                {/* Logo */}
                <div className={cn(
                    "flex h-16 items-center border-b border-sidebar-border",
                    collapsed ? "justify-center px-2" : "justify-between px-3 md:px-4"
                )}>
                    {collapsed ? (
                        // Collapsed state: Just logo icon, clickable to expand
                        <button
                            onClick={handleToggleCollapse}
                            className="hidden md:flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                            title="サイドバーを展開"
                        >
                            <Package className="h-4 w-4" />
                        </button>
                    ) : (
                        // Expanded state: Logo + text + buttons
                        <>
                            <div className="flex items-center gap-2 md:gap-3">
                                <div className="flex h-8 w-8 md:h-9 md:w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                                    <Package className="h-4 w-4 md:h-5 md:w-5" />
                                </div>
                                <span className="font-semibold text-sm md:text-base text-sidebar-foreground">
                                    買付フロー
                                </span>
                            </div>

                            {/* Close button for mobile */}
                            <button
                                onClick={onMobileClose}
                                className="md:hidden p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors touch-target"
                                aria-label="閉じる"
                            >
                                <X className="h-5 w-5" />
                            </button>

                            {/* Collapse button for desktop */}
                            <button
                                onClick={handleToggleCollapse}
                                className="hidden md:block p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
                                aria-label="サイドバーを折りたたむ"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                        </>
                    )}
                </div>

                {/* Navigation */}
                <nav className="flex flex-col gap-1 p-2 md:p-3">
                    {navItems.map((item) => {
                        const isActive = pathname === item.path;
                        return (
                            <Link
                                key={item.path}
                                href={item.path}
                                onClick={onMobileClose}
                                className={cn(
                                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 touch-target",
                                    isActive
                                        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md"
                                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                                    collapsed && "md:justify-center md:px-2"
                                )}
                            >
                                <item.icon className="h-5 w-5 shrink-0" />
                                {/* Show label on mobile always, hide on desktop only when collapsed */}
                                <span className={cn(collapsed && "md:hidden")}>{item.label}</span>
                            </Link>
                        );
                    })}

                </nav>


                {/* User & Logout - always show */}
                <div className="absolute bottom-3 md:bottom-4 left-2 md:left-3 right-2 md:right-3 space-y-2">
                    {/* User Info */}
                    {session?.user && (
                        <div className={cn(
                            "flex items-center gap-2 md:gap-3 rounded-lg px-2 md:px-3 py-2 md:py-2.5 bg-sidebar-accent/50",
                            collapsed && "md:justify-center md:px-2"
                        )}>
                            <div className="flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs md:text-sm font-medium shrink-0">
                                {session.user.name?.[0] || <User className="h-3 w-3 md:h-4 md:w-4" />}
                            </div>
                            {/* Show on mobile always, hide on desktop when collapsed */}
                            <div className={cn("flex-1 min-w-0", collapsed && "md:hidden")}>
                                <p className="text-xs md:text-sm font-medium text-sidebar-foreground truncate">
                                    {session.user.name}
                                </p>
                                <p className="text-xs text-sidebar-foreground/60 flex items-center gap-1">
                                    <Shield className="h-3 w-3" />
                                    {session.user.role === "admin" ? "管理者" :
                                        session.user.role === "supervisor" ? "スーパーバイザー" : "バイヤー"}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Logout Button */}
                    <button
                        onClick={handleLogout}
                        className={cn(
                            "w-full flex items-center gap-2 md:gap-3 rounded-lg px-2 md:px-3 py-2 md:py-2.5 text-xs md:text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all touch-target",
                            collapsed && "md:justify-center md:px-2"
                        )}
                    >
                        <LogOut className="h-4 w-4 md:h-5 md:w-5 shrink-0" />
                        {/* Show on mobile always, hide on desktop when collapsed */}
                        <span className={cn(collapsed && "md:hidden")}>ログアウト</span>
                    </button>
                </div>
            </aside>
        </>
    );
}
