import express, { Request, Response, NextFunction } from "express";
import http from "http";
import path from "path";
import fs from "fs";
import { setupAuth, hashPassword } from "./auth.js";
import { registerRoutes } from "./routes.js";
import { pool } from "./db.js";
import { startBackupScheduler } from "./backup.js";

const app = express();
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// Dynamic DB Schema check and Auto-Migration
async function runAutoMigrations() {
  console.log("Checking database schemas for auto-migration...");
  const conn = await pool.getConnection();

  try {
    // 1. Create users table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NULL,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        role ENUM('admin', 'employee', 'superadmin') NOT NULL DEFAULT 'employee',
        nik VARCHAR(50) UNIQUE NULL,
        branch VARCHAR(100) NULL,
        position VARCHAR(100) NULL,
        shift VARCHAR(50) NULL,
        photo_url VARCHAR(512) NULL,
        is_admin BOOLEAN DEFAULT FALSE,
        phone_number VARCHAR(20) NULL,
        birth_place VARCHAR(100) NULL,
        birth_date DATE NULL,
        gender ENUM('Laki-laki', 'Perempuan') NULL,
        religion VARCHAR(50) NULL,
        address TEXT NULL,
        npwp VARCHAR(50) NULL,
        bpjs VARCHAR(50) NULL,
        npwp_photo_url VARCHAR(512) NULL,
        bpjs_photo_url VARCHAR(512) NULL,
        bank_account VARCHAR(100) NULL,
        ktp_photo_url VARCHAR(512) NULL,
        registration_status ENUM('unregistered', 'pending', 'approved', 'rejected') NOT NULL DEFAULT 'unregistered',
        join_date VARCHAR(50) NULL,
        employment_status VARCHAR(50) NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 2. Create shifts table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS shifts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        check_in_time VARCHAR(10) NOT NULL,
        check_out_time VARCHAR(10) NOT NULL,
        description TEXT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 3. Create attendance table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        date DATE NOT NULL,
        check_in TIMESTAMP NULL,
        check_in_photo VARCHAR(255) NULL,
        check_in_location TEXT NULL,
        break_start TIMESTAMP NULL,
        break_start_photo VARCHAR(255) NULL,
        break_start_location TEXT NULL,
        break_end TIMESTAMP NULL,
        break_end_photo VARCHAR(255) NULL,
        break_end_location TEXT NULL,
        check_out TIMESTAMP NULL,
        check_out_photo VARCHAR(255) NULL,
        check_out_location TEXT NULL,
        shift_id INT NULL,
        shift VARCHAR(50) NULL,
        session_number INT DEFAULT 1,
        status ENUM('present', 'late', 'sick', 'permission', 'cuti', 'absent', 'off') DEFAULT 'absent',
        notes TEXT NULL,
        late_reason TEXT NULL,
        late_reason_photo VARCHAR(255) NULL,
        permit_exit_at TIMESTAMP NULL,
        permit_resume_at TIMESTAMP NULL,
        is_fake_gps BOOLEAN DEFAULT FALSE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 4. Create leave_requests table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS leave_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        selected_dates TEXT NULL,
        reason TEXT NOT NULL,
        status ENUM('pending', 'approved', 'rejected', 'cancelled') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 5. Create complaints table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS complaints (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        status ENUM('pending', 'reviewed', 'resolved') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 6. Create complaint_photos table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS complaint_photos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        complaint_id INT NOT NULL,
        photo_url VARCHAR(512) NOT NULL,
        caption TEXT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 7. Create resignations table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS resignations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        resign_date DATE NOT NULL,
        reason TEXT NOT NULL,
        document_url VARCHAR(512) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 8. Create mutations table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS mutations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        type ENUM('mutasi', 'promosi', 'demosi') NOT NULL,
        old_branch VARCHAR(100) NULL,
        new_branch VARCHAR(100) NULL,
        old_position VARCHAR(100) NULL,
        new_position VARCHAR(100) NULL,
        document_url VARCHAR(512) NULL,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 9. Create warning_letters table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS warning_letters (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        type ENUM('SP1', 'SP2', 'SP3') NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        document_url VARCHAR(512) NULL,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 10. Create system_configs table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS system_configs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        \`key\` VARCHAR(255) UNIQUE NOT NULL,
        \`value\` TEXT NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 11. Create announcements table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS announcements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        image_url VARCHAR(512) NULL,
        expires_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        author_id INT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 12. Create activity_logs table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        action VARCHAR(255) NOT NULL,
        details TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_activity_logs_user_id (user_id),
        INDEX idx_activity_logs_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Seed default system configs
    const [configCheck]: any = await conn.query(`SELECT id FROM system_configs LIMIT 1`);
    if (configCheck.length === 0) {
      console.log("Seeding default system configs...");
      const defaultConfigKeys = [
        ["namaPt", process.env.VITE_NAMA_PT || "PT ABC"],
        ["singkatanPt", process.env.VITE_SINGKATAN_PT || "PT ABC"],
        ["deskripsiPwa", process.env.VITE_DESKRIPSI_PWA || "Aplikasi Absensi Tenaga Kerja"],
        ["logoUrl", process.env.VITE_LOGO_FILE || ""],
        ["logoInisial", process.env.VITE_LOGO_INISIAL || "A"],
        ["rekapPrefix", process.env.VITE_REKAP_FILE_PREFIX || "REKAP_ABSENSI"],
        ["feature_leave", process.env.FEATURE_LEAVE !== "false" ? "true" : "false"],
        ["feature_recap", process.env.FEATURE_RECAP !== "false" ? "true" : "false"],
        ["feature_complaint", process.env.FEATURE_COMPLAINT !== "false" ? "true" : "false"],
        ["feature_info", process.env.FEATURE_INFO !== "false" ? "true" : "false"],
        ["feature_mutation", process.env.FEATURE_MUTATION !== "false" ? "true" : "false"],
        ["feature_warningLetter", process.env.FEATURE_WARNING_LETTER !== "false" ? "true" : "false"],
        ["feature_shift", process.env.FEATURE_SHIFT !== "false" ? "true" : "false"],
        ["feature_resignation", process.env.FEATURE_RESIGNATION !== "false" ? "true" : "false"],
        ["feature_break", process.env.FEATURE_BREAK !== "false" ? "true" : "false"],
      ];

      for (const [key, value] of defaultConfigKeys) {
        await conn.query(`
          INSERT INTO system_configs (\`key\`, \`value\`)
          VALUES (?, ?)
        `, [key, value]);
      }
    }


    // --- Dynamic Column Checks for existing tables (in case columns are missing) ---
    const checkAndAddColumn = async (table: string, column: string, DDL: string) => {
      const [colCheck]: any = await conn.query(`
        SELECT COLUMN_NAME FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
      `, [table, column]);
      
      if (colCheck.length === 0) {
        console.log(`Adding missing column ${column} to table ${table}...`);
        await conn.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${DDL};`);
      }
    };

    await checkAndAddColumn("users", "npwp", "VARCHAR(50) NULL");
    await checkAndAddColumn("users", "bpjs", "VARCHAR(50) NULL");
    await checkAndAddColumn("users", "npwp_photo_url", "VARCHAR(512) NULL");
    await checkAndAddColumn("users", "bpjs_photo_url", "VARCHAR(512) NULL");
    await checkAndAddColumn("users", "ktp_photo_url", "VARCHAR(512) NULL");

    await checkAndAddColumn("attendance", "late_reason", "TEXT NULL");
    await checkAndAddColumn("attendance", "late_reason_photo", "VARCHAR(255) NULL");
    await checkAndAddColumn("attendance", "is_fake_gps", "BOOLEAN DEFAULT FALSE");

    // --- Default admin seeding ---
    const [adminCheck]: any = await conn.query(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`);
    if (adminCheck.length === 0) {
      console.log("Seeding default admin user...");
      const passHash = await hashPassword("admin123");
      await conn.query(`
        INSERT INTO users (username, password, full_name, role, registration_status, is_admin)
        VALUES ('admin', ?, 'Administrator', 'admin', 'approved', TRUE)
      `, [passHash]);
      console.log("Seeding completed: User 'admin' / Pass 'admin123'");
    }

    // --- Default shifts seeding ---
    const [shiftCheck]: any = await conn.query(`SELECT id FROM shifts LIMIT 1`);
    if (shiftCheck.length === 0) {
      console.log("Seeding default shifts...");
      await conn.query(`
        INSERT INTO shifts (name, check_in_time, check_out_time, description)
        VALUES 
        ('Shift Pagi (Normal)', '08:00', '17:00', 'Shift pagi utama senin-jumat'),
        ('Shift Sore', '14:00', '22:00', 'Shift sore/malam operasional')
      `);
    }

    console.log("Database checks and auto-migrations finished successfully.");
  } catch (e: any) {
    console.error("Auto-migration schema execution failed:", e.message);
  } finally {
    conn.release();
  }
}

async function startServer() {
  await runAutoMigrations();
  setupAuth(app);
  registerRoutes(app);
  startBackupScheduler();

  const PORT = Number(process.env.PORT) || 5000;
  const server = http.createServer(app);

  // Development vs Production hosting
  if (process.env.NODE_ENV !== "production") {
    // Dynamically mount Vite dev middleware
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: { server }
      },
      appType: "custom",
      root: path.resolve(process.cwd(), "client")
    });

    app.use(vite.middlewares);

    // HTML fallback serving
    app.use("*", async (req: Request, res: Response, next: NextFunction) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(
          path.resolve(process.cwd(), "client/index.html"),
          "utf-8"
        );
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    // Host production build bundle
    const distPath = path.resolve(process.cwd(), "dist/public");
    app.use(express.static(distPath));
    app.get("*", (req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on port ${PORT} (http://localhost:${PORT})`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start application server:", err);
});
