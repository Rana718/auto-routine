"use client";

import { ReactNode, useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

interface MainLayoutProps {
    children: ReactNode;
    title: string;
    subtitle?: string;
}

export function MainLayout({ children, title, subtitle }: MainLayoutProps) {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    return (
        <div className="min-h-screen bg-background overflow-x-hidden">
            <Sidebar
                mobileOpen={mobileMenuOpen}
                onMobileClose={() => setMobileMenuOpen(false)}
                onCollapsedChange={setSidebarCollapsed}
            />
            {/* Responsive padding-left based on sidebar state */}
            <div className={`transition-all duration-300 overflow-x-hidden ${sidebarCollapsed ? 'md:pl-16' : 'md:pl-16 lg:pl-64'}`}>
                <Header
                    title={title}
                    subtitle={subtitle}
                    onMenuClick={() => setMobileMenuOpen(true)}
                />
                {/* Responsive padding: smaller on mobile, larger on desktop */}
                <main className="p-3 sm:p-4 md:p-6 overflow-x-hidden">{children}</main>
            </div>
        </div>
    );
}
