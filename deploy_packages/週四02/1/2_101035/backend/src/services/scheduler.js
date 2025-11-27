const cron = require('node-cron');
const db = require('../database/db');

class SchedulerService {
    constructor() {
        this.tasks = [];
    }
    
    /**
     * 啟動定時任務
     */
    start(config = {}) {
        const {
            reportTime1 = '45 23 * * *',  // 默認 23:45 倫敦時間
            reportTime2 = '0 10 * * *'     // 默認 10:00 倫敦時間
        } = config;
        
        console.log('[Scheduler] Starting scheduled tasks...');
        console.log(`[Scheduler] Report time 1: ${reportTime1}`);
        console.log(`[Scheduler] Report time 2: ${reportTime2}`);
        
        // 任務 1：第一個上報時間
        const task1 = cron.schedule(reportTime1, () => {
            this.requestAllNodesReport('Scheduled report time 1');
        }, {
            timezone: 'Europe/London'
        });
        
        // 任務 2：第二個上報時間
        const task2 = cron.schedule(reportTime2, () => {
            this.requestAllNodesReport('Scheduled report time 2');
        }, {
            timezone: 'Europe/London'
        });
        
        // 任務 3：每天清理舊的上報請求
        const task3 = cron.schedule('0 2 * * *', () => {
            this.cleanupOldRequests();
        }, {
            timezone: 'Europe/London'
        });
        
        this.tasks.push(task1, task2, task3);
        console.log('[Scheduler] All tasks started successfully');
    }
    
    /**
     * 要求所有節點上報數據
     */
    requestAllNodesReport(reason = 'Manual request') {
        try {
            console.log(`[Scheduler] Requesting report from all nodes: ${reason}`);
            db.createReportRequest(null);  // null = all nodes
            console.log('[Scheduler] Report request created successfully');
        } catch (error) {
            console.error('[Scheduler] Error requesting report:', error);
        }
    }
    
    /**
     * 清理舊的上報請求
     */
    cleanupOldRequests() {
        try {
            console.log('[Scheduler] Cleaning up old report requests...');
            const result = db.cleanOldReportRequests(7);  // 保留 7 天
            console.log(`[Scheduler] Cleaned up ${result.changes} old requests`);
        } catch (error) {
            console.error('[Scheduler] Error cleaning up requests:', error);
        }
    }
    
    /**
     * 停止所有定時任務
     */
    stop() {
        console.log('[Scheduler] Stopping all tasks...');
        this.tasks.forEach(task => task.stop());
        this.tasks = [];
        console.log('[Scheduler] All tasks stopped');
    }
}

module.exports = new SchedulerService();
