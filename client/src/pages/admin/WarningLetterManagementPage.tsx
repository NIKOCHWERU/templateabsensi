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
    ArrowLeftRight,
    AlertTriangle,
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

interface WarningLetterData {
    id: number;
    userId: number;
    type: "SP1" | "SP2" | "SP3";
    startDate: string;
    endDate: string;
    documentUrl: string | null;
    notes: string | null;
    createdAt: string;
    user: {
        fullName: string;
        nik: string | null;
    };
}

interface ActiveEmployee {
    id: number;
    fullName: string;
    nik: string | null;
    role: string;
    employmentStatus: string | null;
}

export default function WarningLetterManagementPage() {
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState("");
    
    // Modals state
    const [openAddModal, setOpenAddModal] = useState(false);
    const [openEditModal, setOpenEditModal] = useState(false);
    const [openViewModal, setOpenViewModal] = useState(false);
    
    // Selected data for edit/view
    const [selectedLetter, setSelectedLetter] = useState<WarningLetterData | null>(null);
    
    // Form fields state
    const [formType, setFormType] = useState<"SP1" | "SP2" | "SP3">("SP1");
    const [formUserId, setFormUserId] = useState("");
    const [formStartDate, setFormStartDate] = useState("");
    const [formEndDate, setFormEndDate] = useState("");
    const [formNotes, setFormNotes] = useState("");
    const [formFile, setFormFile] = useState<File | null>(null);
    const [employeeQuery, setEmployeeQuery] = useState("");

    // Queries
    const { data: lettersList = [], isLoading: isLoadingLetters } = useQuery<WarningLetterData[]>({
        queryKey: ["/api/admin/warning-letters"],
    });

    const { data: employees = [] } = useQuery<ActiveEmployee[]>({
        queryKey: ["/api/admin/users"],
    });

    // Filter active employees (excluding resigned ones)
    const activeEmployees = employees.filter(
        (emp) => emp.role === "employee" && emp.employmentStatus !== "Resign"
    );

    // Mutations
    const createLetter = useMutation({
        mutationFn: async (formData: FormData) => {
            const res = await fetch("/api/admin/warning-letters", {
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
                description: data.message || "Surat peringatan berhasil disimpan.",
                variant: "default",
            });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/warning-letters"] });
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

    const updateLetter = useMutation({
        mutationFn: async ({ id, formData }: { id: number; formData: FormData }) => {
            const res = await fetch(`/api/admin/warning-letters/${id}`, {
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
                description: data.message || "Data SP berhasil diperbarui.",
                variant: "default",
            });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/warning-letters"] });
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

    const deleteLetter = useMutation({
        mutationFn: async (id: number) => {
            const res = await fetch(`/api/admin/warning-letters/${id}`, {
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
                description: data.message || "Data SP berhasil dihapus.",
                variant: "default",
            });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/warning-letters"] });
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
        setFormType("SP1");
        setFormStartDate("");
        setFormEndDate("");
        setFormNotes("");
        setFormFile(null);
        setSelectedLetter(null);
        setEmployeeQuery("");
    };

    const handleEditClick = (letter: WarningLetterData) => {
        setSelectedLetter(letter);
        setFormType(letter.type);
        setFormStartDate(letter.startDate.split('T')[0] || "");
        setFormEndDate(letter.endDate.split('T')[0] || "");
        setFormNotes(letter.notes || "");
        setFormFile(null);
        setOpenEditModal(true);
    };

    const handleViewClick = (letter: WarningLetterData) => {
        setSelectedLetter(letter);
        setOpenViewModal(true);
    };

    const handleAddSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formUserId || !formStartDate || !formEndDate) {
            toast({
                title: "Peringatan",
                description: "Silakan isi semua kolom yang wajib diisi.",
                variant: "destructive",
            });
            return;
        }

        const formData = new FormData();
        formData.append("userId", formUserId);
        formData.append("type", formType);
        formData.append("startDate", formStartDate);
        formData.append("endDate", formEndDate);
        formData.append("notes", formNotes);
        if (formFile) {
            formData.append("document", formFile);
        }

        createLetter.mutate(formData);
    };

    const handleEditSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedLetter || !formStartDate || !formEndDate) return;

        const formData = new FormData();
        formData.append("type", formType);
        formData.append("startDate", formStartDate);
        formData.append("endDate", formEndDate);
        formData.append("notes", formNotes);
        if (formFile) {
            formData.append("document", formFile);
        }

        updateLetter.mutate({ id: selectedLetter.id, formData });
    };

    const handleDelete = (id: number) => {
        if (confirm("Apakah Anda yakin ingin menghapus data surat peringatan ini?")) {
            deleteLetter.mutate(id);
        }
    };

    const filteredLetters = lettersList.filter((letter) =>
        letter.user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (letter.user.nik && letter.user.nik.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const searchedEmployees = employeeQuery.trim() === "" ? [] : activeEmployees.filter(emp =>
        emp.fullName.toLowerCase().includes(employeeQuery.toLowerCase()) ||
        (emp.nik && emp.nik.toLowerCase().includes(employeeQuery.toLowerCase()))
    ).slice(0, 5);

    const getTypeColor = (type: string) => {
        if (type === 'SP1') return 'text-orange-600 bg-orange-50 border-orange-100';
        if (type === 'SP2') return 'text-red-500 bg-red-50 border-red-100';
        if (type === 'SP3') return 'text-red-700 bg-red-100 border-red-200';
        return 'text-gray-600 bg-gray-50 border-gray-100';
    };

    return (
        <div className="min-h-screen bg-gray-50/50 pb-20">
            {/* Header */}
            <div className="bg-white border-b border-gray-100 sticky top-0 z-10 px-4 md:px-8 py-4">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={() => setLocation("/admin")} className="rounded-full hover:bg-gray-100">
                            <ChevronLeft className="w-5 h-5 text-gray-600" />
                        </Button>
                        <div>
                            <h1 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">Manajemen Surat Peringatan</h1>
                            <p className="text-sm text-gray-500 font-medium">Kelola data SP1, SP2, dan SP3 tenaga kerja.</p>
                        </div>
                    </div>
                    <Button
                        onClick={() => { resetForm(); setOpenAddModal(true); }}
                        className="bg-primary hover:bg-primary/90 text-white rounded-xl shadow-sm gap-2 h-11 px-6 w-full md:w-auto"
                    >
                        <Plus className="w-4 h-4" />
                        Tambah SP Baru
                    </Button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-6">
                <Card className="border-gray-100 shadow-sm rounded-xl overflow-hidden">
                    <div className="p-4 md:p-6 border-b border-gray-100 bg-white flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="relative w-full md:w-96">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                                placeholder="Cari nama tenaga kerja..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 rounded-lg border-gray-200"
                            />
                        </div>
                        <div className="text-xs text-gray-400 font-medium">
                            Menampilkan {filteredLetters.length} data SP.
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100 text-xs font-black text-gray-400 uppercase tracking-wider">
                                    <th className="py-4 px-6 text-center w-16">No</th>
                                    <th className="py-4 px-6">Nama Tenaga Kerja</th>
                                    <th className="py-4 px-6 text-center">Tipe SP</th>
                                    <th className="py-4 px-6 text-center">Tanggal Dibuat</th>
                                    <th className="py-4 px-6 text-center">Tanggal Berakhir</th>
                                    <th className="py-4 px-6 text-center">Dokumen</th>
                                    <th className="py-4 px-6 text-center w-40">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 text-sm">
                                {isLoadingLetters ? (
                                    <tr>
                                        <td colSpan={7} className="py-12 text-center text-gray-400">
                                            Memuat data...
                                        </td>
                                    </tr>
                                ) : filteredLetters.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="py-12 text-center text-gray-400">
                                            Tidak ada data surat peringatan yang ditemukan.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredLetters.map((letter, index) => (
                                        <tr key={letter.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="py-4 px-6 text-center text-gray-500 font-medium">
                                                {index + 1}
                                            </td>
                                            <td className="py-4 px-6">
                                                <div className="font-bold text-gray-900">{letter.user.fullName}</div>
                                                <div className="text-xs text-gray-500">{letter.user.nik || "-"}</div>
                                            </td>
                                            <td className="py-4 px-6 text-center">
                                                <span className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border ${getTypeColor(letter.type)}`}>
                                                    {letter.type}
                                                </span>
                                            </td>
                                            <td className="py-4 px-6 text-center text-gray-600">
                                                {format(new Date(letter.startDate), "d MMM yyyy", { locale: id })}
                                            </td>
                                            <td className="py-4 px-6 text-center text-gray-600">
                                                {format(new Date(letter.endDate), "d MMM yyyy", { locale: id })}
                                            </td>
                                            <td className="py-4 px-6 text-center">
                                                {letter.documentUrl ? (
                                                    <a href={letter.documentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors" title="Lihat Dokumen">
                                                        <FileText className="w-4 h-4" />
                                                    </a>
                                                ) : (
                                                    <span className="text-xs text-gray-400 italic">-</span>
                                                )}
                                            </td>
                                            <td className="py-4 px-6 text-center">
                                                <div className="flex justify-center gap-2">
                                                    <Button variant="outline" size="icon" onClick={() => handleViewClick(letter)} className="w-8 h-8 rounded-lg text-blue-600 border-blue-100 hover:bg-blue-50" title="Detail">
                                                        <Eye className="w-4 h-4" />
                                                    </Button>
                                                    <Button variant="outline" size="icon" onClick={() => handleEditClick(letter)} className="w-8 h-8 rounded-lg text-orange-600 border-orange-100 hover:bg-orange-50" title="Edit">
                                                        <Edit2 className="w-4 h-4" />
                                                    </Button>
                                                    <Button variant="outline" size="icon" onClick={() => handleDelete(letter.id)} className="w-8 h-8 rounded-lg text-red-600 border-red-100 hover:bg-red-50" title="Hapus">
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
                </Card>
            </div>

            {/* Modal Tambah SP */}
            <Dialog open={openAddModal} onOpenChange={(val) => { if (!val) resetForm(); setOpenAddModal(val); }}>
                <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden bg-white rounded-2xl">
                    <DialogHeader className="px-6 py-4 bg-gray-50 border-b border-gray-100">
                        <DialogTitle className="text-lg font-black text-gray-900 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-red-500" />
                            Tambah Surat Peringatan (SP)
                        </DialogTitle>
                        <DialogDescription className="text-xs text-gray-500">
                            Masukkan detail surat peringatan untuk tenaga kerja.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-black text-gray-500 uppercase">Pilih Tenaga Kerja</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <Input
                                    placeholder="Ketik nama tenaga kerja..."
                                    value={employeeQuery}
                                    onChange={(e) => {
                                        setEmployeeQuery(e.target.value);
                                        setFormUserId("");
                                    }}
                                    className="pl-9"
                                />
                                {employeeQuery && searchedEmployees.length > 0 && !formUserId && (
                                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-100 shadow-lg rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                                        {searchedEmployees.map((emp) => (
                                            <div
                                                key={emp.id}
                                                className="px-4 py-2 hover:bg-gray-50 cursor-pointer flex items-center justify-between border-b border-gray-50 last:border-0"
                                                onClick={() => {
                                                    setFormUserId(emp.id.toString());
                                                    setEmployeeQuery(emp.fullName);
                                                }}
                                            >
                                                <div>
                                                    <div className="font-bold text-sm text-gray-900">{emp.fullName}</div>
                                                    <div className="text-xs text-gray-500">{emp.nik || "Tanpa NIK"}</div>
                                                </div>
                                                <Button size="sm" variant="ghost" className="h-7 text-xs text-primary font-bold hover:bg-primary/5">
                                                    Pilih
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-gray-500 uppercase">Tipe Surat</label>
                                <Select value={formType} onValueChange={(v: "SP1" | "SP2" | "SP3") => setFormType(v)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Pilih Tipe" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="SP1">SP 1 (Pertama)</SelectItem>
                                        <SelectItem value="SP2">SP 2 (Kedua)</SelectItem>
                                        <SelectItem value="SP3">SP 3 (Ketiga)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-gray-500 uppercase">Tanggal Dibuat</label>
                                <Input type="date" value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} required />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-gray-500 uppercase">Tanggal Berakhir</label>
                                <Input type="date" value={formEndDate} onChange={(e) => setFormEndDate(e.target.value)} required />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-black text-gray-500 uppercase">Keterangan / Alasan</label>
                            <Textarea 
                                placeholder="Jelaskan alasan diberikannya SP..." 
                                value={formNotes} 
                                onChange={(e) => setFormNotes(e.target.value)}
                                className="min-h-[100px] resize-none"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-black text-gray-500 uppercase">Upload Dokumen SP</label>
                            <div className="border border-dashed border-gray-200 hover:border-green-300 rounded-lg p-4 bg-gray-50/50 flex flex-col items-center justify-center text-center cursor-pointer relative group transition-colors">
                                <Input
                                    type="file"
                                    onChange={(e) => setFormFile(e.target.files?.[0] || null)}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                                />
                                <Download className="w-6 h-6 text-gray-400 group-hover:text-primary mb-2 transition-colors" />
                                <span className="text-xs font-bold text-gray-700">
                                    {formFile ? formFile.name : "Klik atau seret file SP di sini"}
                                </span>
                                <span className="text-[10px] text-gray-400 mt-1">PDF, JPG, PNG (Maks. 10MB)</span>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2.5 pt-3">
                            <Button type="button" variant="outline" onClick={() => setOpenAddModal(false)}>Batal</Button>
                            <Button type="submit" disabled={createLetter.isPending} className="bg-primary hover:bg-primary/90 text-white">
                                {createLetter.isPending ? "Menyimpan..." : "Simpan Data"}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Modal Edit SP */}
            <Dialog open={openEditModal} onOpenChange={(val) => { if (!val) resetForm(); setOpenEditModal(val); }}>
                <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden bg-white rounded-2xl">
                    <DialogHeader className="px-6 py-4 bg-gray-50 border-b border-gray-100">
                        <DialogTitle className="text-lg font-black text-gray-900 flex items-center gap-2">
                            <Edit2 className="w-5 h-5 text-orange-500" />
                            Edit Surat Peringatan
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-gray-500 uppercase">Tipe Surat</label>
                                <Select value={formType} onValueChange={(v: "SP1" | "SP2" | "SP3") => setFormType(v)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Pilih Tipe" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="SP1">SP 1 (Pertama)</SelectItem>
                                        <SelectItem value="SP2">SP 2 (Kedua)</SelectItem>
                                        <SelectItem value="SP3">SP 3 (Ketiga)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-gray-500 uppercase">Tanggal Dibuat</label>
                                <Input type="date" value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} required />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-gray-500 uppercase">Tanggal Berakhir</label>
                                <Input type="date" value={formEndDate} onChange={(e) => setFormEndDate(e.target.value)} required />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-black text-gray-500 uppercase">Keterangan / Alasan</label>
                            <Textarea 
                                placeholder="Jelaskan alasan diberikannya SP..." 
                                value={formNotes} 
                                onChange={(e) => setFormNotes(e.target.value)}
                                className="min-h-[100px] resize-none"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-black text-gray-500 uppercase">Upload Dokumen (Opsional)</label>
                            <div className="border border-dashed border-gray-200 hover:border-orange-300 rounded-lg p-4 bg-gray-50/50 flex flex-col items-center justify-center text-center cursor-pointer relative group transition-colors">
                                <Input
                                    type="file"
                                    onChange={(e) => setFormFile(e.target.files?.[0] || null)}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                                />
                                <Download className="w-6 h-6 text-gray-400 group-hover:text-orange-600 mb-2 transition-colors" />
                                <span className="text-xs font-bold text-gray-700">
                                    {formFile ? formFile.name : "Klik/seret file baru untuk mengganti dokumen lama"}
                                </span>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2.5 pt-3">
                            <Button type="button" variant="outline" onClick={() => setOpenEditModal(false)}>Batal</Button>
                            <Button type="submit" disabled={updateLetter.isPending} className="bg-orange-600 hover:bg-orange-700 text-white">
                                {updateLetter.isPending ? "Menyimpan..." : "Simpan Perubahan"}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Modal Detail SP */}
            <Dialog open={openViewModal} onOpenChange={setOpenViewModal}>
                <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-white rounded-2xl">
                    <DialogHeader className="px-6 py-4 bg-gray-50 border-b border-gray-100">
                        <DialogTitle className="text-lg font-black text-gray-900 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-blue-500" />
                            Detail Surat Peringatan
                        </DialogTitle>
                    </DialogHeader>
                    {selectedLetter && (
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Tenaga Kerja</label>
                                <div className="font-bold text-gray-900">{selectedLetter.user.fullName}</div>
                                <div className="text-xs text-gray-500">{selectedLetter.user.nik || "-"}</div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Tipe SP</label>
                                    <div className="font-bold text-gray-900">{selectedLetter.type}</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Tanggal Dibuat</label>
                                    <div className="font-bold text-gray-900">{format(new Date(selectedLetter.startDate), "d MMMM yyyy", { locale: id })}</div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Tanggal Berakhir</label>
                                    <div className="font-bold text-gray-900">{format(new Date(selectedLetter.endDate), "d MMMM yyyy", { locale: id })}</div>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Keterangan / Alasan</label>
                                <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-100 mt-1 whitespace-pre-line">
                                    {selectedLetter.notes || "-"}
                                </div>
                            </div>

                            {selectedLetter.documentUrl && (
                                <div className="pt-2">
                                    <a href={selectedLetter.documentUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold transition-colors">
                                        <FileText className="w-4 h-4" />
                                        Buka Dokumen SP
                                    </a>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
