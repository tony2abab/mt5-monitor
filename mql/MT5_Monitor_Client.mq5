//+------------------------------------------------------------------+
//|                                         MT5_Monitor_Client.mq5   |
//|                                  MT5 交易監控客戶端                |
//|                        發送心跳和統計數據到中央監控 API            |
//+------------------------------------------------------------------+
#property copyright "MT5 Monitor"
#property version   "1.00"
#property strict

//--- 輸入參數
input string   API_BASE_URL = "http://192.168.31.206:8080/api";  // API 基礎網址（例如：http://192.168.31.206:8080/api）
input string   API_KEY = "secret_key_2025_9093942525abcdxyz_";   // API 金鑰（必須與伺服器 .env 檔案中的 API_KEY 一致）
input string   NodeID = "MT5_NODE_01";                      // 節點唯一識別碼（每個 EA 必須不同）
input string   EAName = "MT5 EA Monitor";                   // EA 顯示名稱（自訂名稱）
input string   Broker = "";                                 // 券商名稱（留空則自動偵測）
input string   Account = "";                                // 帳號（留空則自動偵測）
input int      HeartbeatIntervalMinutes = 15;               // 心跳間隔（分鐘），預設 15 分鐘發送一次
input int      StatsReportHour = 23;                        // 統計報告時間-小時（0-23），預設晚上 11 點
input int      StatsReportMinute = 59;                      // 統計報告時間-分鐘（0-59），預設 59 分
input bool     EnableDebugLog = true;                       // 啟用除錯日誌（建議開啟以便排查問題）

//--- 全域變數
datetime g_lastHeartbeat = 0;        // 上次心跳時間
datetime g_lastStatsReport = 0;      // 上次統計報告時間
bool g_statsReportedToday = false;   // 今日是否已發送統計報告

//--- A/B 系統統計數據（在您的 EA 中計算後賦值，然後調用 SendABStats()）
double g_A_lots_total = 0.0;         // A手數總數
double g_B_lots_total = 0.0;         // B手數總數
double g_A_profit_total = 0.0;       // A盈利總數
double g_B_profit_total = 0.0;       // B盈利總數
double g_A_interest_total = 0.0;     // A總息

//+------------------------------------------------------------------+
//| EA 初始化函數                                                     |
//| 在 EA 啟動時執行一次                                              |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("MT5 監控客戶端已初始化");
   Print("節點 ID: ", NodeID);
   Print("API 網址: ", API_BASE_URL);
   Print("心跳間隔: ", HeartbeatIntervalMinutes, " 分鐘");
   Print("統計報告時間: ", StatsReportHour, ":", StatsReportMinute);
   
   // 提醒用戶將 API 網址加入允許清單
   Print("重要提醒：請將此網址加入 WebRequest 允許清單");
   Print("  路徑：工具 -> 選項 -> EA交易 -> 允許 WebRequest");
   Print("  網址：", API_BASE_URL);
   
   // 發送初始心跳
   SendHeartbeat();
   
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| EA 卸載函數                                                       |
//| 在 EA 停止或被移除時執行                                          |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   Print("MT5 監控客戶端已停止。原因代碼: ", reason);
}

//+------------------------------------------------------------------+
//| Tick 事件處理函數                                                |
//| 每次價格變動時執行（檢查是否需要發送心跳）                        |
//| 注意：統計數據改為手動發送 SendABStats()                         |
//+------------------------------------------------------------------+
void OnTick()
{
   // 檢查是否需要發送心跳
   CheckHeartbeat();
   
   // 注意：已移除自動發送每日統計
   // 請在您的 EA 中計算好數據後手動調用 SendABStats()
}

//+------------------------------------------------------------------+
//| 定時器函數（可替代 OnTick 以獲得更精確的計時）                    |
//+------------------------------------------------------------------+
void OnTimer()
{
   CheckHeartbeat();
   CheckDailyStats();
}

//+------------------------------------------------------------------+
//| 檢查並發送心跳（如果需要）                                        |
//| 根據設定的心跳間隔，定期向伺服器發送 "我還活著" 的訊號            |
//+------------------------------------------------------------------+
void CheckHeartbeat()
{
   datetime now = TimeCurrent();
   int secondsSinceLastHeartbeat = (int)(now - g_lastHeartbeat);
   int heartbeatIntervalSeconds = HeartbeatIntervalMinutes * 60;
   
   // 如果距離上次心跳已超過設定的間隔時間
   if(secondsSinceLastHeartbeat >= heartbeatIntervalSeconds)
   {
      SendHeartbeat();
   }
}

