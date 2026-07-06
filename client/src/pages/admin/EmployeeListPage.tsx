import { useQuery, useMutation } from "@tanstack/react-query";
import { User, Attendance, Shift } from "@shared/schema";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { ArrowLeft, UserPlus, UserMinus, Search, Calendar, Phone, Image as ImageIcon, ImageOff, MapPin, Trash2, MessageSquare, Upload, Eye, Briefcase, CreditCard, User as UserIcon, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { AttendanceCalendar } from "@/components/AttendanceCalendar";
import { toTitleCase, formatAddress } from "@/lib/utils";
import { addMonths, subMonths, format, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addDays, getWeek, getYear, addWeeks, subWeeks } from "date-fns";
import { id } from "date-fns/locale";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Helper for CSV export
const handleExportCSV = (employees: User[]) => {
    const headers = ["NIK", "Nama Lengkap", "Nomor HP", "Email", "Cabang", "Jabatan", "Agama", "NPWP", "BPJS"];
    const rows = employees.map(emp => [
        emp.nik || "",
        emp.fullName || "",
        emp.phoneNumber || "",
        emp.email || "",
        emp.branch || "",
        emp.position || "",
        (emp as any).religion || "",
        (emp as any).npwp || "",
        (emp as any).bpjs || ""
    ]);

    const csvContent = [
        headers.join(","),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Data_Tenaga Kerja_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export default function AdminEmployeeList() {
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const [open, setOpen] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState<User | null>(null);
    const [viewEmployee, setViewEmployee] = useState<User | null>(null);
    const [viewResignEmployee, setViewResignEmployee] = useState<User | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [attendanceViewDate, setAttendanceViewDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
    const [weekDate, setWeekDate] = useState(new Date());

    const { data: complaintsStats } = useQuery<{ pendingCount: number }>({
        queryKey: ["/api/admin/complaints/stats"],
        refetchInterval: 5000,
    });

    const { data: users = [], isLoading } = useQuery<User[]>({
        queryKey: ["/api/admin/users"],
        refetchInterval: 5000,
    });

    const { data: resignations = [] } = useQuery<any[]>({
        queryKey: ["/api/admin/resignations"],
    });

    // Fetch attendance for selected employee if needed
    const { data: employeeAttendance } = useQuery<Attendance[]>({
        queryKey: ["/api/attendance", selectedEmployee?.id, attendanceViewDate.toISOString()],
        refetchInterval: 5000,
        queryFn: async () => {
            if (!selectedEmployee) return [];
            const res = await fetch(`/api/attendance?userId=${selectedEmployee.id}`);
            if (!res.ok) throw new Error("Failed to fetch");
            return res.json();
        },
        enabled: !!selectedEmployee
    });

    // Add shifts query
    const { data: shifts = [] } = useQuery<Shift[]>({
        queryKey: ["/api/shifts"],
    });

    const employees = users?.filter(u => u.role === 'employee') || [];
    const existingBranches = Array.from(new Set(employees.map(u => u.branch).filter(Boolean))) as string[];
    const existingPositions = Array.from(new Set(employees.map(u => u.position).filter(Boolean))) as string[];
    const { user } = useAuth();

    // Create a more flexible schema for the form
    const formSchema = z.object({
        fullName: z.string().min(1, "Nama lengkap wajib diisi"),
        password: z.string().optional(),
        role: z.string(),
        nik: z.string().optional(),
        branch: z.string().optional(),
        position: z.string().optional(),
        email: z.string().optional(),
        username: z.string().optional(),
        phoneNumber: z.string().optional(),
        religion: z.string().optional(),
        npwp: z.string().optional(),
        bpjs: z.string().optional(),
        birthPlace: z.string().optional(),
        birthDate: z.string().optional(),
        gender: z.string().optional(),
        address: z.string().optional(),
        joinDate: z.string().optional(),
        employmentStatus: z.string().optional(),
        registrationStatus: z.string().optional(),
        shift: z.string().nullable().optional(),
    });

    const form = useForm({
        resolver: zodResolver(formSchema),
        defaultValues: {
            fullName: "",
            password: "",
            role: "employee",
            nik: "",
            branch: "Pusat",
            position: "Staff",
            email: "",
            username: "",
            phoneNumber: "",
            religion: "",
            npwp: "",
            bpjs: "",
            birthPlace: "",
            birthDate: "",
            gender: "Laki-laki",
            address: "",
            joinDate: "",
            employmentStatus: "Kontrak",
            registrationStatus: "approved",
            shift: "-"
        }
    });

    const [searchTerm, setSearchTerm] = useState("");
    const [sortField, setSortField] = useState<string>('fullName');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

    const toggleSort = (field: string) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('asc');
        }
    };

    const filteredEmployees = employees.filter(emp => {
        if (!searchTerm) return true;
        const lowerTerm = searchTerm.toLowerCase();
        return emp.fullName.toLowerCase().includes(lowerTerm) || 
               (emp.nik && emp.nik.toLowerCase().includes(lowerTerm)) ||
               (emp.position && emp.position.toLowerCase().includes(lowerTerm)) ||
               (emp.branch && emp.branch.toLowerCase().includes(lowerTerm));
    });

    const sortedEmployees = [...filteredEmployees].sort((a, b) => {
        const valA = (a as any)[sortField]?.toString().toLowerCase() || '';
        const valB = (b as any)[sortField]?.toString().toLowerCase() || '';
        
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
    });

    const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
    const [selectedNpwpPhoto, setSelectedNpwpPhoto] = useState<File | null>(null);
    const [selectedBpjsPhoto, setSelectedBpjsPhoto] = useState<File | null>(null);
    const [selectedKtpPhoto, setSelectedKtpPhoto] = useState<File | null>(null);
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [csvOpen, setCsvOpen] = useState(false);
    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([]);

    const csvMutation = useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData();
            formData.append('file', file);
            const res = await fetch('/api/admin/users/upload', {
                method: 'POST',
                body: formData
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || "Failed to upload");
            }
            return res.json();
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
            toast({ title: "Berhasil", description: data.message });
            setCsvOpen(false);
            setCsvFile(null);
        },
        onError: (err: any) => {
            toast({ title: "Gagal", description: err.message, variant: "destructive" });
        }
    });

    const upsertMutation = useMutation({
        mutationFn: async (data: any) => {
            const formData = new FormData();
            console.log("[EmployeeListPage] Submitting user data:", data);
            Object.keys(data).forEach(key => {
                if (data[key] !== undefined && data[key] !== null) {
                    formData.append(key, data[key]);
                }
            });

            if (selectedPhoto) {
                formData.append('photo', selectedPhoto);
            }
            if (selectedKtpPhoto) {
                formData.append("ktpPhoto", selectedKtpPhoto);
            }
            if (selectedBpjsPhoto) {
                formData.append("bpjsPhoto", selectedBpjsPhoto);
            }
            if (selectedNpwpPhoto) {
                formData.append("npwpPhoto", selectedNpwpPhoto);
            }

            const url = selectedEmployee ? `/api/admin/users/${selectedEmployee.id}` : "/api/admin/users";
            const method = selectedEmployee ? "PATCH" : "POST";

            const res = await fetch(url, {
                method,
                body: formData,
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || "Failed to save");
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
            toast({ title: "Berhasil", description: selectedEmployee ? "Tenaga Kerja diperbarui" : "Tenaga Kerja ditambahkan" });
            setOpen(false);
            form.reset();
            setSelectedEmployee(null);
            setSelectedPhoto(null);
            setSelectedBpjsPhoto(null);
            setSelectedNpwpPhoto(null);
            setSelectedKtpPhoto(null);
        },
        onError: (err: any) => {
            toast({ title: "Gagal", description: err.message, variant: "destructive" });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            await apiRequest("DELETE", `/api/admin/users/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
            toast({ title: "Berhasil", description: "Tenaga Kerja berhasil dihapus" });
        },
        onError: (err: any) => {
            toast({ title: "Gagal", description: "Gagal menghapus tenaga kerja: " + err.message, variant: "destructive" });
        }
    });

    const bulkDeleteMutation = useMutation({
        mutationFn: async (userIds: number[]) => {
            const res = await apiRequest("POST", "/api/admin/users/bulk-delete", { userIds });
            return await res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
            toast({ title: "Berhasil", description: "Tenaga Kerja terpilih telah dihapus." });
            setSelectedEmployeeIds([]);
        },
        onError: (err: any) => {
            toast({ title: "Gagal Menghapus", description: err.message, variant: "destructive" });
        }
    });

    const handleNext = () => {
        if (viewMode === 'month') setAttendanceViewDate(d => addMonths(d, 1));
        else setWeekDate(d => addWeeks(d, 1));
    };

    const handlePrev = () => {
        if (viewMode === 'month') setAttendanceViewDate(d => subMonths(d, 1));
        else setWeekDate(d => subWeeks(d, 1));
    };

    return (
        <div className="space-y-6">
            

            <div className="space-y-6">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight">Daftar Tenaga Kerja</h1>
                    <p className="text-sm text-gray-500">Kelola informasi data diri, shift kerja, dan status verifikasi tenaga kerja.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                                        <Button variant="outline" className="rounded-lg border-gray-200 hover:bg-gray-50 bg-white" onClick={() => setCsvOpen(true)}>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload CSV
                    </Button>
                    <Button 
                        variant="outline" 
                        className="rounded-lg border-gray-200 hover:bg-gray-50 bg-white"
                        onClick={() => handleExportCSV(employees)}
                    >
                        <Upload className="mr-2 h-4 w-4 rotate-180" />
                        Export CSV
                    </Button>
                    <Button
                        className="bg-primary hover:bg-primary/90 text-white rounded-lg gap-2 shadow-sm"
                        onClick={() => {
                            setSelectedEmployee(null);
                            form.reset({
                                fullName: "",
                                password: "",
                                role: "employee",
                                nik: "",
                                branch: "Pusat",
                                position: "Staff",
                                email: "",
                                username: "",
                                phoneNumber: "",
                                religion: "",
                                npwp: "",
                                bpjs: "",
                                birthPlace: "",
                                birthDate: "",
                                gender: "Laki-laki",
                                address: "",
                                joinDate: "",
                                employmentStatus: "Kontrak",
                                registrationStatus: "approved",
                                shift: "-"
                            });
                            setSelectedBpjsPhoto(null);
                            setSelectedNpwpPhoto(null);
                            setSelectedKtpPhoto(null);
                            setSelectedPhoto(null);
                            setOpen(true);
                        }}
                    >
                        <UserPlus className="w-4 h-4" />
                        Tambah Tenaga Kerja
                    </Button>
                </div>
            </div>

            <div className="space-y-6">
                <div className="flex items-center gap-4 mb-6">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input 
                            placeholder="Cari nama, NIK, jabatan, cabang..." 
                            className="pl-9" 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)} 
                        />
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {user?.role === 'superadmin' && (
                                    <TableHead className="w-[40px] text-center">
                                        <Checkbox 
                                            checked={selectedEmployeeIds.length === employees.length && employees.length > 0}
                                            onCheckedChange={(checked) => {
                                                if (checked) {
                                                    setSelectedEmployeeIds(employees.map(e => e.id));
                                                } else {
                                                    setSelectedEmployeeIds([]);
                                                }
                                            }}
                                        />
                                    </TableHead>
                                )}
                                <TableHead className="w-[50px] cursor-pointer hover:text-primary" onClick={() => toggleSort('id')}>No</TableHead>
                                <TableHead className="cursor-pointer hover:text-primary" onClick={() => toggleSort('fullName')}>
                                    <div className="flex items-center gap-1">Nama <ArrowLeft className={`h-3 w-3 rotate-90 ${sortField === 'fullName' ? 'text-primary' : 'text-gray-300'}`} /></div>
                                </TableHead>
                                <TableHead className="cursor-pointer hover:text-primary" onClick={() => toggleSort('nik')}>NIK</TableHead>
                                <TableHead className="cursor-pointer hover:text-primary" onClick={() => toggleSort('shift')}>Shift</TableHead>
                                <TableHead className="cursor-pointer hover:text-primary" onClick={() => toggleSort('position')}>Jabatan</TableHead>
                                <TableHead className="cursor-pointer hover:text-primary" onClick={() => toggleSort('branch')}>Cabang</TableHead>
                                <TableHead className="cursor-pointer hover:text-primary" onClick={() => toggleSort('registrationStatus')}>Status Data</TableHead>
                                <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedEmployees.map((emp, index) => (
                                <TableRow key={emp.id}>
                                    {user?.role === 'superadmin' && (
                                        <TableCell className="text-center">
                                            <Checkbox 
                                                checked={selectedEmployeeIds.includes(emp.id)}
                                                onCheckedChange={(checked) => {
                                                    if (checked) {
                                                        setSelectedEmployeeIds(prev => [...prev, emp.id]);
                                                    } else {
                                                        setSelectedEmployeeIds(prev => prev.filter(id => id !== emp.id));
                                                    }
                                                }}
                                            />
                                        </TableCell>
                                    )}
                                    <TableCell className="font-medium">{index + 1}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 aspect-[2/3] bg-gray-100 rounded flex items-center justify-center overflow-hidden shrink-0 border border-gray-200">
                                                {emp.photoUrl ? (
                                                    <img src={emp.photoUrl} className="w-full h-full object-cover" alt={emp.fullName} />
                                                ) : (
                                                    <div className="text-xs font-bold text-gray-400">{emp.fullName.charAt(0)}</div>
                                                )}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-medium text-gray-900">{toTitleCase(emp.fullName)}</span>
                                                {emp.phoneNumber && (
                                                    <span className="text-xs text-gray-500 flex items-center gap-1">
                                                        <Phone className="w-3 h-3" /> {emp.phoneNumber}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-mono text-gray-600">{emp.nik}</TableCell>
                                    <TableCell>
                                        {emp.shift && emp.shift !== '-' && emp.shift.toLowerCase() !== 'management' ? (
                                            <Badge variant="outline" className="bg-primary/5 text-primary-foreground border-primary/20 text-[10px] font-bold">
                                                {emp.shift}
                                            </Badge>
                                        ) : (
                                            <span className="text-gray-400 text-[10px] italic">Belum Tercatat</span>
                                        )}
                                    </TableCell>
                                    <TableCell>{toTitleCase(emp.position)}</TableCell>
                                    <TableCell>{toTitleCase(emp.branch)}</TableCell>
                                    <TableCell>
                                        {((emp as any).employmentStatus === 'Resign' || resignations.some((r: any) => r.userId === emp.id)) ? (
                                            <Badge variant="destructive" className="capitalize cursor-pointer hover:bg-red-700 font-bold shadow-sm" onClick={() => setViewResignEmployee(emp)}>
                                                Resign
                                            </Badge>
                                        ) : (
                                            <Badge variant={
                                                emp.registrationStatus === 'approved' ? 'default' :
                                                emp.registrationStatus === 'pending' ? 'secondary' :
                                                emp.registrationStatus === 'rejected' ? 'destructive' : 'outline'
                                            } className="capitalize">
                                                {emp.registrationStatus || 'unregistered'}
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="text-amber-600 border-amber-200 hover:bg-amber-50"
                                                onClick={() => {
                                                    setSelectedEmployee(emp);
                                                    form.reset({
                                                        fullName: emp.fullName,
                                                        nik: emp.nik || "",
                                                        role: emp.role,
                                                        branch: emp.branch || "",
                                                        position: emp.position || "",
                                                        phoneNumber: emp.phoneNumber || "",
                                                        username: emp.username || "",
                                                        religion: (emp as any).religion || "",
                                                        npwp: (emp as any).npwp || "",
                                                        bpjs: (emp as any).bpjs || "",
                                                        password: "",
                                                        birthPlace: (emp as any).birthPlace || "",
                                                        birthDate: emp.birthDate ? format(new Date(emp.birthDate), "yyyy-MM-dd") : "",
                                                        gender: (emp as any).gender || "Laki-laki",
                                                        address: (emp as any).address || "",
                                                        joinDate: (emp as any).joinDate || "",
                                                        employmentStatus: (emp as any).employmentStatus || "Kontrak",
                                                        registrationStatus: (emp as any).registrationStatus || "approved",
                                                        shift: emp.shift || "-",
                                                        email: emp.email || ""
                                                    });
                                                    setOpen(true);
                                                }}
                                            >
                                                Edit
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                                                onClick={() => setViewEmployee(emp)}
                                            >
                                                <Eye className="w-4 h-4 mr-1" />
                                                View
                                            </Button>
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="text-blue-600 border-blue-200 hover:bg-blue-50"
                                                        onClick={() => {
                                                            setSelectedEmployee(emp);
                                                            setAttendanceViewDate(new Date());
                                                            setSelectedDate(null);
                                                        }}
                                                    >
                                                        <Calendar className="w-4 h-4 mr-1" />
                                                        Absensi
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                                                    <DialogHeader>
                                                        <DialogTitle>Riwayat Absensi - {emp.fullName}</DialogTitle>
                                                        <DialogDescription>
                                                            Daftar kehadiran dan aktivitas tenaga kerja.
                                                        </DialogDescription>
                                                    </DialogHeader>
                                                    <div className="mt-4">
                                                        <AttendanceCalendar
                                                            currentDate={attendanceViewDate}
                                                            onNextMonth={handleNext}
                                                            onPrevMonth={handlePrev}
                                                            attendanceData={employeeAttendance || []}
                                                            onDateSelect={(date) => {
                                                                setSelectedDate(date);
                                                            }}
                                                            viewMode={viewMode}
                                                            setViewMode={setViewMode}
                                                            weekDate={weekDate}
                                                        />
                                                    </div>

                                                    {/* Detailed Inline View - Shows only when a date is selected */}
                                                    {selectedDate && (
                                                        <div className="mt-8 space-y-6">
                                                            <h4 className="font-bold text-gray-800 border-b pb-2">
                                                                Detail {format(selectedDate, "EEEE, d MMM yyyy", { locale: id })}
                                                            </h4>

                                                            {(() => {
                                                                // Find ALL records for the selected date
                                                                const sessions = employeeAttendance?.filter(a =>
                                                                    new Date(a.date).toDateString() === selectedDate.toDateString()
                                                                ).sort((a, b) => (a as any).sessionNumber - (b as any).sessionNumber) || [];

                                                                if (sessions.length === 0) {
                                                                    return (
                                                                        <div className="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                                                            <p className="text-gray-400">Tidak ada data absensi pada tanggal ini.</p>
                                                                        </div>
                                                                    );
                                                                }

                                                                return sessions.map((att, index) => (
                                                                    <div key={att.id} className="bg-white border rounded-xl overflow-hidden shadow-sm animate-in fade-in slide-in-from-top-4 mb-6">
                                                                        <div className="bg-gray-50 p-3 border-b flex justify-between items-center">
                                                                            <span className="font-bold text-gray-800">
                                                                                Sesi Ke-{(att as any).sessionNumber || (index + 1)}
                                                                            </span>
                                                                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${att.status === 'present' ? 'bg-primary/10 text-primary-foreground' :
                                                                                att.status === 'late' ? 'bg-red-100 text-red-700' :
                                                                                    att.status === 'sick' ? 'bg-blue-100 text-blue-700' :
                                                                                        att.status === 'permission' ? 'bg-purple-100 text-purple-700' :
                                                                                            'bg-gray-100 text-gray-700'
                                                                                }`}>
                                                                                {att.status === 'present' ? 'Hadir' :
                                                                                    att.status === 'late' ? 'Telat' :
                                                                                        att.status === 'sick' ? 'Sakit' :
                                                                                            att.status === 'permission' ? 'Izin' :
                                                                                                att.status === 'absent' ? 'Alpha' : att.status}
                                                                            </span>
                                                                        </div>
                                                                        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                                                                            {/* Masuk */}
                                                                            <div className="space-y-2">
                                                                                <p className="text-xs font-semibold text-gray-500 text-center">Masuk</p>
                                                                                <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border flex items-center justify-center">
                                                                                    {att.checkInPhoto ? (
                                                                                        <a
                                                                                            href={`https://drive.google.com/file/d/${att.checkInPhoto}/view`}
                                                                                            target="_blank"
                                                                                            rel="noopener noreferrer"
                                                                                            className="w-full h-full flex items-center justify-center hover:bg-blue-50 transition-colors group"
                                                                                        >
                                                                                            <ImageIcon className="w-12 h-12 text-blue-600 group-hover:scale-110 transition-transform" />
                                                                                        </a>
                                                                                    ) : (
                                                                                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                                                            <ImageOff className="w-12 h-12" />
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                                <p className="text-center font-mono text-sm font-bold text-primary">
                                                                                    {att.checkIn ? new Date(att.checkIn).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                                                                                </p>
                                                                            </div>

                                                                            {/* Mulai Istirahat */}
                                                                            <div className="space-y-2">
                                                                                <p className="text-xs font-semibold text-gray-500 text-center">Mulai Istirahat</p>
                                                                                <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border flex items-center justify-center">
                                                                                    {att.breakStartPhoto ? (
                                                                                        <a
                                                                                            href={`https://drive.google.com/file/d/${att.breakStartPhoto}/view`}
                                                                                            target="_blank"
                                                                                            rel="noopener noreferrer"
                                                                                            className="w-full h-full flex items-center justify-center hover:bg-primary/5 transition-colors group"
                                                                                        >
                                                                                            <ImageIcon className="w-12 h-12 text-primary group-hover:scale-110 transition-transform" />
                                                                                        </a>
                                                                                    ) : (
                                                                                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                                                            <ImageOff className="w-12 h-12" />
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                                <p className="text-center font-mono text-sm font-bold text-primary">
                                                                                    {att.breakStart ? new Date(att.breakStart).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                                                                                </p>
                                                                            </div>

                                                                            {/* Selesai Istirahat */}
                                                                            <div className="space-y-2">
                                                                                <p className="text-xs font-semibold text-gray-500 text-center">Selesai Istirahat</p>
                                                                                <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border flex items-center justify-center">
                                                                                    {att.breakEndPhoto ? (
                                                                                        <a
                                                                                            href={`https://drive.google.com/file/d/${att.breakEndPhoto}/view`}
                                                                                            target="_blank"
                                                                                            rel="noopener noreferrer"
                                                                                            className="w-full h-full flex items-center justify-center hover:bg-primary/5 transition-colors group"
                                                                                        >
                                                                                            <ImageIcon className="w-12 h-12 text-primary group-hover:scale-110 transition-transform" />
                                                                                        </a>
                                                                                    ) : (
                                                                                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                                                            <ImageOff className="w-12 h-12" />
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                                <p className="text-center font-mono text-sm font-bold text-primary">
                                                                                    {att.breakEnd ? new Date(att.breakEnd).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                                                                                </p>
                                                                            </div>

                                                                            {/* Pulang */}
                                                                            <div className="space-y-2">
                                                                                <p className="text-xs font-semibold text-gray-500 text-center">Pulang</p>
                                                                                <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border flex items-center justify-center">
                                                                                    {att.checkOutPhoto ? (
                                                                                        <a
                                                                                            href={`https://drive.google.com/file/d/${att.checkOutPhoto}/view`}
                                                                                            target="_blank"
                                                                                            rel="noopener noreferrer"
                                                                                            className="w-full h-full flex items-center justify-center hover:bg-red-50 transition-colors group"
                                                                                        >
                                                                                            <ImageIcon className="w-12 h-12 text-red-600 group-hover:scale-110 transition-transform" />
                                                                                        </a>
                                                                                    ) : (
                                                                                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                                                            <ImageOff className="w-12 h-12" />
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                                <p className="text-center font-mono text-sm font-bold text-red-600">
                                                                                    {att.checkOut ? new Date(att.checkOut).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                        <div className="px-4 pb-4 text-xs text-gray-500 flex items-center gap-1">
                                                                            <MapPin className="w-3.5 h-3.5" /> {(() => {
                                                                                const loc = att.checkInLocation || 'Lokasi tidak terdeteksi';
                                                                                // Check if it's coordinates (format: lat,lng)
                                                                                if (loc.match(/^-?\d+\.?\d*,-?\d+\.?\d*$/)) {
                                                                                    return (
                                                                                        <a
                                                                                            href={`https://www.google.com/maps/search/?api=1&query=${loc}`}
                                                                                            target="_blank"
                                                                                            rel="noopener noreferrer"
                                                                                            className="text-blue-600 hover:underline flex items-center"
                                                                                        >
                                                                                            {loc} (Lihat di Peta)
                                                                                            <MapPin className="ml-1 h-3 w-3" />
                                                                                        </a>
                                                                                    );
                                                                                }
                                                                                // Otherwise display as address
                                                                                return <span className="line-clamp-2">{loc}</span>;
                                                                            })()}
                                                                        </div>
                                                                    </div>
                                                                ));
                                                            })()}
                                                        </div>
                                                    )}

                                                    {/* Default List if no date selected: Last 5 Activities */}
                                                    {!selectedDate && (
                                                        <div className="mt-8">
                                                            <h4 className="font-bold text-gray-800 mb-4">Aktivitas Terakhir</h4>
                                                            <div className="border rounded-lg overflow-hidden">
                                                                <table className="w-full text-sm">
                                                                    <thead className="bg-gray-50 text-gray-500">
                                                                        <tr>
                                                                            <th className="px-4 py-2 text-left">Tanggal</th>
                                                                            <th className="px-4 py-2 text-left">Masuk</th>
                                                                            <th className="px-4 py-2 text-left">Pulang</th>
                                                                            <th className="px-4 py-2 text-left">Status</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {employeeAttendance?.slice(0, 5).map(att => (
                                                                            <tr key={att.id} className="border-t hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedDate(new Date(att.date))}>
                                                                                <td className="px-4 py-2">{format(new Date(att.date), "EEEE, d MMM yyyy", { locale: id })}</td>
                                                                                <td className="px-4 py-2 font-mono text-primary">
                                                                                    {att.checkIn ? new Date(att.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                                                                </td>
                                                                                <td className="px-4 py-2 font-mono text-red-600">
                                                                                    {att.checkOut ? new Date(att.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                                                                </td>
                                                                                <td className="px-4 py-2">
                                                                                    <span className={
                                                                                        att.status === 'present' ? 'text-primary font-bold' :
                                                                                            att.status === 'late' ? 'text-red-600 font-bold' :
                                                                                                'text-gray-600'
                                                                                    }>
                                                                                        {att.status === 'present' ? 'Hadir' :
                                                                                            att.status === 'late' ? 'Telat' :
                                                                                                att.status === 'sick' ? 'Sakit' :
                                                                                                    att.status === 'permission' ? 'Izin' :
                                                                                                        att.status === 'absent' ? 'Alpha' : att.status}
                                                                                    </span>
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                            <p className="text-xs text-gray-400 mt-2 text-center">*Klik tanggal di kalender atau di tabel untuk melihat detail foto.</p>
                                                        </div>
                                                    )}
                                                </DialogContent>
                                            </Dialog>

                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50">
                                                        <Trash2 className="w-4 h-4 mr-1" />
                                                        Hapus
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Apakah anda yakin?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Tindakan ini tidak dapat dibatalkan. Data tenaga kerja <strong>{emp.fullName}</strong> akan dihapus permanen beserta data absensinya.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Batal</AlertDialogCancel>
                                                        <AlertDialogAction
                                                            onClick={() => deleteMutation.mutate(emp.id)}
                                                            className="bg-red-600 hover:bg-red-700"
                                                        >
                                                            Ya, Hapus
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {employees.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={user?.role === 'superadmin' ? 8 : 7} className="text-center text-gray-500 py-12">
                                        Belum ada data tenaga kerja.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>

            {/* View Detail Dialog */}
            <Dialog open={!!viewEmployee} onOpenChange={(open) => !open && setViewEmployee(null)}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    {viewEmployee && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="text-2xl flex items-center gap-2">
                                    <UserIcon className="w-6 h-6 text-primary" />
                                    Detail Tenaga Kerja: {toTitleCase(viewEmployee.fullName)}
                                </DialogTitle>
                                <DialogDescription>Informasi lengkap data diri dan dokumen tenaga kerja.</DialogDescription>
                            </DialogHeader>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 my-6">
                                <div className="space-y-6">
                                    <Section title="Data Pribadi" icon={<UserIcon className="w-4 h-4" />}>
                                        <DataRow label="Nama Lengkap" value={toTitleCase(viewEmployee.fullName)} />
                                        <DataRow label="NIK" value={viewEmployee.nik} />
                                        <DataRow label="Tempat, Tgl Lahir" value={`${toTitleCase(viewEmployee.birthPlace) || '-'}, ${viewEmployee.birthDate ? format(new Date(viewEmployee.birthDate), "d MMMM yyyy", { locale: id }) : '-'}`} />
                                        <DataRow label="Jenis Kelamin" value={toTitleCase(viewEmployee.gender)} />
                                        <DataRow label="Agama" value={toTitleCase((viewEmployee as any).religion)} />
                                        <DataRow label="Alamat" value={formatAddress(viewEmployee.address)} />
                                    </Section>

                                    <Section title="Pekerjaan" icon={<Briefcase className="w-4 h-4" />}>
                                        <DataRow label="Jabatan" value={toTitleCase((viewEmployee as any).position)} />
                                        <DataRow label="Cabang" value={toTitleCase((viewEmployee as any).branch)} />
                                        <DataRow label="Tahun Bergabung Ke Perusahaan" value={(viewEmployee as any).joinDate} />
                                        <DataRow label="Status Kerja" value={toTitleCase((viewEmployee as any).employmentStatus)} />
                                        <div className="flex justify-between items-center text-sm pt-1">
                                            <span className="text-slate-500">Status Data:</span>
                                            <Badge variant={
                                                viewEmployee.registrationStatus === 'approved' ? 'default' :
                                                viewEmployee.registrationStatus === 'pending' ? 'secondary' :
                                                viewEmployee.registrationStatus === 'rejected' ? 'destructive' : 'outline'
                                            } className="capitalize px-2 py-0">
                                                {viewEmployee.registrationStatus || 'unregistered'}
                                            </Badge>
                                        </div>
                                    </Section>
                                </div>

                                <div className="space-y-6">
                                    <Section title="Administrasi" icon={<CreditCard className="w-4 h-4" />}>
                                        <DataRow label="NPWP" value={(viewEmployee as any).npwp} />
                                        <DataRow label="BPJS" value={(viewEmployee as any).bpjs} />
                                        <DataRow label="No. HP" value={viewEmployee.phoneNumber} />
                                        <DataRow label="Email" value={viewEmployee.email} />
                                    </Section>

                                    <Section title="Dokumen Upload" icon={<ImageIcon className="w-4 h-4" />}>
                                        <div className="grid grid-cols-2 gap-4">
                                            <DocumentBox label="Foto Profil" url={viewEmployee.photoUrl} />
                                            <DocumentBox label="KTP" url={(viewEmployee as any).ktpPhotoUrl} isDrive />
                                            <DocumentBox label="BPJS" url={(viewEmployee as any).bpjsPhotoUrl} isDrive />
                                            <DocumentBox label="NPWP" url={(viewEmployee as any).npwpPhotoUrl} isDrive />
                                        </div>
                                    </Section>
                                </div>
                            </div>

                            <DialogFooter>
                                <Button variant="outline" className="w-full sm:w-auto" onClick={() => setViewEmployee(null)}>Tutup</Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* View Resign Dialog */}
            <Dialog open={!!viewResignEmployee} onOpenChange={(open) => !open && setViewResignEmployee(null)}>
                <DialogContent className="sm:max-w-[425px] overflow-hidden bg-white rounded-2xl p-0">
                    <DialogHeader className="px-6 py-4 bg-gray-50 border-b border-gray-100">
                        <DialogTitle className="flex items-center gap-2 text-red-600 text-lg font-black">
                            <UserMinus className="w-5 h-5" />
                            Keterangan Resign
                        </DialogTitle>
                    </DialogHeader>
                    {viewResignEmployee && (() => {
                        const resignData = resignations.find((r: any) => r.userId === viewResignEmployee.id);
                        if (!resignData) {
                            return (
                                <div className="px-6 py-8 text-center text-gray-500">
                                    Data permohonan resign tidak ditemukan. Mungkin status diubah secara manual.
                                </div>
                            );
                        }
                        return (
                            <div className="space-y-4 p-6">
                                <div>
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Tenaga Kerja</h4>
                                    <p className="font-bold text-gray-900">{viewResignEmployee.fullName}</p>
                                </div>
                                <div>
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Tanggal Resign</h4>
                                    <p className="font-bold text-gray-900">
                                        {format(new Date(resignData.resignDate), "d MMMM yyyy", { locale: id })}
                                    </p>
                                </div>
                                <div>
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Alasan</h4>
                                    <div className="mt-1.5 p-3 bg-gray-50 rounded-xl border border-gray-100 text-sm text-gray-700 whitespace-pre-wrap italic">
                                        "{resignData.reason}"
                                    </div>
                                </div>
                                {resignData.documentUrl && (
                                    <div className="pt-2">
                                        <a href={resignData.documentUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full py-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 font-bold transition-colors">
                                            <FileText className="w-4 h-4" />
                                            Lihat Dokumen Terkait
                                        </a>
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </DialogContent>
            </Dialog>

            {/* Upload CSV Modal */}
            <Dialog open={csvOpen} onOpenChange={setCsvOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Upload Data Tenaga Kerja (CSV)</DialogTitle>
                        <DialogDescription>
                            Unggah file CSV dengan urutan kolom:
                            <br /><strong className="text-gray-900 mt-2 block">NIK, Nama Lengkap, Telepon, Cabang, Jabatan</strong>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <Input
                            type="file"
                            accept=".csv"
                            onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                        />
                        <Button
                            className="w-full bg-orange-600 hover:bg-orange-700 text-white rounded-lg"
                            disabled={!csvFile || csvMutation.isPending}
                            onClick={() => csvFile && csvMutation.mutate(csvFile)}
                        >
                            {csvMutation.isPending ? "Mengunggah..." : "Upload File"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
            {/* Add Employee Modal */}
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto rounded-xl">
                    <DialogHeader>
                        <DialogTitle>{selectedEmployee ? "Edit Tenaga Kerja" : "Tambah Tenaga Kerja Baru"}</DialogTitle>
                        <DialogDescription>
                            Lengkapi informasi data diri dan pekerjaan tenaga kerja.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-center mb-4">
                        <div className="relative group">
                            <div className="w-24 aspect-[2/3] bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden rounded-lg shadow-sm">
                                {selectedPhoto ? (
                                    <img src={URL.createObjectURL(selectedPhoto)} className="w-full h-full object-cover" />
                                ) : selectedEmployee?.photoUrl ? (
                                    <img src={selectedEmployee.photoUrl} className="w-full h-full object-cover" />
                                ) : (
                                    <ImageIcon className="w-8 h-8 text-gray-400" />
                                )}
                            </div>
                            <label className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 group-hover:opacity-100 rounded-lg cursor-pointer transition-opacity">
                                <span className="text-[10px] font-bold">Ganti Foto</span>
                                <input
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files[0]) {
                                            setSelectedPhoto(e.target.files[0]);
                                        }
                                    }}
                                />
                            </label>
                        </div>
                    </div>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit((d) => upsertMutation.mutate(d))} className="space-y-4">
                            <div className="bg-gray-50 p-3 rounded-lg space-y-4 border border-gray-100">
                                <h4 className="text-xs font-bold uppercase tracking-widest text-primary border-b pb-1">Biodata Tenaga Kerja</h4>
                                <FormField
                                    control={form.control}
                                    name="fullName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Nama Lengkap</FormLabel>
                                            <FormControl><Input {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="birthPlace"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Tempat Lahir</FormLabel>
                                                <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="birthDate"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Tanggal Lahir</FormLabel>
                                                <FormControl><Input type="date" {...field} value={field.value || ''} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="gender"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Jenis Kelamin</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value || "Laki-laki"}>
                                                    <FormControl><SelectTrigger><SelectValue placeholder="Pilih" /></SelectTrigger></FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="Laki-laki">Laki-laki</SelectItem>
                                                        <SelectItem value="Perempuan">Perempuan</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField control={form.control} name="religion" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Agama</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value || undefined}>
                                                <FormControl><SelectTrigger><SelectValue placeholder="Pilih" /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="Islam">Islam</SelectItem>
                                                    <SelectItem value="Kristen Protestan">Kristen Protestan</SelectItem>
                                                    <SelectItem value="Katolik">Katolik</SelectItem>
                                                    <SelectItem value="Hindu">Hindu</SelectItem>
                                                    <SelectItem value="Buddha">Buddha</SelectItem>
                                                    <SelectItem value="Khonghucu">Khonghucu</SelectItem>
                                                    <SelectItem value="Lainnya">Lainnya</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField
                                        control={form.control}
                                        name="address"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Alamat Lengkap</FormLabel>
                                                <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>

                            <div className="bg-gray-50 p-3 rounded-lg space-y-4 border border-gray-100">
                                <h4 className="text-xs font-bold uppercase tracking-widest text-primary border-b pb-1">Pekerjaan</h4>
                                <FormField
                                    control={form.control}
                                    name="nik"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>NIK (Nomor Induk Tenaga Kerja)</FormLabel>
                                            <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="branch"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Cabang</FormLabel>
                                                <FormControl>
                                                    <>
                                                        <Input {...field} list="branches-datalist" value={field.value || ''} />
                                                        <datalist id="branches-datalist">
                                                            {existingBranches.map(b => (
                                                                <option key={b} value={b} />
                                                            ))}
                                                        </datalist>
                                                    </>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="position"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Jabatan</FormLabel>
                                                <FormControl>
                                                    <>
                                                        <Input {...field} list="positions-datalist" value={field.value || ''} />
                                                        <datalist id="positions-datalist">
                                                            {existingPositions.map(p => (
                                                                <option key={p} value={p} />
                                                            ))}
                                                        </datalist>
                                                    </>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="joinDate"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Tahun Bergabung</FormLabel>
                                                <FormControl><Input {...field} value={field.value || ''} placeholder="Contoh: 2024" /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField control={form.control} name="employmentStatus" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Status Kerja</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value || "Kontrak"}>
                                                <FormControl><SelectTrigger><SelectValue placeholder="Pilih" /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="Kontrak">Kontrak</SelectItem>
                                                    <SelectItem value="Tetap">Tetap</SelectItem>
                                                    <SelectItem value="Resign">Resign</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="shift"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Shift Kerja</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value || "-"}>
                                                    <FormControl><SelectTrigger><SelectValue placeholder="Pilih Shift" /></SelectTrigger></FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="-">-</SelectItem>
                                                        {shifts.map((s) => (
                                                            <SelectItem key={s.id} value={s.name}>
                                                                {s.name} ({s.checkInTime} - {s.checkOutTime})
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="registrationStatus"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Status Pendaftaran</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value || "approved"}>
                                                    <FormControl><SelectTrigger><SelectValue placeholder="Pilih Status" /></SelectTrigger></FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="pending">Pending</SelectItem>
                                                        <SelectItem value="approved">Approved</SelectItem>
                                                        <SelectItem value="rejected">Rejected</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>

                            <div className="bg-gray-50 p-3 rounded-lg space-y-4 border border-gray-100">
                                <h4 className="text-xs font-bold uppercase tracking-widest text-primary border-b pb-1">Kontak & Dokumen</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="phoneNumber"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Nomor HP (WhatsApp)</FormLabel>
                                                <FormControl><Input {...field} value={field.value || ''} placeholder="08xxxxxxxxxx" /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="email"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Email</FormLabel>
                                                <FormControl><Input {...field} value={field.value || ''} placeholder="email@gmail.com" /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <FormField control={form.control} name="npwp" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>NPWP</FormLabel>
                                        <FormControl><Input {...field} value={field.value || ''} placeholder="00.000.000.0-000.000" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <div className="space-y-2">
                                    <FormLabel className="text-sm font-medium leading-none">Foto NPWP</FormLabel>
                                    <div className="flex items-center gap-3">
                                        <Input type="file" accept="image/*" onChange={(e) => setSelectedNpwpPhoto(e.target.files?.[0] || null)} />
                                        {(selectedEmployee as any)?.npwpPhotoUrl && (
                                            <a href={(selectedEmployee as any).npwpPhotoUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline shrink-0">Lihat Foto</a>
                                        )}
                                    </div>
                                </div>
                                <FormField control={form.control} name="bpjs" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>BPJS</FormLabel>
                                        <FormControl><Input {...field} value={field.value || ''} placeholder="Nomor BPJS" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <div className="space-y-2 pb-2">
                                    <FormLabel className="text-sm font-medium leading-none">Foto BPJS</FormLabel>
                                    <div className="flex items-center gap-3">
                                        <Input type="file" accept="image/*" onChange={(e) => setSelectedBpjsPhoto(e.target.files?.[0] || null)} />
                                        {(selectedEmployee as any)?.bpjsPhotoUrl && (
                                            <a href={(selectedEmployee as any).bpjsPhotoUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline shrink-0">Lihat Foto</a>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-2 pb-4">
                                    <FormLabel className="text-sm font-medium leading-none">Foto KTP</FormLabel>
                                    <div className="flex items-center gap-3">
                                        <Input type="file" accept="image/*" onChange={(e) => setSelectedKtpPhoto(e.target.files?.[0] || null)} />
                                        {(selectedEmployee as any)?.ktpPhotoUrl && (
                                            <a href={(selectedEmployee as any).ktpPhotoUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline shrink-0">Lihat Foto</a>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 text-white rounded-lg h-11" disabled={upsertMutation.isPending}>
                                {upsertMutation.isPending ? "Menyimpan..." : "Simpan Data"}
                            </Button>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// Helper Components for the Detail View
function Section({ title, icon, children }: any) {
    return (
        <div className="space-y-3 animate-in fade-in slide-in-from-left-4 duration-500">
            <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider border-b border-primary/10 pb-1">
                {icon}
                {title}
            </div>
            <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-100 space-y-2.5 shadow-sm">
                {children}
            </div>
        </div>
    );
}

function DataRow({ label, value }: { label: string; value?: string | null }) {
    return (
        <div className="flex flex-col sm:flex-row sm:justify-between text-sm py-0.5 border-b border-slate-100/50 last:border-0">
            <span className="text-slate-400 text-xs">{label}</span>
            <span className="font-semibold text-slate-800 tracking-tight">{value || '-'}</span>
        </div>
    );
}

function DocumentBox({ label, url, isDrive }: { label: string; url?: string | null; isDrive?: boolean }) {
    // Extract ID if it's a Drive URL or use proxy
    const getImageUrl = (url: string) => {
        if (!url) return "";
        if (url.startsWith("/uploads") || url.startsWith("/api/")) return url;
        if (url.startsWith("http")) {
            const id = url.includes('/d/') ? url.split('/d/')[1].split('/')[0] : url;
            return `/api/images/${id}`;
        }
        return `/api/images/${url}`; 
    };

    const displayUrl = url ? getImageUrl(url) : null;
    const isLocal = url?.startsWith('/uploads');
    const openUrl = url && (url.startsWith('http') || isLocal) 
        ? url 
        : (url ? `https://drive.google.com/file/d/${url}/view` : undefined);

    return (
        <div className="space-y-2 group">
            <p className="text-[10px] font-bold uppercase tracking-tight text-slate-400 flex justify-between items-center px-1">
                {label}
            </p>
            <div className="h-32 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 group relative shadow-sm ring-primary/0 group-hover:ring-primary/20 transition-all group-hover:shadow-md">
                {url ? (
                    <>
                        <img 
                            src={displayUrl || ""} 
                            className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500" 
                            onError={(e) => {
                                (e.target as any).style.display = 'none';
                                if ((e.target as any).nextSibling) (e.target as any).nextSibling.style.display = 'flex';
                            }}
                        />
                        <div className={`hidden absolute inset-0 items-center justify-center bg-slate-50 ${isDrive ? 'flex' : ''}`}>
                            <ImageIcon className="w-8 h-8 text-primary/30" />
                        </div>
                        <div 
                            className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-all duration-300 cursor-pointer text-white p-2 scale-95 group-hover:scale-100"
                            onClick={() => window.open(openUrl || displayUrl || "", '_blank')}
                        >
                            <Eye className="w-5 h-5 mb-1" />
                            <span className="text-[9px] font-bold uppercase tracking-widest bg-white/20 px-2 py-0.5 rounded-full">
                                Buka File
                            </span>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-1">
                        <ImageOff className="w-6 h-6 opacity-30" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Kosong</span>
                    </div>
                )}
            </div>
        </div>
    );
}
