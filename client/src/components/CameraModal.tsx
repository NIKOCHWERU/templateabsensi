import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, RefreshCw, X, Check, SwitchCamera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import { useAuth } from "@/hooks/use-auth";
import { drawWatermark } from '@/lib/watermark';

interface CameraModalProps {
  open: boolean;
  onClose: () => void;
  onCapture: (photoData: string) => Promise<void>;
  locationAddress?: string;
}

export function CameraModal({ open, onClose, onCapture, locationAddress }: CameraModalProps) {
  const { user } = useAuth();
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [isInitializing, setIsInitializing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();

  const startCamera = async () => {
    if (isSubmitting) return;
    setIsInitializing(true);
    try {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: false,
      });
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      toast({
        title: "Gagal Mengakses Kamera",
        description: "Pastikan Anda memberikan izin kamera.",
        variant: "destructive",
      });
      onClose();
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    if (open && !capturedPhoto && !isSubmitting) {
      startCamera();
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [open, facingMode, isSubmitting]);

  const capturePhoto = async () => {
    if (!videoRef.current) return;

    const maxResolution = 1280;
    let width = videoRef.current.videoWidth;
    let height = videoRef.current.videoHeight;

    if (width > height) {
      if (width > maxResolution) {
        height = Math.round((height * maxResolution) / width);
        width = maxResolution;
      }
    } else {
      if (height > maxResolution) {
        width = Math.round((width * maxResolution) / height);
        height = maxResolution;
      }
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      // Mirror if using front camera
      if (facingMode === "user") {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(videoRef.current, 0, 0, width, height);

      // Reset transform so text/watermark is not mirrored
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      // Apply Watermark
      await drawWatermark(
        ctx,
        canvas.width,
        canvas.height,
        locationAddress || "",
        user?.fullName || user?.username || "Tenaga Kerja"
      );

      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
      setCapturedPhoto(dataUrl);

      // Stop stream after capture to save battery/perf
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        setStream(null);
      }
    }
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
    startCamera();
  };

  const handleConfirm = async () => {
    if (capturedPhoto && !isSubmitting) {
      setIsSubmitting(true);
      try {
        await onCapture(capturedPhoto);
        // On success, the modal will be closed by the parent
        setCapturedPhoto(null);
      } catch (err) {
        // Error is handled by parent, let's just allow retake
        console.error("Capture confirmation failed:", err);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && !isSubmitting && onClose()}>
      <DialogContent aria-describedby="camera-modal-desc" aria-labelledby="camera-modal-title" className="p-0 overflow-hidden bg-black border-none max-w-full h-[100dvh] sm:max-w-lg sm:h-[80vh] sm:rounded-3xl flex flex-col">
        <DialogTitle id="camera-modal-title" className="sr-only">Ambil Foto</DialogTitle>
        <DialogDescription id="camera-modal-desc" className="sr-only">
          Antarmuka kamera untuk mengambil foto absensi.
        </DialogDescription>
        <div className="relative flex-1 bg-gray-900 flex items-center justify-center overflow-hidden">
          {!capturedPhoto ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className={`w-full h-full object-cover ${facingMode === "user" ? "scale-x-[-1]" : ""}`}
              />
              {isInitializing && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white">
                  <RefreshCw className="w-8 h-8 animate-spin" />
                </div>
              )}
            </>
          ) : (
            <img
              src={capturedPhoto}
              alt="Captured"
              className="w-full h-full object-cover"
            />
          )}

          {/* Top Controls - Hide when submitting */}
          {!isSubmitting && (
            <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-10">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full bg-black/20 text-white hover:bg-black/40 backdrop-blur-md"
                onClick={onClose}
              >
                <X className="w-6 h-6" />
              </Button>
              {!capturedPhoto && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full bg-black/20 text-white hover:bg-black/40 backdrop-blur-md"
                  onClick={toggleCamera}
                >
                  <SwitchCamera className="w-6 h-6" />
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Bottom Controls */}
        <div className="bg-black/80 backdrop-blur-xl p-8 flex justify-center items-center gap-8 z-10">
          {!capturedPhoto ? (
            <button
              onClick={capturePhoto}
              disabled={isInitializing || isSubmitting}
              className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center active:scale-90 transition-transform disabled:opacity-50"
            >
              <div className="w-16 h-16 rounded-full bg-white shadow-lg" />
            </button>
          ) : (
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
                  {isSubmitting ? <RefreshCw className="w-10 h-10 animate-spin" /> : <Check className="w-10 h-10" />}
                </div>
                <span className="text-xs font-medium">{isSubmitting ? "Mengirim..." : "Gunakan Foto"}</span>
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
