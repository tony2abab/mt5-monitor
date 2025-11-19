# Windows Server 2019 部署檢查清單

快速部署指南和檢查清單。

## 📦 需要準備的檔案

將以下整個資料夾從**本地測試機器**複製到 **Windows Server 2019**：

```
MT5_Monitor/
├── backend/               ← 整個資料夾
├── frontend/              ← 整個資料夾
├── mql/                   ← 整個資料夾
├── docker-compose.yml     ← 必需
├── .env                   ← 必需（含您的 API_KEY）
├── .dockerignore          ← 建議
└── deploy-windows-server.ps1  ← 自動部署腳本
```

**推薦上傳位置**：`C:\MT5_Monitor`

---

## 🚀 快速部署步驟（5 分鐘）

### 方法 A：使用自動部署腳本（推薦）

```powershell
# 1. 切換到專案目錄
cd C:\MT5_Monitor

# 2. 以管理員身份執行部署腳本
# （右鍵 PowerShell → 以系統管理員身分執行）
.\deploy-windows-server.ps1
```

腳本會自動：
- ✅ 檢查 Docker 安裝
- ✅ 檢查必要檔案
- ✅ 創建/檢查 .env 設定
- ✅ 檢查端口佔用
- ✅ 配置防火牆
- ✅ 構建並啟動容器
- ✅ 驗證部署結果

---

### 方法 B：手動部署

#### 步驟 1: 檢查 Docker
```powershell
docker --version
docker-compose --version
```

#### 步驟 2: 編輯 .env
```powershell
notepad C:\MT5_Monitor\.env
```
修改：
- `API_KEY` = 您的強密碼

#### 步驟 3: 啟動服務
```powershell
cd C:\MT5_Monitor
docker-compose up -d
```

#### 步驟 4: 驗證
```powershell
# 檢查容器狀態
docker-compose ps

# 測試 API
Invoke-WebRequest http://localhost:8080/health
```

---

## ✅ 部署後檢查清單

### 系統檢查

- [ ] Docker Desktop 已啟動
- [ ] 容器狀態顯示 "Up (healthy)"
  ```powershell
  docker-compose ps
  ```

### 網路訪問檢查

- [ ] 後端健康檢查正常
  ```
  http://localhost:8080/health
  ```
  
- [ ] 前端頁面可訪問
  ```
  http://localhost
  ```
  
- [ ] API 端點正常
  ```
  http://localhost/api/nodes
  ```

### 防火牆檢查（如需外部訪問）

- [ ] Windows 防火牆已開啟端口 80 和 8080
  ```powershell
  Get-NetFirewallRule -DisplayName "MT5 Monitor*"
  ```

---

## 🔌 MT4/MT5 EA 連接步驟

### 1. 複製 EA 檔案

**MT5**：
```
複製：C:\MT5_Monitor\mql\MT5_Monitor_Client.mq5
到：  {MT5目錄}\MQL5\Experts\
```

**MT4**：
```
複製：C:\MT5_Monitor\mql\MT5_Monitor_Client.mq4
到：  {MT4目錄}\MQL4\Experts\
```

### 2. 設定 WebRequest 白名單

在 MT4/MT5：
1. **工具** → **選項** → **專家顧問**
2. ✅ 勾選「允許 WebRequest」
3. 添加 URL：

**本機測試**：
```
http://localhost:8080/api
```

**局域網訪問**：
```
http://192.168.1.XXX:8080/api
```
（替換為伺服器實際 IP）

### 3. EA 參數設定

```
API_BASE_URL = http://伺服器IP:8080/api
API_KEY = 您在.env中設定的API_KEY
NodeID = SERVER01_LIVE
EAName = 伺服器主帳號
HeartbeatIntervalMinutes = 15
EnableDebugLog = true
```

### 4. 驗證連接

- [ ] MT4/MT5 日誌顯示「Heartbeat sent successfully」
- [ ] 監控頁面 `http://伺服器IP` 顯示節點

---

