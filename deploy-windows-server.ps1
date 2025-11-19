# MT5 Monitor - Windows Server 2019 自動部署腳本
# 此腳本協助在 Windows Server 上快速部署 MT5 Monitor 系統

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  MT5 Monitor 自動部署腳本" -ForegroundColor Cyan
Write-Host "  Windows Server 2019" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 檢查是否以管理員權限運行
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "❌ 錯誤：請以管理員身份運行此腳本！" -ForegroundColor Red
    Write-Host "   右鍵點擊 PowerShell → 以系統管理員身分執行" -ForegroundColor Yellow
    pause
    exit 1
}

Write-Host "✓ 管理員權限檢查通過" -ForegroundColor Green
Write-Host ""

# 步驟 1: 檢查 Docker 是否已安裝
Write-Host "[1/7] 檢查 Docker 安裝..." -ForegroundColor Cyan

try {
    $dockerVersion = docker --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Docker 已安裝: $dockerVersion" -ForegroundColor Green
    } else {
        throw "Docker 未安裝"
    }
} catch {
    Write-Host "❌ Docker 未安裝或未啟動" -ForegroundColor Red
    Write-Host ""
    Write-Host "請先安裝 Docker Desktop for Windows:" -ForegroundColor Yellow
    Write-Host "1. 訪問: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    Write-Host "2. 下載並安裝 Docker Desktop" -ForegroundColor Yellow
    Write-Host "3. 重啟伺服器" -ForegroundColor Yellow
    Write-Host "4. 啟動 Docker Desktop" -ForegroundColor Yellow
    Write-Host "5. 再次運行此腳本" -ForegroundColor Yellow
    pause
    exit 1
}

# 檢查 Docker Compose
try {
    $composeVersion = docker-compose --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Docker Compose 已安裝: $composeVersion" -ForegroundColor Green
    } else {
        throw "Docker Compose 未安裝"
    }
} catch {
    Write-Host "❌ Docker Compose 未找到" -ForegroundColor Red
    pause
    exit 1
}

Write-Host ""

# 步驟 2: 確認專案路徑
Write-Host "[2/7] 確認專案路徑..." -ForegroundColor Cyan

$projectPath = $PSScriptRoot
Write-Host "當前路徑: $projectPath" -ForegroundColor White

$requiredFiles = @(
    "docker-compose.yml",
    "backend\Dockerfile",
    "frontend\Dockerfile",
    ".env.example"
)

$allFilesExist = $true
foreach ($file in $requiredFiles) {
    $fullPath = Join-Path $projectPath $file
    if (Test-Path $fullPath) {
        Write-Host "  ✓ $file" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $file 未找到" -ForegroundColor Red
        $allFilesExist = $false
    }
}

if (-not $allFilesExist) {
    Write-Host ""
    Write-Host "❌ 缺少必要檔案，請確保所有專案檔案已上傳到伺服器" -ForegroundColor Red
    pause
    exit 1
}

Write-Host ""

# 步驟 3: 檢查 .env 檔案
Write-Host "[3/7] 檢查環境變數設定..." -ForegroundColor Cyan

$envFile = Join-Path $projectPath ".env"

if (-not (Test-Path $envFile)) {
    Write-Host "⚠ .env 檔案不存在，從 .env.example 複製..." -ForegroundColor Yellow
    Copy-Item (Join-Path $projectPath ".env.example") $envFile
    Write-Host "✓ .env 檔案已創建" -ForegroundColor Green
    Write-Host ""
    Write-Host "⚠ 重要：請立即編輯 .env 檔案，修改以下設定：" -ForegroundColor Yellow
    Write-Host "  1. API_KEY - 設定強密碼（至少 20 字元）" -ForegroundColor Yellow
    Write-Host "  2. TELEGRAM_BOT_TOKEN 和 TELEGRAM_CHAT_ID（如需通知）" -ForegroundColor Yellow
    Write-Host ""
    
    $response = Read-Host "是否現在編輯 .env 檔案？(Y/N)"
    if ($response -eq "Y" -or $response -eq "y") {
        notepad $envFile
        Write-Host "等待編輯完成..." -ForegroundColor Yellow
        Read-Host "編輯完成後，按 Enter 繼續"
    } else {
        Write-Host "⚠ 請稍後手動編輯 .env 檔案！" -ForegroundColor Yellow
    }
} else {
    Write-Host "✓ .env 檔案已存在" -ForegroundColor Green
    
    # 檢查 API_KEY 是否已修改
    $envContent = Get-Content $envFile -Raw
    if ($envContent -match "API_KEY=.*change.*this" -or $envContent -match "API_KEY=your_") {
        Write-Host "⚠ 警告：API_KEY 似乎尚未修改，使用預設值不安全！" -ForegroundColor Yellow
        $response = Read-Host "是否現在編輯 .env 檔案？(Y/N)"
        if ($response -eq "Y" -or $response -eq "y") {
            notepad $envFile
            Read-Host "編輯完成後，按 Enter 繼續"
        }
    }
}

