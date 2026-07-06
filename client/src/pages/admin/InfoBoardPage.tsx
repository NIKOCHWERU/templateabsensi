import { useQuery, useMutation } from "@tanstack/react-query";
import { Announcement } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import {
    ArrowLeft,
    Plus,
    Trash2,
    Pencil,
    Calendar,
    Image as ImageIcon,
    Loader2,
    MessageSquare
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { format } from "date-fns";
import { id } from "date-fns/locale";

// Schema for form since we handle file upload manually
const formSchema = z.object({
    title: z.string().min(1, "Judul wajib diisi"),
    content: z.string().min(1, "Konten wajib diisi"),
    expiresAt: z.string().optional(), // Date string from input type="date"
});

export default function InfoBoardPage() {
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const [open, setOpen] = useState(false);
    const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
    const [selectedImage, setSelectedImage] = useState<File | null>(null);

    const { data: announcements, isLoading } = useQuery<Announcement[]>({
        queryKey: ["/api/announcements"],
        refetchInterval: 5000,
    });

    const { data: complaintsStats } = useQuery<{ pendingCount: number }>({
        queryKey: ["/api/admin/complaints/stats"],
        refetchInterval: 5000,
    });

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            title: "",
            content: "",
            expiresAt: "",
        }
    });

    const createMutation = useMutation({
        mutationFn: async (values: z.infer<typeof formSchema>) => {
            const formData = new FormData();
            formData.append("title", values.title);
            formData.append("content", values.content);
            if (values.expiresAt) {
                formData.append("expiresAt", values.expiresAt);
            }
            if (selectedImage) {
                formData.append("image", selectedImage);
            }

            const res = await fetch("/api/announcements", {
                method: "POST",
                body: formData,
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || "Gagal membuat pengumuman");
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
            toast({ title: "Berhasil", description: "Pengumuman berhasil dibuat" });
            setOpen(false);
            form.reset();
            setSelectedImage(null);
        },
        onError: (err: any) => {
            toast({ title: "Gagal", description: err.message, variant: "destructive" });
        }
    });

    const updateMutation = useMutation({
        mutationFn: async (values: z.infer<typeof formSchema>) => {
            if (!editingAnnouncement) return;

            const formData = new FormData();
            formData.append("title", values.title);
            formData.append("content", values.content);
            if (values.expiresAt !== undefined) {
                formData.append("expiresAt", values.expiresAt);
            }
            if (selectedImage) {
                formData.append("image", selectedImage);
            }

            const res = await fetch(`/api/announcements/${editingAnnouncement.id}`, {
                method: "PATCH",
                body: formData,
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || "Gagal memperbarui pengumuman");
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
            toast({ title: "Berhasil", description: "Pengumuman berhasil diperbarui" });
            setOpen(false);
            setEditingAnnouncement(null);
            form.reset();
            setSelectedImage(null);
        },
        onError: (err: any) => {
            toast({ title: "Gagal", description: err.message, variant: "destructive" });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            await apiRequest("DELETE", `/api/announcements/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
            toast({ title: "Berhasil", description: "Pengumuman berhasil dihapus" });
        },
        onError: (err: any) => {
            toast({ title: "Gagal", description: "Gagal menghapus pengumuman", variant: "destructive" });
        }
    });

    const safeFormat = (dateInput: string | Date | null | undefined, fmt: string) => {
        if (!dateInput) return "";
        try {
            const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
            if (isNaN(date.getTime())) return "";
            return format(date, fmt, { locale: id });
        } catch (e) {
            return "";
        }
    };

    // Fullscreen Image State
    const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

    const handleOpenEdit = (ann: Announcement) => {
        setEditingAnnouncement(ann);
        form.reset({
            title: ann.title,
            content: ann.content,
            expiresAt: ann.expiresAt ? format(new Date(ann.expiresAt), "yyyy-MM-dd") : "",
        });
        setOpen(true);
    };

    const handleCloseModal = (isOpen: boolean) => {
        setOpen(isOpen);
        if (!isOpen) {
            setEditingAnnouncement(null);
            form.reset({
                title: "",
                content: "",
                expiresAt: "",
            });
            setSelectedImage(null);
        }
    };

    // Event listener for opening images inline
    useState(() => {
        const handleOpenImage = (e: any) => setFullscreenImage(e.detail);
        window.addEventListener('open-image', handleOpenImage);
        return () => window.removeEventListener('open-image', handleOpenImage);
    });

    return (
        <div className="space-y-6">
            <Dialog open={!!fullscreenImage} onOpenChange={(open) => !open && setFullscreenImage(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] p-1 bg-transparent border-none shadow-none flex items-center justify-center">
                    <DialogTitle className="sr-only">Lihat Gambar</DialogTitle>
                    <DialogDescription className="sr-only">Tampilan penuh gambar pengumuman</DialogDescription>
                    {fullscreenImage && (
                        <img
                            src={fullscreenImage}
                            alt="Full Size"
                            className="w-auto h-auto max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
                        />
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={open} onOpenChange={handleCloseModal}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-gray-800">
                            {editingAnnouncement ? "Edit Informasi" : "Tambah Informasi Baru"}
                        </DialogTitle>
                        <DialogDescription className="text-sm text-gray-500">
                            Isi formulir di bawah ini untuk menerbitkan pengumuman di papan informasi karyawan.
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit((v) => editingAnnouncement ? updateMutation.mutate(v) : createMutation.mutate(v))} className="space-y-4">
                            <FormField
                                control={form.control}
                                name="title"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="font-bold text-gray-700">Judul Informasi</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Masukkan judul pengumuman..." {...field} className="rounded-xl" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="content"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="font-bold text-gray-700">Konten / Isi Informasi</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="Tulis informasi pengumuman di sini..."
                                                className="min-h-[180px] rounded-xl font-medium border border-gray-200"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="expiresAt"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="font-bold text-gray-700">Tanggal Berakhir (Opsional)</FormLabel>
                                            <FormControl>
                                                <Input type="date" {...field} className="rounded-xl" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormItem>
                                    <FormLabel className="font-bold text-gray-700">Gambar Pendukung (Opsional)</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => setSelectedImage(e.target.files?.[0] || null)}
                                            className="rounded-xl cursor-pointer"
                                        />
                                    </FormControl>
                                </FormItem>
                            </div>
                            <div className="flex justify-end gap-2 pt-4">
                                <Button type="button" variant="outline" onClick={() => handleCloseModal(false)} className="rounded-xl">
                                    Batal
                                </Button>
                                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="bg-primary hover:bg-primary/95 text-white rounded-xl font-bold px-6">
                                    {createMutation.isPending || updateMutation.isPending ? (
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                    ) : null}
                                    {editingAnnouncement ? "Simpan Perubahan" : "Terbitkan Informasi"}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
            

            <div className="space-y-6">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight">Papan Informasi</h1>
                    <p className="text-sm text-gray-500">Publikasikan pengumuman penting, memo perusahaan, dan kebijakan baru.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                                        <Button className="bg-primary hover:bg-primary/90 text-white rounded-lg gap-2 shadow-sm" onClick={() => setOpen(true)}>
                        <Plus className="w-4 h-4" />
                        Tambah Informasi
                    </Button>
                </div>
            </div>

            <div className="space-y-6">
                {isLoading && (!announcements || announcements.length === 0) ? (
                    <div className="flex justify-center p-10"><Loader2 className="animate-spin text-primary" /></div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {announcements?.map((item) => (
                            <div key={item.id} className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 flex flex-col hover:shadow-lg transition-all group">
                                {item.imageUrl && (
                                    <div className="relative h-48 overflow-hidden group/image">
                                        <div
                                            className="w-full h-full cursor-pointer"
                                            onClick={() => {
                                                // We can use a simple window/modal state for full size image
                                                // Creating a quick inline dialog state handler 
                                                const event = new CustomEvent('open-image', { detail: item.imageUrl });
                                                window.dispatchEvent(event);
                                            }}
                                        >
                                            <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                            <div className="absolute inset-0 bg-black/0 group-hover/image:bg-black/20 transition-colors flex items-center justify-center">
                                                <ImageIcon className="text-white opacity-0 group-hover/image:opacity-100 w-8 h-8 drop-shadow-md transition-opacity" />
                                            </div>
                                        </div>
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-transparent pointer-events-none" />
                                        <h3 className="absolute bottom-3 left-4 right-12 text-white font-bold text-base leading-tight drop-shadow-lg line-clamp-2 pointer-events-none">{item.title}</h3>
                                        <div className="absolute top-2 right-2 flex gap-1 z-10">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-white bg-black/30 hover:bg-orange-500 hover:text-white rounded-full"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleOpenEdit(item);
                                                }}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-white bg-black/30 hover:bg-red-500 hover:text-white rounded-full"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (confirm("Hapus pengumuman ini?")) {
                                                        deleteMutation.mutate(item.id);
                                                    }
                                                }}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                )}
                                <div className="p-4 flex-1 flex flex-col">
                                    {!item.imageUrl && (
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="font-bold text-gray-800 text-base line-clamp-2">{item.title}</h3>
                                            <div className="flex gap-1 -mr-2 -mt-1 shrink-0">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-orange-500 hover:bg-orange-50"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleOpenEdit(item);
                                                    }}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-red-500 hover:bg-red-50"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (confirm("Hapus pengumuman ini?")) {
                                                            deleteMutation.mutate(item.id);
                                                        }
                                                    }}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2 text-[10px] text-gray-400 mb-3">
                                        <Calendar className="h-3 w-3" />
                                        {safeFormat(item.createdAt, "d MMM yyyy")}
                                        {item.expiresAt && (
                                            <span className="text-primary font-medium bg-primary/5 px-2 py-0.5 rounded-full">
                                                s/d {safeFormat(item.expiresAt, "d MMM yyyy")}
                                            </span>
                                        )}
                                    </div>
                                    <div className="ql-snow">
                                        <div 
                                            className="ql-editor !p-0 text-sm text-gray-600 line-clamp-3 leading-relaxed flex-1 overflow-hidden prose prose-sm max-w-none prose-p:my-2 prose-headings:my-4 prose-ul:my-2 prose-ol:my-2 prose-p:leading-relaxed"
                                            dangerouslySetInnerHTML={{ __html: item.content }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                        {announcements?.length === 0 && (
                            <div className="col-span-full text-center py-12 text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
                                <ImageIcon className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                                Belum ada pengumuman aktif.
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
        </div>
    );
}
