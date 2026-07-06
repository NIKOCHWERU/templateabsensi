import { exec } from "child_process";
import path from "path";
import fs from "fs";

export function startBackupScheduler() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.warn("DATABASE_URL not found, database backup scheduler disabled.");
    return;
  }

  const backupDir = path.resolve(process.cwd(), "backups");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  console.log("Database backup scheduler initialized (runs daily at 00:00).");

  const runBackup = () => {
    try {
      // Parse mysql://user:password@host:port/database
      const regex = /mysql:\/\/([^:]+):([^@]+)@([^/:]+)(?::(\d+))?\/(.+)/;
      const matches = dbUrl.match(regex);
      
      if (!matches) {
        console.warn("DATABASE_URL format not recognized for mysqldump. Backup skipped.");
        return;
      }

      const [_, user, password, host, portStr, database] = matches;
      const port = portStr || "3306";
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const outputFile = path.join(backupDir, `backup-${database}-${timestamp}.sql`);

      // Execute mysqldump
      const cmd = `mysqldump -h ${host} -P ${port} -u ${user} -p"${password}" ${database} > "${outputFile}"`;

      exec(cmd, (error) => {
        if (error) {
          console.error(`[Backup Scheduler] Failed to write backup: ${error.message}`);
        } else {
          console.log(`[Backup Scheduler] Backup saved: ${path.basename(outputFile)}`);
        }
      });
    } catch (e: any) {
      console.error("[Backup Scheduler] Error in task execution:", e.message);
    }
  };

  // Keep track of the date of the last backup to prevent multiple backups in the same minute
  let lastBackupDate = "";

  const checkAndRunBackup = () => {
    const now = new Date();
    const todayStr = now.toDateString();
    
    // Check if it's 00:00 and we haven't backed up today
    if (now.getHours() === 0 && now.getMinutes() === 0 && lastBackupDate !== todayStr) {
      lastBackupDate = todayStr;
      runBackup();
    }
  };

  // Run on startup once, then check every minute for 00:00
  setTimeout(runBackup, 1000);
  setInterval(checkAndRunBackup, 60 * 1000);
}
