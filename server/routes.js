import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "./db.js";
import { users, shifts, attendance, leaveRequests, complaints, complaintPhotos, resignations, mutations, warningLetters } from "../shared/schema.js";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { isAuthenticated, isAdmin, hashPassword } from "./auth.js";
// Setup storage folder
const uploadDir = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
const cacheDir = path.resolve(uploadDir, "gdrive-cache");
if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
}
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    },
});
const upload = multer({ storage });
// Helper to get Indonesian Current Date under Day Boundary (04:00 WIB)
export function getAdminDate() {
    const utc = new Date();
    // UTC+7 for WIB
    const wib = new Date(utc.getTime() + 7 * 60 * 60 * 1000);
    const hour = wib.getUTCHours();
    if (hour < 4) {
        wib.setUTCDate(wib.getUTCDate() - 1);
    }
    const yyyy = wib.getUTCFullYear();
    const mm = String(wib.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(wib.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}
export function registerRoutes(app) {
    // Dynamic Manifest serving for PWA
    app.get("/manifest.json", (req, res) => {
        res.setHeader("Content-Type", "application/json");
        res.json({
            name: process.env.VITE_NAMA_PT || "PT ABC",
            short_name: process.env.VITE_SINGKATAN_PT || "PT ABC",
            description: process.env.VITE_DESKRIPSI_PWA || "Sistem Absensi Tenaga Kerja PT ABC",
            start_url: "/",
            display: "standalone",
            background_color: "#ffffff",
            theme_color: "#f97316",
            icons: [
                {
                    src: "/icon-192.png",
                    sizes: "192x192",
                    type: "image/png"
                },
                {
                    src: "/icon-512.png",
                    sizes: "512x512",
                    type: "image/png"
                }
            ]
        });
    });
    // Image retrieval and proxy (with CORS headers)
    app.get("/api/images/:id", (req, res) => {
        const filename = req.params.id;
        // Prevent directory traversal
        const safeFilename = path.basename(filename);
        const filePath = path.join(uploadDir, safeFilename);
        if (fs.existsSync(filePath)) {
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
            res.setHeader("Content-Type", "image/jpeg");
            return res.sendFile(filePath);
        }
        // Check inside cache folder too
        const cachePath = path.join(cacheDir, safeFilename);
        if (fs.existsSync(cachePath)) {
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
            res.setHeader("Content-Type", "image/jpeg");
            return res.sendFile(cachePath);
        }
        return res.status(404).json({ message: "Gambar tidak ditemukan" });
    });
    // Client Upload endpoint for direct AJAX/fetch
    app.post("/api/upload-direct", upload.single("photo"), (req, res) => {
        if (!req.file) {
            return res.status(400).json({ message: "Tidak ada file yang diunggah" });
        }
        res.json({ url: `/api/images/${req.file.filename}`, filename: req.file.filename });
    });
    // 1. Complete Employee Registration
    app.post("/api/register", upload.fields([
        { name: "ktpPhoto", maxCount: 1 },
        { name: "bpjsPhoto", maxCount: 1 },
        { name: "npwpPhoto", maxCount: 1 },
        { name: "photo", maxCount: 1 },
    ]), async (req, res) => {
        const files = req.files;
        const { username, // The NIK is passed as username for login purposes
        password, fullName, nik, email, phoneNumber, birthPlace, birthDate, gender, religion, address, npwp, bpjs, bankAccount, branch, position, employmentStatus, joinDate, } = req.body;
        if (!username || !password || !fullName || !nik) {
            return res.status(400).json({ message: "Data utama tidak lengkap" });
        }
        try {
            const [existingUser] = await db.select().from(users).where(eq(users.username, username)).limit(1);
            if (existingUser) {
                return res.status(400).json({ message: "Username/NIK sudah terdaftar" });
            }
            const hashedPassword = await hashPassword(password);
            const insertData = {
                username,
                nik,
                password: hashedPassword,
                fullName,
                email,
                phoneNumber,
                birthPlace,
                birthDate: birthDate || null,
                gender,
                religion,
                address,
                npwp,
                bpjs,
                bankAccount,
                branch,
                position,
                employmentStatus,
                joinDate,
                role: "employee",
                registrationStatus: "pending", // Directly to pending because they complete it upfront
            };
            if (files?.ktpPhoto?.[0])
                insertData.ktpPhotoUrl = `/api/images/${files.ktpPhoto[0].filename}`;
            if (files?.bpjsPhoto?.[0])
                insertData.bpjsPhotoUrl = `/api/images/${files.bpjsPhoto[0].filename}`;
            if (files?.npwpPhoto?.[0])
                insertData.npwpPhotoUrl = `/api/images/${files.npwpPhoto[0].filename}`;
            if (files?.photo?.[0])
                insertData.photoUrl = `/api/images/${files.photo[0].filename}`;
            await db.insert(users).values(insertData);
            res.status(201).json({ message: "Registrasi berhasil, akun sedang dievaluasi HRD." });
        }
        catch (err) {
            res.status(500).json({ message: err.message });
        }
    });
    // 3. Attendance Clock-in (Absen Masuk)
    app.post("/api/attendance/clock-in", isAuthenticated, upload.fields([
        { name: "photo", maxCount: 1 },
        { name: "lateReasonPhoto", maxCount: 1 },
    ]), async (req, res) => {
        const files = req.files;
        const userId = req.user.id;
        const { shiftId, latitude, longitude, accuracy, mocked, address, lateReason, } = req.body;
        if (!shiftId) {
            return res.status(400).json({ message: "Shift ID diperlukan" });
        }
        try {
            const [shiftRecord] = await db.select().from(shifts).where(eq(shifts.id, Number(shiftId))).limit(1);
            if (!shiftRecord) {
                return res.status(400).json({ message: "Shift tidak valid" });
            }
            const adminDate = getAdminDate();
            // 1. Fake GPS detection
            const acc = Number(accuracy);
            const isFake = (acc === 0 || acc === 1 || mocked === "true" || mocked === true);
            // 2. Session calculation
            const existingSessions = await db
                .select()
                .from(attendance)
                .where(and(eq(attendance.userId, userId), eq(attendance.date, adminDate)));
            const nextSessionNum = existingSessions.length + 1;
            if (nextSessionNum > 5) {
                return res.status(400).json({ message: "Batas absensi harian (5 sesi) telah tercapai." });
            }
            // 3. Check for Lateness (Only on Session 1)
            let statusValue = "present";
            if (nextSessionNum === 1) {
                const utc = new Date();
                const wib = new Date(utc.getTime() + 7 * 60 * 60 * 1000);
                const currentMinutes = wib.getUTCHours() * 60 + wib.getUTCMinutes();
                const [shiftHour, shiftMin] = shiftRecord.checkInTime.split(":").map(Number);
                const shiftMinutes = shiftHour * 60 + shiftMin;
                if (currentMinutes > shiftMinutes) {
                    statusValue = "late";
                    if (!lateReason) {
                        return res.status(400).json({ message: "Anda terlambat! Harap masukkan alasan keterlambatan." });
                    }
                }
            }
            const photoFile = files?.photo?.[0];
            const latePhotoFile = files?.lateReasonPhoto?.[0];
            const newAttendance = {
                userId,
                date: adminDate,
                checkIn: new Date(),
                checkInPhoto: photoFile ? `/api/images/${photoFile.filename}` : null,
                checkInLocation: address || `Lat: ${latitude}, Lng: ${longitude}`,
                shiftId: Number(shiftId),
                shift: shiftRecord.name,
                sessionNumber: nextSessionNum,
                status: statusValue,
                lateReason: statusValue === "late" ? lateReason : null,
                lateReasonPhoto: latePhotoFile ? `/api/images/${latePhotoFile.filename}` : null,
                isFakeGps: isFake,
            };
            await db.insert(attendance).values(newAttendance);
            res.json({ message: "Absen masuk berhasil", data: newAttendance });
        }
        catch (err) {
            res.status(500).json({ message: err.message });
        }
    });
    // 4. Start Break (Mulai Istirahat)
    app.post("/api/attendance/break-start", isAuthenticated, upload.single("photo"), async (req, res) => {
        const userId = req.user.id;
        const adminDate = getAdminDate();
        const { address } = req.body;
        try {
            // Find latest attendance session for today
            const todaySessions = await db
                .select()
                .from(attendance)
                .where(and(eq(attendance.userId, userId), eq(attendance.date, adminDate)))
                .orderBy(desc(attendance.sessionNumber));
            if (todaySessions.length === 0) {
                return res.status(400).json({ message: "Anda belum melakukan absen masuk hari ini" });
            }
            const activeSession = todaySessions[0];
            if (activeSession.breakStart) {
                return res.status(400).json({ message: "Istirahat sudah dimulai pada sesi ini" });
            }
            await db
                .update(attendance)
                .set({
                breakStart: new Date(),
                breakStartPhoto: req.file ? `/api/images/${req.file.filename}` : null,
                breakStartLocation: address || "Lokasi Istirahat",
            })
                .where(eq(attendance.id, activeSession.id));
            res.json({ message: "Mulai istirahat berhasil" });
        }
        catch (err) {
            res.status(500).json({ message: err.message });
        }
    });
    // 5. End Break (Selesai Istirahat)
    app.post("/api/attendance/break-end", isAuthenticated, upload.single("photo"), async (req, res) => {
        const userId = req.user.id;
        const adminDate = getAdminDate();
        const { address } = req.body;
        try {
            const todaySessions = await db
                .select()
                .from(attendance)
                .where(and(eq(attendance.userId, userId), eq(attendance.date, adminDate)))
                .orderBy(desc(attendance.sessionNumber));
            if (todaySessions.length === 0) {
                return res.status(400).json({ message: "Anda belum masuk hari ini" });
            }
            const activeSession = todaySessions[0];
            if (!activeSession.breakStart) {
                return res.status(400).json({ message: "Istirahat belum dimulai" });
            }
            if (activeSession.breakEnd) {
                return res.status(400).json({ message: "Istirahat sudah diakhiri pada sesi ini" });
            }
            await db
                .update(attendance)
                .set({
                breakEnd: new Date(),
                breakEndPhoto: req.file ? `/api/images/${req.file.filename}` : null,
                breakEndLocation: address || "Lokasi Selesai Istirahat",
            })
                .where(eq(attendance.id, activeSession.id));
            res.json({ message: "Istirahat selesai" });
        }
        catch (err) {
            res.status(500).json({ message: err.message });
        }
    });
    // 6. Clock-out (Absen Pulang)
    app.post("/api/attendance/clock-out", isAuthenticated, upload.single("photo"), async (req, res) => {
        const userId = req.user.id;
        const adminDate = getAdminDate();
        const { address } = req.body;
        try {
            const todaySessions = await db
                .select()
                .from(attendance)
                .where(and(eq(attendance.userId, userId), eq(attendance.date, adminDate)))
                .orderBy(desc(attendance.sessionNumber));
            if (todaySessions.length === 0) {
                return res.status(400).json({ message: "Anda belum masuk hari ini" });
            }
            const activeSession = todaySessions[0];
            if (activeSession.checkOut) {
                return res.status(400).json({ message: "Sesi absensi aktif sudah melakukan checkout" });
            }
            await db
                .update(attendance)
                .set({
                checkOut: new Date(),
                checkOutPhoto: req.file ? `/api/images/${req.file.filename}` : null,
                checkOutLocation: address || "Lokasi Checkout",
            })
                .where(eq(attendance.id, activeSession.id));
            res.json({ message: "Absen pulang berhasil" });
        }
        catch (err) {
            res.status(500).json({ message: err.message });
        }
    });
    // 7. Get Today's Active Attendance Log for Employee
    app.get("/api/attendance/today", isAuthenticated, async (req, res) => {
        const userId = req.user.id;
        const adminDate = getAdminDate();
        try {
            const todaySessions = await db
                .select()
                .from(attendance)
                .where(and(eq(attendance.userId, userId), eq(attendance.date, adminDate)))
                .orderBy(attendance.sessionNumber);
            res.json(todaySessions);
        }
        catch (err) {
            res.status(500).json({ message: err.message });
        }
    });
    // 8. Get Personal Attendance History
    app.get("/api/attendance/history", isAuthenticated, async (req, res) => {
        const userId = req.user.id;
        try {
            const list = await db
                .select()
                .from(attendance)
                .where(eq(attendance.userId, userId))
                .orderBy(desc(attendance.date), desc(attendance.sessionNumber));
            res.json(list);
        }
        catch (err) {
            res.status(500).json({ message: err.message });
        }
    });
    // 9. Employee Leave Requests
    app.get("/api/employee/leave-requests", isAuthenticated, async (req, res) => {
        const userId = req.user.id;
        try {
            const list = await db
                .select()
                .from(leaveRequests)
                .where(eq(leaveRequests.userId, userId))
                .orderBy(desc(leaveRequests.createdAt));
            res.json(list);
        }
        catch (err) {
            res.status(500).json({ message: err.message });
        }
    });
    app.post("/api/employee/leave-requests", isAuthenticated, async (req, res) => {
        const userId = req.user.id;
        const { startDate, endDate, selectedDates, reason } = req.body;
        if (!startDate || !endDate || !reason) {
            return res.status(400).json({ message: "Data tidak lengkap" });
        }
        try {
            await db.insert(leaveRequests).values({
                userId,
                startDate,
                endDate,
                selectedDates: selectedDates || null,
                reason,
                status: "pending",
            });
            res.status(201).json({ message: "Pengajuan cuti berhasil diajukan" });
        }
        catch (err) {
            res.status(500).json({ message: err.message });
        }
    });
    // 10. Employee Complaints & Upload
    app.get("/api/employee/complaints", isAuthenticated, async (req, res) => {
        const userId = req.user.id;
        try {
            // Find complaints and link their photos
            const userComplaints = await db
                .select()
                .from(complaints)
                .where(eq(complaints.userId, userId))
                .orderBy(desc(complaints.createdAt));
            const response = [];
            for (const comp of userComplaints) {
                const photos = await db
                    .select()
                    .from(complaintPhotos)
                    .where(eq(complaintPhotos.complaintId, comp.id));
                response.push({ ...comp, photos });
            }
            res.json(response);
        }
        catch (err) {
            res.status(500).json({ message: err.message });
        }
    });
    app.post("/api/employee/complaints", isAuthenticated, upload.array("photos"), async (req, res) => {
        const userId = req.user.id;
        const { title, description } = req.body;
        const files = req.files;
        if (!title || !description) {
            return res.status(400).json({ message: "Data tidak lengkap" });
        }
        try {
            // Insert complaint
            const [insertResult] = await db.insert(complaints).values({
                userId,
                title,
                description,
                status: "pending",
            });
            const complaintId = insertResult.insertId;
            // Insert photos
            if (files && files.length > 0) {
                for (const file of files) {
                    await db.insert(complaintPhotos).values({
                        complaintId,
                        photoUrl: `/api/images/${file.filename}`,
                        caption: file.originalname,
                    });
                }
            }
            res.status(201).json({ message: "Pengaduan berhasil diajukan" });
        }
        catch (err) {
            res.status(500).json({ message: err.message });
        }
    });
    // 11. Employee popup notification checking
    // Cutoff date is 2026-06-10T04:00:00.000Z UTC (11:00 WIB)
    app.get("/api/employee/documents", isAuthenticated, async (req, res) => {
        const userId = req.user.id;
        const cutoff = new Date("2026-06-10T04:00:00.000Z");
        try {
            const sp = await db
                .select()
                .from(warningLetters)
                .where(and(eq(warningLetters.userId, userId), gte(warningLetters.createdAt, cutoff)));
            const mut = await db
                .select()
                .from(mutations)
                .where(and(eq(mutations.userId, userId), gte(mutations.createdAt, cutoff)));
            const resg = await db
                .select()
                .from(resignations)
                .where(and(eq(resignations.userId, userId), gte(resignations.createdAt, cutoff)));
            res.json({
                warningLetters: sp,
                mutations: mut,
                resignations: resg,
            });
        }
        catch (err) {
            res.status(500).json({ message: err.message });
        }
    });
    // ================= ADMIN & SUPERADMIN =================
    // 1. Unverified employees list
    app.get("/api/admin/unverified-employees", isAdmin, async (req, res) => {
        try {
            const list = await db
                .select()
                .from(users)
                .where(eq(users.registrationStatus, "pending"));
            res.json(list);
        }
        catch (err) {
            res.status(500).json({ message: err.message });
        }
    });
    // 2. Approve/reject employee
    app.post("/api/admin/verify-employee/:id", isAdmin, async (req, res) => {
        const targetId = Number(req.params.id);
        const { action } = req.body; // "approve" or "reject"
        try {
            const status = action === "approve" ? "approved" : "rejected";
            await db
                .update(users)
                .set({ registrationStatus: status })
                .where(eq(users.id, targetId));
            res.json({ message: `Tenaga Kerja berhasil di-${action}` });
        }
        catch (err) {
            res.status(500).json({ message: err.message });
        }
    });
    // 3. Get all active approved employees
    app.get("/api/admin/employees", isAdmin, async (req, res) => {
        try {
            const list = await db
                .select()
                .from(users)
                .where(and(eq(users.role, "employee"), eq(users.registrationStatus, "approved")));
            res.json(list);
        }
        catch (err) {
            res.status(500).json({ message: err.message });
        }
    });
    // 4. Delete user permanently
    app.delete("/api/admin/users/:id", isAdmin, async (req, res) => {
        const targetId = Number(req.params.id);
        try {
            await db.delete(users).where(eq(users.id, targetId));
            res.json({ message: "User berhasil dihapus secara permanen" });
        }
        catch (err) {
            res.status(500).json({ message: err.message });
        }
    });
    // 5. Shift management
    app.get("/api/admin/shifts", isAuthenticated, async (req, res) => {
        try {
            const list = await db.select().from(shifts);
            res.json(list);
        }
        catch (err) {
            res.status(500).json({ message: err.message });
        }
    });
    app.post("/api/admin/shifts", isAdmin, async (req, res) => {
        const { name, checkInTime, checkOutTime, description } = req.body;
        if (!name || !checkInTime || !checkOutTime) {
            return res.status(400).json({ message: "Data shift tidak lengkap" });
        }
        try {
            await db.insert(shifts).values({
                name,
                checkInTime,
                checkOutTime,
                description: description || null,
            });
            res.status(201).json({ message: "Shift berhasil dibuat" });
        }
        catch (err) {
            res.status(500).json({ message: err.message });
        }
    });
    // 6. Mutasi, Promosi, Demosi
    app.get("/api/admin/mutations", isAdmin, async (req, res) => {
        try {
            const list = await db.select().from(mutations).orderBy(desc(mutations.createdAt));
            res.json(list);
        }
        catch (err) {
            res.status(500).json({ message: err.message });
        }
    });
    app.post("/api/admin/mutations", isAdmin, upload.single("document"), async (req, res) => {
        const { userId, type, oldBranch, newBranch, oldPosition, newPosition, notes } = req.body;
        if (!userId || !type) {
            return res.status(400).json({ message: "Data tidak lengkap" });
        }
        try {
            const docUrl = req.file ? `/api/images/${req.file.filename}` : null;
            await db.insert(mutations).values({
                userId: Number(userId),
                type,
                oldBranch: oldBranch || null,
                newBranch: newBranch || null,
                oldPosition: oldPosition || null,
                newPosition: newPosition || null,
                documentUrl: docUrl,
                notes: notes || null,
            });
            // Update employee branch and position in user table
            const updates = {};
            if (newBranch)
                updates.branch = newBranch;
            if (newPosition)
                updates.position = newPosition;
            if (Object.keys(updates).length > 0) {
                await db.update(users).set(updates).where(eq(users.id, Number(userId)));
            }
            res.status(201).json({ message: "Mutasi berhasil diterbitkan" });
        }
        catch (err) {
            res.status(500).json({ message: err.message });
        }
    });
    // 7. Warning Letters (SP)
    app.get("/api/admin/warning-letters", isAdmin, async (req, res) => {
        try {
            const list = await db.select().from(warningLetters).orderBy(desc(warningLetters.createdAt));
            res.json(list);
        }
        catch (err) {
            res.status(500).json({ message: err.message });
        }
    });
    app.post("/api/admin/warning-letters", isAdmin, upload.single("document"), async (req, res) => {
        const { userId, type, startDate, endDate, notes } = req.body;
        if (!userId || !type || !startDate || !endDate) {
            return res.status(400).json({ message: "Data tidak lengkap" });
        }
        try {
            const docUrl = req.file ? `/api/images/${req.file.filename}` : null;
            await db.insert(warningLetters).values({
                userId: Number(userId),
                type,
                startDate,
                endDate,
                documentUrl: docUrl,
                notes: notes || null,
            });
            res.status(201).json({ message: "Surat Peringatan berhasil diterbitkan" });
        }
        catch (err) {
            res.status(500).json({ message: err.message });
        }
    });
    app.delete("/api/admin/warning-letters/:id", isAdmin, async (req, res) => {
        const targetId = Number(req.params.id);
        try {
            await db.delete(warningLetters).where(eq(warningLetters.id, targetId));
            res.json({ message: "Surat Peringatan berhasil dihapus" });
        }
        catch (err) {
            res.status(500).json({ message: err.message });
        }
    });
    // 8. Resignations
    app.get("/api/admin/resignations", isAdmin, async (req, res) => {
        try {
            const list = await db.select().from(resignations).orderBy(desc(resignations.createdAt));
            res.json(list);
        }
        catch (err) {
            res.status(500).json({ message: err.message });
        }
    });
    app.post("/api/admin/resignations", isAdmin, upload.single("document"), async (req, res) => {
        const { userId, resignDate, reason } = req.body;
        if (!userId || !resignDate || !reason) {
            return res.status(400).json({ message: "Data tidak lengkap" });
        }
        try {
            const docUrl = req.file ? `/api/images/${req.file.filename}` : null;
            await db.insert(resignations).values({
                userId: Number(userId),
                resignDate,
                reason,
                documentUrl: docUrl,
            });
            // Update employee status to resigned/inactive in users
            await db.update(users).set({ registrationStatus: "rejected" }).where(eq(users.id, Number(userId)));
            res.status(201).json({ message: "Pemberhentian/Resign berhasil dicatat" });
        }
        catch (err) {
            res.status(500).json({ message: err.message });
        }
    });
    // 9. Leave requests validation
    app.get("/api/admin/leave-requests", isAdmin, async (req, res) => {
        try {
            const list = await db.select().from(leaveRequests).orderBy(desc(leaveRequests.createdAt));
            res.json(list);
        }
        catch (err) {
            res.status(500).json({ message: err.message });
        }
    });
    app.put("/api/admin/leave-requests/:id", isAdmin, async (req, res) => {
        const targetId = Number(req.params.id);
        const { status } = req.body; // "approved", "rejected", "cancelled"
        try {
            // Get the leave request first
            const [leaveReq] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, targetId)).limit(1);
            if (!leaveReq) {
                return res.status(404).json({ message: "Pengajuan cuti tidak ditemukan" });
            }
            await db
                .update(leaveRequests)
                .set({ status })
                .where(eq(leaveRequests.id, targetId));
            // If approved, insert attendance logs for those dates as status = "cuti"
            if (status === "approved") {
                const datesToMark = [];
                if (leaveReq.selectedDates) {
                    // If comma-separated dates are present
                    datesToMark.push(...leaveReq.selectedDates.split(",").map(d => d.trim()));
                }
                else {
                    // Add all dates from startDate to endDate
                    const start = new Date(leaveReq.startDate);
                    const end = new Date(leaveReq.endDate);
                    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                        datesToMark.push(d.toISOString().split("T")[0]);
                    }
                }
                for (const dateStr of datesToMark) {
                    // Check if attendance log already exists for user and date
                    const [exists] = await db
                        .select()
                        .from(attendance)
                        .where(and(eq(attendance.userId, leaveReq.userId), eq(attendance.date, dateStr)))
                        .limit(1);
                    if (!exists) {
                        await db.insert(attendance).values({
                            userId: leaveReq.userId,
                            date: dateStr,
                            status: "cuti",
                            notes: `Cuti Disetujui: ${leaveReq.reason}`,
                            sessionNumber: 1,
                        });
                    }
                    else {
                        await db
                            .update(attendance)
                            .set({ status: "cuti", notes: `Cuti Disetujui: ${leaveReq.reason}` })
                            .where(and(eq(attendance.userId, leaveReq.userId), eq(attendance.date, dateStr)));
                    }
                }
            }
            res.json({ message: "Status cuti berhasil diperbarui" });
        }
        catch (err) {
            res.status(500).json({ message: err.message });
        }
    });
    app.delete("/api/admin/leave-requests/:id", isAdmin, async (req, res) => {
        const targetId = Number(req.params.id);
        try {
            await db.delete(leaveRequests).where(eq(leaveRequests.id, targetId));
            res.json({ message: "Pengajuan cuti berhasil dihapus" });
        }
        catch (err) {
            res.status(500).json({ message: err.message });
        }
    });
    // 10. General Attendance logs retrieval (for rekap filters)
    app.get("/api/admin/attendance", isAdmin, async (req, res) => {
        const { startDate, endDate } = req.query;
        try {
            let query = db.select().from(attendance);
            const filters = [];
            if (startDate) {
                filters.push(gte(attendance.date, String(startDate)));
            }
            if (endDate) {
                filters.push(lte(attendance.date, String(endDate)));
            }
            if (filters.length > 0) {
                query = query.where(and(...filters));
            }
            const list = await query.orderBy(desc(attendance.date), desc(attendance.sessionNumber));
            res.json(list);
        }
        catch (err) {
            res.status(500).json({ message: err.message });
        }
    });
    // 11. Complaints listing for admin
    app.get("/api/admin/complaints", isAdmin, async (req, res) => {
        try {
            const list = await db.select().from(complaints).orderBy(desc(complaints.createdAt));
            const response = [];
            for (const comp of list) {
                const photos = await db.select().from(complaintPhotos).where(eq(complaintPhotos.complaintId, comp.id));
                response.push({ ...comp, photos });
            }
            res.json(response);
        }
        catch (err) {
            res.status(500).json({ message: err.message });
        }
    });
    app.put("/api/admin/complaints/:id", isAdmin, async (req, res) => {
        const targetId = Number(req.params.id);
        const { status } = req.body; // "pending", "reviewed", "resolved"
        try {
            await db.update(complaints).set({ status }).where(eq(complaints.id, targetId));
            res.json({ message: "Status komplain diperbarui" });
        }
        catch (err) {
            res.status(500).json({ message: err.message });
        }
    });
}
