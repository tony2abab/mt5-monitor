# Cloudflare 免費 HTTPS 配置指南

最簡單、免費且安全的公網訪問方案 - 10 分鐘完成設定

## 為什麼選擇 Cloudflare？

- ✅ **完全免費**（免費計畫已足夠）
- ✅ **自動 HTTPS/SSL**（無需管理證書）
- ✅ **DDoS 防護**（免費防護）
- ✅ **CDN 加速**（全球節點）
- ✅ **隱藏真實 IP**（安全性提升）
- ✅ **零程式碼修改**（無需改 Docker 配置）
- ✅ **簡單易用**（圖形化介面）

---

## 📋 前置條件

### 需要準備
1. **域名**（必須）
   - 已有域名：可以直接使用
   - 沒有域名：需要購買（約 $10-15/年）
   - 推薦：Namecheap, GoDaddy, 阿里雲等

2. **VPS 資訊**
   - 公網 IP：`123.123.123.123`（您的實際 IP）
   - 系統已部署 MT5 Monitor
   - 端口 80 和 8080 已開放

---

## 🚀 10 分鐘快速設定

### 步驟 1: 註冊 Cloudflare 帳號

1. 訪問：https://dash.cloudflare.com/sign-up
2. 使用郵箱註冊（免費）
3. 驗證郵箱

**完成時間**: 2 分鐘

---

### 步驟 2: 添加網站到 Cloudflare

1. 登入 Cloudflare 控制台
2. 點擊 **「Add a Site」**
3. 輸入您的域名（例如：`yourdomain.com`）
4. 選擇 **「Free」** 計畫
5. 點擊 **「Continue」**

**完成時間**: 1 分鐘

---

### 步驟 3: 配置 DNS 記錄

Cloudflare 會掃描您現有的 DNS 記錄。

**添加/修改 A 記錄**：

```
類型: A
名稱: mt5monitor（或您想要的子域名）
IPv4 地址: 123.123.123.123
代理狀態: 已代理（橙色雲朵）☁️ ← 重要！
TTL: Auto
```

**示例配置**：
| 類型 | 名稱 | 內容 | 代理狀態 | TTL |
|------|------|------|---------|-----|
| A | mt5monitor | 123.123.123.123 | ☁️ 已代理 | Auto |

**完成時間**: 2 分鐘

---

### 步驟 4: 更改域名 NS 伺服器

Cloudflare 會提供兩個 Nameserver（名稱伺服器）：

```
示例：
ada.ns.cloudflare.com
neil.ns.cloudflare.com
```

**操作步驟**：

1. 前往您的**域名註冊商**網站（Namecheap、GoDaddy 等）
2. 找到域名管理 → Nameservers
3. 將現有 NS 改為 Cloudflare 提供的兩個 NS
4. 儲存變更

**完成時間**: 3 分鐘

**⏰ 等待時間**: DNS 傳播需要 5 分鐘 - 24 小時（通常 10 分鐘內）

---

### 步驟 5: 配置 SSL/TLS

1. 在 Cloudflare 控制台，點擊您的網站
2. 左側選單 → **SSL/TLS**
3. **加密模式** 選擇：**Full** 或 **Full (Strict)**
   - **Full**: 適用於自簽證書或 HTTP（推薦）
   - **Full (Strict)**: 需要有效的源伺服器證書

**推薦設定**: `Full`

4. 往下滾動，確認：
   - ✅ **Always Use HTTPS**: ON（自動重定向到 HTTPS）
   - ✅ **Automatic HTTPS Rewrites**: ON
   - ✅ **Minimum TLS Version**: TLS 1.2

**完成時間**: 2 分鐘

---

### 步驟 6: 測試訪問

**等待 DNS 生效後**（5-30 分鐘）：

1. **測試前端**：
   ```
   https://mt5monitor.yourdomain.com
   ```
   應該看到監控頁面，地址欄顯示 🔒

2. **測試 API**：
   ```
   https://mt5monitor.yourdomain.com/api/nodes
   ```
   應該返回 JSON 數據

3. **檢查 SSL**：
   點擊地址欄的 🔒，查看證書資訊
   - 應顯示 Cloudflare 證書
   - 有效期正常

**完成時間**: 2 分鐘

---

## 🔧 配置 MT4/MT5 EA

### 更新 EA 參數

在 MT4/MT5 EA 設定中修改：

**舊配置**（HTTP）：
```
API_BASE_URL = http://123.123.123.123:8080/api
```

**新配置**（HTTPS）：
```
API_BASE_URL = https://mt5monitor.yourdomain.com/api
```

**重要**：
- ✅ 使用 `https://`（不是 `http://`）
- ✅ 使用域名（不是 IP）
- ✅ 包含 `/api` 路徑
- ✅ **不需要** 端口號（Cloudflare 會自動處理）

