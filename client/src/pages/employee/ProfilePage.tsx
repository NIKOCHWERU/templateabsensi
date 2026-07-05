import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { BottomNav } from "@/components/BottomNav";
import { safeCompressImage, uploadFileWithProgress, toTitleCase, formatAddress } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Loader2, Camera, Pencil, Check, Lock, MessageSquare, Upload } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { id } from "date-fns/locale";

const profileSchema = z.object({
  phoneNumber: z.string().optional(),
  email: z.string().email("Email tidak valid").optional().or(z.literal("")),
  branch: z.string().optional(),
  npwp: z.string().optional(),
  bpjs: z.string().optional(),
  religion: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

function ReadOnlyField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="py-2 border-b border-slate-50 last:border-0">
      <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">{label}</span>
      <p className="text-gray-800 font-medium mt-0.5">{value || <span className="text-slate-300 italic text-sm">Belum diisi</span>}</p>
    </div>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [previews, setPreviews] = useState<{ profile?: string; npwp?: string; bpjs?: string }>({});
  const [uploadProgress, setUploadProgress] = useState<{ profile?: number; npwp?: number; bpjs?: number }>({});
  const [uploadedUrls, setUploadedUrls] = useState<{ profile?: string; npwp?: string; bpjs?: string }>({});
  const [isEditing, setIsEditing] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'profile' | 'npwp' | 'bpjs') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 30 * 1024 * 1024) {
      toast({
        title: "File Terlalu Besar",
        description: "Ukuran file maksimal adalah 30MB.",
        variant: "destructive"
      });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => setPreviews(prev => ({ ...prev, [type]: reader.result as string }));
    reader.readAsDataURL(file);

    try {
      const maxW = type === 'profile' ? 1024 : 1280;
      const compressed = await safeCompressImage(file, { maxWidth: maxW, quality: 0.8 });
      setUploadProgress(prev => ({ ...prev, [type]: 0 }));
      
      const url = await uploadFileWithProgress(
        compressed, 
        (p) => setUploadProgress(prev => ({ ...prev, [type]: p }))
      );

      setUploadedUrls(prev => ({ ...prev, [type]: url }));
      toast({ title: "Berhasil", description: `Foto ${type.toUpperCase()} berhasil diunggah.` });
    } catch (error: any) {
      setUploadProgress(prev => ({ ...prev, [type]: undefined }));
      toast({ title: "Gagal Mengunggah", description: error.message, variant: "destructive" });
    }
  };

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      phoneNumber: user?.phoneNumber || "",
      email: user?.email || "",
      branch: user?.branch || "",
      npwp: user?.npwp || "",
      bpjs: user?.bpjs || "",
      religion: user?.religion || "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: ProfileFormValues) => {
      const formData = new FormData();
      Object.entries(values).forEach(([k, v]) => { if (v !== undefined && v !== null) formData.append(k, v); });
      
      if (uploadedUrls.profile) formData.append("photoUrl", uploadedUrls.profile);
      if (uploadedUrls.npwp) formData.append("npwpPhotoUrl", uploadedUrls.npwp);
      if (uploadedUrls.bpjs) formData.append("bpjsPhotoUrl", uploadedUrls.bpjs);
      
      // Check for pending uploads
      if (Object.values(uploadProgress).some(p => p !== undefined && p < 100)) {
        throw new Error("Mohon tunggu hingga semua foto selesai diunggah.");
      }
      const res = await fetch("/api/profile", { method: "PATCH", body: formData, credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Terjadi kesalahan" }));
        throw new Error(err.message || "Gagal memperbarui profil");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "Profil Diperbarui", description: "Data berhasil disimpan." });
      setIsEditing(false);
    },
    onError: (err: any) => {
      toast({ title: "Gagal", description: err.message, variant: "destructive" });
    },
  });

  const cancelEdit = () => {
    form.reset({
      phoneNumber: user?.phoneNumber || "",
      email: user?.email || "",
      branch: user?.branch || "",
      npwp: user?.npwp || "",
      bpjs: user?.bpjs || "",
      religion: user?.religion || "",
    });
    setPreviews({});
    setUploadProgress({});
    setUploadedUrls({});
    setIsEditing(false);
  };

  const currentPhoto = previews.profile || user?.photoUrl;

  return (
    <div className="min-h-screen bg-slate-50 pb-64">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary to-primary/80 pt-10 pb-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 right-4 w-32 h-32 rounded-full border-4 border-white" />
          <div className="absolute -bottom-8 -left-8 w-48 h-48 rounded-full border-4 border-white" />
        </div>
        <div className="max-w-lg mx-auto relative z-10">
          <h1 className="text-white text-2xl font-bold mb-1">Profil Saya</h1>
          <p className="text-white/70 text-sm">Data diri dan informasi pribadi</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-12 relative z-10 space-y-4">
        {/* Avatar Card */}
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          className="bg-white rounded-3xl shadow-xl shadow-black/5 p-6 flex items-center gap-5">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 overflow-hidden border-2 border-white shadow-lg">
              {currentPhoto ? (
                <img src={currentPhoto} alt="Foto Profil" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-primary text-3xl font-bold">
                  {user?.fullName?.charAt(0) || "?"}
                </div>
              )}
            </div>
            {isEditing && (
              <label className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center cursor-pointer shadow-md hover:bg-primary/90 transition-colors overflow-hidden">
                {uploadProgress.profile !== undefined && uploadProgress.profile < 100 ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Camera className="w-3.5 h-3.5" />
                )}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, 'profile')} disabled={uploadProgress.profile !== undefined && uploadProgress.profile < 100} />
              </label>
            )}
            {uploadProgress.profile !== undefined && uploadProgress.profile < 100 && (
              <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] flex items-center justify-center rounded-2xl">
                 <div className="w-12 h-12 relative flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-primary animate-spin absolute" />
                    <span className="text-[10px] font-bold text-primary mt-8">{uploadProgress.profile}%</span>
                 </div>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-gray-900 text-lg leading-tight truncate">{toTitleCase(user?.fullName)}</h2>
            <p className="text-sm text-gray-500">{toTitleCase(user?.position) || "Tenaga Kerja"} • {toTitleCase(user?.branch) || "-"}</p>
            <p className="text-xs text-gray-400 font-mono mt-0.5">NIK: {user?.nik || "-"}</p>
          </div>
          <Button
            variant={isEditing ? "outline" : "outline"}
            size="sm"
            onClick={isEditing ? cancelEdit : () => setIsEditing(true)}
            className="shrink-0"
          >
            {isEditing ? "Batal" : <><Pencil className="w-3.5 h-3.5 mr-1" />Edit</>}
          </Button>
        </motion.div>

        {/* Editable Fields */}
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.05 }}>
          <Card className="border-none shadow-lg shadow-black/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-gray-700">Data yang Dapat Diubah</CardTitle>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="phoneNumber" render={({ field }) => (
                        <FormItem>
                          <FormLabel>No. HP</FormLabel>
                          <FormControl><Input type="tel" placeholder="08..." {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="email" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl><Input type="email" placeholder="email@..." {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      <FormField control={form.control} name="branch" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cabang</FormLabel>
                          <FormControl><Input placeholder="contoh: Pusat" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="npwp" render={({ field }) => (
                        <FormItem>
                          <FormLabel>NPWP</FormLabel>
                          <FormControl><Input placeholder="00.000.000.0-000.000" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="bpjs" render={({ field }) => (
                        <FormItem>
                          <FormLabel>BPJS</FormLabel>
                          <FormControl><Input {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    {/* Photo Uploads for NPWP/BPJS */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <FormLabel className="text-xs">Foto NPWP (Opsional)</FormLabel>
                        <div className="relative group">
                          <div className={`h-24 w-full rounded-xl bg-slate-50 border-2 border-dashed border-slate-200 overflow-hidden flex items-center justify-center relative ${uploadProgress.npwp !== undefined && uploadProgress.npwp < 100 ? 'pointer-events-none' : ''}`}>
                            {uploadProgress.npwp !== undefined && uploadProgress.npwp < 100 ? (
                               <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center px-2">
                                  <Progress value={uploadProgress.npwp} className="h-1.5 w-full mb-1" />
                                  <span className="text-[10px] font-bold text-primary">{uploadProgress.npwp}%</span>
                               </div>
                            ) : (previews.npwp || user?.npwpPhotoUrl) ? (
                              <img src={previews.npwp || user?.npwpPhotoUrl || ""} className="w-full h-full object-cover" />
                            ) : <Camera className="w-5 h-5 text-slate-300" />}
                            <label className="absolute inset-0 cursor-pointer flex items-center justify-center bg-black/0 group-hover:bg-black/10 transition-colors">
                              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, 'npwp')} />
                            </label>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <FormLabel className="text-xs">Foto BPJS (Opsional)</FormLabel>
                        <div className="relative group">
                          <div className={`h-24 w-full rounded-xl bg-slate-50 border-2 border-dashed border-slate-200 overflow-hidden flex items-center justify-center relative ${uploadProgress.bpjs !== undefined && uploadProgress.bpjs < 100 ? 'pointer-events-none' : ''}`}>
                            {uploadProgress.bpjs !== undefined && uploadProgress.bpjs < 100 ? (
                               <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center px-2">
                                  <Progress value={uploadProgress.bpjs} className="h-1.5 w-full mb-1" />
                                  <span className="text-[10px] font-bold text-primary">{uploadProgress.bpjs}%</span>
                               </div>
                            ) : (previews.bpjs || user?.bpjsPhotoUrl) ? (
                              <img src={previews.bpjs || user?.bpjsPhotoUrl || ""} className="w-full h-full object-cover" />
                            ) : <Camera className="w-5 h-5 text-slate-300" />}
                            <label className="absolute inset-0 cursor-pointer flex items-center justify-center bg-black/0 group-hover:bg-black/10 transition-colors">
                              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, 'bpjs')} />
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>

                      <FormField control={form.control} name="religion" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Agama</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Pilih Agama" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Islam">Islam</SelectItem>
                              <SelectItem value="Kristen Protestan">Kristen Protestan</SelectItem>
                              <SelectItem value="Katolik">Katolik</SelectItem>
                              <SelectItem value="Hindu">Hindu</SelectItem>
                              <SelectItem value="Buddha">Buddha</SelectItem>
                              <SelectItem value="Khonghucu">Khonghucu</SelectItem>
                              <SelectItem value="Lainnya">Lainnya</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    <Button type="submit" className="w-full h-11 font-bold shadow-md shadow-primary/20" disabled={mutation.isPending}>
                      {mutation.isPending
                        ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Menyimpan...</>
                        : <><Check className="w-4 h-4 mr-2" />Simpan Perubahan</>}
                    </Button>
                  </form>
                </Form>
              ) : (
                <div className="space-y-0 text-sm">
                  <ReadOnlyField label="No. HP" value={user?.phoneNumber} />
                  <ReadOnlyField label="Email" value={user?.email} />
                  <ReadOnlyField label="Cabang" value={toTitleCase(user?.branch)} />
                  <ReadOnlyField label="Shift" value={toTitleCase((user as any)?.shift)} />
                  <ReadOnlyField label="NPWP" value={user?.npwp} />
                  <ReadOnlyField label="BPJS" value={user?.bpjs} />
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Admin-only fields — read-only with notice */}
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
          <Card className="border-none shadow-lg shadow-black/5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base text-gray-700">Data Pribadi & Pekerjaan</CardTitle>
                <span className="flex items-center gap-1 text-[11px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium border border-amber-100">
                  <Lock className="w-3 h-3" /> Hanya Admin
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-0 text-sm">
                <ReadOnlyField label="Nama Lengkap" value={toTitleCase(user?.fullName)} />
                <ReadOnlyField label="NIK" value={user?.nik} />
                <ReadOnlyField label="Tempat, Tgl Lahir" value={[
                  toTitleCase(user?.birthPlace), 
                  user?.birthDate ? format(new Date(user.birthDate), "d MMMM yyyy", { locale: id }) : null
                ].filter(Boolean).join(", ")} />
                <ReadOnlyField label="Jenis Kelamin" value={toTitleCase(user?.gender)} />
                <ReadOnlyField label="Agama" value={toTitleCase(user?.religion)} />
                <ReadOnlyField label="Alamat" value={formatAddress(user?.address)} />
                <ReadOnlyField label="Jabatan" value={toTitleCase(user?.position)} />
                <ReadOnlyField label="Status Tenaga Kerja" value={toTitleCase((user as any)?.employmentStatus)} />
                <ReadOnlyField label="Tahun bergabung ke elok" value={(user as any)?.joinDate} />
              </div>

              {/* Notice + Report Link */}
              <div className="mt-4 bg-amber-50 border border-amber-100 rounded-xl p-4">
                <p className="text-xs text-amber-800 leading-relaxed">
                  <span className="font-bold">Data di atas hanya dapat diubah oleh Admin/HR.</span><br />
                  Jika ada kesalahan data, silakan laporkan melalui fitur Pengaduan.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full border-amber-300 text-amber-700 hover:bg-amber-100 text-xs h-9"
                  onClick={() => setLocation("/complaint")}
                >
                  <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
                  Laporkan Kesalahan Data ke Pengaduan
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <BottomNav />
    </div>
  );
}
