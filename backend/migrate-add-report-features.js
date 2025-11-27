// 數據庫遷移腳本：添加上報功能和場上手數
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DATABASE_PATH || 'C:/MT5_Monitor/data/monitor.db';

console.log(`Migrating database: ${dbPath}`);

try {
    const db = new Database(dbPath);
    
    console.log('Creating backup...');
    const backupPath = dbPath + '.backup_report_features_' + new Date().toISOString().replace(/[:.]/g, '-');
    try {
        db.backup(backupPath);
        console.log(`✓ Backup created: ${backupPath}`);
    } catch (backupError) {
        console.warn('⚠ Backup failed (non-critical):', backupError.message);
    }
    
    // 1. 檢查並添加 open_lots 欄位到 ab_stats 表
    console.log('\n=== Step 1: Adding open_lots to ab_stats ===');
    const abStatsColumns = db.prepare('PRAGMA table_info(ab_stats)').all();
    const hasOpenLots = abStatsColumns.some(c => c.name === 'open_lots');
    
    if (!hasOpenLots) {
        console.log('Adding open_lots column...');
        db.exec('ALTER TABLE ab_stats ADD COLUMN open_lots REAL DEFAULT 0');
        console.log('✓ Added open_lots to ab_stats');
    } else {
        console.log('- open_lots already exists in ab_stats');
    }
    
    // 2. 創建 report_requests 表
    console.log('\n=== Step 2: Creating report_requests table ===');
    const reportRequestsExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='report_requests'").get();
    
    if (!reportRequestsExists) {
        console.log('Creating report_requests table...');
        db.exec(`
            CREATE TABLE report_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                node_id TEXT,
                requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                consumed_at DATETIME,
                FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
            )
        `);
        console.log('✓ Created report_requests table');
    } else {
        console.log('- report_requests table already exists');
    }
    
    // 3. 驗證結果
    console.log('\n=== Verification ===');
    const finalColumns = db.prepare('PRAGMA table_info(ab_stats)').all();
    console.log('ab_stats columns:', finalColumns.map(c => c.name).join(', '));
    
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('All tables:', tables.map(t => t.name).join(', '));
    
    db.close();
    console.log('\n✅ Migration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Copy ecosystem.config.js to VPS');
    console.log('2. Update REPORT_TIME_1 and REPORT_TIME_2 in ecosystem.config.js if needed');
    console.log('3. Restart backend: pm2 restart mt5-monitor-backend');
    console.log('4. Update MT5 EA with new code');
    console.log('5. Deploy updated frontend');
    
} catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
}
