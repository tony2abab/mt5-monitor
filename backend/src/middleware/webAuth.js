/**
 * Web 登入認證中介軟體
 * 只對前端 Web 請求進行登入檢查，不影響 MT5 EA 的 API 請求
 */

const loginService = require('../services/loginService');

// 獲取客戶端 IP
function getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
           req.headers['x-real-ip'] || 
           req.connection?.remoteAddress || 
           req.ip || 
           'unknown';
}

const webAuthMiddleware = (req, res, next) => {
    const webLoginEnabled = process.env.WEB_LOGIN_ENABLED === 'true';
    
    // 如果未啟用 Web 登入保護，直接通過
    if (!webLoginEnabled) {
        return next();
    }
    
    // 檢查是否為 MT5 EA 請求（有 Authorization header 的是 EA 請求）
    const authHeader = req.headers.authorization;
    if (authHeader) {
        // 這是 MT5 EA 請求，不需要 Web 登入檢查
        return next();
    }
    
    const ip = getClientIP(req);
    const token = req.headers['x-session-token'];
    
    // 檢查 session token
    if (loginService.isValidSession(token)) {
        return next();
    }
    
    // 檢查 IP 是否已信任
    if (loginService.isTrusted(ip)) {
        return next();
    }
    
    // 未認證，返回 401
    return res.status(401).json({
        ok: false,
        error: 'Authentication required',
        loginRequired: true
    });
};

module.exports = webAuthMiddleware;
