import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, Check, Lock, Shield, User, Mail, Phone, Key } from "lucide-react";

const adminProfileSchema = z.object({
  fullName: z.string().min(2, "Nama lengkap minimal 2 karakter"),
  username: z.string().min(3, "Username minimal 3 karakter"),
  email: z.string().email("Email tidak valid").optional().or(z.literal("")),
  phoneNumber: z.string().optional(),
  password: z.string().optional().refine(val => !val || val.length >= 4, {
    message: "Password minimal 4 karakter jika ingin diubah"
  }),
  confirmPassword: z.string().optional()
}).refine(data => {
  if (data.password && data.password !== data.confirmPassword) {
    return false;
  }
  return true;
}, {
  message: "Konfirmasi password tidak cocok",
  path: ["confirmPassword"]
});

type AdminProfileFormValues = z.infer<typeof adminProfileSchema>;

export default function AdminProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const form = useForm<AdminProfileFormValues>({
    resolver: zodResolver(adminProfileSchema),
    defaultValues: {
      fullName: user?.fullName || "",
      username: user?.username || "",
      email: user?.email || "",
      phoneNumber: user?.phoneNumber || "",
      password: "",
      confirmPassword: ""
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: AdminProfileFormValues) => {
      const payload: any = {
        fullName: values.fullName,
        username: values.username,
        email: values.email,
        phoneNumber: values.phoneNumber,
      };

      if (values.password) {
        payload.password = values.password;
      }

      const res = await fetch("/api/admin/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Gagal menyimpan perubahan" }));
        throw new Error(err.message || "Gagal memperbarui profil");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      // update internal context cache
      queryClient.setQueryData(["/api/user"], data);
      
      form.reset({
        fullName: data.fullName || "",
        username: data.username || "",
        email: data.email || "",
        phoneNumber: data.phoneNumber || "",
        password: "",
        confirmPassword: ""
      });

      toast({
        title: "Berhasil",
        description: "Profil admin dan password telah berhasil diperbarui."
      });
    },
    onError: (err: any) => {
      toast({
        title: "Gagal",
        description: err.message,
        variant: "destructive"
      });
    },
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-1.5 border-b border-gray-100 pb-4">
        <h1 className="text-xl font-bold text-gray-800 uppercase tracking-tight">Pengaturan Profil Admin</h1>
        <p className="text-xs text-gray-500">Kelola informasi pribadi administrator dan setel ulang kata sandi keamanan.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Info Box Card */}
        <div className="space-y-6">
          <Card className="border border-gray-100 shadow-xs rounded-2xl overflow-hidden bg-white">
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 px-6 py-8 text-center text-white relative">
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-2 right-2 w-20 h-20 rounded-full border border-white" />
              </div>
              
              {/* Initials avatar circle */}
              <div className="w-20 h-20 mx-auto rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center font-black text-2xl border-2 border-white/40 shadow-md mb-3 uppercase">
                {user?.fullName ? user.fullName.charAt(0) : "A"}
              </div>
              
              <h2 className="font-bold text-lg truncate leading-tight">{user?.fullName || "Administrator"}</h2>
              <p className="text-[10px] bg-white/20 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-widest inline-block mt-2">
                {user?.role === "superadmin" ? "Super Admin" : "Admin"}
              </p>
            </div>
            
            <CardContent className="py-5 px-6 space-y-4">
              <div className="flex items-center gap-3 py-1.5 border-b border-gray-50">
                <Shield className="w-4 h-4 text-primary shrink-0" />
                <div>
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Level Hak Akses</p>
                  <p className="text-xs font-semibold text-gray-700 uppercase">{user?.role === 'superadmin' ? 'Super Administrator' : 'Administrator'}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 py-1.5 border-b border-gray-50">
                <User className="w-4 h-4 text-primary shrink-0" />
                <div>
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Username Login</p>
                  <p className="text-xs font-semibold text-gray-700">{user?.username}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 py-1.5">
                <Mail className="w-4 h-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Email Terdaftar</p>
                  <p className="text-xs font-semibold text-gray-700 truncate">{user?.email || "-"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Edit Form Card */}
        <div className="md:col-span-2">
          <Card className="border border-gray-100 shadow-xs rounded-2xl bg-white">
            <CardHeader className="border-b border-gray-50 py-4 px-6">
              <CardTitle className="text-sm font-bold text-gray-700 uppercase tracking-wider">Ubah Data Diri & Keamanan</CardTitle>
            </CardHeader>
            <CardContent className="py-6 px-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-6">
                  {/* Row 1: fullName & username */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold text-gray-500 uppercase">Nama Lengkap</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                              <Input className="pl-9 rounded-xl h-10 border-gray-200" placeholder="Masukkan nama..." {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold text-gray-500 uppercase">Username Login</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                              <Input className="pl-9 rounded-xl h-10 border-gray-200" placeholder="Masukkan username..." {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Row 2: email & phoneNumber */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold text-gray-500 uppercase">Alamat Email</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                              <Input className="pl-9 rounded-xl h-10 border-gray-200" type="email" placeholder="admin@domain.com" {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="phoneNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold text-gray-500 uppercase">Nomor Telepon</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                              <Input className="pl-9 rounded-xl h-10 border-gray-200" placeholder="08XXXXXXXXXX" {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Divider and Password Label */}
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                      <div className="w-full border-t border-gray-100" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-3 text-gray-400 font-bold tracking-wider">Ubah Sandi Keamanan</span>
                    </div>
                  </div>

                  {/* Row 3: password & confirmPassword */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold text-gray-500 uppercase">Kata Sandi Baru</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                              <Input className="pl-9 rounded-xl h-10 border-gray-200" type="password" placeholder="Kosongkan jika tidak diubah" {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold text-gray-500 uppercase">Konfirmasi Sandi Baru</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                              <Input className="pl-9 rounded-xl h-10 border-gray-200" type="password" placeholder="Kosongkan jika tidak diubah" {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="pt-4 border-t border-gray-50 flex justify-end">
                    <Button 
                      type="submit" 
                      className="bg-primary hover:bg-primary/90 text-white rounded-xl px-6 h-11 font-bold shadow-xs hover:shadow transition-all active:scale-[0.98]"
                      disabled={mutation.isPending}
                    >
                      {mutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Menyimpan...
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Simpan Profil Admin
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
