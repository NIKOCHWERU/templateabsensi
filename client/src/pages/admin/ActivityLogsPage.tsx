import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Loader2, History, Search, FileClock, ShieldAlert, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { toTitleCase } from "@/lib/utils";
import { useLocation } from "wouter";

interface ActivityLogItem {
    id: number;
    userId: number;
    action: string;
    details: string;
    createdAt: string;
    userFullName: string | null;
    userRole: string | null;
}

export default function ActivityLogsPage() {
    const { user } = useAuth();
    const [, setLocation] = useLocation();
    const [search, setSearch] = useState("");

    const { data: logs = [], isLoading } = useQuery<ActivityLogItem[]>({
        queryKey: ["/api/admin/activity-logs"],
        refetchInterval: 10000,
    });

    if (user?.role !== "superadmin") {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
                <ShieldAlert className="w-16 h-16 text-red-500 mb-4" />
                <h1 className="text-xl font-bold text-gray-800">Akses Ditolak</h1>
                <p className="text-sm text-gray-500 mt-2 max-w-md">
                    Halaman ini hanya dapat diakses oleh akun dengan tingkatan wewenang Super Admin.
                </p>
                <Button onClick={() => setLocation("/admin")} className="mt-4 bg-primary hover:bg-primary/90 text-white rounded-xl">
                    Kembali ke Dashboard
                </Button>
            </div>
        );
    }

    const filteredLogs = logs.filter(log => {
        const query = search.toLowerCase();
        return (
            log.action.toLowerCase().includes(query) ||
            log.details.toLowerCase().includes(query) ||
            (log.userFullName || "").toLowerCase().includes(query)
        );
    });

    return (
        <div className="p-6 md:p-8 space-y-6 max-w-6xl mx-auto">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                        <History className="w-6 h-6 text-primary" />
                        Riwayat Aktivitas User
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Pencatatan riwayat perubahan data detail profil karyawan dan modifikasi konfigurasi sistem oleh administrator.
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setLocation("/admin")} className="shrink-0 border-gray-200 rounded-xl hover:bg-gray-50">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Kembali
                </Button>
            </div>

            {/* Filter Card */}
            <div className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                        placeholder="Cari aktivitas, nama user, detail perubahan..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 rounded-xl border-gray-200"
                    />
                </div>
            </div>

            {/* Content Section */}
            {isLoading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            ) : filteredLogs.length === 0 ? (
                <Card className="border-dashed border-2 rounded-2xl">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                        <FileClock className="w-12 h-12 text-gray-350 mb-4" />
                        <p className="text-gray-550 font-bold">Belum ada catatan aktivitas.</p>
                        <p className="text-xs text-gray-400 mt-1">Semua tindakan pengeditan profil dan pengaturan sistem akan otomatis dicatat di sini.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-55/30 text-gray-500 text-xs uppercase tracking-wider font-bold">
                                <tr>
                                    <th className="px-5 py-3.5 text-left">Waktu Kejadian</th>
                                    <th className="px-5 py-3.5 text-left">Pelaku (User)</th>
                                    <th className="px-5 py-3.5 text-left">Tindakan</th>
                                    <th className="px-5 py-3.5 text-left">Detail Perubahan</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-primary/5/30 transition-colors">
                                        <td className="px-5 py-4 whitespace-nowrap text-gray-500 font-medium">
                                            {format(new Date(log.createdAt), "d MMMM yyyy, HH:mm:ss", { locale: id })}
                                        </td>
                                        <td className="px-5 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs uppercase">
                                                    {(log.userFullName || "System").charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-800 leading-none">{toTitleCase(log.userFullName || "System")}</p>
                                                    <span className="text-[9px] font-extrabold uppercase tracking-wide text-primary mt-1 block">
                                                        {log.userRole === "superadmin" ? "Super Admin" : (log.userRole || "Karyawan")}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                                log.action === "MENGUBAH_PROFIL"
                                                    ? "bg-blue-50 text-blue-700 border border-blue-100"
                                                    : "bg-orange-50 text-orange-700 border border-orange-100"
                                            }`}>
                                                {log.action.replace(/_/g, " ")}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-gray-700 max-w-md break-words font-medium text-xs leading-relaxed">
                                            {log.details}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
