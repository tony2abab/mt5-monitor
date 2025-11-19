================================================================================
                    最簡單的整合方法 - 5 分鐘完成
================================================================================

【建議方法】使用 VS Code 或 Notepad++ 的搜尋取代功能

================================================================================
步驟 1：準備檔案
================================================================================
1. 將您提供的原始 EA 代碼複製到新檔案
2. 命名為：A計算盈虧_r9a_監控版.mq5
3. 用 VS Code 或 Notepad++ 打開


================================================================================
步驟 2：使用搜尋功能找到 5 個插入點並添加代碼
================================================================================

▼ 插入點 1：搜尋「每手成本超過多少通知 = -20;」
找到後，在這一行的下一行貼上：

---複製以下內容---
// ==================== 網頁監控參數 ====================
input  string  __________網頁監控系統__________ = "=====網頁監控參數=====";
input  string  Monitor_API_URL = "http://192.168.31.206:8080/api";
input  string  Monitor_API_KEY = "secret_key_2025_9093942525abcdxyz_";
input  string  Monitor_NodeID = "A1_VPS0";
input  int  Monitor_HeartbeatMinutes = 15;
input  bool  Monitor_AutoSend = true;
---複製結束---


▼ 插入點 2：搜尋「double  A總息 = 0;」
找到後，在這一行的下一行貼上：

---複製以下內容---
datetime g_lastMonitorHeartbeat = 0;
bool g_dataSentToday = false;
---複製結束---


▼ 插入點 3：搜尋「void telegram_push_messages_」
找到這個函數，滾動到函數結尾（包含 return; 和 } 的那一行），在 } 的下一行貼上：

---複製以下內容---
void SendMonitorHeartbeat() {
   string url = Monitor_API_URL + "/heartbeat";
   string headers = "Content-Type: application/json\r\nAuthorization: Bearer " + Monitor_API_KEY + "\r\n";
   string broker = AccountInfoString(ACCOUNT_COMPANY);
   string account = IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));
   string payload = "{\"id\":\"" + Monitor_NodeID + "\",\"name\":\"" + 檔案頭ID + " " + 備註_VPS位置 + "\",\"broker\":\"" + broker + "\",\"account\":\"" + account + "\"}";
   char post_data[], result[];
   string result_headers;
   StringToCharArray(payload, post_data, 0, StringLen(payload));
   ResetLastError();
   int res = WebRequest("POST", url, headers, 5000, post_data, result, result_headers);
   if(res == 200 || res == 201) {
      g_lastMonitorHeartbeat = TimeCurrent();
      Print("✓ 網頁監控心跳成功");
   } else {
      int error_code = GetLastError();
      Print("✗ 監控心跳失敗 HTTP:", res, " Error:", error_code);
      if(error_code == 4014) Print("  請將網址加入白名單: ", Monitor_API_URL);
   }
}

void SendMonitorABStats() {
   if(!Monitor_AutoSend) return;
   string url = Monitor_API_URL + "/ab-stats";
   string headers = "Content-Type: application/json\r\nAuthorization: Bearer " + Monitor_API_KEY + "\r\n";
   double lots_diff = A手數總數 - B手數總數;
   double a_profit_usd = A盈利總數 / 匯率變數;
   double ab_total = a_profit_usd + B盈利總數;
   double cost_per_lot = (A手數總數 > 0) ? (ab_total / A手數總數) : 0;
   MqlDateTime tm;
   TimeToStruct(TimeCurrent(), tm);
   string today_date = StringFormat("%04d-%02d-%02d", tm.year, tm.mon, tm.day);
   string payload = "{\"id\":\"" + Monitor_NodeID + "\",\"date\":\"" + today_date + "\",";
   payload += "\"a_lots_total\":" + DoubleToString(A手數總數, 2) + ",";
   payload += "\"b_lots_total\":" + DoubleToString(B手數總數, 2) + ",";
   payload += "\"lots_diff\":" + DoubleToString(lots_diff, 2) + ",";
   payload += "\"a_profit_total\":" + DoubleToString(a_profit_usd, 2) + ",";
   payload += "\"b_profit_total\":" + DoubleToString(B盈利總數, 2) + ",";
   payload += "\"ab_profit_total\":" + DoubleToString(ab_total, 2) + ",";
   payload += "\"a_interest_total\":" + DoubleToString(A總息, 2) + ",";
   payload += "\"cost_per_lot\":" + DoubleToString(cost_per_lot, 2) + "}";
   char post_data[], result[];
   string result_headers;
   StringToCharArray(payload, post_data, 0, StringLen(payload));
   ResetLastError();
   int res = WebRequest("POST", url, headers, 5000, post_data, result, result_headers);
   if(res == 200 || res == 201) {
      g_dataSentToday = true;
      Print("✓ A/B統計發送成功 | A手數:", A手數總數, " B手數:", B手數總數, " AB總盈利:", ab_total, " 每手成本:", cost_per_lot);
   } else {
      Print("✗ 統計發送失敗 HTTP:", res, " Error:", GetLastError());
   }
}
---複製結束---


▼ 插入點 4：搜尋「S4_分加一 = Step4_IC分_0to58 + 1;」
找到後，在這一行的下一行（return(INIT_SUCCEEDED); 之前）貼上：

---複製以下內容---
   SendMonitorHeartbeat();
   Print("========================================== 網頁監控已啟用 NodeID: ", Monitor_NodeID, " ==========================================");
---複製結束---


▼ 插入點 5A：搜尋「void OnTick()」
找到後，在 { 的下一行（OnTick 函數的第一行）貼上：

---複製以下內容---
    if(TimeCurrent() - g_lastMonitorHeartbeat >= Monitor_HeartbeatMinutes * 60) SendMonitorHeartbeat();
    static int last_day = 0;
    int current_day = get_time_info_day(TimeCurrent());
    if(current_day != last_day) { g_dataSentToday = false; last_day = current_day; }
---複製結束---


▼ 插入點 5B：搜尋「已發出TG通知1 = 1;」
找到後，在這一行的前一行貼上：

---複製以下內容---
          if(Monitor_AutoSend && 開始 == 0 && !g_dataSentToday) SendMonitorABStats();
---複製結束---


================================================================================
步驟 3：儲存並編譯
================================================================================
1. Ctrl+S 儲存
2. 在 MT5 MetaEditor 中打開此檔案
3. 按 F7 編譯
4. 檢查是否有錯誤


================================================================================
步驟 4：設定 MT5
================================================================================
1. MT5 -> 工具 -> 選項 -> EA交易
2. 勾選「允許 WebRequest」
3. 添加：http://192.168.31.206:8080
4. 確定


================================================================================
步驟 5：測試
================================================================================
1. 掛載 EA 到圖表
2. 查看日誌應該看到「網頁監控已啟用」
3. 15 分鐘後看到「✓ 網頁監控心跳成功」
4. 按「開始」按鈕計算數據
5. 看到「✓ A/B統計發送成功」
6. 開啟網頁 http://192.168.31.206 查看數據


================================================================================
提示：如果不想手動複製，可以：
================================================================================
1. 將原始 EA 傳送給我
2. 我直接用 multi_edit 工具自動整合
3. 回傳給您完整的檔案

或者使用 Python 腳本（已創建：自動整合監控.py）

================================================================================
