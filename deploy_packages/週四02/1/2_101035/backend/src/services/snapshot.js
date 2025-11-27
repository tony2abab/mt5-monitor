const cron = require('node-cron');
const db = require('../database/db');
const heartbeatService = require('./heartbeat');

class SnapshotService {
    constructor() {
        this.job = null;
    }
    
    start() {
        // 每天倫敦時間 00:30 執行快照
        // Cron 表達式：分 時 日 月 週
        // 使用 UTC 時間，需要根據倫敦時間調整
        // 倫敦冬令時間 00:30 = UTC 00:30
        // 倫敦夏令時間 00:30 = UTC 23:30（前一天）
        // 為了簡化，我們在 UTC 00:30 執行，並在函數內部轉換為倫敦時間判斷
        
        this.job = cron.schedule('30 0 * * *', () => {
            this.createDailySnapshot();
        }, {
            timezone: 'Europe/London' // 使用倫敦時區
        });
        
        console.log('Snapshot service started - Daily snapshots at 00:30 London time');
    }
    
    /**
     * 創建每日快照
     * 保存前一天（倫敦時間 00:30 之前）的總覽數據
     */
    createDailySnapshot() {
        try {
            const now = new Date();
            const londonTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/London' }));
            
            // 快照日期是前一天
            const snapshotDate = new Date(londonTime);
            snapshotDate.setDate(snapshotDate.getDate() - 1);
            const snapshotDateStr = snapshotDate.toISOString().split('T')[0]; // YYYY-MM-DD
            
            console.log(`[Snapshot] Creating daily snapshot for ${snapshotDateStr} at London time ${londonTime.toISOString()}`);
            
            // 獲取前一天的所有節點和統計數據
            const nodes = db.getAllNodes();
            const yesterdayABStats = db.getAllABStatsByDate(snapshotDateStr); // 使用快照日期查詢數據
            
            // 創建統計映射
            const abStatsMap = {};
            yesterdayABStats.forEach(stat => {
                abStatsMap[stat.node_id] = stat;
            });
            
            // 計算總覽數據
            const enrichedNodes = nodes.map(node => {
                const status = heartbeatService.getNodeStatus(node.last_heartbeat);
                const abStats = abStatsMap[node.id] || null;
                return {
                    ...node,
                    status,
                    todayABStats: abStats
                };
            });
            
            // 計算總手數和總盈虧
            const total_a_lots = enrichedNodes.reduce((sum, n) => sum + (n.todayABStats?.a_lots_total || 0), 0);
            const total_b_lots = enrichedNodes.reduce((sum, n) => sum + (n.todayABStats?.b_lots_total || 0), 0);
            const total_ab_profit = enrichedNodes.reduce((sum, n) => sum + (n.todayABStats?.ab_profit_total || 0), 0);
            const total_lots = total_a_lots + total_b_lots;
            
            // 計算總回佣 = Σ(commission_per_lot × total_lots)
            const total_commission = enrichedNodes.reduce((sum, n) => {
                const lots = (n.todayABStats?.a_lots_total || 0) + (n.todayABStats?.b_lots_total || 0);
                const commission_rate = n.todayABStats?.commission_per_lot || 0;
                return sum + (lots * commission_rate);
            }, 0);
            
            const summary = {
                total_nodes: enrichedNodes.length,
                online_nodes: enrichedNodes.filter(n => n.status === 'online').length,
                offline_nodes: enrichedNodes.filter(n => n.status === 'offline').length,
                total_a_lots,
                total_b_lots,
                total_lots_diff: enrichedNodes.reduce((sum, n) => sum + (n.todayABStats?.lots_diff || 0), 0),
                total_a_profit: enrichedNodes.reduce((sum, n) => sum + (n.todayABStats?.a_profit_total || 0), 0),
                total_b_profit: enrichedNodes.reduce((sum, n) => sum + (n.todayABStats?.b_profit_total || 0), 0),
                total_ab_profit,
                total_a_interest: enrichedNodes.reduce((sum, n) => sum + (n.todayABStats?.a_interest_total || 0), 0),
                total_commission,
                // 平均每手成本 = 總盈虧 / 總手數
                total_cost_per_lot: total_lots > 0 ? (total_ab_profit / total_lots) : 0
            };
            
            // 保存快照
            db.createDailySnapshot({
                snapshot_date: snapshotDateStr,
                ...summary
            });
            
            console.log(`[Snapshot] Daily snapshot created successfully:`, summary);
        } catch (error) {
            console.error('[Snapshot] Error creating daily snapshot:', error);
        }
    }
    
