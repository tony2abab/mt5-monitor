const TelegramBot = require('node-telegram-bot-api');

class TelegramService {
    constructor() {
        this.enabled = false;
        this.bot = null;
        this.chatId = null;
        
        const token = process.env.TELEGRAM_BOT_TOKEN;
        const chatId = process.env.TELEGRAM_CHAT_ID;
        
        if (token && chatId) {
            try {
                this.bot = new TelegramBot(token, { polling: false });
                this.chatId = chatId;
                this.enabled = true;
                console.log('Telegram service initialized');
            } catch (error) {
                console.error('Failed to initialize Telegram bot:', error.message);
            }
        } else {
            console.log('Telegram not configured (missing BOT_TOKEN or CHAT_ID)');
        }
    }
    
    async sendNodeOfflineNotification(node) {
        if (!this.enabled) return;
        
        const message = `
🔴 [MT5 監控] 節點離線

節點: ${node.name || 'Unknown'} (ID: ${node.id})
帳號: ${node.account || 'N/A'} / ${node.broker || 'N/A'}
最後心跳: ${node.last_heartbeat ? new Date(node.last_heartbeat).toISOString() : 'N/A'}
時間: ${new Date().toISOString()}

請檢查該節點狀態！
        `.trim();
        
        try {
            await this.bot.sendMessage(this.chatId, message);
            console.log(`Telegram notification sent for offline node: ${node.id}`);
        } catch (error) {
            console.error('Failed to send Telegram notification:', error.message);
        }
    }
    
    async sendNodeOnlineNotification(node) {
        if (!this.enabled) return;
        
        const notifyOnRecovery = process.env.NOTIFY_ON_RECOVERY === 'true';
        if (!notifyOnRecovery) return;
        
        const message = `
🟢 [MT5 監控] 節點恢復上線

節點: ${node.name || 'Unknown'} (ID: ${node.id})
帳號: ${node.account || 'N/A'} / ${node.broker || 'N/A'}
恢復時間: ${new Date().toISOString()}

節點已恢復正常運作。
        `.trim();
        
        try {
            await this.bot.sendMessage(this.chatId, message);
            console.log(`Telegram notification sent for online node: ${node.id}`);
        } catch (error) {
            console.error('Failed to send Telegram notification:', error.message);
        }
    }
    
    async sendCustomMessage(message) {
        if (!this.enabled) return;
        
        try {
            await this.bot.sendMessage(this.chatId, message);
            console.log('Custom Telegram message sent');
        } catch (error) {
            console.error('Failed to send custom Telegram message:', error.message);
        }
    }
}

module.exports = new TelegramService();
