//+------------------------------------------------------------------+
//|                                         MT5_Monitor_Client.mq4   |
//|                                  MT5 Trading Monitor Client      |
//|                        Sends heartbeat and stats to central API  |
//+------------------------------------------------------------------+
#property copyright "MT5 Monitor"
#property version   "1.00"
#property strict

//--- Input parameters
input string   API_BASE_URL = "http://localhost:8080/api";  // API Base URL
input string   API_KEY = "your_secret_api_key_here";        // API Key for authentication
input string   NodeID = "MT4_NODE_01";                      // Unique node ID
input string   EAName = "MT4 EA Monitor";                   // EA display name
input string   Broker = "";                                 // Broker (empty = auto-detect)
input string   Account = "";                                // Account (empty = auto-detect)
input int      HeartbeatIntervalMinutes = 15;               // Heartbeat interval (minutes)
input int      StatsReportHour = 23;                        // Stats report hour (0-23)
input int      StatsReportMinute = 59;                      // Stats report minute (0-59)
input bool     EnableDebugLog = true;                       // Enable debug logging

//--- Global variables
datetime g_lastHeartbeat = 0;
datetime g_lastStatsReport = 0;
bool g_statsReportedToday = false;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("MT4 Monitor Client initialized");
   Print("Node ID: ", NodeID);
   Print("API URL: ", API_BASE_URL);
   Print("Heartbeat interval: ", HeartbeatIntervalMinutes, " minutes");
   Print("Stats report time: ", StatsReportHour, ":", StatsReportMinute);
   
   // Add API URL to allowed WebRequest list
   Print("IMPORTANT: Add this URL to Tools -> Options -> Expert Advisors -> Allow WebRequest for listed URL:");
   Print("  ", API_BASE_URL);
   
   // Send initial heartbeat
   SendHeartbeat();
   
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   Print("MT4 Monitor Client stopped. Reason: ", reason);
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
   // Check if we need to send heartbeat
   CheckHeartbeat();
   
   // Check if we need to send daily stats
   CheckDailyStats();
}

//+------------------------------------------------------------------+
//| Timer function (alternative to OnTick for better timing)         |
//+------------------------------------------------------------------+
void OnTimer()
{
   CheckHeartbeat();
   CheckDailyStats();
}

//+------------------------------------------------------------------+
//| Check and send heartbeat if needed                               |
//+------------------------------------------------------------------+
void CheckHeartbeat()
{
   datetime now = TimeCurrent();
   int secondsSinceLastHeartbeat = (int)(now - g_lastHeartbeat);
   int heartbeatIntervalSeconds = HeartbeatIntervalMinutes * 60;
   
   if(secondsSinceLastHeartbeat >= heartbeatIntervalSeconds)
   {
      SendHeartbeat();
   }
}

//+------------------------------------------------------------------+
//| Send heartbeat to API                                            |
//+------------------------------------------------------------------+
void SendHeartbeat()
{
   string url = API_BASE_URL + "/heartbeat";
   string headers = "Content-Type: application/json\r\nAuthorization: Bearer " + API_KEY + "\r\n";
   
   // Get broker and account info
   string broker = (Broker == "") ? AccountCompany() : Broker;
   string account = (Account == "") ? IntegerToString(AccountNumber()) : Account;
   
   // Build JSON payload
   string payload = "{";
   payload += "\"id\":\"" + NodeID + "\",";
   payload += "\"name\":\"" + EAName + "\",";
   payload += "\"broker\":\"" + broker + "\",";
   payload += "\"account\":\"" + account + "\"";
   payload += "}";
   
   // Send request with retry
   bool success = SendHttpRequest(url, "POST", headers, payload, "Heartbeat");
   
   if(success)
   {
      g_lastHeartbeat = TimeCurrent();
      if(EnableDebugLog)
         Print("Heartbeat sent successfully at ", TimeToStr(g_lastHeartbeat));
   }
}

//+------------------------------------------------------------------+
//| Check and send daily stats if needed                             |
//+------------------------------------------------------------------+
void CheckDailyStats()
{
   MqlDateTime now_struct;
   TimeToStruct(TimeCurrent(), now_struct);
   
   // Reset daily flag at midnight
   if(now_struct.hour == 0 && now_struct.min < 5)
   {
      g_statsReportedToday = false;
   }
   
   // Check if it's time to report stats
   if(!g_statsReportedToday && 
      now_struct.hour == StatsReportHour && 
      now_struct.min >= StatsReportMinute)
   {
      SendDailyStats();
      g_statsReportedToday = true;
   }
}