### 更新 WebRequest 白名單

在 MT4/MT5 中：
1. **工具** → **選項** → **專家顧問**
2. ✅ 勾選「允許 WebRequest」
3. 添加 URL：
   ```
   https://mt5monitor.yourdomain.com/api
   ```
4. 移除舊的 HTTP URL

### 重新編譯並測試 EA

1. 在 MetaEditor 中按 **F7** 編譯
2. 重新運行 EA
3. 檢查日誌：
   ```
   Heartbeat sent successfully
   ```

---

## 🔒 進階安全設定（可選）

### 1. IP 訪問規則（推薦）

**限制只有您的 MT4/MT5 所在網路可訪問 API**：

1. Cloudflare 控制台 → **Security** → **WAF**
2. 點擊 **Create firewall rule**
3. 規則配置：

**規則名稱**: `Block Non-EA Access to API`

**條件**：
```
(http.request.uri.path contains "/api/heartbeat" and 
 not ip.src in {1.2.3.4 5.6.7.8})
```
將 `1.2.3.4` `5.6.7.8` 改為您 EA 所在網路的公網 IP

**動作**: `Block`

4. 儲存規則

### 2. Rate Limiting（防止暴力破解）

1. Cloudflare 控制台 → **Security** → **WAF**
2. **Rate limiting rules** → **Create rule**

**規則配置**：
```
名稱: API Rate Limit
條件: (http.request.uri.path contains "/api/")
速率: 100 requests per 10 minutes
動作: Block
持續時間: 1 hour
```

### 3. 啟用 Bot 保護

1. Cloudflare 控制台 → **Security** → **Bots**
2. 將 **Bot Fight Mode** 設為 **ON**（免費計畫）
3. 可選擇：
   - ✅ JavaScript Detections
   - ✅ Verified Bots（允許 Google、Bing 等）

### 4. 隱藏真實 IP（重要）

**確保 DNS 記錄都是「已代理」狀態**（橙色雲朵 ☁️）

**檢查 IP 是否洩露**：
```powershell
# 在 VPS 上檢查
nslookup mt5monitor.yourdomain.com
```
應該返回 Cloudflare 的 IP，**不是** 123.123.123.123

**如果洩露**：
1. 檢查 DNS 記錄是否「已代理」
2. 檢查是否有其他子域名暴露了真實 IP
3. 考慮在 VPS 防火牆只允許 Cloudflare IP

### 5. 只允許 Cloudflare IP 訪問 VPS（最高安全）

**防止繞過 Cloudflare 直接攻擊源伺服器**：

```powershell
# 移除現有公開規則
Remove-NetFirewallRule -DisplayName "MT5 Monitor - HTTP"
Remove-NetFirewallRule -DisplayName "MT5 Monitor - API"

# 只允許 Cloudflare IP（需完整列表）
# Cloudflare IP 列表: https://www.cloudflare.com/ips/

# IPv4 範圍（示例，需要完整列表）
$cloudflareIPs = @(
    "173.245.48.0/20",
    "103.21.244.0/22",
    "103.22.200.0/22",
    "103.31.4.0/22",
    "141.101.64.0/18",
    "108.162.192.0/18",
    "190.93.240.0/20",
    "188.114.96.0/20",
    "197.234.240.0/22",
    "198.41.128.0/17",
    "162.158.0.0/15",
    "104.16.0.0/13",
    "104.24.0.0/14",
    "172.64.0.0/13",
    "131.0.72.0/22"
)

New-NetFirewallRule -DisplayName "MT5 Monitor - Cloudflare Only" `
    -Direction Inbound `
    -LocalPort 80,8080 `
    -Protocol TCP `
    -Action Allow `
    -RemoteAddress $cloudflareIPs
```

---

## 📊 驗證 HTTPS 工作正常

### 檢查清單

在瀏覽器中訪問 `https://mt5monitor.yourdomain.com`：

- [ ] 地址欄顯示 🔒 鎖頭圖示
- [ ] 沒有「不安全」警告
- [ ] 監控頁面正常載入
- [ ] 點擊 🔒 查看證書，顯示 Cloudflare
- [ ] 訪問 `/api/nodes` 返回 JSON 數據
- [ ] HTTP 自動重定向到 HTTPS

### 測試工具

**SSL 測試**：
```
https://www.ssllabs.com/ssltest/analyze.html?d=mt5monitor.yourdomain.com
```
目標評級：**A** 或 **A+**

**DNS 傳播檢查**：
```
https://www.whatsmydns.net/#A/mt5monitor.yourdomain.com
```
應該全球各地都解析到 Cloudflare IP

---

## 🎯 完整配置示例