Write-Host ""

# 步驟 4: 檢查端口佔用
Write-Host "[4/7] 檢查端口佔用..." -ForegroundColor Cyan

$ports = @(80, 8080)
$portsInUse = @()

foreach ($port in $ports) {
    $connection = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($connection) {
        $portsInUse += $port
        Write-Host "  ⚠ 端口 $port 已被佔用" -ForegroundColor Yellow
    } else {
        Write-Host "  ✓ 端口 $port 可用" -ForegroundColor Green
    }
}

if ($portsInUse.Count -gt 0) {
    Write-Host ""
    Write-Host "⚠ 警告：以下端口已被佔用: $($portsInUse -join ', ')" -ForegroundColor Yellow
    Write-Host "建議：" -ForegroundColor Yellow
    Write-Host "  1. 停止佔用端口的服務" -ForegroundColor Yellow
    Write-Host "  2. 或修改 docker-compose.yml 使用其他端口" -ForegroundColor Yellow
    Write-Host ""
    
    $response = Read-Host "是否繼續部署？(Y/N)"
    if ($response -ne "Y" -and $response -ne "y") {
        Write-Host "部署已取消" -ForegroundColor Yellow
        pause
        exit 0
    }
}

Write-Host ""

# 步驟 5: 配置防火牆
Write-Host "[5/7] 配置防火牆規則..." -ForegroundColor Cyan

try {
    # 檢查規則是否已存在
    $existingRules = Get-NetFirewallRule -DisplayName "MT5 Monitor*" -ErrorAction SilentlyContinue
    
    if ($existingRules) {
        Write-Host "  ✓ 防火牆規則已存在" -ForegroundColor Green
    } else {
        # 創建防火牆規則
        New-NetFirewallRule -DisplayName "MT5 Monitor HTTP" `
            -Direction Inbound `
            -LocalPort 80 `
            -Protocol TCP `
            -Action Allow `
            -ErrorAction Stop | Out-Null
        
        New-NetFirewallRule -DisplayName "MT5 Monitor API" `
            -Direction Inbound `
            -LocalPort 8080 `
            -Protocol TCP `
            -Action Allow `
            -ErrorAction Stop | Out-Null
        
        Write-Host "  ✓ 防火牆規則已創建（端口 80, 8080）" -ForegroundColor Green
    }
} catch {
    Write-Host "  ⚠ 防火牆規則設定失敗: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "  請手動配置防火牆規則" -ForegroundColor Yellow
}

Write-Host ""

# 步驟 6: 構建並啟動容器
Write-Host "[6/7] 構建並啟動 Docker 容器..." -ForegroundColor Cyan
Write-Host "這可能需要 5-10 分鐘（首次構建）..." -ForegroundColor Yellow
Write-Host ""

Push-Location $projectPath

try {
    # 停止舊容器（如果存在）
    Write-Host "  → 停止舊容器（如果存在）..." -ForegroundColor White
    docker-compose down 2>&1 | Out-Null
    
    # 構建並啟動
    Write-Host "  → 構建映像..." -ForegroundColor White
    docker-compose build --no-cache 2>&1 | ForEach-Object { 
        if ($_ -match "Step \d+/\d+") {
            Write-Host "    $_" -ForegroundColor Gray
        }
    }
    
    if ($LASTEXITCODE -ne 0) {
        throw "Docker 構建失敗"
    }
    
    Write-Host "  → 啟動容器..." -ForegroundColor White
    docker-compose up -d
    
    if ($LASTEXITCODE -ne 0) {
        throw "容器啟動失敗"
    }
    
    Write-Host "  ✓ 容器啟動成功" -ForegroundColor Green
    
} catch {
    Write-Host ""
    Write-Host "❌ 部署失敗: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "查看詳細日誌：" -ForegroundColor Yellow
    Write-Host "  docker-compose logs" -ForegroundColor White
    Pop-Location
    pause
    exit 1
}

