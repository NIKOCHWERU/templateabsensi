
import { Attendance } from "@shared/schema";
import { differenceInMinutes, differenceInSeconds } from "date-fns";

export function calculateDuration(start?: string | Date | null, end?: string | Date | null): number {
    if (!start || !end) return 0;

    const startDate = new Date(start);
    startDate.setSeconds(0, 0);
    const endDate = new Date(end);
    endDate.setSeconds(0, 0);

    const diff = differenceInMinutes(endDate, startDate);
    return diff < 0 ? diff + 1440 : diff; // 1440 minutes = 24 hours
}

export function formatDuration(minutes: number): string {
    if (minutes <= 0) return "-";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}j ${m}m`;
}

// Returns total seconds (for break display where sub-minute matters)
export function calculateDurationSeconds(start?: string | Date | null, end?: string | Date | null): number {
    if (!start || !end) return 0;
    const diff = differenceInSeconds(new Date(end), new Date(start));
    return diff < 0 ? diff + 86400 : diff;
}

// Formats seconds: "Xj Ym" for >= 60s, "Z detik" for < 60s
export function formatDurationFull(seconds: number): string {
    if (seconds <= 0) return "-";
    if (seconds < 60) return `${seconds} detik`;
    const mins = Math.floor(seconds / 60);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    return `${h}j ${m}m`;
}


function mergeIntervals(intervals: { start: number; end: number }[]): { start: number; end: number }[] {
    if (intervals.length === 0) return [];
    
    // Sort by start time
    const sorted = [...intervals].sort((a, b) => a.start - b.start);
    const merged = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
        const last = merged[merged.length - 1];
        const current = sorted[i];

        if (current.start <= last.end) {
            // Overlapping intervals, join them
            last.end = Math.max(last.end, current.end);
        } else {
            // Non-overlapping interval, add it to the list
            merged.push(current);
        }
    }
    return merged;
}

export function calculateDailyTotal(records: Attendance[]): {
    totalWorkMins: number;
    totalBreakMins: number;
    netWorkMins: number;
    hasAllCheckOuts: boolean;
} {
    if (records.length === 0) {
        return { totalWorkMins: 0, totalBreakMins: 0, netWorkMins: 0, hasAllCheckOuts: true };
    }

    const workIntervals: { start: number; end: number }[] = [];
    const breakIntervals: { start: number; end: number }[] = [];
    const permitIntervals: { start: number; end: number }[] = [];
    let hasAllCheckOuts = true;

    // Helper to normalize any timestamp to the same base date
    // This allows mergeIntervals to work even if records were recorded on different physical days
    const normalizeTime = (timeValue: string | Date | null | undefined, baseDate: Date) => {
        if (!timeValue) return null;
        const d = new Date(timeValue);
        const base = new Date(baseDate);
        
        // Ensure we use the exact Year-Month-Day from baseDate
        // but the Hour-Minute-Second from timeValue
        const normalized = new Date(
            base.getFullYear(),
            base.getMonth(),
            base.getDate(),
            d.getHours(),
            d.getMinutes(),
            d.getSeconds(),
            d.getMilliseconds()
        );
        return normalized.getTime();
    };

    records.forEach(record => {
        if (!record.checkOut) {
            hasAllCheckOuts = false;
        }

        const baseDate = new Date(record.date);

        if (record.checkIn && record.checkOut) {
            const start = normalizeTime(record.checkIn, baseDate)!;
            let end = normalizeTime(record.checkOut, baseDate)!;
            // Handle overnight wrap (e.g. 21:00 to 02:00 next day)
            // If the checkout time is numerically earlier than checkin on the same normalized day,
            // it means it must be the following calendar day.
            if (end < start) end += 86400000; 
            workIntervals.push({ start, end });
        }

        if (record.breakStart && record.breakEnd) {
            const start = normalizeTime(record.breakStart, baseDate)!;
            let end = normalizeTime(record.breakEnd, baseDate)!;
            if (end < start) end += 86400000;
            breakIntervals.push({ start, end });
        }

        if (record.permitExitAt && record.permitResumeAt) {
            const start = normalizeTime(record.permitExitAt, baseDate)!;
            let end = normalizeTime(record.permitResumeAt, baseDate)!;
            if (end < start) end += 86400000;
            permitIntervals.push({ start, end });
        }
    });

    const mergedWork = mergeIntervals(workIntervals);
    const mergedBreak = mergeIntervals(breakIntervals);
    const mergedPermit = mergeIntervals(permitIntervals);

    const totalWorkMins = mergedWork.reduce((acc, inv) => acc + Math.floor((inv.end - inv.start) / 60000), 0);
    const totalBreakMins = mergedBreak.reduce((acc, inv) => acc + Math.floor((inv.end - inv.start) / 60000), 0);
    const totalPermitMins = mergedPermit.reduce((acc, inv) => acc + Math.floor((inv.end - inv.start) / 60000), 0);

    // Net work = total work time minus break time and permit time
    const netWorkMins = Math.max(0, totalWorkMins - totalBreakMins - totalPermitMins);

    return { totalWorkMins, totalBreakMins, netWorkMins, hasAllCheckOuts };
}
