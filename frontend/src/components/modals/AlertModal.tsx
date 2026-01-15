"use client";

import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle, Info, XCircle } from "lucide-react";

interface AlertModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    message: string;
    type?: "success" | "error" | "info" | "warning";
}

export function AlertModal({ isOpen, onClose, title, message, type = "info" }: AlertModalProps) {
    const iconConfig = {
        success: { Icon: CheckCircle, className: "text-success" },
        error: { Icon: XCircle, className: "text-destructive" },
        info: { Icon: Info, className: "text-primary" },
        warning: { Icon: AlertCircle, className: "text-warning" },
    };

    const { Icon, className } = iconConfig[type];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title || "通知"} className="max-w-sm">
            <div className="flex flex-col items-center gap-2 sm:gap-3 py-2 sm:py-3">
                <Icon className={`h-12 w-12 sm:h-14 sm:w-14 ${className}`} />
                <p className="text-center text-sm sm:text-base text-foreground px-2">{message}</p>
            </div>
            <div className="flex justify-center gap-2 sm:gap-3 mt-3 sm:mt-4">
                <Button onClick={onClose} className="min-w-20 h-9 text-sm">
                    OK
                </Button>
            </div>
        </Modal>
    );
}
