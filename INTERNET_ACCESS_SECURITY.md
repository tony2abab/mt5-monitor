# 互聯網訪問安全配置指南

VPS 公網 IP: 123.123.123.123 的安全訪問配置

## 🔓 端口配置

### 基本 HTTP 訪問（不推薦用於生產環境）

**需要開放的端口**：
- **80** (TCP) - HTTP 前端
- **8080** (TCP) - HTTP API

**防火牆配置**：
```powershell
# Windows Server 防火牆
New-NetFirewallRule -DisplayName "MT5 Monitor - HTTP" `
    -Direction Inbound -LocalPort 80 -Protocol TCP -Action Allow

New-NetFirewallRule -DisplayName "MT5 Monitor - API" `
    -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow
```

**訪問地址**：
```
前端: http://123.123.123.123
API:  http://123.123.123.123:8080/api
```

**⚠️ 安全風險**：
- ❌ 數據明文傳輸
- ❌ API_KEY 可被攔截
- ❌ 易受中間人攻擊
- ❌ 無加密保護

---

## ✅ 推薦方案：HTTPS + 反向代理

### 方案 A：使用 Cloudflare（最簡單，免費）

#### 優點
- ✅ 免費 SSL/TLS 加密
- ✅ DDoS 防護
- ✅ CDN 加速
- ✅ 隱藏真實 IP
- ✅ 自動證書管理
- ✅ 無需修改 Docker 配置

#### 步驟

**1. 註冊域名並添加到 Cloudflare**
```
1. 註冊域名（如：mt5monitor.yourdomain.com）
2. 將域名添加到 Cloudflare
3. 更新域名 NS 伺服器為 Cloudflare 提供的 NS
```

**2. 添加 DNS 記錄**
```
類型: A
名稱: mt5monitor（或 @）
內容: 123.123.123.123
代理: 啟用（橙色雲朵）✓
TTL: Auto
```

**3. SSL/TLS 設定**
```
Cloudflare 控制台 → SSL/TLS → 概述
選擇: 完整（Full）或 完整（嚴格）
```

**4. 防火牆規則**
```powershell
# 只允許 Cloudflare IP 訪問
# Cloudflare IP 範圍: https://www.cloudflare.com/ips/

# 移除公開訪問
Remove-NetFirewallRule -DisplayName "MT5 Monitor - HTTP"
Remove-NetFirewallRule -DisplayName "MT5 Monitor - API"

# 只允許 Cloudflare（示例，需完整 IP 列表）
New-NetFirewallRule -DisplayName "MT5 Monitor - Cloudflare Only" `
    -Direction Inbound `
    -LocalPort 80,8080 `
    -Protocol TCP `
    -Action Allow `
    -RemoteAddress 173.245.48.0/20,103.21.244.0/22,103.22.200.0/22
