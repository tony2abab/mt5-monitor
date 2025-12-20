const express = require('express');
const router = express.Router();
const db = require('../database/db');
const telegram = require('../services/telegram');
const authMiddleware = require('../middleware/auth');
const webAuthMiddleware = require('../middleware/webAuth');

// VPS 監測告警抑制緩存（15分鐘內同一 VPS 同一指標只發送一次）
const alertSuppressionCache = new Map();
const ALERT_SUPPRESSION_MINUTES = 15;

// 檢查是否應該抑制告警
function shouldSuppressAlert(vpsName, metricName) {
    const key = `${vpsName}:${metricName}`;
    const lastAlert = alertSuppressionCache.get(key);
    
    if (!lastAlert) {
        return false;
    }
    
    const now = Date.now();
    const minutesSinceLastAlert = (now - lastAlert) / 1000 / 60;
    
    return minutesSinceLastAlert < ALERT_SUPPRESSION_MINUTES;
}

// 記錄告警時間
function recordAlert(vpsName, metricName) {
    const key = `${vpsName}:${metricName}`;
    alertSuppressionCache.set(key, Date.now());
}

// 檢查指標並生成告警
function checkMetricThresholds(vpsName, metrics) {
    const thresholds = db.getAllVPSThresholds();
    const alerts = [];
    
    for (const threshold of thresholds) {
        const metricValue = metrics[threshold.metric_name];
        
        if (metricValue === undefined || metricValue === null) {
            continue;
        }
        
        let alertLevel = null;
        let thresholdValue = null;
        
        if (metricValue >= threshold.critical_threshold) {
            alertLevel = 'critical';
            thresholdValue = threshold.critical_threshold;
        } else if (metricValue >= threshold.warning_threshold) {
            alertLevel = 'warning';
            thresholdValue = threshold.warning_threshold;
        }
        
        if (alertLevel) {
            alerts.push({
                vps_name: vpsName,
                metric_name: threshold.metric_name,
                alert_level: alertLevel,
                metric_value: metricValue,
                threshold_value: thresholdValue,
                description: threshold.description
            });
        }
    }
    
    return alerts;
}

// 發送 Telegram 告警
async function sendVPSAlert(alert) {
    const emoji = alert.alert_level === 'critical' ? '🔴' : '⚠️';
    const levelText = alert.alert_level === 'critical' ? '嚴重' : '警告';
    
    // 正常率告警的特殊處理
    if (alert.metric_name === 'uptime_rate') {
        const message = `⚠️ VPS 正常率告警

VPS: ${alert.vps_name}
指標: 平均正常率
當前值: ${alert.metric_value.toFixed(1)}%
閾值: ${alert.threshold_value}% (警告)
時間: ${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}

${alert.description}

建議檢查該 VPS 的網路連線或監測腳本是否正常運作。`;
        
        await telegram.sendMessage(message);
        return;
    }
    
    const metricNames = {
        'cpu_queue_length': 'CPU 隊列長度',
        'cpu_usage_percent': 'CPU 使用率',
        'context_switches_per_sec': '上下文切換',
        'disk_queue_length': '磁碟隊列長度',
        'disk_read_latency_ms': '磁碟讀取延遲',
        'disk_write_latency_ms': '磁碟寫入延遲',
        'memory_usage_percent': '記憶體使用率'
    };
    
    const metricName = metricNames[alert.metric_name] || alert.metric_name;
    const unit = alert.metric_name.includes('percent') ? '%' : 
                 alert.metric_name.includes('latency') ? 'ms' : '';
    
    const message = `${emoji} VPS 效能告警

VPS: ${alert.vps_name}
指標: ${metricName}
當前值: ${alert.metric_value.toFixed(2)}${unit}
閾值: ${alert.threshold_value.toFixed(2)}${unit} (${levelText})
時間: ${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}

${alert.description || '建議檢查該 VPS 是否受超賣影響。'}`;
    
    await telegram.sendMessage(message);
}

// ==================== VPS 監測 API ====================

