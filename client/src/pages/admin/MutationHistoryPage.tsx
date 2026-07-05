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
    ArrowLeftRight,
    TrendingUp,
    TrendingDown,
    Building,
    Briefcase,
    Clock,
    Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

interface MutationHistoryItem {
    id: number;
    userId: number;
    type: "mutasi" | "promosi" | "demosi";
    oldBranch: string | null;
    newBranch: string | null;
    oldPosition: string | null;
    newPosition: string | null;
    documentUrl: string | null;
    notes: string | null;
    createdAt: string;
    user: {
        fullName: string;
        nik: string | null;
    };
}

export default function MutationHistoryPage() {
    const [, setLocation] = useLocation();
    const [searchTerm, setSearchTerm] = useState("");
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: mutationsList = [], isLoading } = useQuery<MutationHistoryItem[]>({
        queryKey: ["/api/admin/mutations"],
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            const res = await fetch(`/api/admin/mutations/${id}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error("Gagal menghapus riwayat mutasi");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/mutations"] });
            toast({
                title: "Berhasil",
                description: "Riwayat mutasi telah dihapus.",
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

    const handleDeleteMutation = (id: number) => {
        if (confirm("Apakah Anda yakin ingin menghapus catatan mutasi/promosi ini?")) {
            deleteMutation.mutate(id);
        }
    };

    const filteredMutations = mutationsList.filter((m) => {
        const name = m.user?.fullName?.toLowerCase() || "";
        const term = searchTerm.toLowerCase();
        return name.includes(term);
    });

    const getActionHeader = (type: string) => {
        switch (type) {
            case "mutasi":
                return {
                    label: "MUTASI CABANG",
                    colorClass: "bg-blue-50 text-blue-700 border-blue-100",
                    icon: <ArrowLeftRight className="w-3.5 h-3.5" />
                };
            case "promosi":
                return {
                    label: "PROMOSI JABATAN",
                    colorClass: "bg-primary/5 text-primary-foreground border-primary/10",
                    icon: <TrendingUp className="w-3.5 h-3.5" />
                };
            case "demosi":
                return {
                    label: "DEMOSI JABATAN",
                    colorClass: "bg-red-50 text-red-700 border-red-100",
                    icon: <TrendingDown className="w-3.5 h-3.5" />
                };
            default:
                return {
                    label: "PERGERAKAN KARIR",
                    colorClass: "bg-gray-50 text-gray-700 border-gray-100",
                    icon: <ArrowLeftRight className="w-3.5 h-3.5" />
                };
        }
    };

    return (
        <div className="space-y-6">
            {/* Header section with Back Button */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="icon"
                        className="rounded-lg h-9 w-9 cursor-pointer"
                        onClick={() => setLocation("/admin/mutation-management")}
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Riwayat Mutasi & Promosi</h1>
                        <p className="text-sm text-gray-500">Timeline catatan perpindahan cabang, promosi, dan demosi tenaga kerja.</p>
                    </div>
                </div>
            </div>

            {/* Filter and Search */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                        placeholder="Cari riwayat pergerakan..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 rounded-lg border-gray-200"
                    />
                </div>
                <div className="text-xs text-gray-400 font-bold bg-white border border-gray-100 px-3 py-1.5 rounded-full shadow-xs">
                    Total: {filteredMutations.length} Mutasi & Log
                </div>
            </div>

            {/* History Timeline */}
            {isLoading ? (
                <div className="py-20 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
                        <span>Memuat riwayat...</span>
                    </div>
                </div>
            ) : filteredMutations.length === 0 ? (
                <Card className="border-dashed border-gray-200 shadow-none rounded-xl">
                    <CardContent className="py-16 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
                        <ArrowLeftRight className="w-12 h-12 text-gray-300" />
                        <p className="font-semibold text-gray-500">Belum ada riwayat pergerakan</p>
                        <p className="text-xs text-gray-400">Setiap mutasi, promosi, dan demosi tenaga kerja akan tercatat di sini secara historis.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="relative pl-6 sm:pl-8 border-l border-gray-200 space-y-8 ml-4">
                    {filteredMutations.map((item) => {
                        const actionMeta = getActionHeader(item.type);
                        const recordDate = format(new Date(item.createdAt), "dd MMMM yyyy HH:mm", { locale: id });
                        
                        return (
                            <div key={item.id} className="relative">
                                {/* Timeline Dot Icon */}
                                <span className={`absolute -left-[31px] sm:-left-[39px] top-1.5 flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full border shadow-xs ${
                                    item.type === "promosi" ? "bg-primary/5 text-primary border-primary/20" :
                                    item.type === "demosi" ? "bg-red-50 text-red-600 border-red-200" :
                                    "bg-blue-50 text-blue-600 border-blue-200"
                                }`}>
                                    {actionMeta.icon}
                                </span>

                                {/* Timeline Card */}
                                <Card className="border-gray-100 shadow-sm rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                                    <CardContent className="p-5 sm:p-6 space-y-4">
                                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-gray-50 pb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                                                    {item.user.fullName.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <h3 className="font-black text-gray-900 text-base">{item.user.fullName}</h3>
                                                    <p className="text-xs font-bold text-gray-400">
                                                        NIK: <span className="font-mono">{item.user.nik || "-"}</span>
                                                    </p>
                                                </div>
                                            </div>
                                            
                                            {/* Type and Date Badges */}
                                            <div className="flex flex-col items-start sm:items-end gap-1.5">
                                                <div className="flex items-center gap-2">
                                                    <span className={`inline-flex items-center gap-1 px-3 py-1 border rounded-full text-xs font-bold uppercase shadow-2xs ${actionMeta.colorClass}`}>
                                                        {actionMeta.icon}
                                                        {actionMeta.label}
                                                    </span>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="rounded-lg text-red-600 border-red-100 hover:bg-red-50 h-7 w-7 p-0 flex items-center justify-center cursor-pointer"
                                                        onClick={() => handleDeleteMutation(item.id)}
                                                        disabled={deleteMutation.isPending}
                                                        title="Hapus Riwayat Mutasi"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </Button>
                                                </div>
                                                <span className="text-[10px] text-gray-400 flex items-center gap-1 font-bold">
                                                    <Clock className="w-3 h-3" />
                                                    {recordDate}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Before vs After States */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {/* Before State */}
                                            <div className="p-3 bg-gray-50/50 border border-gray-100 rounded-xl space-y-2">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Kondisi Lama</span>
                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                    <div className="space-y-0.5">
                                                        <span className="text-gray-400 font-medium block">Cabang</span>
                                                        <span className="font-bold text-gray-700 flex items-center gap-1">
                                                            <Building className="w-3.5 h-3.5 text-blue-500" />
                                                            {item.oldBranch || "Kantor Pusat"}
                                                        </span>
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        <span className="text-gray-400 font-medium block">Jabatan</span>
                                                        <span className="font-bold text-gray-700 flex items-center gap-1">
                                                            <Briefcase className="w-3.5 h-3.5 text-primary" />
                                                            {item.oldPosition || "Staff"}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* After State */}
                                            <div className="p-3 bg-primary/5/20 border border-primary/10/50 rounded-xl space-y-2">
                                                <span className="text-[10px] font-bold text-primary/80 uppercase tracking-wider block">Kondisi Baru (Updated)</span>
                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                    <div className="space-y-0.5">
                                                        <span className="text-gray-400 font-medium block">Cabang</span>
                                                        <span className={`font-bold flex items-center gap-1 ${item.type === "mutasi" ? "text-blue-800 font-extrabold" : "text-gray-700"}`}>
                                                            <Building className="w-3.5 h-3.5 text-blue-500 animate-bounce" />
                                                            {item.newBranch || item.oldBranch || "Kantor Pusat"}
                                                        </span>
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        <span className="text-gray-400 font-medium block">Jabatan</span>
                                                        <span className={`font-bold flex items-center gap-1 ${item.type !== "mutasi" ? "text-emerald-800 font-extrabold" : "text-gray-700"}`}>
                                                            <Briefcase className="w-3.5 h-3.5 text-primary animate-pulse" />
                                                            {item.newPosition || item.oldPosition || "Staff"}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Notes and SK Document */}
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
                                            <div className="sm:col-span-2 bg-gray-50 border border-gray-100 rounded-xl p-3.5">
                                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Nomor SK / Catatan Direksi</span>
                                                <p className="text-xs text-gray-600 leading-relaxed font-medium">{item.notes || "Tidak ada berkas catatan pendukung."}</p>
                                            </div>
                                            
                                            <div className="bg-gray-50 border border-gray-100 rounded-xl p-3.5 flex flex-col justify-center h-full">
                                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Dokumen Pendukung SK</span>
                                                {item.documentUrl ? (
                                                    <a
                                                        href={item.documentUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/90 transition-colors shadow-2xs"
                                                    >
                                                        <Download className="w-3.5 h-3.5" />
                                                        Unduh File SK
                                                    </a>
                                                ) : (
                                                    <span className="text-xs text-gray-400 italic text-center">SK tidak diunggah</span>
                                                )}
                                            </div>
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
