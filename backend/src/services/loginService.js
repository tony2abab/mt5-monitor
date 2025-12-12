/**
 * 登入保護服務
 * - IP 白名單（30天有效）
 * - 防機械人（登入失敗次數限制）
 * - 多設備支持
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class LoginService {
    constructor() {
        this.dataFile = path.join(__dirname, '../../data/login-sessions.json');
        this.data = {
            trustedIPs: {},      // { ip: { lastLogin, expiresAt, deviceCount } }
            failedAttempts: {},  // { ip: { count, lastAttempt, blockedUntil } }
            sessions: {}         // { sessionToken: { ip, createdAt, expiresAt, username, allowedGroups } }
        };
        
        // 配置
        this.config = {
            ipTrustDays: 30,           // IP 信任期限（天）
            maxDevices: 10,            // 最大設備數
            maxFailedAttempts: 5,      // 最大失敗次數
            blockDurationMinutes: 15,  // 封鎖時間（分鐘）
            sessionDays: 30            // Session 有效期（天）
        };
        
        this.load();
        
        // 每小時清理過期數據
        setInterval(() => this.cleanup(), 60 * 60 * 1000);
    }
    
    load() {
        try {
            // 確保 data 目錄存在
            const dataDir = path.dirname(this.dataFile);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }
            
            if (fs.existsSync(this.dataFile)) {
                const content = fs.readFileSync(this.dataFile, 'utf8');
                this.data = JSON.parse(content);
                console.log(`[LoginService] Loaded ${Object.keys(this.data.trustedIPs).length} trusted IPs`);
            }
        } catch (error) {
            console.error('[LoginService] Error loading data:', error);
        }
    }
    
    save() {
        try {
            const dataDir = path.dirname(this.dataFile);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }
            fs.writeFileSync(this.dataFile, JSON.stringify(this.data, null, 2));
        } catch (error) {
            console.error('[LoginService] Error saving data:', error);
        }
    }
    
    /**
     * 檢查 IP 是否被封鎖
     */
    isBlocked(ip) {
        const attempts = this.data.failedAttempts[ip];
        if (!attempts) return false;
        
        if (attempts.blockedUntil && new Date(attempts.blockedUntil) > new Date()) {
            const remaining = Math.ceil((new Date(attempts.blockedUntil) - new Date()) / 1000 / 60);
            return { blocked: true, remainingMinutes: remaining };
        }
        
        return false;
    }
    
    /**
     * 檢查 IP 是否已信任（30天內登入過）
     */
    isTrusted(ip) {
        const trusted = this.data.trustedIPs[ip];
        if (!trusted) return false;
        
        if (new Date(trusted.expiresAt) > new Date()) {
            return true;
        }
        
        // 已過期，刪除
        delete this.data.trustedIPs[ip];
        this.save();
        return false;
    }
    
    /**
     * 檢查 session token 是否有效
     */
    isValidSession(token) {
        if (!token) return false;
        
        const session = this.data.sessions[token];
        if (!session) return false;
        
        if (new Date(session.expiresAt) > new Date()) {
            return true;
        }
        
        // 已過期，刪除
        delete this.data.sessions[token];
        this.save();
        return false;
    }
    
    /**
     * 獲取 session 信息
     */
    getSession(token) {
        if (!token) return null;
        const session = this.data.sessions[token];
        if (!session) return null;
        if (new Date(session.expiresAt) > new Date()) {
            return session;
        }
        return null;
    }
    
    /**
     * 記錄登入失敗
     */
    recordFailedAttempt(ip) {
        if (!this.data.failedAttempts[ip]) {
            this.data.failedAttempts[ip] = { count: 0, lastAttempt: null, blockedUntil: null };
        }
        
        const attempts = this.data.failedAttempts[ip];
        attempts.count++;
        attempts.lastAttempt = new Date().toISOString();
        
        if (attempts.count >= this.config.maxFailedAttempts) {
            const blockUntil = new Date();
            blockUntil.setMinutes(blockUntil.getMinutes() + this.config.blockDurationMinutes);
            attempts.blockedUntil = blockUntil.toISOString();
            console.log(`[LoginService] IP ${ip} blocked until ${attempts.blockedUntil}`);
        }
        
        this.save();
        return {
            attemptsRemaining: Math.max(0, this.config.maxFailedAttempts - attempts.count),
            blocked: attempts.count >= this.config.maxFailedAttempts
        };
    }
    
    /**
     * 登入成功，創建 session 並信任 IP
     */
    loginSuccess(ip, username = null, allowedGroups = null, showUngrouped = true) {
        // 清除失敗記錄
        delete this.data.failedAttempts[ip];
        
        // 信任 IP
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + this.config.ipTrustDays);
        
        if (!this.data.trustedIPs[ip]) {
            this.data.trustedIPs[ip] = { deviceCount: 0 };
        }
        
        this.data.trustedIPs[ip].lastLogin = new Date().toISOString();
        this.data.trustedIPs[ip].expiresAt = expiresAt.toISOString();
        this.data.trustedIPs[ip].deviceCount++;
        
        // 創建 session token
        const token = crypto.randomBytes(32).toString('hex');
        const sessionExpires = new Date();
        sessionExpires.setDate(sessionExpires.getDate() + this.config.sessionDays);
        
        this.data.sessions[token] = {
            ip,
            username,
            allowedGroups,
            showUngrouped: showUngrouped ? true : false,
            createdAt: new Date().toISOString(),
            expiresAt: sessionExpires.toISOString()
        };
        
        this.save();
        
        console.log(`[LoginService] Login success from IP ${ip}, user: ${username}`);
        
        return {
            token,
            username,
            allowedGroups,
            showUngrouped: showUngrouped ? true : false,
            expiresAt: sessionExpires.toISOString()
        };
    }
    
    /**
     * 登出
     */
    logout(token) {
        if (this.data.sessions[token]) {
            delete this.data.sessions[token];
            this.save();
            return true;
        }
        return false;
    }
    
    /**
     * 清理過期數據
     */
    cleanup() {
        const now = new Date();
        let cleaned = 0;
        
        // 清理過期的信任 IP
        for (const ip in this.data.trustedIPs) {
            if (new Date(this.data.trustedIPs[ip].expiresAt) < now) {
                delete this.data.trustedIPs[ip];
                cleaned++;
            }
        }
        
        // 清理過期的 sessions
        for (const token in this.data.sessions) {
            if (new Date(this.data.sessions[token].expiresAt) < now) {
                delete this.data.sessions[token];
                cleaned++;
            }
        }
        
        // 清理過期的封鎖記錄（超過24小時）
        const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
        for (const ip in this.data.failedAttempts) {
            const attempts = this.data.failedAttempts[ip];
            if (new Date(attempts.lastAttempt) < dayAgo) {
                delete this.data.failedAttempts[ip];
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            console.log(`[LoginService] Cleaned ${cleaned} expired records`);
            this.save();
        }
    }
    
    /**
     * 獲取統計信息
     */
    getStats() {
        return {
            trustedIPCount: Object.keys(this.data.trustedIPs).length,
            activeSessionCount: Object.keys(this.data.sessions).length,
            blockedIPCount: Object.values(this.data.failedAttempts)
                .filter(a => a.blockedUntil && new Date(a.blockedUntil) > new Date()).length,
            trustedIPs: Object.entries(this.data.trustedIPs).map(([ip, data]) => ({
                ip: ip.replace(/\d+$/, 'xxx'), // 部分隱藏 IP
                lastLogin: data.lastLogin,
                expiresAt: data.expiresAt
            }))
        };
    }
}

module.exports = new LoginService();
