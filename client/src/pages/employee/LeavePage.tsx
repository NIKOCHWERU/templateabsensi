import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LeaveRequest } from "@shared/schema";
import { CompanyHeader } from "@/components/CompanyHeader";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
    format, isBefore, startOfDay, isSameDay, isSameMonth,
    startOfMonth, endOfMonth, eachDayOfInterval,
    addMonths, subMonths
} from "date-fns";
import { id } from "date-fns/locale";
import { useState } from "react";
import { Loader2, Calendar as CalendarIcon, History, Send, Info, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "@shared/routes";

// ─── Custom Leave Calendar ────────────────────────────────────────────────────
function LeaveCalendar({
    selected,
    onSelect,
    max = 12,
}: {
    selected: Date[];
    onSelect: (dates: Date[]) => void;
    max?: number;
}) {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    // Monday-first padding
    const startPad = (monthStart.getDay() + 6) % 7;

    const today = startOfDay(new Date());

    const isSelected = (day: Date) => selected.some(d => isSameDay(d, day));
    const isPast = (day: Date) => isBefore(day, today);

    const toggle = (day: Date) => {
        if (isPast(day)) return;
        if (isSelected(day)) {
            onSelect(selected.filter(d => !isSameDay(d, day)));
        } else {
            if (selected.length >= max) return;
            onSelect([...selected, day]);
        }
    };

    return (
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-50">
                <div className="flex items-center gap-2 bg-gray-50 rounded-full p-1 border border-gray-100">
                    <button
                        onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                        className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4 text-gray-600" />
                    </button>
                    <span className="px-2 font-black text-gray-700 min-w-[130px] text-center text-xs uppercase tracking-wider">
                        {format(currentMonth, "MMMM yyyy", { locale: id })}
                    </span>
                    <button
                        onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                        className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
                    >
                        <ChevronRight className="w-4 h-4 text-gray-600" />
                    </button>
                </div>

                {selected.length > 0 && (
                    <div className="flex items-center gap-2">
                        <span className="bg-primary text-white text-xs font-bold px-2.5 py-1 rounded-full">
                            {selected.length}/{max}
                        </span>
                        <button
                            onClick={() => onSelect([])}
                            className="text-[10px] font-bold text-red-500 hover:text-red-700 uppercase tracking-wider"
                        >
                            Reset
                        </button>
                    </div>
                )}
            </div>

            {/* Day names */}
            <div className="grid grid-cols-7 gap-px bg-gray-100">
                {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map(d => (
                    <div key={d} className="bg-gray-50 py-2 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        {d}
                    </div>
                ))}

                {/* Padding */}
                {Array.from({ length: startPad }).map((_, i) => (
                    <div key={`pad-${i}`} className="bg-white min-h-[52px]" />
                ))}

                {/* Days */}
                {days.map(day => {
                    const sel = isSelected(day);
                    const past = isPast(day);
                    const todayDay = isSameDay(day, today);
                    const isCurrentMonth = isSameMonth(day, currentMonth);

                    return (
                        <div
                            key={day.toISOString()}
                            onClick={() => toggle(day)}
                            className={`
                                relative min-h-[52px] p-1.5 flex flex-col items-center justify-start cursor-pointer transition-all group
                                ${past ? 'opacity-30 cursor-not-allowed bg-white' : 'bg-white hover:bg-orange-50/40'}
                                ${sel ? 'bg-orange-50 ring-2 ring-inset ring-primary z-10' : ''}
                            `}
                        >
                            <span className={`
                                text-xs font-bold w-7 h-7 flex items-center justify-center rounded-full transition-all
                                ${todayDay ? 'bg-primary text-white shadow-md' : ''}
                                ${sel && !todayDay ? 'bg-primary/10 text-primary' : ''}
                                ${!sel && !todayDay ? 'text-gray-700 group-hover:bg-orange-100' : ''}
                            `}>
                                {format(day, 'd')}
                            </span>
                            {sel && (
                                <span className="mt-1 text-[8px] font-black text-primary uppercase tracking-wider">Dipilih</span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
// ─────────────────────────────────────────────────────────────────────────────

export default function LeavePage() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [selectedDates, setSelectedDates] = useState<Date[]>([]);
    const [reason, setReason] = useState("");

    const { data: balance, isLoading: isLoadingBalance } = useQuery<{ used: number, remaining: number, limit: number }>({
        queryKey: [api.leave.balance.path],
        queryFn: async () => {
            const res = await fetch(api.leave.balance.path, { credentials: 'include' });
            if (!res.ok) throw new Error("Gagal memuat saldo cuti");
            return res.json();
        },
        refetchInterval: 3000,
    });

    const { data: requests, isLoading: isLoadingRequests } = useQuery<LeaveRequest[]>({
        queryKey: [api.leave.list.path],
        queryFn: async () => {
            const res = await fetch(api.leave.list.path, { credentials: 'include' });
            if (!res.ok) throw new Error("Gagal memuat riwayat cuti");
            return res.json();
        },
        refetchInterval: 3000,
    });

    const mutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch(api.leave.create.path, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
                credentials: 'include',
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || "Gagal mengajukan cuti");
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [api.leave.list.path], exact: true });
            queryClient.invalidateQueries({ queryKey: [api.leave.balance.path], exact: true });
            setSelectedDates([]);
            setReason("");
            toast({
                title: "Berhasil",
                description: "Permohonan cuti Anda telah dikirim.",
            });
        },
        onError: (err: any) => {
            toast({
                title: "Gagal",
                description: err.message,
                variant: "destructive",
            });
        }
    });

    const cancelMutation = useMutation({
        mutationFn: async (id: number) => {
            const res = await fetch(api.leave.cancel.path.replace(':id', id.toString()), {
                method: 'POST',
                credentials: 'include',
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || "Gagal membatalkan cuti");
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [api.leave.list.path], exact: true });
            queryClient.invalidateQueries({ queryKey: [api.leave.balance.path], exact: true });
            toast({
                title: "Dibatalkan",
                description: "Permohonan cuti telah dibatalkan.",
            });
        },
        onError: (err: any) => {
            toast({
                title: "Gagal",
                description: err.message,
                variant: "destructive",
            });
        }
    });

    const handleApply = () => {
        if (!selectedDates || selectedDates.length === 0) {
            return toast({ title: "Pilih Tanggal", description: "Mohon pilih minimal satu tanggal cuti.", variant: "destructive" });
        }
        if (!reason.trim()) {
            return toast({ title: "Isi Alasan", description: "Mohon masukkan alasan cuti Anda.", variant: "destructive" });
        }

        const sortedDates = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());
        mutation.mutate({
            startDate: format(sortedDates[0], "yyyy-MM-dd"),
            endDate: format(sortedDates[sortedDates.length - 1], "yyyy-MM-dd"),
            selectedDates: sortedDates.map(d => format(d, "yyyy-MM-dd")),
            reason,
        });
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'approved': return 'text-primary bg-primary/5 border-primary/10';
            case 'rejected': return 'text-red-600 bg-red-50 border-red-100';
            default: return 'text-orange-600 bg-orange-50 border-orange-100';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'approved': return 'Disetujui';
            case 'rejected': return 'Ditolak';
            case 'cancelled': return 'Dibatalkan';
            default: return 'Menunggu';
        }
    };


    return (
        <div className="min-h-screen bg-gray-50 pb-24">
            <CompanyHeader title="Cuti Karyawan" />

            <main className="p-4 -mt-6 space-y-4 max-w-lg mx-auto">
                {/* Balance Card */}
                <Card className="border border-slate-100 shadow-sm bg-white text-slate-800 rounded-3xl overflow-hidden">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-slate-400 text-sm font-semibold">Sisa Kuota Cuti</p>
                                <h2 className="text-4xl font-black mt-1 normal-case text-slate-800">
                                    {isLoadingBalance ? "..." : balance?.remaining} <span className="text-lg font-medium text-slate-400 normal-case">Hari</span>
                                </h2>
                            </div>
                            <div className="bg-primary/10 p-3 rounded-2xl text-primary">
                                <CalendarIcon className="w-6 h-6" />
                            </div>
                        </div>
                        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                            <div>
                                <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Telah Digunakan</p>
                                <p className="text-xl font-bold text-slate-800 normal-case">{balance?.used} Hari</p>
                            </div>
                            <div>
                                <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Total Jatah</p>
                                <p className="text-xl font-bold text-slate-800 normal-case">{balance?.limit} Hari</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Apply Section */}
                <Card className="rounded-3xl border-none shadow-sm overflow-hidden">
                    <CardHeader className="bg-white pb-2 px-6 pt-6">
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                            <CalendarIcon className="w-5 h-5 text-primary" />
                            Pilih Tanggal Cuti
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                        <LeaveCalendar
                            selected={selectedDates}
                            onSelect={setSelectedDates}
                            max={balance?.remaining ?? 12}
                        />

                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-gray-400 ml-1">Alasan Cuti</label>
                            <Textarea
                                placeholder="Misal: Keperluan Keluarga, Liburan, dll..."
                                className="rounded-2xl border-gray-100 bg-gray-50 focus:bg-white transition-all h-24 resize-none"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                            />
                        </div>

                        <Button
                            className="w-full bg-primary hover:bg-primary/90 text-white rounded-2xl h-14 font-bold shadow-lg shadow-primary/20 gap-2"
                            onClick={handleApply}
                            disabled={mutation.isPending}
                        >
                            {mutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                            Kirim Pengajuan
                        </Button>
                    </CardContent>
                </Card>

                {/* History Section */}
                <Card className="rounded-3xl border-none shadow-sm overflow-hidden mb-8">
                    <CardHeader className="bg-white pb-2 px-6 pt-6">
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                            <History className="w-5 h-5 text-gray-400" />
                            Riwayat Pengajuan
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-gray-50">
                            {isLoadingRequests ? (
                                <div className="p-8 flex justify-center">
                                    <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
                                </div>
                            ) : requests?.length === 0 ? (
                                <div className="p-12 text-center">
                                    <div className="bg-gray-50 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4">
                                        <Info className="w-8 h-8 text-gray-300" />
                                    </div>
                                    <p className="text-sm text-gray-400 font-medium">Belum ada riwayat pengajuan.</p>
                                </div>
                            ) : (
                                requests?.map((req) => (
                                    <div key={req.id} className="p-4 hover:bg-gray-50 transition-colors">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <p className="text-sm font-bold text-gray-800">
                                                    {format(new Date(req.startDate), "d MMM")} - {format(new Date(req.endDate), "d MMM yyyy")}
                                                </p>
                                                <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{req.reason}</p>
                                            </div>
                                            <div className="flex flex-col items-end gap-2">
                                                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg border ${getStatusColor(req.status!)}`}>
                                                    {getStatusLabel(req.status!)}
                                                </span>
                                                {req.status === 'pending' && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 text-[10px] font-bold text-red-500 hover:text-red-600 hover:bg-red-50 px-2 rounded-lg"
                                                        onClick={() => {
                                                            if (confirm("Ingin membatalkan pengajuan ini?")) {
                                                                cancelMutation.mutate(req.id);
                                                            }
                                                        }}
                                                        disabled={cancelMutation.isPending}
                                                    >
                                                        {cancelMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "BATALKAN"}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </main>

            <BottomNav />
        </div>
    );
}
