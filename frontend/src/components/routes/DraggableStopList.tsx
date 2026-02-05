"use client";

import { useState, useEffect } from "react";
import { MapPin, Clock, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StopStatus } from "@/lib/types";
import toast from "react-hot-toast";

const stopStatusConfig: Record<StopStatus, string> = {
    pending: "border-border bg-muted/30",
    current: "border-primary bg-primary/10",
    completed: "border-success/30 bg-success/10",
    skipped: "border-warning/30 bg-warning/10",
};

interface Stop {
    stop_id: number;
    store_id: number;
    store_name?: string;
    store_address?: string;
    stop_sequence: number;
    stop_status: string;
    items_count: number;
    total_quantity?: number;
    estimated_arrival: string | null;
}

interface DraggableStopListProps {
    stops: Stop[];
    routeId: number;
    onStopUpdate: (stopId: number, newStatus: string) => Promise<void>;
    onReorder: (stopIds: number[]) => Promise<void>;
    canEdit: boolean;
}

export function DraggableStopList({ 
    stops, 
    routeId, 
    onStopUpdate, 
    onReorder,
    canEdit 
}: DraggableStopListProps) {
    const [orderedStops, setOrderedStops] = useState<Stop[]>(stops);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [isReordering, setIsReordering] = useState(false);

    // Update local state when props change
    useEffect(() => {
        setOrderedStops(stops);
    }, [stops]);

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
        if (!canEdit) return;
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/html", e.currentTarget.innerHTML);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
        if (!canEdit || draggedIndex === null) return;
        e.preventDefault();
        setHoveredIndex(index);
    };

    const handleDrop = async (e: React.DragEvent<HTMLDivElement>, dropIndex: number) => {
        if (!canEdit || draggedIndex === null || draggedIndex === dropIndex) {
            setDraggedIndex(null);
            setHoveredIndex(null);
            return;
        }

        e.preventDefault();

        // Reorder the stops array
        const newStops = [...orderedStops];
        const [draggedStop] = newStops.splice(draggedIndex, 1);
        newStops.splice(dropIndex, 0, draggedStop);

        setOrderedStops(newStops);
        setDraggedIndex(null);
        setHoveredIndex(null);

        // Save to backend
        setIsReordering(true);
        try {
            const stopIds = newStops.map(stop => stop.stop_id);
            await onReorder(stopIds);
            toast.success("ルートを並び替えました");
        } catch (err) {
            // Revert on error
            setOrderedStops(stops);
            toast.error(err instanceof Error ? err.message : "並び替えに失敗しました");
        } finally {
            setIsReordering(false);
        }
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
        setHoveredIndex(null);
    };

    if (orderedStops.length === 0) {
        return (
            <p className="text-muted-foreground text-center py-8">
                このルートには店舗がありません
            </p>
        );
    }

    return (
        <div className="space-y-3">
            {orderedStops.map((stop, index) => (
                <div
                    key={stop.stop_id}
                    draggable={canEdit}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                        "flex items-center gap-2 sm:gap-4 p-3 sm:p-4 rounded-lg border-l-4 transition-all",
                        stopStatusConfig[stop.stop_status as StopStatus] || stopStatusConfig.pending,
                        canEdit && "cursor-move",
                        draggedIndex === index && "opacity-50",
                        hoveredIndex === index && draggedIndex !== null && draggedIndex !== index && "border-t-2 border-t-primary",
                        isReordering && "pointer-events-none opacity-60"
                    )}
                >
                    {/* Drag Handle */}
                    {canEdit && (
                        <div className="text-muted-foreground hover:text-foreground transition-colors">
                            <GripVertical className="h-5 w-5" />
                        </div>
                    )}

                    {/* Checkbox */}
                    <input
                        type="checkbox"
                        checked={stop.stop_status === "completed"}
                        onChange={async () => {
                            try {
                                const newStatus = stop.stop_status === "completed" ? "pending" : "completed";
                                await onStopUpdate(stop.stop_id, newStatus);
                                toast.success(newStatus === "completed" ? "訪問を完了にしました" : "訪問を未完了に戻しました");
                            } catch (err) {
                                toast.error(err instanceof Error ? err.message : "更新に失敗しました");
                            }
                        }}
                        className="h-6 w-6 rounded border-2 border-primary cursor-pointer"
                    />

                    {/* Step Number */}
                    <div
                        className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold shrink-0",
                            stop.stop_status === "completed"
                                ? "bg-success text-success-foreground"
                                : stop.stop_status === "current"
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted text-muted-foreground"
                        )}
                    >
                        {index + 1}
                    </div>

                    {/* Store Info */}
                    <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate sm:whitespace-normal">
                            {stop.store_name || `店舗 #${stop.store_id}`}
                        </p>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-xs sm:text-sm text-muted-foreground mt-0.5">
                            {stop.store_address && (
                                <span className="flex items-center gap-1 truncate">
                                    <MapPin className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{stop.store_address}</span>
                                </span>
                            )}
                            {stop.estimated_arrival && (
                                <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {new Date(stop.estimated_arrival).toLocaleTimeString("ja-JP", { 
                                        hour: "2-digit", 
                                        minute: "2-digit" 
                                    })}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Quantity Count */}
                    <div className="text-right shrink-0">
                        <p className="text-lg font-bold text-foreground">{stop.total_quantity || stop.items_count}</p>
                        <p className="text-xs text-muted-foreground">個</p>
                    </div>
                </div>
            ))}
        </div>
    );
}
