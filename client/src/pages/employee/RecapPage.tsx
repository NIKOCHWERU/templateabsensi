import { useAuth } from "@/hooks/use-auth";
import { useMonthlyAttendance } from "@/hooks/use-monthly-attendance";
import { BottomNav } from "@/components/BottomNav";
import { CompanyHeader } from "@/components/CompanyHeader";
import { AttendanceCalendar } from "@/components/AttendanceCalendar";
import { useState } from "react";
import { format, subMonths, addMonths, startOfWeek, endOfWeek, isWithinInterval, subWeeks, addWeeks, subDays, addDays } from "date-fns";
import { id } from "date-fns/locale";
import { Loader2, Calendar, Clock, MapPin, Coffee, LogOut, X, LayoutGrid, Calendar as CalendarIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Attendance } from "@shared/schema";
import { calculateDailyTotal, formatDuration } from "@/lib/attendance";

export default function RecapPage() {
  const { user } = useAuth();
  const [reportType, setReportType] = useState<'daily' | 'monthly' | 'custom'>('monthly');
  const [customStartDate, setCustomStartDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [targetDate, setTargetDate] = useState(new Date()); // For daily view
  const [currentDate, setCurrentDate] = useState(new Date()); // Tracks the "display month"
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [weekDate, setWeekDate] = useState(new Date());
  const [selectedRecord, setSelectedRecord] = useState<Attendance | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch for current display month or custom range
  const monthStr = format(reportType === 'daily' ? targetDate : currentDate, 'yyyy-MM');
  const { data: attendanceData, isLoading } = useMonthlyAttendance({
      month: reportType !== 'custom' ? monthStr : undefined,
      startDate: reportType === 'custom' ? customStartDate : undefined,
      endDate: reportType === 'custom' ? customEndDate : undefined,
      userId: user?.id
  });

  const handlePrev = () => {
    if (reportType === 'daily') setTargetDate(d => subDays(d, 1));
    else if (viewMode === 'month') setCurrentDate(subMonths(currentDate, 1));
    else setWeekDate(subWeeks(weekDate, 1));
  };

  const handleNext = () => {
    if (reportType === 'daily') setTargetDate(d => addDays(d, 1));
    else if (viewMode === 'month') setCurrentDate(addMonths(currentDate, 1));
    else setWeekDate(addWeeks(weekDate, 1));
  };

  const handleDateSelect = (date: Date, record?: Attendance) => {
    setSelectedRecord(record || null);
    // If no record exists, we can still set a temporary structure for display
    if (!record) {
      setSelectedRecord({
        id: -1,
        userId: user?.id || 0,
        date: date.toISOString(),
        status: 'absent',
        checkIn: null,
        checkOut: null,
        breakStart: null,
        breakEnd: null,
        checkInPhoto: null,
        checkInLocation: null,
        breakStartPhoto: null,
        breakStartLocation: null,
        breakEndPhoto: null,
        breakEndLocation: null,
        checkOutPhoto: null,
        checkOutLocation: null,
        shiftId: null,
        shift: null,
        sessionNumber: 1,
        notes: "Tidak ada riwayat absensi (Alpa/Libur)",
        lateReason: null,
        lateReasonPhoto: null,
        permitExitAt: null,
        permitResumeAt: null,
        isFakeGps: false
      } as any);
    }
    setIsModalOpen(true);
  };

  // Get filtered data based on view mode
  const filteredData = attendanceData?.filter(record => {
    if (reportType === 'daily') {
      return format(new Date(record.date), 'yyyy-MM-dd') === format(targetDate, 'yyyy-MM-dd');
    }

    if (reportType === 'custom') {
      const date = new Date(record.date);
      date.setHours(0, 0, 0, 0);
      const sDate = new Date(customStartDate);
      sDate.setHours(0, 0, 0, 0);
      const eDate = new Date(customEndDate);
      eDate.setHours(23, 59, 59, 999);
      return date >= sDate && date <= eDate;
    }

    if (viewMode === 'month') return true;

    // For week view, filter current month's data by week boundary
    const date = new Date(record.date);
    const wStart = startOfWeek(weekDate, { weekStartsOn: 1 });
    const wEnd = endOfWeek(weekDate, { weekStartsOn: 1 });
    return isWithinInterval(date, { start: wStart, end: wEnd });
  }) || [];

  // Group records by date to calculate per-day stats
  const dayStatuses = new Map<string, string>();
  filteredData.forEach(record => {
    const dateKey = format(new Date(record.date), 'yyyy-MM-dd');
    const currentStatus = dayStatuses.get(dateKey);
    
    // Status priority: sick > permission > late > present > off > absent
    const statusPriority: Record<string, number> = {
      sick: 6,
      permission: 5,
      late: 4,
      present: 3,
      off: 2,
      absent: 1
    };

    if (!currentStatus || statusPriority[record.status as string] > statusPriority[currentStatus]) {
      dayStatuses.set(dateKey, record.status as string);
    }
  });

  const dailyValues = Array.from(dayStatuses.values());

  // Stats calculation based on unique days
  const stats = {
    present: dailyValues.filter(status => status === 'present').length,
    late: dailyValues.filter(status => status === 'late').length,
    sick: dailyValues.filter(status => status === 'sick').length,
    permission: dailyValues.filter(status => status === 'permission').length,
    absent: dailyValues.filter(status => status === 'absent').length,
  };

  // Pre-calculate daily totals
  const dailyTotals = new Map<string, number>();
  filteredData.forEach(row => {
    const key = format(new Date(row.date), "yyyy-MM-dd");
    if (!dailyTotals.has(key)) {
      const dayRecords = filteredData.filter(r => format(new Date(r.date), "yyyy-MM-dd") === key);
      const { netWorkMins } = calculateDailyTotal(dayRecords);
      dailyTotals.set(key, netWorkMins);
    }
  });

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <CompanyHeader title="Riwayat Absensi" />

      <main className="px-4 -mt-6 max-w-lg mx-auto space-y-6">
        {/* Report Type Selector */}
        <div className="bg-white border border-slate-150 p-1 rounded-2xl flex gap-1 shadow-sm relative z-10">
          <button
            onClick={() => setReportType('daily')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${reportType === 'daily' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Harian
          </button>
          <button
            onClick={() => setReportType('monthly')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${reportType === 'monthly' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Bulanan
          </button>
          <button
            onClick={() => setReportType('custom')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${reportType === 'custom' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Kustom
          </button>
        </div>

        {/* Calendar Card - Only show in Monthly mode */}
        {reportType === 'monthly' && (
          <div className="relative z-10">
            {isLoading ? (
              <div className="bg-white rounded-2xl h-80 flex items-center justify-center shadow-sm border border-border">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            ) : (
              <AttendanceCalendar
                currentDate={currentDate}
                onPrevMonth={handlePrev}
                onNextMonth={handleNext}
                attendanceData={attendanceData || []}
                onDateSelect={handleDateSelect}
                viewMode={viewMode}
                setViewMode={setViewMode}
                weekDate={weekDate}
              />
            )}
          </div>
        )}

        {/* Daily Selector - Only show in Daily mode */}
        {reportType === 'daily' && (
          <div className="relative z-10 bg-white p-4 rounded-2xl shadow-sm border border-border flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={handlePrev} className="h-10 w-10 rounded-xl">
              {/* Using Arrow icons instead? I'll use standard arrows */}
              <div className="font-bold text-lg">←</div>
            </Button>
            <div className="text-center">
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-0.5">
                {format(targetDate, 'EEEE', { locale: id })}
              </div>
              <div className="text-lg font-black text-foreground">
                {format(targetDate, 'dd MMMM yyyy', { locale: id })}
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={handleNext} className="h-10 w-10 rounded-xl">
              <div className="font-bold text-lg">→</div>
            </Button>
          </div>
        )}

        {/* Custom Range Selector */}
        {reportType === 'custom' && (
          <div className="relative z-10 bg-white p-4 rounded-2xl shadow-sm border border-border flex items-center justify-between gap-3">
              <input 
                  type="date" 
                  className="w-full text-xs h-10 border rounded-lg px-2 text-center font-semibold bg-gray-50 focus:ring-primary focus:border-primary text-gray-700"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
              />
              <span className="font-bold text-gray-400">-</span>
              <input 
                  type="date" 
                  className="w-full text-xs h-10 border rounded-lg px-2 text-center font-semibold bg-gray-50 focus:ring-primary focus:border-primary text-gray-700"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
              />
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white p-4 rounded-xl border border-border shadow-sm">
            <div className="text-2xl font-bold text-foreground">{stats.present}</div>
            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Hadir</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-border shadow-sm">
            <div className="text-2xl font-bold text-amber-500">{stats.late}</div>
            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Telat</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-border shadow-sm">
            <div className="text-2xl font-bold text-blue-500">{stats.sick}</div>
            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Sakit</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-border shadow-sm">
            <div className="text-2xl font-bold text-purple-500">{stats.permission}</div>
            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Izin</div>
          </div>
        </div>

        {/* Detailed List */}
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border bg-gray-50 flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-bold text-sm text-foreground">
              {reportType === 'daily' ? 'Sesi Absensi Hari Ini' : reportType === 'custom' ? 'Detail Riwayat Kustom' : 'Detail Riwayat Bulanan'}
            </h3>
          </div>
          <div className="divide-y divide-border">
            {filteredData.map((record) => (
              <div
                key={record.id}
                className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => handleDateSelect(new Date(record.date), record)}
              >
                <div>
                  <div className="font-semibold text-sm flex items-center gap-2">
                    {format(new Date(record.date), 'EEEE, dd MMM yyyy', { locale: id })}
                    {(record as any).sessionNumber && (record as any).sessionNumber > 1 && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full font-bold">Sesi {(record as any).sessionNumber}</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {record.checkIn ? format(new Date(record.checkIn), 'HH:mm') : '-'}
                    {' - '}
                    {record.checkOut ? format(new Date(record.checkOut), 'HH:mm') : '-'}
                    {/* Display Total for Day if first record of day */}
                    {(() => {
                      const dateStr = format(new Date(record.date), "yyyy-MM-dd");
                      const isFirstOfDay = filteredData.find(r => format(new Date(r.date), "yyyy-MM-dd") === dateStr)?.id === record.id;
                      if (isFirstOfDay) {
                        const total = dailyTotals.get(dateStr) || 0;
                        if (total > 0) return <span className="ml-2 font-bold text-gray-700">• Total: {formatDuration(total)}</span>;
                      }
                      return null;
                    })()}
                  </div>
                </div>
                <div className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${record.status === 'present' ? 'bg-emerald-100 text-emerald-700' :
                  record.status === 'late' ? 'bg-amber-100 text-amber-700' :
                    record.status === 'absent' ? 'bg-red-100 text-red-700' :
                      'bg-blue-100 text-blue-700'
                  }`}>
                  {record.status === 'present' ? 'Hadir' :
                    record.status === 'late' ? 'Telat' :
                      record.status === 'sick' ? 'Sakit' :
                        record.status === 'permission' ? 'Izin' :
                          record.status === 'absent' ? 'Alpa' : record.status}
                </div>
              </div>
            ))}
            {(!filteredData || filteredData.length === 0) && (
              <div className="p-8 text-center text-muted-foreground text-sm">
                Belum ada data absensi untuk periode ini.
              </div>
            )}
          </div>
        </div>

      </main>
      <BottomNav />

      {/* Detail Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="rounded-3xl max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="text-center font-bold text-xl">Detail Absensi</DialogTitle>
            <DialogDescription className="text-center text-sm text-muted-foreground">
              Informasi lengkap kehadiran pada tanggal tersebut.
            </DialogDescription>
          </DialogHeader>

          {selectedRecord && (
            <div className="space-y-4 py-4">
              <div className="text-center pb-2 border-b">
                <p className="font-bold text-lg text-primary">
                  {format(new Date(selectedRecord.date), 'EEEE, dd MMM yyyy', { locale: id })}
                </p>
                <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold uppercase ${selectedRecord.status === 'present' ? 'bg-emerald-100 text-emerald-700' :
                  selectedRecord.status === 'late' ? 'bg-amber-100 text-amber-700' :
                    selectedRecord.status === 'absent' ? 'bg-red-100 text-red-700' :
                      'bg-blue-100 text-blue-700'
                  }`}>
                  {selectedRecord.status === 'present' ? 'Hadir' :
                    selectedRecord.status === 'late' ? 'Telat' :
                      selectedRecord.status === 'sick' ? 'Sakit' :
                        selectedRecord.status === 'permission' ? 'Izin' :
                          selectedRecord.status === 'absent' ? 'Alpa' : selectedRecord.status}
                </span>
                {(selectedRecord as any).sessionNumber && (
                  <span className="inline-block mt-1 ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600">Sesi {(selectedRecord as any).sessionNumber}</span>
                )}
                {selectedRecord.shift && (
                  <p className="text-xs text-muted-foreground mt-2">Shift: <span className="font-bold">{selectedRecord.shift}</span></p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" /> Masuk
                  </div>
                  <p className="font-mono font-bold text-lg">
                    {selectedRecord.checkIn ? format(new Date(selectedRecord.checkIn), 'HH:mm') : '--:--'}
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground text-right justify-end">
                    Pulang <LogOut className="w-3 h-3" />
                  </div>
                  <p className="font-mono font-bold text-lg text-right">
                    {selectedRecord.checkOut ? format(new Date(selectedRecord.checkOut), 'HH:mm') : '--:--'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Coffee className="w-3 h-3" /> Istirahat
                  </div>
                  <p className="font-mono font-medium text-sm">
                    {selectedRecord.breakStart ? format(new Date(selectedRecord.breakStart), 'HH:mm') : '--:--'}
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground text-right justify-end">
                    Selesai <Clock className="w-3 h-3" />
                  </div>
                  <p className="font-mono font-medium text-sm text-right">
                    {selectedRecord.breakEnd ? format(new Date(selectedRecord.breakEnd), 'HH:mm') : '--:--'}
                  </p>
                </div>
              </div>

              {(selectedRecord.notes || !selectedRecord.checkOut) && (
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 mt-4">
                  <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Catatan / Keterangan</p>
                  <p className={`text-sm italic ${!selectedRecord.checkOut && !selectedRecord.notes ? 'text-yellow-600 font-semibold' : 'text-gray-700'}`}>
                    {selectedRecord.notes || 'Belum Absen Pulang'}
                  </p>
                </div>
              )}

              <div className="pt-4">
                <Button className="w-full rounded-xl" onClick={() => setIsModalOpen(false)}>
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
