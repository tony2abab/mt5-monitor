# Windows Server 2019 部署指南

完整的 MT5 Monitor 系統在 Windows Server 2019 上的部署步驟。

## 📋 前置準備

### 系統需求
- **作業系統**: Windows Server 2019
- **CPU**: 2 核心以上
- **記憶體**: 4GB 以上（推薦 8GB）
- **硬碟空間**: 至少 20GB 可用空間
- **網路**: 固定 IP 或 DDNS（如果需要外部訪問）

### 需要安裝的軟體
1. Docker Desktop for Windows
2. Git for Windows（選用）

---

## 📦 步驟一：安裝 Docker Desktop

### 1.1 下載 Docker Desktop

1. 訪問: https://www.docker.com/products/docker-desktop
2. 下載 **Docker Desktop for Windows**
3. 檔案大小約 500MB

### 1.2 安裝前準備

**啟用 Hyper-V 和容器功能**（以管理員身份執行 PowerShell）:

```powershell
# 啟用 Hyper-V
Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V -All

# 啟用容器功能
Enable-WindowsOptionalFeature -Online -FeatureName Containers -All

# 重新啟動伺服器
Restart-Computer
```

### 1.3 安裝 Docker Desktop

1. 執行下載的安裝檔 `Docker Desktop Installer.exe`
2. 安裝選項：
   - ✅ 勾選 "Use WSL 2 instead of Hyper-V" (如果可用)
   - ✅ 勾選 "Add shortcut to desktop"
3. 點擊 **Install**
4. 安裝完成後點擊 **Close and restart**

### 1.4 啟動並驗證 Docker

```powershell
# 檢查 Docker 版本
docker --version

# 檢查 Docker Compose
docker-compose --version

# 測試 Docker 運行
docker run hello-world
```

如果看到 "Hello from Docker!" 訊息，表示 Docker 安裝成功！

---

## 📂 步驟二：上傳專案檔案

### 2.1 準備檔案

在**本地電腦**（已測試成功的機器）上，準備以下檔案：

#### 必要檔案清單：
```
MT5_Monitor/
├── backend/               # 完整的 backend 資料夾
│   ├── src/              # 所有原始碼
│   ├── package.json
│   ├── package-lock.json
│   └── Dockerfile
├── frontend/              # 完整的 frontend 資料夾
│   ├── src/              # 所有原始碼
│   ├── package.json
│   ├── package-lock.json
│   ├── Dockerfile
│   ├── vite.config.js
│   ├── nginx.conf
│   └── index.html
├── mql/                   # MT4/MT5 EA 檔案
│   ├── MT5_Monitor_Client.mq5
│   └── MT5_Monitor_Client.mq4
├── docker-compose.yml     # Docker 編排檔案
├── .env                   # 環境變數設定（重要！）
└── .env.example           # 環境變數範本
```

### 2.2 上傳到 Windows Server

**方法 A：使用遠端桌面複製貼上**
1. 使用遠端桌面連線到 Windows Server
2. 在遠端桌面設定中啟用「本地資源」→「剪貼簿」和「磁碟機」
3. 直接複製整個資料夾到伺服器（例如：`C:\MT5_Monitor`）

**方法 B：使用網路共享**
1. 壓縮專案資料夾為 ZIP
2. 透過網路共享或 USB 傳送到伺服器
3. 在伺服器上解壓縮

**方法 C：使用 Git（如果有私有儲存庫）**
```powershell
cd C:\
git clone <your-repository-url> MT5_Monitor
```

**推薦位置**: `C:\MT5_Monitor`

---

## ⚙️ 步驟三：配置環境變數

### 3.1 編輯 .env 檔案

在 `C:\MT5_Monitor` 資料夾中，編輯 `.env` 檔案：

```powershell
# 用記事本開啟
notepad C:\MT5_Monitor\.env
```

### 3.2 重要設定項目

