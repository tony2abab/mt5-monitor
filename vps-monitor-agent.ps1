# VPS Performance Monitor Agent
# 此腳本收集 Windows Server 效能指標並發送到主控 VPS
# 使用方法：在 Task Scheduler 中設定每 5 分鐘執行一次

# ==================== 配置區域 ====================
# 請修改以下配置以符合您的環境

# 主控 VPS 的 API 端點
$API_ENDPOINT = "http://YOUR_MASTER_VPS_IP:8080/api/vps/metrics"

# API 認證金鑰（與主控 VPS 的 API_KEY 相同）
$API_KEY = "secret_key_2025_9093942525abcdxyz_"

# VPS 識別名稱（建議使用有意義的名稱，如 VPS-MT5-01）
$VPS_NAME = $env:COMPUTERNAME  # 預設使用電腦名稱，可自訂

# VPS IP 地址（可選，用於顯示）
$VPS_IP = ""  # 留空則不發送

# VPS 描述（可選）
$VPS_DESCRIPTION = ""  # 例如："MT5 交易伺服器 - 倫敦"

# ==================== 效能數據收集 ====================

Write-Host "=== VPS Performance Monitor Agent ===" -ForegroundColor Cyan
Write-Host "VPS Name: $VPS_NAME" -ForegroundColor Yellow
Write-Host "Collecting metrics..." -ForegroundColor Gray

try {
    # 1. CPU 隊列長度（處理器隊列長度）
    $cpuQueueLength = (Get-Counter '\System\Processor Queue Length').CounterSamples[0].CookedValue
    Write-Host "  CPU Queue Length: $cpuQueueLength" -ForegroundColor Gray
    
    # 2. CPU 使用率
    $cpuUsage = (Get-Counter '\Processor(_Total)\% Processor Time').CounterSamples[0].CookedValue
    Write-Host "  CPU Usage: $([math]::Round($cpuUsage, 2))%" -ForegroundColor Gray
    
    # 3. 上下文切換/秒
    $contextSwitches = (Get-Counter '\System\Context Switches/sec').CounterSamples[0].CookedValue
    Write-Host "  Context Switches/sec: $([math]::Round($contextSwitches, 0))" -ForegroundColor Gray
    
    # 4. 磁碟隊列長度（所有實體磁碟的平均）
    $diskQueueLength = (Get-Counter '\PhysicalDisk(_Total)\Current Disk Queue Length').CounterSamples[0].CookedValue
    Write-Host "  Disk Queue Length: $diskQueueLength" -ForegroundColor Gray
    
    # 5. 磁碟讀取延遲（毫秒）
    $diskReadLatency = (Get-Counter '\PhysicalDisk(_Total)\Avg. Disk sec/Read').CounterSamples[0].CookedValue * 1000
    Write-Host "  Disk Read Latency: $([math]::Round($diskReadLatency, 2))ms" -ForegroundColor Gray
    
    # 6. 磁碟寫入延遲（毫秒）
    $diskWriteLatency = (Get-Counter '\PhysicalDisk(_Total)\Avg. Disk sec/Write').CounterSamples[0].CookedValue * 1000
    Write-Host "  Disk Write Latency: $([math]::Round($diskWriteLatency, 2))ms" -ForegroundColor Gray
    
    # 7. 可用記憶體（MB）
    $memoryAvailable = (Get-Counter '\Memory\Available MBytes').CounterSamples[0].CookedValue
    Write-Host "  Memory Available: $([math]::Round($memoryAvailable, 0))MB" -ForegroundColor Gray
    
    # 8. 記憶體使用率（計算）
    $totalMemoryMB = (Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1MB
    $memoryUsagePercent = (($totalMemoryMB - $memoryAvailable) / $totalMemoryMB) * 100
    Write-Host "  Memory Usage: $([math]::Round($memoryUsagePercent, 2))%" -ForegroundColor Gray
    
    # ==================== 構建 JSON 數據 ====================
    
    $metricsData = @{
        vps_name = $VPS_NAME
        cpu_queue_length = [math]::Round($cpuQueueLength, 2)
        cpu_usage_percent = [math]::Round($cpuUsage, 2)
        context_switches_per_sec = [math]::Round($contextSwitches, 0)
        disk_queue_length = [math]::Round($diskQueueLength, 2)
        disk_read_latency_ms = [math]::Round($diskReadLatency, 2)
        disk_write_latency_ms = [math]::Round($diskWriteLatency, 2)
        memory_available_mb = [math]::Round($memoryAvailable, 0)
        memory_usage_percent = [math]::Round($memoryUsagePercent, 2)
    }
    
    # 添加可選欄位
    if ($VPS_IP) {
        $metricsData.vps_ip = $VPS_IP
    }
    if ($VPS_DESCRIPTION) {
        $metricsData.description = $VPS_DESCRIPTION
    }
    
    $jsonBody = $metricsData | ConvertTo-Json -Compress
    
    # ==================== 發送數據到主控 VPS ====================
    
    Write-Host "`nSending data to master VPS..." -ForegroundColor Yellow
    
    $headers = @{
        "Content-Type" = "application/json"
        "X-API-Key" = $API_KEY
    }
    
    $response = Invoke-RestMethod -Uri $API_ENDPOINT -Method POST -Headers $headers -Body $jsonBody -TimeoutSec 10
    
    if ($response.ok) {
        Write-Host "✓ Data sent successfully!" -ForegroundColor Green
        if ($response.alerts -gt 0) {
            Write-Host "  ⚠️  $($response.alerts) alert(s) triggered" -ForegroundColor Yellow
        }
    } else {
        Write-Host "✗ Failed: $($response.error)" -ForegroundColor Red
        exit 1
    }
    
} catch {
    Write-Host "`n✗ Error occurred:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host $_.ScriptStackTrace -ForegroundColor DarkGray
    exit 1
}

Write-Host "`n=== Monitoring completed ===" -ForegroundColor Cyan
exit 0
