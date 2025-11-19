# MT5 Trading Monitor System

一個完整的中央網頁後台交易監控系統，用於監控最多 20 個 MT5/MT4 EA 節點的線上狀態與當日交易統計。

## 📋 目錄

- [功能特色](#功能特色)
- [技術架構](#技術架構)
- [快速開始](#快速開始)
- [配置說明](#配置說明)
- [API 文檔](#api-文檔)
- [MT4/MT5 整合](#mt4mt5-整合)
- [Telegram 通知](#telegram-通知)
- [測試示例](#測試示例)
- [故障排除](#故障排除)

## ✨ 功能特色

### 後端功能
- ✅ REST API 端點（心跳上報、統計上報、節點查詢）
- ✅ SQLite 資料庫儲存（可擴展至 PostgreSQL）
- ✅ API Key 驗證機制（可切換啟用/停用）
- ✅ 心跳離線判定（5 分鐘超時）
- ✅ Telegram 通知整合（節點上線/離線通知）
- ✅ 速率限制（預設 60 req/min）
- ✅ 審計日誌記錄
- ✅ CORS 支援

### 前端功能
- ✅ 現代科技感深色主題（霓虹線條、漸層效果）
- ✅ 響應式設計（手機/平板/桌機自適應）
- ✅ 節點卡片網格與表格視圖切換
- ✅ 自動刷新（每 10 秒輪詢）
- ✅ 篩選與排序功能
- ✅ 總覽統計（在線/離線計數、總盈虧、總手數）
- ✅ 離線節點紅色光暈提示

### MT4/MT5 客戶端
- ✅ 自動心跳上報（每 15 分鐘）
- ✅ 當日統計上報（可自訂時間點）
- ✅ HTTP 請求重試機制（指數退避）
- ✅ 完整的錯誤處理與日誌

## 🏗️ 技術架構

### 技術棧
- **後端**: Node.js v18+ + Express v4.18
- **資料庫**: SQLite 3（可擴展至 PostgreSQL）
- **前端**: React 18 + Vite + TailwindCSS 3
- **通知**: Telegram Bot API
- **部署**: Docker + Docker Compose

### 資料模型

#### nodes 表
```sql
- id (TEXT, PRIMARY KEY): 節點唯一識別
- name (TEXT): 節點名稱
- broker (TEXT): 經紀商
- account (TEXT): 帳號
- last_heartbeat (DATETIME): 最後心跳時間
- status (TEXT): 狀態 (online/offline)
- meta (TEXT): JSON 格式的元資料
- created_at, updated_at (DATETIME)
```

#### stats 表
```sql
- id (INTEGER, AUTO INCREMENT)
- node_id (TEXT, FK): 關聯節點 ID
- date (DATE): 統計日期
- profit_loss (REAL): 當日盈虧
- interest (REAL): 利息
- avg_lots_success (REAL): 勝率 (0-1)
- lots_traded (REAL): 交易手數
- ab_lots_diff (REAL): 多空手數差
- reported_at (DATETIME)
```

## 🚀 快速開始

### 方法一：使用 Docker（推薦）

1. **克隆專案並配置環境變數**
```bash
cd C:\Users\tt\CascadeProjects\MT5_Monitor
copy .env.example .env
```

2. **編輯 `.env` 檔案**
```env
API_KEY=your_secret_api_key_change_this
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
```

3. **啟動服務**
```bash
docker-compose up -d
```

4. **訪問應用**
- 前端監控頁面: http://localhost
- 後端 API: http://localhost:8080/api
- 健康檢查: http://localhost:8080/health

### 方法二：本地開發

1. **安裝後端依賴**
```bash
cd backend
npm install
```

2. **初始化資料庫**
```bash
npm run migrate
```

3. **啟動後端**
```bash
npm run dev
```

4. **安裝前端依賴（新終端）**
```bash
cd frontend
npm install
```

5. **啟動前端**
```bash
npm run dev
```

6. **訪問應用**
- 前端: http://localhost:3000
- 後端: http://localhost:8080

## ⚙️ 配置說明

### 環境變數

| 變數名稱 | 說明 | 預設值 | 必填 |
|---------|------|--------|------|
| `API_KEY` | API 驗證金鑰 | - | 是（若啟用驗證） |
| `PORT` | 後端服務埠號 | 8080 | 否 |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot Token | - | 否 |
| `TELEGRAM_CHAT_ID` | Telegram Chat ID | - | 否 |
| `NOTIFY_ON_RECOVERY` | 節點恢復時是否通知 | true | 否 |
| `HEARTBEAT_TIMEOUT_SECONDS` | 心跳超時秒數 | 300 | 否 |
| `RATE_LIMIT_PER_MIN` | 每分鐘請求限制 | 60 | 否 |
| `CORS_ORIGIN` | CORS 來源 | * | 否 |
| `ENABLE_AUTH` | 啟用 API 驗證 | true | 否 |

### MT4/MT5 客戶端配置

在 MT4/MT5 EA 中配置以下參數：

```mql
input string   API_BASE_URL = "http://your-server-ip:8080/api";
input string   API_KEY = "your_secret_api_key_change_this";
input string   NodeID = "MT5_NODE_01";  // 每個節點唯一
input string   EAName = "My Trading EA";
input int      HeartbeatIntervalMinutes = 15;
input int      StatsReportHour = 23;
input int      StatsReportMinute = 59;
```

## 📡 API 文檔

### 1. 心跳上報

**端點**: `POST /api/heartbeat`

**Headers**:
```
Content-Type: application/json
Authorization: Bearer <API_KEY>
```

**請求 Body**:
```json
{
  "id": "NODE_ID",
  "name": "EA-01",
  "broker": "ABC Markets",
  "account": "12345678",
  "meta": {
    "symbols": ["XAUUSD", "EURUSD"]
  }
}
```

**回應**:
```json
{
  "ok": true,
  "status": "online",
  "serverTime": "2025-01-01T12:34:56.789Z"
}
```

### 2. 統計上報

**端點**: `POST /api/stats`

**Headers**:
```
Content-Type: application/json
Authorization: Bearer <API_KEY>
```

**請求 Body**:
```json
{
  "id": "NODE_ID",
  "date": "2025-01-01",
  "profit_loss": 123.45,
  "interest": 3.21,
  "avg_lots_success": 0.72,
  "lots_traded": 12.5,
  "ab_lots_diff": -1.2
}
```

**回應**:
```json
{
  "ok": true,
  "serverTime": "2025-01-01T12:34:56.789Z"
}
```

### 3. 取得所有節點

**端點**: `GET /api/nodes`

**回應**:
```json
{
  "ok": true,
  "nodes": [
    {
      "id": "NODE_01",
      "name": "EA-01",
      "broker": "ABC Markets",
      "account": "12345678",
      "status": "online",
      "lastHeartbeatRelative": "2m ago",
      "todayStats": {
        "profit_loss": 123.45,
        "interest": 3.21,
        "avg_lots_success": 0.72,
        "lots_traded": 12.5,
        "ab_lots_diff": -1.2
      }
    }
  ],
  "summary": {
    "total": 5,
    "online": 4,
    "offline": 1,
    "totalProfitLoss": 567.89,
    "totalLotsTraded": 45.5
  },
  "serverTime": "2025-01-01T12:34:56.789Z"
}
```

### 4. 取得單一節點

**端點**: `GET /api/nodes/:id?days=7`

**回應**:
```json
{
  "ok": true,
  "node": {
    "id": "NODE_01",
    "name": "EA-01",
    "status": "online",
    ...
  },
  "recentStats": [
    {
      "date": "2025-01-01",
      "profit_loss": 123.45,
      ...
    }
  ]
}
```

## 🤖 MT4/MT5 整合

### 步驟 1: 複製 EA 檔案

將對應的檔案複製到 MT4/MT5 目錄：

**MT4**:
```
C:\Users\tt\CascadeProjects\MT5_Monitor\mql\MT5_Monitor_Client.mq4
↓
C:\Users\tt\AppData\Roaming\MetaQuotes\Terminal\<YOUR_TERMINAL>\MQL4\Experts\
```

**MT5**:
```
C:\Users\tt\CascadeProjects\MT5_Monitor\mql\MT5_Monitor_Client.mq5
↓
C:\Program Files\<YOUR_MT5>\MQL5\Experts\
```

### 步驟 2: 設定 WebRequest 白名單

在 MT4/MT5 中：
1. 工具 → 選項 → 專家顧問
2. 勾選「允許 WebRequest 使用列出的 URL」
3. 新增: `http://your-server-ip:8080/api`

### 步驟 3: 編譯與附加 EA

1. 在 MetaEditor 中打開檔案
2. 點擊「編譯」
3. 在圖表上附加 EA
4. 配置參數（API_BASE_URL、API_KEY、NodeID 等）
5. 啟用自動交易

### 步驟 4: 驗證運作

檢查 MT4/MT5 的「專家」日誌：
```
MT5 Monitor Client initialized
Node ID: MT5_NODE_01
Heartbeat sent successfully at 2025-01-01 12:34:56
```

## 📲 Telegram 通知

### 設定 Telegram Bot

1. **建立 Bot**
   - 在 Telegram 中搜尋 `@BotFather`
   - 發送 `/newbot` 並跟隨指示
   - 取得 Bot Token: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`

2. **取得 Chat ID**
   - 在 Telegram 中搜尋你的 Bot 並發送訊息
   - 訪問: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
   - 在回應中找到 `"chat":{"id":123456789}`

3. **配置環境變數**
```env
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=123456789
NOTIFY_ON_RECOVERY=true
```

### 通知格式

**節點離線**:
```
🔴 [MT5 監控] 節點離線

節點: EA-01 (ID: NODE01)
帳號: 12345678 / ABC Markets
最後心跳: 2025-01-01 12:34:56 UTC
時間: 2025-01-01 12:39:56 UTC

請檢查該節點狀態！
```

**節點恢復**:
```
🟢 [MT5 監控] 節點恢復上線

節點: EA-01 (ID: NODE01)
帳號: 12345678 / ABC Markets
恢復時間: 2025-01-01 12:45:00 UTC

節點已恢復正常運作。
```

## 🧪 測試示例

### 使用 curl 測試心跳

```bash
curl -X POST http://localhost:8080/api/heartbeat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_secret_api_key_change_this" \
  -d '{
    "id": "TEST_NODE_01",
    "name": "Test EA",
    "broker": "Test Broker",
    "account": "12345678"
  }'
```

**預期回應**:
```json
{
  "ok": true,
  "status": "online",
  "serverTime": "2025-01-01T12:34:56.789Z"
}
```

### 使用 curl 測試統計上報

```bash
curl -X POST http://localhost:8080/api/stats \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_secret_api_key_change_this" \
  -d '{
    "id": "TEST_NODE_01",
    "date": "2025-01-01",
    "profit_loss": 150.50,
    "interest": 2.30,
    "avg_lots_success": 0.65,
    "lots_traded": 10.0,
    "ab_lots_diff": 2.5
  }'
```

### 使用 PowerShell 測試（Windows）

```powershell
# 心跳測試
$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer your_secret_api_key_change_this"
}

$body = @{
    id = "TEST_NODE_01"
    name = "Test EA"
    broker = "Test Broker"
    account = "12345678"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8080/api/heartbeat" -Method POST -Headers $headers -Body $body
```

### 查看所有節點

```bash
curl http://localhost:8080/api/nodes
```

## 🔧 故障排除

### 問題 1: MT4/MT5 顯示 "WebRequest not allowed"

**解決方案**:
1. 確認已在 MT4/MT5 選項中新增 URL 到白名單
2. 重啟 MT4/MT5
3. 確認 URL 格式正確（包含 http:// 和埠號）

### 問題 2: 節點顯示為離線但 EA 正在運作

**可能原因**:
- 心跳請求失敗（檢查網路連線）
- API Key 不正確
- 伺服器端 HEARTBEAT_TIMEOUT_SECONDS 設定過短

**解決方案**:
1. 檢查 MT4/MT5 專家日誌
2. 驗證 API_KEY 設定
3. 測試網路連線

### 問題 3: Telegram 通知未收到

**檢查清單**:
- [ ] TELEGRAM_BOT_TOKEN 正確
- [ ] TELEGRAM_CHAT_ID 正確
- [ ] Bot 已啟動（發送過訊息給 Bot）
- [ ] 檢查後端日誌是否有錯誤

### 問題 4: 前端無法載入資料

**解決方案**:
1. 檢查後端是否運行：訪問 http://localhost:8080/health
2. 檢查瀏覽器控制台是否有 CORS 錯誤
3. 確認 VITE_API_BASE 環境變數正確

### 問題 5: Docker 容器無法啟動

**解決方案**:
```bash
# 查看日誌
docker-compose logs backend
docker-compose logs frontend

# 重新建置
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## 📊 系統架構圖

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   MT4/MT5 EA    │         │   MT4/MT5 EA     │         │   MT4/MT5 EA    │
│    (Node 1)     │         │    (Node 2)      │   ...   │   (Node 20)     │
└────────┬────────┘         └────────┬─────────┘         └────────┬────────┘
         │                           │                            │
         │  HTTP POST /heartbeat     │                            │
         │  HTTP POST /stats         │                            │
         └───────────────────────────┴────────────────────────────┘
                                     │
                                     ▼
                         ┌───────────────────────┐
                         │   Backend API Server  │
                         │   (Node.js + Express) │
                         └───────────┬───────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
                    ▼                ▼                ▼
            ┌──────────┐    ┌──────────────┐  ┌──────────────┐
            │  SQLite  │    │  Heartbeat   │  │  Telegram    │
            │    DB    │    │   Monitor    │  │  Notifier    │
            └──────────┘    └──────────────┘  └──────────────┘
                                     │
                                     ▼
                         ┌───────────────────────┐
                         │   Frontend Dashboard  │
                         │  (React + TailwindCSS)│
                         └───────────────────────┘
                                     │
                                     ▼
                              ┌─────────────┐
                              │   Browser   │
                              │  (Desktop/  │
                              │   Mobile)   │
                              └─────────────┘
```

## 📝 授權

MIT License

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！

## 📞 支援

如有問題，請聯繫系統管理員或查看日誌檔案：
- 後端日誌: `docker-compose logs backend`
- 前端日誌: 瀏覽器開發者工具控制台
- MT4/MT5 日誌: 專家顧問日誌面板
