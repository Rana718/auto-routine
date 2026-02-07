"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "react-hot-toast";
import { ToastProvider } from "@/components/ui/toast";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
    return (
        <SessionProvider>
            <Toaster
                position="top-right"
                toastOptions={{
                    duration: 3000,
                    style: {
                        background: 'hsl(var(--card))',
                        color: 'hsl(var(--card-foreground))',
                        border: '1px solid hsl(var(--border))',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                        padding: '16px',
                        borderRadius: '8px',
                        minWidth: '250px',
                    },
                    success: {
                        style: {
                            background: '#10b981',
                            color: '#ffffff',
                            border: '1px solid #059669',
                        },
                        iconTheme: {
                            primary: '#ffffff',
                            secondary: '#10b981',
                        },
                    },
                    error: {
                        style: {
                            background: '#ef4444',
                            color: '#ffffff',
                            border: '1px solid #dc2626',
                        },
                        iconTheme: {
                            primary: '#ffffff',
                            secondary: '#ef4444',
                        },
                    },
                }}
            />
            <ToastProvider>
                {children}
            </ToastProvider>
        </SessionProvider>
    );
}
