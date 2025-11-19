# MT4/MT5 Monitor Client

MT4/MT5 Expert Advisor (EA) 客户端，用于向中央监控系统上报心跳和交易统计。

## 📁 文件说明

- `MT5_Monitor_Client.mq5` - MT5 版本
- `MT5_Monitor_Client.mq4` - MT4 版本

两个版本功能完全相同，根据你的交易平台选择对应版本。

## 🚀 安装步骤

### MT4 安装

1. **复制文件**
   ```
   复制 MT5_Monitor_Client.mq4 到:
   C:\Users\<你的用户名>\AppData\Roaming\MetaQuotes\Terminal\<终端ID>\MQL4\Experts\
   ```

2. **在 MetaEditor 中编译**
   - 打开 MetaEditor (F4)
   - 找到并打开 `MT5_Monitor_Client.mq4`
   - 点击「编译」(F7)
   - 确认无错误

3. **设置 WebRequest 白名单**
   - 工具 → 选项 → 专家顾问
   - 勾选「允许 WebRequest 使用列出的 URL」
   - 添加你的服务器 URL，例如:
     ```
     http://localhost:8080/api
     http://192.168.1.100:8080/api
     http://your-domain.com:8080/api
     ```

4. **附加到图表**
   - 在导航器中找到 `MT5_Monitor_Client`
   - 拖放到任意图表
   - 配置参数（见下方）
   - 勾选「允许即时自动交易」
   - 点击「确定」

### MT5 安装

1. **复制文件**
   ```
   复制 MT5_Monitor_Client.mq5 到:
   C:\Program Files\<你的MT5目录>\MQL5\Experts\
   ```

2. **后续步骤与 MT4 相同**

## ⚙️ 参数配置

### 基础配置

| 参数 | 说明 | 默认值 | 示例 |
|------|------|--------|------|
| `API_BASE_URL` | API 服务器地址 | `http://localhost:8080/api` | `http://192.168.1.100:8080/api` |
| `API_KEY` | API 验证密钥 | `your_secret_api_key_here` | 与服务器 .env 中的 API_KEY 一致 |
| `NodeID` | 节点唯一识别码 | `MT5_NODE_01` | `LIVE_ACCOUNT_12345` |
| `EAName` | 显示名称 | `MT5 EA Monitor` | `黄金EA-主账户` |

### 账户信息（可选）

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `Broker` | 经纪商名称 | 空（自动检测） |
| `Account` | 账号 | 空（自动检测） |

留空时会自动从 MT4/MT5 读取。

### 时间设置

| 参数 | 说明 | 默认值 | 范围 |
|------|------|--------|------|
| `HeartbeatIntervalMinutes` | 心跳间隔（分钟） | `15` | 1-60 |
| `StatsReportHour` | 统计上报时间-小时 | `23` | 0-23 |
| `StatsReportMinute` | 统计上报时间-分钟 | `59` | 0-59 |

### 调试

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `EnableDebugLog` | 启用详细日志 | `true` | true/false |

## 📊 统计说明

EA 会在每天指定时间（默认 23:59）上报以下统计数据：

### profit_loss (盈亏)
当日所有已平仓订单的盈亏总和（包含手续费）

### interest (利息)
当日所有订单的隔夜利息（Swap）总和

### avg_lots_success (胜率)
**定义**: 盈利订单数 ÷ 总订单数
- 范围: 0.0 ~ 1.0
- 例如: 0.65 表示 65% 胜率

### lots_traded (交易手数)
当日所有交易的手数总和（多单 + 空单）

### ab_lots_diff (多空手数差)
**定义**: 多单手数 - 空单手数
- 正数: 多单较多
- 负数: 空单较多
- 零: 多空平衡

## 📝 配置示例

### 示例 1: 本地测试环境

```
API_BASE_URL = http://localhost:8080/api
API_KEY = test_key_123456
NodeID = TEST_NODE_01
EAName = 测试节点
HeartbeatIntervalMinutes = 5
StatsReportHour = 23
StatsReportMinute = 55
EnableDebugLog = true
```

### 示例 2: 生产环境

```
API_BASE_URL = http://192.168.1.100:8080/api
API_KEY = prod_super_secret_key_xyz789
NodeID = LIVE_XAU_EA_01
EAName = 黄金交易EA-主账户
Broker = XM Global
Account = 12345678
HeartbeatIntervalMinutes = 15
StatsReportHour = 23
StatsReportMinute = 59
EnableDebugLog = false
```

### 示例 3: 多节点部署

**节点 1 (黄金EA)**:
```
NodeID = GOLD_EA_MAIN
EAName = 黄金EA-主策略
```

**节点 2 (欧美EA)**:
```
NodeID = EURUSD_EA_SCALP
EAName = 欧美超短线EA
```

**节点 3 (网格EA)**:
```
NodeID = GRID_EA_XAUUSD
EAName = 黄金网格EA
```

## 🔍 日志查看

### 正常运行日志

