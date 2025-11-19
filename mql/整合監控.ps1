# 自動整合網頁監控到 EA
$inputFile = "A計算盈虧_r9a_原始.mq5"
$outputFile = "A計算盈虧_r9a_監控版.mq5"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "自動整合網頁監控功能" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 讀取原始檔案
$content = Get-Content $inputFile -Raw -Encoding UTF8

# 1. 添加監控參數
$monitorParams = @"

// ==================== 網頁監控參數 ====================
input  string  __________網頁監控系統__________ = "=====網頁監控參數=====";
input  string  Monitor_API_URL = "http://192.168.31.206:8080/api";
input  string  Monitor_API_KEY = "secret_key_2025_9093942525abcdxyz_";
input  string  Monitor_NodeID = "A1_VPS0";
input  int  Monitor_HeartbeatMinutes = 15;
input  bool  Monitor_AutoSend = true;
"@

$content = $content -replace '(input\s+double\s+每手成本超過多少通知\s*=\s*-20;)', "`$1$monitorParams"

# 2. 添加監控全域變數
$monitorGlobals = @"

// ==================== 網頁監控全域變數 ====================
datetime g_lastMonitorHeartbeat = 0;
bool g_dataSentToday = false;
"@

$content = $content -replace '(\s+double\s+A總息\s*=\s*0;)', "`$1$monitorGlobals"

# 3. 添加監控函數（簡短版）
$monitorFunctions = @"

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
   if(res == 200 || res == 201) { g_lastMonitorHeartbeat = TimeCurrent(); Print("✓ 網頁監控心跳成功"); }
   else { int error_code = GetLastError(); Print("✗ 監控心跳失敗 HTTP:", res, " Error:", error_code); if(error_code == 4014) Print("  請將網址加入白名單: ", Monitor_API_URL); }
}

void SendMonitorABStats() {
   if(!Monitor_AutoSend) return;
   string url = Monitor_API_URL + "/ab-stats";
   string headers = "Content-Type: application/json\r\nAuthorization: Bearer " + Monitor_API_KEY + "\r\n";
   double lots_diff = A手數總數 - B手數總數, a_profit_usd = A盈利總數 / 匯率變數, ab_total = a_profit_usd + B盈利總數, cost_per_lot = (A手數總數 > 0) ? (ab_total / A手數總數) : 0;
   MqlDateTime tm; TimeToStruct(TimeCurrent(), tm);
   string today_date = StringFormat("%04d-%02d-%02d", tm.year, tm.mon, tm.day);
   string payload = "{\"id\":\"" + Monitor_NodeID + "\",\"date\":\"" + today_date + "\",\"a_lots_total\":" + DoubleToString(A手數總數, 2) + ",\"b_lots_total\":" + DoubleToString(B手數總數, 2) + ",\"lots_diff\":" + DoubleToString(lots_diff, 2) + ",\"a_profit_total\":" + DoubleToString(a_profit_usd, 2) + ",\"b_profit_total\":" + DoubleToString(B盈利總數, 2) + ",\"ab_profit_total\":" + DoubleToString(ab_total, 2) + ",\"a_interest_total\":" + DoubleToString(A總息, 2) + ",\"cost_per_lot\":" + DoubleToString(cost_per_lot, 2) + "}";
   char post_data[], result[];
   string result_headers;
   StringToCharArray(payload, post_data, 0, StringLen(payload));
   ResetLastError();
   int res = WebRequest("POST", url, headers, 5000, post_data, result, result_headers);
   if(res == 200 || res == 201) { g_dataSentToday = true; Print("✓ A/B統計發送成功 | A手數:", A手數總數, " B手數:", B手數總數, " AB總盈利:", ab_total, " 每手成本:", cost_per_lot); }
   else { Print("✗ 統計發送失敗 HTTP:", res, " Error:", GetLastError()); }
}
"@

$content = $content -replace '(void telegram_push_messages_[^}]+return;\s*})', "`$1$monitorFunctions"

# 4. OnInit 添加初始化
$initCode = "`n   SendMonitorHeartbeat();`n   Print(`"========================================== 網頁監控已啟用 NodeID: `", Monitor_NodeID, `" =========================================`");`n"
$content = $content -replace '(S4_分加一\s*=\s*Step4_IC分_0to58\s*\+\s*1;)', "`$1$initCode"

# 5. OnTick 開頭添加心跳
$tickStart = "`n    if(TimeCurrent() - g_lastMonitorHeartbeat >= Monitor_HeartbeatMinutes * 60) SendMonitorHeartbeat();`n    static int last_day = 0; int current_day = get_time_info_day(TimeCurrent()); if(current_day != last_day) { g_dataSentToday = false; last_day = current_day; }`n"
$content = $content -replace '(void OnTick\(\)\s*\{)', "`$1$tickStart"

# 6. 添加發送統計
$sendStats = "`n          if(Monitor_AutoSend && 開始 == 0 && !g_dataSentToday) SendMonitorABStats();`n"
$content = $content -replace '(\s+)(已發出TG通知1\s*=\s*1;)', "$sendStats`$1`$2"

# 7. 更新版本號
$content = $content -replace '#property version "9.01"', '#property version "9.02"'
$content = $content -replace '#property description "A計算盈虧_r9a A要求開始 MT5"', '#property description "A計算盈虧_r9a + 網頁監控"'

# 寫入輸出檔案
$content | Out-File -FilePath $outputFile -Encoding UTF8

Write-Host ""
Write-Host "✅ 整合完成！" -ForegroundColor Green
Write-Host "輸出檔案: $outputFile" -ForegroundColor Yellow
Write-Host ""
Write-Host "接下來請：" -ForegroundColor Cyan
Write-Host "  1. 在 MT5 MetaEditor 打開 $outputFile" -ForegroundColor White
Write-Host "  2. 按 F7 編譯" -ForegroundColor White
Write-Host "  3. 設定 WebRequest 白名單: http://192.168.31.206:8080" -ForegroundColor White
Write-Host "  4. 掛載到圖表測試" -ForegroundColor White
Write-Host ""
