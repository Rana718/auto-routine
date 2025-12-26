"use client";

import React, { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
    className?: string;
}

export function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div
                className={cn(
                    "relative z-10 w-full max-w-md max-h-[90vh] overflow-auto",
                    "rounded-xl border border-border bg-card shadow-xl",
                    className
                )}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <h2 className="text-lg font-semibold text-foreground">{title}</h2>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="h-8 w-8"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {/* Body */}
                <div className="p-4">
                    {children}
                </div>
            </div>
        </div>
    );
}

interface FormFieldProps {
    label: string;
    required?: boolean;
    children: ReactNode;
}

export function FormField({ label, required, children }: FormFieldProps) {
    return (
        <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
                {label}
                {required && <span className="text-destructive ml-0.5">*</span>}
            </label>
            {children}
        </div>
    );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> { }

export function Input({ className, ...props }: InputProps) {
    return (
        <input
            className={cn(
                "w-full h-10 rounded-lg border border-border bg-secondary px-3",
                "text-sm text-foreground placeholder:text-muted-foreground",
                "focus:outline-none focus:ring-2 focus:ring-primary",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                className
            )}
            {...props}
        />
    );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    children: ReactNode;
}

export function Select({ className, children, ...props }: SelectProps) {
    return (
        <select
            className={cn(
                "w-full h-10 rounded-lg border border-border bg-secondary px-3",
                "text-sm text-foreground",
                "focus:outline-none focus:ring-2 focus:ring-primary",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                className
            )}
            {...props}
        >
            {children}
        </select>
    );
}
