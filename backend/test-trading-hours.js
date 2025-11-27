// 測試交易時段邏輯
require('dotenv').config();

// 模擬環境變數
process.env.TRADING_HOURS_ENABLED = 'true';
process.env.TRADING_TIMEZONE = 'Europe/London';
process.env.TRADING_HOURS_START = '01:30';
process.env.TRADING_HOURS_END = '23:30';
process.env.TRADING_DAYS_START = '1'; // 週一
process.env.TRADING_DAYS_END = '5';   // 週五

const heartbeatService = require('./src/services/heartbeat');

console.log('=== 交易時段測試 ===\n');

// 測試案例
const testCases = [
    {
        name: '週五 23:00 (交易時段內)',
        date: new Date('2025-11-21T23:00:00Z'), // UTC 時間
        expected: true
    },
    {
        name: '週六 10:00 (周末)',
        date: new Date('2025-11-22T10:00:00Z'),
        expected: false
    },
    {
        name: '週日 20:00 (周末)',
        date: new Date('2025-11-23T20:00:00Z'),
        expected: false
    },
    {
        name: '週一 01:30 (交易時段開始)',
        date: new Date('2025-11-24T01:30:00Z'),
        expected: true
    },
    {
        name: '週一 02:00 (交易時段內)',
        date: new Date('2025-11-24T02:00:00Z'),
        expected: true
    }
];

testCases.forEach(test => {
    const result = heartbeatService.isWithinTradingHoursAt(test.date);
    const status = result === test.expected ? '✅' : '❌';
    console.log(`${status} ${test.name}`);
    console.log(`   時間: ${test.date.toISOString()}`);
    console.log(`   倫敦時間: ${test.date.toLocaleString('en-GB', { timeZone: 'Europe/London', weekday: 'short', hour: '2-digit', minute: '2-digit' })}`);
    console.log(`   結果: ${result} (預期: ${test.expected})\n`);
});

console.log('\n=== 周末離線場景測試 ===\n');

// 模擬周末離線場景
const fridayEvening = new Date('2025-11-21T22:00:00Z'); // 週五晚上 22:00 UTC (倫敦時間 22:00)
const mondayMorning = new Date('2025-11-24T01:30:00Z'); // 週一早上 01:30 UTC (倫敦時間 01:30)

console.log('場景：節點在週五晚上 22:00 最後心跳，週一早上 01:30 恢復');
console.log(`上次心跳: ${fridayEvening.toLocaleString('en-GB', { timeZone: 'Europe/London', weekday: 'short', hour: '2-digit', minute: '2-digit' })}`);
console.log(`恢復時間: ${mondayMorning.toLocaleString('en-GB', { timeZone: 'Europe/London', weekday: 'short', hour: '2-digit', minute: '2-digit' })}`);

const offlineDurationHours = (mondayMorning - fridayEvening) / (1000 * 60 * 60);
console.log(`離線時長: ${offlineDurationHours.toFixed(1)} 小時`);

const wasInTradingHours = heartbeatService.isWithinTradingHoursAt(fridayEvening);
const isInTradingHours = heartbeatService.isWithinTradingHoursAt(mondayMorning);

console.log(`上次離線時在交易時段內: ${wasInTradingHours}`);
console.log(`恢復時在交易時段內: ${isInTradingHours}`);

if (offlineDurationHours > 48) {
    if (wasInTradingHours) {
        console.log('✅ 應該發送恢復通知（上次離線時在交易時段內）');
    } else {
        console.log('❌ 不應發送恢復通知（上次離線時不在交易時段，可能是周末）');
    }
} else {
    console.log('✅ 應該發送恢復通知（離線時間少於 48 小時）');
}
