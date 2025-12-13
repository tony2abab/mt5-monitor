const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const db = require('../database/db');
const heartbeatService = require('./heartbeat');

class SnapshotService {
    constructor() {
        this.job = null;
        this.lastManualRequestTime = null;  // 記錄最後一次手動請求上報的時間
        this.lastAutoSnapshotTime = null;   // 記錄最後一次自動快照的時間
        this.snapshotLogFile = path.join(__dirname, '../../data/snapshot.log');
    }
    
    /**
     * 寫入快照日誌
     */
    writeLog(message) {
        const timestamp = new Date().toISOString();
        const logLine = `[${timestamp}] ${message}\n`;
        console.log(`[Snapshot] ${message}`);
        try {
            fs.appendFileSync(this.snapshotLogFile, logLine);
        } catch (err) {
            console.error('[Snapshot] Failed to write log:', err.message);
        }
    }
    
    start() {
        // 每天 CFD 平台時間 00:30 執行快照
        // Cron 表達式：分 時 日 月 週
        // 使用 TRADING_TIMEZONE 環境變數，默認 CFD 平台時間 (Europe/Athens)
        const timezone = process.env.TRADING_TIMEZONE || 'Europe/Athens';
        
        // 啟動時檢查是否有遺漏的快照需要補建
        this.checkAndRecoverMissingSnapshots();
        
        this.job = cron.schedule('30 0 * * *', () => {
            this.createDailySnapshot();
            this.lastAutoSnapshotTime = new Date().toISOString();
        }, {
            timezone: timezone
        });
        
        console.log(`Snapshot service started - Daily snapshots at 00:30 ${timezone} time`);
    }
    
    /**
     * 檢查並補建遺漏的快照
     * 在服務啟動時調用，檢查最近 7 天是否有遺漏的快照
     */
    checkAndRecoverMissingSnapshots() {
        try {
            const timezone = process.env.TRADING_TIMEZONE || 'Europe/Athens';
            const now = new Date();
            const platformTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
            
            this.writeLog('Checking for missing snapshots in the last 7 days...');
            
            // 檢查最近 7 天
            for (let i = 1; i <= 7; i++) {
                const checkDate = new Date(platformTime);
                checkDate.setDate(checkDate.getDate() - i);
                const dateStr = checkDate.toISOString().split('T')[0];
                
                // 檢查該日期是否已有快照
                const existingSnapshot = db.getDailySnapshotByDate(dateStr);
                
                if (!existingSnapshot) {
                    this.writeLog(`Missing snapshot for ${dateStr}, attempting to recover...`);
                    this.recoverSnapshot(dateStr);
                } else if (existingSnapshot.total_ab_profit === 0 && existingSnapshot.total_a_lots === 0) {
                    // 檢查是否是空快照（可能是補建失敗的）
                    // 嘗試從 ab_stats 重新計算
                    const abStats = db.getAllABStatsByDate(dateStr);
                    if (abStats && abStats.length > 0) {
                        const hasData = abStats.some(s => s.ab_profit_total !== 0 || s.a_lots_total > 0);
                        if (hasData) {
                            this.writeLog(`Found empty snapshot for ${dateStr} but ab_stats has data, recovering...`);
                            this.recoverSnapshot(dateStr);
                        }
                    }
                }
            }
            
            this.writeLog('Missing snapshot check completed');
        } catch (error) {
            this.writeLog(`Error checking missing snapshots: ${error.message}`);
        }
    }
    
    /**
     * 從 ab_stats 恢復指定日期的快照
     */
    recoverSnapshot(dateStr) {
        try {
            const abStats = db.getAllABStatsByDate(dateStr);
            
            if (!abStats || abStats.length === 0) {
                this.writeLog(`No ab_stats data found for ${dateStr}, cannot recover`);
                return false;
            }
            
            const nodes = db.getAllNodes();
            const abStatsMap = {};
            abStats.forEach(stat => {
                abStatsMap[stat.node_id] = stat;
            });
            
            const enrichedNodes = nodes.map(node => {
                const abStat = abStatsMap[node.id] || null;
                return {
                    ...node,
                    todayABStats: abStat
                };
            });
            
            // 計算總手數和總盈虧
            const total_a_lots = enrichedNodes.reduce((sum, n) => sum + (n.todayABStats?.a_lots_total || 0), 0);
            const total_b_lots = enrichedNodes.reduce((sum, n) => sum + (n.todayABStats?.b_lots_total || 0), 0);
            const total_ab_profit = enrichedNodes.reduce((sum, n) => sum + (n.todayABStats?.ab_profit_total || 0), 0);
            const total_lots = total_a_lots + total_b_lots;
            
            const total_commission = enrichedNodes.reduce((sum, n) => {
                const lots = n.todayABStats?.a_lots_total || 0;
                const commission_rate = n.todayABStats?.commission_per_lot || 0;
                return sum + (lots * commission_rate);
            }, 0);
            
            const summary = {
                total_nodes: enrichedNodes.length,
                online_nodes: 0,  // 恢復時無法知道當時的在線狀態
                offline_nodes: enrichedNodes.length,
                total_a_lots,
                total_b_lots,
                total_lots_diff: enrichedNodes.reduce((sum, n) => sum + (n.todayABStats?.lots_diff || 0), 0),
                total_a_profit: enrichedNodes.reduce((sum, n) => sum + (n.todayABStats?.a_profit_total || 0), 0),
                total_b_profit: enrichedNodes.reduce((sum, n) => sum + (n.todayABStats?.b_profit_total || 0), 0),
                total_ab_profit,
                total_a_interest: enrichedNodes.reduce((sum, n) => sum + (n.todayABStats?.a_interest_total || 0), 0),
                total_commission,
                total_cost_per_lot: total_lots > 0 ? (total_ab_profit / total_lots) : 0
            };
            
            // 刪除舊的空快照（如果存在）
            db.deleteDailySnapshot(dateStr);
            
            // 創建新快照
            db.createDailySnapshot({
                snapshot_date: dateStr,
                ...summary
            });
            
            this.writeLog(`Recovered snapshot for ${dateStr}: AB profit=${total_ab_profit}, A lots=${total_a_lots}`);
            return true;
        } catch (error) {
            this.writeLog(`Error recovering snapshot for ${dateStr}: ${error.message}`);
            return false;
        }
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
            
            this.writeLog(`Creating daily snapshot for ${snapshotDateStr} at platform time ${platformTime.toISOString()}`);
            
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
            
            this.writeLog(`Daily snapshot created for ${snapshotDateStr}: AB profit=${total_ab_profit}, A lots=${total_a_lots}, B lots=${total_b_lots}`);
        } catch (error) {
            this.writeLog(`ERROR creating daily snapshot: ${error.message}`);
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
