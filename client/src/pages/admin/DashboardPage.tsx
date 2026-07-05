import { useQuery, useMutation } from "@tanstack/react-query";
import { User, Attendance } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Clock, CalendarDays, UserPlus, LogOut, FileText, MessageSquare, History, Info, AlertCircle, Image as ImageIcon, DatabaseBackup, Loader2, Upload } from "lucide-react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    AreaChart,
    Area,
    LabelList,
    ResponsiveContainer as RC
} from 'recharts';
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { format, isSameDay } from "date-fns";
import { id } from "date-fns/locale";
import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { api } from "@shared/routes";
import { LeaveRequest } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogDescription,
    DialogClose,
} from "@/components/ui/dialog";

export default function AdminDashboard() {
    const [, setLocation] = useLocation();
    const { logout } = useAuth();
    const { toast } = useToast();
    const [absenceDate, setAbsenceDate] = useState(new Date().toISOString().split('T')[0]);

    const backupMutation = useMutation({
        mutationFn: async () => {
            const res = await apiRequest("POST", "/api/admin/backup");
            return await res.json();
        },
        onSuccess: (data: any) => {
            if (data.success) {
                toast({ title: "Backup Selesai", description: data.message });
                window.location.href = `/api/admin/backups/download/${data.fileName}`;
            } else {
                toast({ title: "Gagal Backend", description: data.message, variant: "destructive" });
            }
        },
        onError: (err: any) => {
            toast({ title: "Gagal Backup", description: err.message, variant: "destructive" });
        }
    });

    const fileInputRef = useRef<HTMLInputElement>(null);

    const importMutation = useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData();
            formData.append("file", file);
            const res = await fetch("/api/admin/backups/import", {
                method: "POST",
                body: formData,
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || "Gagal meng-import database");
            }
            return await res.json();
        },
        onSuccess: (data: any) => {
            toast({ title: "Import Berhasil", description: data.message });
            setTimeout(() => window.location.reload(), 1500);
        },
        onError: (err: any) => {
            toast({ title: "Gagal Import", description: err.message, variant: "destructive" });
        }
    });

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.name.endsWith('.sql')) {
                toast({ title: "Format Tidak Valid", description: "Pastikan file berformat .sql", variant: "destructive" });
                return;
            }
            if (confirm("Apakah Anda yakin ingin meng-import database ini? Data saat ini mungkin akan tertimpa.")) {
                importMutation.mutate(file);
            }
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const { data: stats } = useQuery<{ totalEmployees: number; presentToday: number }>({
        queryKey: ["/api/admin/stats"],
        refetchInterval: 5000, // Poll every 5 seconds
    });

    const [prevPendingCount, setPrevPendingCount] = useState<number>(0);

    const { data: complaintsStats } = useQuery<{ pendingCount: number }>({
        queryKey: ["/api/admin/complaints/stats"],
        refetchInterval: 5000, // Poll every 5 seconds
    });

    const [prevLeavePendingCount, setPrevLeavePendingCount] = useState<number>(0);

    const { data: leaveRequests } = useQuery<LeaveRequest[]>({
        queryKey: [api.admin.attendance.leave.list.path],
        refetchInterval: 5000,
    });

    // Browser Notification Logic
    useEffect(() => {
        if (complaintsStats && complaintsStats.pendingCount > prevPendingCount) {
            if ("Notification" in window && Notification.permission === "granted") {
                new Notification("Pengaduan Baru", {
                    body: `Ada ${complaintsStats.pendingCount} pengaduan yang menunggu tanggapan.`,
                    icon: "/logo_elok_buah.jpg"
                });
            }
        }
        setPrevPendingCount(complaintsStats?.pendingCount || 0);
    }, [complaintsStats?.pendingCount]);

    useEffect(() => {
        const pendingLeave = leaveRequests?.filter(r => r.status === 'pending') || [];
        if (pendingLeave.length > prevLeavePendingCount) {
            if ("Notification" in window && Notification.permission === "granted") {
                new Notification("Pengajuan Cuti Baru", {
                    body: `Ada ${pendingLeave.length} pengajuan cuti yang menunggu persetujuan.`,
                    icon: "/logo_elok_buah.jpg"
                });
            }
        }
        setPrevLeavePendingCount(pendingLeave.length);
    }, [leaveRequests]);

    // Request Permission on mount
    useEffect(() => {
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }
    }, []);

    const requestNotificationPermission = async () => {
        if ("Notification" in window) {
            const permission = await Notification.requestPermission();
            if (permission === "granted") {
                toast({
                    title: "Notifikasi Aktif",
                    description: "Anda akan menerima pemberitahuan saat ada pengaduan baru.",
                });
            }
        }
    };

    const { data: attendanceHistory } = useQuery<Attendance[]>({
        queryKey: ["/api/attendance"], // Fetches all history
        refetchInterval: 5000, // Poll every 5 seconds
    });

    const { data: users } = useQuery<User[]>({
        queryKey: ["/api/admin/users"],
        refetchInterval: 5000,
    });

    // Recent activities (Live Feed) - Filter today's records and sort by latest action
    const recentActivities = attendanceHistory?.filter(a => {
        const now = new Date();
        return new Date(a.date).toDateString() === now.toDateString();
    }).sort((a, b) => {
        // Find the most recent timestamp among all available fields for record A
        const timesA = [a.checkOut, a.breakEnd, a.breakStart, a.checkIn, a.date]
            .filter(Boolean)
            .map(t => new Date(t!).getTime());
        const lastActionA = Math.max(...timesA);

        // Find the most recent timestamp among all available fields for record B
        const timesB = [b.checkOut, b.breakEnd, b.breakStart, b.checkIn, b.date]
            .filter(Boolean)
            .map(t => new Date(t!).getTime());
        const lastActionB = Math.max(...timesB);

        return lastActionB - lastActionA;
    }).slice(0, 8) || [];

    // Helper to get NIK
    const getUserNik = (userId: number) => {
        const u = users?.find(user => user.id === userId);
        return u?.nik || u?.username || userId;
    }

    const currentDate = new Date("2026-02-08T17:00:00"); // Using the source of truth time approximately for display if needed, but for "Hari ini" use System Date.
    // Actually, standard Date() is fine as long as system time is correct.

    return (
        <div className="w-full flex">
            {/* Sidebar (Simple version for now) */}
            {/* Sidebar replaced */}

            {/* Main Content */}
            <main className="flex-1 md:p-8 p-4 overflow-auto">
                <header className="flex flex-col md:flex-row md:justify-between md:items-center mb-8 gap-4">
                    <h2 className="text-2xl font-bold text-gray-800">Dashboard</h2>
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex gap-2">
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept=".sql"
                                onChange={handleFileChange}
                            />
                            <Button
                                variant="outline"
                                className="border-orange-200 text-orange-700 hover:bg-orange-50 shadow-sm"
                                onClick={handleImportClick}
                                disabled={importMutation.isPending}
                            >
                                {importMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                                Import Database
                            </Button>
                            <Button
                                variant="outline"
                                className="border-blue-200 text-blue-700 hover:bg-blue-50 shadow-sm"
                                onClick={() => backupMutation.mutate()}
                                disabled={backupMutation.isPending}
                            >
                                {backupMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <DatabaseBackup className="w-4 h-4 mr-2" />}
                                Backup Database
                            </Button>
                        </div>
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="border-primary/20 text-primary-foreground hover:bg-primary/5 shadow-sm">
                                    <Info className="w-4 h-4 mr-2" />
                                    Tata Cara & Ketentuan Absensi
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle className="text-xl font-bold text-primary-foreground flex items-center gap-2">
                                        <Info className="w-6 h-6" />
                                        Tata Cara Absensi (Penting Dibaca!)
                                    </DialogTitle>
                                    <DialogDescription className="text-gray-600 text-base">
                                        Perhatikan gambar di bawah ini agar Bapak/Ibu tidak salah saat melakukan absensi setiap harinya.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-6 py-4 text-sm text-gray-700">

                                    {/* Tutorial Illustration: App UI Mockup */}
                                    <div className="bg-primary/5/50 border border-primary/10 rounded-xl p-6 flex flex-col items-center justify-center space-y-4 shadow-sm relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 to-emerald-500"></div>
                                        <p className="text-sm font-bold text-gray-600 uppercase mb-2">Urutan Tombol Yang Ditekan</p>
                                        <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
                                            {/* Simulate Check In */}
                                            <div className="bg-white border-2 border-green-500 text-primary-foreground rounded-xl p-3 flex flex-col items-center justify-center gap-2 shadow-sm relative">
                                                <div className="absolute -top-2 -right-2 bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md animate-pulse">#1</div>
                                                <Clock className="w-6 h-6" />
                                                <span className="font-bold text-xs text-center">Absen Masuk<br /><span className="text-[10px] font-normal text-gray-500">Saat tiba</span></span>
                                            </div>
                                            {/* Simulate Break Start */}
                                            <div className="bg-white border-2 border-orange-400 text-orange-600 rounded-xl p-3 flex flex-col items-center justify-center gap-2 shadow-sm relative">
                                                <div className="absolute -top-2 -right-2 bg-orange-400 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md">#2</div>
                                                <CalendarDays className="w-6 h-6" />
                                                <span className="font-bold text-xs text-center">Mulai Istirahat<br /><span className="text-[10px] font-normal text-gray-500">Jam jeda</span></span>
                                            </div>
                                            {/* Simulate Break End */}
                                            <div className="bg-white border-2 border-blue-400 text-blue-600 rounded-xl p-3 flex flex-col items-center justify-center gap-2 shadow-sm relative">
                                                <div className="absolute -top-2 -right-2 bg-blue-400 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md">#3</div>
                                                <CalendarDays className="w-6 h-6" />
                                                <span className="font-bold text-xs text-center">Selesai Istirahat<br /><span className="text-[10px] font-normal text-gray-500">Kembali kerja</span></span>
                                            </div>
                                            {/* Simulate Check Out */}
                                            <div className="bg-white border-2 border-red-500 text-red-600 rounded-xl p-3 flex flex-col items-center justify-center gap-2 shadow-sm relative">
                                                <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md">#4</div>
                                                <LogOut className="w-6 h-6" />
                                                <span className="font-bold text-xs text-center">Absen Pulang<br /><span className="text-[10px] font-normal text-gray-500">Selesai kerja</span></span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3 bg-white border border-gray-200 p-4 rounded-xl shadow-sm">
                                        <h4 className="font-bold text-gray-900 flex items-center gap-2 text-base">
                                            <Clock className="w-5 h-5 text-primary" />
                                            1. Cara Absen Datang & Pulang
                                        </h4>
                                        <ul className="list-disc list-inside space-y-2 ml-2 text-gray-700 leading-relaxed">
                                            <li><strong className="text-primary-foreground">Saat Datang:</strong> Jangan lupa langsung tekan tombol <strong className="text-primary-foreground border border-primary/20 bg-primary/5 px-1 rounded">Absen Masuk (1)</strong> supaya sistem mulai menghitung jam kerja.</li>
                                            <li><strong className="text-red-600">Saat Selesai Kerja:</strong> Wajib menekan tombol <strong className="text-red-600 border border-red-200 bg-red-50 px-1 rounded">Absen Pulang (4)</strong> sebelum meninggalkan tempat kerja.</li>
                                            <li><strong className="text-blue-600">Bisa Absen Masuk Berkali-kali!</strong> Jika hari ini Bapak/Ibu harus keluar dari tempat kerja lalu kembali lagi, silakan <strong className="text-red-500 underline">Absen Pulang</strong> dulu saat pergi, dan <strong className="text-primary underline">Absen Masuk</strong> lagi saat sudah kembali. Jam kerja otomatis akan digabungkan.</li>
                                        </ul>
                                    </div>

                                    <div className="space-y-3 bg-white border border-gray-200 p-4 rounded-xl shadow-sm">
                                        <h4 className="font-bold text-gray-900 flex items-center gap-2 text-base">
                                            <CalendarDays className="w-5 h-5 text-orange-500" />
                                            2. Jika Ada Waktu Istirahat
                                        </h4>
                                        <ul className="list-disc list-inside space-y-2 ml-2 text-gray-700 leading-relaxed">
                                            <li>Jika waktunya istirahat, tekan tombol <strong className="text-orange-600 border border-orange-200 bg-orange-50 px-1 rounded">Mulai Istirahat (2)</strong>. <span className="text-gray-500 italic">(Tidak perlu absen pulang)</span>.</li>
                                            <li><strong className="text-red-600">PENTING:</strong> Setelah selesai istirahat, <strong className="text-red-600 underline">WAJIB</strong> menekan tombol <strong className="text-blue-600 border border-blue-200 bg-blue-50 px-1 rounded">Selesai Istirahat (3)</strong> agar jam kerja Bapak/Ibu kembali dihitung.</li>
                                        </ul>
                                    </div>
                                    <div className="space-y-3 bg-white border border-gray-200 p-4 rounded-xl shadow-sm">
                                        <h4 className="font-bold text-gray-900 flex items-center gap-2 text-base">
                                            <FileText className="w-5 h-5 text-blue-500" />
                                            3. Jika Sakit, Izin, atau Cuti
                                        </h4>
                                        <ul className="list-disc list-inside space-y-2 ml-2 text-gray-700 leading-relaxed">
                                            <li><strong className="text-blue-700">Sakit:</strong> Harap lapor ke admin atau atasan, dan kirimkan Surat Dokter (jika ada) agar absen Bapak/Ibu ditulis "Sakit" atau "Izin", bukan "Alpha" (Tanpa Keterangan).</li>
                                            <li><strong className="text-purple-700">Pengajuan Cuti:</strong> Silakan ajukan jauh-jauh hari lewat menu "Manajemen Cuti" atau lapor ke Atasan. Jika disetujui, kehadiran hari itu sudah otomatis dihitung Cuti.</li>
                                            <li><strong className="text-orange-700">Izin Keluar Sebentar (Pemat):</strong> Khusus untuk Bapak/Ibu yang harus keluar kantor sebentar di jam kerja, harap hubungi Admin agar dibuatkan Surat Izin Keluar sementara. Waktu Bapak/Ibu keluar akan otomatis dipotong tanpa menghapus absensi harian.</li>
                                        </ul>
                                    </div>
                                    <div className="space-y-3 bg-white border border-gray-200 p-4 rounded-xl shadow-sm">
                                        <h4 className="font-bold text-gray-900 flex items-center gap-2 text-base">
                                            <AlertCircle className="w-5 h-5 text-red-500" />
                                            4. Catatan Penting
                                        </h4>
                                        <ul className="list-disc list-inside space-y-2 ml-2 text-gray-700 leading-relaxed">
                                            <li>Pastikan lokasi HP/Komputer (*GPS*) Bapak/Ibu sudah <strong>menyala</strong> saat memencet tombol absensi.</li>
                                            <li>Apabila Bapak/Ibu lupa absen atau ada masalah teknis (misal sinyal jelek), harap <strong>SEGERA LAPOR</strong> ke Admin agar dibantu absensinya hari itu. Jangan sampai statusnya Alpha.</li>
                                            <li>Selalu cek <strong>"Riwayat Absensi"</strong> untuk memastikan absen hari itu sukses tersimpan.</li>
                                        </ul>
                                    </div>
                                    <div className="bg-orange-50 p-4 rounded-xl border border-orange-200 text-orange-800 text-sm flex items-start gap-3 mt-6 shadow-sm">
                                        <Info className="w-5 h-5 shrink-0 mt-0.5 text-orange-500 font-bold" />
                                        <p className="leading-relaxed">
                                            <strong>Catatan untuk Admin:</strong> Ini adalah contoh pop-up panduan tata cara absensi. Nantinya, panduan ini akan dapat dimunculkan pula di aplikasi untuk <strong>Tenaga Kerja (User)</strong> agar mereka bisa memahami tata cara absensi sistem yang tepat.
                                        </p>
                                    </div>
                                </div>
                                <DialogFooter className="pt-2">
                                    <DialogClose asChild>
                                        <Button className="bg-primary hover:bg-primary/90 text-white font-bold px-8">Mengerti</Button>
                                    </DialogClose>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                        <div className="text-sm text-gray-500 font-medium capitalize hidden md:block">
                            {format(new Date(), "EEEE, d MMMM yyyy", { locale: id })}
                        </div>
                    </div>
                </header>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <Card
                        className="border-none shadow-sm hover:shadow-md transition-all bg-white rounded-xl overflow-hidden group cursor-pointer hover:translate-y-[-2px]"
                        onClick={() => setLocation("/admin/employees")}
                    >
                        <CardContent className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <p className="text-sm font-medium text-gray-500 mb-1">Total Tenaga Kerja</p>
                                    <h3 className="text-4xl font-bold text-gray-800">{stats?.totalEmployees || 0}</h3>
                                </div>
                                <div className="p-2 bg-gradient-to-br from-orange-100 to-orange-50 rounded-lg group-hover:scale-110 transition-transform">
                                    <Users className="h-6 w-6 text-primary" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card
                        className="border-none shadow-sm hover:shadow-md transition-all bg-white rounded-xl overflow-hidden group cursor-pointer hover:translate-y-[-2px]"
                        onClick={() => setLocation("/admin/recap")}
                    >
                        <CardContent className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <p className="text-sm font-medium text-gray-500 mb-1">Hadir Hari Ini</p>
                                    <h3 className="text-4xl font-bold text-gray-800">{stats?.presentToday || 0}</h3>
                                </div>
                                <div className="p-2 bg-gradient-to-br from-green-100 to-green-50 rounded-lg group-hover:scale-110 transition-transform">
                                    <Clock className="h-6 w-6 text-primary" />
                                </div>
                            </div>
                            <div className="flex items-center space-x-2 text-xs text-gray-400">
                                <span>Lihat Rekap Absen</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card
                        className="border-none shadow-sm hover:shadow-md transition-all bg-white rounded-xl overflow-hidden group cursor-pointer hover:translate-y-[-2px]"
                        onClick={() => setLocation("/admin/attendance-summary")}
                    >
                        <CardContent className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <p className="text-sm font-medium text-gray-500 mb-1">Izin / Sakit</p>
                                    <h3 className="text-4xl font-bold text-gray-800">
                                        {(() => {
                                            const now = new Date();
                                            const isToday = (date: any) => new Date(date).toDateString() === now.toDateString();
                                            return attendanceHistory?.filter(a => isToday(a.date) && ['sick', 'permission'].includes(a.status || '')).length || 0;
                                        })()}
                                    </h3>
                                </div>
                                <div className="p-2 bg-gradient-to-br from-blue-100 to-blue-50 rounded-lg group-hover:scale-110 transition-transform">
                                    <CalendarDays className="h-6 w-6 text-blue-500" />
                                </div>
                            </div>
                            <div className="flex items-center space-x-2 text-xs text-gray-400">
                                <span>Lihat Ringkasan</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card
                        className="border-none shadow-sm hover:shadow-md transition-all bg-white rounded-xl overflow-hidden group cursor-pointer hover:translate-y-[-2px]"
                        onClick={() => setLocation("/admin/leave")}
                    >
                        <CardContent className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <p className="text-sm font-medium text-gray-500 mb-1">Cuti Menunggu</p>
                                    <h3 className="text-4xl font-bold text-blue-600">
                                        {leaveRequests?.filter(r => r.status === 'pending').length || 0}
                                    </h3>
                                </div>
                                <div className="p-2 bg-gradient-to-br from-blue-100 to-blue-50 rounded-lg group-hover:scale-110 transition-transform">
                                    <CalendarDays className="h-6 w-6 text-blue-500" />
                                </div>
                            </div>
                            <div className="flex items-center space-x-2 text-xs text-gray-400">
                                <span>Perlu Persetujuan</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* Weekly Trend Chart */}
                    <Card className="border-none shadow-sm hover:shadow-md transition-shadow bg-white rounded-xl overflow-hidden">
                        <CardHeader>
                            <CardTitle className="text-lg font-bold text-gray-800">Tren Kehadiran (7 Hari Terakhir)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={(() => {
                                            // Generate last 7 days including today
                                            const days = Array.from({ length: 7 }, (_, i) => {
                                                const d = new Date();
                                                d.setDate(d.getDate() - (6 - i));
                                                return d;
                                            });

                                            return days.map(day => {
                                                const dateStr = day.toISOString().split('T')[0];
                                                // Filter history for this day
                                                const dailyRecs = attendanceHistory?.filter(a => String(a.date).startsWith(dateStr)) || [];

                                                return {
                                                    name: format(day, "d MMM", { locale: id }),
                                                    Hadir: dailyRecs.filter(a => a.status === 'present').length,
                                                    Telat: dailyRecs.filter(a => a.status === 'late').length,
                                                    Izin: dailyRecs.filter(a => a.status && ['sick', 'permission'].includes(a.status)).length
                                                };
                                            });
                                        })()}
                                        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                        <XAxis
                                            dataKey="name"
                                            tick={{ fill: '#6B7280', fontSize: 12 }}
                                            tickLine={false}
                                            axisLine={false}
                                            dy={10}
                                        />
                                        <YAxis
                                            tick={{ fill: '#6B7280', fontSize: 12 }}
                                            tickLine={false}
                                            axisLine={false}
                                            allowDecimals={false}
                                        />
                                        <Tooltip
                                            cursor={{ fill: '#F3F4F6' }}
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                        />
                                        <Legend
                                            verticalAlign="top"
                                            align="right"
                                            iconType="circle"
                                            wrapperStyle={{ paddingBottom: '20px', fontSize: '12px', fontWeight: 600 }}
                                        />
                                        <Bar dataKey="Hadir" fill="#f97316" radius={[4, 4, 0, 0]} barSize={24} activeBar={{ fill: '#ea580c' }}>
                                            <LabelList dataKey="Hadir" position="top" style={{ fill: '#f97316', fontSize: '10px', fontWeight: 'bold' }} />
                                        </Bar>
                                        <Bar dataKey="Telat" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={24} activeBar={{ fill: '#d97706' }}>
                                            <LabelList dataKey="Telat" position="top" style={{ fill: '#f59e0b', fontSize: '10px', fontWeight: 'bold' }} />
                                        </Bar>
                                        <Bar dataKey="Izin" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={24} activeBar={{ fill: '#2563eb' }}>
                                            <LabelList dataKey="Izin" position="top" style={{ fill: '#3b82f6', fontSize: '10px', fontWeight: 'bold' }} />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Daily Composition Chart */}
                    <Card className="border-none shadow-sm hover:shadow-md transition-shadow bg-white rounded-xl overflow-hidden">
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle className="text-lg font-bold text-gray-800">Komposisi Kehadiran Hari Ini</CardTitle>
                                <div className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-xs font-bold border border-red-100">
                                    {(() => {
                                        const now = new Date();
                                        const isToday = (date: any) => new Date(date).toDateString() === now.toDateString();
                                        const todayRecs = attendanceHistory?.filter(a => isToday(a.date)) || [];
                                        const totalEmps = stats?.totalEmployees || 0;
                                        return Math.max(0, totalEmps - todayRecs.length);
                                    })()} Belum Absen
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[300px] w-full flex items-center justify-center">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={(() => {
                                                const now = new Date();
                                                const isToday = (date: any) => new Date(date).toDateString() === now.toDateString();
                                                const todayRecs = attendanceHistory?.filter(a => isToday(a.date)) || [];
                                                const totalEmps = stats?.totalEmployees || 0;

                                                const present = todayRecs.filter(a => a.status === 'present').length;
                                                const late = todayRecs.filter(a => a.status === 'late').length;
                                                const permission = todayRecs.filter(a => a.status && ['sick', 'permission'].includes(a.status)).length;
                                                const recordedCount = todayRecs.length;
                                                const absent = Math.max(0, totalEmps - recordedCount);

                                                return [
                                                    { name: 'Hadir', value: present, color: '#f97316' },
                                                    { name: 'Telat', value: late, color: '#f59e0b' },
                                                    { name: 'Izin', value: permission, color: '#3b82f6' },
                                                    { name: 'Belum', value: absent, color: '#e5e7eb' },
                                                ].filter(d => d.value > 0);
                                            })()}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={90}
                                            paddingAngle={5}
                                            dataKey="value"
                                            stroke="none"
                                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                        >
                                            {(() => {
                                                const now = new Date();
                                                const isToday = (date: any) => new Date(date).toDateString() === now.toDateString();
                                                const todayRecs = attendanceHistory?.filter(a => isToday(a.date)) || [];
                                                const totalEmps = stats?.totalEmployees || 0;

                                                const present = todayRecs.filter(a => a.status === 'present').length;
                                                const late = todayRecs.filter(a => a.status === 'late').length;
                                                const permission = todayRecs.filter(a => a.status && ['sick', 'permission'].includes(a.status)).length;
                                                const recordedCount = todayRecs.length;
                                                const absent = Math.max(0, totalEmps - recordedCount);

                                                return [
                                                    { name: 'Hadir', value: present, color: '#f97316' },
                                                    { name: 'Telat', value: late, color: '#f59e0b' },
                                                    { name: 'Izin', value: permission, color: '#3b82f6' },
                                                    { name: 'Belum', value: absent, color: '#e5e7eb' },
                                                ].filter(d => d.value > 0);
                                            })().map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            content={({ active, payload }) => {
                                                if (active && payload && payload.length) {
                                                    const data = payload[0].payload;
                                                    return (
                                                        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-100">
                                                            <p className="font-bold text-gray-800 mb-1">{data.name}</p>
                                                            <p className="text-sm">
                                                                <span className="font-semibold" style={{ color: data.color }}>
                                                                    {data.value}
                                                                </span> Tenaga Kerja
                                                            </p>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Live Feed and Absence List */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card className="border-none shadow-md bg-white lg:col-span-2">
                        <CardHeader>
                            <CardTitle className="text-lg font-bold text-gray-800">Live Absensi Terbaru</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-gray-500 uppercase bg-gray-50/50">
                                        <tr>
                                            <th className="px-4 py-3">Hari / Tanggal</th>
                                            <th className="px-4 py-3">NIK</th>
                                            <th className="px-4 py-3">Masuk</th>
                                            <th className="px-4 py-3">Istirahat</th>
                                            <th className="px-4 py-3">Selesai</th>
                                            <th className="px-4 py-3">Pulang</th>
                                            <th className="px-4 py-3">Status</th>
                                            <th className="px-4 py-3">Keterangan</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {recentActivities.map((record) => (
                                            <tr key={record.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                                                <td className="px-4 py-3 font-medium text-gray-900">
                                                    {format(new Date(record.date), 'EEEE, d MMM yyyy', { locale: id })}
                                                </td>
                                                <td className="px-4 py-3 font-mono text-gray-600">{getUserNik(record.userId)}</td>
                                                <td className="px-4 py-3 text-primary font-mono">
                                                    {record.checkIn ? format(new Date(record.checkIn), 'HH:mm') : '-'}
                                                </td>
                                                <td className="px-4 py-3 text-primary font-mono">
                                                    {record.breakStart ? format(new Date(record.breakStart), 'HH:mm') : '-'}
                                                </td>
                                                <td className="px-4 py-3 text-primary font-mono">
                                                    {record.breakEnd ? format(new Date(record.breakEnd), 'HH:mm') : '-'}
                                                </td>
                                                <td className="px-4 py-3 text-red-600 font-mono">
                                                    {record.checkOut ? format(new Date(record.checkOut), 'HH:mm') : '-'}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase
                                                ${record.status === 'present' ? 'bg-primary/10 text-primary-foreground' :
                                                            record.status === 'late' ? 'bg-red-100 text-red-700' :
                                                                record.status === 'sick' ? 'bg-blue-100 text-blue-700' :
                                                                    record.status === 'permission' ? 'bg-purple-100 text-purple-700' :
                                                                        'bg-gray-100 text-gray-700'}`}>
                                                        {record.status === 'present' ? 'Hadir' :
                                                            record.status === 'late' ? 'Telat' :
                                                                record.status === 'sick' ? 'Sakit' :
                                                                    record.status === 'permission' ? 'Izin' :
                                                                        record.status === 'absent' ? 'Alpha' : record.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-xs text-gray-500 italic max-w-[150px] truncate" title={record.notes || (record as any).lateReason || "-"}>
                                                    {record.notes ? record.notes : ((record as any).lateReason ? `Telat: ${(record as any).lateReason}` : "-")}
                                                </td>
                                            </tr>
                                        ))}
                                        {recentActivities.length === 0 && (
                                            <tr>
                                                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                                                    Belum ada data absensi untuk hari ini.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Who Didn't Clock In */}
                    <Card className="border-none shadow-md bg-white">
                        <CardHeader className="flex flex-col space-y-2">
                            <CardTitle className="text-lg font-bold text-gray-800">Daftar Belum Absen</CardTitle>
                            <Input
                                type="date"
                                value={absenceDate}
                                onChange={(e) => setAbsenceDate(e.target.value)}
                                className="h-8 text-xs"
                            />
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3 max-h-[400px] overflow-auto pr-2">
                                {(() => {
                                    const employees = users?.filter(u => u.role === 'employee') || [];
                                    const dateRecords = attendanceHistory?.filter(a => format(new Date(a.date), 'yyyy-MM-dd') === absenceDate) || [];
                                    const absentEmployees = employees.filter(emp => !dateRecords.some(att => att.userId === emp.id));

                                    if (absentEmployees.length === 0) {
                                        return <p className="text-center py-8 text-gray-400 text-sm">Semua tenaga kerja sudah absen.</p>;
                                    }

                                    return absentEmployees.map(emp => (
                                        <div key={emp.id} className="flex items-center gap-3 p-3 rounded-xl bg-red-50/50 border border-red-100/50">
                                            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-xs">
                                                {emp.fullName.charAt(0)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-sm text-gray-800 truncate">{emp.fullName}</p>
                                                <p className="text-[10px] text-gray-500 font-mono capitalize">{emp.nik || emp.username}</p>
                                            </div>
                                            <div className="text-[10px] font-bold text-red-400 uppercase">Alpha</div>
                                        </div>
                                    ));
                                })()}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Recent Leave Requests Card */}
                <div className="mt-8">
                    <Card className="border-none shadow-md bg-white">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="text-lg font-bold text-gray-800">Daftar Pengajuan Cuti Terbaru</CardTitle>
                            <Button variant="ghost" size="sm" className="text-blue-600 font-bold" onClick={() => setLocation("/admin/leave")}>
                                Lihat Semua
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {leaveRequests?.slice(0, 3).map((req) => (
                                    <div key={req.id} className="p-4 rounded-2xl border border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setLocation("/admin/leave")}>
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                                                    {getUserNik(req.userId).toString().charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-gray-800 truncate max-w-[100px]">{users?.find(u => u.id === req.userId)?.fullName || 'User'}</p>
                                                    <p className="text-[10px] text-gray-400 font-bold uppercase">{getUserNik(req.userId)}</p>
                                                </div>
                                            </div>
                                            <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md border 
                                                ${req.status === 'approved' ? 'text-primary bg-primary/5 border-primary/10' :
                                                    req.status === 'rejected' ? 'text-red-600 bg-red-50 border-red-100' :
                                                        req.status === 'cancelled' ? 'text-gray-600 bg-gray-50 border-gray-100' :
                                                            'text-orange-600 bg-orange-50 border-orange-100'}`}>
                                                {req.status}
                                            </span>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-bold uppercase">
                                                <CalendarDays className="w-3 h-3 text-gray-400" />
                                                {req.selectedDates ? "Beberapa Tanggal" : "Rentang Tanggal"}
                                            </div>
                                            <p className="text-xs font-bold text-gray-700">
                                                {format(new Date(req.startDate), "d MMM")} - {format(new Date(req.endDate), "d MMM yyyy")}
                                            </p>
                                        </div>
                                        <div className="mt-2 text-xs text-gray-500 italic line-clamp-1">
                                            "{req.reason}"
                                        </div>
                                    </div>
                                ))}
                                {(!leaveRequests || leaveRequests.length === 0) && (
                                    <div className="col-span-full py-12 text-center text-gray-400">
                                        <p>Belum ada pengajuan cuti.</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

            </main>
        </div>
    );
}
