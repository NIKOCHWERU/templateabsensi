import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import {
    Plus,
    Search,
    Trash2,
    Edit2,
    Eye,
    FileText,
    Download,
    Calendar,
    UserMinus,
    AlertCircle,
    User,
    ChevronLeft
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { useLocation } from "wouter";

interface ResignationData {
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

interface ActiveEmployee {
    id: number;
    fullName: string;
    nik: string | null;
    branch: string | null;
    position: string | null;
    role: string;
    employmentStatus: string | null;
}

export default function ResignManagementPage() {
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState("");
    
    // Modals state
    const [openAddModal, setOpenAddModal] = useState(false);
    const [openEditModal, setOpenEditModal] = useState(false);
    const [openViewModal, setOpenViewModal] = useState(false);
    
    // Selected data for edit/view
    const [selectedResign, setSelectedResign] = useState<ResignationData | null>(null);
    
    // Form fields state
    const [formUserId, setFormUserId] = useState("");
    const [formResignDate, setFormResignDate] = useState("");
    const [formReason, setFormReason] = useState("");
    const [formFile, setFormFile] = useState<File | null>(null);
    const [employeeQuery, setEmployeeQuery] = useState("");

    // Queries
    const { data: resignationsList = [], isLoading: isLoadingResignations } = useQuery<ResignationData[]>({
        queryKey: ["/api/admin/resignations"],
    });

    const { data: employees = [] } = useQuery<ActiveEmployee[]>({
        queryKey: ["/api/admin/users"],
    });

    // Filter active employees (role is employee and not already resigned)
    const activeEmployees = employees.filter(
        (emp) => emp.role === "employee" && emp.employmentStatus !== "Resign"
    );

    // Mutations
    const createMutation = useMutation({
        mutationFn: async (formData: FormData) => {
            const res = await fetch("/api/admin/resignations", {
                method: "POST",
                body: formData,
            });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.message || "Gagal menyimpan data.");
            }
            return res.json();
        },
        onSuccess: (data) => {
            toast({
                title: "Berhasil",
                description: data.message || "Pencatatan resign berhasil disimpan.",
                variant: "default",
            });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/resignations"] });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
            resetForm();
            setOpenAddModal(false);
        },
        onError: (err: any) => {
            toast({
                title: "Gagal",
                description: err.message,
                variant: "destructive",
            });
        },
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, formData }: { id: number; formData: FormData }) => {
            const res = await fetch(`/api/admin/resignations/${id}`, {
                method: "PATCH",
                body: formData,
            });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.message || "Gagal memperbarui data.");
            }
            return res.json();
        },
        onSuccess: (data) => {
            toast({
                title: "Berhasil",
                description: data.message || "Data resign berhasil diperbarui.",
                variant: "default",
            });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/resignations"] });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
            resetForm();
            setOpenEditModal(false);
        },
        onError: (err: any) => {
            toast({
                title: "Gagal",
                description: err.message,
                variant: "destructive",
            });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            const res = await fetch(`/api/admin/resignations/${id}`, {
                method: "DELETE",
            });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.message || "Gagal menghapus data.");
            }
            return res.json();
        },
        onSuccess: (data) => {
            toast({
                title: "Berhasil",
                description: data.message || "Data resign berhasil dihapus.",
                variant: "default",
            });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/resignations"] });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
        },
        onError: (err: any) => {
            toast({
                title: "Gagal",
                description: err.message,
                variant: "destructive",
            });
        },
    });

    const resetForm = () => {
        setFormUserId("");
        setFormResignDate("");
        setFormReason("");
        setFormFile(null);
        setSelectedResign(null);
        setEmployeeQuery("");
    };

    const handleAddSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formUserId || !formResignDate || !formReason) {
            toast({
                title: "Peringatan",
                description: "Harap lengkapi semua field wajib.",
                variant: "destructive",
            });
            return;
        }

        const formData = new FormData();
        formData.append("userId", formUserId);
        formData.append("resignDate", formResignDate);
        formData.append("reason", formReason);
        if (formFile) {
            formData.append("document", formFile);
        }

        createMutation.mutate(formData);
    };

    const handleEditSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedResign) return;

        const formData = new FormData();
        formData.append("resignDate", formResignDate);
        formData.append("reason", formReason);
        if (formFile) {
            formData.append("document", formFile);
        }

        updateMutation.mutate({ id: selectedResign.id, formData });
    };

    const handleOpenFileEdit = (resign: ResignationData) => {
        setSelectedResign(resign);
        setFormResignDate(resign.resignDate);
        setFormReason(resign.reason);
        setFormFile(null);
        setOpenEditModal(true);
    };

    const handleOpenFileView = (resign: ResignationData) => {
        setSelectedResign(resign);
        setOpenViewModal(true);
    };

    const handleDelete = (id: number) => {
        if (confirm("Apakah Anda yakin ingin menghapus pencatatan resign ini? Status keaktifan tenaga kerja akan dipulihkan.")) {
            deleteMutation.mutate(id);
        }
    };

    // Filter resignations
    const filteredResignations = resignationsList.filter((r) => {
        const name = r.user?.fullName?.toLowerCase() || "";
        const nik = r.user?.nik?.toLowerCase() || "";
        const term = searchTerm.toLowerCase();
        return name.includes(term) || nik.includes(term);
    });

    return (
        <div className="space-y-6">
            {/* Header section */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight">Manajemen Resign Tenaga Kerja</h1>
                    <p className="text-sm text-gray-500">Mencatat, menyunting, dan menghapus dokumen surat resign tenaga kerja.</p>
                </div>
                <div className="flex gap-2.5">
                    <Button
                        variant="outline"
                        className="rounded-lg gap-2 cursor-pointer"
                        onClick={() => setLocation("/admin/resign-history")}
                    >
                        <FileText className="w-4 h-4" />
                        Lihat Riwayat
                    </Button>
                    <Button
                        onClick={() => {
                            resetForm();
                            setOpenAddModal(true);
                        }}
                        className="bg-primary hover:bg-primary/90 text-white rounded-lg gap-2 shadow-sm active:scale-95 transition-all cursor-pointer"
                    >
                        <Plus className="w-4 h-4" />
                        Tambah Tenaga Kerja Resign
                    </Button>
                </div>
            </div>

            {/* Search and Table Card */}
            <Card className="border-gray-100 shadow-sm rounded-xl overflow-hidden">
                <CardContent className="p-0">
                    {/* Filters bar */}
                    <div className="p-4 sm:p-5 border-b border-gray-100 bg-white flex flex-col sm:flex-row gap-4 items-center justify-between">
                        <div className="relative w-full sm:w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                                placeholder="Cari tenaga kerja berdasarkan nama / NIK..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 rounded-lg border-gray-200"
                            />
                        </div>
                        <div className="text-xs text-gray-400 font-medium">
                            Menampilkan {filteredResignations.length} dari {resignationsList.length} data resign.
                        </div>
                    </div>

                    {/* Table Viewport */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100 text-xs font-black text-gray-400 uppercase tracking-wider">
                                    <th className="py-4 px-6 text-center w-16">No</th>
                                    <th className="py-4 px-6">Tenaga Kerja</th>
                                    <th className="py-4 px-6">NIK</th>
                                    <th className="py-4 px-6">Jabatan / Cabang</th>
                                    <th className="py-4 px-6">Tanggal Resign</th>
                                    <th className="py-4 px-6">Keterangan</th>
                                    <th className="py-4 px-6 text-center">Surat Resign</th>
                                    <th className="py-4 px-6 text-center w-40">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 text-sm">
                                {isLoadingResignations ? (
                                    <tr>
                                        <td colSpan={8} className="py-12 text-center text-gray-400">
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600" />
                                                <span>Memuat data resign...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredResignations.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="py-16 text-center text-gray-400">
                                            <div className="flex flex-col items-center justify-center gap-3">
                                                <UserMinus className="w-10 h-10 text-gray-300" />
                                                <p className="font-semibold text-gray-500">Tidak ada data resign ditemukan</p>
                                                <p className="text-xs text-gray-400">Silakan tambahkan data resign melalui tombol di atas.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredResignations.map((r, index) => (
                                        <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="py-4 px-6 text-center font-semibold text-gray-400">{index + 1}</td>
                                            <td className="py-4 px-6 font-bold text-gray-900">{r.user?.fullName}</td>
                                            <td className="py-4 px-6 font-mono text-xs text-gray-500">{r.user?.nik || "-"}</td>
                                            <td className="py-4 px-6">
                                                <div className="text-xs">
                                                    <span className="font-bold text-gray-700">{r.user?.position || "-"}</span>
                                                    <span className="text-gray-400 mx-1">•</span>
                                                    <span className="text-gray-500">{r.user?.branch || "-"}</span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 font-medium text-gray-700">
                                                {format(new Date(r.resignDate), "dd MMM yyyy", { locale: id })}
                                            </td>
                                            <td className="py-4 px-6 text-gray-500 max-w-xs truncate">{r.reason}</td>
                                            <td className="py-4 px-6 text-center">
                                                {r.documentUrl ? (
                                                    <a
                                                        href={r.documentUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/5 text-primary-foreground border border-primary/10 rounded-lg text-xs font-bold hover:bg-primary/10 transition-colors"
                                                    >
                                                        <Download className="w-3 h-3" />
                                                        Buka File
                                                    </a>
                                                ) : (
                                                    <span className="text-xs text-gray-400 italic">Tidak ada file</span>
                                                )}
                                            </td>
                                            <td className="py-4 px-6 text-center">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg cursor-pointer"
                                                        onClick={() => handleOpenFileView(r)}
                                                        title="Lihat Detail"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg cursor-pointer"
                                                        onClick={() => handleOpenFileEdit(r)}
                                                        title="Edit Data"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg cursor-pointer"
                                                        onClick={() => handleDelete(r.id)}
                                                        title="Hapus"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Modal: Tambah Tenaga Kerja Resign */}
            <Dialog open={openAddModal} onOpenChange={setOpenAddModal}>
                <DialogContent className="max-w-lg rounded-xl">
                    <DialogHeader>
                        <DialogTitle>Catat Tenaga Kerja Resign</DialogTitle>
                        <DialogDescription>
                            Daftarkan dokumen surat menyurat resign dan ubah status keaktifan tenaga kerja.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddSubmit} className="space-y-4 pt-2">
                        <div className="space-y-1.5 relative">
                            <label className="text-xs font-black text-gray-500 uppercase">Pilih Tenaga Kerja <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <Input
                                    placeholder="Ketik nama / NIK untuk mencari..."
                                    value={employeeQuery}
                                    onChange={(e) => setEmployeeQuery(e.target.value)}
                                    className="pl-9 rounded-lg border-gray-200"
                                />
                            </div>
                            
                            {employeeQuery.trim() !== "" && (
                                <div className="absolute z-30 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg divide-y divide-gray-50">
                                    {activeEmployees.filter(emp => 
                                        emp.fullName.toLowerCase().includes(employeeQuery.toLowerCase()) ||
                                        (emp.nik || "").toLowerCase().includes(employeeQuery.toLowerCase())
                                    ).length === 0 ? (
                                        <div className="p-3 text-center text-xs text-gray-400">Tidak ada tenaga kerja cocok</div>
                                    ) : (
                                        activeEmployees
                                            .filter(emp => 
                                                emp.fullName.toLowerCase().includes(employeeQuery.toLowerCase()) ||
                                                (emp.nik || "").toLowerCase().includes(employeeQuery.toLowerCase())
                                            )
                                            .map((emp) => (
                                                <button
                                                    key={emp.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setFormUserId(emp.id.toString());
                                                        setEmployeeQuery("");
                                                    }}
                                                    className="w-full text-left px-4 py-2.5 text-xs hover:bg-slate-50 flex items-center justify-between font-bold text-gray-800 transition-colors"
                                                >
                                                    <span>{emp.fullName} ({emp.nik || "Tanpa NIK"})</span>
                                                    <span className="text-[10px] text-gray-400 font-medium">{emp.position || "Staff"}</span>
                                                </button>
                                            ))
                                    )}
                                </div>
                            )}

                            {/* Active Display Selected Employee */}
                            {formUserId && (
                                <div className="mt-2 px-3 py-2 bg-primary/5 border border-primary/10 rounded-lg text-xs font-bold text-primary-foreground flex items-center justify-between">
                                    <span>
                                        Terpilih: {activeEmployees.find(e => e.id.toString() === formUserId)?.fullName} ({activeEmployees.find(e => e.id.toString() === formUserId)?.position || "Staff"})
                                    </span>
                                    <button 
                                        type="button" 
                                        onClick={() => setFormUserId("")} 
                                        className="text-red-500 hover:text-red-700 font-bold ml-2 transition-colors cursor-pointer"
                                    >
                                        Batal
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-black text-gray-500 uppercase">Tanggal Resign <span className="text-red-500">*</span></label>
                            <Input
                                type="date"
                                value={formResignDate}
                                onChange={(e) => setFormResignDate(e.target.value)}
                                className="rounded-lg border-gray-200"
                                required
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-black text-gray-500 uppercase">Keterangan Resign <span className="text-red-500">*</span></label>
                            <Textarea
                                placeholder="Tulis alasan resign tenaga kerja di sini secara jelas..."
                                value={formReason}
                                onChange={(e) => setFormReason(e.target.value)}
                                className="rounded-lg border-gray-200 min-h-[100px]"
                                required
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-black text-gray-500 uppercase">Upload Surat/Dokumen Resign</label>
                            <div className="border border-dashed border-gray-200 hover:border-green-300 rounded-lg p-4 bg-gray-50/50 flex flex-col items-center justify-center text-center cursor-pointer relative group transition-colors">
                                <Input
                                    type="file"
                                    onChange={(e) => setFormFile(e.target.files?.[0] || null)}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                                />
                                <Download className="w-6 h-6 text-gray-400 group-hover:text-primary mb-2 transition-colors" />
                                <span className="text-xs font-bold text-gray-700">
                                    {formFile ? formFile.name : "Klik atau seret file di sini untuk mengupload"}
                                </span>
                                <span className="text-[10px] text-gray-400 mt-1">PDF, JPG, PNG, DOC (Maks. 10MB)</span>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2.5 pt-3">
                            <Button
                                type="button"
                                variant="outline"
                                className="rounded-lg cursor-pointer"
                                onClick={() => setOpenAddModal(false)}
                            >
                                Batal
                            </Button>
                            <Button
                                type="submit"
                                disabled={createMutation.isPending}
                                className="bg-primary hover:bg-primary/90 text-white rounded-lg px-6 shadow-sm cursor-pointer"
                            >
                                {createMutation.isPending ? "Menyimpan..." : "Simpan Data"}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Modal: Edit Resign */}
            <Dialog open={openEditModal} onOpenChange={setOpenEditModal}>
                <DialogContent className="max-w-lg rounded-xl">
                    <DialogHeader>
                        <DialogTitle>Perbarui Data Resign Tenaga Kerja</DialogTitle>
                        <DialogDescription>
                            Sunting tanggal, keterangan, atau unggah ulang dokumen surat resign.
                        </DialogDescription>
                    </DialogHeader>
                    {selectedResign && (
                        <form onSubmit={handleEditSubmit} className="space-y-4 pt-2">
                            <div className="p-3 bg-gray-50 rounded-lg flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0">
                                    {selectedResign.user.fullName.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-800 text-sm">{selectedResign.user.fullName}</h4>
                                    <p className="text-xs text-gray-400 font-mono">NIK: {selectedResign.user.nik || "-"}</p>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-gray-500 uppercase">Tanggal Resign <span className="text-red-500">*</span></label>
                                <Input
                                    type="date"
                                    value={formResignDate}
                                    onChange={(e) => setFormResignDate(e.target.value)}
                                    className="rounded-lg border-gray-200"
                                    required
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-gray-500 uppercase">Keterangan Resign <span className="text-red-500">*</span></label>
                                <Textarea
                                    placeholder="Tulis alasan resign tenaga kerja..."
                                    value={formReason}
                                    onChange={(e) => setFormReason(e.target.value)}
                                    className="rounded-lg border-gray-200 min-h-[100px]"
                                    required
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-gray-500 uppercase">Upload Ulang Surat/Dokumen Resign</label>
                                <div className="border border-dashed border-gray-200 hover:border-green-300 rounded-lg p-4 bg-gray-50/50 flex flex-col items-center justify-center text-center cursor-pointer relative group transition-colors">
                                    <Input
                                        type="file"
                                        onChange={(e) => setFormFile(e.target.files?.[0] || null)}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                        accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                                    />
                                    <Download className="w-6 h-6 text-gray-400 group-hover:text-primary mb-2 transition-colors" />
                                    <span className="text-xs font-bold text-gray-700">
                                        {formFile ? formFile.name : "Pilih file baru untuk menggantikan file lama"}
                                    </span>
                                    <span className="text-[10px] text-gray-400 mt-1">Biarkan kosong jika tidak ingin mengubah dokumen</span>
                                </div>
                                {selectedResign.documentUrl && (
                                    <p className="text-[11px] text-primary-foreground font-bold mt-1">
                                        File saat ini: <a href={selectedResign.documentUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-green-800">Lihat dokumen aktif</a>
                                    </p>
                                )}
                            </div>

                            <div className="flex justify-end gap-2.5 pt-3">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="rounded-lg cursor-pointer"
                                    onClick={() => setOpenEditModal(false)}
                                >
                                    Batal
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={updateMutation.isPending}
                                    className="bg-primary hover:bg-primary/90 text-white rounded-lg px-6 shadow-sm cursor-pointer"
                                >
                                    {updateMutation.isPending ? "Memperbarui..." : "Simpan Perubahan"}
                                </Button>
                            </div>
                        </form>
                    )}
                </DialogContent>
            </Dialog>

            {/* Modal: View Resign Detail */}
            <Dialog open={openViewModal} onOpenChange={setOpenViewModal}>
                <DialogContent className="max-w-md rounded-xl">
                    <DialogHeader>
                        <DialogTitle>Detail Resign Tenaga Kerja</DialogTitle>
                        <DialogDescription>
                            Informasi detail pencatatan resignasi tenaga kerja PT Elok Jaya Abadhi.
                        </DialogDescription>
                    </DialogHeader>
                    {selectedResign && (
                        <div className="space-y-4 pt-2">
                            {/* Profile Info */}
                            <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 text-white flex items-center justify-center font-bold text-lg">
                                    {selectedResign.user.fullName.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-900 text-base">{selectedResign.user.fullName}</h4>
                                    <p className="text-xs text-gray-400 font-mono">NIK: {selectedResign.user.nik || "-"}</p>
                                </div>
                            </div>

                            {/* Details List */}
                            <div className="space-y-3.5 text-sm">
                                <div className="grid grid-cols-3">
                                    <span className="text-gray-400 font-medium">Jabatan</span>
                                    <span className="col-span-2 font-bold text-gray-800">{selectedResign.user.position || "-"}</span>
                                </div>
                                <div className="grid grid-cols-3">
                                    <span className="text-gray-400 font-medium">Cabang</span>
                                    <span className="col-span-2 font-bold text-gray-800">{selectedResign.user.branch || "-"}</span>
                                </div>
                                <div className="grid grid-cols-3">
                                    <span className="text-gray-400 font-medium">Tanggal Resign</span>
                                    <span className="col-span-2 font-bold text-gray-800 flex items-center gap-1.5">
                                        <Calendar className="w-4 h-4 text-primary shrink-0" />
                                        {format(new Date(selectedResign.resignDate), "EEEE, dd MMMM yyyy", { locale: id })}
                                    </span>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-gray-400 font-medium block">Keterangan / Alasan Resign</span>
                                    <div className="p-3 bg-gray-50 border border-gray-100 rounded-lg text-gray-700 leading-relaxed max-h-40 overflow-y-auto">
                                        {selectedResign.reason}
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 items-center">
                                    <span className="text-gray-400 font-medium">Surat Resign</span>
                                    <span className="col-span-2">
                                        {selectedResign.documentUrl ? (
                                            <a
                                                href={selectedResign.documentUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/5 text-primary-foreground border border-primary/10 rounded-lg text-xs font-bold hover:bg-primary/10 transition-colors"
                                            >
                                                <Download className="w-3.5 h-3.5" />
                                                Unduh Surat Resign
                                            </a>
                                        ) : (
                                            <span className="text-xs text-gray-400 italic">Dokumen belum diupload</span>
                                        )}
                                    </span>
                                </div>
                            </div>

                            <div className="flex justify-end pt-3">
                                <Button
                                    variant="outline"
                                    className="rounded-lg cursor-pointer"
                                    onClick={() => setOpenViewModal(false)}
                                >
                                    Tutup
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
