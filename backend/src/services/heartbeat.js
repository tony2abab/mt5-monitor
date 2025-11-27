const cron = require('node-cron');
const db = require('../database/db');
const telegram = require('./telegram');

class HeartbeatService {
    constructor() {
        this.timeoutSeconds = parseInt(process.env.HEARTBEAT_TIMEOUT_SECONDS) || 900; // 15 minutes default
        this.job = null;
        this.notifyOffline = process.env.NOTIFY_OFFLINE !== 'false'; // default on
        this.mutedNodeIds = new Set(); // nodes whose offline notifications are muted (e.g. hidden in UI)
    }
    
    /**
     * 檢查是否在交易時段（CFD平台時間：冬令GMT+2，夏令GMT+3）
     * 週一至週五 01:30-23:30
     */
    isWithinTradingHours() {
        // 檢查是否啟用交易時段限制
        if (process.env.TRADING_HOURS_ENABLED !== 'true') {
            return true; // 未啟用時，始終發送通知
        }

        const now = new Date();
        const timezone = process.env.TRADING_TIMEZONE || 'Europe/Athens';
        
        // 轉換為指定時區的時間
        const tradingTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
        
        const day = tradingTime.getDay(); // 0=週日, 1=週一, ..., 6=週六
        const hour = tradingTime.getHours();
        const minute = tradingTime.getMinutes();
        const timeInMinutes = hour * 60 + minute;
        
        // 檢查星期幾
        const daysStart = parseInt(process.env.TRADING_DAYS_START || '1');
        const daysEnd = parseInt(process.env.TRADING_DAYS_END || '5');
        if (day < daysStart || day > daysEnd) {
            return false;
        }
        
        // 解析開始和結束時間
        const [startHour, startMin] = (process.env.TRADING_HOURS_START || '01:30').split(':').map(Number);
        const [endHour, endMin] = (process.env.TRADING_HOURS_END || '23:30').split(':').map(Number);
        
        const startTime = startHour * 60 + startMin;
        const endTime = endHour * 60 + endMin;
        
        return timeInMinutes >= startTime && timeInMinutes <= endTime;
    }
    
    /**
     * 檢查當前是否在每日收市時段（23:50-01:15 CFD平台時間）
     * 在此時段內不應發送離線通知，因為市場關閉沒有 tick
     * 此時段與交易日邏輯一致：01:30 前算前一天，01:30 後算新一天
     * @returns {boolean}
     */
    isMarketClosingTime() {
        const timezone = process.env.TRADING_TIMEZONE || 'Europe/Athens';
        const now = new Date();
        const tradingTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
        
        const hours = tradingTime.getHours();
        const minutes = tradingTime.getMinutes();
        const timeInMinutes = hours * 60 + minutes;
        
        // 23:50 = 1430 分鐘
        // 01:15 = 75 分鐘（不包含 01:15，01:15 開始可能發送通知）
        const closingStart = 23 * 60 + 50; // 23:50
        const closingEnd = 1 * 60 + 15;     // 01:15
        
        // 跨越午夜的時段（23:50-01:14，不包含 01:15）
        if (timeInMinutes >= closingStart || timeInMinutes < closingEnd) {
            return true;
        }
        
        return false;
    }
    
    /**
     * 檢查指定時間是否在交易時段內
     * @param {Date} dateTime - 要檢查的時間
     * @returns {boolean}
     */
    isWithinTradingHoursAt(dateTime) {
        // 如果未啟用交易時段限制，總是返回 true
        if (process.env.TRADING_HOURS_ENABLED !== 'true') {
            return true; // 未啟用時段限制，總是允許通知
        }

        const timezone = process.env.TRADING_TIMEZONE || 'Europe/Athens';
        
        // 轉換為指定時區的時間
        const tradingTime = new Date(dateTime.toLocaleString('en-US', { timeZone: timezone }));
        
        // 檢查星期幾（0 = 週日, 1 = 週一, ..., 6 = 週六）
        const dayOfWeek = tradingTime.getDay();
        const daysStart = parseInt(process.env.TRADING_DAYS_START || '1', 10); // 預設週一
        const daysEnd = parseInt(process.env.TRADING_DAYS_END || '5', 10);     // 預設週五
        
        if (dayOfWeek < daysStart || dayOfWeek > daysEnd) {
            return false; // 不在交易日內
        }
        
        // 計算當前時間在一天中的分鐘數
        const hours = tradingTime.getHours();
        const minutes = tradingTime.getMinutes();
        const timeInMinutes = hours * 60 + minutes;
        
        // 解析開始和結束時間
        const [startHour, startMin] = (process.env.TRADING_HOURS_START || '01:30').split(':').map(Number);
        const [endHour, endMin] = (process.env.TRADING_HOURS_END || '23:30').split(':').map(Number);
        
        const startTime = startHour * 60 + startMin;
        const endTime = endHour * 60 + endMin;
        
        return timeInMinutes >= startTime && timeInMinutes <= endTime;
    }
    
