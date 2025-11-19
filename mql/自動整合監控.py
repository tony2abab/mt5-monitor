#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
自動整合網頁監控到 A 計算盈虧 EA
使用方法：python 自動整合監控.py
"""

import os
import sys

# 設定檔案路徑
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_FILE = "A計算盈虧_r9a_原始.mq5"  # 您的原始 EA 檔案名稱
OUTPUT_FILE = "A計算盈虧_r9a_監控版.mq5"  # 輸出檔案名稱

# 監控參數代碼
MONITOR_PARAMS = '''
// ==================== 網頁監控參數 ====================
input  string  __________網頁監控系統__________ = "=====網頁監控參數=====";
input  string  Monitor_API_URL = "http://192.168.31.206:8080/api";
input  string  Monitor_API_KEY = "secret_key_2025_9093942525abcdxyz_";
input  string  Monitor_NodeID = "A1_VPS0";
input  int  Monitor_HeartbeatMinutes = 15;
input  bool  Monitor_AutoSend = true;
'''

# 監控全域變數
MONITOR_GLOBALS = '''
// ==================== 網頁監控全域變數 ====================
datetime g_lastMonitorHeartbeat = 0;
bool g_dataSentToday = false;
'''

# 監控函數
MONITOR_FUNCTIONS = '''
//+------------------------------------------------------------------+
//| 網頁監控 - 發送心跳                                               |
//+------------------------------------------------------------------+
void SendMonitorHeartbeat() {
   string url = Monitor_API_URL + "/heartbeat";
   string headers = "Content-Type: application/json\\r\\nAuthorization: Bearer " + Monitor_API_KEY + "\\r\\n";
   
   string broker = AccountInfoString(ACCOUNT_COMPANY);
   string account = IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));
   
   string payload = "{";
   payload += "\\"id\\":\\"" + Monitor_NodeID + "\\",";
   payload += "\\"name\\":\\"" + 檔案頭ID + " " + 備註_VPS位置 + "\\",";
   payload += "\\"broker\\":\\"" + broker + "\\",";
   payload += "\\"account\\":\\"" + account + "\\"";
   payload += "}";
   
   char post_data[];
   char result[];
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
      if(error_code == 4014) {
         Print("  請將網址加入白名單: ", Monitor_API_URL);
      }
   }
}

//+------------------------------------------------------------------+
//| 網頁監控 - 發送 A/B 統計                                          |
//+------------------------------------------------------------------+
void SendMonitorABStats() {
   if(!Monitor_AutoSend) return;
   
   string url = Monitor_API_URL + "/ab-stats";
   string headers = "Content-Type: application/json\\r\\nAuthorization: Bearer " + Monitor_API_KEY + "\\r\\n";
   
   double lots_diff = A手數總數 - B手數總數;
   double a_profit_usd = A盈利總數 / 匯率變數;
   double ab_total = a_profit_usd + B盈利總數;
   double cost_per_lot = (A手數總數 > 0) ? (ab_total / A手數總數) : 0;
   
   MqlDateTime tm;
   TimeToStruct(TimeCurrent(), tm);
   string today_date = StringFormat("%04d-%02d-%02d", tm.year, tm.mon, tm.day);
   
   string payload = "{";
   payload += "\\"id\\":\\"" + Monitor_NodeID + "\\",";
   payload += "\\"date\\":\\"" + today_date + "\\",";
   payload += "\\"a_lots_total\\":" + DoubleToString(A手數總數, 2) + ",";
   payload += "\\"b_lots_total\\":" + DoubleToString(B手數總數, 2) + ",";
   payload += "\\"lots_diff\\":" + DoubleToString(lots_diff, 2) + ",";
   payload += "\\"a_profit_total\\":" + DoubleToString(a_profit_usd, 2) + ",";
   payload += "\\"b_profit_total\\":" + DoubleToString(B盈利總數, 2) + ",";
   payload += "\\"ab_profit_total\\":" + DoubleToString(ab_total, 2) + ",";
   payload += "\\"a_interest_total\\":" + DoubleToString(A總息, 2) + ",";
   payload += "\\"cost_per_lot\\":" + DoubleToString(cost_per_lot, 2);
   payload += "}";
   
   char post_data[];
   char result[];
   string result_headers;
   
   StringToCharArray(payload, post_data, 0, StringLen(payload));
   ResetLastError();
   
   int res = WebRequest("POST", url, headers, 5000, post_data, result, result_headers);
   
   if(res == 200 || res == 201) {
      g_dataSentToday = true;
      Print("✓ A/B統計發送成功");
      Print("  A手數:", A手數總數, " B手數:", B手數總數);
      Print("  AB總盈利:", ab_total, " 每手成本:", cost_per_lot);
   } else {
      Print("✗ 統計發送失敗 HTTP:", res, " Error:", GetLastError());
   }
}
'''

ONINIT_INSERT = '''
   // 初始化網頁監控
   SendMonitorHeartbeat();
   Print("==========================================");
   Print("網頁監控已啟用 NodeID: ", Monitor_NodeID);
   Print("請確認已將網址加入白名單");
   Print("==========================================");
'''

ONTICK_START_INSERT = '''   // === 網頁監控：心跳檢查 ===
   if(TimeCurrent() - g_lastMonitorHeartbeat >= Monitor_HeartbeatMinutes * 60) {
      SendMonitorHeartbeat();
   }
   
   // === 網頁監控：新的一天重置 ===
   static int last_day = 0;
   int current_day = get_time_info_day(TimeCurrent());
   if(current_day != last_day) {
      g_dataSentToday = false;
      last_day = current_day;
   }

'''

STATS_SEND_INSERT = '''          // === 網頁監控：發送統計 ===
          if(Monitor_AutoSend && 開始 == 0 && !g_dataSentToday) {
             SendMonitorABStats();
          }

'''

def integrate_monitor(input_path, output_path):
    """整合監控功能到 EA"""
    try:
        # 讀取原始檔案
        with open(input_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        output_lines = []
        i = 0
        
        while i < len(lines):
            line = lines[i]
            
            # 1. 在 #property strict 後插入監控參數
            if '#property strict' in line:
                output_lines.append(line)
                output_lines.append(MONITOR_PARAMS)
                i += 1
                continue
            
            # 2. 在全域變數 A總息 後插入監控全域變數
            if 'double  A總息 = 0;' in line:
                output_lines.append(line)
                output_lines.append(MONITOR_GLOBALS)
                i += 1
                continue
            
            # 3. 在 telegram_push_messages_ 函數後插入監控函數
            if 'void telegram_push_messages_' in line:
                # 找到此函數的結尾
                output_lines.append(line)
                i += 1
                while i < len(lines) and not ('}' == lines[i].strip() and 'return;' in lines[i-1]):
                    output_lines.append(lines[i])
                    i += 1
                if i < len(lines):
                    output_lines.append(lines[i])  # 函數結尾的 }
                    output_lines.append(MONITOR_FUNCTIONS)
                    i += 1
                continue
            
            # 4. 在 OnInit() 的 return 前插入初始化
            if 'return(INIT_SUCCEEDED);' in line and i > 0:
                # 檢查前面是否有 OnInit
                for j in range(max(0, i-50), i):
                    if 'int OnInit()' in lines[j]:
                        output_lines.append(ONINIT_INSERT)
                        break
                output_lines.append(line)
                i += 1
                continue
            
            # 5. 在 OnTick() 開頭插入心跳檢查
            if 'void OnTick()' in line:
                output_lines.append(line)
                i += 1
                if i < len(lines) and '{' in lines[i]:
                    output_lines.append(lines[i])
                    output_lines.append(ONTICK_START_INSERT)
                    i += 1
                continue
            
            # 6. 在統計計算完成後插入發送
            if '已發出TG通知1 = 1;' in line and i > 0:
                output_lines.append(STATS_SEND_INSERT)
                output_lines.append(line)
                i += 1
                continue
            
            # 7. 更新 version
            if '#property version' in line:
                output_lines.append('#property version "9.02"\n')
                i += 1
                continue
            
            # 其他行保持不變
            output_lines.append(line)
            i += 1
        
        # 寫入輸出檔案
        with open(output_path, 'w', encoding='utf-8') as f:
            f.writelines(output_lines)
        
        return True, f"成功創建 {output_path}"
    
    except Exception as e:
        return False, f"錯誤: {str(e)}"

def main():
    print("=" * 60)
    print("A 計算盈虧 EA - 網頁監控自動整合工具")
    print("=" * 60)
    
    input_path = os.path.join(SCRIPT_DIR, INPUT_FILE)
    output_path = os.path.join(SCRIPT_DIR, OUTPUT_FILE)
    
    # 檢查輸入檔案
    if not os.path.exists(input_path):
        print(f"\n❌ 找不到輸入檔案: {INPUT_FILE}")
        print(f"\n請將您的原始 EA 檔案重新命名為: {INPUT_FILE}")
        print(f"   或修改此腳本中的 INPUT_FILE 變數")
        print(f"\n當前目錄: {SCRIPT_DIR}")
        sys.exit(1)
    
    print(f"\n輸入檔案: {INPUT_FILE}")
    print(f"輸出檔案: {OUTPUT_FILE}")
    print("\n開始整合...")
    
    success, message = integrate_monitor(input_path, output_path)
    
    if success:
        print(f"\n✅ {message}")
        print(f"\n接下來請：")
        print(f"  1. 打開 {OUTPUT_FILE}")
        print(f"  2. 按 F7 編譯")
        print(f"  3. 設定 WebRequest 白名單")
        print(f"  4. 掛載到圖表測試")
    else:
        print(f"\n❌ {message}")
        sys.exit(1)

if __name__ == "__main__":
    main()
