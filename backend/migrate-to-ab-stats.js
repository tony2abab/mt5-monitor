// 完整的數據庫遷移腳本：創建 ab_stats 和 daily_snapshots 表，並添加回佣欄位
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DATABASE_PATH || 'C:/MT5_Monitor/data/monitor.db';

console.log(`Migrating database at: ${dbPath}`);

try {
    const db = new Database(dbPath);
    
    console.log('Creating backup...');
    const backupPath = dbPath + '.backup_full_migration_' + new Date().toISOString().replace(/[:.]/g, '-');
    db.backup(backupPath);
    console.log(`Backup created: ${backupPath}`);
    
    // 1. 檢查並創建 ab_stats 表
    console.log('\n=== Step 1: Creating ab_stats table ===');
    const abStatsExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ab_stats'").get();
    
    if (!abStatsExists) {
        console.log('Creating ab_stats table...');
        db.exec(`
            CREATE TABLE ab_stats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                node_id TEXT NOT NULL,
                date TEXT NOT NULL,
                a_lots_total REAL DEFAULT 0,
                b_lots_total REAL DEFAULT 0,
                lots_diff REAL DEFAULT 0,
                a_profit_total REAL DEFAULT 0,
                b_profit_total REAL DEFAULT 0,
                ab_profit_total REAL DEFAULT 0,
                a_interest_total REAL DEFAULT 0,
                cost_per_lot REAL DEFAULT 0,
                commission_per_lot REAL DEFAULT 0,
                reported_at TEXT,
                UNIQUE(node_id, date),
                FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
            )
        `);
        console.log('✓ Created ab_stats table with commission_per_lot');
    } else {
        console.log('ab_stats table already exists');
        
        // 檢查是否有 commission_per_lot 欄位
        const columns = db.prepare('PRAGMA table_info(ab_stats)').all();
        const hasCommission = columns.some(c => c.name === 'commission_per_lot');
        
        if (!hasCommission) {
            console.log('Adding commission_per_lot to ab_stats...');
            db.exec('ALTER TABLE ab_stats ADD COLUMN commission_per_lot REAL DEFAULT 0');
            console.log('✓ Added commission_per_lot to ab_stats');
        } else {
            console.log('- commission_per_lot already exists in ab_stats');
        }
    }
    
    // 2. 檢查並創建 daily_snapshots 表
    console.log('\n=== Step 2: Creating daily_snapshots table ===');
    const snapshotsExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='daily_snapshots'").get();
    
    if (!snapshotsExists) {
        console.log('Creating daily_snapshots table...');
        db.exec(`
            CREATE TABLE daily_snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                snapshot_date TEXT NOT NULL UNIQUE,
                total_nodes INTEGER DEFAULT 0,
                online_nodes INTEGER DEFAULT 0,
                offline_nodes INTEGER DEFAULT 0,
                total_a_lots REAL DEFAULT 0,
                total_b_lots REAL DEFAULT 0,
                total_lots_diff REAL DEFAULT 0,
                total_a_profit REAL DEFAULT 0,
                total_b_profit REAL DEFAULT 0,
                total_ab_profit REAL DEFAULT 0,
                total_a_interest REAL DEFAULT 0,
                total_commission REAL DEFAULT 0,
                total_cost_per_lot REAL DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now'))
            )
        `);
        console.log('✓ Created daily_snapshots table with total_commission');
    } else {
        console.log('daily_snapshots table already exists');
        
        // 檢查是否有 total_commission 欄位
        const columns = db.prepare('PRAGMA table_info(daily_snapshots)').all();
        const hasCommission = columns.some(c => c.name === 'total_commission');
        
        if (!hasCommission) {
            console.log('Adding total_commission to daily_snapshots...');
            db.exec('ALTER TABLE daily_snapshots ADD COLUMN total_commission REAL DEFAULT 0');
            console.log('✓ Added total_commission to daily_snapshots');
        } else {
            console.log('- total_commission already exists in daily_snapshots');
        }
    }
    
    // 3. 驗證表結構
    console.log('\n=== Step 3: Verifying table structures ===');
    
    console.log('\nab_stats columns:');
    const abStatsColumns = db.prepare('PRAGMA table_info(ab_stats)').all();
    abStatsColumns.forEach(c => {
        console.log(`  - ${c.name} (${c.type})`);
    });
    
    console.log('\ndaily_snapshots columns:');
    const snapshotsColumns = db.prepare('PRAGMA table_info(daily_snapshots)').all();
    snapshotsColumns.forEach(c => {
        console.log(`  - ${c.name} (${c.type})`);
    });
    
    // 4. 檢查數據
    console.log('\n=== Step 4: Checking data ===');
    const abStatsCount = db.prepare('SELECT COUNT(*) as count FROM ab_stats').get();
    console.log(`ab_stats records: ${abStatsCount.count}`);
    
    const snapshotsCount = db.prepare('SELECT COUNT(*) as count FROM daily_snapshots').get();
    console.log(`daily_snapshots records: ${snapshotsCount.count}`);
    
    db.close();
    console.log('\n✅ Database migration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Restart backend: pm2 restart mt5-monitor-backend');
    console.log('2. Update MQL5 EA to send commission_per_lot');
    console.log('3. Deploy frontend');
    
} catch (error) {
    console.error('❌ Error migrating database:', error);
    process.exit(1);
}