//+------------------------------------------------------------------+
//| Send daily statistics to API                                     |
//+------------------------------------------------------------------+
void SendDailyStats()
{
   string url = API_BASE_URL + "/stats";
   string headers = "Content-Type: application/json\r\nAuthorization: Bearer " + API_KEY + "\r\n";
   
   // Calculate today's statistics from OrderHistory
   datetime today_start = StrToTime(TimeToStr(TimeCurrent(), TIME_DATE));
   datetime today_end = today_start + 86400; // +24 hours
   
   double profit_loss = 0;
   double interest = 0;
   double lots_traded = 0;
   double buy_lots = 0;
   double sell_lots = 0;
   int total_trades = 0;
   int winning_trades = 0;
   
   // Scan order history
   int total_orders = OrdersHistoryTotal();
   for(int i = 0; i < total_orders; i++)
   {
      if(OrderSelect(i, SELECT_BY_POS, MODE_HISTORY))
      {
         datetime close_time = OrderCloseTime();
         
         // Check if order closed today
         if(close_time >= today_start && close_time < today_end)
         {
            double order_profit = OrderProfit();
            double order_swap = OrderSwap();
            double order_lots = OrderLots();
            int order_type = OrderType();
            
            profit_loss += order_profit + OrderCommission();
            interest += order_swap;
            
            if(order_type == OP_BUY || order_type == OP_SELL)
            {
               lots_traded += order_lots;
               total_trades++;
               
               if(order_profit > 0)
                  winning_trades++;
               
               if(order_type == OP_BUY)
                  buy_lots += order_lots;
               else if(order_type == OP_SELL)
                  sell_lots += order_lots;
            }
         }
      }
   }
   
   // Also check open positions for floating P/L and swap (optional)
   int total_open = OrdersTotal();
   for(int i = 0; i < total_open; i++)
   {
      if(OrderSelect(i, SELECT_BY_POS, MODE_TRADES))
      {
         datetime open_time = OrderOpenTime();
         
         // If opened today, include in stats
         if(open_time >= today_start && open_time < today_end)
         {
            // Optionally include floating profit/swap
            // profit_loss += OrderProfit();
            // interest += OrderSwap();
         }
      }
   }
   
   // Calculate win rate
   double win_rate = (total_trades > 0) ? (double)winning_trades / total_trades : 0.0;
   double ab_lots_diff = buy_lots - sell_lots;
   
   // Build JSON payload
   string today_date = TimeToStr(TimeCurrent(), TIME_DATE);
   StringReplace(today_date, ".", "-"); // Convert to ISO format
   
   string payload = "{";
   payload += "\"id\":\"" + NodeID + "\",";
   payload += "\"date\":\"" + today_date + "\",";
   payload += "\"profit_loss\":" + DoubleToStr(profit_loss, 2) + ",";
   payload += "\"interest\":" + DoubleToStr(interest, 2) + ",";
   payload += "\"avg_lots_success\":" + DoubleToStr(win_rate, 4) + ",";
   payload += "\"lots_traded\":" + DoubleToStr(lots_traded, 2) + ",";
   payload += "\"ab_lots_diff\":" + DoubleToStr(ab_lots_diff, 2);
   payload += "}";
   
   // Send request
   bool success = SendHttpRequest(url, "POST", headers, payload, "Daily Stats");
   
   if(success)
   {
      g_lastStatsReport = TimeCurrent();
      Print("Daily stats sent: P/L=", profit_loss, " Interest=", interest, 
            " WinRate=", win_rate*100, "% Lots=", lots_traded);
   }
}

//+------------------------------------------------------------------+
//| Send HTTP request with retry logic                               |
//+------------------------------------------------------------------+
bool SendHttpRequest(string url, string method, string headers, string payload, string request_name)
{
   int max_retries = 3;
   int retry_delay_ms = 1000; // Start with 1 second
   
   for(int attempt = 1; attempt <= max_retries; attempt++)
   {
      char post_data[];
      char result[];
      string result_headers;
      
      // Convert payload to char array
      StringToCharArray(payload, post_data, 0, StringLen(payload));
      
      // Reset last error
      ResetLastError();
      
      // Send request
      int timeout = 5000; // 5 seconds timeout
      int res = WebRequest(method, url, headers, timeout, post_data, result, result_headers);
      
      if(res == 200 || res == 201)
      {
         string response = CharArrayToString(result);
         if(EnableDebugLog)
            Print(request_name, " request successful (attempt ", attempt, "): ", response);
         return true;
      }
      else
      {
         int error_code = GetLastError();
         Print("ERROR: ", request_name, " request failed (attempt ", attempt, "/", max_retries, ")");
         Print("  HTTP Code: ", res);
         Print("  Error Code: ", error_code);
         Print("  URL: ", url);
         
         if(error_code == 4060) // ERR_FUNCTION_NOT_ALLOWED
         {
            Print("  WebRequest not allowed for this URL!");
            Print("  Add URL to: Tools -> Options -> Expert Advisors -> Allow WebRequest");
            return false; // Don't retry if WebRequest is not allowed
         }
         
         if(error_code == 4014) // ERR_FUNCTION_NOT_CONFIRMED
         {
            Print("  ERROR 4014: URL not in allowed WebRequest list!");
            Print("  *** ACTION REQUIRED ***");
            Print("  1. Go to: Tools -> Options -> Expert Advisors");
            Print("  2. Check 'Allow WebRequest for listed URL'");
            Print("  3. Add this URL: ", API_BASE_URL);
            Print("  4. Click OK and restart the EA");
            return false; // Don't retry if URL not whitelisted
         }
         
         // Exponential backoff
         if(attempt < max_retries)
         {
            Sleep(retry_delay_ms);
            retry_delay_ms *= 2; // Double delay for next retry
         }
      }
   }
   
   Print("ERROR: ", request_name, " request failed after ", max_retries, " attempts");
   return false;
}
//+------------------------------------------------------------------+
