// 配置文件完整性驗證腳本
// 檢查 ecosystem.config.js 是否包含所有必要的配置

const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'backend', 'ecosystem.config.js');

console.log('=== 驗證 ecosystem.config.js 配置完整性 ===\n');

if (!fs.existsSync(configPath)) {
    console.error('❌ 配置文件不存在:', configPath);
    process.exit(1);
}

// 讀取配置文件
const configContent = fs.readFileSync(configPath, 'utf8');

// 必須包含的配置項
const requiredConfigs = [
    { key: 'PORT', desc: '服務端口' },
    { key: 'DB_PATH', desc: '數據庫路徑' },
    { key: 'API_KEY', desc: 'API 密鑰' },
    { key: 'HEARTBEAT_TIMEOUT_SECONDS', desc: '心跳超時' },
    { key: 'TRADING_HOURS_ENABLED', desc: '交易時段啟用' },
    { key: 'TRADING_TIMEZONE', desc: '交易時區' },
    { key: 'TRADING_DAYS_START', desc: '交易日開始' },
    { key: 'TRADING_DAYS_END', desc: '交易日結束' },
    { key: 'TRADING_HOURS_START', desc: '交易時段開始' },
    { key: 'TRADING_HOURS_END', desc: '交易時段結束' },
    { key: 'REPORT_TIME_1', desc: '定時上報時間1' },
    { key: 'REPORT_TIME_2', desc: '定時上報時間2' },
    { key: 'TELEGRAM_BOT_TOKEN', desc: 'Telegram Bot Token' },
    { key: 'TELEGRAM_CHAT_ID', desc: 'Telegram Chat ID' }
];

let allPresent = true;
let missingConfigs = [];

console.log('檢查必要配置項：\n');

requiredConfigs.forEach(config => {
    const regex = new RegExp(`${config.key}\\s*:`);
    const found = regex.test(configContent);
    
    if (found) {
        console.log(`✓ ${config.key.padEnd(30)} - ${config.desc}`);
    } else {
        console.log(`✗ ${config.key.padEnd(30)} - ${config.desc} (缺失)`);
        allPresent = false;
        missingConfigs.push(config);
    }
});

console.log('\n=== 驗證結果 ===\n');

if (allPresent) {
    console.log('✅ 所有必要配置項都存在！');
    process.exit(0);
} else {
    console.log('❌ 缺少以下配置項：\n');
    missingConfigs.forEach(config => {
        console.log(`  - ${config.key}: ${config.desc}`);
    });
    console.log('\n請添加缺失的配置項。');
    process.exit(1);
}
