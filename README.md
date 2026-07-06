# Blueprint Sistem Informasi Absensi Karyawan PT ABC (PT ABC)

Dokumen ini berisi dokumentasi lengkap mengenai alur (*workflow*), arsitektur teknologi, struktur basis data (*database schema*), detail *business logic*, serta desain antarmuka sistem absensi digital untuk karyawan non-manajemen PT ABC (PT ABC). Dokumen ini disusun sebagai cetak biru (*blueprint*) menyeluruh agar sistem dapat dibangun kembali dari awal dengan hasil yang sama persis dan performa yang lebih optimal.

---

## 📌 DAFTAR ISI
1. [Gambaran Umum & Filosofi Desain](#1-gambaran-umum--filosofi-desain)
2. [Arsitektur & Tumpukan Teknologi (Tech Stack)](#2-arsitektur--tumpukan-teknologi-tech-stack)
3. [Skema Basis Data (Database Schema - Drizzle ORM)](#3-skema-basis-data-database-schema---drizzle-orm)
4. [Logika Bisnis Utama (Core Business Logic)](#4-logika-bisnis-utama-core-business-logic)
5. [Alur Halaman & Struktur Folder (File Mapping)](#5-alur-halaman--struktur-folder-file-mapping)
6. [Dokumentasi API Endpoints](#6-dokumentasi-api-endpoints)
7. [Fitur Cetak & Ekspor PDF Massal](#7-fitur-cetak--ekspor-pdf-massal)
8. [Setup Lingkungan & Cara Menjalankan Aplikasi](#8-setup-lingkungan--cara-menjalankan-aplikasi)

---

## 1. GAMBARAN UMUM & FILOSOFI DESAIN

Sistem Absensi PT ABC adalah aplikasi web progresif (PWA - Progressive Web App) yang dirancang khusus untuk mempermudah pencatatan kehadiran karyawan lapangan/non-manajemen dengan verifikasi visual (foto wajah) dan geolokasi (GPS).

### Prinsip Desain Antarmuka:
- **Tema Warna ("PT ABC")**: Menggunakan warna hijau segar sebagai warna utama (`--primary: HSL(122, 39%, 49%)` atau `#4CAF50`), dipadukan dengan latar belakang hangat bernuansa jingga/krem lembut (`--background: HSL(30, 50%, 98%)`) untuk memberikan kesan premium, modern, dan higienis.
- **Tipografi Modern**: Memadukan font **Outfit** (untuk judul dan elemen visual besar) serta **DM Sans** (untuk teks isi) guna mempermudah keterbacaan di perangkat mobile.
- **Efek Interaktif**: Menggunakan *glassmorphism* (panel kaca transparan dengan efek blur), bayangan halus (*soft shadows*), mikro-animasi transisi halaman (*Framer Motion*), serta efek hover interaktif pada tombol/card.
- **Responsif Seluler (Mobile-First)**: Halaman karyawan dioptimalkan penuh untuk tampilan layar ponsel cerdas (smartphone), dilengkapi dengan navigasi bawah (*bottom navigation bar*). Halaman admin dirancang berbentuk dasbor desktop fungsional bersisi navigasi samping (*sidebar*).

---

## 2. ARSITEKTUR & TUMPUKAN TEKNOLOGI (TECH STACK)

Sistem ini dibangun dengan arsitektur monolitik yang membagi porsi client-side dan server-side secara rapi:

### Frontend (Klien):
- **React.js 18** (menggunakan Vite 7 sebagai bundler utama).
- **TypeScript** untuk pengetikan statis yang aman.
- **Tailwind CSS v3** bersama dengan `tailwindcss-animate` untuk styling.
- **Radix UI** & **shadcn/ui** untuk pustaka komponen UI premium dasar (Card, Dialog, Accordion, Dropdown, Toast, dll).
- **Wouter** untuk sistem routing klien yang ringan.
- **TanStack React Query v5** untuk manajemen state server & caching data API.
- **Framer Motion** untuk efek animasi transisi halaman dan modal.

### Backend (Server API):
- **Node.js** dengan framework **Express.js**.
- **Passport.js** untuk manajemen otentikasi sesi (*Session-based authentication*).
- **express-session** dikombinasikan dengan **express-mysql-session** sebagai penyimpan sesi login di MySQL Database.
- **Drizzle ORM** sebagai Object-Relational Mapper untuk MySQL.
- **Zod** untuk validasi skema data API input/output.
- **TSX** untuk menjalankan TypeScript server secara langsung selama masa pengembangan.

### Layanan & Integrasi Pihak Ketiga:
1. **Google Drive API (v3)**: Berfungsi sebagai tempat penyimpanan berkas foto registrasi karyawan (KTP, Profil, BPJS, NPWP), serta foto bukti kehadiran (Masuk, Istirahat, Pulang, Bukti Telat). Menggunakan mekanisme otentikasi OAuth2 dengan offline *refresh token* agar akses token otomatis diperbarui.
2. **OpenStreetMap Nominatim API**: Digunakan secara client-side untuk melakukan proses *reverse geocoding* mengubah koordinat Latitude/Longitude GPS menjadi alamat lokasi nyata berformat teks.
3. **Web Push Notification API**: Menggunakan library `web-push` di backend dan *Service Worker* di frontend untuk mengirim notifikasi push langsung ke browser karyawan (menggunakan VAPID keys).
4. **html2pdf.js**: Digunakan untuk mengkonversi template HTML laporan absensi harian menjadi file PDF secara instan di sisi klien pada proses Ekspor Massal.

---

## 3. SKEMA BASIS DATA (DATABASE SCHEMA - DRIZZLE ORM)

Berikut adalah struktur tabel basis data yang didefinisikan dalam berkas `shared/schema.ts` (menggunakan MySQL Dialect):

```typescript
// 1. Users Table (Menyimpan data admin, superadmin, dan karyawan)
export const users = mysqlTable("users", {
  id: int("id").primaryKey().autoincrement(),
  email: varchar("email", { length: 255 }), 
  username: varchar("username", { length: 255 }).unique(), // NIK bagi karyawan, username bebas bagi admin
  password: varchar("password", { length: 255 }).notNull(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  role: mysqlEnum("role", ["admin", "employee", "superadmin"]).notNull().default("employee"),
  nik: varchar("nik", { length: 50 }).unique(), 
  branch: varchar("branch", { length: 100 }), // Cabang penempatan kerja
  position: varchar("position", { length: 100 }), // Jabatan karyawan
  shift: varchar("shift", { length: 50 }), // Shift aktif saat ini
  photoUrl: varchar("photo_url", { length: 512 }), // Foto profil di Google Drive
  isAdmin: boolean("is_admin").default(false),
  phoneNumber: varchar("phone_number", { length: 20 }),
  birthPlace: varchar("birth_place", { length: 100 }),
  birthDate: date("birth_date"),
  gender: mysqlEnum("gender", ["Laki-laki", "Perempuan"]),
  religion: varchar("religion", { length: 50 }),
  address: text("address"),
  npwp: varchar("npwp", { length: 50 }),
  bpjs: varchar("bpjs", { length: 50 }),
  npwpPhotoUrl: varchar("npwp_photo_url", { length: 512 }),
  bpjsPhotoUrl: varchar("bpjs_photo_url", { length: 512 }),
  bankAccount: varchar("bank_account", { length: 100 }),
  ktpPhotoUrl: varchar("ktp_photo_url", { length: 512 }),
  registrationStatus: mysqlEnum("registration_status", ["unregistered", "pending", "approved", "rejected"]).notNull().default("unregistered"),
  joinDate: varchar("join_date", { length: 50 }),
  employmentStatus: varchar("employment_status", { length: 50 }), // Kontrak, Tetap, Probation
});

// 2. Shifts Table (Kelola jam kerja)
export const shifts = mysqlTable("shifts", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 50 }).notNull(), // Shift 1, Shift 2, Kasir Long, dll.
  checkInTime: varchar("check_in_time", { length: 10 }).notNull(), // Format "HH:mm"
  checkOutTime: varchar("check_out_time", { length: 10 }).notNull(), // Format "HH:mm"
  description: text("description"),
});

// 3. Attendance Table (Data rekap absensi harian)
export const attendance = mysqlTable("attendance", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull(),
  date: date("date").notNull(), // Format YYYY-MM-DD
  checkIn: timestamp("check_in"),
  checkInPhoto: varchar("check_in_photo", { length: 255 }), // Google Drive File ID
  checkInLocation: text("check_in_location"), // Alamat teks OSM
  breakStart: timestamp("break_start"),
  breakStartPhoto: varchar("break_start_photo", { length: 255 }),
  breakStartLocation: text("break_start_location"),
  breakEnd: timestamp("break_end"),
  breakEndPhoto: varchar("break_end_photo", { length: 255 }),
  breakEndLocation: text("break_end_location"),
  checkOut: timestamp("check_out"),
  checkOutPhoto: varchar("check_out_photo", { length: 255 }),
  checkOutLocation: text("check_out_location"),
  shiftId: int("shift_id"),
  shift: varchar("shift", { length: 50 }),
  sessionNumber: int("session_number").default(1), // Jumlah sesi absensi dalam 1 hari
  status: mysqlEnum("status", ["present", "late", "sick", "permission", "cuti", "absent", "off"]).default("absent"),
  notes: text("notes"), // Digunakan untuk keperluan izin/sakit
  lateReason: text("late_reason"), // Alasan terlambat jika masuk melebihi batas jam shift
  lateReasonPhoto: varchar("late_reason_photo", { length: 255 }), // Foto bukti telat (opsional)
  permitExitAt: timestamp("permit_exit_at"), // Waktu keluar izin kantor di tengah jam kerja
  permitResumeAt: timestamp("permit_resume_at"), // Waktu kembali dari izin
  isFakeGps: boolean("is_fake_gps").default(false), // Flag pendeteksian fake GPS
}, (table) => ({
  userIdIdx: index("idx_attendance_user_id").on(table.userId),
  dateIdx: index("idx_attendance_date").on(table.date),
  userDateIdx: index("idx_attendance_user_date").on(table.userId, table.date),
}));

// 4. Leave Requests Table (Pengajuan Cuti)
export const leaveRequests = mysqlTable("leave_requests", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  selectedDates: text("selected_dates"), // String tanggal non-kontigu dipisahkan koma (ex: "2026-06-05,2026-06-08")
  reason: text("reason").notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "cancelled"]).default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

// 5. Complaints Table (Pengaduan karyawan)
export const complaints = mysqlTable("complaints", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  status: mysqlEnum("status", ["pending", "reviewed", "resolved"]).default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

// 6. Complaint Photos Table (Menyimpan banyak foto per satu pengaduan)
export const complaintPhotos = mysqlTable("complaint_photos", {
  id: int("id").primaryKey().autoincrement(),
  complaintId: int("complaint_id").notNull(),
  photoUrl: varchar("photo_url", { length: 512 }).notNull(),
  caption: text("caption"),
});

// 7. Resignations Table (Manajemen pemberhentian/resign)
export const resignations = mysqlTable("resignations", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull(),
  resignDate: date("resign_date").notNull(),
  reason: text("reason").notNull(),
  documentUrl: varchar("document_url", { length: 512 }), // Dokumen SK Resign di GDrive
  createdAt: timestamp("created_at").defaultNow(),
});

// 8. Mutations Table (Manajemen promosi, demosi, mutasi cabang)
export const mutations = mysqlTable("mutations", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull(),
  type: mysqlEnum("type", ["mutasi", "promosi", "demosi"]).notNull(),
  oldBranch: varchar("old_branch", { length: 100 }),
  newBranch: varchar("new_branch", { length: 100 }),
  oldPosition: varchar("old_position", { length: 100 }),
  newPosition: varchar("new_position", { length: 100 }),
  documentUrl: varchar("document_url", { length: 512 }), // SK Mutasi di GDrive
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// 9. Warning Letters Table (Manajemen SP)
export const warningLetters = mysqlTable("warning_letters", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull(),
  type: mysqlEnum("type", ["SP1", "SP2", "SP3"]).notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  documentUrl: varchar("document_url", { length: 512 }), // Surat SP di GDrive
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});
```

---

## 4. LOGIKA BISNIS UTAMA (CORE BUSINESS LOGIC)

Sistem absensi PT ABC memiliki beberapa logika operasional khusus untuk menyesuaikan kebutuhan lapangan:

### A. Pembagian Sesi & Batas Hari Kerja (Day Boundary 04.00 WIB)
- Pergantian hari secara administratif absensi dipatok pada pukul **04:00 AM WIB**.
- Segala bentuk absensi yang dilakukan antara pukul 00:00 (tengah malam) hingga pukul 03:59 WIB pagi akan secara otomatis dikelompokkan ke dalam **hari kerja sebelumnya (kemarin)**. Hal ini krusial untuk mencatat kehadiran karyawan yang bekerja pada shift malam hingga subuh agar tidak terbagi menjadi dua rekapitulasi hari yang berbeda.
- Karyawan diperbolehkan melakukan absensi hingga **5 sesi per hari** (ex: keluar masuk untuk tugas khusus/istirahat ganda). Tiap sesi dilacak menggunakan `sessionNumber` (1 sampai 5).

### B. Otentikasi NIK Karyawan & Bypass Password
- Karyawan melakukan login menggunakan **NIK (Nomor Induk Karyawan)** atau *username* terdaftar.
- **Keamanan Khusus**: Proses pencocokan sandi (*password*) sengaja di-bypass untuk akun dengan `role === "employee"` di tingkat Passport authentication. Karyawan hanya perlu memasukkan NIK/Username terdaftar untuk masuk.
- Akun dengan peran `admin` atau `superadmin` tetap melalui pengecekan kata sandi secara aman menggunakan enkripsi algoritma **scrypt**.

### C. Pendeteksian GPS Palsu (Fake GPS Detection)
Pendeteksian manipulasi lokasi dipicu secara client-side di browser karyawan sebelum data dikirim ke API:
1. Mengecek properti `.mocked === true` dari respon koordinat `navigator.geolocation` (didukung di beberapa browser HP).
2. Mengecek nilai akurasi koordinat (`position.coords.accuracy`). Jika akurasinya bernilai **tepat 0** atau **tepat 1**, sistem menandainya sebagai koordinat manipulasi dari aplikasi Mock GPS.
3. Status ditandai dalam variabel `isFakeGps` dan akan tersimpan di database. Di panel admin, data yang menggunakan GPS palsu akan memiliki indikator merah berkedip bertuliskan "GPS Palsu Terdeteksi".

### D. Alur Terlambat (Late Status Check)
- Keterlambatan hanya dievaluasi pada **Sesi 1** (sesi pertama masuk kerja). Sesi 2-5 selalu berstatus "present" (hadir).
- Saat melakukan masuk pertama, waktu server Jakarta (WIB) dikonversi ke menit harian (ex: jam 07:15 menjadi `7 * 60 + 15 = 435`). Angka ini dibandingkan dengan batas masuk shift (ex: Shift 1 pukul 07:00 WIB batasnya `420`).
- Jika waktu masuk melewati batas shift, browser karyawan akan menampilkan **LateReasonModal** secara paksa. Karyawan wajib menginput alasan keterlambatan secara tertulis dan melampirkan foto bukti fisik sebelum diperbolehkan menekan tombol absensi masuk.

### E. Manajemen Cuti Non-Kontigu
- Selain mendukung pengajuan cuti berurutan (rentang tanggal `startDate` s/d `endDate`), sistem mendukung pemilihan hari cuti terpisah (non-kontigu).
- Hari cuti yang terpisah ini akan disimpan ke dalam field `selectedDates` berformat string yang dipisahkan koma (ex: `2026-06-01, 2026-06-03, 2026-06-05`).

### F. Popup Notifikasi Dokumen Karyawan
- Ketika admin menerbitkan berkas mutasi, surat peringatan (SP), atau resignasi, sistem akan menampilkan popup pemberitahuan secara otomatis begitu karyawan membuka dasbor mereka.
- Popup ini hanya berlaku untuk dokumen yang terbit setelah tanggal cutoff sistem: **10 Juni 2026 pukul 11:00 WIB** (`2026-06-10T04:00:00.000Z` UTC).
- Karyawan dapat membaca detail pemberitahuan, mengunduh berkas SK/Surat terkait dari Google Drive, lalu menutup popup secara permanen (status dibaca akan disimpan di `localStorage` menggunakan ID dokumen unik).

---

## 5. ALUR HALAMAN & STRUKTUR FOLDER (FILE MAPPING)

```
├── client
│   ├── public
│   │   ├── manifest.json      # Konfigurasi PWA Pendaftaran & Ikon
│   │   └── sw.js              # Service Worker PWA (caching & penangan push notif)
│   └── src
│       ├── components
│       │   ├── layout
│       │   │   └── AdminLayout.tsx        # Bingkai halaman Admin dengan sidebar hijau
│       │   ├── ui                         # Komponen UI shadcn dasar
│       │   ├── BottomNav.tsx              # Navigasi bawah untuk aplikasi mobile karyawan
│       │   ├── CameraModal.tsx            # Modul kamera snap foto wajah (HTML5 Canvas)
│       │   ├── LateReasonModal.tsx        # Input alasan telat + bukti foto
│       │   └── InstallAppBanner.tsx       # Banner instalasi PWA ke layar HP
│       ├── hooks
│       │   ├── use-auth.tsx               # State otentikasi login/logout & data user
│       │   └── use-toast.ts               # Hook notifikasi pop-up mengambang
│       ├── lib
│       │   ├── attendance.ts              # Fungsi penghitung jam kerja & durasi istirahat
│       │   └── queryClient.ts             # Instansiasi & pemanggil API TanStack Query
│       └── pages
│           ├── LoginPage.tsx              # Halaman masuk untuk admin & karyawan
│           ├── employee
│           │   ├── DashboardPage.tsx      # Kamera absensi, kontrol sesi, popup notifikasi
│           │   ├── RegistrationPage.tsx   # Pendaftaran karyawan baru multiproses (4 langkah)
│           │   ├── LeavePage.tsx          # Formulir pengajuan cuti (kontigu & non-kontigu)
│           │   ├── RecapPage.tsx          # Tampilan riwayat kehadiran pribadi karyawan
│           │   ├── ComplaintPage.tsx      # Formulir keluhan & upload foto bukti
│           │   └── StatusPendingPage.tsx  # Informasi tunggu persetujuan registrasi
│           └── admin
│               ├── DashboardPage.tsx      # Metrik dasbor, grafik, log GPS Palsu
│               ├── EmployeeListPage.tsx   # Kelola data karyawan aktif, CRUD, ekspor excel
│               ├── AttendanceHistoryPage.tsx # Riwayat absensi bukti foto & Ekspor Foto Massal
│               ├── RecapPage.tsx          # Rekap teks kehadiran bulanan & Ekspor Teks Massal
│               ├── AttendanceSummaryPage.tsx # Ringkasan performa kerja & cetak PDF ringkasan
│               ├── AdminVerificationPage.tsx # Persetujuan pendaftaran karyawan baru (CRUD)
│               ├── AdminLeavePage.tsx     # Validasi cuti aktif, cetak formulir, & hapus
│               ├── AdminLeaveHistoryPage.tsx # Riwayat cuti lampau karyawan
│               ├── MutationManagementPage.tsx # Menerbitkan mutasi, promosi, dan demosi
│               ├── MutationHistoryPage.tsx   # Log riwayat mutasi karyawan
│               ├── WarningLetterManagementPage.tsx # Menerbitkan SP1, SP2, SP3 & cetak surat
│               └── AdminShiftPage.tsx     # Pengaturan jam masuk & keluar shift kerja
```

---

## 6. DOKUMENTASI API ENDPOINTS

### Otentikasi & Registrasi:
- `POST /api/register` : Registrasi awal akun karyawan (membuat username/password).
- `POST /api/register-data` : Mengirim berkas data administrasi lengkap + upload berkas KTP, BPJS, NPWP, dan Profil ke Google Drive (Multi-part form data).
- `POST /api/login` : Masuk sistem (Membedakan sesi login admin dan karyawan).
- `POST /api/logout` : Keluar sistem & menghapus sesi browser.
- `GET /api/user` : Mengambil data profil user yang sedang aktif.

### Alur Absensi:
- `POST /api/attendance/clock-in` : Melakukan absen masuk (Mengirim data lokasi, foto wajah, shift, dan alasan telat jika terlambat).
- `POST /api/attendance/break-start` : Mencatat waktu mulai istirahat (+ foto snapshot).
- `POST /api/attendance/break-end` : Mencatat waktu selesai istirahat (+ foto snapshot).
- `POST /api/attendance/clock-out` : Mencatat absen pulang (+ foto & koordinat GPS).
- `POST /api/attendance/permit` : Pengajuan izin keluar kantor di tengah jam kerja atau mencatat hari libur (Off Day).
- `GET /api/attendance/today` : Mengambil data sesi kehadiran aktif karyawan bersangkutan hari ini.

### Fitur Karyawan:
- `GET /api/employee/leave-requests` : Mengambil daftar cuti pribadi karyawan.
- `POST /api/employee/leave-requests` : Mengajukan cuti baru.
- `GET /api/employee/complaints` : Mengambil daftar keluhan pribadi karyawan.
- `POST /api/employee/complaints` : Mengajukan keluhan baru beserta berkas foto.
- `GET /api/employee/documents` : Mengambil dokumen SK mutasi/resign atau surat SP aktif milik karyawan untuk modal notifikasi.

### Administrasi (Khusus Admin):
- `GET /api/admin/unverified-employees` : Melihat pendaftaran karyawan baru status pending.
- `POST /api/admin/verify-employee/:id` : Menyetujui/menolak berkas pendaftaran karyawan baru.
- `GET /api/admin/employees` : Daftar seluruh karyawan aktif PT ABC.
- `DELETE /api/admin/users/:id` : Menghapus data user registrasi yang ditolak/belum terverifikasi secara permanen.
- `POST /api/admin/warning-letters` : Menerbitkan surat peringatan (SP) baru.
- `DELETE /api/admin/warning-letters/:id` : Menghapus berkas rekam SP.
- `POST /api/admin/resignations` : Mencatat karyawan keluar/PHK.
- `POST /api/admin/mutations` : Melakukan mutasi cabang, promosi, demosi karyawan.
- `POST /api/admin/shifts` : Membuat shift kerja baru.
- `PUT /api/admin/leave-requests/:id` : Memperbarui status persetujuan cuti karyawan.
- `DELETE /api/admin/leave-requests/:id` : Menghapus pengajuan cuti secara permanen.

### Proxy & Cache Media Google Drive:
- `GET /api/images/:id` : Endpoint proxy server untuk mengunduh/menampilkan foto dari Google Drive. Endpoint ini melakukan **server-side local caching** &mdash; gambar yang diunduh pertama kali akan disimpan ke dalam direktori lokal server `uploads/gdrive-cache/${cleanId}.jpg` sehingga permintaan berikutnya akan berjalan sangat cepat dan hemat kuota API Google Drive.

---

## 7. FITUR CETAK & EKSPOR PDF MASSAL

### A. Ekspor PDF Massal Harian (*Bulk Export*)
Fitur ini memfasilitasi admin untuk mengunduh rekap harian secara masal dalam rentang tanggal tertentu langsung berbentuk file PDF satu-persatu tanpa perlu mencetaknya manual:
- **Rekap Absensi Teks**: Mengunduh rekap absensi berformat `.pdf` per hari. Format nama file diatur dengan huruf kapital (*uppercase*) lengkap dengan penulisan nama bulan bahasa Indonesia kapital:
  `REKAP ABSENSI NON MANAJEMEN [D] [MONTH] - [D+1] [MONTH] [YEAR] PT ABC.pdf`
  *(Contoh: `REKAP ABSENSI NON MANAJEMEN 4 JUNI - 5 JUNI 2026 PT ABC.pdf`)*
- **Rekap Absensi Foto**: Mengunduh lembar bukti visual berformat `.pdf` per hari. Format nama file:
  `REKAP ABSENSI FOTO NON MANAJEMEN [D] [MONTH] - [D+1] [MONTH] [YEAR] PT ABC.pdf`
  *(Contoh: `REKAP ABSENSI FOTO NON MANAJEMEN 4 JUNI - 5 JUNI 2026 PT ABC.pdf`)*

### Implementasi Teknis Ekspor Massal:
1. Browser klien secara dinamis memuat pustaka `html2pdf.js` dari CDNJS saat tombol di-klik.
2. Kode melakukan perulangan (*looping*) tanggal dalam rentang kustom terpilih.
3. Pada setiap tanggal, kode menyusun markup HTML lengkap berisi data kehadiran, logo instansi, serta tanda tangan persetujuan.
4. Agar performa optimal dan tidak memicu error CORS ketika memuat foto bukti absensi, server API mengubah tautan foto Google Drive menjadi string **Base64** secara dinamis saat data dipersiapkan klien.
5. Markup HTML disuntikkan ke dalam *off-screen container* tersembunyi (`position: absolute; left: -9999px`) kemudian diproses oleh `html2pdf().save()` untuk memicu download PDF asli langsung di folder browser.
6. Perulangan diatur menggunakan jeda waktu **600ms** per file untuk mencegah perlindungan keamanan browser memblokir unduhan file berturut-turut (*multi-download block*).

### B. Desain Halaman Cetak (*Single Document Print*)
Untuk dokumen tunggal seperti pencetakan form cuti karyawan, surat peringatan, dan ringkasan bulanan:
- Halaman dibuka di tab baru dengan memuat dokumen HTML terformat rapi.
- Menggunakan aturan CSS cetak `@media print` untuk menyembunyikan tombol navigasi, menyembunyikan tombol unduh, serta mengatur perataan halaman agar pas di kertas ukuran A4.
- Fungsi `window.print()` dipanggil otomatis setelah jeda waktu 600ms dari peristiwa halaman selesai dimuat.

---

## 8. SETUP LINGKUNGAN & CARA MENJALANKAN APLIKASI

### Variabel Lingkungan (.env):
Buat berkas `.env` pada direktori utama proyek dengan kunci sebagai berikut:

```env
# Port aplikasi dijalankan
PORT=5000

# Rahasia sesi loginExpress
SESSION_SECRET=absensi_elok_jaya_abadhi_secret_key

# URL koneksi basis data MySQL Drizzle
DATABASE_URL=mysql://root:password@127.0.0.1:3306/absen_db

# Kredensial Google Drive API Penyimpan Foto
GOOGLE_DRIVE_CLIENT_ID=masukkan_client_id_google_console
GOOGLE_DRIVE_CLIENT_SECRET=masukkan_client_secret_google_console
GOOGLE_DRIVE_REFRESH_TOKEN=masukkan_refresh_token_oauth2
GOOGLE_DRIVE_FOLDER_ID=masukkan_id_folder_tujuan_google_drive

# Kredensial Notifikasi Push (VAPID Keys)
VAPID_PUBLIC_KEY=masukkan_vapid_public_key
VAPID_PRIVATE_KEY=masukkan_vapid_private_key
```

### Script Otomatis Server:
1. **Auto-Migration**: Server secara otomatis mengecek ketersediaan kolom NPWP, BPJS, alasan keterlambatan, status fake GPS, serta keberadaan tabel `leave_requests` saat startup di file `server/index.ts`. Jika kolom belum ada, perintah SQL `ALTER TABLE` akan dijalankan otomatis.
2. **Auto-Backup Database**: Server memiliki layanan pencadangan otomatis di file `server/backup.ts`. Setiap **30 menit**, server mengeksekusi perintah shell `mysqldump` untuk menghasilkan berkas backup `.sql` yang diletakkan di dalam folder `/backups` proyek.

### Perintah Pembangunan Aplikasi (Commands):
- **Instalasi Dependensi**:
  ```bash
  npm install
  ```
- **Menjalankan Mode Pengembangan (Development)**:
  ```bash
  npm run dev
  ```
- **Melakukan Build Production**:
  ```bash
  npm run build
  ```
- **Menjalankan Build Production**:
  ```bash
  npm start
  ```
- **Sinkronisasi Skema Database Drizzle**:
  ```bash
  npm run db:push
  ```