// POST /api/vps/metrics - 接收 VPS 效能數據（需要 API Key）
router.post('/metrics', authMiddleware, async (req, res) => {
    try {
        const { vps_name, ...metrics } = req.body;
        
        if (!vps_name) {
            return res.status(400).json({ ok: false, error: 'vps_name is required' });
        }
        
        // 更新或創建 VPS 配置
        db.upsertVPSConfig({ vps_name });
        
        // 儲存效能數據
        db.insertVPSMetrics({ vps_name, ...metrics });
        
        // 檢查告警閾值
        const alerts = checkMetricThresholds(vps_name, metrics);
        
        // 檢查正常率（過去24小時）
        const uptimeStats = db.getVPSUptimeRate(vps_name, 24);
        if (uptimeStats.uptimeRate < 90) {
            const uptimeAlert = {
                vps_name,
                metric_name: 'uptime_rate',
                alert_level: 'warning',
                metric_value: uptimeStats.uptimeRate,
                threshold_value: 90,
                description: `過去24小時發生 ${uptimeStats.criticalCount} 次嚴重告警（共 ${uptimeStats.expectedCount} 次檢測）`
            };
            alerts.push(uptimeAlert);
        }
        
        // 處理告警
        for (const alert of alerts) {
            // 儲存告警歷史（正常率告警不存入資料庫）
            if (alert.metric_name !== 'uptime_rate') {
                db.insertVPSAlert(alert);
            }
            
            // 檢查是否應該發送 Telegram 通知
            if (!shouldSuppressAlert(alert.vps_name, alert.metric_name)) {
                try {
                    await sendVPSAlert(alert);
                    recordAlert(alert.vps_name, alert.metric_name);
                    console.log(`[VPS Alert] Sent alert for ${alert.vps_name} - ${alert.metric_name}`);
                } catch (error) {
                    console.error('[VPS Alert] Failed to send Telegram alert:', error);
                }
            }
        }
        
        res.json({ 
            ok: true, 
            message: 'Metrics received',
            alerts: alerts.length 
        });
    } catch (error) {
        console.error('Error in POST /api/vps/metrics:', error);
        res.status(500).json({ ok: false, error: 'Internal server error' });
    }
});

// GET /api/vps/list - 獲取所有 VPS 列表及最新狀態（需要登入，僅管理員）
router.get('/list', webAuthMiddleware, (req, res) => {
    try {
        // 檢查是否為管理員（用戶 A）
        if (req.user && req.user.username !== 'A') {
            return res.status(403).json({ ok: false, error: 'Access denied. Admin only.' });
        }
        
        const configs = db.getAllVPSConfigs();
        const latestMetrics = db.getAllLatestVPSMetrics();
        const thresholds = db.getAllVPSThresholds();
        
        // 建立 metrics map
        const metricsMap = new Map();
        latestMetrics.forEach(m => metricsMap.set(m.vps_name, m));
        
        // 建立 thresholds map
        const thresholdsMap = new Map();
        thresholds.forEach(t => thresholdsMap.set(t.metric_name, t));
        
        // 合併數據並判斷狀態
        const vpsList = configs.map(config => {
            const metrics = metricsMap.get(config.vps_name);
            
            // 计算过去24小时的正常率
            const uptimeStats = db.getVPSUptimeRate(config.vps_name, 24);
            
            if (!metrics) {
                return {
                    ...config,
                    status: 'offline',
                    metrics: null,
                    uptimeRate: uptimeStats.uptimeRate
                };
            }
            
            // 檢查最後更新時間（超過 10 分鐘視為離線）
            const lastSeen = new Date(metrics.timestamp + ' UTC');
            const now = new Date();
            const minutesSinceLastSeen = (now - lastSeen) / 1000 / 60;
            
            if (minutesSinceLastSeen > 10) {
                return {
                    ...config,
                    status: 'offline',
                    metrics,
                    minutesSinceLastSeen: Math.floor(minutesSinceLastSeen),
                    uptimeRate: uptimeStats.uptimeRate
                };
            }
            
            // 檢查是否有任何指標超過閾值
            let status = 'normal';
            const alerts = [];
            
            for (const [metricName, threshold] of thresholdsMap) {
                const value = metrics[metricName];
                if (value !== undefined && value !== null) {
                    if (value >= threshold.critical_threshold) {
                        status = 'critical';
                        alerts.push({ metric: metricName, level: 'critical', value });
                    } else if (value >= threshold.warning_threshold && status !== 'critical') {
                        status = 'warning';
                        alerts.push({ metric: metricName, level: 'warning', value });
                    }
                }
            }
            
            return {
                ...config,
                status,
                metrics,
                alerts,
                minutesSinceLastSeen: Math.floor(minutesSinceLastSeen),
                uptimeRate: uptimeStats.uptimeRate
            };
        });
        
        res.json({ ok: true, vpsList, thresholds });
    } catch (error) {
        console.error('Error in GET /api/vps/list:', error);
        res.status(500).json({ ok: false, error: 'Internal server error' });
    }
});

// GET /api/vps/metrics/:vpsName - 獲取指定 VPS 的歷史數據（需要登入，僅管理員）
router.get('/metrics/:vpsName', webAuthMiddleware, (req, res) => {
    try {
        // 檢查是否為管理員（用戶 A）
        if (req.user && req.user.username !== 'A') {
            return res.status(403).json({ ok: false, error: 'Access denied. Admin only.' });
        }
        
        const { vpsName } = req.params;
        const hours = parseInt(req.query.hours) || 24;
        
        const history = db.getVPSMetricsHistory(vpsName, hours);
        
        res.json({ ok: true, vpsName, history });
    } catch (error) {
        console.error('Error in GET /api/vps/metrics/:vpsName:', error);
        res.status(500).json({ ok: false, error: 'Internal server error' });
    }
});

