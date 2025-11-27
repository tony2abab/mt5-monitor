-- 更新 daily_snapshots 表結構
-- 添加新欄位

-- 檢查並添加 total_lots_diff 欄位
ALTER TABLE daily_snapshots ADD COLUMN total_lots_diff REAL DEFAULT 0;

-- 檢查並添加 total_a_profit 欄位
ALTER TABLE daily_snapshots ADD COLUMN total_a_profit REAL DEFAULT 0;

-- 檢查並添加 total_b_profit 欄位
ALTER TABLE daily_snapshots ADD COLUMN total_b_profit REAL DEFAULT 0;

-- 檢查並添加 total_cost_per_lot 欄位
ALTER TABLE daily_snapshots ADD COLUMN total_cost_per_lot REAL DEFAULT 0;

-- 驗證表結構
PRAGMA table_info(daily_snapshots);
