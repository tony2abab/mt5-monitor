// 測試交易日和收市時段邏輯

// 模擬 getCurrentTradingDate 函數
function getCurrentTradingDate(testTime) {
    const timezone = 'Europe/London';
    const londonTime = new Date(testTime.toLocaleString('en-US', { timeZone: timezone }));
    
    const hours = londonTime.getHours();
    const minutes = londonTime.getMinutes();
    const timeInMinutes = hours * 60 + minutes;
    
    // 如果在 00:00-01:30 之間，使用前一天的日期
    if (timeInMinutes < 90) { // 01:30 = 90 分鐘
        londonTime.setDate(londonTime.getDate() - 1);
    }
    
    const year = londonTime.getFullYear();
    const month = String(londonTime.getMonth() + 1).padStart(2, '0');
    const day = String(londonTime.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
}

// 模擬 isMarketClosingTime 函數
function isMarketClosingTime(testTime) {
    const timezone = 'Europe/London';
    const londonTime = new Date(testTime.toLocaleString('en-US', { timeZone: timezone }));
    
    const hours = londonTime.getHours();
    const minutes = londonTime.getMinutes();
    const timeInMinutes = hours * 60 + minutes;
    
    const closingStart = 23 * 60 + 55; // 23:55
    const closingEnd = 1 * 60 + 30;     // 01:30
    
    // 跨越午夜的時段（23:55-01:29，不包含 01:30）
    if (timeInMinutes >= closingStart || timeInMinutes < closingEnd) {
        return true;
    }
    
    return false;
}

console.log('=== 測試交易日邏輯 ===\n');

// 測試案例 (11月倫敦時間 = UTC+0)
const testCases = [
    { date: '2025-11-25T23:45:00.000Z', desc: '倫敦時間 25日 23:45 (MT5發送數據時間)' },
    { date: '2025-11-25T23:55:00.000Z', desc: '倫敦時間 25日 23:55 (收市開始)' },
    { date: '2025-11-26T00:00:00.000Z', desc: '倫敦時間 26日 00:00 (午夜)' },
    { date: '2025-11-26T00:05:00.000Z', desc: '倫敦時間 26日 00:05 (你收到錯誤離線通知的時間)' },
    { date: '2025-11-26T00:30:00.000Z', desc: '倫敦時間 26日 00:30 (快照時間)' },
    { date: '2025-11-26T01:00:00.000Z', desc: '倫敦時間 26日 01:00 (你收到錯誤恢復通知的時間)' },
    { date: '2025-11-26T01:29:00.000Z', desc: '倫敦時間 26日 01:29 (收市結束前1分鐘)' },
    { date: '2025-11-26T01:30:00.000Z', desc: '倫敦時間 26日 01:30 (新交易日開始)' },
    { date: '2025-11-26T01:31:00.000Z', desc: '倫敦時間 26日 01:31 (新交易日開始後)' },
    { date: '2025-11-26T10:00:00.000Z', desc: '倫敦時間 26日 10:00 (正常交易時段)' }
];

testCases.forEach(({ date, desc }) => {
    const testTime = new Date(date);
    const londonTime = new Date(testTime.toLocaleString('en-US', { timeZone: 'Europe/London' }));
    const tradingDate = getCurrentTradingDate(testTime);
    const isClosing = isMarketClosingTime(testTime);
    
    const londonTimeStr = londonTime.toLocaleString('sv-SE', { timeZone: 'Europe/London' });
    
    console.log(`${desc}`);
    console.log(`  倫敦時間: ${londonTimeStr}`);
    console.log(`  交易日期: ${tradingDate}`);
    console.log(`  收市時段: ${isClosing ? '是 (不發離線通知)' : '否 (可發離線通知)'}`);
    console.log('');
});

console.log('=== 預期結果 ===');
console.log('✅ 25日 23:45-26日 01:30 之間：');
console.log('   - 交易日期應該都是 2025-11-25');
console.log('   - 都在收市時段，不發離線通知');
console.log('✅ 26日 01:30 之後：');
console.log('   - 交易日期應該是 2025-11-26');
console.log('   - 不在收市時段，可發離線通知');
