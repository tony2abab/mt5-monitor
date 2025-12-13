const express = require('express');
const router = express.Router();
const db = require('../database/db');
const heartbeatService = require('../services/heartbeat');
const telegram = require('../services/telegram');
const snapshotService = require('../services/snapshot');
const schedulerService = require('../services/scheduler');
const authMiddleware = require('../middleware/auth');
const webAuthMiddleware = require('../middleware/webAuth');
const loginService = require('../services/loginService');

// ==================== 登入保護 API ====================

// 獲取客戶端 IP
function getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
           req.headers['x-real-ip'] || 
           req.connection?.remoteAddress || 
           req.ip || 
           'unknown';
}

// POST /api/auth/login - 用戶登入
router.post('/auth/login', (req, res) => {
    try {
        const ip = getClientIP(req);
        const { username, password } = req.body;
        
        // 檢查 IP 是否被封鎖
        const blocked = loginService.isBlocked(ip);
        if (blocked.blocked) {
            return res.status(429).json({
                ok: false,
                error: `Too many failed attempts. Try again in ${blocked.remainingMinutes} minutes.`,
                blockedMinutes: blocked.remainingMinutes
            });
        }
        
        // 初始化默認用戶（如果不存在）
        db.initializeDefaultUsers();
        
        // 從資料庫驗證用戶
        const user = db.getUser(username);
        
        if (!user || user.password !== password) {
            const result = loginService.recordFailedAttempt(ip);
            return res.status(401).json({
                ok: false,
                error: 'Invalid username or password',
                attemptsRemaining: result.attemptsRemaining
            });
        }
        
        // 登入成功
        const session = loginService.loginSuccess(ip, user.username, user.allowed_groups, user.show_ungrouped);
        
        res.json({
            ok: true,
            token: session.token,
            username: session.username,
            allowedGroups: session.allowedGroups ? session.allowedGroups.split(',') : [],
            showUngrouped: session.showUngrouped,
            expiresAt: session.expiresAt,
            message: 'Login successful'
        });
    } catch (error) {
        console.error('Error in login:', error);
        res.status(500).json({ ok: false, error: 'Internal server error' });
    }
});

// POST /api/auth/logout - 用戶登出
router.post('/auth/logout', (req, res) => {
    try {
        const token = req.headers['x-session-token'];
        if (token) {
            loginService.logout(token);
        }
        res.json({ ok: true, message: 'Logged out' });
    } catch (error) {
        console.error('Error in logout:', error);
        res.status(500).json({ ok: false, error: 'Internal server error' });
    }
});

// GET /api/auth/check - 檢查登入狀態
router.get('/auth/check', (req, res) => {
    try {
        const ip = getClientIP(req);
        const token = req.headers['x-session-token'];
        const webLoginEnabled = process.env.WEB_LOGIN_ENABLED === 'true';
        
        // 如果未啟用登入保護，直接返回已認證（所有分組）
        if (!webLoginEnabled) {
            return res.json({
                ok: true,
                authenticated: true,
                loginRequired: false,
                allowedGroups: ['A', 'B', 'C'],
                clientGroups: db.getAllClientGroups()
            });
        }
        
        // 檢查 session token
        const session = loginService.getSession(token);
        if (session) {
            // 如果 session 沒有 showUngrouped 欄位（舊 session），從資料庫重新獲取
            let showUngrouped = session.showUngrouped;
            if (showUngrouped === undefined && session.username) {
                const user = db.getUser(session.username);
                showUngrouped = user ? (user.show_ungrouped === 1) : true;
            }
            
            return res.json({
                ok: true,
                authenticated: true,
                loginRequired: true,
                username: session.username,
                allowedGroups: session.allowedGroups ? session.allowedGroups.split(',') : [],
                showUngrouped: showUngrouped === true,
                clientGroups: db.getAllClientGroups()
            });
        }
        
        // 檢查 IP 是否已信任（但需要重新登入以獲取分組權限）
        if (loginService.isTrusted(ip)) {
            return res.json({
                ok: true,
                authenticated: false,
                trustedIP: true,
                loginRequired: true,
                clientGroups: db.getAllClientGroups()
            });
        }
        
        res.json({
            ok: true,
            authenticated: false,
            loginRequired: true,
            clientGroups: db.getAllClientGroups()
        });
    } catch (error) {
        console.error('Error in auth check:', error);
        res.status(500).json({ ok: false, error: 'Internal server error' });
    }
});

