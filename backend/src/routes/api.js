const express = require('express');
const router = express.Router();
const db = require('../database/db');
const heartbeatService = require('../services/heartbeat');
const telegram = require('../services/telegram');
const snapshotService = require('../services/snapshot');
const schedulerService = require('../services/scheduler');
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
            
            // Send Telegram notification for recovery (only within trading hours)
            const node = db.getNode(id);
            
            // 檢查是否應該發送恢復通知
            let shouldNotify = false;
            
            if (heartbeatService.isWithinTradingHours()) {
                // 檢查上次心跳時間，判斷是否是周末離線後的正常恢復
                if (oldNode && oldNode.last_heartbeat) {
                    const lastHeartbeat = new Date(oldNode.last_heartbeat.includes('Z') ? oldNode.last_heartbeat : oldNode.last_heartbeat + 'Z');
                    const now = new Date();
                    const offlineDurationHours = (now - lastHeartbeat) / (1000 * 60 * 60);
                    
                    // 如果離線時間超過 48 小時（可能跨越周末），檢查是否在上次離線時也在交易時段內
                    if (offlineDurationHours > 48) {
                        // 獲取上次心跳時的交易時段狀態
                        const wasInTradingHours = heartbeatService.isWithinTradingHoursAt(lastHeartbeat);
                        
                        // 只有當上次離線時也在交易時段內，才發送恢復通知
                        // 這樣可以避免周末正常停市後周一恢復的錯誤通知
                        if (wasInTradingHours) {
                            shouldNotify = true;
                            console.log(`[恢復通知] 節點 ${id} 在交易時段內離線超過 48 小時後恢復，發送通知`);
                        } else {
                            console.log(`[交易時段限制] 節點 ${id} 上次離線時不在交易時段（可能是周末），跳過恢復通知`);
                        }
                    } else {
                        // 離線時間少於 48 小時，正常發送通知
                        shouldNotify = true;
                    }
                } else {
                    // 新節點或無上次心跳記錄，發送通知
                    shouldNotify = true;
                }
                
                if (shouldNotify) {
                    telegram.sendNodeOnlineNotification(node).catch(err => {
                        console.error('Failed to send online notification:', err);
                    });
                }
            } else {
                console.log(`[交易時段限制] 節點 ${id} 恢復在線，但不在交易時段內，跳過 TG 通知`);
            }
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
            a_interest_total, cost_per_lot, commission_per_lot, open_lots
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
            cost_per_lot: cost_per_lot || 0,
            commission_per_lot: commission_per_lot || 0,
            open_lots: open_lots || 0
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

