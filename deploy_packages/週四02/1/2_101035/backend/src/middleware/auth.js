// Authentication middleware
const authMiddleware = (req, res, next) => {
    const enableAuth = process.env.ENABLE_AUTH === 'true';
    
    if (!enableAuth) {
        return next();
    }
    
    const authHeader = req.headers.authorization;
    const expectedKey = process.env.API_KEY;
    
    if (!expectedKey) {
        console.warn('API_KEY not set in environment variables');
        return res.status(500).json({
            ok: false,
            error: 'Server authentication not configured'
        });
    }
    
    if (!authHeader) {
        return res.status(401).json({
            ok: false,
            error: 'Missing authorization header'
        });
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    if (token !== expectedKey) {
        return res.status(401).json({
            ok: false,
            error: 'Invalid API key'
        });
    }
    
    next();
};

module.exports = authMiddleware;
