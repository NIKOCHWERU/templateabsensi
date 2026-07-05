import { useState } from "react";
import { useAuth } from "../../hooks/use-auth.js";
import { useToast } from "../../hooks/use-toast.js";
import {
  User, Briefcase, FileText, Camera, Upload,
  CheckCircle, ChevronLeft, ChevronRight, Check
} from "lucide-react";

const steps = [
  { id: 1, label: "Data Pribadi", icon: User },
  { id: 2, label: "Pekerjaan",    icon: Briefcase },
  { id: 3, label: "Administrasi", icon: FileText },
  { id: 4, label: "Dokumen",      icon: Camera },
];

export default function SignupPage() {
  const { registerMutation, loginMutation } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // ── DATA PRIBADI ──
  const [fullName,    setFullName]    = useState("");
  const [nik,         setNik]         = useState("");
  const [email,       setEmail]       = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [birthPlace,  setBirthPlace]  = useState("");
  const [birthDate,   setBirthDate]   = useState("");
  const [gender,      setGender]      = useState("Laki-laki");
  const [religion,    setReligion]    = useState("Islam");
  const [address,     setAddress]     = useState("");

  // ── PEKERJAAN ──
  const [position,         setPosition]         = useState("");
  const [branch,           setBranch]           = useState("");
  const [joinDate,         setJoinDate]         = useState("");
  const [employmentStatus, setEmploymentStatus] = useState("Kontrak");

  // ── ADMINISTRASI ──
  const [npwp,        setNpwp]        = useState("");
  const [bpjs,        setBpjs]        = useState("");
  const [bankAccount, setBankAccount] = useState("");

  // ── FILE & PREVIEW ──
  const [ktpFile,   setKtpFile]   = useState<File | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [bpjsFile,  setBpjsFile]  = useState<File | null>(null);
  const [npwpFile,  setNpwpFile]  = useState<File | null>(null);

  const [ktpPrev,   setKtpPrev]   = useState<string | null>(null);
  const [photoPrev, setPhotoPrev] = useState<string | null>(null);
  const [bpjsPrev,  setBpjsPrev]  = useState<string | null>(null);
  const [npwpPrev,  setNpwpPrev]  = useState<string | null>(null);

  const handleFile = (
    e: React.ChangeEvent<HTMLInputElement>,
    setFile: (f: File) => void,
    setPrev: (s: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 30 * 1024 * 1024) {
      toast({ title: "File Terlalu Besar", description: "Maksimal 30MB per foto.", variant: "destructive" });
      e.target.value = "";
      return;
    }
    setFile(file);
    setPrev(URL.createObjectURL(file));
  };

  const validateStep = () => {
    if (step === 1) {
      if (!fullName || !nik || !phoneNumber || !birthPlace || !birthDate || !address) {
        toast({ title: "Peringatan", description: "Harap lengkapi semua data pribadi.", variant: "destructive" });
        return false;
      }
    }
    if (step === 2) {
      if (!position || !branch || !joinDate) {
        toast({ title: "Peringatan", description: "Harap lengkapi data pekerjaan.", variant: "destructive" });
        return false;
      }
    }
    if (step === 3) {
      if (!bankAccount) {
        toast({ title: "Peringatan", description: "Nomor rekening bank wajib diisi.", variant: "destructive" });
        return false;
      }
    }
    if (step === 4) {
      if (!ktpFile || !photoFile) {
        toast({ title: "Dokumen Kurang", description: "Foto KTP dan Foto Profil wajib diunggah.", variant: "destructive" });
        return false;
      }
    }
    return true;
  };

  const handleNext = () => { if (validateStep()) setStep(s => s + 1); };
  const handleBack = () => setStep(s => s - 1);

  const handleSubmit = () => {
    if (!validateStep()) return;
    setLoading(true);

    const fd = new FormData();
    fd.append("username",         nik);
    fd.append("password",         nik); // no password for employee - use NIK as password
    fd.append("fullName",         fullName);
    fd.append("nik",              nik);
    fd.append("email",            email);
    fd.append("phoneNumber",      phoneNumber);
    fd.append("birthPlace",       birthPlace);
    fd.append("birthDate",        birthDate);
    fd.append("gender",           gender);
    fd.append("religion",         religion);
    fd.append("address",          address);
    fd.append("position",         position);
    fd.append("branch",           branch);
    fd.append("joinDate",         joinDate);
    fd.append("employmentStatus", employmentStatus);
    fd.append("npwp",             npwp);
    fd.append("bpjs",             bpjs);
    fd.append("bankAccount",      bankAccount);

    if (ktpFile)   fd.append("ktpPhoto",  ktpFile);
    if (photoFile) fd.append("photo",     photoFile);
    if (bpjsFile)  fd.append("bpjsPhoto", bpjsFile);
    if (npwpFile)  fd.append("npwpPhoto", npwpFile);

    registerMutation.mutate(fd, {
      onError: (err: any) => {
        setLoading(false);
        toast({ title: "Pendaftaran Gagal", description: err.message || "Periksa kembali data Anda.", variant: "destructive" });
      },
      onSuccess: () => {
        toast({ title: "Pendaftaran Berhasil!", description: "Data sedang diverifikasi oleh HRD.", variant: "success" });
        loginMutation.mutate({ username: nik, password: nik }, { onSettled: () => setLoading(false) });
      },
    });
  };

  const inputCls = "w-full text-sm p-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all";
  const labelCls = "block text-xs font-semibold text-slate-600 mb-1";
  const sectionCls = "space-y-4";

  const UploadBox = ({
    id, label, preview, required,
    onFile
  }: { id: string; label: string; preview: string | null; required?: boolean; onFile: (e: React.ChangeEvent<HTMLInputElement>) => void }) => (
    <div className="space-y-1.5">
      <span className={labelCls}>{label}{required && <span className="text-red-500 ml-0.5">*</span>}</span>
      <label
        htmlFor={id}
        className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer bg-slate-50 hover:bg-orange-50 hover:border-primary transition-all overflow-hidden group"
      >
        {preview ? (
          <img src={preview} className="w-full h-full object-cover" alt={label} />
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-400 group-hover:text-primary transition-colors">
            <Upload className="w-7 h-7" />
            <span className="text-[11px] font-medium">Klik untuk unggah</span>
            <span className="text-[10px] text-slate-300">Maks. 30MB</span>
          </div>
        )}
        <input id={id} type="file" accept="image/*" className="hidden" onChange={onFile} />
      </label>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg shadow-orange-500/25 mx-auto mb-4">
            <FileText className="w-7 h-7" />
          </div>
          <h1 className="font-heading font-black text-2xl text-slate-800">Pendaftaran Tenaga Kerja</h1>
          <p className="text-sm text-slate-500 mt-1">Lengkapi data diri Anda untuk keperluan administrasi HR</p>
        </div>

        {/* Step Tracker */}
        <div className="relative flex justify-between items-start mb-8 px-4">
          <div className="absolute top-4 left-10 right-10 h-0.5 bg-slate-200 z-0">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${((step - 1) / (steps.length - 1)) * 100}%` }}
            />
          </div>
          {steps.map(s => {
            const Icon = s.icon;
            const done = step > s.id;
            const active = step === s.id;
            return (
              <div key={s.id} className="flex flex-col items-center gap-2 z-10">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                  done   ? "bg-primary border-primary text-white shadow-md shadow-primary/30" :
                  active ? "bg-white border-primary text-primary shadow-md" :
                           "bg-white border-slate-200 text-slate-400"
                }`}>
                  {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wide ${active || done ? "text-primary" : "text-slate-400"}`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Card */}
        <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/60 border border-slate-100 overflow-hidden">
          <div className="p-6 sm:p-8 min-h-[420px]">

            {/* Step 1: Data Pribadi */}
            {step === 1 && (
              <div className={sectionCls}>
                <h2 className="font-heading font-bold text-lg text-slate-800 pb-2 border-b border-orange-50">Biodata Pribadi</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Nama Lengkap (Sesuai KTP) <span className="text-red-500">*</span></label>
                    <input className={inputCls} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Masukkan nama lengkap" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>NIK / Nomor Tenaga Kerja <span className="text-red-500">*</span></label>
                    <input className={inputCls} value={nik} onChange={e => setNik(e.target.value)} placeholder="Nomor Induk Tenaga Kerja (digunakan untuk login)" />
                  </div>
                  <div>
                    <label className={labelCls}>Jenis Kelamin</label>
                    <select className={inputCls} value={gender} onChange={e => setGender(e.target.value)}>
                      <option>Laki-laki</option>
                      <option>Perempuan</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Agama</label>
                    <select className={inputCls} value={religion} onChange={e => setReligion(e.target.value)}>
                      <option>Islam</option>
                      <option>Kristen Protestan</option>
                      <option>Katolik</option>
                      <option>Hindu</option>
                      <option>Buddha</option>
                      <option>Khonghucu</option>
                      <option>Lainnya</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Tempat Lahir <span className="text-red-500">*</span></label>
                    <input className={inputCls} value={birthPlace} onChange={e => setBirthPlace(e.target.value)} placeholder="Kota kelahiran" />
                  </div>
                  <div>
                    <label className={labelCls}>Tanggal Lahir <span className="text-red-500">*</span></label>
                    <input type="date" className={inputCls} value={birthDate} onChange={e => setBirthDate(e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>No. HP / WhatsApp <span className="text-red-500">*</span></label>
                    <input className={inputCls} value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="08xxxxxxxxxx" />
                  </div>
                  <div>
                    <label className={labelCls}>Email Aktif</label>
                    <input type="email" className={inputCls} value={email} onChange={e => setEmail(e.target.value)} placeholder="nama@email.com" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Alamat Lengkap (Sesuai KTP) <span className="text-red-500">*</span></label>
                    <textarea rows={3} className={`${inputCls} resize-none`} value={address} onChange={e => setAddress(e.target.value)} placeholder="Jalan, RT/RW, Kelurahan, Kecamatan, Kota, Provinsi" />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Pekerjaan */}
            {step === 2 && (
              <div className={sectionCls}>
                <h2 className="font-heading font-bold text-lg text-slate-800 pb-2 border-b border-orange-50">Informasi Pekerjaan</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Jabatan / Posisi <span className="text-red-500">*</span></label>
                    <input className={inputCls} value={position} onChange={e => setPosition(e.target.value)} placeholder="Contoh: Staff Admin" />
                  </div>
                  <div>
                    <label className={labelCls}>Cabang / Unit Kerja <span className="text-red-500">*</span></label>
                    <input className={inputCls} value={branch} onChange={e => setBranch(e.target.value)} placeholder="Contoh: Kantor Pusat" />
                  </div>
                  <div>
                    <label className={labelCls}>Tanggal Bergabung <span className="text-red-500">*</span></label>
                    <input type="date" className={inputCls} value={joinDate} onChange={e => setJoinDate(e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Status Kepegawaian</label>
                    <select className={inputCls} value={employmentStatus} onChange={e => setEmploymentStatus(e.target.value)}>
                      <option value="Kontrak">Kontrak</option>
                      <option value="Tetap">Tenaga Kerja Tetap</option>
                      <option value="Probation">Probation / Percobaan</option>
                      <option value="Magang">Magang</option>
                    </select>
                  </div>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mt-2">
                  <p className="text-xs text-amber-700 font-medium">
                    Catatan: Data pekerjaan akan diverifikasi oleh HR. Pastikan sesuai kontrak Anda.
                  </p>
                </div>
              </div>
            )}

            {/* Step 3: Administrasi */}
            {step === 3 && (
              <div className={sectionCls}>
                <h2 className="font-heading font-bold text-lg text-slate-800 pb-2 border-b border-orange-50">Data Administrasi</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Nomor NPWP</label>
                    <input className={inputCls} value={npwp} onChange={e => setNpwp(e.target.value)} placeholder="00.000.000.0-000.000" />
                  </div>
                  <div>
                    <label className={labelCls}>Nomor BPJS Kesehatan</label>
                    <input className={inputCls} value={bpjs} onChange={e => setBpjs(e.target.value)} placeholder="Nomor BPJS Anda" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Nomor Rekening Bank <span className="text-red-500">*</span></label>
                    <input className={inputCls} value={bankAccount} onChange={e => setBankAccount(e.target.value)} placeholder="Nomor rekening untuk pembayaran gaji" />
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Upload Dokumen */}
            {step === 4 && (
              <div className={sectionCls}>
                <h2 className="font-heading font-bold text-lg text-slate-800 pb-2 border-b border-orange-50">Upload Dokumen</h2>
                <div className="grid grid-cols-2 gap-4">
                  <UploadBox id="ktp-upload"  label="Foto KTP"       preview={ktpPrev}   required onFile={e => handleFile(e, setKtpFile,   setKtpPrev)} />
                  <UploadBox id="prof-upload" label="Foto Profil"    preview={photoPrev} required onFile={e => handleFile(e, setPhotoFile, setPhotoPrev)} />
                  <UploadBox id="bpjs-upload" label="Kartu BPJS"     preview={bpjsPrev}           onFile={e => handleFile(e, setBpjsFile,  setBpjsPrev)} />
                  <UploadBox id="npwp-upload" label="Kartu NPWP"     preview={npwpPrev}           onFile={e => handleFile(e, setNpwpFile,  setNpwpPrev)} />
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                  <p className="text-xs text-blue-700 font-medium leading-relaxed">
                    Pastikan foto KTP terbaca jelas. Foto profil menghadap ke depan dengan latar polos. Format JPG/PNG, maks 30MB.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer Navigation */}
          <div className="px-6 sm:px-8 py-5 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center gap-4">
            {step > 1 ? (
              <button
                type="button"
                onClick={handleBack}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-white font-semibold text-sm transition-all"
              >
                <ChevronLeft className="w-4 h-4" /> Kembali
              </button>
            ) : (
              <a href="/login" className="text-xs text-slate-400 hover:text-primary font-medium">
                Sudah punya akun? <span className="text-primary font-bold">Masuk</span>
              </a>
            )}

            {step < 4 ? (
              <button
                type="button"
                onClick={handleNext}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white font-bold text-sm shadow-lg shadow-orange-500/20 hover:bg-primary/90 transition-all"
              >
                Lanjut <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading || registerMutation.isPending || loginMutation.isPending}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white font-bold text-sm shadow-lg shadow-orange-500/20 hover:bg-primary/90 transition-all disabled:opacity-60"
              >
                {(loading || registerMutation.isPending || loginMutation.isPending)
                  ? "Mengirim..."
                  : <><CheckCircle className="w-4 h-4" /> Kirim Pendaftaran</>
                }
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