```env
# ========================================
# API 安全金鑰（必須修改！）
# ========================================
API_KEY=your_super_secret_key_change_this_in_production_2025

# ========================================
# Telegram 通知（選用）
# ========================================
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# ========================================
# 系統設定
# ========================================
PORT=8080
HEARTBEAT_TIMEOUT_SECONDS=300
NOTIFY_ON_RECOVERY=true
RATE_LIMIT_PER_MIN=60
CORS_ORIGIN=*
NODE_ENV=production
ENABLE_AUTH=true

# ========================================
# 資料庫路徑
# ========================================
DB_PATH=/app/data/monitor.db
```

**重要**：
- 🔐 **必須修改 `API_KEY`** 為強密碼（至少 20 字元）
- 📱 如果需要 Telegram 通知，填入 Bot Token 和 Chat ID
- 🔑 記住 `API_KEY`，稍後 MT4/MT5 EA 會使用

---

## 🚀 步驟四：啟動系統

### 4.1 開啟 PowerShell（管理員）

```powershell
# 切換到專案目錄
cd C:\MT5_Monitor

# 確認檔案都在
dir
```

### 4.2 首次啟動

```powershell
# 啟動所有服務（首次會自動建置映像，需要 5-10 分鐘）
docker-compose up -d
```

您會看到類似輸出：
```
[+] Building 300.5s (45/45) FINISHED
[+] Running 3/3
 ✔ Network mt5_monitor_mt5-network  Created
 ✔ Container mt5-monitor-backend    Started
 ✔ Container mt5-monitor-frontend   Started
```

### 4.3 檢查服務狀態

```powershell
# 查看容器狀態
docker-compose ps
```

應該看到：
```
NAME                   STATUS              PORTS
mt5-monitor-backend    Up (healthy)        0.0.0.0:8080->8080/tcp
mt5-monitor-frontend   Up                  0.0.0.0:80->80/tcp
```

### 4.4 查看日誌

```powershell
# 查看所有服務日誌
docker-compose logs -f

# 只看後端日誌
docker-compose logs -f backend

# 只看前端日誌
docker-compose logs -f frontend

# 按 Ctrl+C 退出日誌檢視
```

---

## ✅ 步驟五：測試驗證

### 5.1 測試後端 API

**使用瀏覽器**:
```
http://localhost:8080/health
或
http://伺服器IP:8080/health
```

應該看到：
```json
{
  "ok": true,
  "status": "healthy",
  "timestamp": "2025-11-11T13:51:00.000Z"
}
```

**使用 PowerShell**:
```powershell
Invoke-WebRequest -Uri http://localhost:8080/health
```

### 5.2 測試前端介面

**使用瀏覽器**:
```
http://localhost
或
http://伺服器IP
```

應該看到深色主題的監控頁面，顯示「尚無節點資料」（正常，因為還沒有 EA 連接）

### 5.3 測試 API 端點

**使用內建測試腳本**:
```powershell
# 在專案目錄執行
.\test-api.ps1
```

或手動測試：
```powershell
# 測試獲取節點列表
Invoke-WebRequest -Uri http://localhost/api/nodes | ConvertFrom-Json
```

---

## 🔌 步驟六：配置防火牆（如需外部訪問）

### 6.1 開啟 Windows 防火牆端口

```powershell
# 開啟 HTTP (80)
New-NetFirewallRule -DisplayName "MT5 Monitor HTTP" -Direction Inbound -LocalPort 80 -Protocol TCP -Action Allow

# 開啟 API (8080)
New-NetFirewallRule -DisplayName "MT5 Monitor API" -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow
```

### 6.2 配置外部防火牆/路由器

如果需要從外網訪問：
1. 在路由器設定端口轉發：`外部端口 80 → 伺服器IP:80`
2. 在路由器設定端口轉發：`外部端口 8080 → 伺服器IP:8080`

---

## 📱 步驟七：連接 MT4/MT5 EA

### 7.1 複製 EA 檔案

