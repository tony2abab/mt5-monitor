# VPS Performance Monitor Agent - Production
# Deploy to: C:\VPS_Monitor\vps-monitor-agent.ps1
# Run every 5 minutes via Task Scheduler

$API_ENDPOINT = "http://81.0.248.137:8080/api/vps/metrics"
$API_KEY = "secret_key_2025_9093942525abcdxyz_"
$VPS_NAME = "VPS-B8 (CPU6)"
$VPS_IP = ""
$VPS_DESCRIPTION = ""

Write-Host "=== VPS Performance Monitor Agent ===" -ForegroundColor Cyan
Write-Host "VPS Name: $VPS_NAME" -ForegroundColor Yellow
Write-Host "Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
Write-Host "Collecting metrics..." -ForegroundColor Gray

try {
    $cpuQueueLength = (Get-Counter '\System\Processor Queue Length').CounterSamples[0].CookedValue
    Write-Host "  CPU Queue Length: $cpuQueueLength" -ForegroundColor Gray
    
    $cpuUsage = (Get-Counter '\Processor(_Total)\% Processor Time').CounterSamples[0].CookedValue
    Write-Host "  CPU Usage: $([math]::Round($cpuUsage, 2))%" -ForegroundColor Gray
    
    $contextSwitches = (Get-Counter '\System\Context Switches/sec').CounterSamples[0].CookedValue
    Write-Host "  Context Switches/sec: $([math]::Round($contextSwitches, 0))" -ForegroundColor Gray
    
    $diskQueueLength = (Get-Counter '\PhysicalDisk(_Total)\Current Disk Queue Length').CounterSamples[0].CookedValue
    Write-Host "  Disk Queue Length: $diskQueueLength" -ForegroundColor Gray
    
    $diskReadLatency = (Get-Counter '\PhysicalDisk(_Total)\Avg. Disk sec/Read').CounterSamples[0].CookedValue * 1000
    Write-Host "  Disk Read Latency: $([math]::Round($diskReadLatency, 2))ms" -ForegroundColor Gray
    
    $diskWriteLatency = (Get-Counter '\PhysicalDisk(_Total)\Avg. Disk sec/Write').CounterSamples[0].CookedValue * 1000
    Write-Host "  Disk Write Latency: $([math]::Round($diskWriteLatency, 2))ms" -ForegroundColor Gray
    
    $memoryAvailable = (Get-Counter '\Memory\Available MBytes').CounterSamples[0].CookedValue
    Write-Host "  Memory Available: $([math]::Round($memoryAvailable, 0))MB" -ForegroundColor Gray
    
    $totalMemoryMB = (Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1MB
    $memoryUsagePercent = (($totalMemoryMB - $memoryAvailable) / $totalMemoryMB) * 100
    Write-Host "  Memory Usage: $([math]::Round($memoryUsagePercent, 2))%" -ForegroundColor Gray
    
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
    
    if ($VPS_IP) { $metricsData.vps_ip = $VPS_IP }
    if ($VPS_DESCRIPTION) { $metricsData.description = $VPS_DESCRIPTION }
    
    $jsonBody = $metricsData | ConvertTo-Json -Compress
    
    Write-Host "`nSending data to master VPS..." -ForegroundColor Yellow
    
    $headers = @{
        "Content-Type" = "application/json"
        "Authorization" = "Bearer $API_KEY"
    }
    
    try {
        $response = Invoke-RestMethod -Uri $API_ENDPOINT -Method POST -Headers $headers -Body $jsonBody -TimeoutSec 10
        
        if ($response.ok) {
            Write-Host "Success! Data sent." -ForegroundColor Green
            if ($response.alerts -gt 0) {
                Write-Host "  Alerts triggered: $($response.alerts)" -ForegroundColor Yellow
            }
        } else {
            Write-Host "Failed: $($response.error)" -ForegroundColor Red
            exit 1
        }
    } catch {
        Write-Host "Network error: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
    
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== Completed ===" -ForegroundColor Cyan
exit 0