```
MT5 Monitor Client initialized
Node ID: MT5_NODE_01
API URL: http://localhost:8080/api
Heartbeat interval: 15 minutes
Stats report time: 23:59
IMPORTANT: Add this URL to Tools -> Options -> Expert Advisors -> Allow WebRequest for listed URL:
  http://localhost:8080/api
Heartbeat sent successfully at 2025-01-01 12:00:00
Heartbeat sent successfully at 2025-01-01 12:15:00
Daily stats sent: P/L=123.45 Interest=2.30 WinRate=65.5% Lots=10.50
```

### 错误日志示例

**WebRequest 未授权**:
```
ERROR: Heartbeat request failed (attempt 1/3)
  HTTP Code: -1
  Error Code: 4060
  URL: http://localhost:8080/api/heartbeat
  WebRequest not allowed for this URL!
  Add URL to: Tools -> Options -> Expert Advisors -> Allow WebRequest
```

**API Key 错误**:
```
ERROR: Heartbeat request failed (attempt 1/3)
  HTTP Code: 401
  Error Code: 0
  URL: http://localhost:8080/api/heartbeat
```

**网络连接问题**:
```
ERROR: Heartbeat request failed (attempt 1/3)
  HTTP Code: -1
  Error Code: 4014
  URL: http://localhost:8080/api/heartbeat
```

## 🐛 故障排除

### 问题 1: "WebRequest not allowed"

**原因**: 未将 URL 添加到白名单

**解决方案**:
1. 工具 → 选项 → 专家顾问
2. 勾选「允许 WebRequest」
3. 添加完整 URL（包含 `http://` 和端口）
4. 重启 MT4/MT5

### 问题 2: HTTP Code 401 (未授权)

**原因**: API_KEY 不正确

**解决方案**:
1. 检查 EA 参数中的 API_KEY
2. 确认与服务器 .env 文件中的 API_KEY 一致
3. 重新附加 EA

### 问题 3: HTTP Code -1 (连接失败)

**原因**: 无法连接到服务器

**解决方案**:
1. 检查服务器是否运行: 访问 `http://your-server:8080/health`
2. 检查防火墙设置
3. ping 服务器 IP
4. 确认 API_BASE_URL 正确

### 问题 4: 节点在监控页面显示离线

**原因**: 心跳请求失败或超过 5 分钟

**解决方案**:
1. 检查 EA 是否运行（图表上有笑脸图标）
2. 查看专家日志是否有错误
3. 确认 HeartbeatIntervalMinutes < 5
4. 测试网络连接

### 问题 5: 统计数据未更新

**原因**: 统计上报时间未到或请求失败

**解决方案**:
1. 确认当前时间已过 StatsReportHour:StatsReportMinute
2. 等待到第二天的上报时间
3. 检查日志中的 "Daily stats sent" 消息
4. 手动测试统计 API

## 🧪 手动测试

### 测试心跳 (PowerShell)

```powershell
$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer your_api_key_here"
}

$body = @{
    id = "TEST_NODE"
    name = "Test Node"
    broker = "Test Broker"
    account = "12345678"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8080/api/heartbeat" -Method POST -Headers $headers -Body $body
```

### 测试统计上报

```powershell
$body = @{
    id = "TEST_NODE"
    date = (Get-Date -Format "yyyy-MM-dd")
    profit_loss = 100.50
    interest = 2.30
    avg_lots_success = 0.65
    lots_traded = 10.0
    ab_lots_diff = 2.5
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8080/api/stats" -Method POST -Headers $headers -Body $body
```

## 📈 性能建议

### 心跳间隔

- **推荐**: 10-15 分钟
- **最小**: 5 分钟（避免频繁请求）
- **最大**: 30 分钟（避免被标记为离线）

> 注意: 服务器默认 5 分钟无心跳即标记为离线

### 统计上报时间

- **推荐**: 23:59（当天结束前）
- **备选**: 00:05（新一天开始后，确保所有订单已结算）

### 日志设置

- **开发/测试**: `EnableDebugLog = true`
- **生产环境**: `EnableDebugLog = false`（减少日志量）

## 🔒 安全建议

1. **保护 API Key**
   - 使用强密码
   - 不要在公开场合分享
   - 定期更换

2. **使用 HTTPS**
   - 生产环境建议使用 HTTPS
   - 配合 SSL 证书保护数据传输

3. **限制访问**
   - 使用防火墙限制 API 访问
   - 只允许特定 IP 访问

4. **定期检查**
   - 监控异常活动
   - 检查日志中的错误

## 📞 支持

如有问题:
1. 检查专家日志
2. 参考主文档 README.md
3. 查看服务器日志: `docker-compose logs backend`
4. 测试 API 连接性

## 🔄 更新日志

### v1.0.0 (2025-01-01)
- ✅ 初始版本
- ✅ 支持心跳上报
- ✅ 支持统计上报
- ✅ HTTP 重试机制
- ✅ 完整错误处理
- ✅ MT4 和 MT5 双版本支持