從 `C:\MT5_Monitor\mql\` 複製對應檔案：

**MT5 用戶**:
- 複製 `MT5_Monitor_Client.mq5` 到 MT5 資料夾
- 路徑：`文件 → 打開數據文件夾 → MQL5\Experts\`

**MT4 用戶**:
- 複製 `MT5_Monitor_Client.mq4` 到 MT4 資料夾
- 路徑：`文件 → 打開數據文件夾 → MQL4\Experts\`

### 7.2 設定 WebRequest 白名單

在 MT4/MT5 中：
1. **工具** → **選項** → **專家顧問**
2. ✅ 勾選「允許 WebRequest 使用列出的 URL」
3. 添加 URL（根據實際情況選擇）：

**本地測試**:
```
http://localhost:8080/api
```

**同網段內訪問**:
```
http://伺服器內網IP:8080/api
例如: http://192.168.1.100:8080/api
```

**外網訪問**（如有配置）:
```
http://您的域名或外網IP:8080/api
```

### 7.3 編譯並運行 EA

1. 按 **F4** 開啟 MetaEditor
2. 打開 `MT5_Monitor_Client`
3. 按 **F7** 編譯
4. 拖動 EA 到任意圖表
5. 設定參數：

```
API_BASE_URL = http://伺服器IP:8080/api
API_KEY = 您在.env中設定的API_KEY
NodeID = SERVER01_LIVE
EAName = 伺服器主帳號
HeartbeatIntervalMinutes = 15
EnableDebugLog = true
```

6. ✅ 勾選「允許即時自動交易」
7. 點擊 **確定**

### 7.4 驗證連接

檢查 MT4/MT5 日誌（工具箱 → 專家）應該看到：
```
MT5 Monitor Client initialized
Node ID: SERVER01_LIVE
Heartbeat sent successfully at 2025-11-11 21:51:00
```

刷新監控頁面 `http://伺服器IP`，應該看到您的節點出現！

---

## 🔧 常用管理命令

### 啟動/停止服務

```powershell
# 切換到專案目錄
cd C:\MT5_Monitor

# 啟動服務
docker-compose up -d

# 停止服務
docker-compose down

# 重啟服務
docker-compose restart

# 重啟特定服務
docker-compose restart backend
docker-compose restart frontend
```

### 查看日誌

```powershell
# 即時查看所有日誌
docker-compose logs -f

# 查看最近 100 行日誌
docker-compose logs --tail=100 backend

# 查看特定時間的日誌
docker-compose logs --since 2025-11-11T20:00:00
```

### 更新系統

```powershell
# 停止服務
docker-compose down

# 重新建置（如果有程式碼更新）
docker-compose build --no-cache

# 啟動服務
docker-compose up -d
```

### 清理資源

```powershell
# 停止並移除容器
docker-compose down

# 清理未使用的映像
docker image prune -a

# 清理所有未使用資源
docker system prune -a
```

---

## 💾 備份與還原

### 備份資料庫

```powershell
# 備份 SQLite 資料庫
$date = Get-Date -Format "yyyyMMdd_HHmmss"
docker cp mt5-monitor-backend:/app/data/monitor.db "C:\MT5_Monitor\backup\monitor_$date.db"
```

### 自動備份腳本

創建 `C:\MT5_Monitor\backup.ps1`:

```powershell
# 自動備份腳本
$backupDir = "C:\MT5_Monitor\backup"
$date = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = "$backupDir\monitor_$date.db"

# 創建備份目錄
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir
}

# 備份資料庫
docker cp mt5-monitor-backend:/app/data/monitor.db $backupFile

# 只保留最近 7 天的備份
Get-ChildItem $backupDir -Filter "monitor_*.db" | 
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-7) } | 
    Remove-Item

Write-Host "備份完成: $backupFile"
```

**設定定時任務**（每天凌晨 2 點備份）:
1. 開啟「工作排程器」
2. 創建基本工作
3. 觸發程序：每天 2:00 AM
4. 動作：啟動程式 `powershell.exe`
5. 引數：`-File C:\MT5_Monitor\backup.ps1`

### 還原資料庫

