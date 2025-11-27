# 部署到 VPS 的腳本
# 使用方法：.\deploy-to-vps.ps1

param(
    [string]$VpsIp = "",  # VPS IP 地址
    [string]$VpsUser = "Administrator",  # VPS 用戶名
    [switch]$BackendOnly,  # 只部署後端
    [switch]$FrontendOnly  # 只部署前端
)

$ErrorActionPreference = "Stop"

Write-Host "=== MT5 Monitor 部署到 VPS ===" -ForegroundColor Cyan
Write-Host ""

# 檢查 VPS IP
if ([string]::IsNullOrEmpty($VpsIp)) {
    $VpsIp = Read-Host "請輸入 VPS IP 地址"
}

Write-Host "目標 VPS: $VpsIp" -ForegroundColor Yellow
Write-Host ""

# 本地路徑
$localBackend = "D:\OneDrive - VW\CascadeProjects\MT5_Monitor\backend"
$localFrontend = "D:\OneDrive - VW\CascadeProjects\MT5_Monitor\frontend"

# VPS 路徑（通過遠程桌面或網絡共享）
# 如果使用遠程桌面，需要先映射網絡驅動器
# 例如：net use Z: \\VPS_IP\C$ /user:Administrator password

Write-Host "部署選項：" -ForegroundColor Cyan
if (-not $BackendOnly -and -not $FrontendOnly) {
    Write-Host "  - 後端和前端都會部署" -ForegroundColor White
} elseif ($BackendOnly) {
    Write-Host "  - 只部署後端" -ForegroundColor White
} else {
    Write-Host "  - 只部署前端" -ForegroundColor White
}
Write-Host ""

# 創建部署包
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$deployDir = ".\deploy_packages\$timestamp"
New-Item -ItemType Directory -Path $deployDir -Force | Out-Null

Write-Host "創建部署包..." -ForegroundColor Green

# 後端文件
if (-not $FrontendOnly) {
    Write-Host "  打包後端文件..." -ForegroundColor Cyan
    
    $backendDeploy = Join-Path $deployDir "backend"
    New-Item -ItemType Directory -Path $backendDeploy -Force | Out-Null
    
    # 複製後端文件
    Copy-Item "$localBackend\src" -Destination $backendDeploy -Recurse -Force
    Copy-Item "$localBackend\package.json" -Destination $backendDeploy -Force
    Copy-Item "$localBackend\ecosystem.config.js" -Destination $backendDeploy -Force -ErrorAction SilentlyContinue
    
    Write-Host "    ✓ 後端文件已打包" -ForegroundColor Green
}

# 前端文件
if (-not $BackendOnly) {
    Write-Host "  打包前端文件..." -ForegroundColor Cyan
    
    # 檢查是否已編譯
    if (Test-Path "$localFrontend\dist") {
        $frontendDeploy = Join-Path $deployDir "frontend"
        New-Item -ItemType Directory -Path $frontendDeploy -Force | Out-Null
        
        Copy-Item "$localFrontend\dist" -Destination $frontendDeploy -Recurse -Force
        Write-Host "    ✓ 前端文件已打包" -ForegroundColor Green
    } else {
        Write-Host "    ⚠ 前端未編譯，請先運行: cd frontend && npm run build" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "部署包已創建: $deployDir" -ForegroundColor Green
Write-Host ""

# 創建部署說明
$readmePath = Join-Path $deployDir "部署說明.txt"
$readmeContent = @"
MT5 Monitor 部署包
創建時間: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

=== 部署步驟 ===

1. 將此文件夾複製到 VPS

2. 部署後端（如果包含）：
   - 停止服務: pm2 stop mt5-monitor-backend
   - 備份舊文件: 
     Copy-Item C:\MT5_Monitor\mt5-monitor\backend C:\MT5_Monitor\backup_$(Get-Date -Format "yyyyMMdd_HHmmss") -Recurse
   - 複製新文件:
     Copy-Item .\backend\* C:\MT5_Monitor\mt5-monitor\backend -Recurse -Force
   - 重啟服務: pm2 restart mt5-monitor-backend
   - 查看日誌: pm2 logs mt5-monitor-backend

3. 部署前端（如果包含）：
   - 備份舊文件:
     Copy-Item C:\MT5_Monitor\mt5-monitor\frontend\dist C:\MT5_Monitor\backup_frontend_$(Get-Date -Format "yyyyMMdd_HHmmss") -Recurse
   - 複製新文件:
     Copy-Item .\frontend\dist C:\MT5_Monitor\mt5-monitor\frontend\dist -Recurse -Force
   - 刷新瀏覽器測試

4. 驗證部署：
   - 後端: http://VPS_IP:8080/api/health
   - 前端: http://VPS_IP:8080

=== 本次修改內容 ===

- 修改收市時段從 23:55-01:30 改為 23:50-01:15
- 文件: backend/src/services/heartbeat.js

=== 回滾方法 ===

如果出現問題，從備份恢復：
Copy-Item C:\MT5_Monitor\backup_YYYYMMDD_HHMMSS\* C:\MT5_Monitor\mt5-monitor\backend -Recurse -Force
pm2 restart mt5-monitor-backend
"@

Set-Content -Path $readmePath -Value $readmeContent -Encoding UTF8

Write-Host "=== 下一步 ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "方法 1: 手動複製（推薦）" -ForegroundColor Yellow
Write-Host "  1. 使用遠程桌面連接到 VPS" -ForegroundColor White
Write-Host "  2. 將文件夾複製到 VPS: $deployDir" -ForegroundColor White
Write-Host "  3. 按照「部署說明.txt」中的步驟操作" -ForegroundColor White
Write-Host ""
Write-Host "方法 2: 使用網絡共享" -ForegroundColor Yellow
Write-Host "  1. 在 VPS 上啟用文件共享" -ForegroundColor White
Write-Host "  2. 映射網絡驅動器: net use Z: \\$VpsIp\C$ /user:$VpsUser" -ForegroundColor White
Write-Host "  3. 複製文件到 Z:\MT5_Monitor\mt5-monitor\" -ForegroundColor White
Write-Host ""
Write-Host "方法 3: 使用 SCP/SFTP 工具" -ForegroundColor Yellow
Write-Host "  1. 使用 WinSCP 或 FileZilla" -ForegroundColor White
Write-Host "  2. 連接到 VPS" -ForegroundColor White
Write-Host "  3. 上傳部署包" -ForegroundColor White
Write-Host ""

# 打開部署包文件夾
Start-Process explorer.exe -ArgumentList $deployDir

Write-Host "部署包文件夾已打開！" -ForegroundColor Green
