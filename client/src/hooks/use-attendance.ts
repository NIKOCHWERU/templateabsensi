import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Attendance } from "@shared/schema";

export function useAttendance() {
  const { data, isLoading: isLoadingToday } = useQuery<Attendance[]>({
    queryKey: ["/api/attendance/today"],
    refetchInterval: 5000,
  });
  const todaySessions = Array.isArray(data) ? data : (data ? [data] : []);

  // Derive active and completed sessions from array
  const activeSession = todaySessions.find(s => !s.checkOut) || null;
  const completedSessions = todaySessions.filter(s => !!s.checkOut);
  const sessionCount = todaySessions.length;

  const clockInMutation = useMutation({
    mutationFn: async (data: { location: string; checkInPhoto: string; shift?: string; lateReason?: string; lateReasonPhoto?: string }) => {
      await apiRequest("POST", "/api/attendance/clock-in", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
    },
  });

  const clockOutMutation = useMutation({
    mutationFn: async (data: { location: string; checkInPhoto: string }) => {
      await apiRequest("POST", "/api/attendance/clock-out", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
    },
  });

  const breakStartMutation = useMutation({
    mutationFn: async (data: { location: string; checkInPhoto: string }) => {
      await apiRequest("POST", "/api/attendance/break-start", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/today"] });
    },
  });

  const breakEndMutation = useMutation({
    mutationFn: async (data: { location: string; checkInPhoto: string }) => {
      await apiRequest("POST", "/api/attendance/break-end", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/today"] });
    },
  });

  const permitMutation = useMutation({
    mutationFn: async (data: { type: "sick" | "permission" | "off"; notes: string; checkInPhoto?: string | null; location?: string }) => {
      await apiRequest("POST", "/api/attendance/permit", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/attendance/resume", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
    },
  });



  return {
    todaySessions,
    activeSession,
    completedSessions,
    sessionCount,
    today: activeSession || completedSessions[completedSessions.length - 1] || null, // backward compat
    isLoadingToday,
    clockIn: clockInMutation.mutateAsync,
    clockOut: clockOutMutation.mutateAsync,
    breakStart: breakStartMutation.mutateAsync,
    breakEnd: breakEndMutation.mutateAsync,
    permit: permitMutation.mutateAsync,
    resume: resumeMutation.mutateAsync,
    isPending:
      clockInMutation.isPending ||
      clockOutMutation.isPending ||
      breakStartMutation.isPending ||
      breakEndMutation.isPending ||
      permitMutation.isPending ||
      resumeMutation.isPending,
  };
}
