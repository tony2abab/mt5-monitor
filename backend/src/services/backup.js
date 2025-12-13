const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

class BackupService {
    constructor() {
        this.job = null;
        // 備份目錄基於 DB_PATH 的目錄，確保備份和數據庫在同一位置
        this.dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/monitor.db');
        const dbDir = path.dirname(this.dbPath);
        this.backupDir = process.env.BACKUP_DIR || path.join(dbDir, 'backups');
        this.retentionDays = 14; // 保留 14 天備份
    }

    /**
     * 啟動備份服務
     * 每天凌晨 1:00 執行備份
     */
    start() {
        // 確保備份目錄存在
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
            console.log(`[Backup] Created backup directory: ${this.backupDir}`);
        }

        // 每天凌晨 1:00 執行備份 (本地時間)
        this.job = cron.schedule('0 1 * * *', () => {
            this.createBackup();
        });

        console.log(`[Backup] Backup service started - Daily backups at 01:00`);
        console.log(`[Backup] Backup directory: ${this.backupDir}`);
        console.log(`[Backup] Database path: ${this.dbPath}`);
        console.log(`[Backup] Retention: ${this.retentionDays} days`);

        // 啟動時立即檢查是否需要備份（如果今天還沒備份）
        this.checkAndBackupIfNeeded();
    }

    /**
     * 檢查今天是否已備份，如果沒有則立即備份
     */
    checkAndBackupIfNeeded() {
        const today = new Date().toISOString().split('T')[0];
        const todayBackup = path.join(this.backupDir, `monitor_${today}.db`);

        if (!fs.existsSync(todayBackup)) {
            console.log(`[Backup] No backup found for today (${today}), creating now...`);
            this.createBackup();
        } else {
            console.log(`[Backup] Today's backup already exists: ${todayBackup}`);
        }
    }

    /**
     * 創建數據庫備份
     */
    createBackup() {
        try {
            const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            const backupFileName = `monitor_${timestamp}.db`;
            const backupPath = path.join(this.backupDir, backupFileName);

            // 檢查源數據庫是否存在
            if (!fs.existsSync(this.dbPath)) {
                console.error(`[Backup] ERROR: Database not found at ${this.dbPath}`);
                return false;
            }

            // 複製數據庫文件
            fs.copyFileSync(this.dbPath, backupPath);

            const stats = fs.statSync(backupPath);
            console.log(`[Backup] Backup created: ${backupFileName} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

            // 清理舊備份
            this.cleanOldBackups();

            return true;
        } catch (error) {
            console.error(`[Backup] ERROR creating backup: ${error.message}`);
            return false;
        }
    }

    /**
     * 清理超過保留期限的舊備份
     */
    cleanOldBackups() {
        try {
            const files = fs.readdirSync(this.backupDir);
            const now = new Date();
            const cutoffDate = new Date(now.getTime() - (this.retentionDays * 24 * 60 * 60 * 1000));

            let deletedCount = 0;

            files.forEach(file => {
                if (!file.startsWith('monitor_') || !file.endsWith('.db')) {
                    return;
                }

                // 從文件名提取日期 (monitor_YYYY-MM-DD.db)
                const dateMatch = file.match(/monitor_(\d{4}-\d{2}-\d{2})\.db/);
                if (!dateMatch) {
                    return;
                }

                const fileDate = new Date(dateMatch[1]);
                if (fileDate < cutoffDate) {
                    const filePath = path.join(this.backupDir, file);
                    fs.unlinkSync(filePath);
                    console.log(`[Backup] Deleted old backup: ${file}`);
                    deletedCount++;
                }
            });

            if (deletedCount > 0) {
                console.log(`[Backup] Cleaned up ${deletedCount} old backup(s)`);
            }
        } catch (error) {
            console.error(`[Backup] ERROR cleaning old backups: ${error.message}`);
        }
    }

    /**
     * 列出所有備份
     */
    listBackups() {
        try {
            if (!fs.existsSync(this.backupDir)) {
                return [];
            }

            const files = fs.readdirSync(this.backupDir);
            const backups = [];

            files.forEach(file => {
                if (!file.startsWith('monitor_') || !file.endsWith('.db')) {
                    return;
                }

                const filePath = path.join(this.backupDir, file);
                const stats = fs.statSync(filePath);
                const dateMatch = file.match(/monitor_(\d{4}-\d{2}-\d{2})\.db/);

                backups.push({
                    filename: file,
                    date: dateMatch ? dateMatch[1] : 'unknown',
                    size: stats.size,
                    sizeFormatted: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
                    created: stats.mtime
                });
            });

            // 按日期排序（最新的在前）
            backups.sort((a, b) => new Date(b.date) - new Date(a.date));

            return backups;
        } catch (error) {
            console.error(`[Backup] ERROR listing backups: ${error.message}`);
            return [];
        }
    }

    /**
     * 手動觸發備份
     */
    manualBackup() {
        console.log('[Backup] Manual backup triggered');
        return this.createBackup();
    }

    /**
     * 停止備份服務
     */
    stop() {
        if (this.job) {
            this.job.stop();
            console.log('[Backup] Backup service stopped');
        }
    }
}

module.exports = new BackupService();