    /**
     * 手動觸發快照（用於測試或補充歷史數據）
     */
    manualSnapshot(dateStr) {
        try {
            console.log(`[Snapshot] Creating manual snapshot for ${dateStr}`);
            
            // 根據指定日期獲取數據
            const nodes = db.getAllNodes();
            const todayABStats = db.getAllABStatsByDate(dateStr);
            
            const abStatsMap = {};
            todayABStats.forEach(stat => {
                abStatsMap[stat.node_id] = stat;
            });
            
            const enrichedNodes = nodes.map(node => {
                const status = heartbeatService.getNodeStatus(node.last_heartbeat);
                const abStats = abStatsMap[node.id] || null;
                return {
                    ...node,
                    status,
                    todayABStats: abStats
                };
            });
            
            // 計算總手數和總盈虧
            const total_a_lots = enrichedNodes.reduce((sum, n) => sum + (n.todayABStats?.a_lots_total || 0), 0);
            const total_b_lots = enrichedNodes.reduce((sum, n) => sum + (n.todayABStats?.b_lots_total || 0), 0);
            const total_ab_profit = enrichedNodes.reduce((sum, n) => sum + (n.todayABStats?.ab_profit_total || 0), 0);
            const total_lots = total_a_lots + total_b_lots;
            
            // 計算總回佣 = Σ(commission_per_lot × total_lots)
            const total_commission = enrichedNodes.reduce((sum, n) => {
                const lots = (n.todayABStats?.a_lots_total || 0) + (n.todayABStats?.b_lots_total || 0);
                const commission_rate = n.todayABStats?.commission_per_lot || 0;
                return sum + (lots * commission_rate);
            }, 0);
            
            const summary = {
                total_nodes: enrichedNodes.length,
                online_nodes: enrichedNodes.filter(n => n.status === 'online').length,
                offline_nodes: enrichedNodes.filter(n => n.status === 'offline').length,
                total_a_lots,
                total_b_lots,
                total_lots_diff: enrichedNodes.reduce((sum, n) => sum + (n.todayABStats?.lots_diff || 0), 0),
                total_a_profit: enrichedNodes.reduce((sum, n) => sum + (n.todayABStats?.a_profit_total || 0), 0),
                total_b_profit: enrichedNodes.reduce((sum, n) => sum + (n.todayABStats?.b_profit_total || 0), 0),
                total_ab_profit,
                total_a_interest: enrichedNodes.reduce((sum, n) => sum + (n.todayABStats?.a_interest_total || 0), 0),
                total_commission,
                // 平均每手成本 = 總盈虧 / 總手數
                total_cost_per_lot: total_lots > 0 ? (total_ab_profit / total_lots) : 0
            };
            
            db.createDailySnapshot({
                snapshot_date: dateStr,
                ...summary
            });
            
            console.log(`[Snapshot] Manual snapshot created for ${dateStr}:`, summary);
            return summary;
        } catch (error) {
            console.error('[Snapshot] Error creating manual snapshot:', error);
            throw error;
        }
    }
    
    stop() {
        if (this.job) {
            this.job.stop();
            console.log('Snapshot service stopped');
        }
    }
}

module.exports = new SnapshotService();
