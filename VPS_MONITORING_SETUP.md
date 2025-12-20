# VPS 效能監測系統 - 部署指南

## 系統概述

VPS 效能監測系統用於監測多台 Windows Server 2019 VPS 的 CPU 和 I/O 效能，檢測是否因超賣而導致效能下降。

### 架構

```
被監察 VPS (10-30台)
├─ PowerShell 監測腳本（每 5 分鐘執行）
├─ 收集效能指標
└─ HTTP POST 到主控 VPS

主控 VPS
├─ Node.js 後端（接收數據、檢查閾值、發送告警）
├─ SQLite 資料庫（存儲歷史數據）
└─ Web 前端（僅管理員可查看）
```

### 監測指標

| 指標 | 說明 | 警告閾值 | 嚴重閾值 |
|------|------|----------|----------|
| CPU 隊列長度 | 處理器隊列長度，超過表示 CPU 超賣 | 2.0 | 5.0 |
| CPU 使用率 | CPU 使用百分比 | 80% | 95% |
| 磁碟隊列長度 | 磁碟隊列長度，超過表示 I/O 瓶頸 | 2.0 | 5.0 |
| 磁碟讀取延遲 | 讀取延遲（毫秒） | 50ms | 100ms |
| 磁碟寫入延遲 | 寫入延遲（毫秒） | 50ms | 100ms |
| 記憶體使用率 | 記憶體使用百分比 | 85% | 95% |

---

## 一、主控 VPS 部署

### 1.1 前置條件

主控 VPS 已部署 MT5 Monitor 系統。

### 1.2 更新代碼

```bash
# 在本地開發環境
cd D:\OneDrive - VW\CascadeProjects\MT5_Monitor

# 確認所有更改已提交
git status
git add .
git commit -m "feat: Add VPS performance monitoring system"
git push origin main
```

### 1.3 部署到主控 VPS

1. **連接到主控 VPS**（使用 Remote Desktop）

2. **更新代碼**
   ```powershell
   cd C:\MT5_Monitor\mt5-monitor
   git pull origin main
   ```

3. **安裝依賴**（如有新增）
   ```powershell
   cd backend
   npm install
   ```

4. **重建前端**
   ```powershell
   cd ..\frontend
   npm run build
   ```

5. **重啟後端服務**
   ```powershell
   npx pm2 restart mt5-monitor-backend
   ```

6. **驗證部署**
   - 訪問 `http://主控VPS:8080`
   - 以管理員（用戶 A）登入
   - 檢查是否出現「VPS效能」按鈕

---

## 二、被監察 VPS 部署

### 2.1 下載監測腳本

將 `vps-monitor-agent.ps1` 複製到被監察 VPS 的任意目錄，建議：
```
C:\VPS_Monitor\vps-monitor-agent.ps1
```

### 2.2 配置腳本

編輯 `vps-monitor-agent.ps1`，修改以下配置：

```powershell
# 主控 VPS 的 API 端點（修改為實際 IP 或域名）
$API_ENDPOINT = "http://YOUR_MASTER_VPS_IP:8080/api/vps/metrics"

# API 認證金鑰（與主控 VPS 的 API_KEY 相同）
$API_KEY = "secret_key_2025_9093942525abcdxyz_"

# VPS 識別名稱（建議使用有意義的名稱）
$VPS_NAME = "VPS-MT5-01"  # 或使用 $env:COMPUTERNAME

# VPS IP 地址（可選）
$VPS_IP = "192.168.1.100"

# VPS 描述（可選）
$VPS_DESCRIPTION = "MT5 交易伺服器 - 倫敦"
```

**重要配置說明：**
- `API_ENDPOINT`：必須修改為主控 VPS 的實際 IP 地址或域名
- `API_KEY`：必須與主控 VPS 的 `API_KEY` 環境變數一致
- `VPS_NAME`：建議使用有意義的名稱，方便識別（如 VPS-MT5-01, VPS-MT5-02）

