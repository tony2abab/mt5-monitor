-- MT5 Monitor Database Schema

-- Nodes table: stores information about each MT5 EA node
CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    broker TEXT,
    account TEXT,
    client_group TEXT DEFAULT 'A',  -- 客戶分組 (A, B, C...)
    last_heartbeat DATETIME,
    status TEXT CHECK(status IN ('online', 'offline')) DEFAULT 'offline',
    meta TEXT, -- JSON string for additional metadata like symbols
    -- Monitor_OnlyHeartbeat 模式的場上數據
    open_buy_lots REAL DEFAULT 0,    -- 場上買單手數
    open_sell_lots REAL DEFAULT 0,   -- 場上賣單手數
    floating_pl REAL DEFAULT 0,      -- 浮動盈虧
    balance REAL DEFAULT 0,          -- 餘額
    equity REAL DEFAULT 0,           -- 淨值
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Migration: Add open position columns if they don't exist
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so we use a workaround
-- These will be added by the migration code in db.js

-- Users table: stores web login users
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    allowed_groups TEXT DEFAULT 'A,B,C',  -- 允許查看的分組，逗號分隔
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Stats table: stores daily trading statistics for each node [LEGACY - 保留向後兼容]
CREATE TABLE IF NOT EXISTS stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id TEXT NOT NULL,
    date DATE NOT NULL,
    profit_loss REAL DEFAULT 0,
    interest REAL DEFAULT 0,
    avg_lots_success REAL DEFAULT 0, -- Win rate (0-1)
    lots_traded REAL DEFAULT 0,
    ab_lots_diff REAL DEFAULT 0, -- Buy lots - Sell lots
    reported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE,
    UNIQUE(node_id, date)
);

-- AB Stats table: stores A/B system trading statistics
CREATE TABLE IF NOT EXISTS ab_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id TEXT NOT NULL,
    date DATE NOT NULL,
    a_lots_total REAL DEFAULT 0,      -- A手數總數
    b_lots_total REAL DEFAULT 0,      -- B手數總數
    lots_diff REAL DEFAULT 0,         -- 手數差 (A-B)
    a_profit_total REAL DEFAULT 0,    -- A盈利總數
    b_profit_total REAL DEFAULT 0,    -- B盈利總數
    ab_profit_total REAL DEFAULT 0,   -- AB總盈利
    a_interest_total REAL DEFAULT 0,  -- A總息
    cost_per_lot REAL DEFAULT 0,      -- 每手成本
    commission_per_lot REAL DEFAULT 0, -- 每手回佣
    open_lots REAL DEFAULT 0,         -- 場上手數
    reported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE,
    UNIQUE(node_id, date)
);

-- State transitions table: tracks status changes for notifications
CREATE TABLE IF NOT EXISTS state_transitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT NOT NULL,
    at DATETIME DEFAULT CURRENT_TIMESTAMP,
    notified INTEGER DEFAULT 0, -- 0 = not notified, 1 = notified
    FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
);

-- Audit log table: tracks all API requests
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    ip TEXT,
    node_id TEXT,
    payload_summary TEXT,
    response_status INTEGER,
    at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Daily snapshots table: stores daily summary at London time 00:30
CREATE TABLE IF NOT EXISTS daily_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_date DATE NOT NULL UNIQUE, -- 快照日期（前一天的交易日）
    total_nodes INTEGER DEFAULT 0,
    online_nodes INTEGER DEFAULT 0,
    offline_nodes INTEGER DEFAULT 0,
    total_a_lots REAL DEFAULT 0,
    total_b_lots REAL DEFAULT 0,
    total_lots_diff REAL DEFAULT 0,
    total_a_profit REAL DEFAULT 0,
    total_b_profit REAL DEFAULT 0,
    total_ab_profit REAL DEFAULT 0,
    total_a_interest REAL DEFAULT 0,
    total_cost_per_lot REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Report requests table: stores report requests for MT5 nodes
CREATE TABLE IF NOT EXISTS report_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id TEXT,  -- NULL means all nodes
    requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    consumed_at DATETIME,  -- When MT5 consumed this request
    FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_nodes_status ON nodes(status);
CREATE INDEX IF NOT EXISTS idx_nodes_last_heartbeat ON nodes(last_heartbeat);
CREATE INDEX IF NOT EXISTS idx_stats_node_date ON stats(node_id, date);
CREATE INDEX IF NOT EXISTS idx_ab_stats_node_date ON ab_stats(node_id, date);
CREATE INDEX IF NOT EXISTS idx_state_transitions_node ON state_transitions(node_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_at ON audit_log(at);
CREATE INDEX IF NOT EXISTS idx_daily_snapshots_date ON daily_snapshots(snapshot_date);
