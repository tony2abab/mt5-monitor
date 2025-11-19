# Windows Docker 部署完整指南

从零开始在 Windows 上使用 Docker 部署 MT5 Monitor 系统。

## 📋 前置准备检查清单

在开始之前，确保你有：
- ✅ Windows 10/11 64位专业版、企业版或教育版
- ✅ 至少 4GB RAM
- ✅ 至少 20GB 可用硬盘空间
- ✅ 稳定的网络连接
- ✅ 管理员权限

---

## 第一步：安装 Docker Desktop

### 1.1 下载 Docker Desktop

1. 打开浏览器
2. 访问: https://www.docker.com/products/docker-desktop
3. 点击 **"Download for Windows"** 按钮
4. 等待下载完成（约 500MB）

### 1.2 安装 Docker Desktop

1. **找到下载的安装文件**
   - 通常在 `C:\Users\你的用户名\Downloads\Docker Desktop Installer.exe`
   - 双击运行

2. **安装向导**
   - 看到 "Configuration" 画面时
   - ✅ 勾选 "Use WSL 2 instead of Hyper-V"（推荐）
   - ✅ 勾选 "Add shortcut to desktop"
   - 点击 **"Ok"**

3. **等待安装**
   - 安装过程约 5-10 分钟
   - 会看到进度条

4. **完成安装**
   - 点击 **"Close and restart"**
   - 电脑会重新启动

### 1.3 启动 Docker Desktop

1. **电脑重启后，启动 Docker**
   - 双击桌面上的 "Docker Desktop" 图标
   - 或从开始菜单搜索 "Docker Desktop"

2. **接受服务条款**
   - 第一次启动会看到服务条款
   - 勾选 "I accept the terms"
   - 点击 **"Accept"**

3. **跳过登录（可选）**
   - 看到登录画面时
   - 点击右上角的 **"Skip"** 或 **"Continue without signing in"**

4. **等待 Docker 启动**
   - 看到托盘图标（右下角）的鲸鱼图标不再闪烁
   - 图标变成静止状态表示启动完成
   - 通常需要 1-2 分钟

### 1.4 验证 Docker 安装

1. **打开 PowerShell**
   - 按 `Win + X` 键
   - 选择 **"Windows PowerShell"** 或 **"终端"**

2. **检查 Docker 版本**
   ```powershell
   docker --version
   ```
   
   应该看到类似输出：
   ```
   Docker version 24.0.7, build afdd53b
   ```

3. **检查 Docker Compose**
   ```powershell
   docker-compose --version
   ```
   
   应该看到类似输出：
   ```
   Docker Compose version v2.23.0
   ```

✅ 如果看到版本号，表示 Docker 安装成功！

---

## 第二步：准备项目文件

### 2.1 确认项目位置

1. **打开文件资源管理器**
   - 按 `Win + E` 键

2. **导航到项目文件夹**
   - 在地址栏输入：
     ```
     C:\Users\tt\CascadeProjects\MT5_Monitor
     ```
   - 按 Enter

3. **确认文件存在**
   - 你应该看到以下文件夹和文件：
     ```
     📁 backend
     📁 frontend
     📁 mql
     📄 docker-compose.yml
     📄 .env.example
     📄 README.md
     ```

### 2.2 创建环境变量文件

1. **复制 .env.example 文件**
   - 在文件资源管理器中
   - 右键点击 `.env.example`
   - 选择 **"复制"**
   - 在空白处右键
   - 选择 **"粘贴"**
   - 会创建一个 `.env.example - 副本`

2. **重命名为 .env**
   - 右键点击 `.env.example - 副本`
   - 选择 **"重命名"**
   - 改名为 `.env`（注意：只有 .env，前面有个点）
   - 如果看到警告，点击 **"是"**

3. **编辑 .env 文件**
   - 右键点击 `.env`
   - 选择 **"打开方式"** → **"记事本"**
   
   修改以下内容：
   ```env
   # 必须修改 - 设置一个强密码（至少20个字符）
   API_KEY=my_super_secret_key_2025_change_this_now
   
   # 可选 - Telegram 通知（暂时可以不填）
   TELEGRAM_BOT_TOKEN=
   TELEGRAM_CHAT_ID=
   
   # 其他保持默认即可
   PORT=8080
   HEARTBEAT_TIMEOUT_SECONDS=300
   NOTIFY_ON_RECOVERY=true
   RATE_LIMIT_PER_MIN=60
   CORS_ORIGIN=*
   NODE_ENV=production
   ENABLE_AUTH=true
   ```

4. **保存文件**
   - 按 `Ctrl + S` 保存
   - 关闭记事本

---

## 第三步：启动 Docker 服务

### 3.1 打开 PowerShell（在项目目录）

1. **在文件资源管理器中**
   - 确保你在 `C:\Users\tt\CascadeProjects\MT5_Monitor` 文件夹
   - 在地址栏点击
   - 输入 `powershell`
   - 按 Enter
   
   这会在当前目录打开 PowerShell

