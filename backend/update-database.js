// 數據庫結構更新腳本
const Database = require('better-sqlite3');
const path = require('path');

// 使用環境變數或默認路徑
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../data/monitor.db');

console.log(`Updating database at: ${dbPath}`);

try {
    const db = new Database(dbPath);
    
    console.log('Creating backup...');
    const backupPath = dbPath + '.backup_' + new Date().toISOString().replace(/[:.]/g, '-');
    db.backup(backupPath).then(() => {
        console.log(`Backup created: ${backupPath}`);
    });
    
    console.log('\nChecking current table structure...');
    const columns = db.prepare('PRAGMA table_info(daily_snapshots)').all();
    console.log('Current columns:', columns.map(c => c.name).join(', '));
    
    const existingColumns = columns.map(c => c.name);
    
    // 添加缺失的欄位
    const newColumns = [
        { name: 'total_lots_diff', type: 'REAL DEFAULT 0' },
        { name: 'total_a_profit', type: 'REAL DEFAULT 0' },
        { name: 'total_b_profit', type: 'REAL DEFAULT 0' },
        { name: 'total_cost_per_lot', type: 'REAL DEFAULT 0' }
    ];
    
    console.log('\nAdding new columns...');
    newColumns.forEach(col => {
        if (!existingColumns.includes(col.name)) {
            try {
                db.exec(`ALTER TABLE daily_snapshots ADD COLUMN ${col.name} ${col.type}`);
                console.log(`✓ Added column: ${col.name}`);
            } catch (err) {
                if (err.message.includes('duplicate column name')) {
                    console.log(`- Column already exists: ${col.name}`);
                } else {
                    throw err;
                }
            }
        } else {
            console.log(`- Column already exists: ${col.name}`);
        }
    });
    
    console.log('\nVerifying updated structure...');
    const updatedColumns = db.prepare('PRAGMA table_info(daily_snapshots)').all();
    console.log('Updated columns:', updatedColumns.map(c => c.name).join(', '));
    
    db.close();
    console.log('\n✅ Database update completed successfully!');
    
} catch (error) {
    console.error('❌ Error updating database:', error);
    process.exit(1);
}
