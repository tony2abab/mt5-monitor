# 配置文件備份腳本
# 在修改重要配置文件前自動創建備份

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = ".\config_backups\$timestamp"

# 創建備份目錄
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

# 需要備份的文件列表
$filesToBackup = @(
    ".\backend\ecosystem.config.js",
    ".\backend\.env",
    ".\backend\package.json",
    ".\frontend\package.json",
    ".\docker-compose.yml"
)

Write-Host "開始備份配置文件..." -ForegroundColor Green

foreach ($file in $filesToBackup) {
    if (Test-Path $file) {
        $fileName = Split-Path $file -Leaf
        $destPath = Join-Path $backupDir $fileName
        Copy-Item $file $destPath -Force
        Write-Host "✓ 已備份: $file" -ForegroundColor Cyan
    } else {
        Write-Host "⚠ 文件不存在: $file" -ForegroundColor Yellow
    }
}

Write-Host "`n備份完成！備份位置: $backupDir" -ForegroundColor Green
Write-Host "如需恢復，請從備份目錄複製文件。" -ForegroundColor Yellow