### 2.3 測試腳本

在 PowerShell 中手動執行測試：

```powershell
cd C:\VPS_Monitor
.\vps-monitor-agent.ps1
```

**預期輸出：**
```
=== VPS Performance Monitor Agent ===
VPS Name: VPS-MT5-01
Collecting metrics...
  CPU Queue Length: 0.5
  CPU Usage: 45.23%
  Context Switches/sec: 12345
  Disk Queue Length: 0.2
  Disk Read Latency: 8.5ms
  Disk Write Latency: 10.2ms
  Memory Available: 4096MB
  Memory Usage: 62.5%

Sending data to master VPS...
✓ Data sent successfully!

=== Monitoring completed ===
```

### 2.4 設定 Task Scheduler（自動執行）

#### 方法 A：使用 PowerShell 命令創建（推薦）

```powershell
# 創建排程任務（每 5 分鐘執行一次）
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File C:\VPS_Monitor\vps-monitor-agent.ps1"
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration ([TimeSpan]::MaxValue)
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName "VPS_Performance_Monitor" -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "每 5 分鐘收集 VPS 效能指標並發送到主控 VPS"
```

#### 方法 B：使用 GUI 手動創建

1. 開啟 **Task Scheduler**（工作排程器）
2. 點擊右側「Create Task」（建立工作）
3. **General 標籤**：
   - Name: `VPS_Performance_Monitor`
   - Description: `每 5 分鐘收集 VPS 效能指標`
   - Security options: 選擇「Run whether user is logged on or not」
   - Run with highest privileges: ✓ 勾選
4. **Triggers 標籤**：
   - New → Begin the task: `On a schedule`
   - Settings: `Daily`, Start: 今天日期
   - Advanced settings: 
     - ✓ Repeat task every: `5 minutes`
     - for a duration of: `Indefinitely`
     - ✓ Enabled
5. **Actions 標籤**：
   - New → Action: `Start a program`
   - Program/script: `PowerShell.exe`
   - Add arguments: `-NoProfile -ExecutionPolicy Bypass -File C:\VPS_Monitor\vps-monitor-agent.ps1`
6. **Conditions 標籤**：
   - 取消勾選「Start the task only if the computer is on AC power」
7. **Settings 標籤**：
   - ✓ Allow task to be run on demand
   - ✓ Run task as soon as possible after a scheduled start is missed
   - If the task fails, restart every: `1 minute`, Attempt to restart up to: `3 times`
8. 點擊「OK」儲存

#### 驗證排程任務

```powershell
# 查看任務
Get-ScheduledTask -TaskName "VPS_Performance_Monitor"

# 手動執行測試
Start-ScheduledTask -TaskName "VPS_Performance_Monitor"

# 查看執行歷史
Get-ScheduledTaskInfo -TaskName "VPS_Performance_Monitor"
```

---

## 三、監控和管理

### 3.1 查看 VPS 效能

1. 訪問主控 VPS 的 Web 界面
2. 以管理員（用戶 A）登入
3. 點擊「VPS效能」按鈕
4. 查看所有 VPS 的即時狀態

### 3.2 狀態說明

| 狀態 | 圖標 | 說明 |
|------|------|------|
| 正常 | 🟢 | 所有指標正常 |
| 警告 | 🟡 | 有指標達到警告閾值 |
| 嚴重 | 🔴 | 有指標達到嚴重閾值 |
| 離線 | ⚫ | 超過 10 分鐘未更新 |

### 3.3 Telegram 告警

當 VPS 效能指標超過閾值時，系統會自動發送 Telegram 通知：

```
🔴 VPS 效能告警

VPS: VPS-MT5-01
指標: CPU 隊列長度
當前值: 5.2
閾值: 2.0 (嚴重)
時間: 2025-12-20 13:05

建議檢查該 VPS 是否受超賣影響。
```

**告警抑制：**
- 同一 VPS 同一指標，15 分鐘內只發送一次告警
- 避免告警轟炸

