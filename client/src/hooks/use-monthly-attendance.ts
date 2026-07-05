import { useQuery } from "@tanstack/react-query";
import { Attendance } from "@shared/schema";

export function useMonthlyAttendance(params: { month?: string, startDate?: string, endDate?: string, userId?: number }) {
    const queryParams = new URLSearchParams();
    if (params.month) queryParams.append("month", params.month);
    if (params.startDate) queryParams.append("startDate", params.startDate);
    if (params.endDate) queryParams.append("endDate", params.endDate);
    if (params.userId) queryParams.append("userId", params.userId.toString());

    return useQuery<Attendance[]>({
        queryKey: [`/api/attendance?${queryParams.toString()}`],
        enabled: !!(params.month || (params.startDate && params.endDate)),
        refetchInterval: 5000,
    });
}
