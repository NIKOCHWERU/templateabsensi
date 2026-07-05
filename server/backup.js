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
    console.log("Database backup scheduler initialized (every 30 minutes).");
    // Run the backup task
    const runBackup = () => {
        try {
            // Parse mysql://user:password@host:port/database
            // Handles optional port e.g. mysql://user:password@host/database
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
                }
                else {
                    console.log(`[Backup Scheduler] Backup saved: ${path.basename(outputFile)}`);
                }
            });
        }
        catch (e) {
            console.error("[Backup Scheduler] Error in task execution:", e.message);
        }
    };
    // Run immediately on startup, then every 30 minutes
    setTimeout(runBackup, 1000);
    setInterval(runBackup, 30 * 60 * 1000);
}
