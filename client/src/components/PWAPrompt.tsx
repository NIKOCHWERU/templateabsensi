import { useState, useEffect } from "react";
import { X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";

export function PWAPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  // Fetch app config for logo and name
  const { data: config } = useQuery<any>({
    queryKey: ["/api/config"],
  });

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      
      // Check if user has previously dismissed the prompt
      const hasDismissed = localStorage.getItem("pwa_prompt_dismissed");
      if (!hasDismissed) {
        setShowPrompt(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    // We no longer need the prompt. Clear it up
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Remember the user dismissed it so we don't nag them again (for 30 days)
    localStorage.setItem("pwa_prompt_dismissed", new Date().toISOString());
  };

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ y: 150, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 150, opacity: 0 }}
          className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:bottom-4 md:w-96 z-[100]"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 flex flex-col gap-3">
            <button 
              onClick={handleDismiss}
              className="absolute top-2 right-2 text-slate-400 hover:text-slate-600 p-1 rounded-full bg-slate-50 hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center p-2 flex-shrink-0">
                {config?.logoUrl ? (
                  <img src={config.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <Download className="w-6 h-6 text-primary" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-sm text-slate-800 leading-tight">
                  Install {config?.singkatanPt || "Aplikasi"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tambahkan ke layar utama untuk akses lebih cepat dan mudah.
                </p>
              </div>
            </div>
            
            <Button onClick={handleInstallClick} className="w-full rounded-xl font-bold shadow-md shadow-primary/20">
              <Download className="w-4 h-4 mr-2" /> Install Aplikasi
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
