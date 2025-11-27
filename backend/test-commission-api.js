// 測試回佣 API 是否正常工作
const https = require('https');

const testData = {
    id: "TEST-COMMISSION-1",
    date: "2025-11-26",
    a_lots_total: 10.5,
    b_lots_total: 10.5,
    lots_diff: 0,
    a_profit_total: 100,
    b_profit_total: -50,
    ab_profit_total: 50,
    a_interest_total: 5,
    cost_per_lot: 2.38,
    commission_per_lot: 2.0
};

console.log('=== Testing Commission API ===\n');

// 步驟 1: 發送心跳創建節點
console.log('Step 1: Sending heartbeat...');
const heartbeatData = JSON.stringify({
    id: "TEST-COMMISSION-1",
    name: "測試回佣節點",
    broker: "Test Broker",
    account: "12345"
});

const heartbeatOptions = {
    hostname: 'api.mon1.win',
    port: 443,
    path: '/api/heartbeat',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': heartbeatData.length
    }
};

const heartbeatReq = https.request(heartbeatOptions, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        console.log(`Heartbeat Status: ${res.statusCode}`);
        console.log(`Response: ${data}\n`);
        
        if (res.statusCode === 200) {
            // 步驟 2: 發送統計數據（包含回佣）
            console.log('Step 2: Sending AB stats with commission...');
            const statsData = JSON.stringify(testData);
            
            const statsOptions = {
                hostname: 'api.mon1.win',
                port: 443,
                path: '/api/ab-stats',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': statsData.length
                }
            };
            
            const statsReq = https.request(statsOptions, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    console.log(`AB Stats Status: ${res.statusCode}`);
                    console.log(`Response: ${data}\n`);
                    
                    if (res.statusCode === 200) {
                        console.log('✅ Commission API test PASSED!');
                        console.log('Backend is correctly accepting commission_per_lot parameter.');
                    } else {
                        console.log('❌ Commission API test FAILED!');
                        console.log('Backend may not be updated or restarted.');
                    }
                });
            });
            
            statsReq.on('error', (e) => {
                console.error(`❌ Error sending stats: ${e.message}`);
            });
            
            statsReq.write(statsData);
            statsReq.end();
        } else {
            console.log('❌ Heartbeat failed, cannot proceed with stats test.');
        }
    });
});

heartbeatReq.on('error', (e) => {
    console.error(`❌ Error sending heartbeat: ${e.message}`);
});

heartbeatReq.write(heartbeatData);
heartbeatReq.end();