//+------------------------------------------------------------------+
//| 發送心跳到 API 伺服器                                             |
//| 向伺服器報告此節點的基本資訊和在線狀態                             |
//+------------------------------------------------------------------+
void SendHeartbeat()
{
   string url = API_BASE_URL + "/heartbeat";
   string headers = "Content-Type: application/json\r\nAuthorization: Bearer " + API_KEY + "\r\n";
   
   // 取得券商和帳號資訊（如果未手動設定則自動偵測）
   string broker = (Broker == "") ? AccountInfoString(ACCOUNT_COMPANY) : Broker;
   string account = (Account == "") ? IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) : Account;
   
   // 建構 JSON 格式的請求內容
   string payload = "{";
   payload += "\"id\":\"" + NodeID + "\",";        // 節點 ID
   payload += "\"name\":\"" + EAName + "\",";      // EA 名稱
   payload += "\"broker\":\"" + broker + "\",";    // 券商
   payload += "\"account\":\"" + account + "\"";   // 帳號
   payload += "}";
   
   // 發送 HTTP 請求（包含重試機制）
   bool success = SendHttpRequest(url, "POST", headers, payload, "Heartbeat");
   
   if(success)
   {
      g_lastHeartbeat = TimeCurrent();
      if(EnableDebugLog)
         Print("心跳發送成功，時間: ", TimeToString(g_lastHeartbeat));
   }
}

//+------------------------------------------------------------------+
//| 檢查並發送每日統計（如果需要）                                     |
//| 在指定的時間點發送當日交易統計資料                                 |
//+------------------------------------------------------------------+
void CheckDailyStats()
{
   MqlDateTime now_struct;
   TimeToStruct(TimeCurrent(), now_struct);
   
   // 在午夜時重置「今日已報告」標記
   if(now_struct.hour == 0 && now_struct.min < 5)
   {
      g_statsReportedToday = false;
   }
   
   // 檢查是否到了統計報告時間且今日尚未報告
   if(!g_statsReportedToday && 
      now_struct.hour == StatsReportHour && 
      now_struct.min >= StatsReportMinute)
   {
      SendDailyStats();
      g_statsReportedToday = true;
   }
}

