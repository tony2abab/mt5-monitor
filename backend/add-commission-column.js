// 添加回佣欄位到數據庫
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../data/monitor.db');

console.log(`Updating database at: ${dbPath}`);

try {
    const db = new Database(dbPath);
    
    console.log('Creating backup...');
    const backupPath = dbPath + '.backup_commission_' + new Date().toISOString().replace(/[:.]/g, '-');
    db.backup(backupPath);
    console.log(`Backup created: ${backupPath}`);
    
    // 添加 commission_per_lot 到 ab_stats 表
    console.log('\nAdding commission_per_lot to ab_stats table...');
    try {
        db.exec('ALTER TABLE ab_stats ADD COLUMN commission_per_lot REAL DEFAULT 2.0');
        console.log('✓ Added commission_per_lot to ab_stats');
    } catch (err) {
        if (err.message.includes('duplicate column name')) {
            console.log('- Column already exists in ab_stats');
        } else {
            throw err;
        }
    }
    
    // 添加 total_commission 到 daily_snapshots 表
    console.log('\nAdding total_commission to daily_snapshots table...');
    try {
        // 檢查表是否存在
        const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='daily_snapshots'").get();
        if (!tableExists) {
            console.log('- Table daily_snapshots does not exist, skipping');
        } else {
            db.exec('ALTER TABLE daily_snapshots ADD COLUMN total_commission REAL DEFAULT 0');
            console.log('✓ Added total_commission to daily_snapshots');
        }
    } catch (err) {
        if (err.message.includes('duplicate column name')) {
            console.log('- Column already exists in daily_snapshots');
        } else {
            throw err;
        }
    }
    
    console.log('\nVerifying ab_stats structure...');
    const abStatsColumns = db.prepare('PRAGMA table_info(ab_stats)').all();
    console.log('ab_stats columns:', abStatsColumns.map(c => c.name).join(', '));
    
    const snapshotTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='daily_snapshots'").get();
    if (snapshotTableExists) {
        console.log('\nVerifying daily_snapshots structure...');
        const snapshotsColumns = db.prepare('PRAGMA table_info(daily_snapshots)').all();
        console.log('daily_snapshots columns:', snapshotsColumns.map(c => c.name).join(', '));
    }
    
    db.close();
    console.log('\n✅ Database update completed successfully!');
    
} catch (error) {
    console.error('❌ Error updating database:', error);
    process.exit(1);
}
