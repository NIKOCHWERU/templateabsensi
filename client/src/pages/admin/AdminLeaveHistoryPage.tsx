import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LeaveRequest, User } from "@shared/schema";
import { CompanyHeader } from "@/components/CompanyHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { Loader2, ArrowLeft, Calendar, User as UserIcon, Search, Filter, Image as ImageIcon, Printer, Trash2 } from "lucide-react";
import { api } from "@shared/routes";
import { useLocation } from "wouter";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { toTitleCase } from "@/lib/utils";

export default function AdminLeaveHistoryPage() {
    const [, setLocation] = useLocation();
    const [searchTerm, setSearchTerm] = useState("");
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            const res = await fetch(`/api/admin/leave-requests/${id}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error("Gagal menghapus permohonan cuti");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [api.admin.attendance.leave.list.path] });
            queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
            toast({
                title: "Berhasil",
                description: "Permohonan cuti telah dihapus.",
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

    const handleDeleteLeave = (id: number) => {
        if (confirm("Apakah Anda yakin ingin menghapus permohonan cuti ini?")) {
            deleteMutation.mutate(id);
        }
    };

    const { data: config } = useQuery<any>({
        queryKey: ["/api/config"],
    });

    const handlePrintLeave = async (req: LeaveRequest) => {
        const userObj = users?.find(u => u.id === req.userId);
        const name = userObj?.fullName || `User #${req.userId}`;
        const nameTitle = toTitleCase(name);
        const nik = userObj?.nik || userObj?.username || '-';
        const position = userObj?.position || '-';
        const branch = userObj?.branch || '-';
        
        const namaPt = config?.namaPt || import.meta.env.VITE_NAMA_PT || "PT ABCD";
        const singkatanPt = config?.singkatanPt || import.meta.env.VITE_SINGKATAN_PT || "PTABC";
        const logoUrl = config?.logoUrl || "/logo_elok_buah.jpg";

        let periodStr = '';
        let rincianTanggalStr = '';
        let totalDays = 0;
        
        const numberToWords = (num: number): string => {
            const words = ["nol", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas", "dua belas"];
            return num <= 12 ? `${num} (${words[num]})` : `${num}`;
        };

        if (req.selectedDates) {
            const dates = req.selectedDates.split(',');
            totalDays = dates.length;
            periodStr = `${format(new Date(dates[0]), "d MMMM yyyy", { locale: id })} s.d. ${format(new Date(dates[dates.length - 1]), "d MMMM yyyy", { locale: id })}`;
            rincianTanggalStr = dates.map(d => format(new Date(d), "d MMMM yyyy", { locale: id })).join('<br>');
        } else {
            const start = new Date(req.startDate);
            const end = new Date(req.endDate);
            totalDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            periodStr = `${format(start, "d MMMM yyyy", { locale: id })} s.d. ${format(end, "d MMMM yyyy", { locale: id })}`;
            
            const datesList: string[] = [];
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                datesList.push(format(new Date(d), "d MMMM yyyy", { locale: id }));
            }
            rincianTanggalStr = datesList.join('<br>');
        }

        const docYear = new Date(req.createdAt!).getFullYear();
        const docNo = `Nomor: ${singkatanPt.replace(/[^a-zA-Z0-9]/g, "")}/HRD/CUTI/${req.id.toString().padStart(4, '0')}/${docYear}`;
        const fileName = `SURAT_IZIN_CUTI_${name.replace(/\s+/g, '_').toUpperCase()}_${format(new Date(req.createdAt!), "yyyyMMdd")}.html`;
        
        let logoDataUrl = '';
        try {
            const logoRes = await fetch(logoUrl);
            const logoBlob = await logoRes.blob();
            logoDataUrl = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = () => resolve('');
                reader.readAsDataURL(logoBlob);
            });
        } catch (_) {}

        let statusLabel = 'PENDING';
        let statusDesc = 'Permohonan cuti masih dalam proses peninjauan dan belum memperoleh keputusan akhir dari pihak yang berwenang.';
        let statusColor = '#b45309';

        if (req.status === 'approved') {
            statusLabel = 'DISETUJUI';
            statusDesc = 'Permohonan cuti telah ditinjau dan disetujui sepenuhnya oleh pihak manajemen perusahaan.';
            statusColor = '#15803d';
        } else if (req.status === 'rejected') {
            statusLabel = 'DITOLAK';
            statusDesc = 'Permohonan cuti telah ditinjau dan ditolak oleh pihak manajemen perusahaan dikarenakan alasan operasional.';
            statusColor = '#b91c1c';
        } else if (req.status === 'cancelled') {
            statusLabel = 'DIBATALKAN';
            statusDesc = 'Permohonan cuti telah dibatalkan oleh karyawan yang bersangkutan.';
            statusColor = '#4b5563';
        }

        const formattedCreatedAt = format(new Date(req.createdAt!), "eeee, d MMMM yyyy, 'pukul' HH.mm 'WIB'", { locale: id });

        const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${fileName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Times New Roman', Times, serif; font-size: 13px; color: #000; background: white; padding: 25px 45px; line-height: 1.4; }
    
    .letterhead { display: flex; flex-direction: column; align-items: center; text-align: center; margin-bottom: 10px; }
    .logo-img { width: 60px; height: 60px; object-fit: contain; margin-bottom: 6px; }
    .company-name { font-family: Arial, Helvetica, sans-serif; font-size: 16px; font-weight: bold; text-transform: uppercase; margin-bottom: 2px; }
    .company-tagline { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #475569; font-weight: bold; }
    
    .divider { border-top: 2px solid #000; margin: 10px 0 15px 0; width: 100%; }
    
    .title-block { text-align: center; margin-bottom: 15px; }
    .title-block h1 { font-size: 16px; font-weight: bold; text-transform: uppercase; margin-bottom: 4px; }
    .title-block .doc-no { font-size: 12px; font-weight: bold; }
    
    .opening-text { margin-bottom: 12px; text-align: justify; }
    
    .formal-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    .formal-table th, .formal-table td { border: 1px solid #000; padding: 6px 10px; text-align: left; vertical-align: top; }
    .formal-table th { background-color: #f2f2f2; width: 200px; font-weight: bold; }
    .formal-table td.label-col { width: 200px; font-weight: bold; }
    
    .status-section { margin: 15px 0; text-align: center; page-break-inside: avoid; }
    .status-title { font-size: 13px; font-weight: bold; text-transform: uppercase; margin-bottom: 6px; }
    .status-badge { display: inline-block; border: 2px solid ${statusColor}; color: ${statusColor}; padding: 6px 20px; font-size: 14px; font-weight: bold; border-radius: 4px; background-color: ${statusColor}08; margin-bottom: 6px; }
    .status-desc { font-size: 11px; font-style: italic; color: #4b5563; max-width: 500px; margin: 0 auto; line-height: 1.3; }
    
    .closing-text { margin-bottom: 20px; text-align: justify; }
    
    .signature-section { display: flex; justify-content: space-between; margin-top: 25px; page-break-inside: avoid; }
    .sig-box { text-align: left; width: 220px; }
    .sig-label { font-size: 13px; margin-bottom: 45px; }
    .sig-name { font-size: 13px; font-weight: bold; text-transform: uppercase; }
    .sig-desc { font-size: 12px; margin-top: 2px; }
    
    .btn-wrap { text-align: center; margin-top: 20px; }
    .download-btn { display: inline-flex; align-items: center; gap: 8px; background: #2563eb; color: #fff; border: none; padding: 8px 20px; border-radius: 6px; font-size: 11px; font-weight: bold; cursor: pointer; text-decoration: none; }
    
    @page {
      size: A4;
      margin: 10mm 15mm;
    }
    @media print {
      body { padding: 0; }
      .btn-wrap { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="letterhead">
    ${logoDataUrl ? `<img src="${logoDataUrl}" class="logo-img" alt="Logo" />` : ''}
    <div class="company-name">${namaPt}</div>
    <div class="company-tagline">Sistem Manajemen Kehadiran & Tenaga Kerja Digital</div>
  </div>

  <div class="divider"></div>

  <div class="title-block">
    <h1>SURAT KETERANGAN PERSETUJUAN CUTI</h1>
    <p class="doc-no">${docNo}</p>
  </div>

  <p class="opening-text">
    Berdasarkan Formulir Permohonan Cuti yang telah diajukan oleh karyawan serta setelah dilakukan peninjauan terhadap hak cuti yang dimiliki dan mempertimbangkan kebutuhan operasional perusahaan, maka Manajemen Human Resources Department (HRD) menerangkan bahwa:
  </p>

  <table class="formal-table">
    <tr>
      <td class="label-col">Nama Karyawan</td>
      <td>${nameTitle}</td>
    </tr>
    <tr>
      <td class="label-col">NIK</td>
      <td>${nik}</td>
    </tr>
    <tr>
      <td class="label-col">Jabatan/Posisi</td>
      <td>${position}</td>
    </tr>
    <tr>
      <td class="label-col">Unit Kerja/Cabang</td>
      <td>${branch}</td>
    </tr>
  </table>

  <p class="opening-text" style="margin-top: 20px;">
    Karyawan tersebut telah mengajukan permohonan cuti dengan rincian sebagai berikut:
  </p>

  <table class="formal-table">
    <tr>
      <td class="label-col">Tanggal Pengajuan</td>
      <td>${formattedCreatedAt}</td>
    </tr>
    <tr>
      <td class="label-col">Jumlah Hari Cuti</td>
      <td>${numberToWords(totalDays)} hari</td>
    </tr>
    <tr>
      <td class="label-col">Periode Cuti</td>
      <td>${periodStr}</td>
    </tr>
    <tr>
      <td class="label-col">Rincian Tanggal Cuti</td>
      <td>${rincianTanggalStr}</td>
    </tr>
    <tr>
      <td class="label-col">Alasan Pengajuan Cuti</td>
      <td>${req.reason}</td>
    </tr>
  </table>

  <div class="status-section">
    <p class="status-title">Status Persetujuan</p>
    <div class="status-badge">${statusLabel}</div>
    <p class="status-desc">(${statusDesc})</p>
  </div>

  <p class="closing-text">
    Demikian Surat Keterangan Permohonan/Persetujuan Cuti ini diterbitkan melalui Sistem Manajemen Kehadiran & Tenaga Kerja Digital ${namaPt} sebagai dokumen administrasi perusahaan. Dokumen ini dapat dipergunakan sebagaimana mestinya sesuai dengan ketentuan yang berlaku di lingkungan perusahaan.
  </p>

  <p class="closing-text" style="font-weight: bold; margin-top: -20px;">
    Apabila permohonan cuti disetujui, karyawan yang bersangkutan wajib memastikan seluruh tugas dan tanggung jawab pekerjaan telah diselesaikan atau didelegasikan (handover) kepada pihak yang ditunjuk sebelum pelaksanaan cuti.
  </p>

  <div class="signature-section">
    <div class="sig-box">
      <p class="sig-label">Diperiksa Oleh,</p>
      <div class="sig-name">NIKO</div>
      <p class="sig-desc">Staff HRD</p>
    </div>
    <div class="sig-box">
      <p class="sig-label">Disetujui Oleh,</p>
      <div class="sig-name">CLAVERINA</div>
      <p class="sig-desc">Staff HRD</p>
    </div>
  </div>

  <div class="btn-wrap">
    <a id="dl-btn" class="download-btn" href="#">Cetak / Simpan PDF</a>
  </div>

  <script>
    window.onload = function() {
      var btn = document.getElementById('dl-btn');
      if (btn) {
        btn.onclick = function(e) {
          e.preventDefault();
          window.print();
        };
      }
      setTimeout(function() { window.print(); }, 500);
    };
  </script>
</body>
</html>`;

        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
    };

    const { data: users } = useQuery<User[]>({
        queryKey: ["/api/admin/users"],
        refetchInterval: 5000,
    });

    const { data: requests, isLoading } = useQuery<LeaveRequest[]>({
        queryKey: [api.admin.attendance.leave.list.path],
        refetchInterval: 5000,
    });

    const getUserName = (userId: number) => {
        const name = users?.find(u => u.id === userId)?.fullName || `User #${userId}`;
        return toTitleCase(name);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'approved': return 'text-primary bg-primary/5 border-primary/10';
            case 'rejected': return 'text-red-600 bg-red-50 border-red-100';
            case 'cancelled': return 'text-gray-600 bg-gray-50 border-gray-100';
            default: return 'text-orange-600 bg-orange-50 border-orange-100';
        }
    };

    const filteredRequests = requests?.filter(req => {
        const userName = getUserName(req.userId).toLowerCase();
        return userName.includes(searchTerm.toLowerCase()) || req.reason.toLowerCase().includes(searchTerm.toLowerCase());
    });

    return (
        <div className="space-y-6">
            

            <div className="space-y-6">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight">Riwayat Permohonan Cuti</h1>
                    <p className="text-sm text-gray-500">Daftar arsip dan riwayat persetujuan cuti seluruh tenaga kerja.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                                        <Button
                        variant="outline"
                        className="rounded-lg gap-2 cursor-pointer bg-white"
                        onClick={() => setLocation("/admin/leave")}
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Kembali
                    </Button>
                </div>
            </div>

            <div className="space-y-6">
                <Card className="border-none shadow-sm rounded-xl overflow-hidden">
                    <CardHeader className="bg-white border-b border-gray-50 flex flex-row items-center justify-between gap-4 p-6">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                                placeholder="Cari nama tenaga kerja atau alasan..."
                                className="pl-10 rounded-lg border-gray-100 bg-gray-50 focus:bg-white transition-all h-11"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Button variant="outline" className="rounded-lg h-11 gap-2 text-gray-600 border-gray-200">
                            <Filter className="w-4 h-4" /> Filter
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-[10px] text-gray-400 font-black uppercase tracking-widest bg-gray-50/50">
                                    <tr>
                                        <th className="px-6 py-4">Tenaga Kerja</th>
                                        <th className="px-6 py-4">Tanggal Pengajuan</th>
                                        <th className="px-6 py-4">Periode Cuti</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Alasan</th>
                                        <th className="px-6 py-4 text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center">
                                                <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-200" />
                                            </td>
                                        </tr>
                                    ) : filteredRequests?.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                                                Tidak ditemukan data permohonan.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredRequests?.map((req) => (
                                            <tr key={req.id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xs uppercase">
                                                            {getUserName(req.userId).charAt(0)}
                                                        </div>
                                                        <span className="font-bold text-gray-900">{getUserName(req.userId)}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-gray-500 font-medium whitespace-nowrap">
                                                    {format(new Date(req.createdAt!), "d MMM yyyy HH:mm")}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {req.selectedDates ? (
                                                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                                                            {req.selectedDates.split(',').length} Hari Terpilih
                                                        </div>
                                                    ) : (
                                                        <div className="font-bold text-gray-700 whitespace-nowrap">
                                                            {format(new Date(req.startDate), "d MMM")} - {format(new Date(req.endDate), "d MMM yyyy")}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg border ${getStatusColor(req.status!)}`}>
                                                        {req.status === 'approved' ? 'Disetujui' :
                                                            req.status === 'rejected' ? 'Ditolak' :
                                                                req.status === 'cancelled' ? 'Batal' : 'Pending'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="text-gray-600 line-clamp-2 min-w-[200px] italic">"{req.reason}"</p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="rounded-lg text-blue-600 border-blue-100 hover:bg-blue-50 h-8 w-8 p-0"
                                                            onClick={() => handlePrintLeave(req)}
                                                            title="Cetak Formulir Cuti"
                                                        >
                                                            <Printer className="w-3.5 h-3.5" />
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="rounded-lg text-red-600 border-red-100 hover:bg-red-50 h-8 w-8 p-0"
                                                            onClick={() => handleDeleteLeave(req.id)}
                                                            disabled={deleteMutation.isPending}
                                                            title="Hapus Permohonan Cuti"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
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
            </div>
        </div>
        </div>
    );
}
