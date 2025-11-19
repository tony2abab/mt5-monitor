# MT5 Monitor API Test Script (PowerShell)
# 測試後端 API 的心跳和統計上報功能

$API_BASE = "http://localhost:8080/api"
$API_KEY = "your_secret_api_key_change_this"

$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $API_KEY"
}

Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "MT5 Monitor API Test Script" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Health Check
Write-Host "[Test 1] Health Check..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://localhost:8080/health" -Method GET
    Write-Host "✓ Server is healthy" -ForegroundColor Green
    Write-Host "  Response: $($health | ConvertTo-Json -Compress)" -ForegroundColor Gray
} catch {
    Write-Host "✗ Health check failed: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 2: Send Heartbeat
Write-Host "[Test 2] Sending Heartbeat..." -ForegroundColor Yellow
$heartbeatBody = @{
    id = "TEST_NODE_01"
    name = "Test EA Node"
    broker = "Test Broker Co."
    account = "88888888"
    meta = @{
        symbols = @("XAUUSD", "EURUSD")
    }
} | ConvertTo-Json

try {
    $heartbeatResponse = Invoke-RestMethod -Uri "$API_BASE/heartbeat" -Method POST -Headers $headers -Body $heartbeatBody
    Write-Host "✓ Heartbeat sent successfully" -ForegroundColor Green
    Write-Host "  Response: $($heartbeatResponse | ConvertTo-Json -Compress)" -ForegroundColor Gray
} catch {
    Write-Host "✗ Heartbeat failed: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 3: Send Stats
Write-Host "[Test 3] Sending Daily Stats..." -ForegroundColor Yellow
$today = Get-Date -Format "yyyy-MM-dd"
$statsBody = @{
    id = "TEST_NODE_01"
    date = $today
    profit_loss = 250.75
    interest = 5.50
    avg_lots_success = 0.68
    lots_traded = 15.5
    ab_lots_diff = 3.2
} | ConvertTo-Json

try {
    $statsResponse = Invoke-RestMethod -Uri "$API_BASE/stats" -Method POST -Headers $headers -Body $statsBody
    Write-Host "✓ Stats sent successfully" -ForegroundColor Green
    Write-Host "  Response: $($statsResponse | ConvertTo-Json -Compress)" -ForegroundColor Gray
} catch {
    Write-Host "✗ Stats failed: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 4: Get All Nodes
Write-Host "[Test 4] Getting All Nodes..." -ForegroundColor Yellow
try {
    $nodes = Invoke-RestMethod -Uri "$API_BASE/nodes" -Method GET
    Write-Host "✓ Retrieved $($nodes.nodes.Count) nodes" -ForegroundColor Green
    Write-Host "  Summary:" -ForegroundColor Gray
    Write-Host "    Total: $($nodes.summary.total)" -ForegroundColor Gray
    Write-Host "    Online: $($nodes.summary.online)" -ForegroundColor Gray
    Write-Host "    Offline: $($nodes.summary.offline)" -ForegroundColor Gray
    Write-Host "    Total P/L: $($nodes.summary.totalProfitLoss)" -ForegroundColor Gray
    
    if ($nodes.nodes.Count -gt 0) {
        Write-Host "`n  First node:" -ForegroundColor Gray
        Write-Host "    ID: $($nodes.nodes[0].id)" -ForegroundColor Gray
        Write-Host "    Name: $($nodes.nodes[0].name)" -ForegroundColor Gray
        Write-Host "    Status: $($nodes.nodes[0].status)" -ForegroundColor Gray
    }
} catch {
    Write-Host "✗ Get nodes failed: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 5: Get Single Node
Write-Host "[Test 5] Getting Single Node..." -ForegroundColor Yellow
try {
    $node = Invoke-RestMethod -Uri "$API_BASE/nodes/TEST_NODE_01?days=7" -Method GET
    Write-Host "✓ Retrieved node details" -ForegroundColor Green
    Write-Host "  Node: $($node.node.name)" -ForegroundColor Gray
    Write-Host "  Status: $($node.node.status)" -ForegroundColor Gray
    Write-Host "  Recent stats count: $($node.recentStats.Count)" -ForegroundColor Gray
} catch {
    Write-Host "✗ Get node failed: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "Tests completed!" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Check the frontend at http://localhost:3000 (dev) or http://localhost (production)" -ForegroundColor White
Write-Host "2. Attach MT4/MT5 EA to start real monitoring" -ForegroundColor White
Write-Host "3. Configure Telegram notifications in .env" -ForegroundColor White
