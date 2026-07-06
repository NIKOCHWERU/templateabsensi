import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, RefreshCw, X, Check, SwitchCamera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { drawWatermark } from '@/lib/watermark';

interface CameraModalProps {
  open: boolean;
  onClose: () => void;
  onCapture: (photoData: string) => Promise<void>;
  locationAddress?: string;
}

// State machine: idle → active → captured
type CameraState = "idle" | "active" | "captured";

export function CameraModal({ open, onClose, onCapture, locationAddress }: CameraModalProps) {
  const { user } = useAuth();
  const { data: appConfig } = useQuery<any>({ queryKey: ["/api/config"] });
  const namaPt: string  = appConfig?.namaPt  || appConfig?.singkatanPt || "Perusahaan";
  const logoUrl: string = appConfig?.logoUrl  || "/logo_elok_buah.jpg";

  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [facingMode, setFacingMode]   = useState<"user" | "environment">("user");
  const [isInitializing, setIsInitializing] = useState(false);
  const [isSubmitting, setIsSubmitting]     = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const videoRef  = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();

  // ── Stop camera helper ────────────────────────────────────────────────────
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  // ── Start camera ──────────────────────────────────────────────────────────
  const startCamera = async () => {
    setIsInitializing(true);
    stopCamera(); // make sure any previous stream is cleared
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 800 }, height: { ideal: 600 } },
        audio: false,
      });
      streamRef.current = newStream;
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
      setCameraState("active");
    } catch (err) {
      console.error("Camera error:", err);
      toast({
        title: "Gagal Mengakses Kamera",
        description: "Pastikan Anda memberikan izin kamera.",
        variant: "destructive",
      });
    } finally {
      setIsInitializing(false);
    }
  };

  // ── Cleanup when modal closes ─────────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      stopCamera();
      setCameraState("idle");
      setCapturedPhoto(null);
      setIsSubmitting(false);
    }
  }, [open]);

  // ── Re-start if facingMode changes while active ───────────────────────────
  useEffect(() => {
    if (cameraState === "active") {
      startCamera();
    }
  }, [facingMode]);

  // ── Capture photo ─────────────────────────────────────────────────────────
  const capturePhoto = async () => {
    if (!videoRef.current || cameraState !== "active") return;

    // Batas resolusi agar foto tidak terlalu besar (maks 800px)
    const maxRes = 800;
    let w = videoRef.current.videoWidth;
    let h = videoRef.current.videoHeight;

    if (w > h) {
      if (w > maxRes) { h = Math.round((h * maxRes) / w); w = maxRes; }
    } else {
      if (h > maxRes) { w = Math.round((w * maxRes) / h); h = maxRes; }
    }

    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Mirror front camera
    if (facingMode === "user") {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(videoRef.current, 0, 0, w, h);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Stop camera immediately after capture — no more live feed needed
    stopCamera();

    // Draw watermark
    await drawWatermark(ctx, w, h, locationAddress || "", user?.fullName || user?.username || "Tenaga Kerja", namaPt, logoUrl);

    // Kompres ke JPEG 65% untuk menjaga ukuran file tetap kecil
    setCapturedPhoto(canvas.toDataURL("image/jpeg", 0.65));
    setCameraState("captured");
  };

  // ── Retake ────────────────────────────────────────────────────────────────
  const handleRetake = () => {
    setCapturedPhoto(null);
    startCamera();
  };

  // ── Confirm & submit ──────────────────────────────────────────────────────
  const handleConfirm = async () => {
    if (!capturedPhoto || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onCapture(capturedPhoto);
      setCapturedPhoto(null);
    } catch (err) {
      console.error("Capture confirm failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    stopCamera();
    onClose();
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={(val) => !val && handleClose()}>
      <DialogContent
        aria-describedby="camera-modal-desc"
        aria-labelledby="camera-modal-title"
        className="p-0 overflow-hidden bg-black border-none max-w-full h-[100dvh] sm:max-w-lg sm:h-[80vh] sm:rounded-3xl flex flex-col"
      >
        <DialogTitle id="camera-modal-title" className="sr-only">Ambil Foto</DialogTitle>
        <DialogDescription id="camera-modal-desc" className="sr-only">
          Antarmuka kamera untuk mengambil foto absensi.
        </DialogDescription>

        {/* ── Viewfinder Area ── */}
        <div className="relative flex-1 bg-gray-950 flex items-center justify-center overflow-hidden">

          {/* IDLE — kamera belum aktif */}
          {cameraState === "idle" && (
            <div className="flex flex-col items-center gap-5 text-white px-8 text-center">
              <div className="w-24 h-24 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center mb-2">
                <Camera className="w-10 h-10 text-white/70" />
              </div>
              <p className="text-lg font-semibold">Siap Absen?</p>
              <p className="text-sm text-white/50">
                Tekan tombol di bawah untuk mengaktifkan kamera dan mengambil foto.
              </p>
              <Button
                onClick={startCamera}
                disabled={isInitializing}
                className="mt-2 rounded-full px-8 py-5 text-base font-bold bg-white text-black hover:bg-white/90 shadow-xl"
              >
                {isInitializing
                  ? <><RefreshCw className="w-5 h-5 animate-spin mr-2" /> Memuat...</>
                  : <><Camera className="w-5 h-5 mr-2" /> Aktifkan Kamera</>
                }
              </Button>
            </div>
          )}

          {/* ACTIVE — live viewfinder */}
          {(cameraState === "active" || (cameraState === "idle" && isInitializing)) && (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className={`w-full h-full object-cover ${facingMode === "user" ? "scale-x-[-1]" : ""}`}
              />
              {isInitializing && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white">
                  <RefreshCw className="w-8 h-8 animate-spin" />
                </div>
              )}
            </>
          )}

          {/* CAPTURED — preview */}
          {cameraState === "captured" && capturedPhoto && (
            <img src={capturedPhoto} alt="Captured" className="w-full h-full object-cover" />
          )}

          {/* Top controls */}
          {!isSubmitting && (
            <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-10">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full bg-black/30 text-white hover:bg-black/50 backdrop-blur-md"
                onClick={handleClose}
              >
                <X className="w-6 h-6" />
              </Button>
              {cameraState === "active" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full bg-black/30 text-white hover:bg-black/50 backdrop-blur-md"
                  onClick={() => setFacingMode((p) => p === "user" ? "environment" : "user")}
                >
                  <SwitchCamera className="w-6 h-6" />
                </Button>
              )}
            </div>
          )}
        </div>

        {/* ── Bottom Controls ── */}
        <div className="bg-black/85 backdrop-blur-xl p-8 flex justify-center items-center gap-8 z-10">
          {cameraState === "active" ? (
            /* Shutter button */
            <button
              onClick={capturePhoto}
              disabled={isInitializing}
              className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center active:scale-90 transition-transform disabled:opacity-40"
            >
              <div className="w-16 h-16 rounded-full bg-white shadow-lg" />
            </button>
          ) : cameraState === "captured" ? (
            /* Retake / Confirm */
            <div className="flex items-center gap-12 w-full justify-center">
              <Button
                variant="ghost"
                disabled={isSubmitting}
                className="flex flex-col gap-2 text-white hover:bg-white/10 h-auto py-2"
                onClick={handleRetake}
              >
                <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">
                  <RefreshCw className="w-6 h-6" />
                </div>
                <span className="text-xs font-medium">Ulangi</span>
              </Button>

              <Button
                variant="ghost"
                disabled={isSubmitting}
                className="flex flex-col gap-2 text-white hover:bg-white/10 h-auto py-2"
                onClick={handleConfirm}
              >
                <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/30">
                  {isSubmitting
                    ? <RefreshCw className="w-10 h-10 animate-spin" />
                    : <Check className="w-10 h-10" />}
                </div>
                <span className="text-xs font-medium">
                  {isSubmitting ? "Mengirim..." : "Gunakan Foto"}
                </span>
              </Button>
            </div>
          ) : (
            /* IDLE — placeholder space */
            <div className="h-20" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
