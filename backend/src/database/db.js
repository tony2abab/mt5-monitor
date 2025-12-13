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
        
        console.log('Database initialized successfully');
    }
    
    // 資料庫遷移：添加場上數據欄位到 nodes 表
    migrateNodesTable() {
        const columns = [
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
    
    // Node operations
    upsertNode(nodeData) {
        const { 
            id, name, broker, account, meta, client_group,
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
                                   open_buy_lots, open_sell_lots, floating_pl, balance, equity)
                VALUES (?, ?, ?, ?, ?, ?, datetime('now'), 'online', datetime('now'), ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    name = COALESCE(excluded.name, name, excluded.id),
                    broker = excluded.broker,
                    account = excluded.account,
                    client_group = COALESCE(excluded.client_group, client_group, 'A'),
                    meta = excluded.meta,
                    last_heartbeat = excluded.last_heartbeat,
                    status = 'online',
                    updated_at = datetime('now'),
                    open_buy_lots = excluded.open_buy_lots,
                    open_sell_lots = excluded.open_sell_lots,
                    floating_pl = excluded.floating_pl,
                    balance = excluded.balance,
                    equity = excluded.equity
            `);
            
            return stmt.run(id, nodeName, broker, account, client_group || 'A', metaJson,
                           open_buy_lots || 0, open_sell_lots || 0, floating_pl || 0, balance || 0, equity || 0);
        } else {
            // 普通心跳（不更新場上數據）
            const stmt = this.db.prepare(`
                INSERT INTO nodes (id, name, broker, account, client_group, meta, last_heartbeat, status, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, datetime('now'), 'online', datetime('now'))
                ON CONFLICT(id) DO UPDATE SET
                    name = COALESCE(excluded.name, name, excluded.id),
                    broker = excluded.broker,
                    account = excluded.account,
                    client_group = COALESCE(excluded.client_group, client_group, 'A'),
                    meta = excluded.meta,
                    last_heartbeat = excluded.last_heartbeat,
                    status = 'online',
                    updated_at = datetime('now')
            `);
            
            return stmt.run(id, nodeName, broker, account, client_group || 'A', metaJson);
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
        const stmt = this.db.prepare(`
            SELECT * FROM ab_stats 
            WHERE date = ?
        `);
        return stmt.all(date);
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
                GROUP BY a.date
                ORDER BY a.date DESC
            `);
            
            abStatsData = stmt.all(...allowedGroups);
        }
        
        // 只有管理員可以看到無分組信息的舊數據（daily_snapshots）
        if (isAdmin) {
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
        
        // 非管理員只能看到有分組信息的數據
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
        // ç¢ºä? users è¡¨æ? show_ungrouped æ¬„ä?
        try {
            this.db.exec("ALTER TABLE users ADD COLUMN show_ungrouped INTEGER DEFAULT 1");
        } catch (e) {
            // æ¬„ä?å·²å???
        }
        
        // ?¨æˆ¶ Aï¼šå??°å?è®Šæ•¸?²å?å¯†ç¢¼ï¼Œé¡¯ç¤ºç„¡?†ç?ç¯€é»?
        const passwordA = process.env.WEB_PASSWORD || 'admin123';
        this.createUser('A', passwordA, 'A,B,C', true);  // é¡¯ç¤º?¡å?çµ„ç?é»?
        console.log('User A configured: groups=A,B,C, showUngrouped=true');
        
        // ?¨æˆ¶ Bï¼šå�ª?‹å?çµ?Cï¼Œä?é¡¯ç¤º?¡å?çµ„ç?é»?
        this.createUser('B', 'tt8899TT', 'C', false);  // ä¸�é¡¯ç¤ºç„¡?†ç?ç¯€é»?
        console.log('User B configured: groups=C, showUngrouped=false');
    }
    
    close() {
        this.db.close();
    }
}

module.exports = new DatabaseManager();
