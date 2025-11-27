const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class DatabaseManager {
    constructor() {
        const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/monitor.db');
        const dbDir = path.dirname(dbPath);
        
        // Ensure data directory exists
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }
        
        this.db = new Database(dbPath);
        this.db.pragma('journal_mode = WAL');
        this.initialize();
    }
    
    initialize() {
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        this.db.exec(schema);
        console.log('Database initialized successfully');
    }
    
    // Node operations
    upsertNode(nodeData) {
        const { id, name, broker, account, meta } = nodeData;
        const metaJson = meta ? JSON.stringify(meta) : null;
        
        const stmt = this.db.prepare(`
            INSERT INTO nodes (id, name, broker, account, meta, last_heartbeat, status, updated_at)
            VALUES (?, ?, ?, ?, ?, datetime('now'), 'online', datetime('now'))
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                broker = excluded.broker,
                account = excluded.account,
                meta = excluded.meta,
                last_heartbeat = excluded.last_heartbeat,
                status = 'online',
                updated_at = datetime('now')
        `);
        
        return stmt.run(id, name, broker, account, metaJson);
    }
    
    getNode(id) {
        const stmt = this.db.prepare('SELECT * FROM nodes WHERE id = ?');
        const node = stmt.get(id);
        if (node && node.meta) {
            try {
                node.meta = JSON.parse(node.meta);
            } catch (e) {
                node.meta = null;
            }
        }
        return node;
    }
    
    getAllNodes() {
        const stmt = this.db.prepare('SELECT * FROM nodes ORDER BY created_at DESC');
        const nodes = stmt.all();
        return nodes.map(node => {
            if (node.meta) {
                try {
                    node.meta = JSON.parse(node.meta);
                } catch (e) {
                    node.meta = null;
                }
            }
            return node;
        });
    }
    
    updateNodeStatus(id, status) {
        const stmt = this.db.prepare(`
            UPDATE nodes 
            SET status = ?, updated_at = datetime('now')
            WHERE id = ?
        `);
        return stmt.run(status, id);
    }
    
    // Stats operations
    upsertStats(statsData) {
        const { node_id, date, profit_loss, interest, avg_lots_success, lots_traded, ab_lots_diff } = statsData;
        
        const stmt = this.db.prepare(`
            INSERT INTO stats (node_id, date, profit_loss, interest, avg_lots_success, lots_traded, ab_lots_diff, reported_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(node_id, date) DO UPDATE SET
                profit_loss = excluded.profit_loss,
                interest = excluded.interest,
                avg_lots_success = excluded.avg_lots_success,
                lots_traded = excluded.lots_traded,
                ab_lots_diff = excluded.ab_lots_diff,
                reported_at = datetime('now')
        `);
        
        return stmt.run(node_id, date, profit_loss, interest, avg_lots_success, lots_traded, ab_lots_diff);
    }
    
    getLatestStats(nodeId, days = 7) {
        const stmt = this.db.prepare(`
            SELECT * FROM stats 
            WHERE node_id = ? 
            ORDER BY date DESC 
            LIMIT ?
        `);
        return stmt.all(nodeId, days);
    }
    
    getTodayStats(nodeId) {
        const stmt = this.db.prepare(`
            SELECT * FROM stats 
            WHERE node_id = ? AND date = date('now')
        `);
        return stmt.get(nodeId);
    }
    
    getAllTodayStats() {
        const stmt = this.db.prepare(`
            SELECT * FROM stats 
            WHERE date = date('now')
        `);
        return stmt.all();
    }
    
    // AB Stats operations
    upsertABStats(data) {
        const {
            node_id, date,
            a_lots_total, b_lots_total, lots_diff,
            a_profit_total, b_profit_total, ab_profit_total,
            a_interest_total, cost_per_lot, commission_per_lot, open_lots
        } = data;
        
        const stmt = this.db.prepare(`
            INSERT INTO ab_stats (
                node_id, date, 
                a_lots_total, b_lots_total, lots_diff,
                a_profit_total, b_profit_total, ab_profit_total,
                a_interest_total, cost_per_lot, commission_per_lot, open_lots, reported_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(node_id, date) DO UPDATE SET
                a_lots_total = excluded.a_lots_total,
                b_lots_total = excluded.b_lots_total,
                lots_diff = excluded.lots_diff,
                a_profit_total = excluded.a_profit_total,
                b_profit_total = excluded.b_profit_total,
                ab_profit_total = excluded.ab_profit_total,
                a_interest_total = excluded.a_interest_total,
                cost_per_lot = excluded.cost_per_lot,
                commission_per_lot = excluded.commission_per_lot,
                open_lots = excluded.open_lots,
                reported_at = datetime('now')
        `);
        
        return stmt.run(
            node_id, date,
            a_lots_total, b_lots_total, lots_diff,
            a_profit_total, b_profit_total, ab_profit_total,
            a_interest_total, cost_per_lot, commission_per_lot || 0, open_lots || 0
        );
    }
    
    getLatestABStats(nodeId, days = 7) {
        const stmt = this.db.prepare(`
            SELECT * FROM ab_stats 
            WHERE node_id = ? 
            ORDER BY date DESC 
            LIMIT ?
        `);
        return stmt.all(nodeId, days);
    }
    
    getTodayABStats(nodeId) {
        const stmt = this.db.prepare(`
            SELECT * FROM ab_stats 
            WHERE node_id = ? AND date = date('now')
        `);
        return stmt.get(nodeId);
    }
    
    getAllTodayABStats() {
        // 獲取當前交易日的數據
        // 如果倫敦時間在 00:00-01:30 之間，顯示前一天的數據
        const tradingDate = this.getCurrentTradingDate();
        
        const stmt = this.db.prepare(`
            SELECT * FROM ab_stats 
            WHERE date = ?
        `);
        return stmt.all(tradingDate);
    }
    
    /**
     * 獲取指定日期的所有 AB 統計數據
     * @param {string} date - YYYY-MM-DD 格式的日期
     */
    getAllABStatsByDate(date) {
        const stmt = this.db.prepare(`
            SELECT * FROM ab_stats 
            WHERE date = ?
        `);
        return stmt.all(date);
    }
    
    /**
     * 獲取當前交易日期
     * CFD平台時間 00:00-01:30 之間算前一天，01:30 之後算當天
     */
    getCurrentTradingDate() {
        const now = new Date();
        const timezone = process.env.TRADING_TIMEZONE || 'Europe/Athens';
        
        // 轉換為 CFD 平台時間
        const platformTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
        
        const hours = platformTime.getHours();
        const minutes = platformTime.getMinutes();
        const timeInMinutes = hours * 60 + minutes;
        
        // 如果在 00:00-01:30 之間（0-90 分鐘），使用前一天的日期
        if (timeInMinutes < 90) { // 01:30 = 90 分鐘
            platformTime.setDate(platformTime.getDate() - 1);
        }
        
        // 返回 YYYY-MM-DD 格式
        const year = platformTime.getFullYear();
        const month = String(platformTime.getMonth() + 1).padStart(2, '0');
        const day = String(platformTime.getDate()).padStart(2, '0');
        
        return `${year}-${month}-${day}`;
    }
    
    // Clear all stats (legacy + AB) but keep nodes / heartbeats
    clearAllStats() {
        const stmt = this.db.prepare('DELETE FROM stats');
        return stmt.run();
    }

    clearAllABStats() {
        const stmt = this.db.prepare('DELETE FROM ab_stats');
        return stmt.run();
    }
    
    // State transition operations
    addStateTransition(nodeId, fromStatus, toStatus) {
        const stmt = this.db.prepare(`
            INSERT INTO state_transitions (node_id, from_status, to_status, at)
            VALUES (?, ?, ?, datetime('now'))
        `);
        return stmt.run(nodeId, fromStatus, toStatus);
    }
    
    markTransitionNotified(id) {
        const stmt = this.db.prepare(`
            UPDATE state_transitions 
            SET notified = 1 
            WHERE id = ?
        `);
        return stmt.run(id);
    }
    
    getUnnotifiedTransitions() {
        const stmt = this.db.prepare(`
            SELECT st.*, n.name, n.broker, n.account, n.last_heartbeat
            FROM state_transitions st
            JOIN nodes n ON st.node_id = n.id
            WHERE st.notified = 0
            ORDER BY st.at ASC
        `);
        return stmt.all();
    }
    
    // Audit log operations
    addAuditLog(endpoint, method, ip, nodeId, payloadSummary, responseStatus) {
        const stmt = this.db.prepare(`
            INSERT INTO audit_log (endpoint, method, ip, node_id, payload_summary, response_status, at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        `);
        return stmt.run(endpoint, method, ip, nodeId, payloadSummary, responseStatus);
    }
    
    // Cleanup old audit logs (keep last 30 days)
    cleanupAuditLogs(days = 30) {
        const stmt = this.db.prepare(`
            DELETE FROM audit_log 
            WHERE at < datetime('now', '-' || ? || ' days')
        `);
        return stmt.run(days);
    }
    
    // Daily snapshot operations
    createDailySnapshot(snapshotData) {
        const { 
            snapshot_date, 
            total_nodes, 
            online_nodes, 
            offline_nodes,
            total_a_lots,
            total_b_lots,
            total_lots_diff,
            total_a_profit,
            total_b_profit,
            total_ab_profit,
            total_a_interest,
            total_commission,
            total_cost_per_lot
        } = snapshotData;
        
        const stmt = this.db.prepare(`
            INSERT INTO daily_snapshots (
                snapshot_date, total_nodes, online_nodes, offline_nodes,
                total_a_lots, total_b_lots, total_lots_diff,
                total_a_profit, total_b_profit, total_ab_profit,
                total_a_interest, total_commission, total_cost_per_lot
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(snapshot_date) DO UPDATE SET
                total_nodes = excluded.total_nodes,
                online_nodes = excluded.online_nodes,
                offline_nodes = excluded.offline_nodes,
                total_a_lots = excluded.total_a_lots,
                total_b_lots = excluded.total_b_lots,
                total_lots_diff = excluded.total_lots_diff,
                total_a_profit = excluded.total_a_profit,
                total_b_profit = excluded.total_b_profit,
                total_ab_profit = excluded.total_ab_profit,
                total_a_interest = excluded.total_a_interest,
                total_commission = excluded.total_commission,
                total_cost_per_lot = excluded.total_cost_per_lot,
                created_at = datetime('now')
        `);
        
        return stmt.run(
            snapshot_date, 
            total_nodes, 
            online_nodes, 
            offline_nodes,
            total_a_lots,
            total_b_lots,
            total_lots_diff,
            total_a_profit,
            total_b_profit,
            total_ab_profit,
            total_a_interest,
            total_commission || 0,
            total_cost_per_lot
        );
    }
    
    getAllDailySnapshots() {
        const stmt = this.db.prepare(`
            SELECT * FROM daily_snapshots 
            ORDER BY snapshot_date DESC
        `);
        return stmt.all();
    }
    
    getDailySnapshotByDate(date) {
        const stmt = this.db.prepare(`
            SELECT * FROM daily_snapshots 
            WHERE snapshot_date = ?
        `);
        return stmt.get(date);
    }
    
    getDailySnapshotsByDateRange(startDate, endDate) {
        const stmt = this.db.prepare(`
            SELECT * FROM daily_snapshots 
            WHERE snapshot_date >= ? AND snapshot_date <= ?
            ORDER BY snapshot_date DESC
        `);
        return stmt.all(startDate, endDate);
    }
    
    getLatestSnapshot() {
        const stmt = this.db.prepare(`
            SELECT * FROM daily_snapshots 
            ORDER BY snapshot_date DESC 
            LIMIT 1
        `);
        return stmt.get();
    }
    
    // Report request operations
    createReportRequest(nodeId = null) {
        if (nodeId === null) {
            // 全局請求：為每個現有節點創建單獨的請求記錄
            const nodes = this.getAllNodes();
            const stmt = this.db.prepare(`
                INSERT INTO report_requests (node_id, requested_at)
                VALUES (?, datetime('now'))
            `);
            
            let count = 0;
            for (const node of nodes) {
                stmt.run(node.id);
                count++;
            }
            console.log(`[DB] Created report requests for ${count} nodes`);
            return { changes: count };
        } else {
            // 單個節點請求
            const stmt = this.db.prepare(`
                INSERT INTO report_requests (node_id, requested_at)
                VALUES (?, datetime('now'))
            `);
            return stmt.run(nodeId);
        }
    }
    
    checkReportRequest(nodeId) {
        // 只檢查該節點的請求（不再支持 NULL 全局請求）
        const stmt = this.db.prepare(`
            SELECT * FROM report_requests 
            WHERE node_id = ?
            AND consumed_at IS NULL
            ORDER BY requested_at DESC
            LIMIT 1
        `);
        return stmt.get(nodeId);
    }
    
    consumeReportRequest(requestId) {
        const stmt = this.db.prepare(`
            UPDATE report_requests 
            SET consumed_at = datetime('now')
            WHERE id = ?
        `);
        return stmt.run(requestId);
    }
    
    cleanOldReportRequests(daysToKeep = 7) {
        const stmt = this.db.prepare(`
            DELETE FROM report_requests 
            WHERE requested_at < datetime('now', '-' || ? || ' days')
        `);
        return stmt.run(daysToKeep);
    }
    
    close() {
        this.db.close();
    }
}

module.exports = new DatabaseManager();