    start() {
        // Run every minute to check for offline nodes
        this.job = cron.schedule('* * * * *', () => {
            this.checkOfflineNodes();
        });
        
        console.log('Heartbeat monitoring service started (checking every minute)');
        
        // 輸出交易時段配置
        if (process.env.TRADING_HOURS_ENABLED === 'true') {
            const start = process.env.TRADING_HOURS_START || '01:30';
            const end = process.env.TRADING_HOURS_END || '23:30';
            const timezone = process.env.TRADING_TIMEZONE || 'Europe/Athens';
            const daysStart = process.env.TRADING_DAYS_START || '1';
            const daysEnd = process.env.TRADING_DAYS_END || '5';
            const dayNames = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
            console.log(`[交易時段限制] 已啟用`);
            console.log(`  時段: ${start} - ${end} (${timezone})`);
            console.log(`  日期: ${dayNames[daysStart]} 至 ${dayNames[daysEnd]}`);
        } else {
            console.log('[交易時段限制] 未啟用，24/7 發送通知');
        }
    }
    
    checkOfflineNodes() {
        try {
            const nodes = db.getAllNodes();
            const now = new Date();
            
            nodes.forEach(node => {
                if (!node.last_heartbeat) return;
                
                // Parse as UTC by appending 'Z' if no timezone info
                const lastHeartbeatStr = node.last_heartbeat.includes('T') || node.last_heartbeat.includes('Z') 
                    ? node.last_heartbeat 
                    : node.last_heartbeat + 'Z';
                const lastHeartbeat = new Date(lastHeartbeatStr);
                const secondsSinceHeartbeat = (now - lastHeartbeat) / 1000;
                
                const shouldBeOffline = secondsSinceHeartbeat > this.timeoutSeconds;
                const currentStatus = node.status;
                
                // Status changed from online to offline
                if (shouldBeOffline && currentStatus === 'online') {
                    console.log(`Node ${node.id} (${node.name}) went offline`);
                    db.updateNodeStatus(node.id, 'offline');
                    db.addStateTransition(node.id, 'online', 'offline');
                    
                    // Send Telegram notification (if enabled and within trading hours)
                    if (this.notifyOffline && !this.mutedNodeIds.has(node.id)) {
                        // 檢查是否在收市時段（23:55-01:05）
                        if (this.isMarketClosingTime()) {
                            console.log(`[收市時段] 節點 ${node.id} 在收市時段離線（23:50-01:15），跳過 TG 通知`);
                        } else if (this.isWithinTradingHours()) {
                            telegram.sendNodeOfflineNotification(node).catch(err => {
                                console.error('Failed to send offline notification:', err);
                            });
                        } else {
                            console.log(`[交易時段限制] 節點 ${node.id} 離線，但不在交易時段內，跳過 TG 通知`);
                        }
                    }
                }
                
                // Status changed from offline to online (should not happen here, but handle it)
                if (!shouldBeOffline && currentStatus === 'offline') {
                    console.log(`Node ${node.id} (${node.name}) came back online`);
                    db.updateNodeStatus(node.id, 'online');
                    db.addStateTransition(node.id, 'offline', 'online');
                    // Automatically unmute when node comes back online
                    this.mutedNodeIds.delete(node.id);
                    
                    // Send Telegram notification (only within trading hours)
                    if (this.isWithinTradingHours()) {
                        telegram.sendNodeOnlineNotification(node).catch(err => {
                            console.error('Failed to send online notification:', err);
                        });
                    } else {
                        console.log(`[交易時段限制] 節點 ${node.id} 恢復在線，但不在交易時段內，跳過 TG 通知`);
                    }
                }
            });
        } catch (error) {
            console.error('Error checking offline nodes:', error);
        }
    }
    
    stop() {
        if (this.job) {
            this.job.stop();
            console.log('Heartbeat monitoring service stopped');
        }
    }
    
    // Calculate node status based on last heartbeat
    getNodeStatus(lastHeartbeat) {
        if (!lastHeartbeat) return 'offline';
        
        const now = new Date();
        // Parse as UTC by appending 'Z' if no timezone info
        const lastHeartbeatStr = lastHeartbeat.includes('T') || lastHeartbeat.includes('Z') 
            ? lastHeartbeat 
            : lastHeartbeat + 'Z';
        const lastHeartbeatDate = new Date(lastHeartbeatStr);
        const secondsSinceHeartbeat = (now - lastHeartbeatDate) / 1000;
        
        return secondsSinceHeartbeat > this.timeoutSeconds ? 'offline' : 'online';
    }

    // Mark a node as muted (no offline Telegram notifications)
    muteNode(id) {
        this.mutedNodeIds.add(id);
    }

    // Explicitly unmute a node
    unmuteNode(id) {
        this.mutedNodeIds.delete(id);
    }
}

module.exports = new HeartbeatService();
