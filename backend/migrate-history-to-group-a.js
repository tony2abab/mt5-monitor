/**
 * 遷移腳本：將舊的 daily_snapshots 數據遷移到 ab_stats 表並標記為 A 分組
 * 
 * 使用方法：
 * 1. 在 VPS 上執行：node migrate-history-to-group-a.js
 * 2. 這會將所有 daily_snapshots 中的數據創建對應的 ab_stats 記錄
 * 3. 這些記錄會關聯到一個虛擬節點 "HISTORY_A"，屬於 A 分組
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Database = require('better-sqlite3');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'data/monitor.db');
console.log('Using database:', dbPath);

const db = new Database(dbPath);

// 確保有一個虛擬節點用於歷史數據
function ensureHistoryNode() {
    const existingNode = db.prepare('SELECT id FROM nodes WHERE id = ?').get('HISTORY_A');
    if (!existingNode) {
        db.prepare(`
            INSERT INTO nodes (id, name, broker, account, client_group, status, created_at, updated_at)
            VALUES ('HISTORY_A', '歷史數據', 'Historical', 'Archive', 'A', 'offline', datetime('now'), datetime('now'))
        `).run();
        console.log('Created HISTORY_A node for historical data');
    } else {
        console.log('HISTORY_A node already exists');
    }
}

// 獲取所有 daily_snapshots
function getDailySnapshots() {
    const stmt = db.prepare('SELECT * FROM daily_snapshots ORDER BY snapshot_date ASC');
    return stmt.all();
}

// 檢查 ab_stats 是否已有該日期的 HISTORY_A 記錄
function hasHistoryRecord(date) {
    const stmt = db.prepare('SELECT id FROM ab_stats WHERE node_id = ? AND date = ?');
    return stmt.get('HISTORY_A', date) !== undefined;
}

// 將 daily_snapshot 遷移到 ab_stats
function migrateSnapshot(snapshot) {
    const date = snapshot.snapshot_date;
    
    if (hasHistoryRecord(date)) {
        console.log(`  Skipping ${date} - already migrated`);
        return false;
    }
    
    // 檢查 ab_stats 表結構
    const tableInfo = db.prepare('PRAGMA table_info(ab_stats)').all();
    const hasCommission = tableInfo.some(col => col.name === 'commission_per_lot');
    
    if (hasCommission) {
        db.prepare(`
            INSERT INTO ab_stats (
                node_id, date, 
                a_lots_total, b_lots_total, lots_diff,
                a_profit_total, b_profit_total, ab_profit_total,
                a_interest_total, commission_per_lot,
                reported_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `).run(
            'HISTORY_A',
            date,
            snapshot.total_a_lots || 0,
            snapshot.total_b_lots || 0,
            snapshot.total_lots_diff || 0,
            snapshot.total_a_profit || 0,
            snapshot.total_b_profit || 0,
            snapshot.total_ab_profit || 0,
            snapshot.total_a_interest || 0,
            0  // commission_per_lot
        );
    } else {
        db.prepare(`
            INSERT INTO ab_stats (
                node_id, date, 
                a_lots_total, b_lots_total, lots_diff,
                a_profit_total, b_profit_total, ab_profit_total,
                a_interest_total,
                reported_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `).run(
            'HISTORY_A',
            date,
            snapshot.total_a_lots || 0,
            snapshot.total_b_lots || 0,
            snapshot.total_lots_diff || 0,
            snapshot.total_a_profit || 0,
            snapshot.total_b_profit || 0,
            snapshot.total_ab_profit || 0,
            snapshot.total_a_interest || 0
        );
    }
    
    console.log(`  Migrated ${date}: AB profit = ${snapshot.total_ab_profit}`);
    return true;
}

// 主函數
function main() {
    console.log('=== Migration: daily_snapshots -> ab_stats (Group A) ===\n');
    
    // 確保有 HISTORY_A 節點
    ensureHistoryNode();
    
    // 獲取所有快照
    const snapshots = getDailySnapshots();
    console.log(`\nFound ${snapshots.length} daily snapshots to migrate\n`);
    
    let migrated = 0;
    let skipped = 0;
    
    for (const snapshot of snapshots) {
        if (migrateSnapshot(snapshot)) {
            migrated++;
        } else {
            skipped++;
        }
    }
    
    console.log(`\n=== Migration Complete ===`);
    console.log(`Migrated: ${migrated}`);
    console.log(`Skipped (already exists): ${skipped}`);
    console.log(`Total: ${snapshots.length}`);
}

main();
