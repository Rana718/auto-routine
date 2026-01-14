"use client";

import { useState, useEffect } from "react";
import { Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export function CutoffTimer() {
    const [timeRemaining, setTimeRemaining] = useState<{
        hours: number;
        minutes: number;
        seconds: number;
        isPast: boolean;
    }>({ hours: 0, minutes: 0, seconds: 0, isPast: false });

    useEffect(() => {
        const calculateTimeRemaining = () => {
            const now = new Date();
            const cutoff = new Date();
            cutoff.setHours(13, 10, 0, 0);

            // If past cutoff time, show time until next day's cutoff
            if (now > cutoff) {
                cutoff.setDate(cutoff.getDate() + 1);
            }

            const diff = cutoff.getTime() - now.getTime();
            const isPast = now.getHours() >= 13 && now.getMinutes() >= 10;

            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            setTimeRemaining({ hours, minutes, seconds, isPast });
        };

        calculateTimeRemaining();
        const interval = setInterval(calculateTimeRemaining, 1000);
        return () => clearInterval(interval);
    }, []);

    const isUrgent = timeRemaining.hours === 0 && timeRemaining.minutes < 30;

    return (
        <div
            className={cn(
                "rounded-xl border card-shadow transition-all duration-300",
                "p-3 sm:p-4 md:p-5",
                timeRemaining.isPast
                    ? "bg-muted/50 border-border"
                    : isUrgent
                        ? "bg-warning/10 border-warning/30 animate-pulse-glow"
                        : "bg-primary/10 border-primary/20"
            )}
        >
            <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-3">
                {isUrgent && !timeRemaining.isPast ? (
                    <AlertTriangle className="h-4 w-4 md:h-5 md:w-5 text-warning shrink-0" />
                ) : (
                    <Clock className="h-4 w-4 md:h-5 md:w-5 text-primary shrink-0" />
                )}
                <span className="text-xs sm:text-sm font-medium text-muted-foreground">
                    本日締切 (13:10)
                </span>
            </div>

            {timeRemaining.isPast ? (
                <div className="space-y-1">
                    <p className="text-base md:text-lg font-semibold text-muted-foreground">
                        締切時間を過ぎました
                    </p>
                    <p className="text-xs md:text-sm text-muted-foreground">
                        新規注文は翌営業日のリストに追加されます
                    </p>
                </div>
            ) : (
                <div className="flex items-baseline gap-0.5 sm:gap-1">
                    <span
                        className={cn(
                            "text-2xl sm:text-3xl font-bold font-mono tabular-nums",
                            isUrgent ? "text-warning" : "text-foreground"
                        )}
                    >
                        {String(timeRemaining.hours).padStart(2, "0")}
                    </span>
                    <span className="text-lg sm:text-xl text-muted-foreground">:</span>
                    <span
                        className={cn(
                            "text-2xl sm:text-3xl font-bold font-mono tabular-nums",
                            isUrgent ? "text-warning" : "text-foreground"
                        )}
                    >
                        {String(timeRemaining.minutes).padStart(2, "0")}
                    </span>
                    <span className="text-lg sm:text-xl text-muted-foreground">:</span>
                    <span className="text-lg sm:text-xl font-semibold font-mono tabular-nums text-muted-foreground">
                        {String(timeRemaining.seconds).padStart(2, "0")}
                    </span>
                </div>
            )}
        </div>
    );
}
