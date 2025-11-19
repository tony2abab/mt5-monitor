# 部署指南

本文檔提供完整的部署指南，包括本地開發、Docker 部署和生產環境配置。

## 📋 目錄

- [本地開發](#本地開發)
- [Docker 部署](#docker-部署)
- [生產環境部署](#生產環境部署)
- [資料庫遷移](#資料庫遷移)
- [備份與恢復](#備份與恢復)
- [監控與日誌](#監控與日誌)

## 🔧 本地開發

### 前置需求

- Node.js 18+
- npm 或 yarn
- Git

### 步驟

1. **克隆專案**
```bash
git clone <repository-url>
cd MT5_Monitor
```

2. **安裝依賴**
```bash
# 安裝所有依賴（根目錄、後端、前端）
npm run install:all

# 或分別安裝
cd backend && npm install
cd ../frontend && npm install
```

3. **配置環境變數**
```bash
# 後端
cd backend
copy .env.example .env
# 編輯 .env 檔案

# 前端
cd frontend
copy .env.example .env
```

4. **初始化資料庫**
```bash
cd backend
npm run migrate
```

5. **啟動開發伺服器**

**終端 1 - 後端**:
```bash
cd backend
npm run dev
```

**終端 2 - 前端**:
```bash
cd frontend
npm run dev
```

6. **訪問應用**
- 前端: http://localhost:3000
- 後端 API: http://localhost:8080/api
- 健康檢查: http://localhost:8080/health

## 🐳 Docker 部署

### 前置需求

- Docker 20.10+
- Docker Compose 2.0+

### 快速部署

1. **準備環境檔案**
```bash
copy .env.example .env
```

2. **編輯 .env**
```env
API_KEY=your_strong_api_key_here_change_this
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=123456789
HEARTBEAT_TIMEOUT_SECONDS=300
NOTIFY_ON_RECOVERY=true
ENABLE_AUTH=true
```

3. **啟動服務**
```bash
docker-compose up -d
```

4. **查看日誌**
```bash
# 查看所有服務
docker-compose logs -f

# 查看特定服務
docker-compose logs -f backend
docker-compose logs -f frontend
```

5. **驗證運作**
```bash
# 健康檢查
curl http://localhost:8080/health

# 訪問前端
# 開啟瀏覽器: http://localhost
```

### Docker 命令參考

```bash
# 停止服務
docker-compose down

# 重新建置
docker-compose build --no-cache

# 重啟服務
docker-compose restart

# 查看容器狀態
docker-compose ps

# 進入容器
docker-compose exec backend sh
docker-compose exec frontend sh

# 查看資源使用
docker stats

# 清理未使用的資源
docker system prune -a
```

## 🚀 生產環境部署

### VPS/雲端伺服器部署

#### 1. 伺服器準備

**推薦規格**:
- CPU: 2 核心
- RAM: 2GB+
- 磁碟: 20GB+
- 作業系統: Ubuntu 22.04 LTS / Windows Server 2019+

**安裝 Docker**:

**Ubuntu/Debian**:
```bash
# 更新系統
sudo apt update && sudo apt upgrade -y

# 安裝 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 安裝 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 驗證安裝
docker --version
docker-compose --version
```

**Windows Server**:
1. 下載並安裝 Docker Desktop for Windows
2. 啟用 WSL2
3. 安裝 Docker Compose

#### 2. 部署應用

```bash
# 1. 克隆或上傳專案
git clone <repository-url> /opt/mt5-monitor
cd /opt/mt5-monitor

# 2. 配置環境變數
nano .env
# 填寫生產環境設定

# 3. 修改 docker-compose.yml 的埠號（可選）
nano docker-compose.yml
# 將 80:80 改為 8888:80（如果 80 被佔用）

# 4. 啟動服務
docker-compose up -d

# 5. 檢查狀態
docker-compose ps
docker-compose logs -f
```

#### 3. 設定反向代理（可選）

**使用 Nginx**:

```nginx
# /etc/nginx/sites-available/mt5-monitor
server {
    listen 80;
    server_name monitor.yourdomain.com;

    location / {
        proxy_pass http://localhost:80;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

啟用站點:
```bash
sudo ln -s /etc/nginx/sites-available/mt5-monitor /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### 4. 設定 SSL（使用 Let's Encrypt）

```bash
# 安裝 Certbot
sudo apt install certbot python3-certbot-nginx -y

# 取得憑證
sudo certbot --nginx -d monitor.yourdomain.com

# 自動續約
sudo certbot renew --dry-run
```

#### 5. 設定防火牆

```bash
# Ubuntu UFW
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 8080/tcp
sudo ufw enable
```

## 💾 資料庫遷移

### 備份資料庫

```bash
# 進入 Docker 容器
docker-compose exec backend sh

# 或在本地
cd backend

# 備份 SQLite
cp data/monitor.db data/monitor_backup_$(date +%Y%m%d_%H%M%S).db

# 從容器複製出來
docker cp mt5-monitor-backend:/app/data/monitor.db ./backup/monitor.db
```

### 還原資料庫

```bash
# 停止服務
docker-compose down

# 還原備份
cp backup/monitor.db data/monitor.db

# 重新啟動
docker-compose up -d
```

### 遷移到 PostgreSQL（可選）

1. **安裝 PostgreSQL**
```bash
# 修改 docker-compose.yml 添加 PostgreSQL 服務
services:
  postgres:
    image: postgres:15-alpine
    container_name: mt5-monitor-postgres
    environment:
      POSTGRES_DB: mt5monitor
      POSTGRES_USER: mt5user
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - mt5-network

volumes:
  postgres_data:
```

2. **修改後端程式碼**
- 安裝 PostgreSQL 驅動: `npm install pg`
- 更新 `database/db.js` 以支援 PostgreSQL

## 📊 監控與日誌

### 查看日誌

```bash
# 即時日誌
docker-compose logs -f backend
docker-compose logs -f frontend

# 最近 100 行
docker-compose logs --tail=100 backend

# 儲存日誌到檔案
docker-compose logs backend > backend.log
```

### 設定日誌輪替

創建 `/etc/logrotate.d/mt5-monitor`:
```
/var/log/mt5-monitor/*.log {
    daily
    rotate 7
    compress
    delaycompress
    notifempty
    create 0640 root root
    sharedscripts
}
```

### 監控服務健康

**創建健康檢查腳本** `health-check.sh`:
```bash
#!/bin/bash
HEALTH_URL="http://localhost:8080/health"
TELEGRAM_BOT_TOKEN="your_bot_token"
TELEGRAM_CHAT_ID="your_chat_id"

response=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

if [ $response -ne 200 ]; then
    message="⚠️ MT5 Monitor 服務異常！HTTP Code: $response"
    curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
        -d "chat_id=$TELEGRAM_CHAT_ID" \
        -d "text=$message"
fi
```

**設定 Cron Job**:
```bash
crontab -e

# 每 5 分鐘檢查一次
*/5 * * * * /opt/mt5-monitor/health-check.sh
```

### 性能監控

**使用 Docker Stats**:
```bash
docker stats mt5-monitor-backend mt5-monitor-frontend
```

**使用 Prometheus + Grafana（進階）**:
1. 添加 Prometheus exporter 到後端
2. 配置 Prometheus 抓取指標
3. 在 Grafana 建立儀表板

## 🔐 安全性最佳實踐

### 1. 變更預設設定
- 修改 API_KEY 為強密碼
- 使用環境變數管理敏感資訊
- 不要將 .env 提交到 Git

### 2. 限制網路訪問
```bash
# 使用防火牆限制 API 訪問
sudo ufw allow from 192.168.1.0/24 to any port 8080
```

### 3. 啟用 HTTPS
- 使用 Let's Encrypt 取得免費 SSL 憑證
- 強制 HTTPS 重定向

### 4. 定期更新
```bash
# 更新 Docker 映像
docker-compose pull
docker-compose up -d

# 更新系統套件
sudo apt update && sudo apt upgrade -y
```

### 5. 備份策略
- 每日自動備份資料庫
- 保留最近 7 天的備份
- 異地備份重要資料

## 🛠️ 故障排除

### 服務無法啟動

**檢查埠號佔用**:
```bash
# Windows
netstat -ano | findstr :8080
netstat -ano | findstr :80

# Linux
sudo lsof -i :8080
sudo lsof -i :80
```

**查看詳細錯誤**:
```bash
docker-compose logs backend
```

### 資料庫錯誤

**重建資料庫**:
```bash
docker-compose down
rm -f data/monitor.db
docker-compose up -d
```

### 記憶體不足

**增加 Docker 記憶體限制**:
```yaml
services:
  backend:
    mem_limit: 512m
    mem_reservation: 256m
```

## 📞 支援

如遇問題：
1. 檢查日誌: `docker-compose logs`
2. 查看健康狀態: `curl http://localhost:8080/health`
3. 參考 README.md 的故障排除章節
4. 提交 Issue 到專案 GitHub
