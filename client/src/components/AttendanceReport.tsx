import { format } from "date-fns";
import { id } from "date-fns/locale";
import { User, Attendance } from "@shared/schema";
import { toTitleCase } from "@/lib/utils";

interface AttendanceReportProps {
    date: string;
    records: Attendance[];
    users: User[];
}

export function AttendanceReport({ date, records, users }: AttendanceReportProps) {
    const getEmployee = (userId: number) => {
        return users.find(user => user.id === userId);
    };

    const getPhotoUrl = (value: string | null | undefined): string => {
        if (!value) return '';
        if (value.startsWith('data:')) return value;
        if (value.startsWith('http')) return value;
        if (value.startsWith('/api/')) return value;
        if (value.startsWith('/uploads/')) return value;
        if (!value.includes('/') && !value.includes('.') && value.length > 20) {
            return `/api/images/${value}`;
        }
        return `/uploads/${value}`;
    };

    const calculateDuration = (checkIn: Date | string | null, checkOut: Date | string | null) => {
        if (!checkIn || !checkOut) return "-";
        const start = new Date(checkIn);
        const end = new Date(checkOut);
        const diffMs = end.getTime() - start.getTime();
        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        return `${diffHrs}j ${diffMins}m`;
    };

    return (
        <div className="bg-white p-8 font-sans text-gray-900 printable-area">
            {/* Report Header */}
            <div className="flex justify-between items-start border-b border-gray-300 pb-4 mb-6">
                <div className="flex items-center gap-4">
                    <img src="/logo_elok_buah.jpg" alt="Logo" className="w-14 h-14 object-contain" />
                    <div>
                        <h1 className="text-xl font-black text-gray-900 tracking-tight">PT ELOK JAYA ABADHI</h1>
                        <p className="text-[11px] text-gray-500 font-medium">Sistem Manajemen Kehadiran Digital</p>
                    </div>
                </div>
            </div>

            <div className="text-center mb-8">
                <h2 className="text-lg font-bold uppercase tracking-[0.2em] text-gray-900 underline underline-offset-8 decoration-2 decoration-gray-800">Laporan Riwayat & Foto Absensi</h2>
                <div className="mt-4 space-y-1">
                    <p className="text-[10px] text-gray-600 font-medium">Tipe: Harian</p>
                    <p className="text-[11px] text-gray-800 font-bold uppercase">
                        Periode: {
                            date.includes('|') 
                                ? `${format(new Date(date.split('|')[0]), "EEEE, d MMM yyyy", { locale: id })} - ${format(new Date(date.split('|')[1]), "EEEE, d MMM yyyy", { locale: id })}`
                                : format(new Date(date), "EEEE, d MMM yyyy", { locale: id })
                        }
                    </p>
                </div>
            </div>

            {/* Table */}
            <table className="w-full border-collapse border border-gray-300 text-xs">
                <thead>
                    <tr className="bg-[#F8FAFC] text-[#475569] uppercase font-bold text-[9px] tracking-wider border-b border-gray-400">
                        <th className="border border-gray-300 px-2 py-3 w-10">NO</th>
                        <th className="border border-gray-300 px-2 py-3 w-24">TANGGAL</th>
                        <th className="border border-gray-300 px-2 py-3 w-40">NAMA TENAGA KERJA</th>
                        <th className="border border-gray-300 px-2 py-3">WAKTU ABSEN</th>
                        <th className="border border-gray-300 px-2 py-3 w-32">STATUS & KETERANGAN</th>
                        <th className="border border-gray-300 px-2 py-3 w-32">BUKTI FOTO (VISUAL)</th>
                    </tr>
                </thead>
                <tbody>
                    {records.map((record, index) => {
                        const emp = getEmployee(record.userId);
                        const duration = calculateDuration(record.checkIn as unknown as string ?? null, record.checkOut as unknown as string ?? null);
                        const isComplete = record.checkIn && record.checkOut && record.breakStart && record.breakEnd;

                        return (
                            <tr key={record.id} className="border-b border-gray-200 hover:bg-gray-50/50">
                                <td className="border border-gray-300 px-2 py-4 text-center font-bold">{index + 1}</td>
                                <td className="border border-gray-300 px-2 py-4 text-center font-medium">
                                    {format(new Date(record.date), "dd/MM/yyyy")}
                                </td>
                                <td className="border border-gray-300 px-3 py-4">
                                    <p className="font-bold text-blue-600 text-xs mb-0.5">{toTitleCase(emp?.fullName || 'Unknown')}</p>
                                    <p className="text-[9px] text-blue-500 font-medium">Sesi {(record as any).sessionNumber || 1}</p>
                                </td>
                                <td className="border border-gray-300 px-3 py-4">
                                    <div className="grid grid-cols-1 gap-1 font-mono text-[10px]">
                                        <p><span className="text-gray-400">IN :</span> <span className="font-bold text-[#0D9488]">{record.checkIn ? format(new Date(record.checkIn), "HH:mm") : "- - : - -"}</span></p>
                                        <p><span className="text-gray-400">BRK:</span> <span className="font-bold text-orange-400">{record.breakStart ? format(new Date(record.breakStart), "HH:mm") : "- - : - -"}</span></p>
                                        <p><span className="text-gray-400">OUT:</span> <span className="font-bold text-red-500">{record.checkOut ? format(new Date(record.checkOut), "HH:mm") : "- - : - -"}</span></p>
                                        
                                        <div className="mt-2">
                                            <p className={`text-[10px] font-bold uppercase ${isComplete ? 'text-green-600' : 'text-red-500'}`}>
                                                {isComplete ? 'LENGKAP' : 'TIDAK LENGKAP'}
                                            </p>
                                        </div>

                                        {record.checkInLocation && (
                                            <div className="mt-3 text-[9px] text-gray-500 leading-tight">
                                                <p className="font-bold flex items-center gap-0.5 mb-1 text-gray-700 uppercase">
                                                    LOKASI MASUK:
                                                </p>
                                                <p className="text-gray-500 text-[8px] leading-relaxed">{record.checkInLocation}</p>
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td className="border border-gray-300 px-2 py-4 text-center align-top">
                                    <span className={`inline-block px-3 py-1 rounded text-[10px] font-black uppercase mb-2 ${
                                        record.status === 'present' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                    }`}>
                                        {record.status === 'present' ? 'Hadir' : toTitleCase(record.status)}
                                    </span>
                                    {record.notes && (
                                        <p className="text-[10px] text-gray-500 text-left leading-snug font-medium italic">
                                            Cat: {record.notes}
                                        </p>
                                    )}
                                </td>
                                <td className="border border-gray-300 px-2 py-4">
                                    <div className="flex gap-3 px-2 justify-start items-start">
                                        {record.checkInPhoto && (
                                            <div className="flex flex-col items-center gap-1.5">
                                                <div className="w-16 h-20 border border-gray-200 rounded overflow-hidden shadow-sm">
                                                    <img src={getPhotoUrl(record.checkInPhoto)} alt="Masuk" className="w-full h-full object-cover" />
                                                </div>
                                                <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-gray-500">MASUK</span>
                                            </div>
                                        )}
                                        {/* Show only Masuk photo if others are null, or all if available */}
                                        {!record.checkInPhoto && (record.breakStartPhoto || record.breakEndPhoto || record.checkOutPhoto) && (
                                            <p className="text-[10px] text-gray-400 italic">Foto lain tersedia</p>
                                        )}
                                        {!record.checkInPhoto && !record.checkOutPhoto && !record.breakStartPhoto && !record.breakEndPhoto && (
                                            <div className="w-full h-16 flex items-center justify-center text-[10px] text-gray-300 font-bold uppercase bg-gray-50 rounded">
                                                NO IMAGE
                                            </div>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            <div className="mt-8 flex justify-end">
                <div className="text-center w-48">
                    <p className="text-[10px] text-gray-500 mb-12">Dicetak pada: {format(new Date(), "d/MM/yyyy HH:mm")}</p>
                    <div className="border-t border-gray-300 pt-1">
                        <p className="text-xs font-bold text-gray-800 uppercase">Admin Absensi</p>
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    @page { size: A4; margin: 1cm; }
                    body * { visibility: hidden; }
                    .printable-area, .printable-area * { visibility: visible; }
                    .printable-area { position: absolute; left: 0; top: 0; width: 100%; }
                }
            `}} />
        </div>
    );
}
