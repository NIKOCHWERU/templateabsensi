import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { User, Attendance } from "@shared/schema";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { format, addDays, subDays, startOfWeek, endOfWeek, startOfDay, endOfDay, subMonths, addMonths, isAfter, isBefore, isEqual } from "date-fns";
import { id } from "date-fns/locale";
import { calculateDailyTotal, formatDuration } from "@/lib/attendance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Users, Clock, CalendarDays, LogOut, FileText, MessageSquare, History, Image as ImageIcon, MapPin, ChevronLeft, ChevronRight, FileDown, ArrowUpDown, Menu, AlertTriangle
} from "lucide-react";

// Helper: resolve photo URL — handles both local uploads and Google Drive File IDs
function getPhotoUrl(value: string | null | undefined): string {
    if (!value) return '';
    // Base64 data URI
    if (value.startsWith('data:')) return value;
    // Full URL
    if (value.startsWith('http')) return value;
    if (value.startsWith('/api/')) return value;
    if (value.startsWith('/uploads/')) return value;
    // Google Drive File ID: no dots, no slashes, length > 20 — use server proxy to avoid CORS/auth issues
    if (!value.includes('/') && !value.includes('.') && value.length > 20) {
        return `/api/images/${value}`;
    }
    // Local file
    return `/uploads/${value}`;
}

const loadHtml2Pdf = () => {
    return new Promise<any>((resolve, reject) => {
        if ((window as any).html2pdf) {
            resolve((window as any).html2pdf);
            return;
        }
        const script = document.createElement('script');
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
        script.onload = () => resolve((window as any).html2pdf);
        script.onerror = () => reject(new Error("Gagal memuat script html2pdf"));
        document.head.appendChild(script);
    });
};