### 3.4 調整告警閾值

如需調整告警閾值，可直接修改資料庫：

```sql
-- 連接到主控 VPS 的資料庫
sqlite3 C:\MT5_Monitor\data\monitor.db

-- 查看當前閾值
SELECT * FROM vps_alert_thresholds;

-- 修改閾值（例如：調整 CPU 隊列長度）
UPDATE vps_alert_thresholds 
SET warning_threshold = 3.0, critical_threshold = 6.0 
WHERE metric_name = 'cpu_queue_length';
```

---

## 四、故障排除

### 4.1 被監察 VPS 無法發送數據

**檢查清單：**

1. **網路連通性**
   ```powershell
   Test-NetConnection -ComputerName 主控VPS_IP -Port 8080
   ```

2. **API_KEY 是否正確**
   - 確認腳本中的 `API_KEY` 與主控 VPS 的 `API_KEY` 環境變數一致

3. **防火牆規則**
   - 確認主控 VPS 的防火牆允許 8080 端口入站連接

4. **查看腳本執行日誌**
   ```powershell
   # 手動執行查看錯誤
   .\vps-monitor-agent.ps1
   ```

5. **查看 Task Scheduler 日誌**
   - Event Viewer → Windows Logs → Application
   - 搜尋「VPS_Performance_Monitor」

### 4.2 主控 VPS 未收到數據

1. **檢查後端日誌**
   ```powershell
   npx pm2 logs mt5-monitor-backend
   ```

2. **檢查資料庫**
   ```sql
   sqlite3 C:\MT5_Monitor\data\monitor.db
   SELECT * FROM vps_config ORDER BY last_seen DESC;
   SELECT * FROM vps_metrics ORDER BY timestamp DESC LIMIT 10;
   ```

3. **測試 API 端點**
   ```powershell
   $headers = @{
       "Content-Type" = "application/json"
       "X-API-Key" = "secret_key_2025_9093942525abcdxyz_"
   }
   $body = @{
       vps_name = "TEST"
       cpu_queue_length = 1.0
       cpu_usage_percent = 50.0
   } | ConvertTo-Json
   
   Invoke-RestMethod -Uri "http://localhost:8080/api/vps/metrics" -Method POST -Headers $headers -Body $body
   ```

### 4.3 前端無法查看 VPS 效能

1. **確認登入用戶**
   - 只有管理員（用戶 A）可以查看 VPS 效能
   - 其他用戶不會看到「VPS效能」按鈕

2. **清除瀏覽器緩存**
   - 按 Ctrl+Shift+R 強制刷新

3. **檢查前端是否已重建**
   ```powershell
   cd C:\MT5_Monitor\mt5-monitor\frontend
   npm run build
   ```

---

## 五、效能影響評估

### 5.1 被監察端

- **CPU 使用**：< 1%（每次執行 < 2 秒）
- **記憶體**：< 10MB
- **網路流量**：每次約 500 bytes
- **磁碟 I/O**：極小（僅讀取效能計數器）

### 5.2 主控端（30 台 VPS）

- **每 5 分鐘接收**：30 個請求
- **資料庫寫入**：每小時 360 筆
- **額外記憶體**：< 50MB
- **磁碟空間**：每月約 100MB

### 5.3 資料保留策略

- **詳細數據**：保留 7 天（自動清理）
- **告警歷史**：保留 30 天（自動清理）

---

## 六、安全建議

1. **API Key 保護**
   - 不要在公開場合分享 API_KEY
   - 定期更換 API_KEY

2. **網路隔離**
   - 建議使用內網 IP 或 VPN
   - 避免將監控端口暴露到公網

3. **權限控制**
   - VPS 效能頁面僅管理員可見
   - 定期審查用戶權限

4. **HTTPS**
   - 如需公網訪問，建議配置 HTTPS
   - 使用 nginx 反向代理

---

## 七、批量部署腳本

如需在多台 VPS 上快速部署，可使用以下批量部署腳本：

