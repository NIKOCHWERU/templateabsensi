import { Link, useLocation } from "wouter";
import { LayoutDashboard, CalendarDays, Info, MessageSquare, UserCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";

export function BottomNav() {
  const [location] = useLocation();
  const { user } = useAuth();

  // Fetch announcements for Info badge
  const { data: announcements } = useQuery<any[]>({
    queryKey: ["/api/announcements"],
    refetchInterval: 5000, // Auto refresh every 5 seconds for real-time badge updates
  });

  // Fetch complaints for Pengaduan badge
  const { data: complaints } = useQuery<any[]>({
    queryKey: ["/api/complaints"],
    enabled: !!user,
    refetchInterval: 5000, // Auto refresh every 5 seconds
  });

  // Force re-render when localStorage changes if on the same page
  const [lastReadInfoTime, setLastReadInfoTime] = useState(() => {
    return typeof window !== 'undefined' ? parseInt(localStorage.getItem('lastReadInfoTime') || '0', 10) : 0;
  });

  const [lastReadComplaintTime, setLastReadComplaintTime] = useState(() => {
    return typeof window !== 'undefined' ? parseInt(localStorage.getItem('lastReadComplaintTime') || '0', 10) : 0;
  });

  useEffect(() => {
    if (location === '/employee/info') {
      let maxTime = Date.now();
      // Ensure we account for future-dated announcements due to client-server time discrepancy
      if (announcements && announcements.length > 0) {
        const latestCreatedAt = Math.max(...announcements.map(a => new Date(a.createdAt).getTime() || 0));
        if (latestCreatedAt > maxTime) {
          maxTime = latestCreatedAt;
        }
      }
      localStorage.setItem('lastReadInfoTime', maxTime.toString());
      setLastReadInfoTime(maxTime);
    }
  }, [location, announcements]);

  useEffect(() => {
    if (location === '/employee/complaint') {
      let maxTime = Date.now();
      if (complaints && complaints.length > 0) {
        const latestCreatedAt = Math.max(...complaints.map(c => new Date(c.createdAt).getTime() || 0));
        if (latestCreatedAt > maxTime) {
          maxTime = latestCreatedAt;
        }
      }
      localStorage.setItem('lastReadComplaintTime', maxTime.toString());
      setLastReadComplaintTime(maxTime);
    }
  }, [location, complaints]);

  // 1. Info badge: show total active announcements that are newer than lastReadInfoTime
  // Hide badge entirely if we are currently on the Info tab
  const infoBadgeCount = location === '/employee/info'
    ? 0
    : (announcements
      ? announcements.filter(a => new Date(a.createdAt).getTime() > lastReadInfoTime).length
      : 0);

  // 2. Complaint badge: show pending complaints for the current user that are newer than lastReadComplaintTime
  // Hide badge entirely if we are currently on the Complaint tab
  const complaintBadgeCount = location === '/employee/complaint'
    ? 0
    : (complaints
      ? complaints.filter(c => c.status === 'pending' && new Date(c.createdAt).getTime() > lastReadComplaintTime).length
      : 0);

  const { data: config } = useQuery<any>({
    queryKey: ["/api/config"],
  });

  const allTabs = [
    { key: "absensi", href: "/employee", label: "Absensi", icon: LayoutDashboard },
    { key: "recap", href: "/employee/recap", label: "Rekap", icon: CalendarDays },
    { key: "leave", href: "/employee/leave", label: "Cuti", icon: CalendarDays },
    { key: "info", href: "/employee/info", label: "Info", icon: Info, badge: infoBadgeCount },
    { key: "complaint", href: "/employee/complaint", label: "Pengaduan", icon: MessageSquare, badge: complaintBadgeCount },
    { key: "profile", href: "/employee/profile", label: "Profil", icon: UserCircle },
  ];

  const tabs = allTabs.filter(tab => {
    if (!config?.features) return true; // fallback
    if (tab.key === "leave" && config.features.leave === false) return false;
    if (tab.key === "recap" && config.features.recap === false) return false;
    if (tab.key === "complaint" && config.features.complaint === false) return false;
    if (tab.key === "info" && config.features.info === false) return false;
    return true;
  });

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-t border-slate-200/50 pb-safe shadow-[0_-8px_30px_rgb(0,0,0,0.04)]">
      <div className="flex items-center w-full h-16 max-w-lg mx-auto px-2">
        {tabs.map((tab) => {
          const isActive = location === tab.href;
          return (
            <Link key={tab.href} href={tab.href} className="flex-1 h-full flex items-center justify-center">
              <div className="relative flex flex-col items-center justify-center w-full h-full cursor-pointer group">
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute -top-[1px] w-8 h-0.5 bg-primary rounded-b-full"
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
                <div className="relative">
                  <tab.icon
                    className={`w-5 h-5 mb-0.5 transition-colors duration-200 ${isActive ? "text-primary stroke-[2.5]" : "text-muted-foreground group-hover:text-primary/70"
                      }`}
                  />
                  {tab.badge && tab.badge > 0 ? (
                    <div className="absolute -top-1 -right-2 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-sm border border-white">
                      {tab.badge > 99 ? '99+' : tab.badge}
                    </div>
                  ) : null}
                </div>
                <span className={`text-[8px] font-black uppercase tracking-tighter transition-colors duration-200 mt-1 ${isActive ? "text-primary" : "text-slate-400 group-hover:text-slate-600"
                  }`}>
                  {tab.label}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