2. **验证路径**
   ```powershell
   pwd
   ```
   
   应该显示：
   ```
   Path
   ----
   C:\Users\tt\CascadeProjects\MT5_Monitor
   ```

### 3.2 启动服务

1. **运行 Docker Compose 命令**
   ```powershell
   docker-compose up -d
   ```

2. **首次运行会看到以下过程**
   ```
   [+] Building 45.2s (23/23) FINISHED
   [+] Running 3/3
    ✔ Network mt5_monitor_mt5-network  Created    0.1s
    ✔ Container mt5-monitor-backend    Started    1.2s
    ✔ Container mt5-monitor-frontend   Started    1.5s
   ```
   
   - 首次运行会下载镜像和构建，需要 **5-10 分钟**
   - 后续启动只需要几秒钟

3. **等待完成**
   - 看到 "Started" 表示启动成功
   - 绿色 ✔ 符号表示正常

### 3.3 检查服务状态

```powershell
docker-compose ps
```

应该看到：
```
NAME                      STATUS              PORTS
mt5-monitor-backend       Up 30 seconds       0.0.0.0:8080->8080/tcp
mt5-monitor-frontend      Up 28 seconds       0.0.0.0:80->80/tcp
```

**状态说明**：
- ✅ `Up` = 运行中（正常）
- ❌ `Exit` = 已退出（有问题）

---

## 第四步：验证系统运行

### 4.1 测试后端 API

1. **打开浏览器**
   - Chrome、Edge 或 Firefox 都可以

2. **访问健康检查端点**
   - 在地址栏输入：
     ```
     http://localhost:8080/health
     ```
   - 按 Enter

3. **应该看到**
   ```json
   {
     "ok": true,
     "status": "healthy",
     "timestamp": "2025-01-10T12:34:56.789Z"
   }
   ```

✅ 看到 `"ok": true` 表示后端正常运行！

### 4.2 打开前端监控页面

1. **在浏览器新标签页**
   - 输入：
     ```
     http://localhost
     ```
   - 或者：
     ```
     http://localhost:80
     ```

2. **应该看到**
   - 深色主题的监控页面
   - 标题："MT5 Trading Monitor"
   - 显示："尚无节点资料"（这是正常的，因为还没有 EA 连接）

✅ 能看到页面表示前端正常运行！

### 4.3 运行测试脚本（可选）

1. **在 PowerShell 中运行**
   ```powershell
   .\test-api.ps1
   ```

2. **应该看到所有测试通过**
   ```
   [Test 1] Health Check...
   ✓ Server is healthy
   
   [Test 2] Sending Heartbeat...
   ✓ Heartbeat sent successfully
   
   [Test 3] Sending Daily Stats...
   ✓ Stats sent successfully
   
   [Test 4] Getting All Nodes...
   ✓ Retrieved 1 nodes
   
   [Test 5] Getting Single Node...
   ✓ Retrieved node details
   ```

3. **刷新浏览器**
   - 回到 http://localhost
   - 按 F5 刷新
   - 现在应该会看到一个测试节点！

---

## 第五步：连接 MT4/MT5 EA

### 5.1 准备 EA 文件

1. **找到 EA 文件**
   - 回到文件资源管理器
   - 导航到：
     ```
     C:\Users\tt\CascadeProjects\MT5_Monitor\mql
     ```
   - 选择对应版本：
     - MT4 用户：`MT5_Monitor_Client.mq4`
     - MT5 用户：`MT5_Monitor_Client.mq5`