```

**5. EA 配置**
```
API_BASE_URL = https://mt5monitor.yourdomain.com/api
API_KEY = 您的API_KEY
```

**完成後**：
- ✅ 所有流量經過 HTTPS 加密
- ✅ Cloudflare 提供 DDoS 防護
- ✅ 真實 IP 被隱藏
- ✅ 無需額外證書管理

---

### 方案 B：使用 Nginx 反向代理 + Let's Encrypt SSL

#### 需要條件
- 有域名（如：mt5monitor.yourdomain.com）
- 域名指向 123.123.123.123

#### 安裝 Nginx 和 Certbot

**Windows Server 方式**：
```powershell
# 使用 Chocolatey 安裝
choco install nginx
choco install certbot
```

**或使用 Docker Nginx**（推薦）

#### 創建 Nginx 配置

**nginx-ssl.conf**:
```nginx
# HTTP 重定向到 HTTPS
server {
    listen 80;
    server_name mt5monitor.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS 主配置
server {
    listen 443 ssl http2;
    server_name mt5monitor.yourdomain.com;

    # SSL 證書
    ssl_certificate /etc/letsencrypt/live/mt5monitor.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mt5monitor.yourdomain.com/privkey.pem;

    # SSL 安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # 安全標頭
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # 前端
    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API
    location /api/ {
        proxy_pass http://localhost:8080/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # API 特殊設定
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
```

#### 獲取 SSL 證書
```bash
# 使用 Certbot
certbot certonly --standalone -d mt5monitor.yourdomain.com

# 自動續期
certbot renew --dry-run
```

#### 端口配置
```powershell
# 開放 HTTPS 端口
New-NetFirewallRule -DisplayName "HTTPS" `
    -Direction Inbound -LocalPort 443 -Protocol TCP -Action Allow

# 開放 HTTP（用於重定向）
New-NetFirewallRule -DisplayName "HTTP" `
    -Direction Inbound -LocalPort 80 -Protocol TCP -Action Allow

# 關閉直接訪問 8080
Remove-NetFirewallRule -DisplayName "MT5 Monitor - API"
```

#### EA 配置
```
API_BASE_URL = https://mt5monitor.yourdomain.com/api
API_KEY = 您的API_KEY
```

---

## 🔒 增強安全措施

### 1. IP 白名單限制

**限制特定 IP 訪問**：
```powershell
# 只允許特定 IP 訪問（例如：辦公室 IP）
New-NetFirewallRule -DisplayName "MT5 Monitor - Whitelist" `
    -Direction Inbound `
    -LocalPort 80,8080,443 `
    -Protocol TCP `
    -Action Allow `
    -RemoteAddress 1.2.3.4,5.6.7.8

# 阻止其他所有 IP
New-NetFirewallRule -DisplayName "MT5 Monitor - Block All Others" `
    -Direction Inbound `
    -LocalPort 80,8080,443 `
    -Protocol TCP `
    -Action Block
```

**在 Nginx 中限制**：
```nginx
location /api/ {
    # IP 白名單
    allow 1.2.3.4;      # 辦公室 IP
    allow 5.6.7.8;      # VPN IP
    deny all;
    
    proxy_pass http://localhost:8080/api/;
}
```

### 2. 使用 VPN 訪問（最安全）

**方案**：
1. 在 VPS 上安裝 VPN 伺服器（WireGuard/OpenVPN）
2. 只開放 VPN 端口（如 WireGuard 的 51820）
3. 通過 VPN 訪問內部服務
4. 不開放 80/8080/443 到公網

**優點**：
- ✅ 最高安全性
- ✅ 所有流量加密
- ✅ 不暴露服務端口
- ✅ 可訪問所有內部服務

**缺點**：
- ❌ 需要額外設定 VPN
- ❌ EA 需要在支援 VPN 的環境運行

### 3. 修改預設端口

**編輯 docker-compose.yml**：
```yaml
services:
  backend:
    ports:
      - "18765:8080"    # 使用非標準端口
  
  frontend:
    ports:
      - "18080:80"      # 使用非標準端口
```

**優點**：
- ✅ 避免自動掃描
- ✅ 降低被發現機率

### 4. 強化 API_KEY 策略

**在 .env 中**：
```env
# 使用超強密碼（40+ 字元）
API_KEY=xK9$mP2#vL8@nQ4!wR7^yT5&uI3*oP6(aS1)dF0+gH2-jK4=lZ8~

# 啟用嚴格速率限制
RATE_LIMIT_PER_MIN=10    # 降低到 10 次/分鐘

# 啟用認證
ENABLE_AUTH=true
```

### 5. 啟用請求日誌和監控

**添加日誌分析**：
```powershell
# 定期檢查異常訪問
docker-compose logs backend | Select-String "401\|403\|429"

# 監控 API 調用頻率
docker-compose logs backend | Select-String "heartbeat"
```

**設置告警**：
```powershell
# 檢測異常訪問並發送通知（示例腳本）
$logs = docker-compose logs backend --tail=100
if ($logs -match "401.*Unauthorized") {
    # 發送 Telegram 通知
    Write-Host "⚠️ 檢測到未授權訪問嘗試"
}
```

### 6. 定期更新和審計

```powershell
# 定期更新 Docker 映像
docker-compose pull
docker-compose up -d

# 檢查安全漏洞
docker scan mt5-monitor-backend
docker scan mt5-monitor-frontend

# 審計日誌
docker-compose logs --since 24h > audit-log.txt
```

---

## 📊 安全等級對比

| 方案 | 安全等級 | 複雜度 | 成本 | 推薦度 |
|------|---------|--------|------|--------|
| 直接 HTTP 訪問 | 🔴 低 | ⭐ 簡單 | 免費 | ❌ 不推薦 |
| Cloudflare HTTPS | 🟢 高 | ⭐⭐ 簡單 | 免費 | ✅ 強烈推薦 |
| Nginx + Let's Encrypt | 🟢 高 | ⭐⭐⭐ 中等 | 免費 | ✅ 推薦 |
| VPN 訪問 | 🟢 最高 | ⭐⭐⭐⭐ 複雜 | 低 | ✅ 最安全 |
| Cloudflare + IP 白名單 | 🟢 最高 | ⭐⭐⭐ 中等 | 免費 | ✅ 平衡方案 |

---

## 🚀 快速實施建議

### 立即可做（5 分鐘）

1. **使用強 API_KEY**
   ```powershell
   notepad C:\MT5_Monitor\.env
   # 修改 API_KEY 為 40+ 字元的隨機字串
   docker-compose restart
   ```

2. **降低速率限制**
   ```env
   RATE_LIMIT_PER_MIN=10
   ```

3. **啟用基本防火牆**
   ```powershell
   # 只開放需要的端口
   New-NetFirewallRule -DisplayName "MT5 Monitor HTTP" `
       -Direction Inbound -LocalPort 80,8080 -Protocol TCP -Action Allow
   ```

### 短期方案（1 小時）

**使用 Cloudflare**：
1. 註冊/使用現有域名
2. 添加到 Cloudflare（免費計畫）
3. 設定 DNS A 記錄指向 123.123.123.123
4. 啟用橙色雲朵（代理）
5. SSL/TLS 設為 Full
6. 更新 EA 使用 HTTPS URL

### 中期方案（半天）

**Nginx 反向代理 + SSL**：
1. 設定域名
2. 安裝 Nginx
3. 配置反向代理
4. 申請 Let's Encrypt 證書
5. 設定自動續期

### 長期方案（1-2 天）

**完整安全架構**：
1. VPN 伺服器設置
2. IP 白名單
3. 日誌監控系統
4. 自動告警
5. 定期安全審計

---

## ✅ 安全檢查清單

部署到公網前必須檢查：

### 基本安全
- [ ] API_KEY 已修改為強密碼（40+ 字元）
- [ ] ENABLE_AUTH=true
- [ ] RATE_LIMIT_PER_MIN 已設定合理值
- [ ] 已測試 API 認證功能

### 網路安全
- [ ] 使用 HTTPS（Cloudflare 或 Let's Encrypt）
- [ ] 已配置防火牆規則
- [ ] 已隱藏或修改預設端口
- [ ] 已測試加密連接

### 監控與日誌
- [ ] 已啟用訪問日誌
- [ ] 已設定異常告警
- [ ] 已配置自動備份
- [ ] 已測試 Telegram 通知

### 應急準備
- [ ] 已記錄所有訪問憑證
- [ ] 已備份 .env 配置
- [ ] 已測試備份還原
- [ ] 已準備應急聯絡方式

---

## 📞 推薦配置（平衡安全與便利）

**最佳實踐配置**：

1. **使用 Cloudflare**（免費，簡單）
   - ✅ HTTPS 加密
   - ✅ DDoS 防護
   - ✅ 隱藏真實 IP
   - ✅ 無需額外配置

2. **強化 API_KEY**
   - 使用 40+ 字元隨機密碼
   - 定期更換（每季度）

3. **IP 白名單**（在 Cloudflare 中）
   - 限制已知 EA 所在網路
   - 阻止其他地區訪問

4. **監控告警**
   - Telegram 異常通知
   - 每日訪問報告

**訪問配置**：
```
域名: https://mt5monitor.yourdomain.com
API:  https://mt5monitor.yourdomain.com/api
EA WebRequest: https://mt5monitor.yourdomain.com/api
```

**安全等級**: 🟢 高（適合生產環境）

---

## ⚠️ 最後警告

**絕對不要**：
- ❌ 使用弱 API_KEY
- ❌ 在 HTTP 下暴露到公網
- ❌ 在程式碼中寫死 API_KEY
- ❌ 共享 API_KEY
- ❌ 忽略安全更新
- ❌ 不設置監控和備份

**如果只能做一件事**：
➡️ **使用 Cloudflare + HTTPS**（免費且有效）

---

需要協助設定？參考對應章節的詳細步驟！
