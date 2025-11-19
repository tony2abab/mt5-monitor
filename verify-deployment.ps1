# MT5 Monitor - 部署驗證腳本
# 用於檢查系統是否正確部署和運行

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  MT5 Monitor 部署驗證" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$projectPath = $PSScriptRoot
$allPassed = $true

# 測試 1: 檢查 Docker 服務
Write-Host "[測試 1/8] 檢查 Docker 服務..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Docker 運行中: $dockerVersion" -ForegroundColor Green
    } else {
        throw "Docker 未運行"
    }
} catch {
    Write-Host "  ❌ Docker 服務異常" -ForegroundColor Red
    $allPassed = $false
}

# 測試 2: 檢查容器狀態
Write-Host "`n[測試 2/8] 檢查容器狀態..." -ForegroundColor Yellow
Push-Location $projectPath
try {
    $containers = docker-compose ps --format json 2>&1
    if ($LASTEXITCODE -eq 0) {
        $containerList = $containers | ConvertFrom-Json
        
        $backendRunning = $false
        $frontendRunning = $false
        
        foreach ($container in $containerList) {
            $name = $container.Service
            $state = $container.State
            
            if ($name -eq "backend") {
                $backendRunning = ($state -eq "running")
                if ($backendRunning) {
                    Write-Host "  ✓ Backend 容器運行中" -ForegroundColor Green
                } else {
                    Write-Host "  ❌ Backend 容器狀態: $state" -ForegroundColor Red
                    $allPassed = $false
                }
            }
            
            if ($name -eq "frontend") {
                $frontendRunning = ($state -eq "running")
                if ($frontendRunning) {
                    Write-Host "  ✓ Frontend 容器運行中" -ForegroundColor Green
                } else {
                    Write-Host "  ❌ Frontend 容器狀態: $state" -ForegroundColor Red
                    $allPassed = $false
                }
            }
        }
        
        if (-not $backendRunning -or -not $frontendRunning) {
            Write-Host "  ⚠ 請檢查容器日誌: docker-compose logs" -ForegroundColor Yellow
        }
    } else {
        throw "無法獲取容器狀態"
    }
} catch {
    Write-Host "  ❌ 無法檢查容器: $($_.Exception.Message)" -ForegroundColor Red
    $allPassed = $false
}
Pop-Location

# 測試 3: 後端健康檢查
Write-Host "`n[測試 3/8] 測試後端健康檢查..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8080/health" -UseBasicParsing -TimeoutSec 10
    $health = $response.Content | ConvertFrom-Json
    
    if ($health.ok -eq $true -and $health.status -eq "healthy") {
        Write-Host "  ✓ 後端健康檢查通過" -ForegroundColor Green
        Write-Host "    狀態: $($health.status)" -ForegroundColor Gray
        Write-Host "    時間: $($health.timestamp)" -ForegroundColor Gray
    } else {
        Write-Host "  ⚠ 後端回應異常: $($response.Content)" -ForegroundColor Yellow
        $allPassed = $false
    }
} catch {
    Write-Host "  ❌ 後端健康檢查失敗: $($_.Exception.Message)" -ForegroundColor Red
    $allPassed = $false
}

# 測試 4: 測試 API 端點
Write-Host "`n[測試 4/8] 測試 API 端點..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8080/api/nodes" -UseBasicParsing -TimeoutSec 10
    $data = $response.Content | ConvertFrom-Json
    
    if ($data.ok -eq $true) {
        Write-Host "  ✓ API 端點正常" -ForegroundColor Green
        Write-Host "    節點數量: $($data.nodes.Count)" -ForegroundColor Gray
        Write-Host "    線上節點: $($data.summary.online)" -ForegroundColor Gray
        Write-Host "    離線節點: $($data.summary.offline)" -ForegroundColor Gray
    } else {
        Write-Host "  ⚠ API 回應異常" -ForegroundColor Yellow
        $allPassed = $false
    }
} catch {
    Write-Host "  ❌ API 端點測試失敗: $($_.Exception.Message)" -ForegroundColor Red
    $allPassed = $false
}

# 測試 5: 測試前端頁面
Write-Host "`n[測試 5/8] 測試前端頁面..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost" -UseBasicParsing -TimeoutSec 10
    
    if ($response.StatusCode -eq 200) {
        Write-Host "  ✓ 前端頁面正常" -ForegroundColor Green
        Write-Host "    HTTP Status: $($response.StatusCode)" -ForegroundColor Gray
        Write-Host "    內容長度: $($response.Content.Length) bytes" -ForegroundColor Gray
    } else {
        Write-Host "  ⚠ 前端回應異常: HTTP $($response.StatusCode)" -ForegroundColor Yellow
        $allPassed = $false
    }
} catch {
    Write-Host "  ❌ 前端頁面測試失敗: $($_.Exception.Message)" -ForegroundColor Red
    $allPassed = $false
}

# 測試 6: 測試 Nginx API 代理
Write-Host "`n[測試 6/8] 測試 Nginx API 代理..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost/api/nodes" -UseBasicParsing -TimeoutSec 10
    $data = $response.Content | ConvertFrom-Json
    
    if ($data.ok -eq $true) {
        Write-Host "  ✓ Nginx API 代理正常" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ API 代理回應異常" -ForegroundColor Yellow
        $allPassed = $false
    }
} catch {
    Write-Host "  ❌ Nginx API 代理失敗: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "    可能原因: nginx.conf 配置錯誤" -ForegroundColor Yellow
    $allPassed = $false
}

