import { useQuery, useMutation } from "@tanstack/react-query";
import { User } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Check, X, Eye, User as UserIcon, Calendar, MapPin, Phone, Mail, CreditCard, Building, Briefcase, ImageIcon, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toTitleCase, formatAddress } from "@/lib/utils";

export default function AdminVerificationPage() {
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [sortField, setSortField] = useState<string>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const { data: employees, isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/unverified-employees"],
  });

  const filteredEmployees = [...(employees || [])].sort((a, b) => {
    let valA: any, valB: any;
    if (sortField === 'name') {
      valA = a.fullName.toLowerCase();
      valB = b.fullName.toLowerCase();
    } else {
      valA = a.id;
      valB = b.id;
    }
    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const verifyMutation = useMutation({
    mutationFn: async ({ userId, status }: { userId: number; status: 'approved' | 'rejected' }) => {
      const action = status === 'approved' ? 'approve' : 'reject';
      const res = await apiRequest("POST", `/api/admin/verify-employee/${userId}`, { action });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/unverified-employees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Berhasil", description: "Status verifikasi tenaga kerja telah diperbarui." });
      setSelectedUser(null);
    },
    onError: (err: any) => {
      toast({ title: "Gagal", description: err.message, variant: "destructive" });
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error("Gagal menghapus pendaftaran tenaga kerja");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/unverified-employees"] });
      toast({ title: "Berhasil", description: "Pendaftaran tenaga kerja telah dihapus secara permanen." });
    },
    onError: (err: any) => {
      toast({ title: "Gagal", description: err.message, variant: "destructive" });
    }
  });

  const handleDeleteUser = (userId: number) => {
    if (confirm("Apakah Anda yakin ingin menghapus pendaftaran tenaga kerja ini secara permanen dari sistem?")) {
      deleteUserMutation.mutate(userId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Verifikasi Tenaga Kerja</h1>
          <p className="text-muted-foreground">Tinjau dan setujui pendaftaran tenaga kerja baru.</p>
        </div>
        <div className="flex gap-2">
            <Button 
                variant={sortField === 'id' ? "default" : "outline"} 
                size="sm" 
                onClick={() => toggleSort('id')}
                className="text-xs h-8"
            >
                Urutkan: Terbaru {sortField === 'id' && (sortOrder === 'asc' ? '↑' : '↓')}
            </Button>
            <Button 
                variant={sortField === 'name' ? "default" : "outline"} 
                size="sm" 
                onClick={() => toggleSort('name')}
                className="text-xs h-8"
            >
                Berdasarkan Nama {sortField === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
            </Button>
        </div>
      </div>

      {!filteredEmployees || filteredEmployees.length === 0 ? (
        <Card className="border-dashed flex flex-col items-center justify-center p-12 text-center">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-300">
            <UserIcon className="w-8 h-8" />
          </div>
          <CardTitle className="text-slate-400">Tidak Ada Antrean Verifikasi</CardTitle>
          <CardDescription>Semua pendaftaran telah diproses.</CardDescription>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
          {filteredEmployees.map((emp) => (
            <Card key={emp.id} className="overflow-hidden hover:shadow-lg transition-shadow border-none shadow-md">
              <CardHeader className="bg-slate-50/50 pb-4">
                <div className="flex gap-4 items-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                    {emp.photoUrl ? (
                      <img src={emp.photoUrl} className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon className="w-6 h-6 text-primary" />
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{toTitleCase(emp.fullName)}</CardTitle>
                    <CardDescription>{emp.nik || "Tanpa NIK"}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center text-sm text-slate-600 gap-2">
                   <Badge variant={emp.registrationStatus === 'rejected' ? 'destructive' : 'secondary'} className="uppercase text-[10px]">
                     {emp.registrationStatus}
                   </Badge>
                   <span className="text-xs text-slate-400">• {toTitleCase((emp as any).position) || 'Staff'}</span>
                </div>
                <div className="flex items-center text-sm gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span>Daftar: {new Date((emp as any).createdAt || Date.now()).toLocaleDateString('id-ID')}</span>
                </div>
              </CardContent>
              <CardFooter className="bg-slate-50/30 p-4 border-t border-slate-100 flex gap-2">
                <Button variant="outline" className="flex-1 h-9" onClick={() => setSelectedUser(emp)}>
                  <Eye className="w-4 h-4 mr-2" /> Detail
                </Button>
                <Button 
                  className="bg-primary hover:bg-primary/90 h-9" 
                  onClick={() => verifyMutation.mutate({ userId: emp.id, status: 'approved' })}
                  disabled={verifyMutation.isPending}
                >
                  <Check className="w-4 h-4" />
                </Button>
                {emp.registrationStatus !== 'rejected' && (
                  <Button 
                    variant="destructive" 
                    className="h-9" 
                    onClick={() => verifyMutation.mutate({ userId: emp.id, status: 'rejected' })}
                    disabled={verifyMutation.isPending}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
                <Button 
                  variant="outline"
                  className="h-9 border-red-100 hover:bg-red-50 text-red-600" 
                  onClick={() => handleDeleteUser(emp.id)}
                  disabled={deleteUserMutation.isPending}
                  title="Hapus Pendaftaran (Permanen)"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedUser && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">Detail Pendaftaran: {toTitleCase(selectedUser.fullName)}</DialogTitle>
                <DialogDescription>Tinjau kelengkapan data sebelum melakukan verifikasi.</DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 my-6">
                <div className="space-y-6">
                  <Section title="Data Pribadi" icon={<UserIcon className="w-4 h-4" />}>
                    <DataRow label="Nama Lengkap" value={toTitleCase(selectedUser.fullName)} />
                    <DataRow label="NIK" value={selectedUser.nik} />
                    <DataRow label="Tempat, Tgl Lahir" value={`${toTitleCase(selectedUser.birthPlace) || '-'}, ${selectedUser.birthDate ? format(new Date(selectedUser.birthDate), "d MMMM yyyy", { locale: id }) : '-'}`} />
                    <DataRow label="Jenis Kelamin" value={toTitleCase(selectedUser.gender)} />
                    <DataRow label="Agama" value={toTitleCase(selectedUser.religion)} />
                    <DataRow label="Alamat" value={formatAddress(selectedUser.address)} />
                  </Section>

                  <Section title="Pekerjaan" icon={<Briefcase className="w-4 h-4" />}>
                    <DataRow label="Jabatan" value={toTitleCase((selectedUser as any).position)} />
                    <DataRow label="Cabang" value={toTitleCase((selectedUser as any).branch)} />
                    <DataRow label="Tahun Bergabung Ke Perusahaan" value={(selectedUser as any).joinDate} />
                    <DataRow label="Status" value={toTitleCase((selectedUser as any).employmentStatus)} />
                  </Section>
                </div>

                <div className="space-y-6">
                  <Section title="Administrasi" icon={<CreditCard className="w-4 h-4" />}>
                    <DataRow label="NPWP" value={selectedUser.npwp} />
                    <DataRow label="BPJS" value={selectedUser.bpjs} />
                    <DataRow label="No. HP" value={selectedUser.phoneNumber} />
                    <DataRow label="Email" value={selectedUser.email} />
                  </Section>

                  <Section title="Dokumen Upload" icon={<ImageIcon className="w-4 h-4" />}>
                     <div className="grid grid-cols-2 gap-4">
                        <DocumentBox label="Foto Profil" url={selectedUser.photoUrl} />
                        <DocumentBox label="KTP" url={selectedUser.ktpPhotoUrl} isDrive />
                        <DocumentBox label="BPJS" url={selectedUser.bpjsPhotoUrl} isDrive />
                        <DocumentBox label="NPWP" url={selectedUser.npwpPhotoUrl} isDrive />
                     </div>
                  </Section>
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setSelectedUser(null)}>Tutup</Button>
                <Button 
                  variant="destructive" 
                  onClick={() => verifyMutation.mutate({ userId: selectedUser.id, status: 'rejected' })}
                  disabled={verifyMutation.isPending}
                >
                  <X className="w-4 h-4 mr-2" /> Tolak
                </Button>
                <Button 
                  className="bg-primary hover:bg-primary/90" 
                  onClick={() => verifyMutation.mutate({ userId: selectedUser.id, status: 'approved' })}
                  disabled={verifyMutation.isPending}
                >
                  <Check className="w-4 h-4 mr-2" /> Setujui Data
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({ title, icon, children }: any) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-wider">
        {icon}
        {title}
      </div>
      <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-100 space-y-2.5">
        {children}
      </div>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col sm:flex-row sm:justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900">{value || '-'}</span>
    </div>
  );
}

function DocumentBox({ label, url, isDrive }: { label: string; url?: string | null; isDrive?: boolean }) {
  // Extract ID if it's a Drive URL
  const getImageUrl = (url: string) => {
    if (!url) return "";
    if (url.startsWith("/uploads") || url.startsWith("/api/")) return url;
    if (url.startsWith("http")) {
       // If it's a drive URL, extract ID or use proxy
       const id = url.includes('/d/') ? url.split('/d/')[1].split('/')[0] : url;
       return `/api/images/${id}`;
    }
    return `/api/images/${url}`; // Assume it's an ID
  };

  const isLocal = url?.startsWith('/uploads');
  const displayUrl = url ? getImageUrl(url) : null;
  const openUrl = url && (url.startsWith('http') || isLocal) 
    ? url 
    : (url ? `https://drive.google.com/file/d/${url}/view` : undefined);

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-tight text-slate-400">{label}</p>
      <div className="h-32 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 group relative">
        {url ? (
          <>
            <img 
              src={displayUrl || ""} 
              className="w-full h-full object-cover transition-transform group-hover:scale-110" 
              onError={(e) => {
                // If image fails to load (e.g. proxy error), show an icon
                (e.target as any).style.display = 'none';
                (e.target as any).nextSibling.style.display = 'flex';
              }}
            />
            <div className={`hidden absolute inset-0 items-center justify-center bg-slate-50 ${isDrive ? 'flex' : ''}`}>
               <ImageIcon className="w-8 h-8 text-primary/40" />
            </div>
            <div 
              className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity cursor-pointer text-white"
              onClick={() => window.open(openUrl || displayUrl || "", '_blank')}
            >
              <Eye className="w-5 h-5 mb-1" />
              <span className="text-[10px] font-bold uppercase tracking-widest bg-white/20 px-2 py-0.5 rounded-full">
                Buka File
              </span>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-400 text-xs">Kosong</div>
        )}
      </div>
    </div>
  );
}
