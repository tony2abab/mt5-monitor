# MT5 A/B 系統監控 - 更新總結

## ✅ 已完成的更新

### 1. MT5 EA 更新 (`mql/MT5_Monitor_Client.mq5`)

**新增全域變數：**
```mql5
g_A_lots_total         // A手數總數
g_B_lots_total         // B手數總數
g_A_profit_total       // A盈利總數
g_B_profit_total       // B盈利總數
g_A_interest_total     // A總息
```

**新增函數：**
- `SendABStats()` - 發送 A/B 系統統計數據到伺服器

**使用方法：**
```mql5
// 在您的 EA 中
g_A_lots_total = 10.5;
g_B_lots_total = 8.3;
g_A_profit_total = 1250.50;
g_B_profit_total = -320.80;
g_A_interest_total = -45.20;

SendABStats();  // 發送
```

---

### 2. 後端 API 更新

**新增路由：** `POST /api/ab-stats`
- 接收 A/B 系統統計數據
- 需要 API 金鑰認證

**新增數據庫表：** `ab_stats`
- 儲存 A/B 系統的 9 項統計數據

**更新路由：** `GET /api/nodes`
- 返回 `todayABStats` 欄位（新格式）
- 保留 `todayStats` 欄位（向後兼容）

---

### 3. 前端顯示更新

**NodeCard 組件更新：**
顯示 9 項數據：

1. ✓ 心跳（已有）
2. A手數總數 - 青色
3. B手數總數 - 紫色
4. **手數差 (A-B) - 不等於0時紅色**
5. A盈利總數 - 綠色/紅色
6. B盈利總數 - 綠色/紅色
7. **AB總盈利 - 綠色/紅色（加粗顯示）**
8. A總息 - 灰色
9. 每手成本 - 黃色

---

## 📋 部署步驟

### 1. 重新編譯 EA
```
在 MetaEditor 中打開 MT5_Monitor_Client.mq5
按 F7 編譯
```

### 2. 重啟 Docker 服務
```powershell
cd c:\Users\tt\CascadeProjects\MT5_Monitor
docker-compose down
docker-compose up -d
```

### 3. 在 MT5 中設定 EA
```
API_BASE_URL = http://192.168.31.206:8080/api
API_KEY = secret_key_2025_9093942525abcdxyz_
NodeID = MT5_NODE_01
```

### 4. 測試發送
在您的 EA 中添加測試代碼：
```mql5
g_A_lots_total = 10.0;
g_B_lots_total = 8.0;
g_A_profit_total = 500.0;
g_B_profit_total = 300.0;
g_A_interest_total = -20.0;

SendABStats();
```

### 5. 檢查網頁
打開瀏覽器訪問：`http://192.168.31.206`

應該會看到：
- A手數總數: 10.00
- B手數總數: 8.00
- 手數差: +2.00 (紅色)
- A盈利: +500.00
- B盈利: +300.00
- AB總盈利: +800.00
- A總息: -20.00
- 每手成本: 80.00

---

## 🎯 功能特點

### 自動計算
- 手數差 = A手數 - B手數
- AB總盈利 = A盈利 + B盈利
- 每手成本 = AB總盈利 / A手數

### 視覺提示
- 手數差不等於0時：**紅色顯示**
- 盈利為正：綠色
- 虧損為負：紅色
- AB總盈利：加粗顯示

### 向後兼容
- 保留舊的 `/api/stats` 路由
- 保留舊的統計顯示格式
- 新舊系統可以共存

---

## 📁 更新的檔案清單

### MT5 EA
- ✅ `mql/MT5_Monitor_Client.mq5`
- ✅ `mql/AB系統使用說明.txt`

### 後端
- ✅ `backend/src/routes/api.js`
- ✅ `backend/src/database/db.js`
- ✅ `backend/src/database/schema.sql`

### 前端
- ✅ `frontend/src/components/NodeCard.jsx`

---

## 🔧 技術細節

### API 請求格式
```json
POST /api/ab-stats
{
  "id": "MT5_NODE_01",
  "date": "2025-11-17",
  "a_lots_total": 10.5,
  "b_lots_total": 8.3,
  "lots_diff": 2.2,
  "a_profit_total": 1250.50,
  "b_profit_total": -320.80,
  "ab_profit_total": 929.70,
  "a_interest_total": -45.20,
  "cost_per_lot": 88.54
}
```

### API 回應格式
```json
GET /api/nodes
{
  "ok": true,
  "nodes": [{
    "id": "MT5_NODE_01",
    "name": "我的EA",
    "status": "online",
    "todayABStats": {
      "a_lots_total": 10.5,
      "b_lots_total": 8.3,
      ...
    }
  }],
  "summary": {
    "total": 1,
    "online": 1,
    "totalABProfit": 929.70
  }
}
```

---

## 📝 注意事項

1. **心跳自動發送**
   - 每 15 分鐘自動發送（可設定）
   - 不需要手動調用

2. **統計數據手動發送**
   - 需要在 EA 中計算後調用 `SendABStats()`
   - 建議在每次交易後或定時更新

3. **數據驗證**
   - 所有數值會四捨五入到小數點後 2 位
   - 除了 A手數為 0 時，每手成本顯示 0.00

4. **錯誤處理**
   - HTTP 401: API 金鑰錯誤
   - HTTP 404: 節點不存在（需先發送心跳）
   - Error 4014: URL 未加入白名單

---

## 🎉 完成！

系統已經更新完成，現在支持 A/B 系統的完整監控。

如有任何問題，請查看：
- EA 日誌：MT5 的「專家」標籤
- 後端日誌：`docker-compose logs backend`
- 前端：瀏覽器開發者工具 (F12)
