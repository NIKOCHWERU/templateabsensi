import { useState } from "react";
import { useAuth } from "../hooks/use-auth.js";
import { useToast } from "../hooks/use-toast.js";
import { User, ShieldAlert, ArrowRight, ClipboardCheck } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";

export default function LoginPage() {
  const { loginMutation } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      toast({
        title: "Peringatan",
        description: "NIK wajib diisi",
        variant: "destructive",
      });
      return;
    }

    loginMutation.mutate(
      { username: username.trim(), password: "bypassed-for-employee" },
      {
        onError: (err: any) => {
          toast({
            title: "Gagal Masuk",
            description: err.message || "Pastikan NIK yang Anda masukkan terdaftar.",
            variant: "destructive",
          });
        },
        onSuccess: (data) => {
          if (data.role !== "employee") {
            // Admin logs in through the employee portal accidentally
            toast({
              title: "Akses Dialihkan",
              description: "Admin mendeteksi login. Silakan masuk melalui Portal Admin.",
              variant: "destructive",
            });
            fetch("/api/logout", { method: "POST" }).then(() => {
              setLocation("/admin/login");
            });
            return;
          }
          toast({
            title: "Berhasil Masuk",
            description: "Selamat datang kembali di Portal PT ABC.",
            variant: "success",
          });
        },
      }
    );
  };

  const { data: config } = useQuery<any>({
    queryKey: ["/api/config"],
  });

  const namaPt = config?.namaPt || import.meta.env.VITE_NAMA_PT || "PT ABC";
  const logoUrl = config?.logoUrl || import.meta.env.VITE_LOGO_FILE || "/logo_elok_buah.jpg";
  const logoInisial = config?.logoInisial || import.meta.env.VITE_LOGO_INISIAL || namaPt.charAt(0);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] aspect-square rounded-full bg-orange-100/30 blur-3xl" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] aspect-square rounded-full bg-orange-100/20 blur-3xl" />

      <div className="w-full max-w-md bg-white border border-orange-100/50 rounded-[2.5rem] shadow-2xl p-8 md:p-10 relative z-10">
        <div className="flex flex-col items-center text-center mb-8">
          {logoUrl && logoUrl !== "/logo_elok_buah.jpg" ? (
             <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-lg shadow-orange-500/10 mb-4 border border-orange-100 p-2">
               <img src={logoUrl} alt="Logo PT" className="w-full h-full object-contain" />
             </div>
          ) : (
             <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg shadow-orange-500/25 mb-4 text-3xl font-bold uppercase">
               {logoInisial}
             </div>
          )}
          <h1 className="font-heading font-black text-2xl text-slate-800 tracking-tight uppercase">Absensi {namaPt}</h1>
          <p className="text-xs text-muted-foreground mt-1 uppercase">Sistem manajemen absensi tenaga kerja</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Nomor Induk Tenaga Kerja (NIK)</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan NIK Anda"
                className="w-full pl-11 pr-4 py-3.5 text-sm bg-slate-50/50 hover:bg-slate-50 border border-slate-200 focus:bg-white rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                required
              />
            </div>
          </div>

          <div className="bg-orange-50/50 border border-orange-100 rounded-2xl p-4 flex gap-3 text-[11px] text-orange-800 leading-relaxed">
            <ShieldAlert className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            Untuk akun tenaga kerja, otentikasi kata sandi dilewati. Anda hanya perlu memasukkan NIK terdaftar untuk langsung mengakses dasbor.
          </div>

          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-primary text-white font-bold text-sm shadow-xl shadow-orange-500/25 hover:bg-primary/95 transition-all duration-300 disabled:opacity-50 mt-2"
          >
            {loginMutation.isPending ? "Memverifikasi..." : "Masuk Sekarang"}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 text-center text-xs">
          <span className="text-slate-400">Belum memiliki akun? </span>
          <a href="/employee/signup" className="text-primary font-bold hover:underline">
            Daftar Sekarang
          </a>
        </div>
      </div>
      
      {/* Hidden admin trigger for HRD */}
      <a href="/admin/login" className="absolute bottom-6 right-6 text-[10px] text-slate-300 hover:text-slate-500 z-20">
        Portal Admin
      </a>
    </div>
  );
}
