"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { X, CheckCircle, AlertTriangle, XCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface Toast {
    id: string;
    type: "success" | "error" | "warning" | "info";
    title: string;
    message?: string;
}

interface ToastContextType {
    showToast: (toast: Omit<Toast, "id">) => void;
    showSuccess: (title: string, message?: string) => void;
    showError: (title: string, message?: string) => void;
    showWarning: (title: string, message?: string) => void;
    showInfo: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    return context;
}

const toastIcons = {
    success: CheckCircle,
    error: XCircle,
    warning: AlertTriangle,
    info: Info,
};

const toastStyles = {
    success: "border-success/30 bg-success/10",
    error: "border-destructive/30 bg-destructive/10",
    warning: "border-warning/30 bg-warning/10",
    info: "border-primary/30 bg-primary/10",
};

const iconStyles = {
    success: "text-success",
    error: "text-destructive",
    warning: "text-warning",
    info: "text-primary",
};

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const showToast = useCallback((toast: Omit<Toast, "id">) => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts((prev) => [...prev, { ...toast, id }]);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            removeToast(id);
        }, 5000);
    }, [removeToast]);

    const showSuccess = useCallback((title: string, message?: string) => {
        showToast({ type: "success", title, message });
    }, [showToast]);

    const showError = useCallback((title: string, message?: string) => {
        showToast({ type: "error", title, message });
    }, [showToast]);

    const showWarning = useCallback((title: string, message?: string) => {
        showToast({ type: "warning", title, message });
    }, [showToast]);

    const showInfo = useCallback((title: string, message?: string) => {
        showToast({ type: "info", title, message });
    }, [showToast]);

    return (
        <ToastContext.Provider value={{ showToast, showSuccess, showError, showWarning, showInfo }}>
            {children}

            {/* Toast Container */}
            <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
                {toasts.map((toast) => {
                    const Icon = toastIcons[toast.type];
                    return (
                        <div
                            key={toast.id}
                            className={cn(
                                "flex items-start gap-3 p-4 rounded-xl border shadow-lg animate-slide-in-right",
                                "bg-card backdrop-blur-xl",
                                toastStyles[toast.type]
                            )}
                        >
                            <Icon className={cn("h-5 w-5 shrink-0 mt-0.5", iconStyles[toast.type])} />
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm text-foreground">{toast.title}</p>
                                {toast.message && (
                                    <p className="text-xs text-muted-foreground mt-0.5">{toast.message}</p>
                                )}
                            </div>
                            <button
                                onClick={() => removeToast(toast.id)}
                                className="text-muted-foreground hover:text-foreground shrink-0"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
}