export default function AttendanceHistoryPage() {
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const { logout } = useAuth();
    const [targetDate, setTargetDate] = useState(new Date());
    const [reportType, setReportType] = useState<"daily" | "weekly" | "monthly" | "custom">("daily");
    const [customStartDate, setCustomStartDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [customEndDate, setCustomEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [searchName, setSearchName] = useState("");
    const [sortField, setSortField] = useState<'date' | 'name'>('date');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [isExporting, setIsExporting] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;

    const toggleSort = (field: 'date' | 'name') => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder(field === 'date' ? 'desc' : 'asc');
        }
        setCurrentPage(1);
    };

    let startDate: Date;
    let endDate: Date;

    if (reportType === "daily") {
        startDate = startOfDay(targetDate);
        endDate = endOfDay(targetDate);
    } else if (reportType === "weekly") {
        startDate = startOfWeek(targetDate, { weekStartsOn: 1 }); // Monday
        endDate = endOfWeek(targetDate, { weekStartsOn: 1 });
    } else if (reportType === "custom") {
        startDate = startOfDay(new Date(customStartDate));
        endDate = endOfDay(new Date(customEndDate));
    } else {
        // Default: 26th of previous month to 25th of current month
        startDate = new Date(targetDate.getFullYear(), targetDate.getMonth() - 1, 26);
        endDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 25);
    }

    const { data: attendanceHistory, isLoading: isLoadingAttendance } = useQuery<Attendance[]>({
        queryKey: [`/api/admin/attendance?startDate=${format(startDate, 'yyyy-MM-dd')}&endDate=${format(endDate, 'yyyy-MM-dd')}`],
        refetchInterval: 10000,
    });

    const { data: users } = useQuery<User[]>({
        queryKey: ["/api/admin/users"],
    });

    const getEmployee = (userId: number) => {
        return users?.find(user => user.id === userId);
    };

    // Parses GPS metadata JSON and returns a suspicious flag + summary string
    const parseMetadataForSuspicion = (metadataJson: string | null | undefined): { isSuspicious: boolean; summary: string } => {
        if (!metadataJson) return { isSuspicious: false, summary: '' };
        try {
            const m = JSON.parse(metadataJson);
            const reasons: string[] = [];
            if (m.accuracy !== null && m.accuracy !== undefined) {
                if (Number.isInteger(m.accuracy) && m.accuracy < 50) reasons.push(`Akurasi bulat: ${m.accuracy}m`);
                if (m.accuracy < 1.0) reasons.push(`Akurasi terlalu tinggi: ${m.accuracy}m`);
                if (m.altitude === null && m.accuracy < 10) reasons.push(`Tidak ada data ketinggian`);
                if (m.speed === 0 && m.accuracy < 5) reasons.push(`Kecepatan tepat 0 & akurasi tinggi`);
            }
            return {
                isSuspicious: reasons.length > 0,
                summary: reasons.length > 0 ? `GPS Mencurigakan: ${reasons.join(', ')}` : `GPS Normal (accuracy: ${m.accuracy}m)`
            };
        } catch {
            return { isSuspicious: false, summary: '' };
        }
    };

    const filteredRecords = attendanceHistory?.filter(att => {
        const emp = getEmployee(att.userId);
        if (!emp) return false;

        // Name Filter
        if (searchName && !emp.fullName.toLowerCase().includes(searchName.toLowerCase())) return false;

        const attDate = new Date(att.date);
        const d = new Date(attDate);
        d.setHours(0, 0, 0, 0);
        const s = new Date(startDate);
        s.setHours(0, 0, 0, 0);
        const e = new Date(endDate);
        e.setHours(23, 59, 59, 999);
        return (isAfter(d, s) || isEqual(d, s)) && (isBefore(d, e) || isEqual(d, e));
    }).sort((a, b) => {
        const dateA = new Date(a.date).setHours(0, 0, 0, 0);
        const dateB = new Date(b.date).setHours(0, 0, 0, 0);
        const nameA = getEmployee(a.userId)?.fullName || '';
        const nameB = getEmployee(b.userId)?.fullName || '';

        if (sortField === 'date') {
            // Primary: Date (Order based on sortOrder)
            if (dateA !== dateB) return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
            // Secondary: Name (Always ASC for grouping consistency)
            if (nameA !== nameB) return nameA.localeCompare(nameB);
            // Tertiary: Check-In (Always ASC for cronology within day)
            const timeA = a.checkIn ? new Date(a.checkIn).getTime() : 0;
            const timeB = b.checkIn ? new Date(b.checkIn).getTime() : 0;
            return timeA - timeB;
        } else {
            // Primary: Name (Order based on sortOrder)
            if (nameA !== nameB) return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
            // Secondary: Date (Always DESC for recent-first within name group)
            if (dateA !== dateB) return dateB - dateA;
            // Tertiary: Check-In (Always ASC for cronology within day)
            const timeA = a.checkIn ? new Date(a.checkIn).getTime() : 0;
            const timeB = b.checkIn ? new Date(b.checkIn).getTime() : 0;
            return timeA - timeB;
        }
    }) || [];

    const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
    const paginatedData = filteredRecords.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const getDriveViewLink = (url: string | null) => {
        if (!url) return null;
        if (url.includes('drive.google.com')) return url;
        if (!url.includes('/') && url.length > 15) {
            return `https://drive.google.com/file/d/${url}/view`;
        }
        return getPhotoUrl(url);
    };

    const parsePermitInfo = (notes: string | null) => {
        if (!notes) return { duration: 0, cleanNotes: null };
        const match = notes.match(/\[DURATION:(\d+)\]/);
        if (match) {
            return {
                duration: parseInt(match[1]),
                cleanNotes: notes.replace(/\[DURATION:\d+\]\s*/, '')
            };
        }
        return { duration: 0, cleanNotes: notes };
    };

    const handlePrev = () => {
        if (reportType === "daily") setTargetDate(d => subDays(d, 1));
        else if (reportType === "weekly") setTargetDate(d => subDays(d, 7));
        else setTargetDate(d => subMonths(d, 1));
        setCurrentPage(1);
    };

    const handleNext = () => {
        if (reportType === "daily") setTargetDate(d => addDays(d, 1));
        else if (reportType === "weekly") setTargetDate(d => addDays(d, 7));
        else setTargetDate(d => addMonths(d, 1));
        setCurrentPage(1);
    };

    const handleExport = async () => {
        let periodStr = '';
        if (reportType === 'daily') {
            periodStr = format(targetDate, "dd MMMM yyyy", { locale: id }).toUpperCase();
        } else if (reportType === 'weekly') {
            periodStr = `${format(startDate, "dd MMM")} - ${format(endDate, "dd MMM yyyy", { locale: id })}`.toUpperCase();
        } else if (reportType === 'custom') {
            periodStr = `${format(startDate, "dd MMM yyyy", { locale: id })} - ${format(endDate, "dd MMM yyyy", { locale: id })}`.toUpperCase();
        } else {
            periodStr = format(targetDate, "MMMM yyyy", { locale: id }).toUpperCase();
        }

        const fileName = `LAPORAN RIWAYAT ABSENSI FOTO TENAGA KERJA PT EJA - ${periodStr}.html`;
        const imageCache: Record<string, string> = {};
        const fetchImageBase64 = async (url: string, retries = 2) => {
            if (!url) return '';
            if (url.startsWith('data:')) return url;
            
            let resolvedUrl = getPhotoUrl(url);
            
            if (imageCache[resolvedUrl]) return imageCache[resolvedUrl];
            
            for (let i = 0; i <= retries; i++) {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 5000); 

                    const res = await fetch(resolvedUrl, { signal: controller.signal });
                    clearTimeout(timeoutId);

                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const blob = await res.blob();
                    const b64 = await new Promise<string>((resolve) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result as string);
                        reader.onerror = () => resolve('');
                        reader.readAsDataURL(blob);
                    });
                    if (b64) {
                        imageCache[resolvedUrl] = b64;
                        return b64;
                    }
                } catch (e) {
                    console.warn(`Export fetch attempt ${i + 1} failed for ${resolvedUrl}:`, e);
                    if (i === retries) return '';
                    await new Promise(r => setTimeout(r, 1000)); // Wait 1s before retry
                }
            }
            return '';
        };

        setIsExporting(true);
        try {
            // Fetch logo
            let logoDataUrl = '';
            try {
                const logoRes = await fetch('/logo_elok_buah.jpg');
                const logoBlob = await logoRes.blob();
                logoDataUrl = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.readAsDataURL(logoBlob);
                });
            } catch (_) { /* skip logo if unavailable */ }

            // Collect all unique URLs
            const uniqueUrls = new Set<string>();
            filteredRecords.forEach(r => {
                if (r.checkInPhoto) uniqueUrls.add(r.checkInPhoto);
                if (r.breakStartPhoto) uniqueUrls.add(r.breakStartPhoto);
                if (r.breakEndPhoto) uniqueUrls.add(r.breakEndPhoto);
                if (r.checkOutPhoto) uniqueUrls.add(r.checkOutPhoto);
                if ((r as any).lateReasonPhoto) uniqueUrls.add((r as any).lateReasonPhoto);
            });

            // Parallel fetch images in small chunks to avoid overloading
            const urlArray = Array.from(uniqueUrls);
            const chunkSize = 15;
            for (let i = 0; i < urlArray.length; i += chunkSize) {
                const chunk = urlArray.slice(i, i + chunkSize);
                await Promise.all(chunk.map(url => fetchImageBase64(url)));
            }

            // Prepare HTML
            let html = `<!DOCTYPE html>
<html>
<head>
  <title>${fileName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #1e293b; background: white; padding: 28px 36px; }
    
    .letterhead { display: flex; align-items: center; gap: 16px; padding-bottom: 10px; }
    .logo-img { width: 60px; height: 60px; object-fit: contain; }
    .company-block h1 { font-size: 16px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; color: #1e293b; }
    .company-block .tagline { font-size: 10px; color: #64748b; margin-top: 2px; }
    .hr-thick { border: none; border-top: 2px solid #cbd5e1; margin: 6px 0 2px; }
    .hr-thin  { border: none; border-top: 1px solid #e2e8f0; margin-bottom: 18px; }

    .report-meta { text-align: center; margin-bottom: 20px; }
    .report-meta h2 { font-size: 16px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; color: #1e293b; }
    .report-meta .sub { font-size: 10.5px; margin-top: 4px; color: #475569; }

    table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
    thead tr { background-color: #f8fafc; }
    th { color: #374151; font-weight: 700; text-align: left; padding: 8px 8px; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.4px; border-bottom: 2px solid #1e293b; border-right: 1px solid #e2e8f0; }
    th.c { text-align: center; }
    td { padding: 8px 8px; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; vertical-align: top; }
    tbody tr:nth-child(even) { background-color: #f8fafc; }

    .photo-grid { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
    .photo-item { width: 100px; text-align: center; border: 1px solid #e2e8f0; border-radius: 4px; padding: 4px; background: white; }
    .photo-img { width: 100%; height: 90px; object-fit: cover; border-radius: 2px; }
    .photo-label { font-size: 8px; font-weight: bold; color: #64748b; margin-top: 2px; text-transform: uppercase; }
    
    .status-badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 9px; text-transform: uppercase; margin-bottom: 4px; }
    .st-hadir { background: #dcfce7; color: #16a34a; }
    .st-telat { background: #ffedd5; color: #ea580c; }
    .st-sakit { background: #dbeafe; color: #2563eb; }
    .st-izin  { background: #f3e8ff; color: #7c3aed; }
    .st-cuti  { background: #ccfbf1; color: #0d9488; }
    .st-alpha { background: #fee2e2; color: #dc2626; }
    .st-unknown { background: #f1f5f9; color: #475569; }

    .btn-wrap { text-align: center; margin-top: 20px; }
    .download-btn { display: inline-flex; align-items: center; gap: 8px; background: #1d4ed8; color: #fff; border: none; padding: 10px 28px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; text-decoration: none; }
    
    @media print {
      body { padding: 12px 16px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .btn-wrap { display: none !important; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="letterhead">
    <img src="${logoDataUrl}" class="logo-img" alt="Logo" />
    <div class="company-block">
      <h1>PT Elok Jaya Abadhi</h1>
      <p class="tagline">Sistem Manajemen Kehadiran Digital</p>
    </div>
  </div>
  <hr class="hr-thick" />
  <hr class="hr-thin" />

  <div class="report-meta">
    <h2>Laporan Riwayat & Foto Absensi</h2>
    <p class="sub">Tipe: ${reportType === 'daily' ? 'Harian' : reportType === 'weekly' ? 'Mingguan' : reportType === 'custom' ? 'Kustom' : 'Bulanan'}</p>
    <p class="sub">Periode: ${format(startDate, "EEEE, d MMM yyyy", { locale: id })} - ${format(endDate, "EEEE, d MMM yyyy", { locale: id })}</p>
  </div>
  
  <table>
    <thead>
      <tr>
        <th class="c" style="width:24px;">No</th>
        <th style="width:110px;">Hari & Tanggal</th>
        <th style="width:110px;">Nama Tenaga Kerja</th>
        <th style="width:140px;">Waktu Absen</th>
        <th style="width:120px;">Status & Keterangan</th>
        <th>Bukti Foto (Visual)</th>
      </tr>
    </thead>
    <tbody>`;

            if (filteredRecords.length === 0) {
                html += `<tr><td colspan="6" style="text-align:center;padding:20px;color:#94a3b8;">Tidak ada data absensi</td></tr>`;
            }

            let lastShownName = "";
            let lastShownDate = "";
            for (let i = 0; i < filteredRecords.length; i++) {
                const r = filteredRecords[i];
                const emp = getEmployee(r.userId);
                const currentName = emp?.fullName || '-';
                const currentDateStr = format(new Date(r.date), 'EEEE, d MMMM yyyy', { locale: id });

                // Grouping logic: Same as UI
                const isContinuation = currentName === lastShownName && currentDateStr === lastShownDate;
                lastShownName = currentName;
                lastShownDate = currentDateStr;

                const sts = isContinuation && r.status === 'late' ? 'present' : (r.status || '-');
                const statusLabel = sts === 'present' ? 'Hadir' : sts === 'late' ? 'Telat' : sts === 'sick' ? 'Sakit' : sts === 'permission' ? 'Izin' : sts === 'cuti' ? 'Cuti' : sts === 'absent' ? 'Alpha' : sts;
                const statusClass = sts === 'present' ? 'st-hadir' : sts === 'late' ? 'st-telat' : sts === 'sick' ? 'st-sakit' : sts === 'permission' ? 'st-izin' : sts === 'cuti' ? 'st-cuti' : sts === 'absent' ? 'st-alpha' : 'st-unknown';

                const tIn = r.checkIn ? format(new Date(r.checkIn), 'HH:mm') : '-';
                const tBrkS = r.breakStart ? format(new Date(r.breakStart), 'HH:mm') : '-';
                const tBrkE = r.breakEnd ? format(new Date(r.breakEnd), 'HH:mm') : '-';
                const tOut = r.checkOut ? format(new Date(r.checkOut), 'HH:mm') : '-';

                let photosHtml = '<div class="photo-grid">';
                const addPhoto = (url: string | null, label: string) => {
                    if (url) {
                        let resolvedUrl = getPhotoUrl(url);

                        const b64 = imageCache[resolvedUrl] || (url.startsWith('data:') ? url : '');
                        if (b64) {
                            photosHtml += `<div class="photo-item"><img src="${b64}" class="photo-img"/><div class="photo-label">${label}</div></div>`;
                        } else {
                            photosHtml += `<div class="photo-item"><div style="height:65px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:9px;">No Image</div><div class="photo-label">${label}</div></div>`;
                        }
                    }
                };

                addPhoto(r.checkInPhoto, 'Masuk');
                addPhoto(r.breakStartPhoto, 'Mulai Ist.');
                addPhoto(r.breakEndPhoto, 'Selesai Ist.');
                addPhoto(r.checkOutPhoto, 'Pulang');
                addPhoto((r as any).lateReasonPhoto, 'Bukti Telat');
                photosHtml += '</div>';

                if (photosHtml === '<div class="photo-grid"></div>') {
                    photosHtml = '<span style="color:#94a3b8;font-style:italic;font-size:9px;">Tidak ada bukti foto</span>';
                }

                const { duration, cleanNotes } = parsePermitInfo(r.notes);
                let extraNotes = '';
                if (cleanNotes) extraNotes += `<div style="margin-top:2px;color:#475569;font-size:9.5px;line-height:1.3;"><b>Cat:\n</b> ${cleanNotes}</div>`;
                if (sts === 'late' && (r as any).lateReason) extraNotes += `<div style="margin-top:2px;color:#c2410c;font-size:9.5px;line-height:1.3;"><b>Alasan Telat:\n</b> ${(r as any).lateReason}</div>`;

                const checkInLoc = r.checkInLocation || '-';

                html += `<tr>
                <td class="c">${isContinuation ? '<span style="color:#cbd5e1;font-weight:bold;">↳</span>' : (i + 1)}</td>
                <td style="font-size:9.5px;color:#475569;">${isContinuation ? '' : currentDateStr}</td>
                <td>
                    ${isContinuation ? '' : `
                        <div style="line-height:1.2;">
                            <b style="color:#1d4ed8;font-size:11.5px;">${currentName}</b><br/>
                            ${(r.shift && r.shift.toLowerCase().trim() !== '-' && r.shift.toLowerCase().trim() !== 'management') 
                                ? `<span style="color:#16a34a;font-size:9.5px;font-weight:bold;text-transform:uppercase;">${r.shift}</span><br/>` 
                                : '<span style="color:#94a3b8;font-size:9.5px;font-style:italic;">Belum Tercatat</span><br/>'}
                            <span style="color:#94a3b8;font-size:9.5px;">NIK: ${emp?.nik || emp?.username || '-'}</span>
                        </div>
                    `}
                    <div style="margin-top:4px;">
                        <span style="color:#94a3b8; font-size: 9px; font-style: italic;">Sesi ${r.sessionNumber || 1}</span>
                    </div>
                </td>
                <td>
                  <div style="font-family:monospace;font-size:10.5px;line-height:1.4;">
                    IN : <span style="color:#16a34a;font-weight:bold;">${tIn}</span><br/>
                    BRK: <span style="color:#d97706;font-weight:bold;">${tBrkS}</span> - <span style="color:#2563eb;font-weight:bold;">${tBrkE}</span><br/>
                    OUT: <span style="color:#dc2626;font-weight:bold;">${tOut}</span><br/>
                    ${duration > 0 ? `PERMIT: <span style="color:#7c3aed;font-weight:bold;">${duration} Jam</span><br/>` : ''}
                    <div style="border-top:1px solid #eee; margin-top:4px; padding-top:4px; font-weight:bold;">
                      ${(() => {
                        const { netWorkMins } = calculateDailyTotal([r]);
                        return netWorkMins > 0 ? `TOTAL: ${formatDuration(netWorkMins)}` : 'TIDAK LENGKAP';
                    })()}
                    </div>
                  </div>
                  <div style="margin-top:8px; font-size:8.5px; color:#64748b; line-height:1.2; max-width:140px; word-break:break-word; background:#f8fafc; padding:4px; border-radius:4px;">
                    <span style="font-weight:bold; color:#475569; display:block; margin-bottom:2px; text-transform:uppercase; font-size:8px;">LOKASI MASUK:</span>
                    ${checkInLoc || '-'}
                  </div>
                </td>
                <td>
                  <span class="status-badge ${statusClass}">${statusLabel}</span>
                  ${extraNotes}
                </td>
                <td>${photosHtml}</td>
            </tr>`;
            }

            html += `
    </tbody >
  </table >

  <div class="btn-wrap">
    <a id="dl-btn" class="download-btn" href="#">&#11015;&nbsp; Download File</a>
  </div>

  <script>
    var _fn = "${fileName}";
    document.title = _fn;
    window.onload = function() {
      var btn = document.getElementById('dl-btn');
      if (btn) {
        btn.href = window.location.href;
        btn.download = _fn;
      }
      setTimeout(function() { window.print(); }, 600);
    };
  </script>
</body >
</html > `;

            const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
            const blobUrl = URL.createObjectURL(blob);
            
            // Bypass popup blocker by using a hidden link
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = blobUrl;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(blobUrl);
            }, 5000);
        } finally {
            setIsExporting(false);
        }
    };

    const handleBulkExport = async () => {
        const dates: Date[] = [];
        let curr = new Date(startDate);
        const end = new Date(endDate);
        while (curr <= end) {
            dates.push(new Date(curr));
            curr = addDays(curr, 1);
        }

        if (dates.length === 0) {
            toast({
                title: "Info",
                description: "Tidak ada data untuk rentang tanggal yang dipilih.",
            });
            return;
        }

        setIsExporting(true);
        
        let html2pdf: any;
        try {
            html2pdf = await loadHtml2Pdf();
        } catch (err) {
            toast({
                title: "Error",
                description: "Gagal memuat engine pembuat PDF.",
                variant: "destructive"
            });
            setIsExporting(false);
            return;
        }

        toast({
            title: "Export Massal Dimulai",
            description: `Mengekspor ${dates.length} laporan foto harian dalam format PDF secara massal. Harap izinkan download multipel jika diminta browser.`,
        });

        const imageCache: Record<string, string> = {};
        const fetchImageBase64 = async (url: string, retries = 2) => {
            if (!url) return '';
            if (url.startsWith('data:')) return url;
            
            let resolvedUrl = getPhotoUrl(url);
            
            if (imageCache[resolvedUrl]) return imageCache[resolvedUrl];
            
            for (let i = 0; i <= retries; i++) {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 5000); 

                    const res = await fetch(resolvedUrl, { signal: controller.signal });
                    clearTimeout(timeoutId);

                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const blob = await res.blob();
                    const b64 = await new Promise<string>((resolve) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result as string);
                        reader.onerror = () => resolve('');
                        reader.readAsDataURL(blob);
                    });
                    if (b64) {
                        imageCache[resolvedUrl] = b64;
                        return b64;
                    }
                } catch (e) {
                    console.warn(`Export fetch attempt ${i + 1} failed for ${resolvedUrl}:`, e);
                    if (i === retries) return '';
                    await new Promise(r => setTimeout(r, 1000)); 
                }
            }
            return '';
        };

        try {
            // Fetch logo
            let logoDataUrl = '';
            try {
                const logoRes = await fetch('/logo_elok_buah.jpg');
                const logoBlob = await logoRes.blob();
                logoDataUrl = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.readAsDataURL(logoBlob);
                });
            } catch (_) { }

            // Loop through each day and export
            for (let dIdx = 0; dIdx < dates.length; dIdx++) {
                const d1 = dates[dIdx];
                const d2 = addDays(d1, 1);
                
                const dayStr1 = format(d1, "d");
                const monthStr1 = format(d1, "MMMM", { locale: id }).toUpperCase();
                const dayStr2 = format(d2, "d");
                const monthStr2 = format(d2, "MMMM", { locale: id }).toUpperCase();
                const yearStr = format(d1, "yyyy");
                
                const docTitle = `REKAP ABSENSI FOTO NON MANAJEMEN ${dayStr1} ${monthStr1} - ${dayStr2} ${monthStr2} ${yearStr} PT EJA`;

                const dayRecords = attendanceHistory?.filter(att => {
                    const emp = getEmployee(att.userId);
                    if (!emp) return false;
                    
                    if (searchName && !emp.fullName.toLowerCase().includes(searchName.toLowerCase())) return false;
                    
                    const attDate = new Date(att.date);
                    return format(attDate, "yyyy-MM-dd") === format(d1, "yyyy-MM-dd");
                }).sort((a, b) => {
                    const nameA = getEmployee(a.userId)?.fullName || '';
                    const nameB = getEmployee(b.userId)?.fullName || '';
                    if (nameA !== nameB) return nameA.localeCompare(nameB);
                    const timeA = a.checkIn ? new Date(a.checkIn).getTime() : 0;
                    const timeB = b.checkIn ? new Date(b.checkIn).getTime() : 0;
                    return timeA - timeB;
                }) || [];

                const dayUniqueUrls = new Set<string>();
                dayRecords.forEach(r => {
                    if (r.checkInPhoto) dayUniqueUrls.add(r.checkInPhoto);
                    if (r.breakStartPhoto) dayUniqueUrls.add(r.breakStartPhoto);
                    if (r.breakEndPhoto) dayUniqueUrls.add(r.breakEndPhoto);
                    if (r.checkOutPhoto) dayUniqueUrls.add(r.checkOutPhoto);
                    if ((r as any).lateReasonPhoto) dayUniqueUrls.add((r as any).lateReasonPhoto);
                });

                const urlArray = Array.from(dayUniqueUrls);
                const chunkSize = 10;
                for (let k = 0; k < urlArray.length; k += chunkSize) {
                    const chunk = urlArray.slice(k, k + chunkSize);
                    await Promise.all(chunk.map(url => fetchImageBase64(url)));
                }

                let lastShownName = "";
                let lastShownDate = "";

                let html = `<!DOCTYPE html>
<html>
<head>
  <title>${docTitle}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #1e293b; background: white; padding: 28px 36px; }
    .letterhead { display: flex; align-items: center; gap: 16px; padding-bottom: 10px; }
    .logo-img { width: 60px; height: 60px; object-fit: contain; }
    .company-block h1 { font-size: 16px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; color: #1e293b; }
    .company-block .tagline { font-size: 10px; color: #64748b; margin-top: 2px; }
    .hr-thick { border: none; border-top: 2px solid #cbd5e1; margin: 6px 0 2px; }
    .hr-thin  { border: none; border-top: 1px solid #e2e8f0; margin-bottom: 18px; }
    .report-meta { text-align: center; margin-bottom: 20px; }
    .report-meta h2 { font-size: 16px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; color: #1e293b; }
    .report-meta .sub { font-size: 10.5px; margin-top: 4px; color: #475569; }
    table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
    thead tr { background-color: #f8fafc; }
    th { color: #374151; font-weight: 700; text-align: left; padding: 8px 8px; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.4px; border-bottom: 2px solid #1e293b; border-right: 1px solid #e2e8f0; }
    th.c { text-align: center; }
    td { padding: 8px 8px; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; vertical-align: top; }
    tbody tr:nth-child(even) { background-color: #f8fafc; }
    .photo-grid { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
    .photo-item { width: 100px; text-align: center; border: 1px solid #e2e8f0; border-radius: 4px; padding: 4px; background: white; }
    .photo-img { width: 100%; height: 90px; object-fit: cover; border-radius: 2px; }
    .photo-label { font-size: 8px; font-weight: bold; color: #64748b; margin-top: 2px; text-transform: uppercase; }
    .status-badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 9px; text-transform: uppercase; margin-bottom: 4px; }
    .st-hadir { background: #dcfce7; color: #16a34a; }
    .st-telat { background: #ffedd5; color: #ea580c; }
    .st-sakit { background: #dbeafe; color: #2563eb; }
    .st-izin  { background: #f3e8ff; color: #7c3aed; }
    .st-cuti  { background: #e0f2fe; color: #0369a1; }
    .st-alpha { background: #fee2e2; color: #dc2626; }
    .st-unknown { background: #f1f5f9; color: #64748b; }
    .signature-section { margin-top: 48px; display: flex; justify-content: space-between; padding: 0 24px; }
    .sig-box { text-align: center; width: 160px; }
    .sig-label { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #374151; margin-bottom: 64px; }
    .sig-name { font-size: 11px; font-weight: 800; border-top: 1.5px solid #374151; padding-top: 6px; text-transform: uppercase; letter-spacing: 0.5px; color: #1e293b; }
    .footer { margin-top: 18px; font-size: 8.5px; color: #94a3b8; border-top: 1px dashed #cbd5e1; padding-top: 8px; }
    .btn-wrap { text-align: center; margin-top: 20px; }
    .download-btn { display: inline-flex; align-items: center; gap: 8px; background: #1d4ed8; color: #fff; border: none; padding: 10px 28px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; letter-spacing: 0.5px; text-decoration: none; }
    @media print {
      body { padding: 12px 16px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .btn-wrap { display: none !important; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="letterhead">
    <img src="${logoDataUrl}" class="logo-img" alt="Logo" />
    <div class="company-block">
      <h1>PT Elok Jaya Abadhi</h1>
      <p class="tagline">Sistem Manajemen Kehadiran Digital</p>
    </div>
  </div>
  <hr class="hr-thick" />
  <hr class="hr-thin" />
  <div class="report-meta">
    <h2>Laporan Absensi Foto Harian</h2>
    <p class="sub">Periode: ${format(d1, "EEEE, d MMMM yyyy", { locale: id })}</p>
  </div>
  <table>
    <thead>
      <tr>
        <th class="c" style="width:28px;">No</th>
        <th style="width:130px;">Hari & Tanggal</th>
        <th style="width:180px;">Nama Tenaga Kerja</th>
        <th style="width:180px;">Waktu & Jam Kerja</th>
        <th>Status & Catatan</th>
        <th style="width:220px;">Bukti Absen</th>
      </tr>
    </thead>
    <tbody>
      ${dayRecords.length === 0 ? `
        <tr>
          <td colSpan="6" style="text-align:center;padding:20px;color:#94a3b8;">Tidak ada data absensi untuk hari ini.</td>
        </tr>
      ` : dayRecords.map((r, j) => {
            const currentName = getEmployee(r.userId)?.fullName || '-';
            const emp = getEmployee(r.userId);
            const currentDateStr = format(new Date(r.date), 'EEEE, d MMMM yyyy', { locale: id });

            const isContinuation = currentName === lastShownName && currentDateStr === lastShownDate;
            lastShownName = currentName;
            lastShownDate = currentDateStr;

            const sts = isContinuation && r.status === 'late' ? 'present' : (r.status || '-');
            const statusLabel = sts === 'present' ? 'Hadir' : sts === 'late' ? 'Telat' : sts === 'sick' ? 'Sakit' : sts === 'permission' ? 'Izin' : sts === 'cuti' ? 'Cuti' : sts === 'absent' ? 'Alpha' : sts;
            const statusClass = sts === 'present' ? 'st-hadir' : sts === 'late' ? 'st-telat' : sts === 'sick' ? 'st-sakit' : sts === 'permission' ? 'st-izin' : sts === 'cuti' ? 'st-cuti' : sts === 'absent' ? 'st-alpha' : 'st-unknown';

            const tIn = r.checkIn ? format(new Date(r.checkIn), 'HH:mm') : '-';
            const tBrkS = r.breakStart ? format(new Date(r.breakStart), 'HH:mm') : '-';
            const tBrkE = r.breakEnd ? format(new Date(r.breakEnd), 'HH:mm') : '-';
            const tOut = r.checkOut ? format(new Date(r.checkOut), 'HH:mm') : '-';

            let photosHtml = '<div class="photo-grid">';
            const addPhoto = (url: string | null, label: string) => {
                if (url) {
                    let resolvedUrl = getPhotoUrl(url);
                    const b64 = imageCache[resolvedUrl] || (url.startsWith('data:') ? url : '');
                    if (b64) {
                        photosHtml += `<div class="photo-item"><img src="${b64}" class="photo-img"/><div class="photo-label">${label}</div></div>`;
                    } else {
                        photosHtml += `<div class="photo-item"><div style="height:65px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:9px;">No Image</div><div class="photo-label">${label}</div></div>`;
                    }
                }
            };

            addPhoto(r.checkInPhoto, 'Masuk');
            addPhoto(r.breakStartPhoto, 'Mulai Ist.');
            addPhoto(r.breakEndPhoto, 'Selesai Ist.');
            addPhoto(r.checkOutPhoto, 'Pulang');
            addPhoto((r as any).lateReasonPhoto, 'Bukti Telat');
            photosHtml += '</div>';

            if (photosHtml === '<div class="photo-grid"></div>') {
                photosHtml = '<span style="color:#94a3b8;font-style:italic;font-size:9px;">Tidak ada bukti foto</span>';
            }

            const { duration, cleanNotes } = parsePermitInfo(r.notes);
            let extraNotes = '';
            if (cleanNotes) extraNotes += `<div style="margin-top:2px;color:#475569;font-size:9.5px;line-height:1.3;"><b>Cat:\n</b> ${cleanNotes}</div>`;
            if (sts === 'late' && (r as any).lateReason) extraNotes += `<div style="margin-top:2px;color:#c2410c;font-size:9.5px;line-height:1.3;"><b>Alasan Telat:\n</b> ${(r as any).lateReason}</div>`;

            const checkInLoc = r.checkInLocation || '-';

            return `<tr>
            <td class="c">${isContinuation ? '<span style="color:#cbd5e1;font-weight:bold;">↳</span>' : (j + 1)}</td>
            <td style="font-size:9.5px;color:#475569;">${isContinuation ? '' : currentDateStr}</td>
            <td>
                ${isContinuation ? '' : `
                    <div style="line-height:1.2;">
                        <b style="color:#1d4ed8;font-size:11.5px;">${currentName}</b><br/>
                        ${(r.shift && r.shift.toLowerCase().trim() !== '-' && r.shift.toLowerCase().trim() !== 'management') 
                            ? `<span style="color:#94a3b8;font-size:9.5px;font-weight:bold;text-transform:uppercase;">${r.shift}</span><br/>` 
                            : '<span style="color:#94a3b8;font-size:9.5px;font-style:italic;">Belum Tercatat</span><br/>'}
                        <span style="color:#94a3b8;font-size:9.5px;">NIK: ${emp?.nik || emp?.username || '-'}</span>
                    </div>
                `}
                <div style="margin-top:4px;">
                    <span style="color:#94a3b8; font-size: 9px; font-style: italic;">Sesi ${r.sessionNumber || 1}</span>
                </div>
            </td>
            <td>
              <div style="font-family:monospace;font-size:10.5px;line-height:1.4;">
                IN : <span style="color:#16a34a;font-weight:bold;">${tIn}</span><br/>
                BRK: <span style="color:#d97706;font-weight:bold;">${tBrkS}</span> - <span style="color:#2563eb;font-weight:bold;">${tBrkE}</span><br/>
                OUT: <span style="color:#dc2626;font-weight:bold;">${tOut}</span><br/>
                ${duration > 0 ? `PERMIT: <span style="color:#7c3aed;font-weight:bold;">${duration} Jam</span><br/>` : ''}
                <div style="border-top:1px solid #eee; margin-top:4px; padding-top:4px; font-weight:bold;">
                  ${(() => {
                    const { netWorkMins } = calculateDailyTotal([r]);
                    return netWorkMins > 0 ? `TOTAL: ${formatDuration(netWorkMins)}` : 'TIDAK LENGKAP';
                })()}
                </div>
              </div>
              <div style="margin-top:8px; font-size:8.5px; color:#64748b; line-height:1.2; max-width:140px; word-break:break-word; background:#f8fafc; padding:4px; border-radius:4px;">
                <span style="font-weight:bold; color:#475569; display:block; margin-bottom:2px; text-transform:uppercase; font-size:8px;">LOKASI MASUK:</span>
                ${checkInLoc || '-'}
              </div>
            </td>
            <td>
              <span class="status-badge ${statusClass}">${statusLabel}</span>
              ${extraNotes}
            </td>
            <td>${photosHtml}</td>
        </tr>`;
        }).join('')}
</tbody>
</table>
</body>
</html>`;

                const opt = {
                    margin:       [10, 10, 10, 10],
                    filename:     `${docTitle}.pdf`,
                    image:        { type: 'jpeg', quality: 0.98 },
                    html2canvas:  { scale: 2, useCORS: true, logging: false },
                    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
                    pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
                };

                const container = document.createElement('div');
                container.style.position = 'absolute';
                container.style.left = '-9999px';
                container.style.top = '-9999px';
                container.style.width = '794px';
                container.style.backgroundColor = 'white';
                container.innerHTML = html;

                document.body.appendChild(container);

                try {
                    await html2pdf().set(opt).from(container).save();
                } catch (e) {
                    console.error("Gagal membuat PDF untuk tanggal", d1, e);
                }

                document.body.removeChild(container);

                await new Promise(resolve => setTimeout(resolve, 600));
            }
        } finally {
            setIsExporting(false);
        }
    };

    const PhotoThumbnail = ({ url, label, location }: { url: string | null, label: string, location?: string | null }) => {
        if (!url) return null;

        const viewLink = getDriveViewLink(url);

        return (
            <div className="flex flex-col items-center gap-1 p-2 border border-gray-100 rounded-lg bg-gray-50/50">
                <p className="text-[10px] font-bold text-gray-500">{label}</p>
                <div className="w-16 h-16 rounded-md overflow-hidden bg-gray-200 border border-gray-300 flex items-center justify-center relative group">
                    <img src={getPhotoUrl(url)} alt={label} className="w-full h-full object-cover" />
                    <a
                        href={viewLink || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-bold"
                    >
                        Lihat<br />File
                    </a>
                </div>
                {location && (
                    <div className="flex items-center gap-0.5 text-[9px] text-gray-400 max-w-[70px] mt-1" title={location}>
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="truncate">{location}</span>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="w-full">
            {/* Main Content */}
            <div className="space-y-6">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight">Riwayat Absensi Tenaga Kerja</h1>
                    <p className="text-sm text-gray-500">Pantau waktu masuk, pulang, status keterlambatan, dan log GPS presensi tenaga kerja.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Select value={reportType} onValueChange={(val: any) => { setReportType(val); setCurrentPage(1); }}>
                        <SelectTrigger className="w-[140px] bg-white h-10 font-medium">
                            <SelectValue placeholder="Pilih Periode" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="daily">Harian</SelectItem>
                            <SelectItem value="weekly">Mingguan</SelectItem>
                            <SelectItem value="monthly">Bulanan</SelectItem>
                            <SelectItem value="custom">Rentang Khusus</SelectItem>
                        </SelectContent>
                    </Select>
                    
                    {reportType === "custom" ? (
                        <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-gray-200 h-10">
                            <Input 
                                type="date" 
                                className="h-8 text-xs border-none w-36 focus-visible:ring-0 shadow-none" 
                                value={customStartDate} 
                                onChange={(e) => { setCustomStartDate(e.target.value); setCurrentPage(1); }} 
                            />
                            <span className="text-gray-400 font-bold">-</span>
                            <Input 
                                type="date" 
                                className="h-8 text-xs border-none w-36 focus-visible:ring-0 shadow-none" 
                                value={customEndDate} 
                                onChange={(e) => { setCustomEndDate(e.target.value); setCurrentPage(1); }} 
                            />
                        </div>
                    ) : (
                        <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-200 p-1 h-10">
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-gray-100" onClick={handlePrev}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <div className="text-sm font-bold px-2 min-w-[120px] text-center text-gray-700">
                                {reportType === 'daily' 
                                    ? format(targetDate, "dd MMM yyyy", { locale: id })
                                    : reportType === 'weekly'
                                    ? `${format(startOfWeek(targetDate, { weekStartsOn: 1 }), "dd MMM")} - ${format(endOfWeek(targetDate, { weekStartsOn: 1 }), "dd MMM")}`
                                    : format(targetDate, "MMM yyyy", { locale: id })
                                }
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-gray-100" onClick={handleNext}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                    <Button
                        variant="outline"
                        className="rounded-lg gap-2 cursor-pointer bg-white h-10"
                        onClick={() => setLocation("/admin/recap")}
                    >
                        Lihat Rekap Absen
                    </Button>
                    {reportType === "custom" && (
                        <Button 
                            variant="outline" 
                            className="gap-2 bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 h-10 font-bold shadow-sm" 
                            onClick={handleBulkExport}
                            disabled={isExporting}
                        >
                            <FileDown className="h-4 w-4" /> {isExporting ? "Mengekspor..." : "Export Foto Massal"}
                        </Button>
                    )}
                    <Button 
                        variant="outline" 
                        className="gap-2 h-10 font-bold shadow-sm" 
                        onClick={handleExport}
                        disabled={isExporting}
                    >
                        <FileDown className="h-4 w-4" /> Export Foto
                    </Button>
                </div>
            </div>

            <div className="space-y-6">
                

                <div className="bg-white rounded-xl overflow-hidden mb-6">
                    <div className="p-4 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4 border-b border-gray-50 bg-white">
                        <div className="flex flex-col md:flex-row gap-2 md:items-center">
                            <span>Data Periode: {format(startDate, 'dd MMM yyyy', { locale: id })} - {format(endDate, 'dd MMM yyyy', { locale: id })}</span>
                            <div className="relative md:ml-4">
                                <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                                <Input
                                    placeholder="Cari Nama Tenaga Kerja..."
                                    value={searchName}
                                    onChange={(e) => { setSearchName(e.target.value); setCurrentPage(1); }}
                                    className="h-8 text-xs pl-9 w-full md:w-64"
                                />
                            </div>
                        </div>
                        <div className="text-sm font-medium text-primary bg-primary/5 px-3 py-1 rounded-full border border-primary/10">
                            {filteredRecords.length} Data Absensi
                        </div>
                    </div>

                    <div className="p-0">
                        {isLoadingAttendance ? (
                            <div className="p-12 text-center text-gray-400">Memuat data...</div>
                        ) : filteredRecords.length === 0 ? (
                            <div className="p-12 text-center text-gray-400">
                                <History className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                                <p>Tidak ada data absensi untuk periode ini.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left whitespace-nowrap">
                                    <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-100">
                                        <tr>
                                            <th className="px-6 py-4 font-bold cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => toggleSort('date')}>
                                                <div className="flex items-center gap-1">
                                                    Tanggal <ArrowUpDown className={`h-3 w-3 ${sortField === 'date' ? 'text-primary' : 'text-gray-400'}`} />
                                                </div>
                                            </th>
                                            <th className="px-6 py-4 font-bold cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => toggleSort('name')}>
                                                <div className="flex items-center gap-1">
                                                    Nama Tenaga Kerja <ArrowUpDown className={`h-3 w-3 ${sortField === 'name' ? 'text-primary' : 'text-gray-400'}`} />
                                                </div>
                                            </th>
                                            <th className="px-6 py-4 font-bold text-center">Waktu Absen</th>
                                            <th className="px-6 py-4 font-bold">Foto Bukti</th>
                                            <th className="px-6 py-4 font-bold">Status & Keterangan</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 bg-white">
                                        {paginatedData.map((record, index) => {
                                            const emp = getEmployee(record.userId);
                                            const recordDateStr = format(new Date(record.date), 'EEEE, d MMMM yyyy', { locale: id });

                                            const prevRecord = index > 0 ? paginatedData[index - 1] : null;
                                            const prevEmpName = prevRecord ? getEmployee(prevRecord.userId)?.fullName : null;
                                            const prevDateStr = prevRecord ? format(new Date(prevRecord.date), 'EEEE, d MMMM yyyy', { locale: id }) : null;
                                            const isContinuation = emp?.fullName === prevEmpName && recordDateStr === prevDateStr;

                                            const effectiveStatus = isContinuation && record.status === 'late' ? 'present' : record.status;

                                            return (
                                                <tr key={record.id} className="hover:bg-gray-50/50 transition-colors">
                                                    <td className="px-6 py-4 align-top">
                                                        <span className="text-xs font-semibold text-gray-500">
                                                            {isContinuation ? '' : recordDateStr}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 align-top">
                                                        {isContinuation ? (
                                                            <div className="flex items-center gap-3 ml-6 opacity-40">
                                                                <span className="text-gray-400">↳</span>
                                                                <span className="text-xs italic text-gray-400">Sesi {record.sessionNumber || 1}</span>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0">
                                                                    {emp?.fullName?.charAt(0) || '?'}
                                                                </div>
                                                                <div>
                                                                    <div className="flex items-center gap-2 leading-tight">
                                                                        <p className="font-bold text-gray-900">{emp?.fullName || 'Unknown'}</p>
                                                                        <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">Sesi {record.sessionNumber || 1}</span>
                                                                    </div>
                                                                    {record.shift && record.shift.toLowerCase().trim() !== '-' && record.shift.toLowerCase().trim() !== 'management' ? (
                                                                        <p className="text-[10px] font-bold text-primary mt-0.5 uppercase tracking-wide">{record.shift}</p>
                                                                    ) : (
                                                                        <p className="text-[10px] italic text-gray-400 mt-0.5 uppercase tracking-wide">Belum Tercatat</p>
                                                                    )}
                                                                    <p className="text-[10px] text-gray-400 font-medium leading-tight">NIK: {emp?.nik || emp?.username}</p>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 align-top">
                                                        <div className="flex flex-col gap-2">
                                                            <div className="flex flex-col gap-1 text-[11px] font-mono">
                                                                <div className="flex justify-between w-32">
                                                                    <span className="text-gray-500">Masuk:</span>
                                                                    <span className="font-bold text-primary">{record.checkIn ? format(new Date(record.checkIn), 'HH:mm') : '-'}</span>
                                                                </div>
                                                                <div className="flex justify-between w-32">
                                                                    <span className="text-gray-500">Istirahat:</span>
                                                                    <span className="font-bold text-orange-600">{record.breakStart ? format(new Date(record.breakStart), 'HH:mm') : '-'}</span>
                                                                </div>
                                                                <div className="flex justify-between w-32">
                                                                    <span className="text-gray-500">Selesai:</span>
                                                                    <span className="font-bold text-blue-600">{record.breakEnd ? format(new Date(record.breakEnd), 'HH:mm') : '-'}</span>
                                                                </div>
                                                                <div className="flex justify-between w-32">
                                                                    <span className="text-gray-500">Pulang:</span>
                                                                    <span className="font-bold text-red-600">{record.checkOut ? format(new Date(record.checkOut), 'HH:mm') : '-'}</span>
                                                                </div>

                                                                {(() => {
                                                                    const { duration } = parsePermitInfo(record.notes);
                                                                    return duration > 0 && (
                                                                        <div className="flex justify-between w-32 pt-1 border-t border-gray-100 mt-1">
                                                                            <span className="text-gray-500 font-bold">Izin:</span>
                                                                            <span className="font-bold text-purple-600">{duration} Jam</span>
                                                                        </div>
                                                                    );
                                                                })()}

                                                                <div className="mt-2 border-t border-gray-100 pt-1">
                                                                    <p className="text-[10px] font-bold text-gray-900">
                                                                        {(() => {
                                                                            const { netWorkMins } = calculateDailyTotal([record]);
                                                                            return netWorkMins > 0 ? `Total Kerja: ${formatDuration(netWorkMins)}` : "Absensi belum lengkap";
                                                                        })()}
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            {record.checkInLocation && (
                                                                <div className="flex items-start gap-1.5 p-2 bg-gray-50 rounded-lg border border-gray-100 max-w-[160px]">
                                                                    <MapPin className="h-3 w-3 text-gray-400 mt-0.5 shrink-0" />
                                                                    <p className="text-[10px] text-gray-500 leading-relaxed break-words line-clamp-3" title={record.checkInLocation}>
                                                                        {record.checkInLocation}
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 align-top">
                                                        <div className="flex gap-2">
                                                            <PhotoThumbnail url={record.checkInPhoto} label="Masuk" location={record.checkInLocation} />
                                                            <PhotoThumbnail url={record.breakStartPhoto} label="Mulai Ist" location={record.breakStartLocation} />
                                                            <PhotoThumbnail url={record.breakEndPhoto} label="Slsai Ist" location={record.breakEndLocation} />
                                                            <PhotoThumbnail url={record.checkOutPhoto} label="Pulang" location={record.checkOutLocation} />
                                                            <PhotoThumbnail url={record.lateReasonPhoto} label="Bukti Telat" />

                                                            {!record.checkInPhoto && !record.checkOutPhoto && !record.breakStartPhoto && !record.breakEndPhoto && !record.lateReasonPhoto && (
                                                                <div className="flex items-center justify-center p-4 border border-dashed border-gray-200 rounded-lg bg-gray-50 w-full min-w-[120px]">
                                                                    <span className="text-xs text-gray-400 italic">Tidak ada foto</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 align-top">
                                                        <div className="flex flex-col gap-2 items-start max-w-[200px]">
                                                            <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase
                                                                ${effectiveStatus === 'present' ? 'bg-primary/10 text-primary-foreground' :
                                                                    effectiveStatus === 'late' ? 'bg-orange-100 text-orange-700' :
                                                                        effectiveStatus === 'sick' ? 'bg-blue-100 text-blue-700' :
                                                                            effectiveStatus === 'permission' ? 'bg-purple-100 text-purple-700' :
                                                                                effectiveStatus === 'cuti' ? 'bg-teal-100 text-teal-700' :
                                                                                    'bg-gray-100 text-gray-700'
                                                                }`}>
                                                                {effectiveStatus === 'present' ? 'Hadir' :
                                                                    effectiveStatus === 'late' ? 'Telat' :
                                                                        effectiveStatus === 'sick' ? 'Sakit' :
                                                                            effectiveStatus === 'permission' ? 'Izin' :
                                                                                effectiveStatus === 'cuti' ? 'Cuti' :
                                                                                    effectiveStatus === 'absent' ? 'Alpha' : effectiveStatus}
                                                            </span>

                                                            {(() => {
                                                                const { duration, cleanNotes } = parsePermitInfo(record.notes);
                                                                return cleanNotes && (
                                                                    <p className="text-xs text-gray-600 whitespace-normal bg-gray-50 p-2 rounded border border-gray-100 w-full" style={{ wordBreak: 'break-word' }}>
                                                                        <span className="font-semibold block mb-0.5">Catatan:</span>
                                                                        {cleanNotes}
                                                                    </p>
                                                                );
                                                            })()}
                                                            {(effectiveStatus === 'late' && (record as any).lateReason) && (
                                                                <p className="text-xs text-orange-700 whitespace-normal bg-orange-50 p-2 rounded border border-orange-100 w-full" style={{ wordBreak: 'break-word' }}>
                                                                    <span className="font-semibold block mb-0.5">Alasan Telat:</span>
                                                                    {(record as any).lateReason}
                                                                </p>
                                                            )}
                                                            {(() => {
                                                                const meta = parseMetadataForSuspicion((record as any).checkInMetadata);
                                                                if (!meta.isSuspicious) return null;
                                                                return (
                                                                    <div className="flex items-start gap-1.5 bg-orange-50 border border-orange-200 rounded-md p-2 w-full" title={meta.summary}>
                                                                        <span className="mt-0.5"><AlertTriangle className="w-4 h-4 text-orange-500" /></span>
                                                                        <div>
                                                                            <p className="text-[10px] font-bold text-orange-700 uppercase">GPS Mencurigakan</p>
                                                                            <p className="text-[9px] text-orange-600 mt-0.5">{meta.summary.replace('GPS Mencurigakan: ', '')}</p>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        
                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
                                <span className="text-xs text-gray-500 font-medium">
                                    Halaman {currentPage} dari {totalPages}
                                </span>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                        disabled={currentPage === 1}
                                        className="h-8 text-xs px-3"
                                    >
                                        Sebelumnya
                                    </Button>
                                    <div className="flex items-center gap-1">
                                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                                            .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                                            .map((p, i, arr) => (
                                                <div key={p} className="flex items-center">
                                                    {i > 0 && arr[i - 1] !== p - 1 && (
                                                        <span className="px-2 text-gray-400">...</span>
                                                    )}
                                                    <Button
                                                        variant={currentPage === p ? "default" : "outline"}
                                                        size="sm"
                                                        onClick={() => setCurrentPage(p)}
                                                        className={`h-8 w-8 p-0 ${currentPage === p ? 'bg-primary hover:bg-primary/90 text-white border-green-600' : ''}`}
                                                    >
                                                        {p}
                                                    </Button>
                                                </div>
                                            ))}
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                        disabled={currentPage === totalPages}
                                        className="h-8 text-xs px-3"
                                    >
                                        Selanjutnya
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
        </div>
    );
}