// GET /api/auth/stats - 獲取登入統計（需要管理員權限）
router.get('/auth/stats', authMiddleware, (req, res) => {
    try {
        const stats = loginService.getStats();
        res.json({ ok: true, ...stats });
    } catch (error) {
        console.error('Error in auth stats:', error);
        res.status(500).json({ ok: false, error: 'Internal server error' });
    }
});

// ==================== MT5 EA API ====================

// POST /api/heartbeat - Receive heartbeat from MT5 EA (requires auth)
router.post('/heartbeat', authMiddleware, (req, res) => {
    try {
        const { 
            id, name, broker, account, meta, client_group,
            // Monitor_OnlyHeartbeat 模式的場上數據
            open_buy_lots, open_sell_lots, floating_pl, balance, equity
        } = req.body;
        
        // Validation - name 已不再必需，改用 id 作為唯一識別
        if (!id) {
            return res.status(400).json({
                ok: false,
                error: 'Missing required field: id'
            });
        }
        
        // Get old status before update
        const oldNode = db.getNode(id);
        const oldStatus = oldNode ? oldNode.status : null;
        
        // Upsert node with heartbeat (including open position data if provided)
        db.upsertNode({ 
            id, name, broker, account, meta, client_group,
            open_buy_lots, open_sell_lots, floating_pl, balance, equity
        });
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

// POST /api/nodes/clear-stats - Clear today's stats for selected group (keep heartbeats and history)
router.post('/nodes/clear-stats', (req, res) => {
    try {
        const { group } = req.body;  // 可選的分組參數
        const today = new Date().toISOString().split('T')[0];  // 只清除今天的數據
        
        // 清除今天的統計數據（根據分組）
        db.clearTodayStats(today, group || null);
        db.clearTodayABStats(today, group || null);
        
        // 同時清除 nodes 表中的場上數據（Monitor_OnlyHeartbeat 模式的數據）
        db.clearNodesOpenData(group || null);
        
        res.json({
            ok: true,
            message: group 
                ? `分組 ${group} 的今日統計數據已清除` 
                : '所有分組的今日統計數據已清除',
            clearedDate: today,
            clearedGroup: group || 'all',
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
        
        // 自動創建/更新當天的快照（讓歷史數據即時可見）
        // 使用當前交易日期，確保與頂部總表一致
        try {
            const currentTradingDate = db.getCurrentTradingDate();
            snapshotService.manualSnapshot(currentTradingDate);
            console.log(`[AB-Stats] Auto-updated snapshot for ${currentTradingDate} (MT5 reported date: ${date})`);
        } catch (snapshotError) {
            console.error(`[AB-Stats] Failed to update snapshot:`, snapshotError);
            // 不影響主要響應
        }
        
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
        const { group } = req.query;  // 可選的分組過濾
        const nodes = db.getAllNodes(group || null);
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
            
            // 對於 Monitor_OnlyHeartbeat 模式，如果有場上數據但沒有統計數據，顯示心跳時間
            let lastStatsRelative = null;
            // 檢查是否有場上數據（任一欄位有非 null/undefined 且有意義的值）
            const hasOpenData = (
                (node.open_buy_lots != null && node.open_buy_lots > 0) || 
                (node.open_sell_lots != null && node.open_sell_lots > 0) || 
                (node.floating_pl != null && node.floating_pl !== 0) || 
                (node.balance != null && node.balance > 0) || 
                (node.equity != null && node.equity > 0)
            );
            
            if (abStats && abStats.reported_at) {
                lastStatsRelative = getRelativeTime(new Date(abStats.reported_at));
            } else if (hasOpenData && node.last_heartbeat) {
                // Monitor_OnlyHeartbeat 模式：顯示心跳時間作為最後更新時間
                lastStatsRelative = getRelativeTime(new Date(node.last_heartbeat)) + ' (場上)';
            }
            
            return {
                ...node,
                status,
                todayABStats: abStats,  // 新的 A/B 統計數據
                todayStats: stats,      // 保留舊的統計數據（向後兼容）
                lastHeartbeatRelative: node.last_heartbeat ? getRelativeTime(new Date(node.last_heartbeat)) : 'Never',
                lastStatsRelative
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

// DELETE /api/nodes/:id - Delete a node and all its data
router.delete('/nodes/:id', (req, res) => {
    try {
        const { id } = req.params;
        const node = db.getNode(id);
        if (!node) {
            return res.status(404).json({
                ok: false,
                error: 'Node not found'
            });
        }

        db.deleteNode(id);

        res.json({
            ok: true,
            deleted: true,
            nodeId: id,
            serverTime: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error deleting node:', error);
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

// GET /api/history - Get all daily snapshots (with optional group filtering)
router.get('/history', (req, res) => {
    try {
        const groupsParam = req.query.groups;
        const username = req.query.username;  // 前端傳遞用戶名
        const allowedGroups = groupsParam ? groupsParam.split(',') : [];
        
        // 用戶 A 是管理員，可以看到無分組信息的舊數據
        const isAdmin = username === 'A';
        
        const snapshots = allowedGroups.length > 0 
            ? db.getDailyStatsByGroups(allowedGroups, isAdmin)
            : (isAdmin ? db.getAllDailySnapshots() : []);
        
        res.json({
            ok: true,
            snapshots,
            count: snapshots.length,
            groups: allowedGroups,
            isAdmin,
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

// GET /api/history/node - Get specific node's stats within date range with summary
router.get('/history/node', (req, res) => {
    try {
        const { nodeId, startDate, endDate } = req.query;
        
        if (!nodeId || !startDate || !endDate) {
            return res.status(400).json({
                ok: false,
                error: 'Missing required parameters: nodeId, startDate, endDate (format: YYYY-MM-DD)'
            });
        }
        
        // 獲取該節點在日期範圍內的所有數據
        const stats = db.getNodeABStatsByDateRange(nodeId, startDate, endDate);
        
        // 過濾休市日（A盈利和AB盈利都為0）
        const tradingDays = stats.filter(s => 
            (s.a_profit_total !== 0 || s.ab_profit_total !== 0)
        );
        
        // 計算加總
        const summary = {
            node_id: nodeId,
            days_count: tradingDays.length,
            total_a_lots: tradingDays.reduce((sum, s) => sum + (s.a_lots_total || 0), 0),
            total_b_lots: tradingDays.reduce((sum, s) => sum + (s.b_lots_total || 0), 0),
            total_lots_diff: tradingDays.reduce((sum, s) => sum + (s.lots_diff || 0), 0),
            total_a_profit: tradingDays.reduce((sum, s) => sum + (s.a_profit_total || 0), 0),
            total_b_profit: tradingDays.reduce((sum, s) => sum + (s.b_profit_total || 0), 0),
            total_ab_profit: tradingDays.reduce((sum, s) => sum + (s.ab_profit_total || 0), 0),
            total_a_interest: tradingDays.reduce((sum, s) => sum + (s.a_interest_total || 0), 0),
            total_commission: tradingDays.reduce((sum, s) => sum + ((s.a_lots_total || 0) * (s.commission_per_lot || 0)), 0),
            avg_daily_profit: tradingDays.length > 0 
                ? tradingDays.reduce((sum, s) => sum + (s.ab_profit_total || 0), 0) / tradingDays.length 
                : 0
        };
        
        // 計算總盈含息佣
        summary.total_profit_with_interest_commission = summary.total_ab_profit + summary.total_a_interest + summary.total_commission;
        
        res.json({
            ok: true,
            stats: tradingDays,
            summary,
            dateRange: { startDate, endDate },
            serverTime: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error fetching node history:', error);
        res.status(500).json({
            ok: false,
            error: 'Internal server error'
        });
    }
});

// GET /api/history/range - Get daily snapshots within date range with summary
router.get('/history/range', (req, res) => {
    try {
        const { startDate, endDate, groups, username } = req.query;
        
        if (!startDate || !endDate) {
            return res.status(400).json({
                ok: false,
                error: 'Missing required parameters: startDate, endDate (format: YYYY-MM-DD)'
            });
        }
        
        const allowedGroups = groups ? groups.split(',') : [];
        const isAdmin = username === 'A';
        
        // 根據分組過濾數據
        let snapshots;
        if (allowedGroups.length > 0) {
            snapshots = db.getDailyStatsByGroupsAndDateRange(allowedGroups, startDate, endDate, isAdmin);
        } else if (isAdmin) {
            snapshots = db.getDailySnapshotsByDateRange(startDate, endDate);
        } else {
            snapshots = [];
        }
        
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
        const { date, group } = req.query;  // YYYY-MM-DD format, or 'today' or 'yesterday'
        
        // 計算實際日期 - 使用與 getCurrentTradingDate 相同的時區
        const timezone = process.env.TRADING_TIMEZONE || 'Europe/Athens';
        const now = new Date();
        const platformTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
        
        let targetDate;
        if (date === 'today' || !date) {
            // 使用當前交易日
            targetDate = db.getCurrentTradingDate();
        } else if (date === 'yesterday') {
            // 先獲取當前交易日，然後減一天
            const currentTradingDate = db.getCurrentTradingDate();
            const currentDate = new Date(currentTradingDate + 'T12:00:00Z');  // 使用中午避免時區問題
            currentDate.setDate(currentDate.getDate() - 1);
            targetDate = currentDate.toISOString().split('T')[0];
        } else {
            targetDate = date;
        }
        
        console.log(`[nodes-by-date] Requested date: ${date}, Calculated targetDate: ${targetDate}`);
        
        const nodes = db.getAllNodes(group || null);
        const dateABStats = db.getAllABStatsByDate(targetDate);
        
        console.log(`[nodes-by-date] Found ${nodes.length} nodes, ${dateABStats.length} AB stats for ${targetDate}`);
        
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
        // CFD 平台時間（冬令 GMT+2，夏令 GMT+3）
        const timezone = process.env.TRADING_TIMEZONE || 'Europe/Athens';
        const now = new Date();
        
        // 輔助函數：將 UTC Date 格式化為 CFD 平台時間字串
        const formatPlatformTime = (date) => {
            const platformDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
            return `${String(platformDate.getDate()).padStart(2, '0')}/${String(platformDate.getMonth() + 1).padStart(2, '0')} ${String(platformDate.getHours()).padStart(2, '0')}:${String(platformDate.getMinutes()).padStart(2, '0')}`;
        };
        
        // 輔助函數：將 UTC Date 格式化為香港時間字串
        const formatHKTime = (date) => {
            const hkDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong' }));
            return `HK ${String(hkDate.getDate()).padStart(2, '0')}/${String(hkDate.getMonth() + 1).padStart(2, '0')} ${String(hkDate.getHours()).padStart(2, '0')}:${String(hkDate.getMinutes()).padStart(2, '0')}`;
        };
        
        // 輔助函數：解析 cron 表達式並計算下次執行的 UTC 時間
        const getNextCronTimeUTC = (cronExpr) => {
            // cron 格式: 分 時 日 月 週
            const parts = cronExpr.split(' ');
            const targetMinute = parseInt(parts[0]);
            const targetHour = parseInt(parts[1]);
            
            // 獲取當前 CFD 平台時間
            const platformNowStr = now.toLocaleString('en-US', { timeZone: timezone });
            const platformNow = new Date(platformNowStr);
            
            const currentHour = platformNow.getHours();
            const currentMinute = platformNow.getMinutes();
            const currentTimeInMinutes = currentHour * 60 + currentMinute;
            const targetTimeInMinutes = targetHour * 60 + targetMinute;
            
            // 計算需要增加的分鐘數
            let minutesToAdd;
            if (currentTimeInMinutes < targetTimeInMinutes) {
                // 今天還沒到目標時間
                minutesToAdd = targetTimeInMinutes - currentTimeInMinutes;
            } else {
                // 今天已過目標時間，算明天
                minutesToAdd = (24 * 60 - currentTimeInMinutes) + targetTimeInMinutes;
            }
            
            // 從當前 UTC 時間加上分鐘數
            const nextRunUTC = new Date(now.getTime() + minutesToAdd * 60 * 1000);
            return nextRunUTC;
        };
        
        // 從環境變數或 scheduler 獲取設定的上報時間
        const reportTime1 = process.env.REPORT_TIME_1 || schedulerService.reportTime1 || '45 23 * * *';
        const reportTime2 = process.env.REPORT_TIME_2 || schedulerService.reportTime2 || '0 10 * * *';
        
        // 計算兩個上報時間的下次執行時間（UTC）
        const nextTime1 = getNextCronTimeUTC(reportTime1);
        const nextTime2 = getNextCronTimeUTC(reportTime2);
        
        // 選擇最近的一個
        const nextReportTime = nextTime1 < nextTime2 ? nextTime1 : nextTime2;
        
        // 格式化下次上報時間
        const nextSnapshotPlatform = formatPlatformTime(nextReportTime);
        const nextSnapshotHK = formatHKTime(nextReportTime);
        
        // 獲取最後上報時間（優先使用定時上報，其次是手動請求）
        let lastSnapshotTime = schedulerService.lastScheduledReportTime || snapshotService.lastManualRequestTime || null;
        
        // 如果有最後上報時間，格式化為 CFD 平台時間和香港時間
        let lastSnapshotPlatform = null;
        let lastSnapshotHK = null;
        if (lastSnapshotTime) {
            const lastTime = new Date(lastSnapshotTime);
            lastSnapshotPlatform = formatPlatformTime(lastTime);
            lastSnapshotHK = formatHKTime(lastTime);
        }
        
        // 當前交易日
        const currentTradingDate = db.getCurrentTradingDate();
        
        res.json({
            ok: true,
            currentTradingDate,
            lastSnapshot: lastSnapshotTime ? {
                utc: lastSnapshotTime,
                platform: lastSnapshotPlatform,
                hk: lastSnapshotHK
            } : null,
            nextSnapshot: {
                platform: nextSnapshotPlatform,
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

// GET /api/debug/ab-stats - 調試用：查看當前交易日的原始 AB 統計數據
router.get('/debug/ab-stats', (req, res) => {
    try {
        const currentTradingDate = db.getCurrentTradingDate();
        const todayABStats = db.getAllTodayABStats();
        const snapshot = db.getDailySnapshotByDate(currentTradingDate);
        
        // 計算總和
        const calculatedTotal = todayABStats.reduce((sum, stat) => sum + (stat.ab_profit_total || 0), 0);
        
        res.json({
            ok: true,
            currentTradingDate,
            statsCount: todayABStats.length,
            calculatedABProfitTotal: calculatedTotal,
            snapshotABProfitTotal: snapshot?.total_ab_profit || null,
            difference: snapshot ? (snapshot.total_ab_profit - calculatedTotal) : null,
            stats: todayABStats.map(s => ({
                node_id: s.node_id,
                date: s.date,
                ab_profit_total: s.ab_profit_total,
                a_lots_total: s.a_lots_total,
                reported_at: s.reported_at
            })),
            snapshot: snapshot ? {
                snapshot_date: snapshot.snapshot_date,
                total_ab_profit: snapshot.total_ab_profit,
                total_a_lots: snapshot.total_a_lots,
                created_at: snapshot.created_at
            } : null
        });
    } catch (error) {
        console.error('Error in debug/ab-stats:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

module.exports = router;