```powershell
# 停止服務
docker-compose down

# 還原備份
Copy-Item "C:\MT5_Monitor\backup\monitor_20251111_020000.db" "C:\MT5_Monitor\data\monitor.db"

# 重新啟動
docker-compose up -d
```

---

## 🔒 安全性建議

### 1. 修改預設端口（選用）

編輯 `docker-compose.yml`:

```yaml
services:
  backend:
    ports:
      - "18080:8080"  # 改為其他端口
  
  frontend:
    ports:
      - "8888:80"     # 改為其他端口
```

### 2. 限制訪問來源

```powershell
# 只允許特定 IP 訪問
New-NetFirewallRule -DisplayName "MT5 Monitor - Restricted" `
    -Direction Inbound `
    -LocalPort 80,8080 `
    -Protocol TCP `
    -Action Allow `
    -RemoteAddress 192.168.1.0/24
```

### 3. 定期更新密碼

定期更改 `.env` 中的 `API_KEY`，並同步更新所有 EA 設定。

### 4. 啟用 HTTPS（進階）

使用 Nginx 反向代理 + Let's Encrypt SSL 憑證（需要域名）

---

## 🚨 故障排除

### 問題 1: 容器無法啟動

**檢查端口佔用**:
```powershell
netstat -ano | findstr :80
netstat -ano | findstr :8080
```

**解決方案**: 修改 `docker-compose.yml` 使用其他端口

### 問題 2: 無法訪問服務

**檢查防火牆**:
```powershell
Get-NetFirewallRule | Where-Object {$_.DisplayName -like "*MT5*"}
```

**檢查容器狀態**:
```powershell
docker-compose ps
docker-compose logs backend
```

### 問題 3: EA 無法連接

1. 檢查 WebRequest 白名單是否正確
2. 檢查 API_KEY 是否匹配
3. 檢查網路連通性：
   ```powershell
   Test-NetConnection -ComputerName 伺服器IP -Port 8080
   ```

### 問題 4: 資料庫錯誤

```powershell
# 重建資料庫
docker-compose down
Remove-Item C:\MT5_Monitor\data\monitor.db
docker-compose up -d
```

---

## 📊 效能優化

### 1. 調整 Docker 資源限制

編輯 `docker-compose.yml`:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          memory: 256M
```

### 2. 啟用自動重啟

確保 `docker-compose.yml` 中有：

```yaml
services:
  backend:
    restart: unless-stopped
  frontend:
    restart: unless-stopped
```

### 3. 監控資源使用

```powershell
# 即時監控
docker stats mt5-monitor-backend mt5-monitor-frontend
```

---

## ✅ 部署檢查清單

完成部署後，確認以下項目：

- [ ] Docker Desktop 已安裝並運行
- [ ] 專案檔案已上傳到 `C:\MT5_Monitor`
- [ ] `.env` 檔案已正確配置（尤其是 API_KEY）
- [ ] 容器狀態為 healthy: `docker-compose ps`
- [ ] 後端健康檢查通過: `http://localhost:8080/health`
- [ ] 前端頁面可訪問: `http://localhost`
- [ ] API 端點正常: `http://localhost/api/nodes`
- [ ] 防火牆規則已配置（如需外部訪問）
- [ ] MT4/MT5 EA 已複製並編譯
- [ ] EA 成功連接並發送心跳
- [ ] 監控頁面顯示節點資料
- [ ] 自動備份已設定
- [ ] 已記錄 API_KEY 和相關設定

---

## 📞 取得協助

如果遇到問題：

1. **檢查日誌**: `docker-compose logs -f`
2. **查看文檔**: 參考 `README.md` 和 `DEPLOYMENT.md`
3. **健康檢查**: `http://localhost:8080/health`
4. **測試 API**: 執行 `.\test-api.ps1`

---

## 🎉 部署完成！

恭喜！您已成功在 Windows Server 2019 上部署 MT5 Monitor 系統。

**下一步**：
- 配置更多 MT4/MT5 EA 節點
- 設定 Telegram 通知（如需要）
- 配置自動備份
- 考慮設定域名和 SSL（生產環境）

**祝您使用愉快！** 🚀
