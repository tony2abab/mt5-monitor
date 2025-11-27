const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'monitor.db');
const db = new Database(dbPath);

console.log('\n=== 檢查上報請求表 ===\n');

// 查看所有上報請求
const requests = db.prepare(`
  SELECT * FROM report_requests 
  ORDER BY requested_at DESC 
  LIMIT 20
`).all();

console.log(`找到 ${requests.length} 條上報請求記錄：\n`);

requests.forEach((req, index) => {
  console.log(`${index + 1}. ID: ${req.id}`);
  console.log(`   Node ID: ${req.node_id || '全部節點'}`);
  console.log(`   請求時間: ${req.requested_at}`);
  console.log(`   已消費: ${req.consumed ? '是' : '否'}`);
  console.log(`   消費時間: ${req.consumed_at || 'N/A'}`);
  console.log('');
});

// 查看所有節點
console.log('\n=== 所有節點列表 ===\n');
const nodes = db.prepare(`
  SELECT id, name, status, last_heartbeat 
  FROM nodes 
  ORDER BY last_heartbeat DESC
`).all();

nodes.forEach((node, index) => {
  console.log(`${index + 1}. ${node.name} (${node.id})`);
  console.log(`   狀態: ${node.status}`);
  console.log(`   最後心跳: ${node.last_heartbeat}`);
  console.log('');
});

db.close();
