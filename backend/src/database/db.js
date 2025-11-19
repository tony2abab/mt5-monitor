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
    upsertABStats(statsData) {
        const { 
            node_id, date, 
            a_lots_total, b_lots_total, lots_diff,
            a_profit_total, b_profit_total, ab_profit_total,
            a_interest_total, cost_per_lot
        } = statsData;
        
        const stmt = this.db.prepare(`
            INSERT INTO ab_stats (
                node_id, date, 
                a_lots_total, b_lots_total, lots_diff,
                a_profit_total, b_profit_total, ab_profit_total,
                a_interest_total, cost_per_lot, reported_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(node_id, date) DO UPDATE SET
                a_lots_total = excluded.a_lots_total,
                b_lots_total = excluded.b_lots_total,
                lots_diff = excluded.lots_diff,
                a_profit_total = excluded.a_profit_total,
                b_profit_total = excluded.b_profit_total,
                ab_profit_total = excluded.ab_profit_total,
                a_interest_total = excluded.a_interest_total,
                cost_per_lot = excluded.cost_per_lot,
                reported_at = datetime('now')
        `);
        
        return stmt.run(
            node_id, date,
            a_lots_total, b_lots_total, lots_diff,
            a_profit_total, b_profit_total, ab_profit_total,
            a_interest_total, cost_per_lot
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
        const stmt = this.db.prepare(`
            SELECT * FROM ab_stats 
            WHERE date = date('now')
        `);
        return stmt.all();
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
    
    close() {
        this.db.close();
    }
}

module.exports = new DatabaseManager();