// GET /api/vps/thresholds - 獲取告警閾值配置（需要登入，僅管理員）
router.get('/thresholds', webAuthMiddleware, (req, res) => {
    try {
        // 檢查是否為管理員（用戶 A）
        if (req.user && req.user.username !== 'A') {
            return res.status(403).json({ ok: false, error: 'Access denied. Admin only.' });
        }
        
        const thresholds = db.getAllVPSThresholds();
        res.json({ ok: true, thresholds });
    } catch (error) {
        console.error('Error in GET /api/vps/thresholds:', error);
        res.status(500).json({ ok: false, error: 'Internal server error' });
    }
});

// PUT /api/vps/thresholds - 更新告警閾值（需要登入，僅管理員）
router.put('/thresholds', webAuthMiddleware, (req, res) => {
    try {
        // 檢查是否為管理員（用戶 A）
        if (req.user && req.user.username !== 'A') {
            return res.status(403).json({ ok: false, error: 'Access denied. Admin only.' });
        }
        
        const { metric_name, warning_threshold, critical_threshold } = req.body;
        
        if (!metric_name || warning_threshold === undefined || critical_threshold === undefined) {
            return res.status(400).json({ 
                ok: false, 
                error: 'metric_name, warning_threshold, and critical_threshold are required' 
            });
        }
        
        db.updateVPSThreshold(metric_name, warning_threshold, critical_threshold);
        
        res.json({ ok: true, message: 'Threshold updated' });
    } catch (error) {
        console.error('Error in PUT /api/vps/thresholds:', error);
        res.status(500).json({ ok: false, error: 'Internal server error' });
    }
});

// GET /api/vps/alerts - 獲取告警歷史（需要登入，僅管理員）
router.get('/alerts', webAuthMiddleware, (req, res) => {
    try {
        // 檢查是否為管理員（用戶 A）
        if (req.user && req.user.username !== 'A') {
            return res.status(403).json({ ok: false, error: 'Access denied. Admin only.' });
        }
        
        const vpsName = req.query.vps_name || null;
        const hours = parseInt(req.query.hours) || 24;
        
        const alerts = db.getRecentVPSAlerts(vpsName, hours);
        
        res.json({ ok: true, alerts });
    } catch (error) {
        console.error('Error in GET /api/vps/alerts:', error);
        res.status(500).json({ ok: false, error: 'Internal server error' });
    }
});

// POST /api/vps/config - 新增或更新 VPS 配置（需要登入，僅管理員）
router.post('/config', webAuthMiddleware, (req, res) => {
    try {
        // 檢查是否為管理員（用戶 A）
        if (req.user && req.user.username !== 'A') {
            return res.status(403).json({ ok: false, error: 'Access denied. Admin only.' });
        }
        
        const { vps_name, vps_ip, description, is_active } = req.body;
        
        if (!vps_name) {
            return res.status(400).json({ ok: false, error: 'vps_name is required' });
        }
        
        db.upsertVPSConfig({ vps_name, vps_ip, description, is_active });
        
        res.json({ ok: true, message: 'VPS config updated' });
    } catch (error) {
        console.error('Error in POST /api/vps/config:', error);
        res.status(500).json({ ok: false, error: 'Internal server error' });
    }
});

// DELETE /api/vps/config/:vpsName - 刪除 VPS 配置（需要登入，僅管理員）
router.delete('/config/:vpsName', webAuthMiddleware, (req, res) => {
    try {
        // 檢查是否為管理員（用戶 A）
        if (req.user && req.user.username !== 'A') {
            return res.status(403).json({ ok: false, error: 'Access denied. Admin only.' });
        }
        
        const { vpsName } = req.params;
        
        db.deleteVPSConfig(vpsName);
        
        res.json({ ok: true, message: 'VPS config deleted' });
    } catch (error) {
        console.error('Error in DELETE /api/vps/config/:vpsName:', error);
        res.status(500).json({ ok: false, error: 'Internal server error' });
    }
});

// POST /api/vps/reset-uptime/:vpsName - 重置 VPS 平均正常率（需要登入，僅管理員）
router.post('/reset-uptime/:vpsName', webAuthMiddleware, (req, res) => {
    try {
        // 檢查是否為管理員（用戶 A）
        if (req.user && req.user.username !== 'A') {
            return res.status(403).json({ ok: false, error: 'Access denied. Admin only.' });
        }
        
        const { vpsName } = req.params;
        
        db.resetVPSUptimeRate(vpsName);
        
        res.json({ ok: true, message: 'VPS uptime rate reset to 100%' });
    } catch (error) {
        console.error('Error in POST /api/vps/reset-uptime/:vpsName:', error);
        res.status(500).json({ ok: false, error: 'Internal server error' });
    }
});

module.exports = router;
