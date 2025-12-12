const API_BASE = import.meta.env.VITE_API_BASE || '/api'

function NodeTable({ nodes, onHideNode, onDeleteNode }){
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-cyber-darker/80 border-b border-cyber-blue/30">
            <th className="text-left p-4 text-sm font-semibold text-cyber-blue">狀態</th>
            <th className="text-left p-4 text-sm font-semibold text-cyber-blue">節點 ID</th>
            <th className="text-left p-4 text-sm font-semibold text-cyber-blue">帳號</th>
            <th className="text-left p-4 text-sm font-semibold text-cyber-blue">經紀商</th>
            <th className="text-right p-4 text-sm font-semibold text-cyber-blue">A手數</th>
            <th className="text-right p-4 text-sm font-semibold text-cyber-blue">B手數</th>
            <th className="text-right p-4 text-sm font-semibold text-cyber-blue">手數差</th>
            <th className="text-right p-4 text-sm font-semibold text-cyber-blue">A盈利</th>
            <th className="text-right p-4 text-sm font-semibold text-cyber-blue">B盈利</th>
            <th className="text-right p-4 text-sm font-semibold text-cyber-blue">AB總盈虧</th>
            <th className="text-right p-4 text-sm font-semibold text-cyber-blue">A總息</th>
            <th className="text-right p-4 text-sm font-semibold text-cyber-blue">場上手數</th>
            <th className="text-right p-4 text-sm font-semibold text-cyber-blue">每手成本</th>
            <th className="text-right p-4 text-sm font-semibold text-cyber-blue">總盈含息佣</th>
            <th className="text-right p-4 text-sm font-semibold text-cyber-blue">最後心跳</th>
            <th className="text-center p-4 text-sm font-semibold text-cyber-blue">操作</th>
          </tr>
        </thead>
        <tbody>
          {nodes.map((node, index) => {
            const isOnline = node.status === 'online'
            const abStats = node.todayABStats
            const legacyStats = node.todayStats

            return (
              <tr
                key={node.id}
                className={`
                  border-b border-gray-800/50 hover:bg-cyber-blue/5 transition-colors
                  ${!isOnline ? 'bg-red-900/10' : ''}
                  ${index % 2 === 0 ? 'bg-cyber-darker/20' : ''}
                `}
              >
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${isOnline ? 'status-online' : 'status-offline'}`}></div>
                    <span className={`text-sm ${isOnline ? 'text-cyber-green' : 'text-red-400'}`}>
                      {isOnline ? '在線' : '離線'}
                    </span>
                  </div>
                </td>
                <td className="p-4">
                  <div className="text-sm font-medium text-white">{node.id}</div>
                </td>
                <td className="p-4 text-sm text-gray-300">{node.account || 'N/A'}</td>
                <td className="p-4 text-sm text-gray-300">{node.broker || 'N/A'}</td>

                {/* A手數 */}
                <td className="p-4 text-right text-sm font-medium text-cyan-400">
                  {abStats ? (abStats.a_lots_total ?? 0).toFixed(2) : '-'}
                </td>

                {/* B手數 */}
                <td className="p-4 text-right text-sm font-medium text-cyan-400">
                  {abStats ? (abStats.b_lots_total ?? 0).toFixed(2) : '-'}
                </td>

                {/* 手數差 */}
                <td className={`p-4 text-right text-sm font-medium ${
                  (abStats?.lots_diff ?? 0) !== 0 ? 'text-red-400' : 'text-gray-300'
                }`}>
                  {abStats
                    ? `${abStats.lots_diff >= 0 ? '+' : ''}${abStats.lots_diff.toFixed(2)}`
                    : '-'}
                </td>

                {/* A盈利 */}
                <td className={`p-4 text-right text-sm font-medium ${
                  (abStats?.a_profit_total ?? 0) >= 0 ? 'text-cyber-green' : 'text-red-400'
                }`}>
                  {abStats
                    ? `${abStats.a_profit_total >= 0 ? '+' : ''}${abStats.a_profit_total.toFixed(2)}`
                    : '-'}
                </td>

                {/* B盈利 */}
                <td className={`p-4 text-right text-sm font-medium ${
                  (abStats?.b_profit_total ?? 0) >= 0 ? 'text-cyber-green' : 'text-red-400'
                }`}>
                  {abStats
                    ? `${abStats.b_profit_total >= 0 ? '+' : ''}${abStats.b_profit_total.toFixed(2)}`
                    : '-'}
                </td>

                {/* AB總盈虧 */}
                <td className={`p-4 text-right text-sm font-semibold ${
                  (abStats?.ab_profit_total ?? 0) >= 0 ? 'text-cyber-green' : 'text-red-400'
                }`}>
                  {abStats
                    ? `${abStats.ab_profit_total >= 0 ? '+' : ''}${abStats.ab_profit_total.toFixed(2)}`
                    : '-'}
                </td>

                {/* A總息 */}
                <td className="p-4 text-right text-sm text-gray-300">
                  {abStats ? (abStats.a_interest_total ?? 0).toFixed(2) : '-'}
                </td>

                {/* 場上手數 */}
                <td className={`p-4 text-right text-sm font-medium ${
                  (abStats?.open_lots ?? 0) === 0 ? 'text-gray-200' : 'text-yellow-400'
                }`}>
                  {abStats ? (abStats.open_lots ?? 0).toFixed(2) : '-'}
                </td>

                {/* 每手成本 */}
                <td
                  className={`p-4 text-right text-sm font-medium ${
                    (abStats?.cost_per_lot ?? 0) >= 0 ? 'text-cyber-green' : 'text-red-400'
                  }`}
                >
                  {abStats
                    ? `${abStats.cost_per_lot >= 0 ? '+' : ''}${abStats.cost_per_lot.toFixed(2)}`
                    : '-'}
                </td>

                {/* 總盈含息佣 = AB總盈虧 + A總息 + 回佣 */}
                <td
                  className={`p-4 text-right text-sm font-semibold ${
                    abStats
                      ? ((abStats.ab_profit_total ?? 0) + (abStats.a_interest_total ?? 0) + ((abStats.a_lots_total || 0) * (abStats.commission_per_lot || 0))) >= 0
                        ? 'text-cyber-green'
                        : 'text-red-400'
                      : 'text-gray-300'
                  }`}
                >
                  {abStats
                    ? `${((abStats.ab_profit_total ?? 0) + (abStats.a_interest_total ?? 0) + ((abStats.a_lots_total || 0) * (abStats.commission_per_lot || 0))) >= 0 ? '+' : ''}${((abStats.ab_profit_total ?? 0) + (abStats.a_interest_total ?? 0) + ((abStats.a_lots_total || 0) * (abStats.commission_per_lot || 0))).toFixed(2)}`
                    : '-'}
                </td>

                {/* 最後心跳 */}
                <td className={`p-4 text-right text-sm ${isOnline ? 'text-gray-400' : 'text-red-400'}`}>
                  {node.lastHeartbeatRelative}
                </td>

                {/* 操作按鈕 */}
                <td className="p-4 text-center">
                  <div className="flex gap-2 justify-center">
                    {onHideNode && (
                      <button
                        onClick={() => onHideNode(node)}
                        className="px-2 py-1 text-xs rounded bg-gray-700/50 text-gray-300 hover:bg-yellow-500/50 hover:text-white border border-gray-600/50 transition-all"
                      >
                        隱藏
                      </button>
                    )}
                    {onDeleteNode && (
                      <button
                        onClick={() => {
                          if (confirm(`確定要刪除節點 "${node.id}" 的所有記錄嗎？`)) {
                            onDeleteNode(node.id)
                          }
                        }}
                        className="px-2 py-1 text-xs rounded bg-red-500/20 text-red-400 hover:bg-red-500/50 hover:text-white border border-red-500/50 transition-all"
                      >
                        刪除
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default NodeTable
