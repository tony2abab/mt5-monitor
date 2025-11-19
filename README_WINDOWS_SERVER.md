# Windows Server 2019 部署 - 快速開始

從本地測試環境遷移到 Windows Server 2019 生產環境。

## 📚 文檔索引

根據您的需求選擇合適的文檔：

### 🚀 快速部署（推薦新手）
**檔案**: `DEPLOYMENT_CHECKLIST.md`
- ✅ 5 分鐘快速檢查清單
- ✅ 必要檔案列表
- ✅ 快速部署步驟
- ✅ 常見問題解答

### 📖 完整部署指南（詳細步驟）
**檔案**: `WINDOWS_SERVER_DEPLOYMENT.md`
- ✅ 從零開始的完整教學
- ✅ 每個步驟的詳細說明
- ✅ 螢幕截圖和範例
- ✅ 故障排除指南
- ✅ 安全性和優化建議

### 📋 檔案傳輸清單
**檔案**: `FILES_TO_TRANSFER.txt`
- ✅ 需要傳輸的檔案清單
- ✅ 不需要傳輸的檔案
- ✅ 傳輸方法建議
- ✅ 傳輸後檢查步驟

---

## ⚡ 30 秒快速開始

### 步驟 1: 傳輸檔案
將整個 `MT5_Monitor` 資料夾複製到 Windows Server 的 `C:\MT5_Monitor`

### 步驟 2: 自動部署
在 Windows Server 上，以**管理員身份**執行：
```powershell
cd C:\MT5_Monitor
.\deploy-windows-server.ps1
```

### 步驟 3: 驗證部署
```powershell
.\verify-deployment.ps1
```

### 步驟 4: 訪問系統
- 前端: `http://localhost` 或 `http://伺服器IP`
- API: `http://localhost:8080/health`

**完成！** 🎉

---

## 🛠️ 可用腳本

專案包含以下實用腳本：

### 1. `deploy-windows-server.ps1`（自動部署）
全自動部署腳本，包含：
- Docker 環境檢查
- 檔案完整性驗證
- .env 配置檢查
- 端口衝突檢測
- 防火牆自動配置
- 容器構建和啟動
- 部署結果驗證

**使用方法**：
```powershell
# 以管理員身份執行
.\deploy-windows-server.ps1
```

### 2. `verify-deployment.ps1`（系統驗證）
8 項全面的系統檢查：
- Docker 服務狀態
- 容器運行狀態
- 後端健康檢查
- API 端點測試
- 前端頁面測試
- Nginx 代理測試
- 資料庫檢查
- 防火牆規則檢查

**使用方法**：
```powershell
.\verify-deployment.ps1
```

### 3. `test-api.ps1`（API 測試）
測試所有 API 端點功能

**使用方法**：
```powershell
.\test-api.ps1
```

---

## 📦 必要檔案清單

從本地測試環境需要傳輸的檔案：

### ✅ 核心檔案
```
MT5_Monitor/
├── backend/                  ← 整個資料夾
├── frontend/                 ← 整個資料夾
├── mql/                      ← 整個資料夾
├── docker-compose.yml        ← 已修正
├── .env                      ← 含您的設定
└── .dockerignore
```

### ✅ 部署腳本（新增）
```
├── deploy-windows-server.ps1
├── verify-deployment.ps1
└── test-api.ps1
```

### ✅ 文檔（新增）
```
├── WINDOWS_SERVER_DEPLOYMENT.md
├── DEPLOYMENT_CHECKLIST.md
├── FILES_TO_TRANSFER.txt
└── README_WINDOWS_SERVER.md
```

### ❌ 不需要傳輸
```
❌ node_modules/            (會自動安裝)
❌ data/                    (會自動創建)
❌ .git/                    (版本控制)
```

**詳細清單**: 參考 `FILES_TO_TRANSFER.txt`

---

## 🔧 系統需求

### Windows Server 2019
- CPU: 2 核心以上
- RAM: 4GB+ (推薦 8GB)
- 硬碟: 20GB+ 可用空間
- 網路: 固定 IP 或 DDNS

### 必要軟體
- Docker Desktop for Windows
- PowerShell 5.1+ (系統內建)

---

## 🌐 訪問地址

部署完成後，系統可通過以下地址訪問：

### 本地訪問
```
前端: http://localhost
API:  http://localhost:8080
```

### 局域網訪問
```
前端: http://伺服器IP
API:  http://伺服器IP:8080
```

### 獲取伺服器 IP
```powershell
ipconfig
# 或
Get-NetIPAddress -AddressFamily IPv4
```

---

## 🔌 MT4/MT5 EA 連接

### 1. 複製 EA 檔案
```
MT5: mql\MT5_Monitor_Client.mq5 → {MT5}\MQL5\Experts\
MT4: mql\MT5_Monitor_Client.mq4 → {MT4}\MQL4\Experts\
```

### 2. WebRequest 白名單
在 MT4/MT5 中添加：
```
http://伺服器IP:8080/api
```

### 3. EA 參數設定
```
API_BASE_URL = http://伺服器IP:8080/api
API_KEY = 您在.env中的API_KEY
NodeID = SERVER01_LIVE
EAName = 生產伺服器
```

**詳細步驟**: 參考 `WINDOWS_SERVER_DEPLOYMENT.md` 第六步