Pop-Location
Write-Host ""

# 等待服務就緒
Write-Host "  → 等待服務就緒..." -ForegroundColor White
Start-Sleep -Seconds 10

# 步驟 7: 驗證部署
Write-Host "[7/7] 驗證部署..." -ForegroundColor Cyan

# 檢查容器狀態
Push-Location $projectPath
$containers = docker-compose ps --format json | ConvertFrom-Json

$allHealthy = $true
foreach ($container in $containers) {
    $name = $container.Service
    $status = $container.State
    
    if ($status -eq "running") {
        Write-Host "  ✓ $name : 運行中" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $name : $status" -ForegroundColor Red
        $allHealthy = $false
    }
}
Pop-Location

Write-Host ""

# 測試後端健康檢查
Write-Host "  → 測試後端 API..." -ForegroundColor White
Start-Sleep -Seconds 5

try {
    $response = Invoke-WebRequest -Uri "http://localhost:8080/health" -UseBasicParsing -TimeoutSec 10
    $health = $response.Content | ConvertFrom-Json
    
    if ($health.ok -eq $true) {
        Write-Host "  ✓ 後端 API 正常" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ 後端 API 回應異常" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ❌ 後端 API 無法訪問: $($_.Exception.Message)" -ForegroundColor Red
    $allHealthy = $false
}

# 測試前端
Write-Host "  → 測試前端頁面..." -ForegroundColor White
try {
    $response = Invoke-WebRequest -Uri "http://localhost" -UseBasicParsing -TimeoutSec 10
    
    if ($response.StatusCode -eq 200) {
        Write-Host "  ✓ 前端頁面正常" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ 前端回應異常: HTTP $($response.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ❌ 前端無法訪問: $($_.Exception.Message)" -ForegroundColor Red
    $allHealthy = $false
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan

if ($allHealthy) {
    Write-Host "  🎉 部署成功！" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "訪問地址：" -ForegroundColor White
    Write-Host "  前端監控頁面: http://localhost" -ForegroundColor Cyan
    Write-Host "  後端 API:     http://localhost:8080" -ForegroundColor Cyan
    Write-Host "  健康檢查:     http://localhost:8080/health" -ForegroundColor Cyan
    Write-Host ""
    
    # 顯示伺服器 IP
    $localIPs = Get-NetIPAddress -AddressFamily IPv4 | 
        Where-Object {$_.IPAddress -ne '127.0.0.1' -and $_.PrefixOrigin -ne 'WellKnown'} | 
        Select-Object -ExpandProperty IPAddress
    
    if ($localIPs) {
        Write-Host "伺服器 IP 地址：" -ForegroundColor White
        foreach ($ip in $localIPs) {
            Write-Host "  http://$ip" -ForegroundColor Cyan
            Write-Host "  http://$ip`:8080/api" -ForegroundColor Cyan
        }
        Write-Host ""
    }
    
    Write-Host "下一步：" -ForegroundColor White
    Write-Host "  1. 複製 mql\MT5_Monitor_Client.mq5 到 MT5 的 Experts 資料夾" -ForegroundColor Yellow
    Write-Host "  2. 在 MT5 中設定 WebRequest 白名單" -ForegroundColor Yellow
    Write-Host "  3. 編譯並運行 EA" -ForegroundColor Yellow
    Write-Host "  4. 檢查監控頁面是否顯示節點" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "詳細步驟請參考: WINDOWS_SERVER_DEPLOYMENT.md" -ForegroundColor White
    
} else {
    Write-Host "  ⚠ 部署完成但有警告" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "請檢查日誌：" -ForegroundColor Yellow
    Write-Host "  cd $projectPath" -ForegroundColor White
    Write-Host "  docker-compose logs -f" -ForegroundColor White
}

Write-Host ""
Write-Host "常用命令：" -ForegroundColor White
Write-Host "  查看狀態:   docker-compose ps" -ForegroundColor Gray
Write-Host "  查看日誌:   docker-compose logs -f" -ForegroundColor Gray
Write-Host "  重啟服務:   docker-compose restart" -ForegroundColor Gray
Write-Host "  停止服務:   docker-compose down" -ForegroundColor Gray
Write-Host ""

pause
