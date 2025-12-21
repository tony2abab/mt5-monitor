const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class DatabaseManager {
    constructor() {
        const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/monitor.db');
        const dbDir = path.dirname(dbPath);
        
        // 顯示資料庫路徑（用於調試）
        console.log('=== Database Configuration ===');
        console.log('DB_PATH env:', process.env.DB_PATH || '(not set)');
        console.log('Using database:', dbPath);
        
        // Ensure data directory exists
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }
        
        // 檢查資料庫文件大小
        if (fs.existsSync(dbPath)) {
            const stats = fs.statSync(dbPath);
            console.log('Database size:', (stats.size / 1024).toFixed(2), 'KB');
        } else {
            console.log('Database file does not exist, will be created');
        }
        console.log('==============================');
        
        this.db = new Database(dbPath);
        this.db.pragma('journal_mode = WAL');
        this.initialize();
    }
    
    initialize() {
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        this.db.exec(schema);
        
        // 資料庫遷移：為現有 nodes 表添加場上數據欄位
        this.migrateNodesTable();
        
        // 資料庫遷移：更新 VPS 告警閾值
        this.migrateVPSThresholds();
        
        // 資料庫遷移：為 vps_metrics 表添加 cpu_queue_length_ultra 欄位
        this.migrateVPSMetrics();
        
        console.log('Database initialized successfully');
    }
    
    // 資料庫遷移：添加場上數據欄位到 nodes 表
    migrateNodesTable() {
        const columns = [
            { name: 'nav', type: 'REAL DEFAULT 0' },
            { name: 'open_buy_lots', type: 'REAL DEFAULT 0' },
            { name: 'open_sell_lots', type: 'REAL DEFAULT 0' },
            { name: 'floating_pl', type: 'REAL DEFAULT 0' },
            { name: 'balance', type: 'REAL DEFAULT 0' },
            { name: 'equity', type: 'REAL DEFAULT 0' }
        ];
        
        for (const col of columns) {
            try {
                // 檢查欄位是否存在
                const tableInfo = this.db.prepare("PRAGMA table_info(nodes)").all();
                const columnExists = tableInfo.some(c => c.name === col.name);
                
                if (!columnExists) {
                    this.db.exec(`ALTER TABLE nodes ADD COLUMN ${col.name} ${col.type}`);
                    console.log(`Migration: Added column ${col.name} to nodes table`);
                }
            } catch (err) {
                // 欄位可能已存在，忽略錯誤
                if (!err.message.includes('duplicate column')) {
                    console.error(`Migration error for ${col.name}:`, err.message);
                }
            }
        }
    }
    
    // 資料庫遷移：更新 VPS 告警閾值
    migrateVPSThresholds() {
        try {
            // 更新 CPU 隊列的閾值：警告 5.0，嚴重 20.0
            const stmt = this.db.prepare(`
                UPDATE vps_alert_thresholds 
                SET warning_threshold = 5.0, critical_threshold = 20.0, updated_at = datetime('now')
                WHERE metric_name = 'cpu_queue_length' 
                AND (warning_threshold != 5.0 OR critical_threshold != 20.0)
            `);
            const result = stmt.run();
            if (result.changes > 0) {
                console.log('Migration: Updated cpu_queue_length thresholds to warning=5.0, critical=20.0');
            }
        } catch (err) {
            console.error('Migration error for VPS thresholds:', err.message);
        }
    }
    
    // 資料庫遷移：為 vps_metrics 表添加 cpu_queue_length_ultra 欄位
    migrateVPSMetrics() {
        try {
            // 檢查欄位是否存在
            const tableInfo = this.db.prepare("PRAGMA table_info(vps_metrics)").all();
            const columnExists = tableInfo.some(c => c.name === 'cpu_queue_length_ultra');
            
            if (!columnExists) {
                this.db.exec('ALTER TABLE vps_metrics ADD COLUMN cpu_queue_length_ultra REAL DEFAULT 0');
                console.log('Migration: Added cpu_queue_length_ultra column to vps_metrics table');
            }
        } catch (err) {
            console.error('Migration error for VPS metrics:', err.message);
        }
    }
    
    // Node operations
    upsertNode(nodeData) {
        const { 
            id, name, broker, account, meta, client_group,
            // 帳戶淨值 NAV (始終發送)
            nav,
            // Monitor_OnlyHeartbeat 模式的場上數據
            open_buy_lots, open_sell_lots, floating_pl, balance, equity
        } = nodeData;
        const metaJson = meta ? JSON.stringify(meta) : null;
        // 如果沒有提供 name，使用 id 作為 name（向後兼容）
        const nodeName = name || id;
        
        // 檢查是否有場上數據
        const hasOpenData = open_buy_lots !== undefined || open_sell_lots !== undefined || 
                           floating_pl !== undefined || balance !== undefined || equity !== undefined;
        
        if (hasOpenData) {
            // 包含場上數據的更新
            const stmt = this.db.prepare(`
                INSERT INTO nodes (id, name, broker, account, client_group, meta, last_heartbeat, status, updated_at,
                                   nav, open_buy_lots, open_sell_lots, floating_pl, balance, equity)
                VALUES (?, ?, ?, ?, ?, ?, datetime('now'), 'online', datetime('now'), ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    name = COALESCE(excluded.name, name, excluded.id),
                    broker = excluded.broker,
                    account = excluded.account,
                    client_group = COALESCE(excluded.client_group, client_group, 'A'),
                    meta = excluded.meta,
                    last_heartbeat = excluded.last_heartbeat,
                    status = 'online',
                    updated_at = datetime('now'),
                    nav = excluded.nav,
                    open_buy_lots = excluded.open_buy_lots,
                    open_sell_lots = excluded.open_sell_lots,
                    floating_pl = excluded.floating_pl,
                    balance = excluded.balance,
                    equity = excluded.equity
            `);
            
            return stmt.run(id, nodeName, broker, account, client_group || 'A', metaJson,
                           nav || 0, open_buy_lots || 0, open_sell_lots || 0, floating_pl || 0, balance || 0, equity || 0);
        } else {
            // 普通心跳（包含 NAV 但不更新其他場上數據）
            const stmt = this.db.prepare(`
                INSERT INTO nodes (id, name, broker, account, client_group, meta, last_heartbeat, status, updated_at, nav)
                VALUES (?, ?, ?, ?, ?, ?, datetime('now'), 'online', datetime('now'), ?)
                ON CONFLICT(id) DO UPDATE SET
                    name = COALESCE(excluded.name, name, excluded.id),
                    broker = excluded.broker,
                    account = excluded.account,
                    client_group = COALESCE(excluded.client_group, client_group, 'A'),
                    meta = excluded.meta,
                    last_heartbeat = excluded.last_heartbeat,
                    status = 'online',
                    updated_at = datetime('now'),
                    nav = excluded.nav
            `);
            
            return stmt.run(id, nodeName, broker, account, client_group || 'A', metaJson, nav || 0);
        }
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
    
    getAllNodes(clientGroup = null) {
        let stmt;
        let nodes;
        if (clientGroup) {
            stmt = this.db.prepare('SELECT * FROM nodes WHERE client_group = ? ORDER BY created_at DESC');
            nodes = stmt.all(clientGroup);
        } else {
            stmt = this.db.prepare('SELECT * FROM nodes ORDER BY created_at DESC');
            nodes = stmt.all();
        }
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
    
    // Get all unique client groups
    getAllClientGroups() {
        const stmt = this.db.prepare('SELECT DISTINCT client_group FROM nodes WHERE client_group IS NOT NULL ORDER BY client_group');
        return stmt.all().map(row => row.client_group);
    }
    
    updateNodeStatus(id, status) {
        const stmt = this.db.prepare(`
            UPDATE nodes 
            SET status = ?, updated_at = datetime('now')
            WHERE id = ?
        `);
        return stmt.run(status, id);
    }
    
    // 更新 nodes 表中的 NAV 淨值
    updateNodeNav(id, nav) {
        const stmt = this.db.prepare(`
            UPDATE nodes 
            SET nav = ?, updated_at = datetime('now')
            WHERE id = ?
        `);
        return stmt.run(nav, id);
    }
    
    // Delete a node and all its related data
    deleteNode(id) {
        // Delete from all related tables
        this.db.prepare('DELETE FROM stats WHERE node_id = ?').run(id);
        this.db.prepare('DELETE FROM ab_stats WHERE node_id = ?').run(id);
        this.db.prepare('DELETE FROM nodes WHERE id = ?').run(id);
        console.log(`Deleted node ${id} and all related data`);
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
    
    // 只更新 ab_stats 的 reported_at（用於 Monitor_OnlyHeartbeat 模式）
    upsertABStatsReportedAt(nodeId, date) {
        const stmt = this.db.prepare(`
            INSERT INTO ab_stats (node_id, date, reported_at)
            VALUES (?, ?, datetime('now'))
            ON CONFLICT(node_id, date) DO UPDATE SET
                reported_at = datetime('now')
        `);
        return stmt.run(nodeId, date);
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
        // ?²å??¶å?äº¤æ??¥ç??¸æ?
        // å¦‚æ??«æ•¦?‚é???00:00-01:30 ä¹‹é?ï¼Œé¡¯ç¤ºå?ä¸€å¤©ç??¸æ?
        const tradingDate = this.getCurrentTradingDate();
        
        const stmt = this.db.prepare(`
            SELECT * FROM ab_stats 
            WHERE date = ?
        `);
        return stmt.all(tradingDate);
    }
    
    /**
     * ?²å??‡å??¥æ??„æ???AB çµ±è??¸æ?
     * @param {string} date - YYYY-MM-DD ?¼å??„æ—¥??
     */
    getAllABStatsByDate(date) {
        // 每個節點只取最新的一條記錄（按 id 降序，取第一條）
        const stmt = this.db.prepare(`
            SELECT * FROM ab_stats 
            WHERE date = ? AND id IN (
                SELECT MAX(id) FROM ab_stats 
                WHERE date = ? 
                GROUP BY node_id
            )
        `);
        return stmt.all(date, date);
    }
    
    /**
     * ?²å??‡å?ç¯€é»žåœ¨?¥æ?ç¯„å??§ç? AB çµ±è??¸æ?
     * @param {string} nodeId - ç¯€é»?ID
     * @param {string} startDate - ?‹å??¥æ? YYYY-MM-DD
     * @param {string} endDate - çµ�æ??¥æ? YYYY-MM-DD
     */
    getNodeABStatsByDateRange(nodeId, startDate, endDate) {
        const stmt = this.db.prepare(`
            SELECT * FROM ab_stats 
            WHERE node_id = ? AND date >= ? AND date <= ?
            ORDER BY date DESC
        `);
        return stmt.all(nodeId, startDate, endDate);
    }
    
    /**
     * 獲取日期範圍內所有節點的 AB 統計數據（用於 Excel 導出）
     * @param {string} startDate - 開始日期 YYYY-MM-DD
     * @param {string} endDate - 結束日期 YYYY-MM-DD
     * @param {string[]} nodeIds - 節點 ID 列表（可選，為空則返回所有節點）
     */
    getAllABStatsByDateRange(startDate, endDate, nodeIds = null) {
        if (nodeIds && nodeIds.length > 0) {
            const placeholders = nodeIds.map(() => '?').join(',');
            const stmt = this.db.prepare(`
                SELECT ab.*, n.name as node_name, n.client_group
                FROM ab_stats ab
                LEFT JOIN nodes n ON ab.node_id = n.id
                WHERE ab.date >= ? AND ab.date <= ? AND ab.node_id IN (${placeholders})
                AND ab.a_lots_total IS NOT NULL
                ORDER BY ab.date ASC, ab.node_id ASC
            `);
            return stmt.all(startDate, endDate, ...nodeIds);
        } else {
            const stmt = this.db.prepare(`
                SELECT ab.*, n.name as node_name, n.client_group
                FROM ab_stats ab
                LEFT JOIN nodes n ON ab.node_id = n.id
                WHERE ab.date >= ? AND ab.date <= ?
                AND ab.a_lots_total IS NOT NULL
                ORDER BY ab.date ASC, ab.node_id ASC
            `);
            return stmt.all(startDate, endDate);
        }
    }
    
    /**
     * ?²å??¶å?äº¤æ??¥æ?
     * CFDå¹³å�°?‚é? 00:00-01:30 ä¹‹é?ç®—å?ä¸€å¤©ï?01:30 ä¹‹å?ç®—ç•¶å¤?
     */
    getCurrentTradingDate() {
        const now = new Date();
        const timezone = process.env.TRADING_TIMEZONE || 'Europe/Athens';
        
        // è½‰æ???CFD å¹³å�°?‚é?
        const platformTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
        
        const hours = platformTime.getHours();
        const minutes = platformTime.getMinutes();
        const timeInMinutes = hours * 60 + minutes;
        
        // å¦‚æ???00:00-01:30 ä¹‹é?ï¼?-90 ?†é?ï¼‰ï?ä½¿ç”¨?�ä?å¤©ç??¥æ?
        if (timeInMinutes < 90) { // 01:30 = 90 ?†é?
            platformTime.setDate(platformTime.getDate() - 1);
        }
        
        // è¿”å? YYYY-MM-DD ?¼å?
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
    
    // 清除今天的統計數據（根據分組）
    clearTodayStats(date, group = null) {
        if (group) {
            // 只清除指定分組的今天數據
            const stmt = this.db.prepare(`
                DELETE FROM stats 
                WHERE date = ? 
                AND node_id IN (SELECT id FROM nodes WHERE client_group = ?)
            `);
            return stmt.run(date, group);
        } else {
            // 清除所有分組的今天數據
            const stmt = this.db.prepare('DELETE FROM stats WHERE date = ?');
            return stmt.run(date);
        }
    }
    
    // 清除今天的 AB 統計數據（根據分組）
    clearTodayABStats(date, group = null) {
        if (group) {
            // 只清除指定分組的今天數據
            const stmt = this.db.prepare(`
                DELETE FROM ab_stats 
                WHERE date = ? 
                AND node_id IN (SELECT id FROM nodes WHERE client_group = ?)
            `);
            return stmt.run(date, group);
        } else {
            // 清除所有分組的今天數據
            const stmt = this.db.prepare('DELETE FROM ab_stats WHERE date = ?');
            return stmt.run(date);
        }
    }
    
    // 清除 nodes 表中的場上數據（Monitor_OnlyHeartbeat 模式的數據）
    clearNodesOpenData(group = null) {
        if (group) {
            const stmt = this.db.prepare(`
                UPDATE nodes 
                SET open_buy_lots = 0, open_sell_lots = 0, floating_pl = 0, balance = 0, equity = 0
                WHERE client_group = ?
            `);
            return stmt.run(group);
        } else {
            const stmt = this.db.prepare(`
                UPDATE nodes 
                SET open_buy_lots = 0, open_sell_lots = 0, floating_pl = 0, balance = 0, equity = 0
            `);
            return stmt.run();
        }
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
    
    /**
     * 按分組獲取每日歷史統計數據
     * 合併 ab_stats（新格式，有分組）和 daily_snapshots（舊格式，無分組）的數據
     * @param {Array} allowedGroups - 允許的分組列表，如 ['A', 'B'] 或 ['C']
     * @param {boolean} isAdmin - 是否為管理員用戶（只有管理員可以看到無分組信息的舊數據）
     * @returns {Array} 每日統計數據
     */
    getDailyStatsByGroups(allowedGroups = [], isAdmin = false) {
        // 檢查 nodes 表是否有 client_group 欄位
        const nodesInfo = this.db.prepare('PRAGMA table_info(nodes)').all();
        const hasClientGroup = nodesInfo.some(col => col.name === 'client_group');
        
        // 從 ab_stats 獲取有分組信息的數據（新格式）
        const statsInfo = this.db.prepare('PRAGMA table_info(ab_stats)').all();
        const hasCommission = statsInfo.some(col => col.name === 'commission_per_lot');
        
        let abStatsData = [];
        
        if (hasClientGroup && allowedGroups && allowedGroups.length > 0) {
            const placeholders = allowedGroups.map(() => '?').join(',');
            const commissionExpr = hasCommission 
                ? 'SUM(a.commission_per_lot * a.a_lots_total)' 
                : '0';
            
            // 使用子查詢確保每個節點每天只取最新一條記錄，並排除「歷史數據」匯總行
            const stmt = this.db.prepare(`
                SELECT 
                    a.date as snapshot_date,
                    COUNT(DISTINCT a.node_id) as total_nodes,
                    SUM(a.a_lots_total) as total_a_lots,
                    SUM(a.b_lots_total) as total_b_lots,
                    SUM(a.lots_diff) as total_lots_diff,
                    SUM(a.a_profit_total) as total_a_profit,
                    SUM(a.b_profit_total) as total_b_profit,
                    SUM(a.ab_profit_total) as total_ab_profit,
                    SUM(a.a_interest_total) as total_a_interest,
                    ${commissionExpr} as total_commission,
                    CASE WHEN SUM(a.a_lots_total) > 0 
                        THEN SUM(a.ab_profit_total) / SUM(a.a_lots_total) 
                        ELSE 0 
                    END as total_cost_per_lot
                FROM ab_stats a
                JOIN nodes n ON a.node_id = n.id
                WHERE n.client_group IN (${placeholders})
                  AND n.name NOT LIKE '%歷史%'
                  AND a.id IN (
                      SELECT MAX(id) FROM ab_stats 
                      WHERE date = a.date 
                      GROUP BY node_id
                  )
                GROUP BY a.date
                ORDER BY a.date DESC
            `);
            
            abStatsData = stmt.all(...allowedGroups);
        }
        
        // 只有管理員且查詢包含分組 A 時，才合併舊的 daily_snapshots 數據
        // 舊數據都屬於分組 A，所以只有查詢分組 A 或全部時才顯示
        const includesGroupA = allowedGroups.includes('A');
        if (isAdmin && includesGroupA) {
            const dailySnapshots = this.getAllDailySnapshots();
            const abStatsDates = new Set(abStatsData.map(s => s.snapshot_date));
            const mergedData = [...abStatsData];
            
            // 添加 daily_snapshots 中不在 ab_stats 的日期（舊的歷史數據）
            for (const snapshot of dailySnapshots) {
                if (!abStatsDates.has(snapshot.snapshot_date)) {
                    mergedData.push(snapshot);
                }
            }
            
            // 按日期降序排序
            mergedData.sort((a, b) => b.snapshot_date.localeCompare(a.snapshot_date));
            return mergedData;
        }
        
        // 非管理員或不包含分組A時，只返回有分組信息的數據
        return abStatsData;
    }
    
    getDailyStatsByGroupsAndDateRange(allowedGroups = [], startDate, endDate, isAdmin = false) {
        // 檢查 nodes 表是否有 client_group 欄位
        const nodesInfo = this.db.prepare('PRAGMA table_info(nodes)').all();
        const hasClientGroup = nodesInfo.some(col => col.name === 'client_group');
        
        // 從 ab_stats 獲取有分組信息的數據（新格式）
        const statsInfo = this.db.prepare('PRAGMA table_info(ab_stats)').all();
        const hasCommission = statsInfo.some(col => col.name === 'commission_per_lot');
        
        let abStatsData = [];
        
        if (hasClientGroup && allowedGroups && allowedGroups.length > 0) {
            const placeholders = allowedGroups.map(() => '?').join(',');
            const commissionExpr = hasCommission 
                ? 'SUM(a.commission_per_lot * a.a_lots_total)' 
                : '0';
            
            // 使用子查詢確保每個節點每天只取最新一條記錄，並排除「歷史數據」匯總行
            const stmt = this.db.prepare(`
                SELECT 
                    a.date as snapshot_date,
                    COUNT(DISTINCT a.node_id) as total_nodes,
                    SUM(a.a_lots_total) as total_a_lots,
                    SUM(a.b_lots_total) as total_b_lots,
                    SUM(a.lots_diff) as total_lots_diff,
                    SUM(a.a_profit_total) as total_a_profit,
                    SUM(a.b_profit_total) as total_b_profit,
                    SUM(a.ab_profit_total) as total_ab_profit,
                    SUM(a.a_interest_total) as total_a_interest,
                    ${commissionExpr} as total_commission,
                    CASE WHEN SUM(a.a_lots_total) > 0 
                        THEN SUM(a.ab_profit_total) / SUM(a.a_lots_total) 
                        ELSE 0 
                    END as total_cost_per_lot
                FROM ab_stats a
                JOIN nodes n ON a.node_id = n.id
                WHERE n.client_group IN (${placeholders})
                  AND a.date >= ? AND a.date <= ?
                  AND n.name NOT LIKE '%歷史%'
                  AND a.id IN (
                      SELECT MAX(id) FROM ab_stats 
                      WHERE date = a.date 
                      GROUP BY node_id
                  )
                GROUP BY a.date
                ORDER BY a.date DESC
            `);
            
            abStatsData = stmt.all(...allowedGroups, startDate, endDate);
        }
        
        // 只有管理員且查詢包含分組 A 時，才合併舊的 daily_snapshots 數據
        // 舊數據都屬於分組 A，所以只有查詢分組 A 或全部時才顯示
        const includesGroupA = allowedGroups.includes('A');
        if (isAdmin && includesGroupA) {
            const dailySnapshots = this.getDailySnapshotsByDateRange(startDate, endDate);
            const abStatsDates = new Set(abStatsData.map(s => s.snapshot_date));
            const mergedData = [...abStatsData];
            
            // 添加 daily_snapshots 中不在 ab_stats 的日期（舊的歷史數據）
            for (const snapshot of dailySnapshots) {
                if (!abStatsDates.has(snapshot.snapshot_date)) {
                    mergedData.push(snapshot);
                }
            }
            
            // 按日期降序排序
            mergedData.sort((a, b) => b.snapshot_date.localeCompare(a.snapshot_date));
            return mergedData;
        }
        
        // 非管理員或不包含分組A時，只返回有分組信息的數據
        return abStatsData;
    }
    
    getDailySnapshotByDate(date) {
        const stmt = this.db.prepare(`
            SELECT * FROM daily_snapshots 
            WHERE snapshot_date = ?
        `);
        return stmt.get(date);
    }
    
    deleteDailySnapshot(date) {
        const stmt = this.db.prepare(`
            DELETE FROM daily_snapshots 
            WHERE snapshot_date = ?
        `);
        return stmt.run(date);
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
            // ?¨å?è«‹æ?ï¼šç‚ºæ¯�å€‹ç�¾?‰ç?é»žå‰µå»ºå–®?¨ç?è«‹æ?è¨˜é?
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
            // ?®å€‹ç?é»žè?æ±?
            const stmt = this.db.prepare(`
                INSERT INTO report_requests (node_id, requested_at)
                VALUES (?, datetime('now'))
            `);
            return stmt.run(nodeId);
        }
    }
    
    checkReportRequest(nodeId) {
        // ?ªæª¢?¥è©²ç¯€é»žç?è«‹æ?ï¼ˆä??�æ”¯??NULL ?¨å?è«‹æ?ï¼?
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
    
    // User management
    getUser(username) {
        const stmt = this.db.prepare('SELECT * FROM users WHERE username = ?');
        return stmt.get(username);
    }
    
    createUser(username, password, allowedGroups = 'A,B,C', showUngrouped = true) {
        const stmt = this.db.prepare(`
            INSERT INTO users (username, password, allowed_groups, show_ungrouped)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(username) DO UPDATE SET
                password = excluded.password,
                allowed_groups = excluded.allowed_groups,
                show_ungrouped = excluded.show_ungrouped
        `);
        return stmt.run(username, password, allowedGroups, showUngrouped ? 1 : 0);
    }
    
    getAllUsers() {
        const stmt = this.db.prepare('SELECT id, username, allowed_groups, created_at FROM users');
        return stmt.all();
    }
    
    deleteUser(username) {
        const stmt = this.db.prepare('DELETE FROM users WHERE username = ?');
        return stmt.run(username);
    }
    
    // Initialize default users if not exist
    initializeDefaultUsers() {
        // 確認 users 表有 show_ungrouped 欄位
        try {
            this.db.exec("ALTER TABLE users ADD COLUMN show_ungrouped INTEGER DEFAULT 1");
        } catch (e) {
            // 欄位已存在
        }
        
        // 用戶 A：從環境變數讀取密碼，顯示無分組節點
        const passwordA = process.env.WEB_PASSWORD || 'admin123';
        this.createUser('A', passwordA, 'A,B,C', true);  // 顯示所有分組節點
        console.log('User A configured: groups=A,B,C, showUngrouped=true');
        
        // 用戶 B：只查看分組C，不顯示無分組節點
        this.createUser('B', 'tt8899TT', 'C', false);  // 不顯示無分組節點
        console.log('User B configured: groups=C, showUngrouped=false');
    }

    // ========== VPS Monitoring Operations ==========

    // VPS Config operations
    upsertVPSConfig(vpsData) {
        const { vps_name, vps_ip, description, is_active } = vpsData;
        const stmt = this.db.prepare(`
            INSERT INTO vps_config (vps_name, vps_ip, description, is_active, last_seen, updated_at)
            VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
            ON CONFLICT(vps_name) DO UPDATE SET
                vps_ip = COALESCE(excluded.vps_ip, vps_ip),
                description = COALESCE(excluded.description, description),
                is_active = COALESCE(excluded.is_active, is_active),
                last_seen = datetime('now'),
                updated_at = datetime('now')
        `);
        return stmt.run(vps_name, vps_ip || null, description || null, is_active !== undefined ? is_active : 1);
    }

    getVPSConfig(vpsName) {
        const stmt = this.db.prepare('SELECT * FROM vps_config WHERE vps_name = ?');
        return stmt.get(vpsName);
    }

    getAllVPSConfigs() {
        const stmt = this.db.prepare('SELECT * FROM vps_config ORDER BY vps_name ASC');
        return stmt.all();
    }

    updateVPSConfigActive(vpsName, isActive) {
        const stmt = this.db.prepare(`
            UPDATE vps_config 
            SET is_active = ?, updated_at = datetime('now')
            WHERE vps_name = ?
        `);
        return stmt.run(isActive ? 1 : 0, vpsName);
    }

    deleteVPSConfig(vpsName) {
        const stmt = this.db.prepare('DELETE FROM vps_config WHERE vps_name = ?');
        return stmt.run(vpsName);
    }

    // VPS Metrics operations
    insertVPSMetrics(metricsData) {
        const {
            vps_name,
            cpu_queue_length,
            cpu_usage_percent,
            context_switches_per_sec,
            disk_queue_length,
            disk_read_latency_ms,
            disk_write_latency_ms,
            memory_available_mb,
            memory_usage_percent
        } = metricsData;

        const stmt = this.db.prepare(`
            INSERT INTO vps_metrics (
                vps_name, timestamp,
                cpu_queue_length, cpu_usage_percent, context_switches_per_sec,
                disk_queue_length, disk_read_latency_ms, disk_write_latency_ms,
                memory_available_mb, memory_usage_percent
            )
            VALUES (?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        return stmt.run(
            vps_name,
            cpu_queue_length || 0,
            cpu_usage_percent || 0,
            context_switches_per_sec || 0,
            disk_queue_length || 0,
            disk_read_latency_ms || 0,
            disk_write_latency_ms || 0,
            memory_available_mb || 0,
            memory_usage_percent || 0
        );
    }

    getLatestVPSMetrics(vpsName) {
        const stmt = this.db.prepare(`
            SELECT * FROM vps_metrics 
            WHERE vps_name = ? 
            ORDER BY timestamp DESC 
            LIMIT 1
        `);
        return stmt.get(vpsName);
    }

    getVPSMetricsHistory(vpsName, hours = 24) {
        const stmt = this.db.prepare(`
            SELECT * FROM vps_metrics 
            WHERE vps_name = ? 
            AND timestamp >= datetime('now', '-' || ? || ' hours')
            ORDER BY timestamp DESC
        `);
        return stmt.all(vpsName, hours);
    }

    getAllLatestVPSMetrics() {
        // 
        const stmt = this.db.prepare(`
            SELECT m.* FROM vps_metrics m
            INNER JOIN (
                SELECT vps_name, MAX(timestamp) as max_timestamp
                FROM vps_metrics
                GROUP BY vps_name
            ) latest ON m.vps_name = latest.vps_name AND m.timestamp = latest.max_timestamp
            ORDER BY m.vps_name ASC
        `);
        return stmt.all();
    }

    cleanupOldVPSMetrics(days = 7) {
        const stmt = this.db.prepare(`
            DELETE FROM vps_metrics 
            WHERE timestamp < datetime('now', '-' || ? || ' days')
        `);
        return stmt.run(days);
    }

    // 计算 VPS 过去24小时的正常率（从100%开始，每次严重告警扣减）
    getVPSUptimeRate(vpsName, hours = 24) {
        // 统计过去24小时的严重告警次数
        const stmt = this.db.prepare(`
            SELECT COUNT(*) as critical_count
            FROM vps_alert_history 
            WHERE vps_name = ? 
            AND alert_level = 'critical'
            AND timestamp >= datetime('now', '-' || ? || ' hours')
        `);
        const result = stmt.get(vpsName, hours);
        const criticalCount = result.critical_count || 0;
        
        // 每次严重告警扣减1%，从100开始
        const uptimeRate = 100 - criticalCount;
        
        return {
            criticalCount,
            expectedCount: 100,  // 固定为100，方便理解
            uptimeRate: Math.max(0, Math.min(100, uptimeRate)) // 0-100%
        };
    }

    // 计算 VPS 过去24小时的正常率超（从100%开始，每次 cpu_queue_length_ultra 严重告警扣减）
    getVPSUptimeRateUltra(vpsName, hours = 24) {
        // 统计过去24小时的 cpu_queue_length_ultra 严重告警次数
        const stmt = this.db.prepare(`
            SELECT COUNT(*) as critical_count
            FROM vps_alert_history 
            WHERE vps_name = ? 
            AND metric_name = 'cpu_queue_length_ultra'
            AND alert_level = 'critical'
            AND timestamp >= datetime('now', '-' || ? || ' hours')
        `);
        const result = stmt.get(vpsName, hours);
        const criticalCount = result.critical_count || 0;
        
        // 每次严重告警扣减1%，从100开始
        const uptimeRate = 100 - criticalCount;
        
        return {
            criticalCount,
            expectedCount: 100,  // 固定为100，方便理解
            uptimeRate: Math.max(0, Math.min(100, uptimeRate)) // 0-100%
        };
    }

    // 重置 VPS 的平均正常率（清除历史严重告警记录）
    resetVPSUptimeRate(vpsName) {
        const stmt = this.db.prepare(`
            DELETE FROM vps_alert_history 
            WHERE vps_name = ? AND alert_level = 'critical'
        `);
        return stmt.run(vpsName);
    }

    // 重置 VPS 的平均正常率超（清除 cpu_queue_length_ultra 历史严重告警记录）
    resetVPSUptimeRateUltra(vpsName) {
        const stmt = this.db.prepare(`
            DELETE FROM vps_alert_history 
            WHERE vps_name = ? AND metric_name = 'cpu_queue_length_ultra' AND alert_level = 'critical'
        `);
        return stmt.run(vpsName);
    }

    // VPS Alert Thresholds operations
    getAllVPSThresholds() {
        const stmt = this.db.prepare('SELECT * FROM vps_alert_thresholds ORDER BY metric_name ASC');
        return stmt.all();
    }

    getVPSThreshold(metricName) {
        const stmt = this.db.prepare('SELECT * FROM vps_alert_thresholds WHERE metric_name = ?');
        return stmt.get(metricName);
    }

    updateVPSThreshold(metricName, warningThreshold, criticalThreshold) {
        const stmt = this.db.prepare(`
            UPDATE vps_alert_thresholds 
            SET warning_threshold = ?, critical_threshold = ?, updated_at = datetime('now')
            WHERE metric_name = ?
        `);
        return stmt.run(warningThreshold, criticalThreshold, metricName);
    }

    // VPS Alert History operations
    insertVPSAlert(alertData) {
        const { vps_name, metric_name, alert_level, metric_value, threshold_value } = alertData;
        const stmt = this.db.prepare(`
            INSERT INTO vps_alert_history (
                vps_name, metric_name, alert_level, metric_value, threshold_value, timestamp, notified
            )
            VALUES (?, ?, ?, ?, ?, datetime('now'), 0)
        `);
        return stmt.run(vps_name, metric_name, alert_level, metric_value, threshold_value);
    }

    getRecentVPSAlerts(vpsName = null, hours = 24) {
        if (vpsName) {
            const stmt = this.db.prepare(`
                SELECT * FROM vps_alert_history 
                WHERE vps_name = ? 
                AND timestamp >= datetime('now', '-' || ? || ' hours')
                ORDER BY timestamp DESC
            `);
            return stmt.all(vpsName, hours);
        } else {
            const stmt = this.db.prepare(`
                SELECT * FROM vps_alert_history 
                WHERE timestamp >= datetime('now', '-' || ? || ' hours')
                ORDER BY timestamp DESC
            `);
            return stmt.all(hours);
        }
    }

    getUnnotifiedVPSAlerts() {
        const stmt = this.db.prepare(`
            SELECT * FROM vps_alert_history 
            WHERE notified = 0 
            ORDER BY timestamp ASC
        `);
        return stmt.all();
    }

    markVPSAlertNotified(alertId) {
        const stmt = this.db.prepare(`
            UPDATE vps_alert_history 
            SET notified = 1 
            WHERE id = ?
        `);
        return stmt.run(alertId);
    }

    cleanupOldVPSAlerts(days = 30) {
        const stmt = this.db.prepare(`
            DELETE FROM vps_alert_history 
            WHERE timestamp < datetime('now', '-' || ? || ' days')
        `);
        return stmt.run(days);
    }

    close() {
        this.db.close();
    }
}

module.exports = new DatabaseManager();