//+------------------------------------------------------------------+
//| 發送每日統計資料到 API                                            |
//| 計算並發送當日的交易統計（盈虧、利息、手數等）                     |
//+------------------------------------------------------------------+
void SendDailyStats()
{
   string url = API_BASE_URL + "/stats";
   string headers = "Content-Type: application/json\r\nAuthorization: Bearer " + API_KEY + "\r\n";
   
   // 計算今日統計資料的時間範圍
   datetime today_start = StringToTime(TimeToString(TimeCurrent(), TIME_DATE));
   datetime today_end = today_start + 86400; // +24 小時
   
   // 初始化統計變數
   double profit_loss = 0;      // 損益（包含佣金）
   double interest = 0;         // 利息/庫存費
   double lots_traded = 0;      // 總交易手數
   double buy_lots = 0;         // 買入手數
   double sell_lots = 0;        // 賣出手數
   int total_trades = 0;        // 總交易次數
   int winning_trades = 0;      // 獲利交易次數
   
   // 取得今日的交易歷史記錄
   HistorySelect(today_start, today_end);
   
   // 遍歷所有今日的交易記錄
   for(int i = 0; i < HistoryDealsTotal(); i++)
   {
      ulong ticket = HistoryDealGetTicket(i);
      if(ticket > 0)
      {
         // 取得交易詳細資訊
         double deal_profit = HistoryDealGetDouble(ticket, DEAL_PROFIT);   // 盈虧
         double deal_swap = HistoryDealGetDouble(ticket, DEAL_SWAP);       // 利息
         double deal_volume = HistoryDealGetDouble(ticket, DEAL_VOLUME);   // 手數
         ENUM_DEAL_TYPE deal_type = (ENUM_DEAL_TYPE)HistoryDealGetInteger(ticket, DEAL_TYPE);
         
         // 累計損益和利息
         profit_loss += deal_profit;
         interest += deal_swap;
         
         // 只統計買入和賣出交易（不包含存款、提款等）
         if(deal_type == DEAL_TYPE_BUY || deal_type == DEAL_TYPE_SELL)
         {
            lots_traded += deal_volume;
            total_trades++;
            
            // 統計獲利交易
            if(deal_profit > 0)
               winning_trades++;
            
            // 分別統計買入和賣出手數
            if(deal_type == DEAL_TYPE_BUY)
               buy_lots += deal_volume;
            else if(deal_type == DEAL_TYPE_SELL)
               sell_lots += deal_volume;
         }
      }
   }
   
   // 計算勝率和買賣手數差異
   double win_rate = (total_trades > 0) ? (double)winning_trades / total_trades : 0.0;
   double ab_lots_diff = buy_lots - sell_lots;  // 買入與賣出手數的差異
   
   // 建構 JSON 格式的請求內容
   string today_date = TimeToString(TimeCurrent(), TIME_DATE);
   StringReplace(today_date, ".", "-"); // 轉換為 ISO 格式（例如：2025-11-11）
   
   string payload = "{";
   payload += "\"id\":\"" + NodeID + "\",";
   payload += "\"date\":\"" + today_date + "\",";
   payload += "\"profit_loss\":" + DoubleToString(profit_loss, 2) + ",";          // 損益
   payload += "\"interest\":" + DoubleToString(interest, 2) + ",";                // 利息
   payload += "\"avg_lots_success\":" + DoubleToString(win_rate, 4) + ",";       // 勝率
   payload += "\"lots_traded\":" + DoubleToString(lots_traded, 2) + ",";         // 總手數
   payload += "\"ab_lots_diff\":" + DoubleToString(ab_lots_diff, 2);             // 買賣手數差
   payload += "}";
   
   // 發送請求
   bool success = SendHttpRequest(url, "POST", headers, payload, "Daily Stats");
   
   if(success)
   {
      g_lastStatsReport = TimeCurrent();
      Print("每日統計已發送: 損益=", profit_loss, " 利息=", interest, 
            " 勝率=", win_rate*100, "% 手數=", lots_traded);
   }
}

//+------------------------------------------------------------------+
//| 發送 HTTP 請求（包含重試機制）                                    |
//| 使用指數退避策略進行最多 3 次重試                                 |
//+------------------------------------------------------------------+
bool SendHttpRequest(string url, string method, string headers, string payload, string request_name)
{
   int max_retries = 3;
   int retry_delay_ms = 1000; // 從 1 秒開始，失敗後加倍
   
   for(int attempt = 1; attempt <= max_retries; attempt++)
   {
      char post_data[];
      char result[];
      string result_headers;
      
      // 將字串轉換為字元陣列（WebRequest 需要）
      StringToCharArray(payload, post_data, 0, StringLen(payload));
      
      // 重置錯誤代碼
      ResetLastError();
      
      // 發送 HTTP 請求
      int timeout = 5000; // 5 秒逾時
      int res = WebRequest(method, url, headers, timeout, post_data, result, result_headers);
      
      // 檢查是否成功（HTTP 200 或 201）
      if(res == 200 || res == 201)
      {
         string response = CharArrayToString(result);
         if(EnableDebugLog)
            Print(request_name, " 請求成功 (嘗試 ", attempt, "): ", response);
         return true;
      }
      else
      {
         // 請求失敗，記錄錯誤資訊
         int error_code = GetLastError();
         Print("錯誤: ", request_name, " 請求失敗 (嘗試 ", attempt, "/", max_retries, ")");
         Print("  HTTP 代碼: ", res);
         Print("  錯誤代碼: ", error_code);
         Print("  網址: ", url);
         
         // 錯誤 4060：WebRequest 功能未啟用
         if(error_code == 4060) // ERR_FUNCTION_NOT_ALLOWED
         {
            Print("  錯誤 4060: 此網址的 WebRequest 功能未啟用！");
            Print("  請前往：工具 -> 選項 -> EA交易 -> 允許 WebRequest");
            return false; // 不重試
         }
         
         // 錯誤 4014：網址未在白名單中
         if(error_code == 4014) // ERR_FUNCTION_NOT_CONFIRMED
         {
            Print("  錯誤 4014: 網址未加入允許清單！");
            Print("  *** 需要操作 ***");
            Print("  1. 前往：工具 -> 選項 -> EA交易");
            Print("  2. 勾選「允許列出的網址使用 WebRequest」");
            Print("  3. 新增此網址：", API_BASE_URL);
            Print("  4. 點擊確定並重啟 EA");
            return false; // 不重試
         }
         
         // 錯誤 401：API 金鑰錯誤
         if(res == 401)
         {
            Print("  錯誤 401: API 金鑰認證失敗！");
            Print("  請確認 EA 參數中的 API_KEY 與伺服器 .env 檔案中的值完全一致");
            return false; // 不重試
         }
         
         // 指數退避：失敗後等待更長時間再重試
         if(attempt < max_retries)
         {
            Print("  ", retry_delay_ms, " 毫秒後重試...");
            Sleep(retry_delay_ms);
            retry_delay_ms *= 2; // 每次失敗後延遲時間加倍
         }
      }
   }
   
   Print("錯誤: ", request_name, " 請求在 ", max_retries, " 次嘗試後仍然失敗");
   return false;
}