// GET /api/history - Get all daily snapshots
router.get('/history', (req, res) => {
    try {
        const snapshots = db.getAllDailySnapshots();
        
        res.json({
            ok: true,
            snapshots,
            count: snapshots.length,
            serverTime: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error fetching history:', error);
        res.status(500).json({
            ok: false,
            error: 'Internal server error'
        });
    }
});

// GET /api/history/range - Get daily snapshots within date range with summary
router.get('/history/range', (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        if (!startDate || !endDate) {
            return res.status(400).json({
                ok: false,
                error: 'Missing required parameters: startDate, endDate (format: YYYY-MM-DD)'
            });
        }
        
        const snapshots = db.getDailySnapshotsByDateRange(startDate, endDate);
        
        // Calculate summary for the range
        const summary = {
            total_a_lots: snapshots.reduce((sum, s) => sum + (s.total_a_lots || 0), 0),
            total_b_lots: snapshots.reduce((sum, s) => sum + (s.total_b_lots || 0), 0),
            total_lots_diff: snapshots.reduce((sum, s) => sum + (s.total_lots_diff || 0), 0),
            total_a_profit: snapshots.reduce((sum, s) => sum + (s.total_a_profit || 0), 0),
            total_b_profit: snapshots.reduce((sum, s) => sum + (s.total_b_profit || 0), 0),
            total_ab_profit: snapshots.reduce((sum, s) => sum + (s.total_ab_profit || 0), 0),
            total_a_interest: snapshots.reduce((sum, s) => sum + (s.total_a_interest || 0), 0),
            total_cost_per_lot: snapshots.reduce((sum, s) => sum + (s.total_cost_per_lot || 0), 0),
            days_count: snapshots.length,
            avg_daily_profit: snapshots.length > 0 
                ? snapshots.reduce((sum, s) => sum + (s.total_ab_profit || 0), 0) / snapshots.length 
                : 0
        };
        
        res.json({
            ok: true,
            snapshots,
            summary,
            dateRange: { startDate, endDate },
            serverTime: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error fetching history range:', error);
        res.status(500).json({
            ok: false,
            error: 'Internal server error'
        });
    }
});

// POST /api/history/snapshot - Manually create a snapshot for today (testing/admin)
router.post('/history/snapshot', (req, res) => {
    try {
        const { date } = req.body;
        
        if (!date) {
            return res.status(400).json({
                ok: false,
                error: 'Missing required field: date (format: YYYY-MM-DD)'
            });
        }
        
        const summary = snapshotService.manualSnapshot(date);
        
        res.json({
            ok: true,
            snapshot: summary,
            message: `Snapshot created for ${date}`,
            serverTime: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error creating manual snapshot:', error);
        res.status(500).json({
            ok: false,
            error: 'Internal server error'
        });
    }
});

// GET /api/report-request - Check if there's a report request for this node
router.get('/report-request', authMiddleware, (req, res) => {
    try {
        const { id } = req.query;
        
        if (!id) {
            return res.status(400).json({
                ok: false,
                error: 'Missing node id'
            });
        }
        
        const request = db.checkReportRequest(id);
        
        if (request) {
            // Mark as consumed
            db.consumeReportRequest(request.id);
            
            res.json({
                ok: true,
                requested: true,
                requestedAt: request.requested_at
            });
        } else {
            res.json({
                ok: true,
                requested: false
            });
        }
    } catch (error) {
        console.error('Error checking report request:', error);
        res.status(500).json({
            ok: false,
            error: 'Internal server error'
        });
    }
});

// POST /api/request-report - Request MT5 to send report (from web UI)
router.post('/request-report', (req, res) => {
    try {
        const { nodeId } = req.body;  // null = all nodes
        
        db.createReportRequest(nodeId || null);
        
        // 記錄手動請求的時間作為最後快照時間
        const now = new Date();
        snapshotService.lastManualRequestTime = now.toISOString();
        
        res.json({
            ok: true,
            message: nodeId ? `Report requested for node ${nodeId}` : 'Report requested for all nodes'
        });
    } catch (error) {
        console.error('Error creating report request:', error);
        res.status(500).json({
            ok: false,
            error: 'Internal server error'
        });
    }
});

// GET /api/nodes-by-date - Get all nodes with stats for a specific date
router.get('/nodes-by-date', (req, res) => {
    try {
        const { date } = req.query;  // YYYY-MM-DD format, or 'today' or 'yesterday'
        
        // 計算實際日期
        const timezone = process.env.TRADING_TIMEZONE || 'Europe/London';
        const now = new Date();
        const londonTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
        
        let targetDate;
        if (date === 'today' || !date) {
            // 使用當前交易日
            targetDate = db.getCurrentTradingDate();
        } else if (date === 'yesterday') {
            // 昨天的日期
            const yesterday = new Date(londonTime);
            yesterday.setDate(yesterday.getDate() - 1);
            // 如果現在是 00:00-01:30，昨天其實是前天
            const hours = londonTime.getHours();
            const minutes = londonTime.getMinutes();
            const timeInMinutes = hours * 60 + minutes;
            if (timeInMinutes < 90) {
                yesterday.setDate(yesterday.getDate() - 1);
            }
            targetDate = yesterday.toISOString().split('T')[0];
        } else {
            targetDate = date;
        }
        
        const nodes = db.getAllNodes();
        const dateABStats = db.getAllABStatsByDate(targetDate);
        
        // Create map of node_id to stats
        const abStatsMap = {};
        dateABStats.forEach(stat => {
            abStatsMap[stat.node_id] = stat;
        });
        
        // Enrich nodes with status and stats
        const enrichedNodes = nodes.map(node => {
            const status = heartbeatService.getNodeStatus(node.last_heartbeat);
            const abStats = abStatsMap[node.id] || null;
            
            return {
                ...node,
                status,
                todayABStats: abStats,
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
            targetDate,
            serverTime: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error fetching nodes by date:', error);
        res.status(500).json({
            ok: false,
            error: 'Internal server error'
        });
    }
});

// GET /api/snapshot-info - Get snapshot timing information
router.get('/snapshot-info', (req, res) => {
    try {
        const timezone = process.env.TRADING_TIMEZONE || 'Europe/London';
        const now = new Date();
        
        // 輔助函數：將時間格式化為倫敦時間字串
        const formatLondonTime = (date) => {
            const londonDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
            return `${String(londonDate.getDate()).padStart(2, '0')}/${String(londonDate.getMonth() + 1).padStart(2, '0')} ${String(londonDate.getHours()).padStart(2, '0')}:${String(londonDate.getMinutes()).padStart(2, '0')}`;
        };
        
        // 輔助函數：將時間格式化為香港時間字串
        const formatHKTime = (date) => {
            const hkDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong' }));
            return `HK ${String(hkDate.getDate()).padStart(2, '0')}/${String(hkDate.getMonth() + 1).padStart(2, '0')} ${String(hkDate.getHours()).padStart(2, '0')}:${String(hkDate.getMinutes()).padStart(2, '0')}`;
        };
        
        // 輔助函數：解析 cron 表達式並計算下次執行時間（倫敦時間）
        const getNextCronTime = (cronExpr) => {
            // cron 格式: 分 時 日 月 週
            const parts = cronExpr.split(' ');
            const minute = parseInt(parts[0]);
            const hour = parseInt(parts[1]);
            
            // 獲取當前倫敦時間
            const londonNow = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
            
            // 創建今天的執行時間
            const todayRun = new Date(londonNow);
            todayRun.setHours(hour, minute, 0, 0);
            
            // 如果今天的執行時間已過，則是明天
            if (londonNow >= todayRun) {
                todayRun.setDate(todayRun.getDate() + 1);
            }
            
            return todayRun;
        };
        
        // 從 scheduler 獲取設定的上報時間
        const reportTime1 = process.env.REPORT_TIME_1 || schedulerService.reportTime1 || '45 23 * * *';
        const reportTime2 = process.env.REPORT_TIME_2 || schedulerService.reportTime2 || '0 10 * * *';
        
        // 計算兩個上報時間的下次執行時間
        const nextTime1 = getNextCronTime(reportTime1);
        const nextTime2 = getNextCronTime(reportTime2);
        
        // 選擇最近的一個
        const nextReportTime = nextTime1 < nextTime2 ? nextTime1 : nextTime2;
        
        // 格式化下次上報時間
        const nextSnapshotLondon = formatLondonTime(nextReportTime);
        const nextSnapshotHK = formatHKTime(nextReportTime);
        
        // 獲取最後上報時間（優先使用定時上報，其次是手動請求）
        let lastSnapshotTime = schedulerService.lastScheduledReportTime || snapshotService.lastManualRequestTime || null;
        
        // 如果有最後上報時間，格式化為倫敦和香港時間
        let lastSnapshotLondon = null;
        let lastSnapshotHK = null;
        if (lastSnapshotTime) {
            const lastTime = new Date(lastSnapshotTime);
            lastSnapshotLondon = formatLondonTime(lastTime);
            lastSnapshotHK = formatHKTime(lastTime);
        }
        
        // 當前交易日
        const currentTradingDate = db.getCurrentTradingDate();
        
        res.json({
            ok: true,
            currentTradingDate,
            lastSnapshot: lastSnapshotTime ? {
                utc: lastSnapshotTime,
                london: lastSnapshotLondon,
                hk: lastSnapshotHK
            } : null,
            nextSnapshot: {
                london: nextSnapshotLondon,
                hk: nextSnapshotHK
            },
            serverTime: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error getting snapshot info:', error);
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