2. **复制到 MT4/MT5 目录**
   
   **对于 MT4**：
   - 在 MT4 中：文件 → 打开数据文件夹
   - 导航到：`MQL4\Experts\`
   - 粘贴 `MT5_Monitor_Client.mq4`
   
   **对于 MT5**：
   - 在 MT5 中：文件 → 打开数据文件夹
   - 导航到：`MQL5\Experts\`
   - 粘贴 `MT5_Monitor_Client.mq5`

### 5.2 设置 WebRequest 白名单

1. **在 MT4/MT5 中**
   - 工具 → 选项
   - 点击 "专家顾问" 标签

2. **启用 WebRequest**
   - ✅ 勾选 "允许 WebRequest 使用列出的 URL"
   - 在下方文本框添加：
     ```
     http://localhost:8080/api
     ```
   - 如果服务器在其他电脑，改为：
     ```
     http://192.168.1.100:8080/api
     ```
     （替换为实际 IP）

3. **点击 "确定"**

### 5.3 编译 EA

1. **打开 MetaEditor**
   - 在 MT4/MT5 中按 F4
   - 或点击工具栏的 MetaEditor 图标

2. **找到 EA 文件**
   - 导航器 → Experts
   - 双击 `MT5_Monitor_Client`

3. **编译**
   - 点击工具栏的 "编译" 按钮
   - 或按 F7
   - 看到 "0 errors, 0 warnings" 表示成功

### 5.4 附加 EA 到图表

1. **回到 MT4/MT5 主窗口**

2. **打开导航器**
   - 按 Ctrl + N
   - 或 查看 → 导航器

3. **附加 EA**
   - 导航器 → 专家顾问 → MT5_Monitor_Client
   - 拖动到任意图表（例如 EURUSD M15）

4. **配置参数**
   
   在弹出的窗口中，"输入参数" 标签：
   
   ```
   API_BASE_URL = http://localhost:8080/api
   API_KEY = my_super_secret_key_2025_change_this_now
   NodeID = MT5_LIVE_ACCOUNT_01
   EAName = 我的交易EA-主账户
   HeartbeatIntervalMinutes = 15
   StatsReportHour = 23
   StatsReportMinute = 59
   EnableDebugLog = true
   ```
   
   **重要**：
   - `API_KEY` 必须与 `.env` 文件中的完全一致
   - `NodeID` 每个 EA 必须唯一

5. **启用自动交易**
   - "常规" 标签
   - ✅ 勾选 "允许即时自动交易"
   - ✅ 勾选 "允许 DLL 导入"（如果有）

6. **点击 "确定"**

### 5.5 验证 EA 运行

1. **检查图表**
   - 图表右上角应该有一个笑脸 😊 图标
   - 如果是 ❌ 或 😔，表示有问题

2. **查看日志**
   - 工具箱 → 专家 标签
   - 应该看到：
     ```
     MT5 Monitor Client initialized
     Node ID: MT5_LIVE_ACCOUNT_01
     Heartbeat sent successfully at 2025-01-10 12:34:56
     ```

3. **检查前端**
   - 回到浏览器 http://localhost
   - 按 F5 刷新
   - 应该看到你的节点出现了！
   - 状态显示为绿色（在线）

---

## 🎉 完成！

恭喜！你已经成功部署了 MT5 Monitor 系统！

### 现在你可以：

✅ 在浏览器查看所有节点状态
✅ 监控当日交易统计
✅ 接收 Telegram 通知（如果已配置）
✅ 添加更多节点（重复步骤五，使用不同的 NodeID）

---

## 📱 下一步：设置 Telegram 通知

如果你想接收离线通知，按照以下步骤：

### 1. 创建 Telegram Bot

1. 在 Telegram 搜索：`@BotFather`
2. 发送：`/newbot`
3. 跟随指示设置名称
4. 记下 Bot Token：`1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`

### 2. 获取 Chat ID

1. 搜索并启动你的 bot
2. 发送任意消息
3. 在浏览器访问（替换你的token）：
   ```
   https://api.telegram.org/bot你的BOT_TOKEN/getUpdates
   ```
4. 找到 `"chat":{"id":123456789}`

### 3. 更新配置

1. 停止服务：
   ```powershell
   docker-compose down
   ```

2. 编辑 `.env`：
   ```env
   TELEGRAM_BOT_TOKEN=你的BOT_TOKEN
   TELEGRAM_CHAT_ID=你的CHAT_ID
   NOTIFY_ON_RECOVERY=true
   ```

3. 重新启动：
   ```powershell
   docker-compose up -d
   ```

---

## 🛠️ 常用命令

### 查看日志
```powershell
# 查看所有日志
docker-compose logs -f

# 只看后端
docker-compose logs -f backend

# 只看前端
docker-compose logs -f frontend
```

### 重启服务
```powershell
docker-compose restart
```

### 停止服务
```powershell
docker-compose down
```

### 重新构建
```powershell
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### 查看运行状态
```powershell
docker-compose ps
```

---

## ❓ 遇到问题？

### 问题 1: Docker Desktop 无法启动

**解决方案**：
1. 确认 Windows 版本（专业版/企业版/教育版）
2. 启用虚拟化（BIOS 设置）
3. 启用 Hyper-V 或 WSL 2
4. 重启电脑

### 问题 2: 端口被占用

**错误信息**：`port is already allocated`

**解决方案**：
1. 找出占用端口的程序：
   ```powershell
   netstat -ano | findstr :80
   netstat -ano | findstr :8080
   ```
2. 修改 `docker-compose.yml` 改用其他端口
3. 或关闭占用端口的程序

### 问题 3: EA 显示 "WebRequest not allowed"

**解决方案**：
1. 检查是否添加到白名单
2. 重启 MT4/MT5
3. 确认 URL 格式正确

### 问题 4: 节点显示离线

**检查清单**：
- [ ] EA 正在运行（笑脸图标）
- [ ] API_KEY 正确
- [ ] 网络连接正常
- [ ] 后端服务运行中
- [ ] 查看 MT4/MT5 日志

---

## 📞 获取帮助

1. 查看完整文档：`README.md`
2. 查看日志排查问题
3. 检查 EA 专家日志
4. 参考 `DEPLOYMENT.md`

---

**祝你使用愉快！** 🚀