# 測試 7: 檢查資料庫
Write-Host "`n[測試 7/8] 檢查資料庫..." -ForegroundColor Yellow
$dbPath = Join-Path $projectPath "data\monitor.db"
if (Test-Path $dbPath) {
    $dbSize = (Get-Item $dbPath).Length
    Write-Host "  ✓ 資料庫檔案存在" -ForegroundColor Green
    Write-Host "    路徑: $dbPath" -ForegroundColor Gray
    Write-Host "    大小: $([math]::Round($dbSize / 1KB, 2)) KB" -ForegroundColor Gray
} else {
    Write-Host "  ⚠ 資料庫檔案不存在（首次啟動會自動創建）" -ForegroundColor Yellow
}

# 測試 8: 檢查防火牆規則
Write-Host "`n[測試 8/8] 檢查防火牆規則..." -ForegroundColor Yellow
try {
    $firewallRules = Get-NetFirewallRule -DisplayName "MT5 Monitor*" -ErrorAction SilentlyContinue
    
    if ($firewallRules) {
        $ruleCount = ($firewallRules | Measure-Object).Count
        Write-Host "  ✓ 防火牆規則已設定 ($ruleCount 條規則)" -ForegroundColor Green
        
        foreach ($rule in $firewallRules) {
            $enabled = if ($rule.Enabled -eq "True") { "✓" } else { "✗" }
            Write-Host "    $enabled $($rule.DisplayName)" -ForegroundColor Gray
        }
    } else {
        Write-Host "  ⚠ 未找到防火牆規則" -ForegroundColor Yellow
        Write-Host "    如需外部訪問，請運行 deploy-windows-server.ps1" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ⚠ 無法檢查防火牆規則: $($_.Exception.Message)" -ForegroundColor Yellow
}

# 顯示網路資訊
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  網路資訊" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "`n本地訪問地址：" -ForegroundColor White
Write-Host "  前端: http://localhost" -ForegroundColor Cyan
Write-Host "  API:  http://localhost:8080/api" -ForegroundColor Cyan

$localIPs = Get-NetIPAddress -AddressFamily IPv4 | 
    Where-Object {$_.IPAddress -ne '127.0.0.1' -and $_.PrefixOrigin -ne 'WellKnown'} | 
    Select-Object -ExpandProperty IPAddress

if ($localIPs) {
    Write-Host "`n伺服器 IP 地址（局域網訪問）：" -ForegroundColor White
    foreach ($ip in $localIPs) {
        Write-Host "  前端: http://$ip" -ForegroundColor Cyan
        Write-Host "  API:  http://$ip`:8080/api" -ForegroundColor Cyan
    }
}

# 測試端口連通性
Write-Host "`n端口監聽狀態：" -ForegroundColor White
$ports = @(80, 8080)
foreach ($port in $ports) {
    try {
        $connection = Test-NetConnection -ComputerName localhost -Port $port -WarningAction SilentlyContinue
        if ($connection.TcpTestSucceeded) {
            Write-Host "  ✓ 端口 $port : 監聽中" -ForegroundColor Green
        } else {
            Write-Host "  ❌ 端口 $port : 未監聽" -ForegroundColor Red
        }
    } catch {
        Write-Host "  ⚠ 端口 $port : 無法測試" -ForegroundColor Yellow
    }
}

# 總結
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  驗證結果" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

if ($allPassed) {
    Write-Host "`n🎉 所有測試通過！系統運行正常。" -ForegroundColor Green
    Write-Host "`n下一步：" -ForegroundColor White
    Write-Host "  1. 在 MT4/MT5 中設定 WebRequest 白名單" -ForegroundColor Yellow
    Write-Host "  2. 複製並編譯 EA (mql 資料夾)" -ForegroundColor Yellow
    Write-Host "  3. 運行 EA 並檢查監控頁面" -ForegroundColor Yellow
} else {
    Write-Host "`n⚠ 部分測試失敗，請檢查以上錯誤訊息。" -ForegroundColor Yellow
    Write-Host "`n建議操作：" -ForegroundColor White
    Write-Host "  1. 查看容器日誌: docker-compose logs -f" -ForegroundColor Yellow
    Write-Host "  2. 重啟服務: docker-compose restart" -ForegroundColor Yellow
    Write-Host "  3. 檢查 .env 設定" -ForegroundColor Yellow
    Write-Host "  4. 查看防火牆設定" -ForegroundColor Yellow
}

Write-Host "`n常用命令：" -ForegroundColor White
Write-Host "  docker-compose ps              - 查看容器狀態" -ForegroundColor Gray
Write-Host "  docker-compose logs -f         - 查看即時日誌" -ForegroundColor Gray
Write-Host "  docker-compose restart         - 重啟服務" -ForegroundColor Gray
Write-Host "  docker-compose down            - 停止服務" -ForegroundColor Gray
Write-Host "  docker-compose up -d           - 啟動服務" -ForegroundColor Gray

Write-Host "`n詳細文檔：" -ForegroundColor White
Write-Host "  WINDOWS_SERVER_DEPLOYMENT.md   - 完整部署指南" -ForegroundColor Gray
Write-Host "  DEPLOYMENT_CHECKLIST.md        - 快速檢查清單" -ForegroundColor Gray

Write-Host ""
pause