//+------------------------------------------------------------------+
//| 發送 A/B 系統統計數據                                             |
//| 在您的 EA 中計算好數據後，設定全域變數並調用此函數                |
//| 使用範例：                                                        |
//|   g_A_lots_total = 10.5;                                         |
//|   g_B_lots_total = 8.3;                                          |
//|   g_A_profit_total = 1250.50;                                    |
//|   g_B_profit_total = -320.80;                                    |
//|   g_A_interest_total = -45.20;                                   |
//|   SendABStats();                                                 |
//+------------------------------------------------------------------+
void SendABStats()
{
   string url = API_BASE_URL + "/ab-stats";
   string headers = "Content-Type: application/json\r\nAuthorization: Bearer " + API_KEY + "\r\n";
   
   // 計算衍生數據
   double lots_diff = g_A_lots_total - g_B_lots_total;           // 手數差
   double ab_profit_total = g_A_profit_total + g_B_profit_total; // AB總盈利
   double cost_per_lot = 0.0;                                     // 每手成本
   
   if(g_A_lots_total != 0.0)
   {
      cost_per_lot = ab_profit_total / g_A_lots_total;
   }
   
   // 建構 JSON 格式的請求內容
   string today_date = TimeToString(TimeCurrent(), TIME_DATE);
   StringReplace(today_date, ".", "-");
   
   string payload = "{";
   payload += "\"id\":\"" + NodeID + "\",";
   payload += "\"date\":\"" + today_date + "\",";
   payload += "\"a_lots_total\":" + DoubleToString(g_A_lots_total, 2) + ",";
   payload += "\"b_lots_total\":" + DoubleToString(g_B_lots_total, 2) + ",";
   payload += "\"lots_diff\":" + DoubleToString(lots_diff, 2) + ",";
   payload += "\"a_profit_total\":" + DoubleToString(g_A_profit_total, 2) + ",";
   payload += "\"b_profit_total\":" + DoubleToString(g_B_profit_total, 2) + ",";
   payload += "\"ab_profit_total\":" + DoubleToString(ab_profit_total, 2) + ",";
   payload += "\"a_interest_total\":" + DoubleToString(g_A_interest_total, 2) + ",";
   payload += "\"cost_per_lot\":" + DoubleToString(cost_per_lot, 2);
   payload += "}";
   
   Print("=== 發送 A/B 統計數據 ===");
   Print("2. A手數總數: ", g_A_lots_total);
   Print("3. B手數總數: ", g_B_lots_total);
   Print("4. 手數差 (A-B): ", lots_diff);
   Print("5. A盈利總數: ", g_A_profit_total);
   Print("6. B盈利總數: ", g_B_profit_total);
   Print("7. AB總盈利: ", ab_profit_total);
   Print("8. A總息: ", g_A_interest_total);
   Print("9. 每手成本: ", cost_per_lot);
   
   // 發送請求
   bool success = SendHttpRequest(url, "POST", headers, payload, "A/B統計");
   
   if(success)
   {
      Print("✓ A/B 統計數據發送成功！");
   }
   else
   {
      Print("✗ A/B 統計數據發送失敗");
   }
}
//+------------------------------------------------------------------+
