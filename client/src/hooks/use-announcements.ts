import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Announcement } from "@shared/schema";

export function useAnnouncements() {
  const { data: announcements, isLoading } = useQuery<Announcement[]>({
    queryKey: ["/api/announcements"],
    refetchInterval: 5000,
  });

  const createMutation = useMutation({
    mutationFn: async (data: { title: string; content: string }) => {
      await apiRequest("POST", "/api/announcements", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
    },
  });

  return {
    announcements: announcements || [],
    isLoading,
    createAnnouncement: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
  };
}