### Cloudflare DNS 設定
```
類型: A
名稱: mt5monitor
內容: 123.123.123.123
代理: ☁️ 已代理
TTL: Auto
```

### EA 配置
```
API_BASE_URL = https://mt5monitor.yourdomain.com/api
API_KEY = your_super_secret_key_here
NodeID = SERVER01_LIVE
EAName = 生產伺服器
```

### MT4/MT5 WebRequest 白名單
```
https://mt5monitor.yourdomain.com/api
```

### 訪問地址
```
前端: https://mt5monitor.yourdomain.com
API:  https://mt5monitor.yourdomain.com/api
健康: https://mt5monitor.yourdomain.com/api/../health
```

---

## 🔧 故障排除

### 問題 1: 訪問域名顯示 522 錯誤

**原因**: Cloudflare 無法連接到源伺服器

**解決方案**：
```powershell
# 1. 檢查 VPS 防火牆是否開放 80/8080
Get-NetFirewallRule -DisplayName "*MT5*"

# 2. 檢查 Docker 容器是否運行
docker-compose ps

# 3. 檢查本地訪問是否正常
Invoke-WebRequest http://localhost:8080/health
```

### 問題 2: SSL 證書錯誤

**解決方案**：
1. Cloudflare → SSL/TLS → 確認模式為 **Full**
2. 清除瀏覽器快取
3. 等待幾分鐘讓 SSL 生效

### 問題 3: EA 無法連接

**檢查**：
```
1. EA 是否使用 https:// 而不是 http://
2. WebRequest 白名單是否包含 HTTPS URL
3. API_KEY 是否正確
4. 域名是否已生效（nslookup）
```

**測試命令**：
```powershell
# 在 EA 所在機器測試
Invoke-WebRequest https://mt5monitor.yourdomain.com/api/nodes
```

### 問題 4: DNS 未生效

**檢查**：
```powershell
nslookup mt5monitor.yourdomain.com
```

**解決方案**：
- 等待 DNS 傳播（最多 24 小時）
- 檢查域名 NS 是否已正確指向 Cloudflare
- 清除本地 DNS 快取：`ipconfig /flushdns`

### 問題 5: 訪問很慢

**優化**：
1. Cloudflare → Speed → Optimization
2. 啟用：
   - ✅ Auto Minify (JavaScript, CSS, HTML)
   - ✅ Brotli
   - ✅ Rocket Loader（如前端允許）

---

## 💰 成本分析

### Cloudflare 方案對比

| 功能 | Free（免費） | Pro ($20/月) | Business ($200/月) |
|------|-------------|--------------|-------------------|
| HTTPS/SSL | ✅ | ✅ | ✅ |
| DDoS 防護 | ✅ 基本 | ✅ 進階 | ✅ 進階 |
| CDN | ✅ | ✅ | ✅ |
| WAF 規則 | 5 條 | 20 條 | 100 條 |
| Page Rules | 3 條 | 20 條 | 50 條 |
| 適合場景 | ✅ 個人/小型 | 中型 | 大型企業 |

**推薦**: **Free 計畫已完全足夠**用於 MT5 Monitor

### 域名成本
- 約 $10-15/年（.com/.net）
- 一次性投資，長期受益

**總成本**: $10-15/年（僅域名費用）

---

## ✅ 配置檢查清單

完成配置後確認：

### Cloudflare 設定
- [ ] 網站已添加到 Cloudflare
- [ ] DNS A 記錄已設定並「已代理」（橙色雲朵）
- [ ] 域名 NS 已指向 Cloudflare
- [ ] SSL/TLS 模式設為 Full
- [ ] Always Use HTTPS 已啟用
- [ ] DNS 已全球生效

### 訪問測試
- [ ] HTTPS 前端可訪問（有 🔒）
- [ ] HTTPS API 可訪問
- [ ] HTTP 自動重定向到 HTTPS
- [ ] SSL Labs 測試評級 A/A+

### EA 配置
- [ ] EA 使用 HTTPS URL
- [ ] WebRequest 白名單已更新
- [ ] EA 成功發送心跳
- [ ] 監控頁面顯示節點

### 安全加固（可選）
- [ ] 已設定 IP 訪問規則
- [ ] 已啟用 Rate Limiting
- [ ] 已啟用 Bot 保護
- [ ] VPS 只允許 Cloudflare IP

---

## 🎉 完成！

恭喜！您現在擁有：
- ✅ 完全加密的 HTTPS 連接
- ✅ 免費 DDoS 防護
- ✅ 隱藏的真實 IP
- ✅ CDN 加速
- ✅ 自動證書管理

**訪問地址**：
```
https://mt5monitor.yourdomain.com
```

**享受安全的監控體驗！** 🚀🔒
