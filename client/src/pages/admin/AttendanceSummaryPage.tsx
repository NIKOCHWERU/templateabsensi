import { useQuery } from "@tanstack/react-query";
import { User, Attendance } from "@shared/schema";
import { format, subMonths, addMonths, isSameMonth, setDate, isAfter, isBefore, isEqual, differenceInBusinessDays, startOfMonth, endOfMonth, isWeekend, startOfWeek, endOfWeek, startOfDay, endOfDay, subDays, addDays } from "date-fns";
import { id } from "date-fns/locale";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Image as ImageIcon, CalendarIcon, ArrowUpDown, ChevronLeft, ChevronRight, FileDown, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { cn, formatLongDate } from "@/lib/utils";
import { calculateDailyTotal, formatDuration } from "@/lib/attendance";

export default function AttendanceSummaryPage() {
    const [, setLocation] = useLocation();
    // State for selected period (e.g., Feb 2026 means Jan 26 - Feb 25)
    const [targetDate, setTargetDate] = useState(new Date());
    const [customStartDate, setCustomStartDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [customEndDate, setCustomEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [logoBase64, setLogoBase64] = useState("");

    useEffect(() => {
        // Pre-fetch logo to avoid async delays during export that trigger popup blockers
        fetch('/logo_elok_buah.jpg')
            .then(res => res.blob())
            .then(blob => {
                const reader = new FileReader();
                reader.onload = () => setLogoBase64(reader.result as string);
                reader.readAsDataURL(blob);
            })
            .catch(() => {});
    }, []);
    const [searchTerm, setSearchTerm] = useState("");
    const [sortField, setSortField] = useState<string>("fullName");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

    const { data: users } = useQuery<User[]>({
        queryKey: ["/api/admin/users"],
    });

    const { data: allAttendance } = useQuery<Attendance[]>({
        queryKey: ["/api/attendance"],
    });

    const [reportType, setReportType] = useState<"daily" | "weekly" | "monthly" | "custom">("daily");

    // Calculate Period Range
    let startDate: Date = startOfDay(new Date());
    let endDate: Date = endOfDay(new Date());

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

    const handlePrev = () => {
        if (reportType === "daily") setTargetDate(d => subDays(d, 1));
        else if (reportType === "weekly") setTargetDate(d => subDays(d, 7));
        else setTargetDate(d => subMonths(d, 1));
    };

    const handleNext = () => {
        if (reportType === "daily") setTargetDate(d => addDays(d, 1));
        else if (reportType === "weekly") setTargetDate(d => addDays(d, 7));
        else setTargetDate(d => addMonths(d, 1));
    };

    // Filter Employees
    const employees = users?.filter(u => u.role === 'employee') || [];
    const filteredEmployees = employees.filter(emp =>
        emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (emp.nik && emp.nik.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    // Helper to check if a date is in range
    const isDateInRange = (date: Date) => {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        const s = new Date(startDate);
        s.setHours(0, 0, 0, 0);
        const e = new Date(endDate);
        e.setHours(0, 0, 0, 0);
        return (isAfter(d, s) || isEqual(d, s)) && (isBefore(d, e) || isEqual(d, e));
    };

    // Helper to calculate business days in range (Simple: Mon-Fri)
    // Ideally this should use a holiday calendar, but for now just exclude weekends.
    const calculateWorkingDays = () => {
        let count = 0;
        let curDate = new Date(startDate);
        while (curDate <= endDate) {
            const day = curDate.getDay();
            if (day !== 0 && day !== 6) count++;
            curDate.setDate(curDate.getDate() + 1);
        }
        return count;
    };
    const totalWorkingDays = calculateWorkingDays();

    // Calculate Stats per Employee
    const getAttendanceForPeriod = (userId: number) => {
        return allAttendance?.filter(a => a.userId === userId && isDateInRange(new Date(a.date))) || [];
    };

    const employeeStats = filteredEmployees.map(emp => {
        const empAttendance = getAttendanceForPeriod(emp.id);

        const present = empAttendance.filter(a => a.status === 'present').length;
        const late = empAttendance.filter(a => a.status === 'late').length;
        const sick = empAttendance.filter(a => a.status === 'sick').length;
        const permission = empAttendance.filter(a => a.status === 'permission').length;
        const off = empAttendance.filter(a => a.status === 'off').length;

        // Alpha calculation:
        // iterate days from startDate to min(endDate, today)
        // check if record exists. if not -> alpha.
        let alphaCount = 0;
        let iterDate = new Date(startDate);
        const today = new Date();
        const cutoff = isBefore(today, endDate) ? today : endDate;

        while (iterDate <= cutoff) {
            if (iterDate.getDay() !== 0 && iterDate.getDay() !== 6) { // Skip weekends
                const dayStr = iterDate.toDateString();
                const hasRecord = empAttendance.some(a => new Date(a.date).toDateString() === dayStr);
                if (!hasRecord) {
                    alphaCount++;
                }
            }
            iterDate.setDate(iterDate.getDate() + 1);
        }

        return {
            ...emp,
            stats: {
                present,
                late,
                sick,
                permission,
                off,
                alpha: alphaCount,
                totalAttendance: present + late
            }
        };
    });

    const sortedEmployees = [...employeeStats].sort((a, b) => {
        let valA: any, valB: any;

        switch (sortField) {
            case 'present': valA = a.stats.present; valB = b.stats.present; break;
            case 'late': valA = a.stats.late; valB = b.stats.late; break;
            case 'sick': valA = a.stats.sick; valB = b.stats.sick; break;
            case 'permission': valA = a.stats.permission; valB = b.stats.permission; break;
            case 'off': valA = a.stats.off; valB = b.stats.off; break;
            case 'alpha': valA = a.stats.alpha; valB = b.stats.alpha; break;

            default: valA = a.fullName.toLowerCase(); valB = b.fullName.toLowerCase();
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
    });

    const toggleSort = (field: string) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('asc');
        }
    };

    const handleExport = () => {
        let periodStr = '';
        if (reportType === 'daily') {
            periodStr = formatLongDate(targetDate).toUpperCase();
        } else if (reportType === 'weekly') {
            periodStr = `${format(startDate, "d MMMM yyyy", { locale: id })} - ${format(endDate, "d MMMM yyyy", { locale: id })}`.toUpperCase();
        } else if (reportType === 'custom') {
            periodStr = `${format(startDate, "d MMMM yyyy", { locale: id })} - ${format(endDate, "d MMMM yyyy", { locale: id })}`.toUpperCase();
        } else {
            periodStr = format(targetDate, "MMMM yyyy", { locale: id }).toUpperCase();
        }

        const fileName = `LAPORAN ABSENSI SUMMARY PT EJA - ${periodStr}.html`;

        let tableHeader: string = "";
        let tableRows: string = "";

        const grandTotals = sortedEmployees.reduce((acc, emp) => ({
            present: acc.present + emp.stats.present,
            late: acc.late + emp.stats.late,
            sick: acc.sick + emp.stats.sick,
            permission: acc.permission + emp.stats.permission,
            off: acc.off + emp.stats.off,
            alpha: acc.alpha + emp.stats.alpha,
        }), { present: 0, late: 0, sick: 0, permission: 0, off: 0, alpha: 0 });

        tableHeader = `
            <tr>
                <th class="c" style="width: 40px;">No</th>
                <th>Nama Tenaga Kerja</th>
                <th class="c" style="width: 70px;">Hadir</th>
                <th class="c" style="width: 70px;">Telat</th>
                <th class="c" style="width: 70px;">Sakit</th>
                <th class="c" style="width: 70px;">Izin</th>
                <th class="c" style="width: 70px;">Alpha</th>
                <th class="c" style="width: 70px;">Off</th>
            </tr>
        `;

        tableRows = sortedEmployees.map((emp, index) => `
            <tr>
                <td class="col-no">${index + 1}</td>
                <td>
                    <div style="font-weight: 700; color: #1e293b; font-size: 13px;">${emp.fullName}</div>
                    <div style="font-size: 10px; color: #64748b; font-family: monospace;">NIK: ${emp.nik || '-'}</div>
                </td>
                <td class="c"><span class="st-hadir">${emp.stats.present}</span></td>
                <td class="c"><span class="st-telat">${emp.stats.late}</span></td>
                <td class="c"><span class="st-sakit">${emp.stats.sick}</span></td>
                <td class="c"><span class="st-izin">${emp.stats.permission}</span></td>
                <td class="c"><span class="st-alpha">${emp.stats.alpha}</span></td>
                <td class="c"><span class="st-off">${emp.stats.off}</span></td>
            </tr>
        `).join('') + `
            <tr style="background: #f1f5f9; font-weight: 800; border-top: 2px solid #1e293b;">
                <td colspan="2" style="text-align: right; padding-right: 20px; text-transform: uppercase; letter-spacing: 1px;">Grand Total</td>
                <td class="c"><span class="st-hadir">${grandTotals.present}</span></td>
                <td class="c"><span class="st-telat">${grandTotals.late}</span></td>
                <td class="c"><span class="st-sakit">${grandTotals.sick}</span></td>
                <td class="c"><span class="st-izin">${grandTotals.permission}</span></td>
                <td class="c"><span class="st-alpha">${grandTotals.alpha}</span></td>
                <td class="c"><span class="st-off">${grandTotals.off}</span></td>
            </tr>
        `;

        // Generate Detailed Evidence Section
        let detailHtml = "";
        sortedEmployees.forEach(emp => {
            const records = getAttendanceForPeriod(emp.id);
            if (records.length > 0) {
                // Sort records by date
                records.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                
                detailHtml += `
                    <div style="margin-top: 30px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; page-break-inside: avoid;">
                        <div style="background: #f8fafc; padding: 10px 15px; border-bottom: 1px solid #e2e8f0;">
                            <h3 style="margin: 0; font-size: 12px; color: #1e293b;">BUKTI DETAIL: ${emp.fullName.toUpperCase()}</h3>
                        </div>
                        <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
                            <thead style="background: #f1f5f9;">
                                <tr>
                                    <th style="padding: 6px 10px; text-align: center; border-bottom: 1px solid #e2e8f0; width: 30px;">No</th>
                                    <th style="padding: 6px 10px; text-align: left; border-bottom: 1px solid #e2e8f0; width: 140px;">Tanggal</th>
                                    <th style="padding: 6px 10px; text-align: center; border-bottom: 1px solid #e2e8f0;">Masuk</th>
                                    <th style="padding: 6px 10px; text-align: center; border-bottom: 1px solid #e2e8f0;">Pulang</th>
                                    <th style="padding: 6px 10px; text-align: center; border-bottom: 1px solid #e2e8f0;">Durasi</th>
                                    <th style="padding: 6px 10px; text-align: center; border-bottom: 1px solid #e2e8f0;">Status</th>
                                    <th style="padding: 6px 10px; text-align: left; border-bottom: 1px solid #e2e8f0; width: 250px;">Alasan / Ket. Jam</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${records.map((r, idx) => {
                                    const inTime = r.checkIn ? format(new Date(r.checkIn), "HH:mm") : "-";
                                    const outTime = r.checkOut ? format(new Date(r.checkOut), "HH:mm") : "-";
                                    
                                    let duration = "-";
                                    if (r.checkIn && r.checkOut) {
                                        const { netWorkMins } = calculateDailyTotal([r]);
                                        duration = formatDuration(netWorkMins);
                                    }

                                    const stClass = r.status === 'present' ? 'st-hadir' :
                                                    r.status === 'late' ? 'st-telat' :
                                                    r.status === 'sick' ? 'st-sakit' :
                                                    r.status === 'permission' ? 'st-izin' :
                                                    r.status === 'off' ? 'st-off' : 'st-alpha';

                                    const stLabel = r.status === 'present' ? 'Hadir' :
                                                   r.status === 'late' ? 'Telat' :
                                                   r.status === 'sick' ? 'Sakit' :
                                                   r.status === 'permission' ? 'Izin' :
                                                   r.status === 'off' ? 'Off Day' : 'Alpha';

                                    return `
                                        <tr>
                                            <td style="padding: 6px 10px; border-bottom: 1px solid #f1f5f9; text-align: center;">${idx + 1}</td>
                                            <td style="padding: 6px 10px; border-bottom: 1px solid #f1f5f9;">${formatLongDate(r.date)}</td>
                                            <td style="padding: 6px 10px; border-bottom: 1px solid #f1f5f9; text-align: center; font-family: monospace; font-weight: bold; color: #15803d;">${inTime}</td>
                                            <td style="padding: 6px 10px; border-bottom: 1px solid #f1f5f9; text-align: center; font-family: monospace; font-weight: bold; color: #b91c1c;">${outTime}</td>
                                            <td style="padding: 6px 10px; border-bottom: 1px solid #f1f5f9; text-align: center; font-weight: bold;">${duration}</td>
                                            <td style="padding: 6px 10px; border-bottom: 1px solid #f1f5f9; text-align: center;"><span class="${stClass}">${stLabel}</span></td>
                                            <td style="padding: 6px 10px; border-bottom: 1px solid #f1f5f9; color: #475569; font-size: 9px; white-space: normal; width: 250px; min-width: 250px;">
                                                ${[r.notes, r.lateReason].filter(Boolean).join(' | ')}
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            }
        });

        const html = `<!DOCTYPE html>
<html>
<head>
  <title>${fileName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #1e293b; background: white; padding: 28px 36px; }

    /* LETTERHEAD */
    .letterhead { display: flex; align-items: center; gap: 16px; padding-bottom: 10px; }
    .logo-img { width: 60px; height: 60px; object-fit: contain; }
    .company-block h1 { font-size: 16px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; color: #1e293b; }
    .company-block .tagline { font-size: 10px; color: #64748b; margin-top: 2px; }
    .hr-thick { border: none; border-top: 2px solid #cbd5e1; margin: 6px 0 2px; }
    .hr-thin  { border: none; border-top: 1px solid #e2e8f0; margin-bottom: 18px; }

    /* TITLE */
    .report-meta { text-align: center; margin-bottom: 20px; }
    .report-meta h2 { font-size: 16px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; color: #1e293b; }
    .report-meta .sub { font-size: 10.5px; margin-top: 4px; color: #475569; }

    /* TABLE */
    table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
    thead tr { background-color: #f8fafc; }
    th { color: #374151; font-weight: 700; text-align: left; padding: 8px 8px; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.4px; border-bottom: 2px solid #1e293b; border-right: 1px solid #e2e8f0; white-space: nowrap; }
    th.c { text-align: center; }
    td { padding: 7px 8px; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; vertical-align: middle; white-space: nowrap; }
    tbody tr:nth-child(even) { background-color: #f8fafc; }

    .col-no   { text-align: center; color: #94a3b8; font-size: 10px; }
    .col-date { color: #374151; font-weight: 600; }
    .col-name { color: #1d4ed8; font-weight: 600; }
    .col-time { font-family: ui-monospace, Consolas, monospace; font-size: 11px; text-align: center; }
    .t-in   { color: #15803d; font-weight: 700; }
    .t-brk  { color: #b45309; font-weight: 700; }
    .t-out  { color: #b91c1c; font-weight: 700; }
    .t-dash { color: #94a3b8; }
    .col-work { font-size: 11px; font-weight: 700; color: #1e293b; }
    .col-brk  { text-align: center; font-size: 11px; font-weight: 700; color: #ea580c; }
    .col-stat { text-align: center; font-weight: 700; font-size: 11px; }
    .st-hadir { color: #16a34a; font-weight: 700; }
    .st-telat { color: #ea580c; font-weight: 700;}
    .st-sakit { color: #2563eb; font-weight: 700;}
    .st-izin  { color: #7c3aed; font-weight: 700;}
    .st-cuti  { color: #0d9488; font-weight: 700;}
    .st-off   { color: #64748b; font-weight: 700;}
    .st-alpha { color: #dc2626; font-weight: 700;}
    .col-note { font-size: 10.5px; color: #475569; white-space: normal; max-width: 200px; }

    /* SIGNATURE */
    .signature-section { margin-top: 48px; display: flex; justify-content: space-between; padding: 0 24px; }
    .sig-box { text-align: center; width: 160px; }
    .sig-label { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #374151; margin-bottom: 64px; }
    .sig-name { font-size: 11px; font-weight: 800; border-top: 1.5px solid #374151; padding-top: 6px; text-transform: uppercase; letter-spacing: 0.5px; color: #1e293b; }

    .footer { margin-top: 18px; font-size: 8.5px; color: #94a3b8; border-top: 1px dashed #cbd5e1; padding-top: 8px; }

    /* DOWNLOAD BUTTON */
    .btn-wrap { text-align: center; margin-top: 20px; }
    .download-btn { display: inline-flex; align-items: center; gap: 8px; background: #1d4ed8; color: #fff; border: none; padding: 10px 28px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; letter-spacing: 0.5px; text-decoration: none; }
    .download-btn:hover { background: #1e40af; }

    @media print {
      body { padding: 12px 16px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      thead tr, tbody tr:nth-child(even) { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .btn-wrap { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="letterhead">
    <img src="${logoBase64}" class="logo-img" alt="Logo" />
    <div class="company-block">
      <h1>PT Elok Jaya Abadhi</h1>
      <p class="tagline">Sistem Manajemen Kehadiran Digital</p>
    </div>
  </div>
  <hr class="hr-thick" />
  <hr class="hr-thin" />

  <div class="report-meta">
    <h2>Laporan Ringkasan Absensi PT EJA</h2>
    <p class="sub">Tipe: ${reportType === 'daily' ? 'Harian' : reportType === 'weekly' ? 'Mingguan' : reportType === 'custom' ? 'Kustom' : 'Bulanan'}</p>
    <p class="sub">Rentang Waktu: ${format(startDate, "EEEE, d MMMM yyyy", { locale: id })} - ${format(endDate, "EEEE, d MMMM yyyy", { locale: id })}</p>
  </div>

  <table>
    <thead>
      ${tableHeader}
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>

  ${detailHtml}

  <div class="signature-section">
    <div class="sig-box">
      <p class="sig-label">Checked By</p>
      <div class="sig-name">NIKO</div>
    </div>
    <div class="sig-box">
      <p class="sig-label">Approved By</p>
      <div class="sig-name">CLAVERINA</div>
    </div>
  </div>

  <div class="footer">
    Dokumen ini dicetak secara otomatis oleh Sistem Absensi PT Elok Jaya Abadhi &mdash; ${format(new Date(), "d MMMM yyyy, HH:mm", { locale: id })} WIB &mdash; Harap simpan sebagai arsip resmi perusahaan.
  </div>

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
</body>
</html>`;

        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
    };

    return (
        <div className="space-y-6">
            

            <div className="space-y-6">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight">Ringkasan Absensi</h1>
                    <p className="text-sm text-gray-500">Analisis statistik kehadiran, tingkat keterlambatan, dan keaktifan presensi tenaga kerja.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    
                </div>
            </div>

            <div className="space-y-6">
                <Card className="border-none shadow-sm mb-6">
                    <CardContent className="p-4 flex items-center justify-between bg-white">
                        <div className="flex gap-6 text-sm">
                            <div>
                                <span className="text-gray-500">Periode:</span>
                                <span className="ml-2 font-semibold text-gray-700">
                                    {formatLongDate(startDate)} - {formatLongDate(endDate)}
                                </span>
                            </div>
                            <div>
                                <span className="text-gray-500">Total Hari Kerja:</span>
                                <span className="ml-2 font-semibold text-gray-700">{totalWorkingDays} Hari</span>
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleExport}
                            className="bg-primary text-white hover:bg-primary/90 hover:text-white border-none shadow-sm gap-2"
                        >
                            <FileDown className="h-4 w-4" /> Export PDF
                        </Button>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-gray-50">
                                <TableRow>
                                    <TableHead className="w-[50px]">No</TableHead>
                                    <TableHead className="min-w-[200px] cursor-pointer hover:bg-gray-100" onClick={() => toggleSort('fullName')}>
                                        <div className="flex items-center gap-1">Tenaga Kerja <ArrowUpDown className="h-3 w-3" /></div>
                                    </TableHead>
                                    <TableHead className="text-center bg-primary/5 text-primary-foreground w-[100px] cursor-pointer hover:bg-primary/10" onClick={() => toggleSort('present')}>
                                        <div className="flex items-center justify-center gap-1">Hadir <ArrowUpDown className="h-3 w-3" /></div>
                                    </TableHead>
                                    <TableHead className="text-center bg-yellow-50 text-yellow-700 w-[100px] cursor-pointer hover:bg-yellow-100" onClick={() => toggleSort('late')}>
                                        <div className="flex items-center justify-center gap-1">Telat <ArrowUpDown className="h-3 w-3" /></div>
                                    </TableHead>
                                    <TableHead className="text-center bg-blue-50 text-blue-700 w-[100px] cursor-pointer hover:bg-blue-100" onClick={() => toggleSort('sick')}>
                                        <div className="flex items-center justify-center gap-1">Sakit <ArrowUpDown className="h-3 w-3" /></div>
                                    </TableHead>
                                    <TableHead className="text-center bg-purple-50 text-purple-700 w-[100px] cursor-pointer hover:bg-purple-100" onClick={() => toggleSort('permission')}>
                                        <div className="flex items-center justify-center gap-1">Izin <ArrowUpDown className="h-3 w-3" /></div>
                                    </TableHead>
                                    <TableHead className="text-center bg-red-50 text-red-700 w-[100px] cursor-pointer hover:bg-red-100" onClick={() => toggleSort('alpha')}>
                                        <div className="flex items-center justify-center gap-1">Alpha <ArrowUpDown className="h-3 w-3" /></div>
                                    </TableHead>
                                    <TableHead className="text-center bg-slate-50 text-slate-700 w-[100px] cursor-pointer hover:bg-slate-100" onClick={() => toggleSort('off')}>
                                        <div className="flex items-center justify-center gap-1">Off <ArrowUpDown className="h-3 w-3" /></div>
                                    </TableHead>

                                    <TableHead className="text-right">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedEmployees.map((emp, index) => {
                                    return (
                                        <TableRow key={emp.id} className="hover:bg-gray-50/50">
                                            <TableCell className="text-gray-500">{index + 1}</TableCell>
                                            <TableCell>
                                                <div>
                                                    <p className="font-semibold text-gray-800">{emp.fullName}</p>
                                                    <p className="text-xs text-gray-500">{emp.nik || '-'}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center font-mono font-bold text-primary bg-primary/5/30">
                                                {emp.stats.present}
                                            </TableCell>
                                            <TableCell className="text-center font-mono font-bold text-yellow-600 bg-yellow-50/30">
                                                {emp.stats.late}
                                            </TableCell>
                                            <TableCell className="text-center font-mono font-bold text-blue-600 bg-blue-50/30">
                                                {emp.stats.sick}
                                            </TableCell>
                                            <TableCell className="text-center font-mono font-bold text-purple-600 bg-purple-50/30">
                                                {emp.stats.permission}
                                            </TableCell>
                                            <TableCell className="text-center font-mono font-bold text-red-600 bg-red-50/30">
                                                {emp.stats.alpha}
                                            </TableCell>
                                            <TableCell className="text-center font-mono font-bold text-slate-600 bg-slate-50/30">
                                                {emp.stats.off}
                                            </TableCell>

                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="sm" onClick={() => setLocation("/admin/employees")}>
                                                    Detail
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                                {employeeStats.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={9} className="h-24 text-center text-gray-500">
                                            Tidak ada data tenaga kerja ditemukan.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </Card>
            </div>
        </div>
        </div>
    );
}
