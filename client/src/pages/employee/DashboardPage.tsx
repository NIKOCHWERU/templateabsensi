import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useAttendance } from "@/hooks/use-attendance";
import { CompanyHeader } from "@/components/CompanyHeader";
import { DigitalClock } from "@/components/DigitalClock";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, User, Camera, MapPin, Coffee, LogOut, X, Check, RefreshCw, SwitchCamera, Zap, ChevronRight, Stethoscope, Umbrella, FileText, Timer, Bell, Info, AlertTriangle, Download } from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { motion } from "framer-motion";
import { useState, useRef, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { CameraModal } from "@/components/CameraModal";
import { LateReasonModal } from "@/components/LateReasonModal";
import { WorkTimer } from "@/components/WorkTimer";
import { toTitleCase } from "@/lib/utils";

// Helper: resolve photo URL — handles both local uploads and Google Drive File IDs
function getPhotoUrl(value: string | null | undefined): string {
    if (!value) return '';
    // Base64 data URI or full path
    if (value.startsWith('data:')) return value;
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

// Helper component for Shift Selection Modal
function ShiftModal({
    open,
    shifts,
    isLoading,
    userShift,
    onSelect,
    onClose
}: {
    open: boolean,
    shifts: any[],
    isLoading?: boolean,
    userShift?: string | null,
    onSelect: (shiftId: number, name: string) => void,
    onClose: () => void
}) {
    return (
        <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
            <DialogContent className="rounded-2xl max-w-xs md:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-center text-xl">Pilih Shift Kerja</DialogTitle>
                    <DialogDescription className="text-center">
                        Silakan pilih shift Anda hari ini untuk mulai absensi.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 gap-3 py-4">
                    {isLoading ? (
                        <div className="text-center py-8 text-slate-400">
                            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                            Memuat daftar shift...
                        </div>
                    ) : shifts.length === 0 ? (
                        <div className="text-center py-8 text-slate-400">
                            <p className="font-bold text-red-500 mb-2">Belum ada shift</p>
                            <p className="text-sm">Silakan hubungi Admin untuk mengatur jadwal shift.</p>
                        </div>
                    ) : (
                        <>
                            {userShift && (
                                <Button
                                    key="previous"
                                    variant="default"
                                    className="h-16 justify-between px-6 text-base bg-primary hover:bg-primary/90 text-white transition-all group mb-2 shadow-md shadow-primary/20"
                                    onClick={() => {
                                        // Attempt to find the previous shift in the list
                                        const prevShift = shifts.find(s => s.name?.toLowerCase() === userShift.toLowerCase());
                                        if (prevShift) {
                                            onSelect(prevShift.id, prevShift.name);
                                        } else {
                                            // Fallback if shift was deleted/modified by Admin
                                            onSelect(-99, userShift);
                                        }
                                    }}
                                >
                                    <div className="flex flex-col items-start text-left">
                                        <span className="font-bold">Ikuti Shift Sebelumnya</span>
                                        <span className="text-xs font-white/90 font-mono opacity-90">{userShift}</span>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
                                        <Check className="w-4 h-4 text-white" />
                                    </div>
                                </Button>
                            )}
                            {shifts.map(s => (
                                <Button
                                    key={s.id}
                                    variant="outline"
                                    className="h-16 justify-between px-6 text-base border-2 hover:border-primary hover:bg-primary/5 transition-all group"
                                    onClick={() => onSelect(s.id, s.name)}
                                >
                                    <div className="flex flex-col items-start text-left">
                                        <span className="font-bold text-slate-900">{s.name}</span>
                                        <span className="text-[10px] text-slate-500 font-mono leading-none mb-1">{s.checkInTime} - {s.checkOutTime}</span>
                                        {s.description && (
                                            <span className="text-[9px] text-orange-600 font-medium leading-tight">{s.description}</span>
                                        )}
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-primary/10 flex items-center justify-center">
                                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-primary" />
                                    </div>
                                </Button>
                            ))}
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default function EmployeeDashboard() {
    const { user } = useAuth();
    const { today, activeSession, todaySessions, sessionCount, completedSessions, isLoadingToday, clockIn, clockOut, breakStart, breakEnd, permit, resume, isPending } = useAttendance();
    const { toast } = useToast();
 
    const { data: employeeDocs } = useQuery<{
        mutations: any[];
        warningLetters: any[];
        resignations: any[];
    }>({
        queryKey: ["/api/employee/documents"],
    });

    const [currentNotification, setCurrentNotification] = useState<{
        id: number;
        type: "mutasi" | "promosi" | "demosi" | "warningLetter" | "resignation";
        title: string;
        date: string;
        notes: string;
        documentUrl: string | null;
        raw: any;
    } | null>(null);

    useEffect(() => {
        if (!employeeDocs) return;
        const cutoff = new Date("2026-06-10T04:00:00.000Z");

        // Load dismissed notifications from localStorage
        let dismissed: Record<string, number[]> = {
            mutations: [],
            warningLetters: [],
            resignations: []
        };
        try {
            const saved = localStorage.getItem("dismissed_employee_docs");
            if (saved) dismissed = JSON.parse(saved);
        } catch (_) {}

        // Find first undismissed mutation
        const newMutation = employeeDocs.mutations.find(m => {
            const isFuture = new Date(m.createdAt) > cutoff;
            const isDismissed = dismissed.mutations?.includes(m.id);
            return isFuture && !isDismissed;
        });
        if (newMutation) {
            setCurrentNotification({
                id: newMutation.id,
                type: newMutation.type,
                title: newMutation.type === 'promosi' ? 'Promosi Jabatan' : newMutation.type === 'demosi' ? 'Demosi Jabatan' : 'Mutasi Cabang',
                date: format(new Date(newMutation.createdAt), "d MMMM yyyy", { locale: id }),
                notes: newMutation.notes || "",
                documentUrl: newMutation.documentUrl,
                raw: newMutation
            });
            return;
        }

        // Find first undismissed warning letter (SP)
        const newSP = employeeDocs.warningLetters.find(sp => {
            const isFuture = new Date(sp.createdAt) > cutoff;
            const isDismissed = dismissed.warningLetters?.includes(sp.id);
            return isFuture && !isDismissed;
        });
        if (newSP) {
            setCurrentNotification({
                id: newSP.id,
                type: 'warningLetter',
                title: `Surat Peringatan (${newSP.type})`,
                date: format(new Date(newSP.createdAt), "d MMMM yyyy", { locale: id }),
                notes: newSP.notes || "",
                documentUrl: newSP.documentUrl,
                raw: newSP
            });
            return;
        }

        // Find first undismissed resignation (PHK/layoff)
        const newResign = employeeDocs.resignations.find(r => {
            const isFuture = new Date(r.createdAt) > cutoff;
            const isDismissed = dismissed.resignations?.includes(r.id);
            return isFuture && !isDismissed;
        });
        if (newResign) {
            setCurrentNotification({
                id: newResign.id,
                type: 'resignation',
                title: 'Pemberitahuan Pemutusan Hubungan Kerja (Resign/PHK)',
                date: format(new Date(newResign.createdAt), "d MMMM yyyy", { locale: id }),
                notes: newResign.reason || "",
                documentUrl: newResign.documentUrl,
                raw: newResign
            });
            return;
        }

        setCurrentNotification(null);
    }, [employeeDocs]);

    const handleDismissNotification = () => {
        if (!currentNotification) return;

        let dismissed: Record<string, number[]> = {
            mutations: [],
            warningLetters: [],
            resignations: []
        };
        try {
            const saved = localStorage.getItem("dismissed_employee_docs");
            if (saved) dismissed = JSON.parse(saved);
        } catch (_) {}

        const key = currentNotification.type === 'warningLetter' ? 'warningLetters' :
                    currentNotification.type === 'resignation' ? 'resignations' : 'mutations';

        if (!dismissed[key]) dismissed[key] = [];
        if (!dismissed[key].includes(currentNotification.id)) {
            dismissed[key].push(currentNotification.id);
        }

        localStorage.setItem("dismissed_employee_docs", JSON.stringify(dismissed));
        setCurrentNotification(null);
    };

    const [permitOpen, setPermitOpen] = useState(false);
    const [permitNote, setPermitNote] = useState("");
    const [permitType, setPermitType] = useState<"sick" | "permission" | "off">("permission");
    const [isCameraOpen, setIsCameraOpen] = useState(false);

    // Shift Selection State
    const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
    const [isOffDayOpen, setIsOffDayOpen] = useState(false);
    const [selectedShiftId, setSelectedShiftId] = useState<number | null>(null);

    // Generic Confirm Dialog (replaces native window.confirm to avoid PWA blank screen)
    const [confirmDialog, setConfirmDialog] = useState<{
        open: boolean;
        title: string;
        description: string;
        confirmLabel: string;
        confirmClass?: string;
        onConfirm: () => void;
    } | null>(null);

    const { data: backendShiftList, isLoading: isShiftsLoading } = useQuery<any[]>({
        queryKey: ["/api/shifts"],
    });

    const defaultShifts = [
        { id: -1, name: "Shift 1", checkInTime: "07:00", checkOutTime: "17:00" },
        { id: -2, name: "Shift 2 (Middle)", checkInTime: "11:00", checkOutTime: "21:00" },
        { id: -3, name: "Shift 3", checkInTime: "13:00", checkOutTime: "23:00" },
        { id: -4, name: "Long Shift", checkInTime: "07:00", checkOutTime: "23:00" },
        { id: -5, name: "Kasir Long Shift", checkInTime: "11:00", checkOutTime: "23:00" }
    ];

    const shiftList = backendShiftList && backendShiftList.length > 0 ? backendShiftList : defaultShifts;

    // Push Notifications State
    const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unavailable'>(
        typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unavailable'
    );
    const [isSubscribing, setIsSubscribing] = useState(false);

    const subscribeToPush = async () => {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            toast({ title: "Tidak Didukung", description: "Browser Anda tidak mendukung Web Push.", variant: "destructive" });
            return;
        }

        try {
            setIsSubscribing(true);
            const permission = await Notification.requestPermission();
            setPushPermission(permission);

            if (permission === 'granted') {
                const reg = await navigator.serviceWorker.register('/sw.js');

                // Fetch public key
                const keyRes = await fetch('/api/push/public-key');
                if (!keyRes.ok) throw new Error("Gagal mengambil kunci Notifikasi dari server");
                const { publicKey } = await keyRes.json();

                // Convert VAPID key
                const urlBase64ToUint8Array = (base64String: string) => {
                    const padding = '='.repeat((4 - base64String.length % 4) % 4);
                    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
                    const rawData = window.atob(base64);
                    const outputArray = new Uint8Array(rawData.length);
                    for (let i = 0; i < rawData.length; ++i) {
                        outputArray[i] = rawData.charCodeAt(i);
                    }
                    return outputArray;
                };

                const subscription = await reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(publicKey)
                });

                const saveRes = await fetch('/api/push/subscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(subscription)
                });

                if (saveRes.ok) {
                    toast({ title: "Notifikasi Aktif!", description: "Anda akan menerima pengumuman dari Admin." });
                }
            } else {
                toast({ title: "Izin Ditolak", description: "Anda telah menolak izin notifikasi.", variant: "destructive" });
            }
        } catch (err: any) {
            console.error("Push Error", err);
            toast({ title: "Gagal Mengaktifkan Notifikasi", description: err.message, variant: "destructive" });
        } finally {
            setIsSubscribing(false);
        }
    };

    const [activeAction, setActiveAction] = useState<{
        fn: (data: any) => Promise<any>,
        successTitle: string,
        type: 'attendance' | 'permit'
    } | null>(null);

    const [isLateReasonModalOpen, setIsLateReasonModalOpen] = useState(false);
    const [lateReasonData, setLateReasonData] = useState<{ reason: string, photo?: string } | null>(null);

    const [locationAddress, setLocationAddress] = useState<string>("");
    const [processingLocation, setProcessingLocation] = useState(false);
    const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

    // ... (Keep existing getCoordinates logic)
    const lastLocationFetch = useRef<number>(0);
    const lastFetchResult = useRef<{ lat: number, lng: number, address: string, isFakeGps: boolean } | null>(null);

    const getCoordinates = async (force = false): Promise<{ lat: number, lng: number, address: string, isFakeGps: boolean }> => {
        const now = Date.now();
        // If we have a location fetched in the last 5 mins, reuse it unless forced
        if (!force && lastFetchResult.current && (now - lastLocationFetch.current < 300000)) {
            return lastFetchResult.current;
        }

        if (!navigator.geolocation) {
            throw new Error("Geolocation is not supported by your browser");
        }

        setProcessingLocation(true);
        try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                });
            });

            const { latitude, longitude } = position.coords;
            let address = `${latitude},${longitude}`;

            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                const data = await res.json();
                if (data && data.display_name) {
                    address = data.display_name;
                }
            } catch (e) {
                console.error("Reverse geocoding failed", e);
            }

            // Detection for Mock GPS (Best effort for Web)
            // 1. Check for 'mocked' property (Android/Chrome non-standard)
            // 2. Check for exactly 0 or 1 accuracy (standard in many mock apps)
            const isFakeGps = (position as any).mocked === true || position.coords.accuracy === 0 || position.coords.accuracy === 1;

            const result = { lat: latitude, lng: longitude, address, isFakeGps };
            setLocationAddress(address);
            lastLocationFetch.current = Date.now();
            lastFetchResult.current = result;
            return result;
        } catch (err: any) {
            if (err.code === 1) { // PERMISSION_DENIED
                const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
                if (isIOS) {
                    throw new Error("Akses lokasi ditolak. Buka Pengaturan iPhone -> Privasi -> Layanan Lokasi (Aktifkan), lalu pastikan Browser memiliki izin.");
                } else {
                    throw new Error("Akses lokasi ditolak. Silakan aktifkan izin lokasi di pengaturan browser atau HP Anda.");
                }
            } else if (err.code === 3) { // TIMEOUT
                throw new Error("Gagal mengambil lokasi (Timeout). Pastikan Anda berada di area terbuka dan koneksi internet stabil.");
            }
            throw err;
        } finally {
            setProcessingLocation(false);
        }
    };

    const handleError = (err: any) => {
        console.error(err);
        toast({
            title: "Gagal",
            description: err.message || "Terjadi kesalahan",
            variant: "destructive"
        });
    };

    const startAttendanceFlow = async (actionFn: (data: any) => Promise<any>, successTitle: string, isClockIn = false) => {
        if (isClockIn && sessionCount === 0) {
            setActiveAction({ fn: actionFn, successTitle, type: 'attendance' });
            setIsShiftModalOpen(true);
            return;
        }

        let finalActionFn = actionFn;
        if (isClockIn && sessionCount > 0) {
            const initialShift = todaySessions && todaySessions.length > 0 ? (todaySessions[0] as any).shift : '-';
            finalActionFn = async (data: any) => actionFn({ ...data, shift: initialShift });
        }

        setActiveAction({ fn: finalActionFn, successTitle, type: 'attendance' });
        setIsCameraOpen(true);
    };

    const handleShiftSelect = (shiftId: number, shiftName: string) => {
        setSelectedShiftId(shiftId);
        setIsShiftModalOpen(false);

        const shiftData = shiftId === -99 ? { id: -99, name: shiftName, checkInTime: '00:00', checkOutTime: '00:00' } : shiftList?.find(s => s.id === shiftId);
        if (!shiftData) return;

        const now = new Date();
        const hour = now.getHours();
        const minute = now.getMinutes();
        const timeInMinutes = hour * 60 + minute;

        const [sHour, sMinute] = (shiftData?.checkInTime || "07:00").split(':').map(Number);
        let thresholdMinutes = sHour * 60 + sMinute;

        if (shiftId < 0 || !shiftData) {
            const sn = shiftName?.toLowerCase() || '';
            if (sn.includes('middle') || sn === 'shift 2') thresholdMinutes = 11 * 60; // 11:00
            else if (sn.includes('kasir long')) thresholdMinutes = 11 * 60; // 11:00
            else if (sn === 'shift 3') thresholdMinutes = 13 * 60; // 13:00
            else if (sn === 'shift 1' || sn.includes('long')) thresholdMinutes = 7 * 60; // 07:00
        }

        const isLate = timeInMinutes > thresholdMinutes;

        const wrappedClockIn = async (data: any) => {
            return clockIn({ ...data, shiftId, shift: shiftName });
        };

        if (activeAction) {
            setActiveAction({ ...activeAction, fn: wrappedClockIn });
        }

        if (isLate) {
            setIsLateReasonModalOpen(true);
        } else {
            setIsCameraOpen(true);
        }
    };

    const handleLateReasonSubmit = (reason: string, photo?: string) => {
        setLateReasonData({ reason, photo });
        setIsLateReasonModalOpen(false);
        setIsCameraOpen(true);
    };

    const startPermitFlow = () => {
        setPermitOpen(true);
    };

    const handlePermitCameraTrigger = () => {
        setPermitOpen(false);
        setActiveAction({
            fn: async (data: any) => {
                return permit({
                    type: permitType,
                    notes: permitNote,
                    checkInPhoto: data?.checkInPhoto, // Make optional for off day
                    location: data?.location
                });
            },
            successTitle: permitType === "off" ? "Off Day Tercatat" : "Izin Diajukan",
            type: 'permit'
        });

        if (permitType === "off") {
            // Bypass camera
            const offAction = async () => {
                const { address } = await getCoordinates(false);
                await permit({
                    type: 'off',
                    notes: permitNote || "Libur Bekerja",
                    checkInPhoto: null,
                    location: address
                });
            };

            toast({ title: "Memproses...", description: "Mencatat absensi libur anda." });
            offAction().then(() => {
                toast({ title: "Off Day Tercatat", description: "Selamat beristirahat!", className: "bg-primary/50 text-white" });
                setActiveAction(null);
            }).catch(err => {
                handleError(err);
                setActiveAction(null);
            });
        } else {
            setIsCameraOpen(true);
        }
    }

    const handlePhotoCaptured = async (photoData: string) => {
        if (!activeAction) return;

        try {
            const { address, isFakeGps } = await getCoordinates(false);
            const payload: any = {
                location: address,
                checkInPhoto: photoData,
                isFakeGps: isFakeGps
            };

            if (lateReasonData) {
                payload.lateReason = lateReasonData.reason;
                payload.lateReasonPhoto = lateReasonData.photo;
            }

            await activeAction.fn(payload);

            toast({
                title: activeAction.successTitle,
                description: `Lokasi: ${address}`,
                className: "bg-primary/50 text-white"
            });

            // Only close on success
            setIsCameraOpen(false);
            setActiveAction(null);
            // Clear shift selection after success
            setSelectedShiftId(null);
            setLateReasonData(null);

        } catch (err: any) {
            handleError(err);
            // Re-throw so the modal knows it failed
            throw err;
        }
    };

    // Clock Out Logic for Early Leave Check
    const handleClockOutClick = () => {
        // Logic: if current time < shift end time, warn user
        // We need to know shift end time. 
        // User prompt says: "jika tenaga kerja pulang sebelum jam nya beri peringatan... dan beri pilihan IZIN"
        // Since we don't track shift info in 'today' object fully (we just added it to schema), we might need to rely on assumptions or fetch it.
        // Let's assume standard 8 hours from clockIn or fixed times based on shift name if we can get it.
        // BUT 'today' object in 'useAttendance' might not have 'shift' field yet on frontend type.
        // We should check shared/schema.ts updates are reflected in frontend types (Drizzle types are inferred usually).

        // Let's assume we can access today.shift or infer it.
        // If we can't get it easily, we will just prompt "Apakah anda yakin pulang sekarang?" -> "Izin Pulang Cepat" or "Pulang Biasa".
        // But prompt asks specific warning. 

        // Since I just added 'shift' to schema, 'today' SHOULD have it if I refetched.
        // Let's check time.

        const now = new Date();
        const hour = now.getHours();
        const minute = now.getMinutes();
        const timeInMinutes = hour * 60 + minute;

        let isEarly = false;
        const currentShiftId = (today as any)?.shiftId;
        const currentShift = shiftList?.find((s: any) => s.id === currentShiftId) || (today as any);

        if (currentShift?.checkOutTime && currentShift?.name !== 'Shift 2 (Pramuniaga)') {
            const [eHour, eMinute] = currentShift.checkOutTime.split(':').map(Number);
            const endMinutes = eHour * 60 + eMinute;
            if (timeInMinutes < endMinutes) isEarly = true;
        } else if (currentShift?.name === 'Shift 2 (Pramuniaga)' || (today as any)?.shift === 'Shift 2 (Pramuniaga)') {
            // Flexible Shift 2 (Pramuniaga): 9 hours total from checkIn
            if (today?.checkIn) {
                const checkInDate = new Date(today.checkIn);
                const diffMs = now.getTime() - checkInDate.getTime();
                const diffHours = diffMs / (1000 * 60 * 60);
                if (diffHours < 9) isEarly = true;
            }
        } else {
            const sName = currentShift?.shift || currentShift?.name || '';
            if (sName === 'Shift 1' && hour < 17) isEarly = true;
            else if (sName === 'Shift 2 (Kasir)' && hour < 23) isEarly = true;
            else if (sName === 'Shift 3' && hour < 23) isEarly = true;
            else if (sName?.toLowerCase() === 'longshift' && hour < 23) isEarly = true;
        }

        if (isEarly) {
            setConfirmDialog({
                open: true,
                title: "Belum Waktunya Pulang",
                description: "Anda mau pulang lebih awal dari jadwal shift. Apakah Anda ingin mengajukan Izin Pulang Cepat?",
                confirmLabel: "Ajukan Izin",
                confirmClass: "bg-orange-600 hover:bg-orange-700 text-white",
                onConfirm: () => {
                    setPermitType('permission');
                    setPermitNote("Pulang Cepat (Early Leave)");
                    setPermitOpen(true);
                }
            });
            return;
        }

        startAttendanceFlow(clockOut, "Hati-hati di jalan");
    };

    const isLoading = isPending || processingLocation;

    const hasCheckedIn = !!today?.checkIn;
    const hasCheckedOut = !!today?.checkOut;
    const isBreak = !!today?.breakStart && !today?.breakEnd;
    const hasBreakEnded = !!today?.breakEnd;

    const getStatusText = () => {
        if (!today) return "Belum Absen";
        if (today.status === 'sick') return "Sakit";
        if (today.status === 'permission') return "Izin";
        if (today.status === 'off') return "Libur";
        if (today.status === 'late') return "Telat";
        if (today.status === 'present') return "Hadir";
        if (today.checkOut) return "Absensi Selesai";
        if (isBreak) return "Sedang Istirahat";
        if (hasBreakEnded) return "Waktunya Pulang";
        return "Sedang Bekerja";
    };

    const handleResumeWork = () => {
        setConfirmDialog({
            open: true,
            title: "Lanjut Bekerja?",
            description: "Sistem akan membuka sesi absen masuk baru untuk hari ini.",
            confirmLabel: "Ya, Lanjut Kerja",
            confirmClass: "bg-blue-600 hover:bg-blue-700 text-white",
            onConfirm: async () => {
                try {
                    await resume();
                    toast({ title: "Selamat Bekerja Kembali", description: "Sesi Anda telah diaktifkan kembali." });
                } catch (err: any) {
                    handleError(err);
                }
            }
        });
    };

    const renderMainButton = () => {
        // --- PERMIT / SICK STATE ---
        // After permit or sick is submitted, today always has checkOut set (server always closes session).
        // Show an informational card + "Lanjut Bekerja" option.
        if (today?.status === 'sick' || today?.status === 'permission' || today?.status === 'off') {
            const permitLabel = today.status === 'sick' ? 'Sakit' : today.status === 'off' ? 'Libur' : 'Izin';
            const permitColor = today.status === 'sick' ? 'blue' : today.status === 'off' ? 'gray' : 'purple';
            const emoji = today.status === 'sick' ? '🤒' : today.status === 'off' ? '😴' : '📋';
            return (
                <div className="flex flex-col gap-3 w-full">
                    {/* Info card */}
                    <div className={`rounded-2xl p-4 bg-${permitColor}-50 border border-${permitColor}-200 flex items-start gap-3`}>
                        <span className={`text-${permitColor}-500 mt-0.5`}>
                            {today.status === 'sick' ? <Stethoscope className="w-6 h-6" /> : today.status === 'off' ? <Umbrella className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                        </span>
                        <div>
                            <p className={`text-xs font-bold text-${permitColor}-700 uppercase tracking-wide`}>
                                Status: {permitLabel}
                            </p>
                            <p className={`text-sm text-${permitColor}-600 font-medium mt-0.5`}>
                                {today.notes || `Absensi ${permitLabel} hari ini sudah tercatat.`}
                            </p>
                            <p className={`text-xs text-${permitColor}-400 mt-1`}>
                                Jika sudah siap, Anda dapat melanjutkan bekerja di bawah ini.
                            </p>
                        </div>
                    </div>
                    {/* Lanjut Bekerja button — uses clockIn flow (photo + shift) */}
                    <Button
                        onClick={() => startAttendanceFlow(clockIn, "Berhasil Absen Masuk", true)}
                        disabled={isLoading || sessionCount >= 5}
                        className="w-full h-14 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold shadow-blue-200 shadow-lg text-lg"
                    >
                        {isLoading ? <Loader2 className="animate-spin mr-2" /> : (
                            <>
                                <Zap className="mr-2 h-5 w-5" />
                                Lanjut Bekerja {sessionCount > 0 ? `(Sesi ${sessionCount + 1}/5)` : ''}
                            </>
                        )}
                    </Button>
                    {sessionCount >= 5 && (
                        <p className="text-center text-xs text-red-500 font-medium">Batas 5 sesi per hari tercapai</p>
                    )}
                </div>
            );
        }

        // --- SESSION COMPLETE (normal clock-out) ---
        if (today?.checkOut) {
            return (
                <div className="flex flex-col gap-3 w-full">
                    <Button
                        disabled
                        className="w-full py-8 text-xl font-bold rounded-2xl shadow-lg bg-gray-200 text-gray-400"
                    >
                        Sesi Hari Ini Selesai
                    </Button>
                    <Button
                        onClick={() => startAttendanceFlow(clockIn, "Berhasil Absen Masuk", true)}
                        disabled={sessionCount >= 5}
                        className="w-full h-14 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold shadow-blue-200 shadow-lg text-lg"
                    >
                        {isLoading ? <Loader2 className="animate-spin mr-2" /> : (
                            <>
                                <Zap className="mr-2 h-5 w-5" />
                                Lanjut Kerja (Sesi {sessionCount + 1}/5)
                            </>
                        )}
                    </Button>
                    {sessionCount >= 5 && (
                        <p className="text-center text-xs text-red-500 font-medium">Batas 5 sesi per hari tercapai</p>
                    )}
                </div>
            );
        }

        // --- NOT YET CLOCKED IN ---
        if (!hasCheckedIn) {
            return (
                <Button
                    onClick={() => startAttendanceFlow(clockIn, "Berhasil Absen Masuk", true)}
                    disabled={isLoading}
                    className="w-full h-14 rounded-xl bg-gradient-to-r from-primary to-orange-600 hover:from-primary/90 hover:to-orange-700 text-white font-bold shadow-primary/20 shadow-lg text-lg"
                >
                    {isLoading ? <Loader2 className="animate-spin mr-2" /> : (
                        <>
                            <Camera className="mr-2 h-5 w-5" />
                            Absen Masuk
                        </>
                    )}
                </Button>
            );
        }

        // --- IN PROGRESS: waiting for break start ---
        if (!isBreak && !hasBreakEnded) {
            return (
                <Button
                    onClick={() => startAttendanceFlow(breakStart, "Selamat Istirahat")}
                    disabled={isLoading}
                    className="w-full h-14 rounded-xl bg-gradient-to-r from-orange-400 to-amber-500 hover:from-orange-500 hover:to-amber-600 text-white font-semibold shadow-orange-200 shadow-lg text-lg"
                >
                    {isLoading ? <Loader2 className="animate-spin mr-2" /> : (
                        <>
                            <Coffee className="mr-2 h-5 w-5" />
                            Mulai Istirahat
                        </>
                    )}
                </Button>
            );
        }

        // --- IN BREAK: waiting for break end ---
        if (isBreak && !hasBreakEnded) {
            return (
                <Button
                    onClick={() => startAttendanceFlow(breakEnd, "Selamat Bekerja Kembali")}
                    disabled={isLoading}
                    className="w-full h-14 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold shadow-orange-200 shadow-lg text-lg"
                >
                    {isLoading ? <Loader2 className="animate-spin mr-2" /> : (
                        <>
                            <Camera className="mr-2 h-5 w-5" />
                            Selesai Istirahat
                        </>
                    )}
                </Button>
            );
        }

        // --- READY TO CLOCK OUT ---
        if (hasCheckedIn && hasBreakEnded && !hasCheckedOut) {
            return (
                <Button
                    onClick={handleClockOutClick}
                    disabled={isLoading}
                    className="w-full h-14 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-bold shadow-red-200 shadow-lg text-lg"
                >
                    {isLoading ? <Loader2 className="animate-spin mr-2" /> : (
                        <>
                            <LogOut className="mr-2 h-5 w-5" />
                            Absen Pulang
                        </>
                    )}
                </Button>
            );
        }
    };

    // Fetch location when camera opens or on mount per user request
    useEffect(() => {
        getCoordinates().catch(console.error);
    }, []);

    useEffect(() => {
        if (isCameraOpen) {
            getCoordinates().catch(console.error);
        }
    }, [isCameraOpen]);

    return (
        <div className="min-h-screen bg-gray-50 pb-24">
            {/* Late Reason Modal */}
            <LateReasonModal
                isOpen={isLateReasonModalOpen}
                onClose={() => setIsLateReasonModalOpen(false)}
                onSubmit={handleLateReasonSubmit}
            />

            {/* Camera Modal */}
            <CameraModal
                open={isCameraOpen}
                onCapture={handlePhotoCaptured}
                onClose={() => setIsCameraOpen(false)}
                locationAddress={locationAddress}
            />

            {/* Shift Modal added back */}
            <ShiftModal
                open={isShiftModalOpen}
                shifts={shiftList || []}
                isLoading={isShiftsLoading}
                userShift={user?.shift}
                onSelect={handleShiftSelect}
                onClose={() => setIsShiftModalOpen(false)}
            />

            <CompanyHeader />

            <main className="px-4 -mt-8 max-w-lg mx-auto space-y-6">

                {/* Push Notification Banner */}
                {pushPermission !== 'granted' && pushPermission !== 'unavailable' && (
                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex flex-col gap-3 shadow-md z-20 relative"
                    >
                        <div>
                            <h3 className="text-blue-800 font-bold text-sm">Aktifkan Notifikasi Pengumuman</h3>
                            <p className="text-blue-600 text-xs mt-0.5">Agar Anda tidak ketinggalan info penting dari Admin meskipun aplikasi ditutup.</p>
                        </div>
                        <Button
                            onClick={subscribeToPush}
                            disabled={isSubscribing}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-10 text-sm font-semibold"
                        >
                            {isSubscribing ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : null}
                            {isSubscribing ? 'Mengaktifkan...' : 'Izinkan Notifikasi'}
                        </Button>
                    </motion.div>
                )}

                {/* User Card */}
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="bg-white rounded-3xl p-5 shadow-xl shadow-black/5 border border-orange-100 flex items-center justify-between relative overflow-hidden"
                >
                    <div className="space-y-1.5 z-10">
                        <h2 className="text-lg font-bold text-gray-800">{toTitleCase(user?.fullName)}</h2>
                        <div className="text-xs text-gray-500 space-y-0.5">
                            <p>NIK: <span className="font-semibold text-gray-700">{user?.username}</span></p>
                            <p>Cabang: <span className="font-semibold text-gray-700">{toTitleCase(user?.branch) || '-'}</span></p>
                            <p>Jabatan: <span className="font-semibold text-gray-700">{toTitleCase(user?.position) || '-'}</span></p>
                            <p>Shift: <span className="font-bold text-orange-600">
                                {(() => {
                                    const baseShift = (todaySessions && todaySessions.length > 0) ? (todaySessions[0] as any).shift : (shiftList?.find(s => s.id === selectedShiftId)?.name);
                                    if (!baseShift) return 'Belum Absen Masuk';
                                    const formattedShift = toTitleCase(baseShift);
                                    return sessionCount > 1 ? `${formattedShift} ( Sesi ${sessionCount} )` : formattedShift;
                                })()}
                            </span></p>
                        </div>
                    </div>
                    <div className="z-10">
                        <div className="w-20 h-20 rounded-xl bg-gray-100 border-2 border-white shadow-md overflow-hidden">
                            {user?.photoUrl ? (
                                <img src={user.photoUrl} alt="User" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-orange-50 text-orange-500 font-bold text-2xl">
                                    {user?.fullName?.charAt(0)}
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>

                {/* Timer */}
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="flex flex-col items-center justify-center bg-primary/5 py-4 rounded-3xl"
                >
                    <DigitalClock />

                    <div className="mt-4 flex flex-col items-center">
                        <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Status Hari Ini</p>
                        <div className="flex items-center gap-2">
                            <span className={`text-2xl font-bold ${getStatusText() === 'Telat' ? 'text-red-600' : 'text-primary'}`}>
                                {getStatusText()}
                            </span>
                            {today?.status === 'late' && <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full animate-pulse">TELAT</span>}
                            {sessionCount > 0 && <span className="bg-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded-full font-semibold">Sesi {sessionCount}/5</span>}
                        </div>
                        {locationAddress && (
                            <p className="text-[10px] text-gray-400 mt-2 flex items-center justify-center gap-1 max-w-[200px] text-center">
                                <MapPin className="w-3 h-3 flex-shrink-0" /> {locationAddress}
                            </p>
                        )}
                    </div>

                    {/* Work Timer / Break Timer - Show if checked in and not checked out */}
                    {hasCheckedIn && !hasCheckedOut && (
                        <div className="mt-4 flex flex-col items-center">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                {isBreak ? <Timer className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
                                {isBreak ? "Durasi Istirahat" : "Durasi Kerja"}
                            </p>
                            <WorkTimer
                                startTime={new Date(isBreak ? today!.breakStart! : today!.checkIn!)}
                            />
                        </div>
                    )}
                </motion.div>

                {/* Controls */}
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="space-y-4"
                >
                    <div className="flex flex-col gap-3 w-full max-w-sm mx-auto">
                        {renderMainButton()}

                        <div className="grid grid-cols-3 gap-2 mt-2">
                            <Button
                                variant="outline"
                                disabled={!!today?.checkOut || today?.status === 'sick' || today?.status === 'permission' || today?.status === 'off'}
                                onClick={() => {
                                    setPermitType('sick');
                                    setPermitNote("");
                                    setPermitOpen(true);
                                }}
                                className="h-14 rounded-xl border-blue-100 hover:bg-blue-50 text-blue-700 bg-white"
                            >
                                <div className="flex flex-col items-center gap-0.5">
                                    <span className="font-bold text-sm">Sakit</span>
                                </div>
                            </Button>
                            <Button
                                variant="outline"
                                disabled={!!today?.checkOut || today?.status === 'sick' || today?.status === 'permission' || today?.status === 'off'}
                                onClick={() => {
                                    setPermitType('permission');
                                    setPermitNote("");
                                    setPermitOpen(true);
                                }}
                                className="h-14 rounded-xl border-purple-100 hover:bg-purple-50 text-purple-700 bg-white"
                            >
                                <div className="flex flex-col items-center gap-0.5">
                                    <span className="font-bold text-sm">Izin</span>
                                </div>
                            </Button>
                            <Button
                                variant="outline"
                                disabled={!!today?.checkOut || today?.status === 'sick' || today?.status === 'permission' || today?.status === 'off' || hasCheckedIn}
                                onClick={() => setIsOffDayOpen(true)}
                                className="h-14 rounded-xl border-gray-200 hover:bg-gray-100 text-gray-700 bg-white"
                            >
                                <div className="flex flex-col items-center gap-0.5">
                                    <span className="font-bold text-sm">Libur</span>
                                </div>
                            </Button>
                        </div>
                    </div>
                </motion.div>

                {/* Today Summary */}
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4"
                >
                    <h4 className="font-bold text-gray-800 border-b pb-2">Riwayat Hari Ini</h4>

                    {/* ⚠️ Warning: Sedang istirahat belum selesai */}
                    {isBreak && !hasBreakEnded && (
                        <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-xl p-3">
                            <Timer className="text-orange-500 w-5 h-5 mt-0.5" />
                            <div>
                                <p className="text-xs font-bold text-orange-700 uppercase tracking-wide">Sedang Istirahat</p>
                                <p className="text-sm text-orange-600 font-medium mt-0.5">Jangan lupa tekan <strong>Selesai Istirahat</strong> saat kembali bekerja!</p>
                            </div>
                        </div>
                    )}

                    {/* ⚠️ Warning: Sudah check-in & selesai istirahat, belum absen pulang */}
                    {hasCheckedIn && hasBreakEnded && !hasCheckedOut && (
                        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-3">
                            <Bell className="text-red-500 w-5 h-5 mt-0.5" />
                            <div>
                                <p className="text-xs font-bold text-red-700 uppercase tracking-wide">Jangan Lupa Absen Pulang!</p>
                                <p className="text-sm text-red-600 font-medium mt-0.5">Tekan <strong>Absen Pulang</strong> sebelum meninggalkan tempat kerja agar jam kerja tercatat.</p>
                            </div>
                        </div>
                    )}

                    {/* ⚠️ Warning: Sudah check-in, belum mulai istirahat, belum pulang */}
                    {hasCheckedIn && !isBreak && !hasBreakEnded && !hasCheckedOut && (
                        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-3">
                            <Info className="text-blue-500 w-5 h-5 mt-0.5" />
                            <div>
                                <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Sedang Bekerja</p>
                                <p className="text-sm text-blue-600 font-medium mt-0.5">Jika ingin istirahat tekan <strong>Mulai Istirahat</strong>. Jangan lupa <strong>Absen Pulang</strong> saat selesai bekerja.</p>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-y-4">
                        <div>
                            <p className="text-gray-400 text-xs font-medium">Masuk</p>
                            <p className="font-mono font-bold text-gray-800">
                                {today?.checkIn ? format(new Date(today.checkIn), "HH:mm") : "--:--"}
                            </p>
                        </div>
                        <div>
                            <p className="text-gray-400 text-xs font-medium">Pulang</p>
                            <p className="font-mono font-bold text-gray-800">
                                {today?.checkOut ? format(new Date(today.checkOut), "HH:mm") : "--:--"}
                            </p>
                        </div>
                        <div>
                            <p className="text-gray-400 text-xs font-medium">Mulai Istirahat</p>
                            <p className="font-mono font-bold text-gray-800">
                                {today?.breakStart ? format(new Date(today.breakStart), "HH:mm") : "--:--"}
                            </p>
                        </div>
                        <div>
                            <p className="text-gray-400 text-xs font-medium">Total Istirahat</p>
                            <p className="font-mono font-bold text-gray-800 italic text-[10px]">
                                {today?.breakStart && today?.breakEnd ? "Selesai" : "--:--"}
                            </p>
                        </div>
                    </div>

                    {today?.notes && (
                        <div className="mt-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
                            <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Keterangan:</p>
                            <p className="text-xs text-gray-600 line-clamp-3">{today.notes}</p>
                        </div>
                    )}

                    {(today as any)?.lateReason && (
                        <div className="mt-2 p-3 bg-red-50 rounded-xl border border-red-100/50">
                            <p className="text-[10px] text-red-500 font-bold uppercase mb-1">Alasan Terlambat:</p>
                            <p className="text-xs text-red-800 font-medium italic">"{(today as any).lateReason}"</p>
                            {(today as any).lateReasonPhoto && (
                                <div
                                    className="mt-2 aspect-video rounded-xl overflow-hidden border border-red-200 cursor-pointer relative group"
                                    onClick={() => setSelectedPhoto(getPhotoUrl((today as any).lateReasonPhoto))}
                                >
                                    <img
                                        src={getPhotoUrl((today as any).lateReasonPhoto)}
                                        alt="Bukti Telat"
                                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                    />
                                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Camera className="text-white h-6 w-6" />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Completed Sessions Summary */}
                    {completedSessions.length > 0 && (
                        <div className="mt-3 border-t pt-3 space-y-2">
                            <p className="text-[10px] text-gray-400 font-bold uppercase">Sesi Selesai</p>
                            {completedSessions.map((s: any, i: number) => (
                                <div key={s.id} className="flex justify-between items-center text-xs bg-gray-50 rounded-lg px-3 py-2">
                                    <span className="font-semibold text-gray-600">Sesi {s.sessionNumber}</span>
                                    <span className="font-mono text-gray-500">
                                        {s.checkIn ? format(new Date(s.checkIn), "HH:mm") : "--:--"}
                                        {" → "}
                                        {s.checkOut ? format(new Date(s.checkOut), "HH:mm") : "--:--"}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </motion.div>
            </main>

            {/* Photo Viewer Dialog */}
            <Dialog open={!!selectedPhoto} onOpenChange={(val) => !val && setSelectedPhoto(null)}>
                <DialogContent className="max-w-md p-0 overflow-hidden rounded-3xl border-none bg-black">
                    <DialogHeader className="sr-only">
                        <DialogTitle>Lihat Foto</DialogTitle>
                        <DialogDescription>Tampilan detail foto bukti.</DialogDescription>
                    </DialogHeader>
                    <div className="relative aspect-[3/4] sm:aspect-square flex items-center justify-center">
                        <img
                            src={selectedPhoto || ""}
                            alt="Bukti"
                            className="w-full h-full object-contain"
                            onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                if (selectedPhoto && !selectedPhoto.includes('base64') && selectedPhoto.length > 100) {
                                    target.src = selectedPhoto;
                                }
                            }}
                        />
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-4 right-4 rounded-full bg-black/50 text-white hover:bg-black/70 backdrop-blur-md"
                            onClick={() => setSelectedPhoto(null)}
                        >
                            <X className="h-5 w-5" />
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Generic Confirm Dialog — replaces window.confirm() for PWA safety */}
            <Dialog
                open={!!confirmDialog?.open}
                onOpenChange={(val) => !val && setConfirmDialog(null)}
            >
                <DialogContent className="rounded-3xl max-w-xs md:max-w-sm p-6">
                    <DialogHeader>
                        <div className="mx-auto w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center mb-3">
                            <X className="w-7 h-7 text-orange-600" />
                        </div>
                        <DialogTitle className="text-center text-lg font-bold">
                            {confirmDialog?.title}
                        </DialogTitle>
                        <DialogDescription className="text-center text-sm text-muted-foreground pt-1">
                            {confirmDialog?.description}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-1 gap-3 mt-4">
                        <Button
                            className={`w-full h-12 rounded-2xl font-bold ${confirmDialog?.confirmClass || 'bg-primary hover:bg-primary/90 text-white'}`}
                            onClick={() => {
                                const cb = confirmDialog?.onConfirm;
                                setConfirmDialog(null);
                                cb?.();
                            }}
                        >
                            {confirmDialog?.confirmLabel || "Ya"}
                        </Button>
                        <Button
                            variant="ghost"
                            className="w-full h-12 text-gray-400"
                            onClick={() => setConfirmDialog(null)}
                        >
                            Batalkan
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <BottomNav />

            {/* Permission Dialog */}
            <Dialog open={permitOpen} onOpenChange={setPermitOpen}>
                <DialogContent className="rounded-3xl max-w-xs md:max-w-md p-6">
                    <DialogHeader>
                        <DialogTitle className="text-center text-xl font-bold flex items-center justify-center gap-2">
                            {permitType === 'sick' ? <Stethoscope className="w-6 h-6 text-blue-600" /> : <FileText className="w-6 h-6 text-purple-600" />}
                            {permitType === 'sick' ? 'Form Sakit' : 'Form Izin'}
                        </DialogTitle>
                        <DialogDescription className="text-center text-sm text-muted-foreground">
                            Silakan isi form di bawah ini untuk mengajukan {permitType === 'sick' ? 'sakit' : 'izin'}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 mt-2">
                        <Textarea
                            placeholder={`Alasan ${permitType === 'sick' ? 'sakit' : 'izin'}...`}
                            value={permitNote}
                            onChange={(e) => setPermitNote(e.target.value)}
                            className="resize-none rounded-2xl border-gray-200 focus:border-primary min-h-[100px]"
                        />

                        {/* Contextual state warning */}
                        {isBreak && !hasBreakEnded ? (
                            <div className="bg-orange-50 p-4 rounded-2xl border border-orange-200">
                                <p className="text-[10px] font-bold text-orange-700 uppercase mb-2 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Anda Sedang Istirahat</p>
                                <ul className="text-[11px] text-orange-700 space-y-1">
                                    <li className="flex gap-2"><span>•</span><span>Jam istirahat akan <strong>ditutup otomatis</strong>.</span></li>
                                    <li className="flex gap-2"><span>•</span><span>Jam kerja yang sudah berlangsung <strong>tetap dihitung</strong>.</span></li>
                                    <li className="flex gap-2"><span>•</span><span>Anda dapat <strong>Lanjut Bekerja</strong> kapan saja setelah ini.</span></li>
                                </ul>
                            </div>
                        ) : hasCheckedIn && !hasCheckedOut ? (
                            <div className="bg-yellow-50 p-4 rounded-2xl border border-yellow-200">
                                <p className="text-[10px] font-bold text-yellow-700 uppercase mb-2 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Anda Sedang Bekerja</p>
                                <ul className="text-[11px] text-yellow-700 space-y-1">
                                    <li className="flex gap-2"><span>•</span><span>Sesi kerja Anda akan <strong>dihentikan</strong> sekarang.</span></li>
                                    <li className="flex gap-2"><span>•</span><span>Jam kerja yang sudah berlangsung <strong>tetap dihitung</strong>.</span></li>
                                    <li className="flex gap-2"><span>•</span><span>Anda dapat <strong>Lanjut Bekerja</strong> kapan saja setelah ini.</span></li>
                                </ul>
                            </div>
                        ) : (
                            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                                <p className="text-[10px] font-bold text-blue-700 uppercase mb-2 flex items-center gap-1.5"><Info className="w-3.5 h-3.5" /> Sebelum Mulai Kerja</p>
                                <ul className="text-[11px] text-blue-600/80 space-y-1">
                                    <li className="flex gap-2"><span>•</span><span>Absensi {permitType === 'sick' ? 'Sakit' : 'Izin'} akan dicatat untuk hari ini.</span></li>
                                    <li className="flex gap-2"><span>•</span><span>Anda tetap dapat <strong>Lanjut Bekerja</strong> kapan saja hari ini.</span></li>
                                    <li className="flex gap-2"><span>•</span><span>Sistem akan mengambil foto dan mencatat lokasi.</span></li>
                                </ul>
                            </div>
                        )}

                        <Button
                            onClick={handlePermitCameraTrigger}
                            className="w-full h-14 rounded-2xl gap-3 bg-primary hover:bg-primary/90 text-white font-bold shadow-lg shadow-primary/20"
                        >
                            <Camera className="w-5 h-5" />
                            Ambil Foto &amp; Kirim
                        </Button>

                        <Button
                            variant="ghost"
                            onClick={() => setPermitOpen(false)}
                            className="w-full text-gray-400 text-sm"
                        >
                            Batalkan
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Employee Document Notification Popup */}
            <Dialog open={currentNotification !== null} onOpenChange={(open) => !open && handleDismissNotification()}>
                <DialogContent className="rounded-3xl max-w-xs md:max-w-md p-6 bg-white border border-gray-100 shadow-xl">
                    <DialogHeader>
                        <div className="mx-auto w-14 h-14 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-3">
                            <FileText className="w-7 h-7" />
                        </div>
                        <DialogTitle className="text-center text-lg font-bold text-gray-950">
                            {currentNotification?.title}
                        </DialogTitle>
                        <DialogDescription className="text-center text-xs text-slate-400 mt-0.5">
                            Tanggal Dokumen: {currentNotification?.date}
                        </DialogDescription>
                    </DialogHeader>

                    {currentNotification && (
                        <div className="space-y-4 my-2">
                            {currentNotification.type === 'warningLetter' && (
                                <div className="text-xs bg-slate-50 p-4 rounded-2xl border border-slate-100 text-slate-700 space-y-1.5">
                                    <p><strong>Masa Berlaku:</strong> {format(new Date(currentNotification.raw.startDate), "d MMM yyyy")} - {format(new Date(currentNotification.raw.endDate), "d MMM yyyy")}</p>
                                </div>
                            )}

                            {['mutasi', 'promosi', 'demosi'].includes(currentNotification.type) && (
                                <div className="text-xs bg-slate-50 p-4 rounded-2xl border border-slate-100 text-slate-700 space-y-1.5">
                                    {currentNotification.type === 'mutasi' ? (
                                        <>
                                            <p><strong>Cabang Lama:</strong> {currentNotification.raw.oldBranch || '-'}</p>
                                            <p><strong>Cabang Baru:</strong> {currentNotification.raw.newBranch || '-'}</p>
                                        </>
                                    ) : (
                                        <>
                                            <p><strong>Jabatan Lama:</strong> {currentNotification.raw.oldPosition || '-'}</p>
                                            <p><strong>Jabatan Baru:</strong> {currentNotification.raw.newPosition || '-'}</p>
                                        </>
                                    )}
                                </div>
                            )}

                            {currentNotification.notes && (
                                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-1">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Keterangan / Alasan</span>
                                    <p className="text-xs text-slate-600 leading-relaxed font-medium italic">"{currentNotification.notes}"</p>
                                </div>
                            )}

                            {currentNotification.documentUrl && (
                                <Button
                                    asChild
                                    className="w-full h-12 rounded-2xl font-bold bg-primary hover:bg-primary/90 text-white flex items-center justify-center gap-2"
                                >
                                    <a href={currentNotification.documentUrl} target="_blank" rel="noopener noreferrer">
                                        <Download className="w-4 h-4" /> Download Dokumen SK
                                    </a>
                                </Button>
                            )}

                            <Button
                                className="w-full h-12 rounded-2xl font-bold bg-blue-600 hover:bg-blue-700 text-white"
                                onClick={handleDismissNotification}
                            >
                                Saya Mengerti &amp; Tutup
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={isOffDayOpen} onOpenChange={setIsOffDayOpen}>
                <DialogContent className="rounded-3xl max-w-xs md:max-w-md p-6">
                    <DialogHeader>
                        <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                            <Umbrella className="w-8 h-8 text-orange-600" />
                        </div>
                        <DialogTitle className="text-center text-xl font-bold">Libur Bekerja</DialogTitle>
                        <DialogDescription className="text-center text-sm pt-2">
                            Apakah Anda yakin ingin menyatakan <strong>Off Day / Libur</strong> hari ini?
                        </DialogDescription>
                    </DialogHeader>
                    <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 mt-4">
                        <ul className="text-[11px] text-orange-700 space-y-2">
                            <li className="flex gap-2"><span>•</span><span>Anda tidak perlu melakukan absen kamera.</span></li>
                            <li className="flex gap-2"><span>•</span><span>Status absen hari ini akan dicatat sebagai <strong>Libur</strong>.</span></li>
                            <li className="flex gap-2"><span>•</span><span>Tindakan ini tidak dapat dibatalkan untuk hari ini.</span></li>
                        </ul>
                    </div>
                    <div className="grid grid-cols-1 gap-3 mt-6">
                        <Button
                            onClick={async () => {
                                setIsOffDayOpen(false);
                                toast({ title: "Memproses...", description: "Mencatat absensi libur anda." });
                                try {
                                    const { address } = await getCoordinates(false);
                                    await permit({
                                        type: 'off',
                                        notes: "Libur Bekerja / Off Day",
                                        checkInPhoto: null,
                                        location: address
                                    });
                                    toast({ title: "Off Day Tercatat", description: "Selamat beristirahat!", className: "bg-primary/50 text-white" });
                                } catch (err) {
                                    handleError(err);
                                }
                            }}
                            className="w-full h-12 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-bold"
                        >
                            Ya, Saya Libur
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={() => setIsOffDayOpen(false)}
                            className="w-full h-12 text-gray-400"
                        >
                            Batalkan
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

        </div>
    );
}
