# MT5 Monitor 系統技術文件

## 📋 目錄
1. [系統概述](#系統概述)
2. [技術棧](#技術棧)
3. [項目結構](#項目結構)
4. [環境配置](#環境配置)
5. [VPS 部署步驟](#vps-部署步驟)
6. [API 文檔](#api-文檔)
7. [數據庫架構](#數據庫架構)
8. [維護指南](#維護指南)

---

## 系統概述

MT5 Monitor 是一個實時監控 MT4/MT5 交易節點的 Web 應用系統，支持：
- 實時節點狀態監控
- AB 交易統計追蹤
- 歷史數據快照
- Telegram 通知
- 交易時段控制

---

## 技術棧

### 後端
- **運行環境**: Node.js v18+
- **框架**: Express.js 4.18.2
- **數據庫**: SQLite (better-sqlite3 9.2.2)
- **定時任務**: node-cron 3.0.3
- **通知服務**: node-telegram-bot-api 0.64.0
- **其他依賴**:
  - cors 2.8.5 (跨域支持)
  - dotenv 16.3.1 (環境變數)
  - express-rate-limit 7.1.5 (API 限流)
  - morgan 1.10.0 (日誌)

### 前端
- **框架**: React 18.3.1
- **構建工具**: Vite 5.4.21
- **UI 庫**: 
  - TailwindCSS 3.4.17 (樣式)
  - lucide-react 0.460.0 (圖標)
- **開發工具**: 
  - @vitejs/plugin-react 4.3.4
  - ESLint 9.17.0

### 部署工具
- **進程管理**: PM2
- **反向代理**: Cloudflare Tunnel
- **域名**: mon1.win (HTTPS)

---

## 項目結構

### 本地開發環境
```
D:\OneDrive - VW\CascadeProjects\MT5_Monitor\
├── backend/                    # 後端代碼
│   ├── src/
│   │   ├── app.js             # 主應用入口
│   │   ├── database/
│   │   │   ├── db.js          # 數據庫操作
│   │   │   └── schema.sql     # 數據庫結構
│   │   ├── routes/
│   │   │   └── api.js         # API 路由
│   │   ├── services/
│   │   │   ├── heartbeat.js   # 心跳監控服務
│   │   │   ├── snapshot.js    # 快照服務
│   │   │   └── telegram.js    # Telegram 通知
│   │   └── middleware/
│   │       └── auth.js        # API 認證
│   ├── package.json
│   └── .env                   # 環境變數（本地）
│
├── frontend/                   # 前端代碼
│   ├── src/
│   │   ├── App.jsx            # 主應用
│   │   ├── components/
│   │   │   ├── Header.jsx
│   │   │   ├── NodeCard.jsx
│   │   │   ├── NodeTable.jsx
│   │   │   ├── HistoryView.jsx
│   │   │   ├── LoadingSpinner.jsx
│   │   │   └── ErrorAlert.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── public/
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
│
└── mql/                        # MT4/MT5 EA 代碼
    ├── A計算盈虧_r9a_webmonitor.mq4
    └── A計算盈虧_r9a_webmonitor.mq5
```

### VPS 生產環境
```
C:\MT5_Monitor\
├── mt5-monitor/
│   ├── backend/               # 後端（同上結構）
│   │   └── ecosystem.config.js  # PM2 配置（生產環境變數）
│   └── frontend/
│       └── dist/              # 構建後的靜態文件
│
└── data/
    └── monitor.db             # SQLite 數據庫文件
```

---

## 環境配置

### 後端環境變數

#### 本地開發 (.env)
```env
PORT=3000
API_KEY=your_secret_key
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
HEARTBEAT_TIMEOUT_SECONDS=60
NOTIFY_ON_RECOVERY=true
NOTIFY_OFFLINE=true
ENABLE_AUTH=true
TRADING_HOURS_ENABLED=true
TRADING_TIMEZONE=Europe/London
```

#### VPS 生產 (ecosystem.config.js)
```javascript
module.exports = {
  apps: [{
    name: 'mt5-monitor-backend',
    script: 'src/app.js',
    cwd: 'C:/MT5_Monitor/mt5-monitor/backend',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: '8080',
      DATABASE_PATH: 'C:/MT5_Monitor/data/monitor.db',
      API_KEY: 'secret_key_2025_9093942525abcdxyz_',
      TELEGRAM_BOT_TOKEN: '6492162382:AAEKsQWDUXc7cJw0pS1z_lqsHZ6HIFLpjpw',
      TELEGRAM_CHAT_ID: '1942176657',
      HEARTBEAT_TIMEOUT_SECONDS: '60',
      NOTIFY_ON_RECOVERY: 'true',
      NOTIFY_OFFLINE: 'true',
      ENABLE_AUTH: 'true',
      TRADING_HOURS_ENABLED: 'true',
      TRADING_TIMEZONE: 'Europe/London'
    }
  }]
}
```

### 前端環境變數 (.env)
```env
VITE_API_BASE=/api
```

---

## VPS 部署步驟

### 前置要求
- Windows Server 2019+
- Node.js 18+ 已安裝
- PM2 已全局安裝 (`npm install -g pm2`)
- Git 已安裝（可選）

### 步驟 1：創建目錄結構
```powershell
# 創建主目錄
New-Item -ItemType Directory -Path "C:\MT5_Monitor" -Force
New-Item -ItemType Directory -Path "C:\MT5_Monitor\data" -Force
New-Item -ItemType Directory -Path "C:\MT5_Monitor\mt5-monitor" -Force
```

### 步驟 2：部署後端

#### 2.1 複製後端代碼
```powershell
# 從本地複製整個 backend 文件夾到 VPS
# 本地路徑: D:\OneDrive - VW\CascadeProjects\MT5_Monitor\backend
# VPS 路徑: C:\MT5_Monitor\mt5-monitor\backend
```

#### 2.2 安裝依賴
```powershell
cd C:\MT5_Monitor\mt5-monitor\backend
npm install
```

#### 2.3 創建 ecosystem.config.js
```powershell
# 在 C:\MT5_Monitor\mt5-monitor\backend\ 創建 ecosystem.config.js
# 內容參考上面的配置
```

#### 2.4 初始化數據庫
```powershell
# 數據庫會在首次啟動時自動創建
# 位置: C:\MT5_Monitor\data\monitor.db
```

#### 2.5 啟動後端服務
```powershell
cd C:\MT5_Monitor\mt5-monitor\backend
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

#### 2.6 驗證後端運行
```powershell
pm2 status
pm2 logs mt5-monitor-backend --lines 20

# 測試 API
Invoke-WebRequest -Uri "http://localhost:8080/api/nodes"
```

### 步驟 3：部署前端

#### 3.1 本地構建
```powershell
# 在本地開發機器上
cd D:\OneDrive - VW\CascadeProjects\MT5_Monitor\frontend
npm install
npm run build
```

#### 3.2 複製構建文件
```powershell
# 複製 dist 文件夾到 VPS
# 本地: D:\OneDrive - VW\CascadeProjects\MT5_Monitor\frontend\dist
# VPS: C:\MT5_Monitor\mt5-monitor\frontend\dist
```

#### 3.3 配置靜態文件服務
後端已配置為服務靜態文件：
```javascript
// backend/src/app.js
app.use(express.static(path.join(__dirname, '../../frontend/dist')));
```

### 步驟 4：配置 Cloudflare Tunnel

#### 4.1 安裝 Cloudflare Tunnel
```powershell
# 下載並安裝 cloudflared
# https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
```

#### 4.2 創建 Tunnel
```powershell
cloudflared tunnel login
cloudflared tunnel create mt5-monitor
```

#### 4.3 配置 Tunnel
創建 `config.yml`:
```yaml
tunnel: <tunnel-id>
credentials-file: C:\Users\Administrator\.cloudflared\<tunnel-id>.json

ingress:
  - hostname: mon1.win
    service: http://localhost:8080
  - service: http_status:404
```

#### 4.4 配置 DNS
在 Cloudflare DNS 添加 CNAME 記錄：
```
類型: CNAME
名稱: mon1
目標: <tunnel-id>.cfargotunnel.com
代理狀態: 已代理（橙色雲）
```

#### 4.5 啟動 Tunnel
```powershell
cloudflared tunnel run mt5-monitor
```

### 步驟 5：驗證部署

#### 5.1 檢查後端
```powershell
pm2 status
pm2 logs mt5-monitor-backend
```

#### 5.2 檢查前端
訪問 `https://mon1.win/`

#### 5.3 測試功能
1. 查看即時監控頁面
2. 查看歷史數據頁面
3. 測試 MT5 EA 連接

---

## API 文檔

### 認證
所有 POST 請求需要在 Header 中包含：
```
X-API-Key: <your_api_key>
```

### 端點列表

#### 1. 獲取所有節點
```http
GET /api/nodes
```
**響應**:
```json
{
  "ok": true,
  "nodes": [...],
  "summary": {
    "total": 6,
    "online": 4,
    "offline": 2,
    "totalABProfit": 123.45,
    "totalALots": 10.5,
    "totalBLots": 10.2,
    "totalAInterest": 5.67
  },
  "serverTime": "2025-11-23T02:52:00.000Z"
}
```

#### 2. 發送心跳
```http
POST /api/heartbeat
Headers: X-API-Key: <key>
Body: {
  "id": "node_001",
  "name": "Trading Node 1",
  "broker": "IC Markets",
  "account": "12345678",
  "meta": {...}
}
```

#### 3. 上報統計數據
```http
POST /api/stats
Headers: X-API-Key: <key>
Body: {
  "node_id": "node_001",
  "ab_profit_total": 123.45,
  "a_lots_total": 10.5,
  "b_lots_total": 10.2,
  ...
}
```

#### 4. 獲取歷史快照
```http
GET /api/history
```

#### 5. 獲取日期範圍快照
```http
GET /api/history/range?startDate=2025-11-01&endDate=2025-11-23
```

#### 6. 手動創建快照
```http
POST /api/history/snapshot
Body: {
  "date": "2025-11-23"
}
```

---

## 數據庫架構

### 表結構

#### nodes - 節點信息
```sql
CREATE TABLE nodes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    broker TEXT,
    account TEXT,
    status TEXT DEFAULT 'offline',
    last_heartbeat DATETIME,
    meta TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### ab_stats - AB 統計數據
```sql
CREATE TABLE ab_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id TEXT NOT NULL,
    date DATE NOT NULL,
    ab_profit_total REAL DEFAULT 0,
    a_lots_total REAL DEFAULT 0,
    b_lots_total REAL DEFAULT 0,
    lots_diff REAL DEFAULT 0,
    a_profit_total REAL DEFAULT 0,
    b_profit_total REAL DEFAULT 0,
    a_interest_total REAL DEFAULT 0,
    cost_per_lot REAL DEFAULT 0,
    reported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(node_id, date)
);
```

#### daily_snapshots - 每日快照
```sql
CREATE TABLE daily_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_date DATE NOT NULL UNIQUE,
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
```

---

## 維護指南

### 日常維護

#### 查看日誌
```powershell
pm2 logs mt5-monitor-backend --lines 50
```

#### 重啟服務
```powershell
pm2 restart mt5-monitor-backend
```

#### 更新代碼
```powershell
# 1. 停止服務
pm2 stop mt5-monitor-backend

# 2. 備份數據庫
Copy-Item "C:\MT5_Monitor\data\monitor.db" "C:\MT5_Monitor\data\monitor.db.backup"

# 3. 更新代碼文件

# 4. 重啟服務
pm2 restart mt5-monitor-backend
```

### 數據庫維護

#### 備份數據庫
```powershell
$date = Get-Date -Format "yyyyMMdd_HHmmss"
Copy-Item "C:\MT5_Monitor\data\monitor.db" "C:\MT5_Monitor\data\backup\monitor_$date.db"
```

#### 清理舊數據
```sql
-- 刪除 90 天前的審計日誌
DELETE FROM audit_log WHERE at < datetime('now', '-90 days');

-- 刪除 180 天前的狀態轉換記錄
DELETE FROM state_transitions WHERE at < datetime('now', '-180 days');
```

### 故障排除

#### 後端無法啟動
```powershell
# 檢查端口占用
netstat -ano | findstr :8080

# 查看錯誤日誌
pm2 logs mt5-monitor-backend --err --lines 50

# 檢查數據庫文件權限
icacls "C:\MT5_Monitor\data\monitor.db"
```

#### 前端無法訪問
```powershell
# 檢查靜態文件是否存在
Test-Path "C:\MT5_Monitor\mt5-monitor\frontend\dist\index.html"

# 檢查 Cloudflare Tunnel 狀態
cloudflared tunnel info mt5-monitor
```

#### Telegram 通知失敗
```powershell
# 測試 Bot Token
$token = "your_bot_token"
Invoke-WebRequest -Uri "https://api.telegram.org/bot$token/getMe"

# 測試發送消息
$chatId = "your_chat_id"
$text = "測試消息"
Invoke-WebRequest -Uri "https://api.telegram.org/bot$token/sendMessage" `
  -Method POST -ContentType "application/json" `
  -Body (@{chat_id=$chatId; text=$text} | ConvertTo-Json)
```

---

## 更新歷史

### v1.2.0 (2025-11-23)
- ✅ 添加歷史數據快照功能
- ✅ 每日倫敦時間 00:30 自動快照
- ✅ 歷史頁面支持日期範圍篩選
- ✅ 完整的 AB 統計字段

### v1.1.0 (2025-11-22)
- ✅ 交易時段控制（倫敦時間）
- ✅ Telegram 通知優化
- ✅ Cloudflare Tunnel 部署

### v1.0.0 (2025-11-20)
- ✅ 基礎監控功能
- ✅ 實時節點狀態
- ✅ AB 統計追蹤

---

## 聯絡資訊

**項目維護**: VW  
**部署環境**: Windows Server VPS  
**域名**: https://mon1.win/  
**最後更新**: 2025-11-23
