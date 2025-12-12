const cron = require('node-cron');
const db = require('../database/db');
const telegram = require('./telegram');

class HeartbeatService {
    constructor() {
        this.timeoutSeconds = parseInt(process.env.HEARTBEAT_TIMEOUT_SECONDS) || 900; // 15 minutes default
        this.job = null;
        this.notifyOffline = process.env.NOTIFY_OFFLINE !== 'false'; // default on
        this.mutedNodeIds = new Set(); // nodes whose offline notifications are muted (e.g. hidden in UI)
        
        // 靜默期設定（7 分鐘）
        this.silentPeriodMinutes = 7;
        this.silentUntil = null; // 靜默期結束時間
        this.startSilentPeriod(); // 啟動時開始靜默期
    }
    
    /**
     * 開始靜默期（7 分鐘內不發送離線通知）
     */
    startSilentPeriod() {
        const now = new Date();
        this.silentUntil = new Date(now.getTime() + this.silentPeriodMinutes * 60 * 1000);
        console.log(`[靜默期] 開始靜默期，將於 ${this.silentUntil.toLocaleString()} 結束（${this.silentPeriodMinutes} 分鐘後）`);
    }
    
    /**
     * 檢查是否在靜默期內
     */
    isInSilentPeriod() {
        if (!this.silentUntil) return false;
        return new Date() < this.silentUntil;
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
        
        // 每 10 分鐘輸出一次交易時段狀態（用於診斷）
        this.statusJob = cron.schedule('*/10 * * * *', () => {
            const timezone = process.env.TRADING_TIMEZONE || 'Europe/Athens';
            const now = new Date();
            const tradingTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
            const isClosing = this.isMarketClosingTime();
            const isWithin = this.isWithinTradingHours();
            const isSilent = this.isInSilentPeriod();
            console.log(`[交易時段狀態] ${timezone} 時間: ${tradingTime.toLocaleString()}, 收市時段: ${isClosing}, 交易時段內: ${isWithin}, 靜默期: ${isSilent}`);
        });
        
        // 每天 01:30 開市時重設所有節點狀態並開始靜默期
        // 使用 CFD 平台時區
        this.marketOpenJob = cron.schedule('30 1 * * 1-5', () => {
            console.log('[開市重設] 01:30 開市，重設所有節點狀態並開始 7 分鐘靜默期');
            this.resetAllNodesStatus();
            this.startSilentPeriod();
        }, {
            timezone: process.env.TRADING_TIMEZONE || 'Europe/Athens'
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
                    console.log(`[離線檢測] 節點 ${node.id} (${node.name}) 離線了`);
                    console.log(`  - 最後心跳: ${node.last_heartbeat}`);
                    console.log(`  - 距今秒數: ${secondsSinceHeartbeat.toFixed(0)}s (超時閾值: ${this.timeoutSeconds}s)`);
                    
                    db.updateNodeStatus(node.id, 'offline');
                    db.addStateTransition(node.id, 'online', 'offline');
                    
                    // Send Telegram notification (if enabled and within trading hours)
                    if (this.notifyOffline && !this.mutedNodeIds.has(node.id)) {
                        const isClosingTime = this.isMarketClosingTime();
                        const isWithinHours = this.isWithinTradingHours();
                        const isSilent = this.isInSilentPeriod();
                        
                        console.log(`  - notifyOffline: ${this.notifyOffline}`);
                        console.log(`  - isMuted: ${this.mutedNodeIds.has(node.id)}`);
                        console.log(`  - isMarketClosingTime: ${isClosingTime}`);
                        console.log(`  - isWithinTradingHours: ${isWithinHours}`);
                        console.log(`  - isInSilentPeriod: ${isSilent}`);
                        
                        // 檢查是否在靜默期
                        if (isSilent) {
                            console.log(`  => [靜默期] 跳過 TG 通知（靜默期至 ${this.silentUntil.toLocaleString()}）`);
                        } else if (isClosingTime) {
                            console.log(`  => [收市時段] 跳過 TG 通知`);
                        } else if (isWithinHours) {
                            console.log(`  => 發送 TG 離線通知...`);
                            telegram.sendNodeOfflineNotification(node).catch(err => {
                                console.error('Failed to send offline notification:', err);
                            });
                        } else {
                            console.log(`  => [非交易時段] 跳過 TG 通知`);
                        }
                    } else {
                        console.log(`  - 通知被禁用或節點被靜音，跳過 TG 通知`);
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
    
    /**
     * 重置所有節點狀態為 online（用於每日開市時）
     * 這樣下次 checkOfflineNodes 時，如果節點仍然離線，會正確觸發 TG 通知
     * 注意：此函數應與 startSilentPeriod() 配合使用，避免大量通知
     */
    resetAllNodesStatus() {
        try {
            const nodes = db.getAllNodes();
            let resetCount = 0;
            
            nodes.forEach(node => {
                if (node.status === 'offline') {
                    db.updateNodeStatus(node.id, 'online');
                    resetCount++;
                    console.log(`[開市重設] 節點 ${node.id} 狀態重置為 online`);
                }
            });
            
            if (resetCount > 0) {
                console.log(`[開市重設] 共重置 ${resetCount} 個離線節點的狀態`);
            } else {
                console.log('[開市重設] 沒有需要重置的離線節點');
            }
        } catch (error) {
            console.error('[開市重設] 錯誤:', error);
        }
    }
}

module.exports = new HeartbeatService();
