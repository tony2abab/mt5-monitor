const db = require('../database/db');

// Audit logging middleware
const auditMiddleware = (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
        // Log the request
        const ip = req.ip || req.connection.remoteAddress;
        const endpoint = req.path;
        const method = req.method;
        const nodeId = req.body?.id || req.params?.id || null;
        const payloadSummary = JSON.stringify({
            body: req.body ? Object.keys(req.body) : [],
            query: req.query ? Object.keys(req.query) : []
        });
        
        try {
            db.addAuditLog(endpoint, method, ip, nodeId, payloadSummary, res.statusCode);
        } catch (error) {
            console.error('Failed to log audit:', error);
        }
        
        originalSend.call(this, data);
    };
    
    next();
};

module.exports = auditMiddleware;
