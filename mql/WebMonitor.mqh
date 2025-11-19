//+------------------------------------------------------------------+
//|                                                  WebMonitor.mqh  |
//|                        網頁監控系統整合模組                       |
//|                        用於 A 計算盈虧 EA                         |
//+------------------------------------------------------------------+

// === 在您的 EA 開頭加入這些參數 ===
/*
input string   __________監控系統__________ = "=====監控系統參數=====";
input string   Monitor_API_URL = "http://192.168.31.206:8080/api";
input string   Monitor_API_KEY = "secret_key_2025_9093942525abcdxyz_";
input string   Monitor_NodeID = "A1_VPS0";
input int      Monitor_HeartbeatMinutes = 15;
input bool     Monitor_AutoSend = true;

datetime g_lastMonitorHeartbeat = 0;
bool g_dataSentToday = false;
*/

//+------------------------------------------------------------------+
//| 發送心跳到監控系統                                                |
//+------------------------------------------------------------------+
void SendMonitorHeartbeat(string api_url, string api_key, string node_id, string ea_id, datetime &last_heartbeat)
{
   string url = api_url + "/heartbeat";
   string headers = "Content-Type: application/json\r\nAuthorization: Bearer " + api_key + "\r\n";
   
   string broker = AccountInfoString(ACCOUNT_COMPANY);
   string account = IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));
   
   string payload = "{";
   payload += "\"id\":\"" + node_id + "\",";
   payload += "\"name\":\"" + ea_id + " Monitor\",";
   payload += "\"broker\":\"" + broker + "\",";
   payload += "\"account\":\"" + account + "\"";
   payload += "}";
   
   char post_data[];
   char result[];
   string result_headers;
   
   StringToCharArray(payload, post_data, 0, StringLen(payload));
   ResetLastError();
   
   int res = WebRequest("POST", url, headers, 5000, post_data, result, result_headers);
   
   if(res == 200 || res == 201)
   {
      last_heartbeat = TimeCurrent();
      Print("✓ 監控心跳發送成功");
   }
   else
   {
      int error_code = GetLastError();
      Print("✗ 監控心跳失敗 HTTP:", res, " Error:", error_code);
      
      if(error_code == 4014)
      {
         Print("  錯誤 4014: 請將網址加入 WebRequest 白名單");
         Print("  工具 -> 選項 -> EA交易 -> 允許 WebRequest");
         Print("  網址: ", api_url);
      }
   }
}

//+------------------------------------------------------------------+
//| 發送 A/B 統計到監控系統                                          |
//+------------------------------------------------------------------+
void SendMonitorABStats(
   string api_url, 
   string api_key, 
   string node_id,
   double a_lots,
   double b_lots,
   double a_profit,
   double b_profit,
   double a_interest,
   double exchange_rate
)
{
   string url = api_url + "/ab-stats";
   string headers = "Content-Type: application/json\r\nAuthorization: Bearer " + api_key + "\r\n";
   
   // 計算衍生數據
   double lots_diff = a_lots - b_lots;
   double a_profit_usd = a_profit / exchange_rate;
   double ab_total = a_profit_usd + b_profit;
   double cost_per_lot = (a_lots > 0) ? (ab_total / a_lots) : 0;
   
   // 取得今日日期
   MqlDateTime tm;
   TimeToStruct(TimeCurrent(), tm);
   string today_date = StringFormat("%04d-%02d-%02d", tm.year, tm.mon, tm.day);
   
   // 建構 JSON
   string payload = "{";
   payload += "\"id\":\"" + node_id + "\",";
   payload += "\"date\":\"" + today_date + "\",";
   payload += "\"a_lots_total\":" + DoubleToString(a_lots, 2) + ",";
   payload += "\"b_lots_total\":" + DoubleToString(b_lots, 2) + ",";
   payload += "\"lots_diff\":" + DoubleToString(lots_diff, 2) + ",";
   payload += "\"a_profit_total\":" + DoubleToString(a_profit_usd, 2) + ",";
   payload += "\"b_profit_total\":" + DoubleToString(b_profit, 2) + ",";
   payload += "\"ab_profit_total\":" + DoubleToString(ab_total, 2) + ",";
   payload += "\"a_interest_total\":" + DoubleToString(a_interest, 2) + ",";
   payload += "\"cost_per_lot\":" + DoubleToString(cost_per_lot, 2);
   payload += "}";
   
   char post_data[];
   char result[];
   string result_headers;
   
   StringToCharArray(payload, post_data, 0, StringLen(payload));
   ResetLastError();
   
   int res = WebRequest("POST", url, headers, 5000, post_data, result, result_headers);
   
   if(res == 200 || res == 201)
   {
      Print("✓ A/B統計發送成功到網頁");
      Print("  2. A手數:", DoubleToString(a_lots, 2));
      Print("  3. B手數:", DoubleToString(b_lots, 2));
      Print("  4. 手數差:", DoubleToString(lots_diff, 2));
      Print("  5. A盈利:", DoubleToString(a_profit_usd, 2));
      Print("  6. B盈利:", DoubleToString(b_profit, 2));
      Print("  7. AB總盈利:", DoubleToString(ab_total, 2));
      Print("  8. A總息:", DoubleToString(a_interest, 2));
      Print("  9. 每手成本:", DoubleToString(cost_per_lot, 2));
   }
   else
   {
      int error_code = GetLastError();
      Print("✗ A/B統計發送失敗 HTTP:", res, " Error:", error_code);
      
      if(res == 401)
      {
         Print("  錯誤 401: API 金鑰認證失敗");
         Print("  請確認 Monitor_API_KEY 與伺服器設定一致");
      }
      else if(error_code == 4014)
      {
         Print("  錯誤 4014: 請將網址加入 WebRequest 白名單");
      }
   }
}

//+------------------------------------------------------------------+
//| 檢查並發送心跳                                                    |
//+------------------------------------------------------------------+
void CheckAndSendHeartbeat(
   string api_url,
   string api_key,
   string node_id,
   string ea_id,
   int interval_minutes,
   datetime &last_heartbeat
)
{
   if(TimeCurrent() - last_heartbeat >= interval_minutes * 60)
   {
      SendMonitorHeartbeat(api_url, api_key, node_id, ea_id, last_heartbeat);
   }
}
