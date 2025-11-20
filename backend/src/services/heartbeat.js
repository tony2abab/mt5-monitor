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
    
    start() {
        // Run every minute to check for offline nodes
        this.job = cron.schedule('* * * * *', () => {
            this.checkOfflineNodes();
        });
        
        console.log('Heartbeat monitoring service started (checking every minute)');
    }
    
    checkOfflineNodes() {
        try {
            const nodes = db.getAllNodes();
            const now = new Date();
            
            nodes.forEach(node => {
                if (!node.last_heartbeat) return;
                
                const lastHeartbeat = new Date(node.last_heartbeat);
                const secondsSinceHeartbeat = (now - lastHeartbeat) / 1000;
                
                const shouldBeOffline = secondsSinceHeartbeat > this.timeoutSeconds;
                const currentStatus = node.status;
                
                // Status changed from online to offline
                if (shouldBeOffline && currentStatus === 'online') {
                    console.log(`Node ${node.id} (${node.name}) went offline`);
                    db.updateNodeStatus(node.id, 'offline');
                    db.addStateTransition(node.id, 'online', 'offline');
                    
                    // Send Telegram notification (if enabled)
                    if (this.notifyOffline && !this.mutedNodeIds.has(node.id)) {
                        telegram.sendNodeOfflineNotification(node).catch(err => {
                            console.error('Failed to send offline notification:', err);
                        });
                    }
                }
                
                // Status changed from offline to online (should not happen here, but handle it)
                if (!shouldBeOffline && currentStatus === 'offline') {
                    console.log(`Node ${node.id} (${node.name}) came back online`);
                    db.updateNodeStatus(node.id, 'online');
                    db.addStateTransition(node.id, 'offline', 'online');
                    // Automatically unmute when node comes back online
                    this.mutedNodeIds.delete(node.id);
                    
                    telegram.sendNodeOnlineNotification(node).catch(err => {
                        console.error('Failed to send online notification:', err);
                    });
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
        const lastHeartbeatDate = new Date(lastHeartbeat);
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