---

## 📊 管理命令

### 日常操作
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

### 診斷問題
```powershell
# 查看後端日誌
docker-compose logs backend --tail=100

# 查看前端日誌
docker-compose logs frontend --tail=100

# 檢查端口
netstat -ano | findstr :8080
```

### 更新系統
```powershell
# 停止服務
docker-compose down

# 重新構建
docker-compose build --no-cache

# 啟動服務
docker-compose up -d
```

---

## 💾 備份與還原

### 快速備份
```powershell
# 手動備份資料庫
$date = Get-Date -Format "yyyyMMdd_HHmmss"
docker cp mt5-monitor-backend:/app/data/monitor.db "C:\MT5_Monitor\backup\monitor_$date.db"
```

### 自動備份
參考 `WINDOWS_SERVER_DEPLOYMENT.md` 中的自動備份腳本設定

### 還原備份
```powershell
# 停止服務
docker-compose down

# 還原
Copy-Item "backup\monitor_YYYYMMDD_HHMMSS.db" "data\monitor.db"

# 啟動
docker-compose up -d
```

---

## 🚨 常見問題

### Q: 容器無法啟動？
**A**: 檢查端口佔用和日誌
```powershell
netstat -ano | findstr :8080
docker-compose logs backend
```

### Q: 無法從其他電腦訪問？
**A**: 檢查防火牆設定
```powershell
Get-NetFirewallRule -DisplayName "MT5 Monitor*"
```

### Q: EA 無法連接？
**A**: 檢查三件事：
1. WebRequest 白名單設定正確
2. API_KEY 與 .env 中一致
3. 網路連通性正常

### Q: 忘記 API_KEY？
**A**: 查看 .env 檔案
```powershell
notepad C:\MT5_Monitor\.env
```

**更多問題**: 參考各文檔的「故障排除」章節

---

## 🔒 安全建議

### 必做事項
- ✅ 修改 .env 中的 API_KEY 為強密碼
- ✅ 定期備份資料庫
- ✅ 配置防火牆限制訪問來源
- ✅ 定期更新系統和 Docker

### 選用強化
- 設定域名和 SSL 憑證
- 使用反向代理（Nginx）
- 啟用訪問日誌分析
- 設定入侵檢測

**詳細指南**: 參考 `WINDOWS_SERVER_DEPLOYMENT.md` 安全性章節

---

## 📞 獲取協助

### 自助診斷
1. 執行驗證腳本: `.\verify-deployment.ps1`
2. 檢查日誌: `docker-compose logs -f`
3. 測試 API: `.\test-api.ps1`
4. 查看健康狀態: `http://localhost:8080/health`

### 文檔資源
- 完整指南: `WINDOWS_SERVER_DEPLOYMENT.md`
- 快速清單: `DEPLOYMENT_CHECKLIST.md`
- 檔案清單: `FILES_TO_TRANSFER.txt`
- 原始 README: `README.md`

---

## ✅ 部署檢查清單

部署前：
- [ ] 已在本地測試成功
- [ ] 已準備所有必要檔案
- [ ] 已修改 .env 中的 API_KEY
- [ ] Windows Server 已安裝 Docker

部署中：
- [ ] 檔案已上傳到 C:\MT5_Monitor
- [ ] 已執行 deploy-windows-server.ps1
- [ ] 所有測試通過（綠色 ✓）

部署後：
- [ ] 前端頁面可訪問
- [ ] 後端 API 正常
- [ ] 防火牆已配置（如需外部訪問）
- [ ] EA 已成功連接
- [ ] 監控頁面顯示節點
- [ ] 已設定自動備份

---

## 🎯 下一步

部署完成後建議：

1. **配置自動備份**
   - 使用 Windows 工作排程器
   - 每日自動備份資料庫
   - 保留最近 7-30 天備份

2. **設定監控告警**
   - 配置 Telegram 通知
   - 設定健康檢查定時任務
   - 監控資源使用情況

3. **擴展部署**
   - 添加更多 EA 節點
   - 考慮設定域名
   - 配置 SSL 憑證（生產環境）

4. **定期維護**
   - 每週檢查日誌
   - 每月更新系統
   - 定期測試備份還原

---

## 📈 效能優化

### 資源限制
可在 `docker-compose.yml` 中調整：
```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 512M
```

### 監控資源
```powershell
docker stats mt5-monitor-backend mt5-monitor-frontend
```

**詳細優化**: 參考 `WINDOWS_SERVER_DEPLOYMENT.md` 效能優化章節

---

## 📝 版本資訊

**當前版本**: 1.0.0（生產就緒）

**重要更新**:
- ✅ 修正 Docker 構建問題（package-lock.json）
- ✅ 修正 nginx API 代理配置
- ✅ 修正後端路由問題
- ✅ 修正健康檢查 IPv6 問題
- ✅ 添加 trust proxy 支援
- ✅ 完整的 Windows Server 2019 支援

---

## 🎉 部署成功！

如果您已完成部署：

**恭喜！** 您的 MT5 Monitor 系統已在 Windows Server 2019 上成功運行。

訪問監控頁面開始使用：
```
http://伺服器IP
```

**祝您交易順利！** 📈🚀

---

**技術支援**: 參考各文檔的故障排除章節
**專案文檔**: 查看 `README.md` 了解系統架構
