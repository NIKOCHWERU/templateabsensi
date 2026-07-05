import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Camera, RefreshCw, Check, X, SwitchCamera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface LateReasonModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (reason: string, photo?: string) => void;
}

export function LateReasonModal({ isOpen, onClose, onSubmit }: LateReasonModalProps) {
    const [reason, setReason] = useState("");
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
    const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { toast } = useToast();

    const startCamera = async (overrideMode?: "environment" | "user") => {
        const modeToUse = overrideMode || facingMode;
        try {
            setIsCameraActive(true);
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: modeToUse }
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            if (overrideMode) setFacingMode(overrideMode);
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            console.error("Error accessing camera:", err);
            toast({
                title: "Gagal mengakses kamera",
                description: "Pastikan Anda memberikan izin akses kamera.",
                variant: "destructive",
            });
            setIsCameraActive(false);
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
        setIsCameraActive(false);
    };

    const toggleCamera = () => {
        stopCamera();
        const newMode = facingMode === "environment" ? "user" : "environment";
        startCamera(newMode);
    };

    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext("2d");
            if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const photo = canvas.toDataURL("image/png");
                setCapturedPhoto(photo);
                stopCamera();
            }
        }
    };

    const handleSubmit = () => {
        if (!reason.trim()) {
            toast({
                title: "Alasan wajib diisi",
                description: "Silakan berikan alasan mengapa Anda terlambat.",
                variant: "destructive",
            });
            return;
        }
        onSubmit(reason, capturedPhoto || undefined);
        setReason("");
        setCapturedPhoto(null);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-full w-full h-[100dvh] sm:max-w-md sm:h-auto bg-white border-none sm:border-zinc-200 text-zinc-900 sm:rounded-3xl p-0 overflow-hidden flex flex-col">
                <DialogHeader className="space-y-3 p-6 pb-0">
                    <DialogTitle className="text-2xl font-black text-center text-red-600 tracking-tight uppercase">
                        Anda Terlambat
                    </DialogTitle>
                    <DialogDescription className="text-sm text-zinc-500 text-center font-medium leading-relaxed">
                        Batas waktu pukul 07:00 telah terlewati. <br />
                        Mohon sampaikan alasan keterlambatan Anda di bawah ini.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 ml-1">Keterangan Alasan</label>
                        <Textarea
                            placeholder="Contoh: Terjebak macet parah, ada kendala pada kendaraan, kepentingan mendesak, dll."
                            className="bg-zinc-50 border-zinc-100 text-zinc-900 min-h-[120px] rounded-2xl focus:ring-red-500 focus:border-red-500 transition-all placeholder:text-zinc-300"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 ml-1">Bukti Foto (Opsional)</label>
                        <div className="relative aspect-video bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center overflow-hidden transition-all hover:border-red-200 group">
                            {capturedPhoto ? (
                                <>
                                    <img src={capturedPhoto} alt="Bukti Terlambat" className="w-full h-full object-cover" />
                                    <Button
                                        size="icon"
                                        variant="destructive"
                                        className="absolute top-3 right-3 rounded-full shadow-lg"
                                        onClick={() => setCapturedPhoto(null)}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </>
                            ) : isCameraActive ? (
                                <>
                                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                                    <div className="absolute top-3 right-3 flex gap-2">
                                        <Button
                                            size="icon"
                                            variant="secondary"
                                            className="rounded-full shadow-lg bg-white/50 backdrop-blur-md hover:bg-white/80"
                                            onClick={toggleCamera}
                                        >
                                            <SwitchCamera className="h-4 w-4 text-black" />
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="destructive"
                                            className="rounded-full shadow-lg"
                                            onClick={stopCamera}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <Button
                                        className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-red-600 hover:bg-red-700 shadow-xl px-8"
                                        size="lg"
                                        onClick={capturePhoto}
                                    >
                                        Ambil Foto
                                    </Button>
                                </>
                            ) : (
                                <div className="text-center space-y-3 p-6 flex flex-col items-center">
                                    <div className="p-4 bg-white shadow-sm rounded-2xl inline-block group-hover:scale-110 transition-transform">
                                        <Camera className="h-7 w-7 text-zinc-300" />
                                    </div>
                                    <p className="text-[11px] text-zinc-400 font-medium">Opsional: Lampirkan bukti foto jika diperlukan</p>
                                    <div className="flex flex-col w-full gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="border-zinc-200 hover:bg-zinc-100 rounded-xl px-4 font-semibold gap-2 w-full"
                                            onClick={() => startCamera()}
                                        >
                                            <Camera className="h-4 w-4" />
                                            Buka Kamera
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="border-zinc-200 hover:bg-zinc-100 rounded-xl px-4 font-semibold gap-2 w-full"
                                            onClick={() => document.getElementById('gallery-upload')?.click()}
                                        >
                                            <RefreshCw className="h-4 w-4" />
                                            Pilih Galeri
                                        </Button>
                                        <input
                                            id="gallery-upload"
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    const reader = new FileReader();
                                                    reader.onloadend = () => {
                                                        setCapturedPhoto(reader.result as string);
                                                    };
                                                    reader.readAsDataURL(file);
                                                }
                                            }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <DialogFooter className="flex flex-col gap-3 p-6 pt-2">
                    <Button
                        variant="ghost"
                        className="w-full text-zinc-400 hover:text-red-600 hover:bg-red-50 font-bold rounded-2xl h-12 order-2 sm:order-1"
                        onClick={onClose}
                    >
                        Batalkan
                    </Button>
                    <Button
                        className="w-full bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl h-14 shadow-lg shadow-red-100 text-base order-1 sm:order-2"
                        onClick={handleSubmit}
                    >
                        Simpan & Masuk Sesi
                    </Button>
                </DialogFooter>
            </DialogContent>
            <canvas ref={canvasRef} className="hidden" />
        </Dialog>
    );
}

