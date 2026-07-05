import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, subMonths, addMonths, subWeeks, addWeeks } from "date-fns";
import { id } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CheckCircle2, Clock, XCircle, Coffee, Calendar as CalendarIcon, LayoutGrid } from "lucide-react";
import type { Attendance } from "@shared/schema";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface AttendanceCalendarProps {
  currentDate: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  attendanceData: Attendance[];
  onDateSelect?: (date: Date, record?: Attendance) => void;
  viewMode: 'month' | 'week';
  setViewMode: (mode: 'month' | 'week') => void;
  weekDate: Date;
}

export function AttendanceCalendar({
  currentDate,
  onPrevMonth,
  onNextMonth,
  attendanceData,
  onDateSelect,
  viewMode,
  setViewMode,
  weekDate
}: AttendanceCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Month Logic: 1st to last day of current month
  const currentPeriodStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const currentPeriodEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

  // Week Logic
  const weekStart = startOfWeek(viewMode === 'week' ? weekDate : currentDate, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(viewMode === 'week' ? weekDate : currentDate, { weekStartsOn: 1 });

  const days = viewMode === 'month'
    ? eachDayOfInterval({ start: currentPeriodStart, end: currentPeriodEnd })
    : eachDayOfInterval({ start: weekStart, end: weekEnd });

  const handlePrev = () => {
    onPrevMonth(); // Parent handles logic based on viewMode
  };

  const handleNext = () => {
    onNextMonth(); // Parent handles logic based on viewMode
  };

  // Helper to find status for a day
  const getDayStatus = (day: Date) => {
    return attendanceData.find(a => isSameDay(new Date(a.date), day));
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'present': return 'bg-emerald-100 text-emerald-600 border-emerald-200';
      case 'late': return 'bg-amber-100 text-amber-600 border-amber-200';
      case 'sick': return 'bg-blue-100 text-blue-600 border-blue-200';
      case 'permission': return 'bg-purple-100 text-purple-600 border-purple-200';
      case 'absent': return 'bg-red-100 text-red-600 border-red-200';
      default: return 'bg-gray-50 text-gray-400 border-transparent';
    }
  };

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'present': return 'Hadir';
      case 'late': return 'Telat';
      case 'sick': return 'Sakit';
      case 'permission': return 'Izin';
      case 'absent': return 'Alpa';
      case 'cuti': return 'Cuti';
      default: return status || '-';
    }
  };

  const handleDateClick = (day: Date, record?: Attendance) => {
    setSelectedDate(day);
    if (onDateSelect) {
      onDateSelect(day, record);
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-white border-b border-gray-50">
        {/* Navigation */}
        <div className="flex items-center gap-2 bg-gray-50 rounded-full p-1 border border-gray-100">
          <Button variant="ghost" size="icon" onClick={handlePrev} className="h-8 w-8 rounded-full hover:bg-gray-200">
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </Button>
          <div className="px-2 font-black text-gray-700 min-w-[120px] text-center text-xs uppercase tracking-wider">
            {viewMode === 'month'
              ? format(currentDate, "MMMM yyyy", { locale: id })
              : `${format(weekStart, "dd MMM", { locale: id })} - ${format(weekEnd, "dd MMM yyyy", { locale: id })}`
            }
          </div>
          <Button variant="ghost" size="icon" onClick={handleNext} className="h-8 w-8 rounded-full hover:bg-gray-200">
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </Button>
        </div>

        {/* View Toggle */}
        <div className="flex bg-orange-50/50 p-1 rounded-full border border-orange-100/50">
          <button
            onClick={() => setViewMode('month')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5
                    ${viewMode === 'month' ? 'bg-primary text-white shadow-sm' : 'text-orange-600 hover:text-orange-700'}`}
          >
            <LayoutGrid className="w-3.5 h-3.5" /> Bulanan
          </button>
          <button
            onClick={() => setViewMode('week')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5
                    ${viewMode === 'week' ? 'bg-primary text-white shadow-sm' : 'text-orange-600 hover:text-orange-700'}`}
          >
            <CalendarIcon className="w-3.5 h-3.5" /> Minggu
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className={`grid grid-cols-7 gap-px bg-border ${viewMode === 'week' ? 'bg-white gap-0 divide-x divide-gray-100' : ''}`}>
        {['Sn', 'Sl', 'Rb', 'Km', 'Jm', 'Sb', 'Mg'].map(d => (
          <div key={d} className="bg-gray-50 p-3 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">
            {d}
          </div>
        ))}

        {/* Padding for start of month - only in Month view */}
        {viewMode === 'month' && Array.from({ length: (currentPeriodStart.getDay() + 6) % 7 }).map((_, i) => (
          <div key={`pad-${i}`} className="bg-gray-50/30" />
        ))}

        {days.map((day) => {
          const record = getDayStatus(day);
          const hasRecord = !!record;
          const isToday = isSameDay(day, new Date());
          const isSelected = selectedDate && isSameDay(day, selectedDate);

          return (
            <div
              key={day.toISOString()}
              onClick={() => handleDateClick(day, record)}
              className={`
                  relative min-h-[80px] p-2 flex flex-col cursor-pointer transition-all group
                  ${viewMode === 'week' ? 'bg-white hover:bg-orange-50/30' : 'bg-white hover:bg-gray-50'}
                  ${isToday && viewMode === 'month' ? 'ring-1 ring-inset ring-orange-400 bg-orange-50/10' : ''}
                  ${isSelected ? 'bg-orange-50 ring-2 ring-inset ring-orange-500 z-10' : ''}
                `}
            >
              <div className="flex justify-between items-start">
                <span className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-orange-500 text-white shadow-md' : 'text-gray-500 group-hover:bg-gray-200'}`}>
                  {format(day, 'd')}
                </span>
              </div>

              {hasRecord ? (
                <div className={`mt-2 p-1.5 rounded-md border text-[10px] font-bold truncate flex flex-col items-center gap-1 ${getStatusColor(record.status ?? undefined)}`}>
                  <span className="uppercase">{getStatusLabel(record.status ?? undefined)}</span>
                  <span className="font-mono text-[9px] opacity-80">
                    {record.checkIn ? format(new Date(record.checkIn), 'HH:mm') : '--:--'}
                  </span>
                </div>
              ) : (
                <div className="mt-2 h-full flex items-center justify-center">
                  <span className="text-[10px] text-gray-300">-</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
