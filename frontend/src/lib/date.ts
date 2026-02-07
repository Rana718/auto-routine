/**
 * Japan Standard Time (JST / Asia/Tokyo) utilities.
 * All date/time operations in this app should use these helpers
 * to ensure consistent JST regardless of the user's browser timezone.
 */

const JST_TIMEZONE = "Asia/Tokyo";

/** Get current time as a Date object adjusted to JST */
export function getJSTNow(): Date {
    return new Date(
        new Date().toLocaleString("en-US", { timeZone: JST_TIMEZONE })
    );
}

/** Get today's date in JST as "YYYY-MM-DD" */
export function getJSTDateString(): string {
    const now = getJSTNow();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

/** Get current year in JST */
export function getJSTYear(): number {
    return getJSTNow().getFullYear();
}

/** Format a date string as Japanese locale with JST timezone (e.g. "2026年2月7日") */
export function formatDateJP(dateStr: string): string {
    return new Date(dateStr + "T00:00:00+09:00").toLocaleDateString("ja-JP", {
        timeZone: JST_TIMEZONE,
    });
}

/** Format a date string with extended options (e.g. weekday) in JST */
export function formatDateJPLong(
    dateStr: string,
    options?: Intl.DateTimeFormatOptions
): string {
    return new Date(dateStr + "T00:00:00+09:00").toLocaleDateString("ja-JP", {
        timeZone: JST_TIMEZONE,
        ...options,
    });
}

/** Format today's date as Japanese display string (e.g. "2026年2月7日") */
export function getJSTDateDisplayString(): string {
    const now = getJSTNow();
    return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
}
