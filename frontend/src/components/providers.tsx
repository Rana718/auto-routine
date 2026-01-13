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
                    },
                }}
            />
            <ToastProvider>
                {children}
            </ToastProvider>
        </SessionProvider>
    );
}
