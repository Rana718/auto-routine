"use client";

import { useState, useRef, useEffect } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadAsExcel } from "@/lib/excel";

interface ExportButtonProps {
    fetchCsv: () => Promise<Response>;
    filenameBase: string;
    onError?: (msg: string) => void;
}

export function ExportButton({ fetchCsv, filenameBase, onError }: ExportButtonProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        if (open) document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [open]);

    async function handleExport(format: "csv" | "excel") {
        setOpen(false);
        try {
            const response = await fetchCsv();
            if (!response.ok) throw new Error("エクスポートに失敗しました");

            if (format === "excel") {
                const text = await response.text();
                downloadAsExcel(text, `${filenameBase}.xlsx`);
            } else {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${filenameBase}.csv`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            }
        } catch (err) {
            onError?.(err instanceof Error ? err.message : "エクスポートに失敗しました");
        }
    }

    return (
        <div ref={ref} className="relative">
            <Button
                variant="outline"
                className="gap-2"
                type="button"
                onClick={() => setOpen(!open)}
            >
                <Download className="h-4 w-4" />
                エクスポート
            </Button>
            {open && (
                <div className="absolute top-full left-0 mt-1 z-50 w-40 rounded-lg border border-border bg-popover shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95">
                    <button
                        onClick={() => handleExport("csv")}
                        className="w-full px-4 py-2.5 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2 transition-colors"
                    >
                        <Download className="h-4 w-4" />
                        CSV
                    </button>
                    <div className="h-px bg-border" />
                    <button
                        onClick={() => handleExport("excel")}
                        className="w-full px-4 py-2.5 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2 transition-colors"
                    >
                        <FileSpreadsheet className="h-4 w-4" />
                        Excel
                    </button>
                </div>
            )}
        </div>
    );
}
