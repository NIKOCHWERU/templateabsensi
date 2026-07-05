import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import {
    ArrowLeft,
    Search,
    Calendar,
    FileText,
    Download,
    UserMinus,
    Clock,
    Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

interface ResignationHistoryItem {
    id: number;
    userId: number;
    resignDate: string;
    reason: string;
    documentUrl: string | null;
    createdAt: string;
    user: {
        fullName: string;
        nik: string | null;
        branch: string | null;
        position: string | null;
    };
}

export default function ResignHistoryPage() {
    const [, setLocation] = useLocation();
    const [searchTerm, setSearchTerm] = useState("");
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: resignationsList = [], isLoading } = useQuery<ResignationHistoryItem[]>({
        queryKey: ["/api/admin/resignations"],
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            const res = await fetch(`/api/admin/resignations/${id}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error("Gagal menghapus riwayat resign");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/resignations"] });
            toast({
                title: "Berhasil",
                description: "Riwayat resign telah dihapus.",
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

    const handleDeleteResignation = (id: number) => {
        if (confirm("Apakah Anda yakin ingin menghapus catatan resign ini?")) {
            deleteMutation.mutate(id);
        }
    };

    const filteredResignations = resignationsList.filter((r) => {
        const name = r.user?.fullName?.toLowerCase() || "";
        const nik = r.user?.nik?.toLowerCase() || "";
        const term = searchTerm.toLowerCase();
        return name.includes(term) || nik.includes(term);
    });

    return (
        <div className="space-y-6">
            {/* Header section with Back Button */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="icon"
                        className="rounded-lg h-9 w-9 cursor-pointer"
                        onClick={() => setLocation("/admin/resign-management")}
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Riwayat Resign Tenaga Kerja</h1>
                        <p className="text-sm text-gray-500">Timeline historis seluruh tenaga kerja yang telah resign dari perusahaan.</p>
                    </div>
                </div>
            </div>

            {/* Filter and Search */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                        placeholder="Cari riwayat resign..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 rounded-lg border-gray-200"
                    />
                </div>
                <div className="text-xs text-gray-400 font-bold bg-white border border-gray-100 px-3 py-1.5 rounded-full shadow-xs">
                    Total: {filteredResignations.length} Tenaga Kerja Resign
                </div>
            </div>

            {/* History Timeline Cards */}
            {isLoading ? (
                <div className="py-20 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
                        <span>Memuat riwayat resign...</span>
                    </div>
                </div>
            ) : filteredResignations.length === 0 ? (
                <Card className="border-dashed border-gray-200 shadow-none rounded-xl">
                    <CardContent className="py-16 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
                        <UserMinus className="w-12 h-12 text-gray-300" />
                        <p className="font-semibold text-gray-500">Belum ada riwayat resign</p>
                        <p className="text-xs text-gray-400">Pencatatan resign aktif akan otomatis terekam dalam halaman riwayat ini.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="relative pl-6 sm:pl-8 border-l border-gray-200 space-y-8 ml-4">
                    {filteredResignations.map((item) => {
                        const dateFormatted = format(new Date(item.resignDate), "dd MMMM yyyy", { locale: id });
                        const recordDate = format(new Date(item.createdAt), "dd/MM/yyyy HH:mm");
                        
                        return (
                            <div key={item.id} className="relative">
                                {/* Timeline Bullet Dot */}
                                <span className="absolute -left-[31px] sm:-left-[39px] top-1.5 flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-red-50 text-red-600 border border-red-200 shadow-xs">
                                    <UserMinus className="w-3.5 h-3.5" />
                                </span>

                                {/* Timeline Card */}
                                <Card className="border-gray-100 shadow-sm rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                                    <CardContent className="p-5 sm:p-6 space-y-4">
                                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-gray-50 pb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-red-500 to-rose-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                                                    {item.user.fullName.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <h3 className="font-black text-gray-900 text-base">{item.user.fullName}</h3>
                                                    <p className="text-xs font-bold text-gray-400">
                                                        NIK: <span className="font-mono">{item.user.nik || "-"}</span>
                                                    </p>
                                                </div>
                                            </div>
                                            
                                            {/* Date Badge */}
                                            <div className="flex flex-col items-start sm:items-end gap-1.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-700 border border-red-100 rounded-full text-xs font-bold shadow-2xs">
                                                        <Calendar className="w-3.5 h-3.5" />
                                                        Resign: {dateFormatted}
                                                    </span>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="rounded-lg text-red-600 border-red-100 hover:bg-red-50 h-7 w-7 p-0 flex items-center justify-center cursor-pointer"
                                                        onClick={() => handleDeleteResignation(item.id)}
                                                        disabled={deleteMutation.isPending}
                                                        title="Hapus Riwayat Resign"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </Button>
                                                </div>
                                                <span className="text-[10px] text-gray-400 flex items-center gap-1 font-bold">
                                                    <Clock className="w-3 h-3" />
                                                    Dicatat pada: {recordDate}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Jabatan & Cabang */}
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                                            <div className="space-y-0.5">
                                                <span className="text-gray-400 font-bold block uppercase tracking-wider">Jabatan Terakhir</span>
                                                <span className="font-bold text-gray-800 text-sm">{item.user.position || "-"}</span>
                                            </div>
                                            <div className="space-y-0.5">
                                                <span className="text-gray-400 font-bold block uppercase tracking-wider">Cabang Terakhir</span>
                                                <span className="font-bold text-gray-800 text-sm">{item.user.branch || "-"}</span>
                                            </div>
                                            <div className="col-span-2 space-y-0.5">
                                                <span className="text-gray-400 font-bold block uppercase tracking-wider">Surat Dokumen Resign</span>
                                                <div>
                                                    {item.documentUrl ? (
                                                        <a
                                                            href={item.documentUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1 text-primary-foreground font-bold hover:underline"
                                                        >
                                                            <Download className="w-3.5 h-3.5" />
                                                            Unduh Dokumen Attach
                                                        </a>
                                                    ) : (
                                                        <span className="text-gray-400 italic">Tidak ada surat terlampir</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Alasan/Keterangan */}
                                        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-1">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Keterangan Lengkap / Kronologi Resign</span>
                                            <p className="text-sm text-gray-600 leading-relaxed font-medium">{item.reason}</p>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