## 📊 獲取伺服器 IP 地址

```powershell
# 查看所有網路介面 IP
Get-NetIPAddress -AddressFamily IPv4 | 
    Where-Object {$_.IPAddress -ne '127.0.0.1'} | 
    Select-Object IPAddress, InterfaceAlias
```

---

## 🔧 常用管理命令

### 服務管理

```powershell
cd C:\MT5_Monitor

# 查看狀態
docker-compose ps

# 查看日誌
docker-compose logs -f

# 重啟服務
docker-compose restart

# 停止服務
docker-compose down

# 啟動服務
docker-compose up -d
```

### 問題診斷

```powershell
# 查看後端日誌
docker-compose logs backend --tail=100

# 查看前端日誌
docker-compose logs frontend --tail=100

# 檢查端口佔用
netstat -ano | findstr :8080
netstat -ano | findstr :80

# 測試連通性
Test-NetConnection -ComputerName localhost -Port 8080
```

---

## 💾 快速備份

```powershell
# 手動備份資料庫
$date = Get-Date -Format "yyyyMMdd_HHmmss"
docker cp mt5-monitor-backend:/app/data/monitor.db "C:\MT5_Monitor\backup\monitor_$date.db"
```

---

## 🚨 常見問題

### 問題：容器無法啟動

**檢查**：
```powershell
docker-compose logs backend
```

**常見原因**：
1. 端口被佔用 → 檢查 `netstat -ano | findstr :8080`
2. Docker 未啟動 → 啟動 Docker Desktop
3. .env 設定錯誤 → 檢查 .env 格式

### 問題：無法從其他電腦訪問

**檢查**：
1. Windows 防火牆是否開啟端口
2. 外部防火牆/路由器設定
3. 使用正確的 IP 地址（不是 localhost）

### 問題：EA 無法連接

**檢查**：
1. WebRequest 白名單是否正確
2. API_KEY 是否匹配
3. 網路連通性：`Test-NetConnection -ComputerName 伺服器IP -Port 8080`

---

## 📞 獲取協助

如果遇到問題：

1. 查看完整部署指南：`WINDOWS_SERVER_DEPLOYMENT.md`
2. 檢查日誌：`docker-compose logs -f`
3. 測試健康檢查：`http://localhost:8080/health`

---

## 🎯 部署完成後的下一步

- [ ] 設定自動備份（使用 Windows 工作排程器）
- [ ] 配置 Telegram 通知（編輯 .env 中的 TELEGRAM_* 參數）
- [ ] 添加更多 EA 節點
- [ ] 考慮設定域名和 SSL（生產環境）
- [ ] 設定監控告警

---

## ✅ 快速驗證命令

一鍵檢查所有服務：

```powershell
# 執行此命令檢查系統狀態
Write-Host "`n=== 系統狀態檢查 ===" -ForegroundColor Cyan
Write-Host "`n1. Docker 容器狀態:" -ForegroundColor Yellow
docker-compose ps

Write-Host "`n2. 後端健康檢查:" -ForegroundColor Yellow
try {
    $health = Invoke-WebRequest -Uri http://localhost:8080/health -UseBasicParsing | ConvertFrom-Json
    Write-Host "   狀態: $($health.status)" -ForegroundColor Green
} catch {
    Write-Host "   錯誤: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n3. 前端訪問測試:" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri http://localhost -UseBasicParsing
    Write-Host "   HTTP $($response.StatusCode) - 正常" -ForegroundColor Green
} catch {
    Write-Host "   錯誤: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n4. 伺服器 IP 地址:" -ForegroundColor Yellow
Get-NetIPAddress -AddressFamily IPv4 | 
    Where-Object {$_.IPAddress -ne '127.0.0.1' -and $_.PrefixOrigin -ne 'WellKnown'} | 
    ForEach-Object { Write-Host "   http://$($_.IPAddress)" -ForegroundColor Cyan }

Write-Host "`n===================`n" -ForegroundColor Cyan
```

---

**祝部署順利！** 🚀
