const Database = require('better-sqlite3');
const path = require('path');

// 嘗試不同的數據庫路徑
const possiblePaths = [
  path.join(__dirname, 'data', 'monitor.db'),
  path.join(__dirname, 'monitor.db'),
  'C:\\MT5_Monitor\\mt5-monitor\\backend\\data\\monitor.db',
  'C:\\MT5_Monitor\\mt5-monitor\\backend\\monitor.db'
];

console.log('=== 診斷 MT5 上報問題 ===\n');

let db = null;
let dbPath = null;

// 找到正確的數據庫路徑
for (const testPath of possiblePaths) {
  try {
    const fs = require('fs');
    if (fs.existsSync(testPath)) {
      db = new Database(testPath);
      dbPath = testPath;
      console.log(`✓ 找到數據庫: ${testPath}\n`);
      break;
    }
  } catch (err) {
    // 繼續嘗試下一個
  }
}

if (!db) {
  console.log('✗ 找不到數據庫文件！');
  console.log('\n請檢查以下路徑：');
  possiblePaths.forEach(p => console.log(`  - ${p}`));
  process.exit(1);
}

// 檢查表是否存在
console.log('=== 檢查數據庫表 ===\n');
const tables = db.prepare(`
  SELECT name FROM sqlite_master 
  WHERE type='table' 
  ORDER BY name
`).all();

console.log('數據庫中的表：');
tables.forEach(t => console.log(`  - ${t.name}`));

const hasReportRequests = tables.some(t => t.name === 'report_requests');
console.log(`\nreport_requests 表: ${hasReportRequests ? '✓ 存在' : '✗ 不存在'}`);

if (!hasReportRequests) {
  console.log('\n⚠️  警告：report_requests 表不存在！');
  console.log('   需要運行數據庫遷移：');
  console.log('   node migrate-add-report-features.js');
  db.close();
  process.exit(1);
}

// 查看上報請求
console.log('\n=== 上報請求記錄 ===\n');
const requests = db.prepare(`
  SELECT * FROM report_requests 
  ORDER BY requested_at DESC 
  LIMIT 10
`).all();

if (requests.length === 0) {
  console.log('沒有上報請求記錄');
  console.log('這可能表示：');
  console.log('  1. 從未按過「要求MT5上報數據」按鈕');
  console.log('  2. 所有請求都已被消費且清理');
} else {
  requests.forEach((req, index) => {
    console.log(`${index + 1}. 請求 ID: ${req.id}`);
    console.log(`   目標節點: ${req.node_id || '全部節點'}`);
    console.log(`   請求時間: ${req.requested_at}`);
    console.log(`   已消費: ${req.consumed ? '是' : '否'}`);
    if (req.consumed) {
      console.log(`   消費時間: ${req.consumed_at}`);
    }
    console.log('');
  });
}

// 查看節點列表
console.log('\n=== 節點列表 ===\n');
const nodes = db.prepare(`
  SELECT id, name, status, last_heartbeat 
  FROM nodes 
  ORDER BY last_heartbeat DESC
`).all();

if (nodes.length === 0) {
  console.log('沒有節點記錄');
} else {
  nodes.forEach((node, index) => {
    console.log(`${index + 1}. ${node.name}`);
    console.log(`   Node ID: ${node.id}`);
    console.log(`   狀態: ${node.status}`);
    console.log(`   最後心跳: ${node.last_heartbeat}`);
    
    // 檢查該節點的最近上報請求
    const nodeRequests = db.prepare(`
      SELECT * FROM report_requests 
      WHERE node_id = ? OR node_id IS NULL
      ORDER BY requested_at DESC 
      LIMIT 3
    `).all(node.id);
    
    if (nodeRequests.length > 0) {
      console.log(`   最近上報請求: ${nodeRequests.length} 條`);
      nodeRequests.forEach(req => {
        console.log(`     - ${req.requested_at} (${req.consumed ? '已消費' : '未消費'})`);
      });
    }
    console.log('');
  });
}

// 檢查 ab_stats 表
console.log('\n=== 最近的數據上報 ===\n');
const recentStats = db.prepare(`
  SELECT node_id, reported_at 
  FROM ab_stats 
  ORDER BY reported_at DESC 
  LIMIT 10
`).all();

if (recentStats.length === 0) {
  console.log('沒有數據上報記錄');
} else {
  console.log('最近的數據上報：');
  recentStats.forEach((stat, index) => {
    const node = nodes.find(n => n.id === stat.node_id);
    console.log(`${index + 1}. ${node ? node.name : stat.node_id} - ${stat.reported_at}`);
  });
}

db.close();

console.log('\n=== 診斷建議 ===\n');
console.log('如果某台 MT5 沒有收到上報請求，請檢查：');
console.log('1. MT5 EA 參數 Report_Mode_OnDemand 是否為 true');
console.log('2. MT5 EA 的 NodeID 是否與上面列出的節點 ID 一致');
console.log('3. MT5 是否連接到交易服務器（OnTick 是否被觸發）');
console.log('4. MT5 Expert 日誌中是否有「檢查上報請求」的輸出');
console.log('5. 網絡連接是否正常（能否訪問後端 API）');
