import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Database, Download, Upload, Loader2, Calendar, FileText, AlertTriangle, Play, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";

interface BackupFile {
  fileName: string;
  sizeBytes: number;
  createdAt: string;
}

export default function BackupPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch Backups list
  const { data: backups, isLoading, refetch } = useQuery<BackupFile[]>({
    queryKey: ["/api/admin/backups"],
  });

  // Backup Mutation
  const backupMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/backup", { method: "POST" });
      if (!res.ok) throw new Error("Gagal membuat backup");
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: "Backup Berhasil", description: data.message });
        refetch();
        // Trigger file download
        window.location.href = `/api/admin/backups/download/${data.fileName}`;
      } else {
        toast({ title: "Gagal Backup", description: data.message, variant: "destructive" });
      }
    },
    onError: (err: any) => {
      toast({ title: "Gagal Backup", description: err.message, variant: "destructive" });
    },
  });

  // Import Mutation
  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/backups/import", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Gagal meng-import database");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Import Berhasil", description: data.message });
      setTimeout(() => window.location.reload(), 1500);
    },
    onError: (err: any) => {
      toast({ title: "Gagal Import", description: err.message, variant: "destructive" });
    },
  });

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith(".sql")) {
        toast({ title: "Format Tidak Valid", description: "Pastikan file berformat .sql", variant: "destructive" });
        return;
      }
      if (confirm("Apakah Anda yakin ingin meng-import database ini? Data saat ini mungkin akan tertimpa.")) {
        importMutation.mutate(file);
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const dm = 2;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  return (
    <div className="space-y-6 md:p-8 p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Backup & Restore Database</h1>
          <p className="text-sm text-gray-500">Buat backup cadangan, kelola berkas .sql, dan pulihkan kondisi sistem absensi.</p>
        </div>
        <div className="flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".sql"
            onChange={handleFileChange}
          />
          <Button
            variant="outline"
            className="border-orange-200 text-orange-700 hover:bg-orange-50 shadow-sm gap-2 rounded-xl"
            onClick={handleImportClick}
            disabled={importMutation.isPending}
          >
            {importMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Import SQL File
          </Button>
          <Button
            className="bg-primary hover:bg-primary/95 text-white gap-2 rounded-xl"
            onClick={() => backupMutation.mutate()}
            disabled={backupMutation.isPending}
          >
            {backupMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
            Backup Sekarang
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Warning Alert Card */}
        <Card className="border-red-100 bg-red-50/50 rounded-2xl lg:col-span-3">
          <CardContent className="p-4 flex gap-3 items-start">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-bold text-red-800 text-sm">Peringatan Penting Restore/Import!</h4>
              <p className="text-xs text-red-700 leading-relaxed">
                Melakukan restore atau meng-import database (.sql) akan menimpa seluruh kondisi data saat ini (termasuk tenaga kerja, data absensi, dan pengaturan sistem). Harap lakukan backup sebelum melakukan restore.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Backups History Table */}
        <Card className="border-none shadow-sm rounded-2xl bg-white lg:col-span-3">
          <CardHeader className="border-b border-slate-50 py-4 px-6 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-slate-700 uppercase tracking-wider">Riwayat Backup SQL</CardTitle>
              <CardDescription className="text-xs text-gray-400 mt-1">Berkas cadangan otomatis (setiap jam 00.00) dan manual tersimpan di server.</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={() => refetch()} className="text-gray-500 rounded-xl hover:bg-gray-50">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/60">
                  <TableRow>
                    <TableHead className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Nama File</TableHead>
                    <TableHead className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Ukuran File</TableHead>
                    <TableHead className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Tanggal Dibuat</TableHead>
                    <TableHead className="px-6 py-3 text-xs font-bold text-gray-500 uppercase text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-gray-500">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                        <span className="text-xs mt-2 block">Memuat riwayat backup...</span>
                      </TableCell>
                    </TableRow>
                  ) : backups?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-gray-500 text-xs">
                        Tidak ada riwayat berkas SQL backup ditemukan.
                      </TableCell>
                    </TableRow>
                  ) : (
                    backups?.map((b) => (
                      <TableRow key={b.fileName} className="hover:bg-slate-50/50">
                        <TableCell className="px-6 py-4 font-mono text-xs text-slate-700 font-bold">
                          {b.fileName}
                        </TableCell>
                        <TableCell className="px-6 py-4 text-xs text-slate-600">
                          {formatBytes(b.sizeBytes)}
                        </TableCell>
                        <TableCell className="px-6 py-4 text-xs text-slate-600">
                          {format(new Date(b.createdAt), "d MMMM yyyy, HH:mm", { locale: id })}
                        </TableCell>
                        <TableCell className="px-6 py-4 text-right flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs rounded-xl border-slate-200 text-slate-700 shadow-sm gap-1 hover:bg-slate-50"
                            onClick={() => window.location.href = `/api/admin/backups/download/${b.fileName}`}
                          >
                            <Download className="w-3.5 h-3.5" />
                            Unduh
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
