// 修正數據庫中已存在的 commission_per_lot 數據
// 將所有舊數據的 commission_per_lot 從 2.0 改為 0
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DATABASE_PATH || 'C:/MT5_Monitor/data/monitor.db';

console.log(`Fixing commission data in: ${dbPath}`);

try {
    const db = new Database(dbPath);
    
    console.log('Creating backup...');
    const backupPath = dbPath + '.backup_fix_commission_' + new Date().toISOString().replace(/[:.]/g, '-');
    db.backup(backupPath);
    console.log(`Backup created: ${backupPath}`);
    
    // 檢查當前有多少條記錄的 commission_per_lot = 2.0
    const countStmt = db.prepare('SELECT COUNT(*) as count FROM ab_stats WHERE commission_per_lot = 2.0');
    const result = countStmt.get();
    console.log(`\nFound ${result.count} records with commission_per_lot = 2.0`);
    
    if (result.count > 0) {
        // 將所有 commission_per_lot = 2.0 的記錄改為 0
        console.log('Updating records to commission_per_lot = 0...');
        const updateStmt = db.prepare('UPDATE ab_stats SET commission_per_lot = 0 WHERE commission_per_lot = 2.0');
        const updateResult = updateStmt.run();
        console.log(`✓ Updated ${updateResult.changes} records`);
    } else {
        console.log('No records need to be updated.');
    }
    
    // 驗證結果
    console.log('\nVerifying results:');
    const statsStmt = db.prepare(`
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN commission_per_lot = 0 THEN 1 ELSE 0 END) as zero_commission,
            SUM(CASE WHEN commission_per_lot > 0 THEN 1 ELSE 0 END) as has_commission
        FROM ab_stats
    `);
    const stats = statsStmt.get();
    console.log(`Total records: ${stats.total}`);
    console.log(`Records with commission = 0: ${stats.zero_commission}`);
    console.log(`Records with commission > 0: ${stats.has_commission}`);
    
    db.close();
    console.log('\n✅ Commission data fixed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Restart backend: pm2 restart mt5-monitor-backend');
    console.log('2. Only MT5 instances that send commission_per_lot will show commission');
    
} catch (error) {
    console.error('❌ Error fixing commission data:', error);
    process.exit(1);
}
