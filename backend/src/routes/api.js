const express = require('express');
const router = express.Router();
const db = require('../database/db');
const heartbeatService = require('../services/heartbeat');
const telegram = require('../services/telegram');
const authMiddleware = require('../middleware/auth');

// POST /api/heartbeat - Receive heartbeat from MT5 EA (requires auth)
router.post('/heartbeat', authMiddleware, (req, res) => {
    try {
        const { id, name, broker, account, meta } = req.body;
        
        // Validation
        if (!id || !name) {
            return res.status(400).json({
                ok: false,
                error: 'Missing required fields: id, name'
            });
        }
        
        // Get old status before update
        const oldNode = db.getNode(id);
        const oldStatus = oldNode ? oldNode.status : null;
        
        // Upsert node with heartbeat
        db.upsertNode({ id, name, broker, account, meta });
        // When heartbeat is received, ensure node is no longer muted
        heartbeatService.unmuteNode(id);
        
        // Check for status transition
        if (oldStatus === 'offline' || oldStatus === null) {
            // Node came online
            db.addStateTransition(id, oldStatus, 'online');
            
            // Send Telegram notification for recovery
            const node = db.getNode(id);
            telegram.sendNodeOnlineNotification(node).catch(err => {
                console.error('Failed to send online notification:', err);
            });
        }
        
        res.json({
            ok: true,
            status: 'online',
            serverTime: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error processing heartbeat:', error);
        res.status(500).json({
            ok: false,
            error: 'Internal server error'
        });
    }
});

// POST /api/nodes/clear-stats - Clear all collected stats data (keep heartbeats)
router.post('/nodes/clear-stats', (req, res) => {
    try {
        db.clearAllStats();
        db.clearAllABStats();
        res.json({
            ok: true,
            message: 'All statistics cleared successfully',
            serverTime: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error clearing stats:', error);
        res.status(500).json({
            ok: false,
            error: 'Internal server error'
        });
    }
});

// POST /api/ab-stats - Receive A/B system statistics from MT5 EA (requires auth)
router.post('/ab-stats', authMiddleware, (req, res) => {
    try {
        const { 
            id, date, 
            a_lots_total, b_lots_total, lots_diff,
            a_profit_total, b_profit_total, ab_profit_total,
            a_interest_total, cost_per_lot
        } = req.body;
        
        // Validation
        if (!id || !date) {
            return res.status(400).json({
                ok: false,
                error: 'Missing required fields: id, date'
            });
        }
        
        // Ensure node exists
        const node = db.getNode(id);
        if (!node) {
            return res.status(404).json({
                ok: false,
                error: 'Node not found. Send heartbeat first.'
            });
        }
        
        // Upsert AB stats
        db.upsertABStats({
            node_id: id,
            date,
            a_lots_total: a_lots_total || 0,
            b_lots_total: b_lots_total || 0,
            lots_diff: lots_diff || 0,
            a_profit_total: a_profit_total || 0,
            b_profit_total: b_profit_total || 0,
            ab_profit_total: ab_profit_total || 0,
            a_interest_total: a_interest_total || 0,
            cost_per_lot: cost_per_lot || 0
        });
        
        res.json({
            ok: true,
            serverTime: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error processing AB stats:', error);
        res.status(500).json({
            ok: false,
            error: 'Internal server error'
        });
    }
});

// POST /api/stats - Receive daily statistics from MT5 EA (requires auth) [LEGACY - 保留向後兼容]
router.post('/stats', authMiddleware, (req, res) => {
    try {
        const { id, date, profit_loss, interest, avg_lots_success, lots_traded, ab_lots_diff } = req.body;
        
        // Validation
        if (!id || !date) {
            return res.status(400).json({
                ok: false,
                error: 'Missing required fields: id, date'
            });
        }
        
        // Ensure node exists
        const node = db.getNode(id);
        if (!node) {
            return res.status(404).json({
                ok: false,
                error: 'Node not found. Send heartbeat first.'
            });
        }
        
        // Upsert stats
        db.upsertStats({
            node_id: id,
            date,
            profit_loss: profit_loss || 0,
            interest: interest || 0,
            avg_lots_success: avg_lots_success || 0,
            lots_traded: lots_traded || 0,
            ab_lots_diff: ab_lots_diff || 0
        });
        
        res.json({
            ok: true,
            serverTime: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error processing stats:', error);
        res.status(500).json({
            ok: false,
            error: 'Internal server error'
        });
    }
});

// GET /api/nodes - Get all nodes with current status and today's AB stats
router.get('/nodes', (req, res) => {
    try {
        const nodes = db.getAllNodes();
        const todayABStats = db.getAllTodayABStats();
        const todayStats = db.getAllTodayStats(); // 保留向後兼容
        
        // Create maps of node_id to stats
        const abStatsMap = {};
        todayABStats.forEach(stat => {
            abStatsMap[stat.node_id] = stat;
        });
        
        const statsMap = {};
        todayStats.forEach(stat => {
            statsMap[stat.node_id] = stat;
        });
        
        // Enrich nodes with status and stats
        const enrichedNodes = nodes.map(node => {
            const status = heartbeatService.getNodeStatus(node.last_heartbeat);
            const abStats = abStatsMap[node.id] || null;
            const stats = statsMap[node.id] || null;
            
            return {
                ...node,
                status,
                todayABStats: abStats,  // 新的 A/B 統計數據
                todayStats: stats,      // 保留舊的統計數據（向後兼容）
                lastHeartbeatRelative: node.last_heartbeat ? getRelativeTime(new Date(node.last_heartbeat)) : 'Never',
                lastStatsRelative: abStats && abStats.reported_at ? getRelativeTime(new Date(abStats.reported_at)) : null
            };
        });
        
        // Calculate summary
        const summary = {
            total: enrichedNodes.length,
            online: enrichedNodes.filter(n => n.status === 'online').length,
            offline: enrichedNodes.filter(n => n.status === 'offline').length,
            totalABProfit: enrichedNodes.reduce((sum, n) => sum + (n.todayABStats?.ab_profit_total || 0), 0),
            totalALots: enrichedNodes.reduce((sum, n) => sum + (n.todayABStats?.a_lots_total || 0), 0),
            totalBLots: enrichedNodes.reduce((sum, n) => sum + (n.todayABStats?.b_lots_total || 0), 0),
            totalAInterest: enrichedNodes.reduce((sum, n) => sum + (n.todayABStats?.a_interest_total || 0), 0)
        };
        
        res.json({
            ok: true,
            nodes: enrichedNodes,
            summary,
            serverTime: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error fetching nodes:', error);
        res.status(500).json({
            ok: false,
            error: 'Internal server error'
        });
    }
});

// GET /api/nodes/:id - Get single node details with recent stats
router.get('/nodes/:id', (req, res) => {
    try {
        const { id } = req.params;
        const days = parseInt(req.query.days) || 7;
        
        const node = db.getNode(id);
        if (!node) {
            return res.status(404).json({
                ok: false,
                error: 'Node not found'
            });
        }
        
        const status = heartbeatService.getNodeStatus(node.last_heartbeat);
        const recentStats = db.getLatestStats(id, days);
        
        res.json({
            ok: true,
            node: {
                ...node,
                status,
                lastHeartbeatRelative: node.last_heartbeat ? getRelativeTime(new Date(node.last_heartbeat)) : 'Never'
            },
            recentStats,
            serverTime: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error fetching node:', error);
        res.status(500).json({
            ok: false,
            error: 'Internal server error'
        });
    }
});

// POST /api/nodes/:id/mute - Mute offline Telegram notifications for a specific node
router.post('/nodes/:id/mute', (req, res) => {
    try {
        const { id } = req.params;
        const node = db.getNode(id);
        if (!node) {
            return res.status(404).json({
                ok: false,
                error: 'Node not found'
            });
        }

        heartbeatService.muteNode(id);

        res.json({
            ok: true,
            muted: true,
            nodeId: id,
            serverTime: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error muting node:', error);
        res.status(500).json({
            ok: false,
            error: 'Internal server error'
        });
    }
});

// POST /api/nodes/resend-offline - Force resend Telegram notifications for all offline nodes
router.post('/nodes/resend-offline', async (req, res) => {
    try {
        const nodes = db.getAllNodes();
        const now = new Date();
        let notifiedCount = 0;

        for (const node of nodes) {
            const status = heartbeatService.getNodeStatus(node.last_heartbeat);
            // Skip nodes that are muted for offline notifications
            if (status === 'offline' && !heartbeatService.mutedNodeIds.has(node.id)) {
                try {
                    await telegram.sendNodeOfflineNotification(node);
                    notifiedCount++;
                } catch (err) {
                    console.error('Failed to resend offline notification (manual):', err);
                }
            }
        }

        res.json({
            ok: true,
            notified: notifiedCount,
            serverTime: now.toISOString()
        });
    } catch (error) {
        console.error('Error resending offline notifications:', error);
        res.status(500).json({
            ok: false,
            error: 'Internal server error'
        });
    }
});

// Helper function to get relative time string
function getRelativeTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    return `${diffDay}d ago`;
}

module.exports = router;
