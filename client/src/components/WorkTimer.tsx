import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

export function WorkTimer({ startTime }: { startTime: Date }) {
    const [elapsed, setElapsed] = useState("");

    useEffect(() => {
        const interval = setInterval(() => {
            const now = new Date();
            const diff = now.getTime() - new Date(startTime).getTime();
            
            if (diff < 0) {
                setElapsed("00:00:00");
                return;
            }

            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            setElapsed(
                `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
            );
        }, 1000);

        return () => clearInterval(interval);
    }, [startTime]);

    return (
        <div className="flex flex-col items-center gap-1">
            <div className="bg-white px-5 py-2.5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
                <Clock className="w-4 h-4 text-slate-400" />
                <span className="font-mono text-2xl font-bold text-slate-700 tabular-nums uppercase tracking-tight">
                    {elapsed || "00:00:00"}
                </span>
            </div>
            <p className="text-[9px] text-slate-400 font-medium uppercase tracking-[0.1em] mt-1">Aktif Sekarang</p>
        </div>
    );
}
