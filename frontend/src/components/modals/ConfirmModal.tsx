"use client";

import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2 } from "lucide-react";

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: "default" | "destructive";
    loading?: boolean;
}

export function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = "確認",
    cancelText = "キャンセル",
    variant = "default",
    loading = false,
}: ConfirmModalProps) {
    const handleConfirm = () => {
        onConfirm();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title || "確認"} className="max-w-sm">
            <div className="flex flex-col items-center gap-2 sm:gap-3 py-2 sm:py-3">
                <AlertTriangle className={`h-12 w-12 sm:h-14 sm:w-14 ${variant === "destructive" ? "text-destructive" : "text-warning"}`} />
                <p className="text-center text-sm sm:text-base text-foreground px-2">{message}</p>
            </div>
            <div className="flex justify-center gap-2 sm:gap-3 mt-3 sm:mt-4">
                <Button 
                    variant="outline" 
                    onClick={onClose} 
                    className="min-w-20 h-9 text-sm"
                    disabled={loading}
                >
                    {cancelText}
                </Button>
                <Button
                    variant={variant === "destructive" ? "destructive" : "default"}
                    onClick={handleConfirm}
                    className="min-w-20 h-9 text-sm"
                    disabled={loading}
                >
                    {loading ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                            処理中...
                        </>
                    ) : (
                        confirmText
                    )}
                </Button>
            </div>
        </Modal>
    );
}
