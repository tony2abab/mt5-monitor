@echo off
chcp 65001 >nul
echo ========================================
echo MT5 Monitor 創建部署包
echo ========================================
echo.

set timestamp=%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set timestamp=%timestamp: =0%
set deployDir=deploy_packages\%timestamp%

echo 創建部署目錄: %deployDir%
mkdir "%deployDir%\backend\src" 2>nul

echo.
echo 複製後端文件...
xcopy "backend\src" "%deployDir%\backend\src" /E /I /Y >nul
copy "backend\package.json" "%deployDir%\backend\" /Y >nul
copy "backend\ecosystem.config.js" "%deployDir%\backend\" /Y >nul 2>nul

echo ✓ 後端文件已複製
echo.

echo 創建部署說明...
(
echo MT5 Monitor 部署包
echo 創建時間: %date% %time%
echo.
echo === 部署步驟 ===
echo.
echo 1. 將此文件夾複製到 VPS
echo.
echo 2. 在 VPS 上執行以下命令：
echo.
echo    # 停止服務
echo    pm2 stop mt5-monitor-backend
echo.
echo    # 備份舊文件
echo    Copy-Item C:\MT5_Monitor\mt5-monitor\backend\src\services\heartbeat.js C:\MT5_Monitor\backup_heartbeat.js
echo.
echo    # 複製新文件
echo    Copy-Item .\backend\src\services\heartbeat.js C:\MT5_Monitor\mt5-monitor\backend\src\services\heartbeat.js -Force
echo.
echo    # 重啟服務
echo    pm2 restart mt5-monitor-backend
echo.
echo    # 查看日誌
echo    pm2 logs mt5-monitor-backend
echo.
echo === 本次修改內容 ===
echo.
echo - 修改收市時段從 23:55-01:30 改為 23:50-01:15
echo - 文件: backend/src/services/heartbeat.js
echo.
echo === 只需複製的文件 ===
echo.
echo backend\src\services\heartbeat.js
echo.
) > "%deployDir%\部署說明.txt"

echo ✓ 部署說明已創建
echo.
echo ========================================
echo 部署包已創建: %deployDir%
echo ========================================
echo.
echo 請按照以下步驟部署：
echo.
echo 1. 打開文件夾: %deployDir%
echo 2. 使用遠程桌面連接到 VPS
echo 3. 將 heartbeat.js 複製到 VPS
echo 4. 按照「部署說明.txt」中的步驟操作
echo.

start explorer "%deployDir%"

pause
