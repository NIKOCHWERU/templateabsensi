import { useQuery, useMutation } from "@tanstack/react-query";
import { User } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserCog, Plus, Pencil, Trash2, ShieldCheck, Loader2 } from "lucide-react";
import { toTitleCase } from "@/lib/utils";

const adminFormSchema = z.object({
  fullName: z.string().min(2, "Nama minimal 2 karakter"),
  username: z.string().min(3, "Username minimal 3 karakter"),
  password: z.string().optional(),
  role: z.enum(["admin", "superadmin"]),
});

type AdminFormValues = z.infer<typeof adminFormSchema>;

export default function AdminManageAdminsPage() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [selectedAdmin, setSelectedAdmin] = useState<User | null>(null);
  const [sortField, setSortField] = useState<string>('fullName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [open, setOpen] = useState(false);

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const { data: allUsers = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    refetchInterval: 10000,
  });

  const admins = allUsers
    .filter((u) => u.role === "admin" || u.role === "superadmin")
    .sort((a, b) => {
      let valA: any = (a as any)[sortField] || '';
      let valB: any = (b as any)[sortField] || '';
      
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

  const form = useForm<AdminFormValues>({
    resolver: zodResolver(adminFormSchema),
    defaultValues: { fullName: "", username: "", password: "", role: "admin" },
  });

  const openAdd = () => {
    setSelectedAdmin(null);
    form.reset({ fullName: "", username: "", password: "", role: "admin" });
    setOpen(true);
  };

  const openEdit = (admin: User) => {
    setSelectedAdmin(admin);
    form.reset({ fullName: admin.fullName, username: admin.username || "", password: "", role: (admin.role as any) || "admin" });
    setOpen(true);
  };

  const upsertMutation = useMutation({
    mutationFn: async (values: AdminFormValues) => {
      const payload: any = {
        fullName: values.fullName,
        username: values.username,
        role: values.role,
        isAdmin: true,
      };
      if (values.password && values.password.length > 0) {
        payload.password = values.password;
      }

      const formData = new FormData();
      Object.entries(payload).forEach(([k, v]) => formData.append(k, String(v)));

      const url = selectedAdmin
        ? `/api/admin/users/${selectedAdmin.id}`
        : "/api/admin/users";
      const method = selectedAdmin ? "PATCH" : "POST";

      const res = await fetch(url, { method, body: formData, credentials: "include" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Gagal menyimpan");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Berhasil",
        description: selectedAdmin ? "Data admin diperbarui." : "Admin baru ditambahkan.",
      });
      setOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Gagal", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Berhasil", description: "Admin dihapus." });
    },
    onError: (err: any) => {
      toast({ title: "Gagal", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <UserCog className="w-6 h-6 text-blue-600" />
            Kelola Admin
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Tambah, edit, atau hapus akun administrator sistem.
          </p>
        </div>
        <Button
          onClick={openAdd}
          className="bg-blue-600 hover:bg-blue-700 text-white shadow-md"
        >
          <Plus className="w-4 h-4 mr-2" /> Tambah Admin
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : admins.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <ShieldCheck className="w-12 h-12 text-gray-300 mb-4" />
            <p className="text-gray-400 font-medium">Belum ada akun admin.</p>
            <p className="text-xs text-gray-400 mt-1">Klik "Tambah Admin" untuk membuat akun administrator baru.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-5 py-3 text-left">No</th>
                <th className="px-5 py-3 text-left cursor-pointer hover:text-blue-600 transition-colors" onClick={() => toggleSort('fullName')}>
                    Nama {sortField === 'fullName' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-5 py-3 text-left cursor-pointer hover:text-blue-600 transition-colors" onClick={() => toggleSort('username')}>
                    Username {sortField === 'username' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-5 py-3 text-left cursor-pointer hover:text-blue-600 transition-colors" onClick={() => toggleSort('role')}>
                    Role {sortField === 'role' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-5 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((admin, index) => (
                <tr
                  key={admin.id}
                  className="border-t border-gray-50 hover:bg-blue-50/30 transition-colors"
                >
                  <td className="px-5 py-3 text-gray-400">{index + 1}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                        {admin.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{toTitleCase(admin.fullName)}</p>
                        {admin.id === currentUser?.id && (
                          <span className="text-[10px] text-blue-600 font-semibold bg-blue-50 px-1.5 py-0.5 rounded">
                            Anda
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 font-mono text-gray-600">{admin.username}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${admin.role === 'superadmin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                      <ShieldCheck className="w-3 h-3" /> {admin.role === 'superadmin' ? 'Super Admin' : 'Admin'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(admin)}
                        className="text-amber-600 border-amber-200 hover:bg-amber-50"
                      >
                        <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={admin.id === currentUser?.id}
                            className="text-red-600 border-red-200 hover:bg-red-50 disabled:opacity-40"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1" /> Hapus
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Hapus Admin?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Akun admin <strong>{admin.fullName}</strong> akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(admin.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Ya, Hapus
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedAdmin ? "Edit Admin" : "Tambah Admin Baru"}</DialogTitle>
            <DialogDescription>
              {selectedAdmin
                ? "Perbarui data akun administrator. Kosongkan kolom password jika tidak ingin menggantinya."
                : "Buat akun administrator baru. Admin dapat mengakses semua fitur manajemen."}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => upsertMutation.mutate(v))} className="space-y-4 pt-2">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama Lengkap</FormLabel>
                    <FormControl>
                      <Input placeholder="contoh: Budi Santoso" {...field} />
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
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input placeholder="contoh: budi.admin" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Peran / Jabatan</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih Peran" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="admin">Admin Biasa</SelectItem>
                        <SelectItem value="superadmin">Super Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Password{" "}
                      {selectedAdmin && (
                        <span className="text-xs text-gray-400 font-normal">(kosongkan jika tidak ganti)</span>
                      )}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder={selectedAdmin ? "••••••••" : "Minimal 6 karakter"}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setOpen(false)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={upsertMutation.isPending}
                >
                  {upsertMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Menyimpan...</>
                  ) : (
                    selectedAdmin ? "Simpan Perubahan" : "Buat Admin"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
