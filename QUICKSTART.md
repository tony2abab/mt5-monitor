# 快速入門指南

5 分鐘內啟動並運行 MT5 Trading Monitor！

## 🚀 方式一：Docker（最簡單）

### 步驟 1: 安裝 Docker

**Windows**:
- 下載並安裝 [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop)
- 啟動 Docker Desktop

**macOS**:
- 下載並安裝 [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop)

**Linux (Ubuntu)**:
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

### 步驟 2: 配置環境變數

```bash
cd C:\Users\tt\CascadeProjects\MT5_Monitor
copy .env.example .env
notepad .env
```

**最小配置**（必須修改）:
```env
API_KEY=your_strong_secret_key_123456
```

**完整配置**（建議）:
```env
API_KEY=your_strong_secret_key_123456
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=123456789
```

### 步驟 3: 啟動服務

```bash
docker-compose up -d
```

### 步驟 4: 驗證運作

開啟瀏覽器訪問:
- **前端**: http://localhost
- **後端 API**: http://localhost:8080/health

看到健康狀態 `{"ok":true}` 表示成功！

---

## 💻 方式二：本地開發

### 步驟 1: 安裝 Node.js

下載並安裝 [Node.js 18+](https://nodejs.org/)

驗證安裝:
```bash
node --version
npm --version
```

### 步驟 2: 安裝依賴

```bash
cd C:\Users\tt\CascadeProjects\MT5_Monitor

# 後端
cd backend
npm install

# 前端（新終端）
cd frontend
npm install
```

### 步驟 3: 配置環境

```bash
# 根目錄
copy .env.example .env
notepad .env

# 編輯 API_KEY
```

### 步驟 4: 啟動開發伺服器

**終端 1 - 後端**:
```bash
cd backend
npm run dev
```

**終端 2 - 前端**:
```bash
cd frontend
npm run dev
```

### 步驟 5: 訪問應用

- **前端**: http://localhost:3000
- **後端**: http://localhost:8080

---

## 🤖 整合 MT4/MT5 EA

### 步驟 1: 複製 EA 檔案

**MT4**:
```
複製: mql/MT5_Monitor_Client.mq4
到: C:\Users\tt\AppData\Roaming\MetaQuotes\Terminal\<YOUR_ID>\MQL4\Experts\
```

**MT5**:
```
複製: mql/MT5_Monitor_Client.mq5
到: C:\Program Files\<MT5_PATH>\MQL5\Experts\
```

### 步驟 2: 設定 WebRequest 白名單

在 MT4/MT5 中:
1. 工具 → 選項 → 專家顧問
2. 勾選「允許 WebRequest 使用列出的 URL」
3. 新增: `http://localhost:8080/api`（或你的伺服器 IP）

### 步驟 3: 編譯 EA

1. 在 MetaEditor 中打開檔案
2. 點擊「編譯」按鈕（或按 F7）
3. 確認無錯誤

### 步驟 4: 附加 EA 到圖表

1. 在圖表上拖放 EA
2. 配置參數:
   ```
   API_BASE_URL: http://localhost:8080/api
   API_KEY: your_strong_secret_key_123456
   NodeID: MT5_NODE_01
   EAName: My Trading Bot
   ```
3. 勾選「允許即時自動交易」
4. 點擊「確定」

### 步驟 5: 驗證運作

檢查 MT4/MT5 專家日誌:
```
MT5 Monitor Client initialized
Node ID: MT5_NODE_01
Heartbeat sent successfully at 2025-01-01 12:34:56
```

前端應該會顯示新的節點！

---

## 🧪 測試 API

### 使用 PowerShell 測試

```powershell
.\test-api.ps1
```

### 使用 curl 測試

```bash
# 健康檢查
curl http://localhost:8080/health

# 發送心跳
curl -X POST http://localhost:8080/api/heartbeat ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer your_strong_secret_key_123456" ^
  -d "{\"id\":\"TEST_01\",\"name\":\"Test Node\",\"broker\":\"Test\",\"account\":\"12345\"}"

# 查看節點
curl http://localhost:8080/api/nodes
```

---

## 📱 設定 Telegram 通知（可選）

### 步驟 1: 建立 Telegram Bot

1. 在 Telegram 搜尋 `@BotFather`
2. 發送 `/newbot`
3. 跟隨指示設定 bot 名稱
4. 取得 Bot Token: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`

### 步驟 2: 取得 Chat ID

1. 搜尋並啟動你的 bot
2. 發送任意訊息給 bot
3. 訪問: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
4. 在回應中找到 `"chat":{"id":123456789}`

### 步驟 3: 更新環境變數

編輯 `.env`:
```env
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=123456789
NOTIFY_ON_RECOVERY=true
```

### 步驟 4: 重啟服務

**Docker**:
```bash
docker-compose restart backend
```

**本地開發**:
重新啟動後端 (Ctrl+C 然後 `npm run dev`)

### 步驟 5: 測試通知

等待一個節點 5 分鐘未發送心跳，你應該會收到離線通知！

---

## 🎯 常見問題

### Q: 前端顯示「無符合的節點」？

**A**: 這是正常的！你需要：
1. 確保後端正在運行
2. 附加 MT4/MT5 EA 並發送心跳
3. 或使用測試腳本手動發送心跳

### Q: MT4/MT5 顯示「WebRequest not allowed」？

**A**: 
1. 檢查是否已在選項中新增 URL 到白名單
2. 確認 URL 格式正確（包含 `http://` 和埠號）
3. 重啟 MT4/MT5

### Q: 節點顯示為離線？

**A**: 檢查：
1. EA 是否正在運行（圖表上有笑臉圖示）
2. 網路連線是否正常
3. API_KEY 是否正確
4. 查看 MT4/MT5 專家日誌的錯誤訊息

### Q: Docker 無法啟動？

**A**: 
1. 確認 Docker Desktop 正在運行
2. 檢查埠號 80 和 8080 是否被佔用
3. 查看日誌: `docker-compose logs`

### Q: 如何變更埠號？

**A**: 編輯 `docker-compose.yml`:
```yaml
services:
  backend:
    ports:
      - "8888:8080"  # 將 8888 改為你想要的埠號
  frontend:
    ports:
      - "8080:80"    # 將 8080 改為你想要的埠號
```

---

## 📚 下一步

現在你已經成功啟動系統！接下來可以：

1. ✅ 查看詳細文檔: [README.md](README.md)
2. ✅ 部署到生產環境: [DEPLOYMENT.md](DEPLOYMENT.md)
3. ✅ 自訂 EA 參數以符合你的需求
4. ✅ 設定 Telegram 通知
5. ✅ 建立多個節點監控

---

## 🆘 需要幫助？

- 查看完整文檔: [README.md](README.md)
- 故障排除: README.md 的「故障排除」章節
- 檢查日誌: `docker-compose logs` 或專家日誌

---

## 🎉 完成！

恭喜！你的 MT5 Trading Monitor 系統已經準備就緒。

記得：
- 定期備份資料庫（`data/monitor.db`）
- 使用強密碼作為 API_KEY
- 在生產環境啟用 HTTPS

享受監控你的交易！📊📈