```powershell
# deploy-to-multiple-vps.ps1
# 批量部署監測腳本到多台 VPS

$vpsList = @(
    @{ IP = "192.168.1.101"; Name = "VPS-MT5-01"; Description = "倫敦伺服器" },
    @{ IP = "192.168.1.102"; Name = "VPS-MT5-02"; Description = "紐約伺服器" },
    @{ IP = "192.168.1.103"; Name = "VPS-MT5-03"; Description = "東京伺服器" }
)

$masterVPS = "192.168.1.100"  # 主控 VPS IP
$apiKey = "secret_key_2025_9093942525abcdxyz_"
$credential = Get-Credential  # VPS 登入憑證

foreach ($vps in $vpsList) {
    Write-Host "`n=== Deploying to $($vps.Name) ($($vps.IP)) ===" -ForegroundColor Cyan
    
    try {
        # 建立 PSSession
        $session = New-PSSession -ComputerName $vps.IP -Credential $credential
        
        # 複製腳本
        Copy-Item -Path ".\vps-monitor-agent.ps1" -Destination "C:\VPS_Monitor\" -ToSession $session -Force
        
        # 遠端配置和部署
        Invoke-Command -Session $session -ScriptBlock {
            param($masterVPS, $apiKey, $vpsName, $vpsIP, $vpsDesc)
            
            # 修改配置
            $scriptPath = "C:\VPS_Monitor\vps-monitor-agent.ps1"
            $content = Get-Content $scriptPath -Raw
            $content = $content -replace '\$API_ENDPOINT = ".*"', "`$API_ENDPOINT = ""http://${masterVPS}:8080/api/vps/metrics"""
            $content = $content -replace '\$API_KEY = ".*"', "`$API_KEY = ""$apiKey"""
            $content = $content -replace '\$VPS_NAME = .*', "`$VPS_NAME = ""$vpsName"""
            $content = $content -replace '\$VPS_IP = ".*"', "`$VPS_IP = ""$vpsIP"""
            $content = $content -replace '\$VPS_DESCRIPTION = ".*"', "`$VPS_DESCRIPTION = ""$vpsDesc"""
            Set-Content -Path $scriptPath -Value $content
            
            # 創建排程任務
            $action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File C:\VPS_Monitor\vps-monitor-agent.ps1"
            $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration ([TimeSpan]::MaxValue)
            $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
            $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
            
            Register-ScheduledTask -TaskName "VPS_Performance_Monitor" -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "VPS 效能監測" -Force
            
            # 測試執行
            Start-ScheduledTask -TaskName "VPS_Performance_Monitor"
            
        } -ArgumentList $masterVPS, $apiKey, $vps.Name, $vps.IP, $vps.Description
        
        Remove-PSSession $session
        Write-Host "✓ Deployed successfully!" -ForegroundColor Green
        
    } catch {
        Write-Host "✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n=== Deployment completed ===" -ForegroundColor Cyan
```

---

## 八、常見問題 FAQ

**Q: 可以監測 Linux VPS 嗎？**
A: 目前腳本僅支援 Windows Server。如需監測 Linux，需要另外編寫 bash 腳本。

**Q: 監測間隔可以改為 1 分鐘嗎？**
A: 可以，但不建議。過於頻繁的監測會增加網路流量和資料庫負擔。

**Q: 如何停止監測某台 VPS？**
A: 在該 VPS 上停用或刪除 Task Scheduler 中的排程任務即可。

**Q: 可以監測其他指標嗎？**
A: 可以。修改 PowerShell 腳本添加其他 Performance Counter，並相應修改後端 API 和資料庫結構。

**Q: 告警通知太頻繁怎麼辦？**
A: 調整告警閾值或增加告警抑制時間（修改後端代碼中的 `ALERT_SUPPRESSION_MINUTES`）。

---

## 九、聯絡支援

如有問題或建議，請聯絡系統管理員。

**版本**：v1.0.0  
**最後更新**：2025-12-20
