import { Express, Request, Response, NextFunction } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { exec } from "child_process";
import { db, pool } from "./db.js";
import { users, shifts, attendance, leaveRequests, complaints, complaintPhotos, resignations, mutations, warningLetters, systemConfigs, activityLogs, announcements } from "../shared/schema.js";
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

import { uploadFile, isDriveConfigured } from "./services/googleDrive.js";

async function processSingleUpload(
  file: Express.Multer.File | undefined,
  actionType: 'clockIn' | 'breakStart' | 'breakEnd' | 'clockOut' | 'lateReason' | 'complaint' | 'document' | 'profile',
  username: string
) {
  if (!file) return null;
  if (isDriveConfigured) {
    try {
      const fileBuffer = fs.readFileSync(file.path);
      const cleanName = username.replace(/[^a-zA-Z0-9]/g, "");
      const ext = path.extname(file.originalname) || ".jpg";
      const gdriveFilename = `${actionType.toUpperCase()}_${cleanName}_${Date.now()}${ext}`;
      
      const result = await uploadFile(fileBuffer, gdriveFilename, file.mimetype);
      try {
        fs.unlinkSync(file.path);
      } catch (err) {
        // ignore
      }
      return `/api/gdrive-img/${result.fileId}`;
    } catch (err: any) {
      console.error("GDrive upload failed, using local storage:", err.message);
      return `/api/images/${file.filename}`;
    }
  }
  return `/api/images/${file.filename}`;
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
export function getAdminDate(): string {
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

export function registerRoutes(app: Express) {
  
  // Dynamic Manifest serving for PWA
  app.get("/manifest.json", (req: Request, res: Response) => {
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
  app.get("/api/images/:id", (req: Request, res: Response) => {
    const filename = req.params.id as string;
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
  app.post("/api/upload-direct", upload.single("photo"), async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ message: "Tidak ada file yang diunggah" });
    }
    const url = await processSingleUpload(req.file, "document", "guest");
    res.json({ url, filename: req.file.filename });
  });

  // Google Drive proxy thumbnail endpoint
  app.get("/api/gdrive-img/:id", (req: Request, res: Response) => {
    const fileId = req.params.id;
    if (!fileId || fileId.includes("/") || fileId.includes("\\")) {
      return res.status(400).json({ message: "ID File tidak valid" });
    }

    const safeFileId = path.basename(fileId);
    const cachePath = path.join(cacheDir, `${safeFileId}.jpg`);

    // 1. If local cache exists, serve it immediately
    if (fs.existsSync(cachePath)) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.setHeader("Content-Type", "image/jpeg");
      return res.sendFile(cachePath);
    }

    // 2. Fetch from Google Drive thumbnail public API
    const driveUrl = `https://drive.google.com/thumbnail?id=${safeFileId}&sz=w800`;
    import("https").then((https) => {
      https.get(driveUrl, (driveRes) => {
        if (driveRes.statusCode === 200) {
          const fileStream = fs.createWriteStream(cachePath);
          driveRes.pipe(fileStream);
          fileStream.on("finish", () => {
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
            res.setHeader("Content-Type", "image/jpeg");
            return res.sendFile(cachePath);
          });
        } else {
          return res.status(404).json({ message: "Gambar tidak ditemukan di Drive" });
        }
      }).on("error", (err) => {
        console.error("GDrive proxy error:", err);
        return res.status(500).json({ message: "Gagal memproses gambar Drive" });
      });
    });
  });

  // Dynamic application configuration endpoint
  app.get("/api/config", async (req: Request, res: Response) => {
    try {
      const dbConfigs = await db.select().from(systemConfigs);
      const configMap: Record<string, string> = {};
      dbConfigs.forEach(cfg => {
        configMap[cfg.key] = cfg.value;
      });

      res.json({
        namaPt: configMap["namaPt"] ?? process.env.VITE_NAMA_PT ?? "PT ABCD",
        singkatanPt: configMap["singkatanPt"] ?? process.env.VITE_SINGKATAN_PT ?? "PT ABC",
        deskripsiPwa: configMap["deskripsiPwa"] ?? process.env.VITE_DESKRIPSI_PWA ?? "Aplikasi Absensi Tenaga Kerja",
        logoUrl: configMap["logoUrl"] ?? process.env.VITE_LOGO_FILE ?? "/logo_elok_buah.jpg",
        logoInisial: configMap["logoInisial"] ?? process.env.VITE_LOGO_INISIAL ?? "",
        rekapPrefix: configMap["rekapPrefix"] ?? process.env.VITE_REKAP_FILE_PREFIX ?? "REKAP_ABSENSI",
        themePrimary: configMap["themePrimary"] ?? process.env.VITE_THEME_PRIMARY_HSL ?? "24 95% 53%",
        themeSecondary: configMap["themeSecondary"] ?? process.env.VITE_THEME_SECONDARY_HSL ?? "24 95% 43%",
        themeAccent: configMap["themeAccent"] ?? process.env.VITE_THEME_ACCENT_HSL ?? "24 95% 93%",
        themeBackground: configMap["themeBackground"] ?? process.env.VITE_THEME_BACKGROUND_HSL ?? "0 0% 100%",
        themeSidebarAccent: configMap["themeSidebarAccent"] ?? process.env.VITE_THEME_SIDEBAR_ACCENT_HSL ?? "24 95% 97%",
        features: {
          leave: (configMap["feature_leave"] ?? process.env.FEATURE_LEAVE) !== "false",
          recap: (configMap["feature_recap"] ?? process.env.FEATURE_RECAP) !== "false",
          complaint: (configMap["feature_complaint"] ?? process.env.FEATURE_COMPLAINT) !== "false",
          info: (configMap["feature_info"] ?? process.env.FEATURE_INFO) !== "false",
          mutation: (configMap["feature_mutation"] ?? process.env.FEATURE_MUTATION) !== "false",
          warningLetter: (configMap["feature_warningLetter"] ?? process.env.FEATURE_WARNING_LETTER) !== "false",
          shift: (configMap["feature_shift"] ?? process.env.FEATURE_SHIFT) !== "false",
          resignation: (configMap["feature_resignation"] ?? process.env.FEATURE_RESIGNATION) !== "false",
          break: (configMap["feature_break"] ?? process.env.FEATURE_BREAK) !== "false",
        },
        isDriveConfigured
      });
    } catch (err) {
      console.error("Failed to load config:", err);
      res.json({
        namaPt: process.env.VITE_NAMA_PT || "PT ABCD",
        singkatanPt: process.env.VITE_SINGKATAN_PT || "PT ABC",
        deskripsiPwa: process.env.VITE_DESKRIPSI_PWA || "Aplikasi Absensi Tenaga Kerja",
        logoUrl: process.env.VITE_LOGO_FILE || "/logo_elok_buah.jpg",
        logoInisial: process.env.VITE_LOGO_INISIAL || "",
        rekapPrefix: process.env.VITE_REKAP_FILE_PREFIX || "REKAP_ABSENSI",
        features: {
          leave: process.env.FEATURE_LEAVE !== "false",
          recap: process.env.FEATURE_RECAP !== "false",
          complaint: process.env.FEATURE_COMPLAINT !== "false",
          info: process.env.FEATURE_INFO !== "false",
          mutation: process.env.FEATURE_MUTATION !== "false",
          warningLetter: process.env.FEATURE_WARNING_LETTER !== "false",
          shift: process.env.FEATURE_SHIFT !== "false",
          resignation: process.env.FEATURE_RESIGNATION !== "false",
          break: process.env.FEATURE_BREAK !== "false",
        },
        isDriveConfigured
      });
    }
  });

  // Admin endpoint to save configuration
  app.post("/api/admin/config", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const {
        namaPt, singkatanPt, deskripsiPwa, logoUrl, logoInisial, rekapPrefix,
        themePrimary, themeSecondary, themeAccent, themeBackground, themeSidebarAccent,
        features
      } = req.body;

      const configsToSave: { key: string; value: string }[] = [];
      if (namaPt !== undefined) configsToSave.push({ key: "namaPt", value: String(namaPt) });
      if (singkatanPt !== undefined) configsToSave.push({ key: "singkatanPt", value: String(singkatanPt) });
      if (deskripsiPwa !== undefined) configsToSave.push({ key: "deskripsiPwa", value: String(deskripsiPwa) });
      if (logoUrl !== undefined) configsToSave.push({ key: "logoUrl", value: String(logoUrl) });
      if (logoInisial !== undefined) configsToSave.push({ key: "logoInisial", value: String(logoInisial) });
      if (rekapPrefix !== undefined) configsToSave.push({ key: "rekapPrefix", value: String(rekapPrefix) });
      if (themePrimary !== undefined) configsToSave.push({ key: "themePrimary", value: String(themePrimary) });
      if (themeSecondary !== undefined) configsToSave.push({ key: "themeSecondary", value: String(themeSecondary) });
      if (themeAccent !== undefined) configsToSave.push({ key: "themeAccent", value: String(themeAccent) });
      if (themeBackground !== undefined) configsToSave.push({ key: "themeBackground", value: String(themeBackground) });
      if (themeSidebarAccent !== undefined) configsToSave.push({ key: "themeSidebarAccent", value: String(themeSidebarAccent) });

      if (features && typeof features === "object") {
        Object.entries(features).forEach(([key, value]) => {
          configsToSave.push({ key: `feature_${key}`, value: value ? "true" : "false" });
        });
      }

      const conn = await pool.getConnection();
      try {
        for (const cfg of configsToSave) {
          await conn.query(
            "INSERT INTO system_configs (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)",
            [cfg.key, cfg.value]
          );
        }
        // Log to Activity Logs
        await db.insert(activityLogs).values({
          userId: (req.user as any).id,
          action: "MENGUBAH_SISTEM_KONFIG",
          details: "Memperbarui konfigurasi sistem/tema warna perusahaan",
        });
      } finally {
        conn.release();
      }

      res.json({ message: "Konfigurasi sistem berhasil diperbarui" });
    } catch (err: any) {
      console.error("Failed to save config:", err);
      res.status(500).json({ message: "Gagal memperbarui konfigurasi: " + err.message });
    }
  });

  // 1. Complete Employee Registration
  app.post(
    "/api/register",
    upload.fields([
      { name: "ktpPhoto", maxCount: 1 },
      { name: "bpjsPhoto", maxCount: 1 },
      { name: "npwpPhoto", maxCount: 1 },
      { name: "photo", maxCount: 1 },
    ]),
    async (req: Request, res: Response) => {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const {
        username, // The NIK is passed as username for login purposes
        password,
        fullName,
        nik,
        email,
        phoneNumber,
        birthPlace,
        birthDate,
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
      } = req.body;

      if (!username || !password || !fullName || !nik) {
        return res.status(400).json({ message: "Data utama tidak lengkap" });
      }

      try {
        const [existingUser] = await db.select().from(users).where(eq(users.username, username)).limit(1);
        if (existingUser) {
          return res.status(400).json({ message: "Username/NIK sudah terdaftar" });
        }

        const hashedPassword = await hashPassword(password);
        
        const insertData: any = {
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

        insertData.ktpPhotoUrl = files?.ktpPhoto?.[0] ? await processSingleUpload(files.ktpPhoto[0], "document", username) : null;
        insertData.bpjsPhotoUrl = files?.bpjsPhoto?.[0] ? await processSingleUpload(files.bpjsPhoto[0], "document", username) : null;
        insertData.npwpPhotoUrl = files?.npwpPhoto?.[0] ? await processSingleUpload(files.npwpPhoto[0], "document", username) : null;
        insertData.photoUrl = files?.photo?.[0] ? await processSingleUpload(files.photo[0], "profile", username) : null;

        await (db.insert(users) as any).values(insertData);

        res.status(201).json({ message: "Registrasi berhasil, akun sedang dievaluasi HRD." });
      } catch (err: any) {
        res.status(500).json({ message: err.message });
      }
    }
  );

  // Update Profile & Log Activity
  app.patch("/api/profile", isAuthenticated, upload.none(), async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).id;
      const { phoneNumber, email, branch, npwp, bpjs, religion, photoUrl, npwpPhotoUrl, bpjsPhotoUrl } = req.body;

      const [currentUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

      const updates: any = {};
      const logDetails: string[] = [];

      if (phoneNumber !== undefined && phoneNumber !== currentUser.phoneNumber) {
        updates.phoneNumber = phoneNumber;
        logDetails.push(`No. HP: dari "${currentUser.phoneNumber || 'Belum Diisi'}" menjadi "${phoneNumber}"`);
      }
      if (email !== undefined && email !== currentUser.email) {
        updates.email = email;
        logDetails.push(`Email: dari "${currentUser.email || 'Belum Diisi'}" menjadi "${email}"`);
      }
      if (branch !== undefined && branch !== currentUser.branch) {
        updates.branch = branch;
        logDetails.push(`Cabang: dari "${currentUser.branch || 'Belum Diisi'}" menjadi "${branch}"`);
      }
      if (npwp !== undefined && npwp !== currentUser.npwp) {
        updates.npwp = npwp;
        logDetails.push(`NPWP: dari "${currentUser.npwp || 'Belum Diisi'}" menjadi "${npwp}"`);
      }
      if (bpjs !== undefined && bpjs !== currentUser.bpjs) {
        updates.bpjs = bpjs;
        logDetails.push(`BPJS: dari "${currentUser.bpjs || 'Belum Diisi'}" menjadi "${bpjs}"`);
      }
      if (religion !== undefined && religion !== currentUser.religion) {
        updates.religion = religion;
        logDetails.push(`Agama: dari "${currentUser.religion || 'Belum Diisi'}" menjadi "${religion}"`);
      }
      if (photoUrl !== undefined && photoUrl !== currentUser.photoUrl) {
        updates.photoUrl = photoUrl;
        logDetails.push("Mengubah foto profil");
      }
      if (npwpPhotoUrl !== undefined && npwpPhotoUrl !== currentUser.npwpPhotoUrl) {
        updates.npwpPhotoUrl = npwpPhotoUrl;
        logDetails.push("Mengubah foto NPWP");
      }
      if (bpjsPhotoUrl !== undefined && bpjsPhotoUrl !== currentUser.bpjsPhotoUrl) {
        updates.bpjsPhotoUrl = bpjsPhotoUrl;
        logDetails.push("Mengubah foto BPJS");
      }

      if (Object.keys(updates).length > 0) {
        await db.update(users).set(updates).where(eq(users.id, userId));
        
        // Log to Activity Logs
        await db.insert(activityLogs).values({
          userId,
          action: "MENGUBAH_PROFIL",
          details: logDetails.join(", "),
        });
      }

      const [updatedUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      res.json(updatedUser);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // 3. Attendance Clock-in (Absen Masuk)
  app.post(
    "/api/attendance/clock-in",
    isAuthenticated,
    upload.fields([
      { name: "photo", maxCount: 1 },
      { name: "lateReasonPhoto", maxCount: 1 },
    ]),
    async (req: Request, res: Response) => {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const userId = (req.user as any).id;
      
      const {
        shiftId,
        latitude,
        longitude,
        accuracy,
        mocked,
        address,
        location,
        lateReason,
      } = req.body;

      const activeAddress = location || address;

      if (!shiftId) {
        return res.status(400).json({ message: "Shift ID diperlukan" });
      }

      try {
        let shiftRecord: any = null;
        if (Number(shiftId) < 0) {
          // It's a system default shift (e.g. -1 for 08:00 - 17:00)
          shiftRecord = {
            id: Number(shiftId),
            name: "Shift Reguler",
            checkInTime: "08:00",
            checkOutTime: "17:00",
            description: "Shift Reguler Default"
          };
        } else {
          const [found] = await db.select().from(shifts).where(eq(shifts.id, Number(shiftId))).limit(1);
          shiftRecord = found;
        }

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
        let statusValue: "present" | "late" = "present";
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

        const username = (req.user as any).username;
        const checkInPhoto = files?.photo?.[0] ? await processSingleUpload(files.photo[0], "clockIn", username) : null;
        const lateReasonPhoto = files?.lateReasonPhoto?.[0] ? await processSingleUpload(files.lateReasonPhoto[0], "lateReason", username) : null;

        const newAttendance = {
          userId,
          date: adminDate,
          checkIn: new Date(),
          checkInPhoto,
          checkInLocation: activeAddress || `Lat: ${latitude || 'UND'}, Lng: ${longitude || 'UND'}`,
          shiftId: Number(shiftId),
          shift: shiftRecord.name,
          sessionNumber: nextSessionNum,
          status: statusValue,
          lateReason: statusValue === "late" ? lateReason : null,
          lateReasonPhoto,
          isFakeGps: isFake,
        };

        await db.insert(attendance).values(newAttendance);
        res.json({ message: "Absen masuk berhasil", data: newAttendance });
      } catch (err: any) {
        res.status(500).json({ message: err.message });
      }
    }
  );

  // 4. Start Break (Mulai Istirahat)
  app.post("/api/attendance/break-start", isAuthenticated, upload.single("photo"), async (req: Request, res: Response) => {
    const userId = (req.user as any).id;
    const adminDate = getAdminDate();
    const { address, location } = req.body;
    const activeAddress = location || address;

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

      const username = (req.user as any).username;
      const breakStartPhoto = req.file ? await processSingleUpload(req.file, "breakStart", username) : null;
      await db
        .update(attendance)
        .set({
          breakStart: new Date(),
          breakStartPhoto,
          breakStartLocation: activeAddress || "Lokasi Istirahat",
        })
        .where(eq(attendance.id, activeSession.id));

      res.json({ message: "Mulai istirahat berhasil" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // 5. End Break (Selesai Istirahat)
  app.post("/api/attendance/break-end", isAuthenticated, upload.single("photo"), async (req: Request, res: Response) => {
    const userId = (req.user as any).id;
    const adminDate = getAdminDate();
    const { address, location } = req.body;
    const activeAddress = location || address;

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

      const username = (req.user as any).username;
      const breakEndPhoto = req.file ? await processSingleUpload(req.file, "breakEnd", username) : null;
      await db
        .update(attendance)
        .set({
          breakEnd: new Date(),
          breakEndPhoto,
          breakEndLocation: activeAddress || "Lokasi Selesai Istirahat",
        })
        .where(eq(attendance.id, activeSession.id));

      res.json({ message: "Istirahat selesai" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // 6. Clock-out (Absen Pulang)
  app.post("/api/attendance/clock-out", isAuthenticated, upload.single("photo"), async (req: Request, res: Response) => {
    const userId = (req.user as any).id;
    const adminDate = getAdminDate();
    const { address, location } = req.body;
    const activeAddress = location || address;

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

      const username = (req.user as any).username;
      const checkOutPhoto = req.file ? await processSingleUpload(req.file, "clockOut", username) : null;
      await db
        .update(attendance)
        .set({
          checkOut: new Date(),
          checkOutPhoto,
          checkOutLocation: activeAddress || "Lokasi Checkout",
        })
        .where(eq(attendance.id, activeSession.id));

      res.json({ message: "Absen pulang berhasil" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // 7. Get Today's Active Attendance Log for Employee
  app.get("/api/attendance/today", isAuthenticated, async (req: Request, res: Response) => {
    const userId = (req.user as any).id;
    const adminDate = getAdminDate();

    try {
      const todaySessions = await db
        .select()
        .from(attendance)
        .where(and(eq(attendance.userId, userId), eq(attendance.date, adminDate)))
        .orderBy(attendance.sessionNumber);

      res.json(todaySessions);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // 8. Get Personal Attendance History
  app.get("/api/attendance/history", isAuthenticated, async (req: Request, res: Response) => {
    const userId = (req.user as any).id;
    try {
      const list = await db
        .select()
        .from(attendance)
        .where(eq(attendance.userId, userId))
        .orderBy(desc(attendance.date), desc(attendance.sessionNumber));

      res.json(list);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // 9. Employee Leave Requests
  app.get("/api/leave-requests", isAuthenticated, async (req: Request, res: Response) => {
    const userId = (req.user as any).id;
    try {
      const list = await db
        .select()
        .from(leaveRequests)
        .where(eq(leaveRequests.userId, userId))
        .orderBy(desc(leaveRequests.createdAt));
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/leave-requests", isAuthenticated, async (req: Request, res: Response) => {
    const userId = (req.user as any).id;
    const { startDate, endDate, selectedDates, reason } = req.body;

    if (!startDate || !endDate || !reason) {
      return res.status(400).json({ message: "Data tidak lengkap" });
    }

    try {
      const datesStr = Array.isArray(selectedDates) ? selectedDates.join(",") : (selectedDates || startDate);
      await db.insert(leaveRequests).values({
        userId,
        startDate,
        endDate,
        selectedDates: datesStr,
        reason,
        status: "pending",
      });
      res.status(201).json({ message: "Pengajuan cuti berhasil diajukan" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/leave-requests/:id/cancel", isAuthenticated, async (req: Request, res: Response) => {
    const userId = (req.user as any).id;
    const targetId = Number(req.params.id);
    try {
      const [reqRecord] = await db.select().from(leaveRequests).where(and(eq(leaveRequests.id, targetId), eq(leaveRequests.userId, userId))).limit(1);
      if (!reqRecord) {
        return res.status(404).json({ message: "Pengajuan tidak ditemukan" });
      }
      await db.update(leaveRequests).set({ status: "cancelled" }).where(eq(leaveRequests.id, targetId));
      res.json({ message: "Pengajuan cuti berhasil dibatalkan" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/leave-balance", isAuthenticated, async (req: Request, res: Response) => {
    const userId = (req.user as any).id;
    try {
      // Find all approved leave requests
      const approvedRequests = await db
        .select()
        .from(leaveRequests)
        .where(and(eq(leaveRequests.userId, userId), eq(leaveRequests.status, "approved")));

      let used = 0;
      approvedRequests.forEach(req => {
        if (req.selectedDates) {
          used += req.selectedDates.split(",").length;
        } else if (req.startDate && req.endDate) {
          const diffTime = Math.abs(new Date(req.endDate).getTime() - new Date(req.startDate).getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
          used += diffDays;
        }
      });

      const limit = 12; // Standard jatah cuti limit
      const remaining = Math.max(0, limit - used);

      res.json({
        used,
        remaining,
        limit
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // 10. Employee Complaints & Upload
  app.get("/api/employee/complaints", isAuthenticated, async (req: Request, res: Response) => {
    const userId = (req.user as any).id;
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
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/employee/complaints", isAuthenticated, upload.array("photos"), async (req: Request, res: Response) => {
    const userId = (req.user as any).id;
    const { title, description } = req.body;
    const files = req.files as Express.Multer.File[];

    if (!title || !description) {
      return res.status(400).json({ message: "Data tidak lengkap" });
    }

    try {
      // Insert complaint
      const [insertResult] = await (db.insert(complaints) as any).values({
        userId,
        title,
        description,
        status: "pending",
      });

      const complaintId = insertResult.insertId;

      // Insert photos
      if (files && files.length > 0) {
        const username = (req.user as any).username;
        for (const file of files) {
          const photoUrl = await processSingleUpload(file, "complaint", username);
          await db.insert(complaintPhotos).values({
            complaintId,
            photoUrl: photoUrl || `/api/images/${file.filename}`,
            caption: file.originalname,
          });
        }
      }

      res.status(201).json({ message: "Pengaduan berhasil diajukan" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // 11. Employee popup notification checking
  // Cutoff date is 2026-06-10T04:00:00.000Z UTC (11:00 WIB)
  app.get("/api/employee/documents", isAuthenticated, async (req: Request, res: Response) => {
    const userId = (req.user as any).id;
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
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });


  // ================= ANNOUNCEMENTS (Info Board) =================

  // GET all announcements (public for authenticated users)
  app.get("/api/announcements", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const list = await db.select().from(announcements).orderBy(desc(announcements.createdAt));
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // POST create announcement (admin only)
  app.post("/api/announcements", isAdmin, upload.single("image"), async (req: Request, res: Response) => {
    try {
      const { title, content, expiresAt } = req.body;
      if (!title || !content) {
        return res.status(400).json({ message: "Judul dan konten wajib diisi" });
      }

      let imageUrl: string | null = null;
      if (req.file) {
        const username = (req.user as any).username;
        imageUrl = await processSingleUpload(req.file, "document", username);
      }

      const authorId = (req.user as any).id;
      await (db.insert(announcements) as any).values({
        title,
        content,
        imageUrl,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        authorId,
      });

      res.status(201).json({ message: "Informasi berhasil diterbitkan" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // PATCH update announcement (admin only)
  app.patch("/api/announcements/:id", isAdmin, upload.single("image"), async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const { title, content, expiresAt } = req.body;

      const updates: any = {};
      if (title) updates.title = title;
      if (content) updates.content = content;
      if (expiresAt) updates.expiresAt = new Date(expiresAt);
      if (req.file) {
        const username = (req.user as any).username;
        updates.imageUrl = await processSingleUpload(req.file, "document", username);
      }

      await db.update(announcements).set(updates).where(eq(announcements.id, id));
      res.json({ message: "Informasi berhasil diperbarui" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // DELETE announcement (admin only)
  app.delete("/api/announcements/:id", isAdmin, async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      await db.delete(announcements).where(eq(announcements.id, id));
      res.json({ message: "Informasi berhasil dihapus" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ================= ADMIN & SUPERADMIN =================

  // 1. Unverified employees list
  app.get("/api/admin/unverified-employees", isAdmin, async (req: Request, res: Response) => {
    try {
      const list = await db
        .select()
        .from(users)
        .where(eq(users.registrationStatus, "pending"));
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // 2. Approve/reject employee
  app.post("/api/admin/verify-employee/:id", isAdmin, async (req: Request, res: Response) => {
    const targetId = Number(req.params.id);
    const { action } = req.body; // "approve" or "reject"

    try {
      const status = action === "approve" ? "approved" : "rejected";
      await db
        .update(users)
        .set({ registrationStatus: status })
        .where(eq(users.id, targetId));

      res.json({ message: `Tenaga Kerja berhasil di-${action}` });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // 3. Get all active approved employees
  app.get("/api/admin/employees", isAdmin, async (req: Request, res: Response) => {
    try {
      const list = await db
        .select()
        .from(users)
        .where(and(eq(users.role, "employee"), eq(users.registrationStatus, "approved")));
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Get all users for admin list
  app.get("/api/admin/users", isAdmin, async (req: Request, res: Response) => {
    try {
      const list = await db
        .select()
        .from(users);
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Get activity logs (restricted to superadmin)
  app.get("/api/admin/activity-logs", isAdmin, async (req: Request, res: Response) => {
    if ((req.user as any).role !== "superadmin") {
      return res.status(403).json({ message: "Akses ditolak: Khusus Super Admin" });
    }
    try {
      const list = await db
        .select({
          id: activityLogs.id,
          userId: activityLogs.userId,
          action: activityLogs.action,
          details: activityLogs.details,
          createdAt: activityLogs.createdAt,
          userFullName: users.fullName,
          userRole: users.role,
        })
        .from(activityLogs)
        .leftJoin(users, eq(activityLogs.userId, users.id))
        .orderBy(desc(activityLogs.createdAt));

      res.json(list);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Create admin user
  app.post("/api/admin/users", isAdmin, upload.none(), async (req: Request, res: Response) => {
    try {
      const { fullName, username, password, role } = req.body;
      if (!fullName || !username || !password || !role) {
        return res.status(400).json({ message: "Semua kolom wajib diisi" });
      }

      // Check if username already exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      if (existingUser) {
        return res.status(400).json({ message: "Username sudah digunakan" });
      }

      const hashedPassword = await hashPassword(password);
      const [newUser] = await db.insert(users).values({
        fullName,
        username,
        password: hashedPassword,
        role,
        registrationStatus: "approved",
      });

      res.status(201).json(newUser);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Update admin user
  app.patch("/api/admin/users/:id", isAdmin, upload.none(), async (req: Request, res: Response) => {
    const targetId = Number(req.params.id);
    try {
      const { fullName, username, password, role } = req.body;
      const updateData: any = {};
      if (fullName) updateData.fullName = fullName;
      if (username) {
        // Check if username is taken by another user
        const [existingUser] = await db
          .select()
          .from(users)
          .where(eq(users.username, username))
          .limit(1);
        if (existingUser && existingUser.id !== targetId) {
          return res.status(400).json({ message: "Username sudah digunakan oleh user lain" });
        }
        updateData.username = username;
      }
      if (role) updateData.role = role;
      if (password && password.trim().length > 0) {
        updateData.password = await hashPassword(password);
      }

      await db.update(users).set(updateData).where(eq(users.id, targetId));
      const [updatedUser] = await db.select().from(users).where(eq(users.id, targetId)).limit(1);
      res.json(updatedUser);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // 4. Delete user permanently
  app.delete("/api/admin/users/:id", isAdmin, async (req: Request, res: Response) => {
    const targetId = Number(req.params.id);
    try {
      await db.delete(users).where(eq(users.id, targetId));
      res.json({ message: "User berhasil dihapus secara permanen" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // 5. Shift management
  app.get("/api/admin/shifts", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const list = await db.select().from(shifts);
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/shifts", isAdmin, async (req: Request, res: Response) => {
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
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // 6. Mutasi, Promosi, Demosi
  app.get("/api/admin/mutations", isAdmin, async (req: Request, res: Response) => {
    try {
      const list = await db.select().from(mutations).orderBy(desc(mutations.createdAt));
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/mutations", isAdmin, upload.single("document"), async (req: Request, res: Response) => {
    const { userId, type, oldBranch, newBranch, oldPosition, newPosition, notes } = req.body;
    if (!userId || !type) {
      return res.status(400).json({ message: "Data tidak lengkap" });
    }

    try {
      const username = (req.user as any).username;
      const docUrl = req.file ? await processSingleUpload(req.file, "document", username) : null;
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
      const updates: any = {};
      if (newBranch) updates.branch = newBranch;
      if (newPosition) updates.position = newPosition;
      if (Object.keys(updates).length > 0) {
        await db.update(users).set(updates).where(eq(users.id, Number(userId)));
      }

      res.status(201).json({ message: "Mutasi berhasil diterbitkan" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // 7. Warning Letters (SP)
  app.get("/api/admin/warning-letters", isAdmin, async (req: Request, res: Response) => {
    try {
      const list = await db.select().from(warningLetters).orderBy(desc(warningLetters.createdAt));
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/warning-letters", isAdmin, upload.single("document"), async (req: Request, res: Response) => {
    const { userId, type, startDate, endDate, notes } = req.body;
    if (!userId || !type || !startDate || !endDate) {
      return res.status(400).json({ message: "Data tidak lengkap" });
    }

    try {
      const username = (req.user as any).username;
      const docUrl = req.file ? await processSingleUpload(req.file, "document", username) : null;
      await db.insert(warningLetters).values({
        userId: Number(userId),
        type,
        startDate,
        endDate,
        documentUrl: docUrl,
        notes: notes || null,
      });
      res.status(201).json({ message: "Surat Peringatan berhasil diterbitkan" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/warning-letters/:id", isAdmin, async (req: Request, res: Response) => {
    const targetId = Number(req.params.id);
    try {
      await db.delete(warningLetters).where(eq(warningLetters.id, targetId));
      res.json({ message: "Surat Peringatan berhasil dihapus" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // 8. Resignations
  app.get("/api/admin/resignations", isAdmin, async (req: Request, res: Response) => {
    try {
      const list = await db.select().from(resignations).orderBy(desc(resignations.createdAt));
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/resignations", isAdmin, upload.single("document"), async (req: Request, res: Response) => {
    const { userId, resignDate, reason } = req.body;
    if (!userId || !resignDate || !reason) {
      return res.status(400).json({ message: "Data tidak lengkap" });
    }

    try {
      const username = (req.user as any).username;
      const docUrl = req.file ? await processSingleUpload(req.file, "document", username) : null;
      await db.insert(resignations).values({
        userId: Number(userId),
        resignDate,
        reason,
        documentUrl: docUrl,
      });

      // Update employee status to resigned/inactive in users
      await db.update(users).set({ registrationStatus: "rejected" }).where(eq(users.id, Number(userId)));

      res.status(201).json({ message: "Pemberhentian/Resign berhasil dicatat" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // 9. Leave requests validation
  app.get("/api/admin/leave-requests", isAdmin, async (req: Request, res: Response) => {
    try {
      const list = await db.select().from(leaveRequests).orderBy(desc(leaveRequests.createdAt));
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  const updateLeaveStatus = async (req: Request, res: Response) => {
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
        const datesToMark: string[] = [];
        if (leaveReq.selectedDates) {
          // If comma-separated dates are present
          datesToMark.push(...leaveReq.selectedDates.split(",").map(d => d.trim()));
        } else {
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
          } else {
            await db
              .update(attendance)
              .set({ status: "cuti", notes: `Cuti Disetujui: ${leaveReq.reason}` })
              .where(and(eq(attendance.userId, leaveReq.userId), eq(attendance.date, dateStr)));
          }
        }
      }

      res.json({ message: "Status cuti berhasil diperbarui" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  };

  app.patch("/api/admin/leave-requests/:id", isAdmin, updateLeaveStatus);
  app.put("/api/admin/leave-requests/:id", isAdmin, updateLeaveStatus);

  app.delete("/api/admin/leave-requests/:id", isAdmin, async (req: Request, res: Response) => {
    const targetId = Number(req.params.id);
    try {
      await db.delete(leaveRequests).where(eq(leaveRequests.id, targetId));
      res.json({ message: "Pengajuan cuti berhasil dihapus" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // 10. General Attendance logs retrieval (for rekap filters)
  app.get("/api/admin/attendance", isAdmin, async (req: Request, res: Response) => {
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
        query = query.where(and(...filters)) as any;
      }

      const list = await query.orderBy(desc(attendance.date), desc(attendance.sessionNumber));
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // 11. Complaints listing for admin
  app.get("/api/admin/complaints", isAdmin, async (req: Request, res: Response) => {
    try {
      const list = await db.select().from(complaints).orderBy(desc(complaints.createdAt));
      
      const response = [];
      for (const comp of list) {
        const photos = await db.select().from(complaintPhotos).where(eq(complaintPhotos.complaintId, comp.id));
        // Also fetch user info
        const [userInfo] = await db.select({ fullName: users.fullName, nik: users.nik }).from(users).where(eq(users.id, comp.userId)).limit(1);
        response.push({ ...comp, photos, userFullName: userInfo?.fullName || null });
      }
      res.json(response);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/admin/complaints/:id", isAdmin, async (req: Request, res: Response) => {
    const targetId = Number(req.params.id);
    const { status } = req.body; // "pending", "reviewed", "resolved"
    try {
      await db.update(complaints).set({ status }).where(eq(complaints.id, targetId));
      res.json({ message: "Status komplain diperbarui" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // PATCH alias for client compatibility
  app.patch("/api/admin/complaints/:id/status", isAdmin, async (req: Request, res: Response) => {
    const targetId = Number(req.params.id);
    const { status } = req.body; // "pending", "reviewed", "resolved"
    try {
      if (!["pending", "reviewed", "resolved"].includes(status)) {
        return res.status(400).json({ message: "Status tidak valid" });
      }
      await db.update(complaints).set({ status }).where(eq(complaints.id, targetId));
      res.json({ message: "Status komplain diperbarui" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Multer configuration for SQL files
  const sqlUpload = multer({
    dest: "uploads/",
    fileFilter: (req, file, cb) => {
      if (path.extname(file.originalname).toLowerCase() === ".sql") {
        cb(null, true);
      } else {
        cb(new Error("Hanya file SQL yang diperbolehkan") as any, false);
      }
    }
  });

  // Database Backup Listing
  app.get("/api/admin/backups", isAuthenticated, isAdmin, (req: Request, res: Response) => {
    const backupDir = path.resolve(process.cwd(), "backups");
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    try {
      const files = fs.readdirSync(backupDir);
      const backupList = files
        .filter(f => f.endsWith(".sql"))
        .map(f => {
          const stats = fs.statSync(path.join(backupDir, f));
          return {
            fileName: f,
            sizeBytes: stats.size,
            createdAt: stats.mtime,
          };
        })
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      res.json(backupList);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Database Manual Backup Creation
  app.post("/api/admin/backup", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return res.status(500).json({ success: false, message: "DATABASE_URL tidak dikonfigurasi" });
    }

    const backupDir = path.resolve(process.cwd(), "backups");
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    try {
      const regex = /mysql:\/\/([^:]+):([^@]+)@([^/:]+)(?::(\d+))?\/(.+)/;
      const matches = dbUrl.match(regex);
      if (!matches) {
        return res.status(500).json({ success: false, message: "Format DATABASE_URL tidak dikenal" });
      }

      const [_, user, password, host, portStr, database] = matches;
      const port = portStr || "3306";
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const fileName = `backup-${database}-${timestamp}.sql`;
      const outputFile = path.join(backupDir, fileName);

      const cmd = `mysqldump -h ${host} -P ${port} -u ${user} -p"${password}" ${database} > "${outputFile}"`;

      exec(cmd, (error) => {
        if (error) {
          console.error(`[Manual Backup] Failed: ${error.message}`);
          return res.status(500).json({ success: false, message: `Gagal membuat backup: ${error.message}` });
        } else {
          console.log(`[Manual Backup] Success: ${fileName}`);
          return res.json({ success: true, message: "Backup database berhasil dibuat", fileName });
        }
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // Download SQL Backup File
  app.get("/api/admin/backups/download/:fileName", isAuthenticated, isAdmin, (req: Request, res: Response) => {
    const backupDir = path.resolve(process.cwd(), "backups");
    const filePath = path.join(backupDir, req.params.fileName);

    if (!filePath.startsWith(backupDir)) {
      return res.status(403).json({ message: "Akses ditolak" });
    }

    if (fs.existsSync(filePath)) {
      res.download(filePath);
    } else {
      res.status(404).json({ message: "File backup tidak ditemukan" });
    }
  });

  // Import SQL Database file
  app.post("/api/admin/backups/import", isAuthenticated, isAdmin, sqlUpload.single("file"), async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ message: "File SQL wajib diunggah" });
    }

    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return res.status(500).json({ message: "DATABASE_URL tidak dikonfigurasi" });
    }

    const filePath = req.file.path;

    try {
      const regex = /mysql:\/\/([^:]+):([^@]+)@([^/:]+)(?::(\d+))?\/(.+)/;
      const matches = dbUrl.match(regex);
      if (!matches) {
        return res.status(500).json({ message: "Format DATABASE_URL tidak dikenal" });
      }

      const [_, user, password, host, portStr, database] = matches;
      const port = portStr || "3306";

      const cmd = `mysql -h ${host} -P ${port} -u ${user} -p"${password}" ${database} < "${filePath}"`;

      exec(cmd, (error) => {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }

        if (error) {
          console.error(`[Restore Database] Failed: ${error.message}`);
          return res.status(500).json({ message: `Gagal memulihkan database: ${error.message}` });
        } else {
          console.log(`[Restore Database] Success restoration`);
          return res.json({ success: true, message: "Database berhasil di-import/dipulihkan!" });
        }
      });
    } catch (e: any) {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      res.status(500).json({ message: e.message });
    }
  });
}
