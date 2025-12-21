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
    -- 帳戶淨值 NAV (始終發送)
    nav REAL DEFAULT 0,              -- 帳戶淨值
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

-- VPS monitoring tables
-- VPS configuration table: stores VPS information
CREATE TABLE IF NOT EXISTS vps_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vps_name TEXT NOT NULL UNIQUE,  -- VPS 識別名稱
    vps_ip TEXT,                     -- VPS IP 地址
    description TEXT,                -- 描述
    is_active INTEGER DEFAULT 1,    -- 是否啟用監測 (0=停用, 1=啟用)
    last_seen DATETIME,              -- 最後上報時間
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- VPS metrics table: stores performance metrics
CREATE TABLE IF NOT EXISTS vps_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vps_name TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    cpu_queue_length REAL DEFAULT 0,        -- 處理器隊列長度
    cpu_queue_length_ultra REAL DEFAULT 0,  -- 處理器隊列長度(超級監控)
    cpu_usage_percent REAL DEFAULT 0,       -- CPU 使用率
    context_switches_per_sec REAL DEFAULT 0, -- 上下文切換/秒
    disk_queue_length REAL DEFAULT 0,       -- 磁碟隊列長度
    disk_read_latency_ms REAL DEFAULT 0,    -- 讀取延遲 (毫秒)
    disk_write_latency_ms REAL DEFAULT 0,   -- 寫入延遲 (毫秒)
    memory_available_mb REAL DEFAULT 0,     -- 可用記憶體 (MB)
    memory_usage_percent REAL DEFAULT 0,    -- 記憶體使用率
    FOREIGN KEY (vps_name) REFERENCES vps_config(vps_name) ON DELETE CASCADE
);

-- VPS alert thresholds table: stores alert threshold configuration
CREATE TABLE IF NOT EXISTS vps_alert_thresholds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric_name TEXT NOT NULL UNIQUE,       -- 指標名稱
    warning_threshold REAL NOT NULL,        -- 警告閾值
    critical_threshold REAL NOT NULL,       -- 嚴重閾值
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- VPS alert history table: stores alert history
CREATE TABLE IF NOT EXISTS vps_alert_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vps_name TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    alert_level TEXT CHECK(alert_level IN ('warning', 'critical', 'recovery')) NOT NULL,
    metric_value REAL NOT NULL,
    threshold_value REAL NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    notified INTEGER DEFAULT 0,  -- 是否已發送 Telegram (0=未發送, 1=已發送)
    FOREIGN KEY (vps_name) REFERENCES vps_config(vps_name) ON DELETE CASCADE
);

-- Initialize default alert thresholds
INSERT OR IGNORE INTO vps_alert_thresholds (metric_name, warning_threshold, critical_threshold, description) VALUES
    ('cpu_queue_length', 5.0, 20.0, 'CPU 隊列長度 - 超過表示 CPU 超賣'),
    ('cpu_queue_length_ultra', 999999.0, 100.0, 'CPU 隊列超 - 超級監控閾值'),
    ('context_switches_per_sec', 50000.0, 100000.0, '上下文切換/秒 - 過高表示 CPU 超賣'),
    ('cpu_usage_percent', 80.0, 95.0, 'CPU 使用率'),
    ('disk_queue_length', 2.0, 5.0, '磁碟隊列長度 - 超過表示 I/O 瓶頸'),
    ('disk_read_latency_ms', 50.0, 100.0, '磁碟讀取延遲'),
    ('disk_write_latency_ms', 50.0, 100.0, '磁碟寫入延遲'),
    ('memory_usage_percent', 85.0, 95.0, '記憶體使用率');

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_nodes_status ON nodes(status);
CREATE INDEX IF NOT EXISTS idx_nodes_last_heartbeat ON nodes(last_heartbeat);
CREATE INDEX IF NOT EXISTS idx_stats_node_date ON stats(node_id, date);
CREATE INDEX IF NOT EXISTS idx_ab_stats_node_date ON ab_stats(node_id, date);
CREATE INDEX IF NOT EXISTS idx_state_transitions_node ON state_transitions(node_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_at ON audit_log(at);
CREATE INDEX IF NOT EXISTS idx_daily_snapshots_date ON daily_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_vps_metrics_vps_timestamp ON vps_metrics(vps_name, timestamp);
CREATE INDEX IF NOT EXISTS idx_vps_metrics_timestamp ON vps_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_vps_alert_history_vps ON vps_alert_history(vps_name);
CREATE INDEX IF NOT EXISTS idx_vps_alert_history_timestamp ON vps_alert_history(timestamp);
