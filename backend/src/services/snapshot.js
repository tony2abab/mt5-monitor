const cron = require('node-cron');
const db = require('../database/db');
const heartbeatService = require('./heartbeat');

class SnapshotService {
    constructor() {
        this.job = null;
        this.lastManualRequestTime = null;  // 記錄最後一次手動請求上報的時間
        this.lastAutoSnapshotTime = null;   // 記錄最後一次自動快照的時間
    }
    
    start() {
        // 每天 CFD 平台時間 00:30 執行快照
        // Cron 表達式：分 時 日 月 週
        // 使用 TRADING_TIMEZONE 環境變數，默認 CFD 平台時間 (Europe/Athens)
        const timezone = process.env.TRADING_TIMEZONE || 'Europe/Athens';
        
        this.job = cron.schedule('30 0 * * *', () => {
            this.createDailySnapshot();
            this.lastAutoSnapshotTime = new Date().toISOString();
        }, {
            timezone: timezone
        });
        
        console.log(`Snapshot service started - Daily snapshots at 00:30 ${timezone} time`);
    }
    
    /**
     * 創建每日快照
     * 保存前一天（CFD平台時間 00:30 之前）的總覽數據
     */
    createDailySnapshot() {
        try {
            const now = new Date();
            const timezone = process.env.TRADING_TIMEZONE || 'Europe/Athens';
            const platformTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
            
            // 快照日期是前一天
            const snapshotDate = new Date(platformTime);
            snapshotDate.setDate(snapshotDate.getDate() - 1);
            const snapshotDateStr = snapshotDate.toISOString().split('T')[0]; // YYYY-MM-DD
            
            console.log(`[Snapshot] Creating daily snapshot for ${snapshotDateStr} at platform time ${platformTime.toISOString()}`);
            
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
            
            // 計算總回佣 = Σ(commission_per_lot × a_lots_total)
            // 注意：A和B是同一筆交易的兩邊，手數只需算一次
            const total_commission = enrichedNodes.reduce((sum, n) => {
                const lots = n.todayABStats?.a_lots_total || 0;
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
            // 使用當前交易日期，確保與頂部總表一致
            const currentTradingDate = db.getCurrentTradingDate();
            const useDate = dateStr || currentTradingDate;
            
            console.log(`[Snapshot] Creating snapshot for ${useDate} (current trading date: ${currentTradingDate})`);
            
            // 使用與頂部總表完全相同的數據源
            const nodes = db.getAllNodes();
            const todayABStats = db.getAllABStatsByDate(useDate);
            
            console.log(`[Snapshot] Found ${todayABStats.length} AB stats records for ${useDate}`);
            
            // 打印每個節點的數據，方便調試
            todayABStats.forEach(stat => {
                console.log(`[Snapshot] Node ${stat.node_id}: ab_profit=${stat.ab_profit_total}, a_lots=${stat.a_lots_total}`);
            });
            
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
            
            // 計算總回佣 = Σ(commission_per_lot × a_lots_total)
            // 注意：A和B是同一筆交易的兩邊，手數只需算一次
            const total_commission = enrichedNodes.reduce((sum, n) => {
                const lots = n.todayABStats?.a_lots_total || 0;
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
            
            console.log(`[Snapshot] Calculated totals - AB Profit: ${total_ab_profit}, A Lots: ${total_a_lots}, B Lots: ${total_b_lots}`);
            
            db.createDailySnapshot({
                snapshot_date: useDate,
                ...summary
            });
            
            console.log(`[Snapshot] Manual snapshot created for ${useDate}:`, summary);
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
