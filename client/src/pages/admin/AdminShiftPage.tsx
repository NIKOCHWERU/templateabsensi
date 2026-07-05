import { useQuery, useMutation } from "@tanstack/react-query";
import { Shift, InsertShift } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, Trash2, Edit2, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertShiftSchema } from "@shared/schema";
import { toTitleCase } from "@/lib/utils";

export default function AdminShiftPage() {
  const { toast } = useToast();
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: shifts, isLoading } = useQuery<Shift[]>({
    queryKey: ["/api/shifts"],
  });

  const [sortField, setSortField] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortedShifts = [...(shifts || [])].sort((a, b) => {
    let valA: any = (a as any)[sortField] || '';
    let valB: any = (b as any)[sortField] || '';
    
    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();

    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const createMutation = useMutation({
    mutationFn: async (newShift: InsertShift) => {
      const res = await apiRequest("POST", "/api/admin/shifts", newShift);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      toast({ title: "Berhasil", description: "Shift baru telah dibuat." });
      setIsDialogOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertShift> }) => {
      const res = await apiRequest("PATCH", `/api/admin/shifts/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      toast({ title: "Berhasil", description: "Shift telah diperbarui." });
      setIsDialogOpen(false);
      setEditingShift(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/shifts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      toast({ title: "Berhasil", description: "Shift telah dihapus." });
    },
  });

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
          <h1 className="text-3xl font-bold tracking-tight">Kelola Shift</h1>
          <p className="text-muted-foreground">Atur jam masuk dan pulang untuk berbagai shift kerja.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setEditingShift(null);
        }}>
          <DialogTrigger asChild>
            <Button className="font-bold shadow-lg shadow-primary/20">
              <Plus className="w-4 h-4 mr-2" /> Tambah Shift
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingShift ? "Edit Shift" : "Buat Shift Baru"}</DialogTitle>
            </DialogHeader>
            <ShiftForm 
              initialData={editingShift} 
              onSubmit={(data: Partial<InsertShift>) => {
                if (editingShift) {
                  updateMutation.mutate({ id: editingShift.id, data });
                } else {
                  createMutation.mutate(data as InsertShift);
                }
              }} 
              isLoading={createMutation.isPending || updateMutation.isPending} 
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-none shadow-xl shadow-slate-200/50">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50">
                <TableHead className="font-bold cursor-pointer hover:text-primary" onClick={() => toggleSort('name')}>
                    <div className="flex items-center gap-1">Nama Shift {sortField === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}</div>
                </TableHead>
                <TableHead className="font-bold cursor-pointer hover:text-primary" onClick={() => toggleSort('checkInTime')}>
                    <div className="flex items-center gap-1">Jam Masuk {sortField === 'checkInTime' && (sortOrder === 'asc' ? '↑' : '↓')}</div>
                </TableHead>
                <TableHead className="font-bold cursor-pointer hover:text-primary" onClick={() => toggleSort('checkOutTime')}>
                    <div className="flex items-center gap-1">Jam Pulang {sortField === 'checkOutTime' && (sortOrder === 'asc' ? '↑' : '↓')}</div>
                </TableHead>
                <TableHead className="font-bold">Keterangan</TableHead>
                <TableHead className="text-right font-bold">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedShifts.map((shift) => (
                <TableRow key={shift.id}>
                  <TableCell className="font-medium">{toTitleCase(shift.name)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                       <Clock className="w-3 h-3 text-red-500" />
                       <span className="font-mono">{shift.checkInTime}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                       <Clock className="w-3 h-3 text-primary" />
                       <span className="font-mono">{shift.checkOutTime}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-500 text-sm max-w-xs truncate">{shift.description || '-'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        onClick={() => {
                          setEditingShift(shift);
                          setIsDialogOpen(true);
                        }}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => {
                          if (confirm(`Hapus shift ${shift.name}?`)) {
                            deleteMutation.mutate(shift.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function ShiftForm({ initialData, onSubmit, isLoading }: any) {
  const form = useForm({
    resolver: zodResolver(insertShiftSchema),
    defaultValues: initialData || {
      name: "",
      checkInTime: "07:00",
      checkOutTime: "15:00",
      description: ""
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nama Shift</FormLabel>
              <FormControl><Input placeholder="Contoh: Shift 1, Long Shift" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="checkInTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Jam Masuk (Start)</FormLabel>
                <FormControl><Input type="time" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="checkOutTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Jam Pulang (Target)</FormLabel>
                <FormControl><Input type="time" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Keterangan (Opsional)</FormLabel>
              <FormControl><Input {...field} value={field.value || ""} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <DialogFooter className="pt-4">
          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Simpan Shift
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
