import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Settings, ShieldCheck, ToggleLeft } from "lucide-react";

// Helper functions for HEX <-> HSL conversion
function hexToHsl(hex: string): string {
  hex = hex.replace(/^#/, "");
  let r = parseInt(hex.substring(0, 2), 16) / 255;
  let g = parseInt(hex.substring(2, 4), 16) / 255;
  let b = parseInt(hex.substring(4, 6), 16) / 255;

  let max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    let d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  h = Math.round(h * 360);
  s = Math.round(s * 100);
  l = Math.round(l * 100);

  return `${h} ${s}% ${l}%`;
}

function hslToHex(hslStr: string): string {
  const parts = hslStr.trim().split(/\s+/);
  if (parts.length !== 3) return "#f97316";

  let h = parseInt(parts[0]) / 360;
  let s = parseInt(parts[1].replace("%", "")) / 100;
  let l = parseInt(parts[2].replace("%", "")) / 100;

  let r = 0, g = 0, b = 0;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    let q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    let p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function getDerivedColors(primaryHslStr: string) {
  const parts = primaryHslStr.trim().split(/\s+/);
  if (parts.length !== 3) {
    return {
      themePrimary: "24 95% 53%",
      themeSecondary: "24 95% 43%",
      themeAccent: "24 95% 93%",
      themeBackground: "0 0% 100%",
      themeSidebarAccent: "24 95% 97%",
    };
  }

  const h = parseInt(parts[0]);
  const s = parseInt(parts[1].replace("%", ""));
  const l = parseInt(parts[2].replace("%", ""));

  const secondaryL = Math.max(15, l - 10);
  const accentL = 93;
  const sidebarL = 97;

  return {
    themePrimary: `${h} ${s}% ${l}%`,
    themeSecondary: `${h} ${s}% ${secondaryL}%`,
    themeAccent: `${h} ${s}% ${accentL}%`,
    themeBackground: "0 0% 100%",
    themeSidebarAccent: `${h} ${s}% ${sidebarL}%`,
  };
}

export default function AdminSettingsPage() {
  const { toast } = useToast();
  
  // Fetch dynamic configurations
  const { data: config, isLoading } = useQuery<any>({
    queryKey: ["/api/config"],
  });

  const [namaPt, setNamaPt] = useState("");
  const [singkatanPt, setSingkatanPt] = useState("");
  const [deskripsiPwa, setDeskripsiPwa] = useState("");
  const [rekapPrefix, setRekapPrefix] = useState("");
  const [hexPrimary, setHexPrimary] = useState("#f97316");
  const [hexSecondary, setHexSecondary] = useState("#ea580c");
  const [hexAccent, setHexAccent] = useState("#ffedd5");
  const [hexBackground, setHexBackground] = useState("#ffffff");
  const [hexSidebarAccent, setHexSidebarAccent] = useState("#fff7ed");
  const [features, setFeatures] = useState({
    leave: true,
    recap: true,
    complaint: true,
    info: true,
    mutation: true,
    warningLetter: true,
    shift: true,
    resignation: true,
    break: true,
  });

  useEffect(() => {
    if (config) {
      setNamaPt(config.namaPt || "");
      setSingkatanPt(config.singkatanPt || "");
      setDeskripsiPwa(config.deskripsiPwa || "");
      setRekapPrefix(config.rekapPrefix || "");
      setHexPrimary(hslToHex(config.themePrimary || "24 95% 53%"));
      setHexSecondary(hslToHex(config.themeSecondary || "24 95% 43%"));
      setHexAccent(hslToHex(config.themeAccent || "24 95% 93%"));
      setHexBackground(hslToHex(config.themeBackground || "0 0% 100%"));
      setHexSidebarAccent(hslToHex(config.themeSidebarAccent || "24 95% 97%"));
      if (config.features) {
        setFeatures({
          leave: config.features.leave !== false,
          recap: config.features.recap !== false,
          complaint: config.features.complaint !== false,
          info: config.features.info !== false,
          mutation: config.features.mutation !== false,
          warningLetter: config.features.warningLetter !== false,
          shift: config.features.shift !== false,
          resignation: config.features.resignation !== false,
          break: config.features.break !== false,
        });
      }
    }
  }, [config]);

  const mutation = useMutation({
    mutationFn: async (values: any) => {
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        throw new Error("Gagal memperbarui pengaturan");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/config"] });
      toast({
        title: "Pengaturan Diperbarui",
        description: "Fitur aplikasi dan konfigurasi berhasil diselaraskan secara langsung.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Gagal",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    const primaryHsl = hexToHsl(hexPrimary);
    const derived = getDerivedColors(primaryHsl);

    mutation.mutate({
      namaPt,
      singkatanPt,
      deskripsiPwa,
      rekapPrefix,
      themePrimary: derived.themePrimary,
      themeSecondary: derived.themeSecondary,
      themeAccent: derived.themeAccent,
      themeBackground: derived.themeBackground,
      themeSidebarAccent: derived.themeSidebarAccent,
      features,
    });
  };

  const handleToggle = (key: keyof typeof features) => {
    setFeatures(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-1.5 border-b border-gray-100 pb-4">
        <h1 className="text-xl font-bold text-gray-800 uppercase tracking-tight flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary" /> Pengaturan Fitur & Identitas
        </h1>
        <p className="text-xs text-gray-500">
          Kelola fitur modular sistem absensi dan ubah informasi profil instansi/perusahaan secara dinamis.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Identitas Card */}
        <div className="md:col-span-1 space-y-6">
          <Card className="border border-gray-100 shadow-xs rounded-2xl bg-white">
            <CardHeader className="py-4 px-6 border-b border-gray-50 bg-gray-50/50 rounded-t-2xl">
              <CardTitle className="text-xs font-bold text-gray-700 uppercase tracking-wider">Identitas Perusahaan</CardTitle>
            </CardHeader>
            <CardContent className="py-5 px-6 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Nama PT</Label>
                <Input
                  className="rounded-xl border-gray-200 text-xs"
                  value={namaPt}
                  onChange={(e) => setNamaPt(e.target.value)}
                  placeholder="Contoh: PT ABCD"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Singkatan PT</Label>
                <Input
                  className="rounded-xl border-gray-200 text-xs"
                  value={singkatanPt}
                  onChange={(e) => setSingkatanPt(e.target.value)}
                  placeholder="Contoh: PT ABC"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Deskripsi Aplikasi</Label>
                <Input
                  className="rounded-xl border-gray-200 text-xs"
                  value={deskripsiPwa}
                  onChange={(e) => setDeskripsiPwa(e.target.value)}
                  placeholder="Deskripsi PWA..."
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Prefix Rekap File PDF</Label>
                <Input
                  className="rounded-xl border-gray-200 text-xs"
                  value={rekapPrefix}
                  onChange={(e) => setRekapPrefix(e.target.value)}
                  placeholder="Contoh: REKAP_ABSENSI"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-100 shadow-xs rounded-2xl bg-white mt-6">
            <CardHeader className="py-4 px-6 border-b border-gray-50 bg-gray-50/50 rounded-t-2xl">
              <CardTitle className="text-xs font-bold text-gray-700 uppercase tracking-wider">Tema Warna Utama (Visual)</CardTitle>
            </CardHeader>
            <CardContent className="py-5 px-6 space-y-4">
              <div className="flex items-center gap-3 p-2.5 border border-slate-100 rounded-xl hover:bg-gray-50/50 transition-all">
                <input
                  type="color"
                  className="w-10 h-10 rounded-lg cursor-pointer border-none bg-transparent"
                  value={hexPrimary}
                  onChange={(e) => setHexPrimary(e.target.value)}
                />
                <div className="flex-1 min-w-0">
                  <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">Warna Utama (Primary)</Label>
                  <span className="text-xs font-mono font-bold text-gray-600">{hexPrimary.toUpperCase()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Modular Features Toggle */}
        <div className="md:col-span-2 space-y-6">
          <Card className="border border-gray-100 shadow-xs rounded-2xl bg-white">
            <CardHeader className="py-4 px-6 border-b border-gray-50">
              <CardTitle className="text-sm font-bold text-gray-700 uppercase tracking-wider">Kelola Modul & Menu Aktif</CardTitle>
              <CardDescription className="text-[11px] text-gray-400 mt-1">
                Aktifkan atau nonaktifkan fitur di bawah ini. Perubahan akan langsung disinkronkan ke panel admin dan portal karyawan.
              </CardDescription>
            </CardHeader>
            <CardContent className="py-6 px-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                
                {/* Leave Toggle */}
                <div className="flex items-center justify-between p-3 border border-gray-50 rounded-xl hover:bg-gray-50/50 transition-colors">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-bold text-gray-700">Pengajuan Cuti</Label>
                    <p className="text-[10px] text-gray-400 leading-tight">Pengajuan, persetujuan & cetak cuti.</p>
                  </div>
                  <Switch
                    checked={features.leave}
                    onCheckedChange={() => handleToggle("leave")}
                    className="data-[state=checked]:bg-primary"
                  />
                </div>

                {/* Shift Toggle */}
                <div className="flex items-center justify-between p-3 border border-gray-50 rounded-xl hover:bg-gray-50/50 transition-colors">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-bold text-gray-700">Shift Kerja</Label>
                    <p className="text-[10px] text-gray-400 leading-tight">Kelola pengaturan jam masuk & keluar shift.</p>
                  </div>
                  <Switch
                    checked={features.shift}
                    onCheckedChange={() => handleToggle("shift")}
                    className="data-[state=checked]:bg-primary"
                  />
                </div>

                {/* Recap Toggle */}
                <div className="flex items-center justify-between p-3 border border-gray-50 rounded-xl hover:bg-gray-50/50 transition-colors">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-bold text-gray-700">Rekapitulasi Kehadiran</Label>
                    <p className="text-[10px] text-gray-400 leading-tight">Laporan rekap & ekspor PDF massal.</p>
                  </div>
                  <Switch
                    checked={features.recap}
                    onCheckedChange={() => handleToggle("recap")}
                    className="data-[state=checked]:bg-primary"
                  />
                </div>

                {/* Complaint Toggle */}
                <div className="flex items-center justify-between p-3 border border-gray-50 rounded-xl hover:bg-gray-50/50 transition-colors">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-bold text-gray-700">Aduan / Komplain</Label>
                    <p className="text-[10px] text-gray-400 leading-tight">Saluran keluhan karyawan dengan lampiran foto.</p>
                  </div>
                  <Switch
                    checked={features.complaint}
                    onCheckedChange={() => handleToggle("complaint")}
                    className="data-[state=checked]:bg-primary"
                  />
                </div>

                {/* Mutation Toggle */}
                <div className="flex items-center justify-between p-3 border border-gray-50 rounded-xl hover:bg-gray-50/50 transition-colors">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-bold text-gray-700">Mutasi & Promosi</Label>
                    <p className="text-[10px] text-gray-400 leading-tight">Manajemen karir, demosi & mutasi cabang.</p>
                  </div>
                  <Switch
                    checked={features.mutation}
                    onCheckedChange={() => handleToggle("mutation")}
                    className="data-[state=checked]:bg-primary"
                  />
                </div>

                {/* Warning Letter Toggle */}
                <div className="flex items-center justify-between p-3 border border-gray-50 rounded-xl hover:bg-gray-50/50 transition-colors">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-bold text-gray-700">Surat Peringatan (SP)</Label>
                    <p className="text-[10px] text-gray-400 leading-tight">Penerbitan dokumen SP1, SP2, dan SP3.</p>
                  </div>
                  <Switch
                    checked={features.warningLetter}
                    onCheckedChange={() => handleToggle("warningLetter")}
                    className="data-[state=checked]:bg-primary"
                  />
                </div>

                {/* Resignation Toggle */}
                <div className="flex items-center justify-between p-3 border border-gray-50 rounded-xl hover:bg-gray-50/50 transition-colors">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-bold text-gray-700">Pengunduran Diri (Resign)</Label>
                    <p className="text-[10px] text-gray-400 leading-tight">Pengajuan resign, pemberhentian & rekap data.</p>
                  </div>
                  <Switch
                    checked={features.resignation}
                    onCheckedChange={() => handleToggle("resignation")}
                    className="data-[state=checked]:bg-primary"
                  />
                </div>

                {/* Break (Istirahat) Toggle */}
                <div className="flex items-center justify-between p-3 border border-gray-50 rounded-xl hover:bg-gray-50/50 transition-colors">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-bold text-gray-700">Fitur Istirahat</Label>
                    <p className="text-[10px] text-gray-400 leading-tight">Aktifkan tombol Mulai & Selesai Istirahat.</p>
                  </div>
                  <Switch
                    checked={features.break}
                    onCheckedChange={() => handleToggle("break")}
                    className="data-[state=checked]:bg-primary"
                  />
                </div>

                {/* Info Board Toggle */}
                <div className="flex items-center justify-between p-3 border border-gray-50 rounded-xl hover:bg-gray-50/50 transition-colors">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-bold text-gray-700">Papan Pengumuman</Label>
                    <p className="text-[10px] text-gray-400 leading-tight font-medium leading-none">Buat pengumuman internal perusahaan.</p>
                  </div>
                  <Switch
                    checked={features.info}
                    onCheckedChange={() => handleToggle("info")}
                    className="data-[state=checked]:bg-primary"
                  />
                </div>

              </div>

              <div className="pt-5 border-t border-gray-50 flex justify-end">
                <Button
                  onClick={handleSave}
                  disabled={mutation.isPending}
                  className="bg-primary hover:bg-primary/90 text-white rounded-xl px-6 h-11 font-bold shadow-xs hover:shadow transition-all active:scale-[0.98]"
                >
                  {mutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Simpan Konfigurasi Fitur
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
