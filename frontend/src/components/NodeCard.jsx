function NodeCard({ node, onHide }) {
  const { id, name, broker, account, status, lastHeartbeatRelative, lastStatsRelative, todayABStats, todayStats, meta } = node
  const isOnline = status === 'online'
  
  // 優先使用 A/B 統計數據，沒有則使用舊格式（向後兼容）
  const stats = todayABStats || todayStats

  return (
    <div
      className={`
        relative overflow-hidden rounded-xl p-5 backdrop-blur
        transition-all duration-300 fade-in hover:scale-[1.02]
        ${isOnline 
          ? 'bg-cyber-darker/80 cyber-border hover:cyber-glow' 
          : 'bg-red-900/10 border border-red-500/30 hover:border-red-500/50'
        }
      `}
    >
      {/* Status indicator */}
      <div className="absolute top-3 right-3 flex items-center gap-2">
        <button
          onClick={onHide}
          className="px-2 py-1 text-[11px] rounded bg-gray-800/80 text-gray-300 hover:bg-red-500/70 hover:text-white border border-gray-600/70"
        >
          隱藏
        </button>
        <div className={`w-3 h-3 rounded-full ${isOnline ? 'status-online' : 'status-offline'} animate-pulse`}></div>
      </div>

      {/* Header */}
      <div className="mb-4">
        <h3 className="text-lg font-bold text-white mb-1 pr-8 truncate">{name}</h3>
        <p className="text-xs text-gray-500 font-mono truncate">ID: {id}</p>
      </div>

      {/* Broker & Account */}
      <div className="mb-4 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">經紀商:</span>
          <span className="text-sm text-gray-300">{broker || 'N/A'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">帳號:</span>
          <span className="text-sm text-gray-300">{account || 'N/A'}</span>
        </div>
        {meta?.symbols && meta.symbols.length > 0 && (
          <div className="flex items-start gap-2">
            <span className="text-xs text-gray-400">交易對:</span>
            <span className="text-sm text-gray-300">{meta.symbols.join(', ')}</span>
          </div>
        )}
      </div>

      {/* Heartbeat */}
      <div className="mb-4 pb-4 border-b border-gray-700/50 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">最後心跳:</span>
          <span className={`text-sm font-medium ${isOnline ? 'text-cyber-green' : 'text-red-400'}`}>
            {lastHeartbeatRelative}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">最後統計數據:</span>
          <span className="text-xs text-gray-300">
            {lastStatsRelative || '尚未收到'}
          </span>
        </div>
      </div>

      {/* A/B System Stats */}
      {stats ? (
        todayABStats ? (
          // 顯示 A/B 系統統計（新格式）
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">2. A手數總數:</span>
              <span className="text-sm font-medium text-cyan-400">
                {(todayABStats?.a_lots_total ?? 0).toFixed(2)}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">3. B手數總數:</span>
              <span className="text-sm font-medium text-cyan-400">
                {(todayABStats?.b_lots_total ?? 0).toFixed(2)}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">4. 手數差 (A-B):</span>
              <span className={`text-sm font-medium ${
                (todayABStats?.lots_diff ?? 0) !== 0 ? 'text-red-400' : 'text-gray-300'
              }`}>
                {(todayABStats?.lots_diff ?? 0) >= 0 ? '+' : ''}{(todayABStats?.lots_diff ?? 0).toFixed(2)}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">5. A盈利總數:</span>
              <span className={`text-sm font-medium ${
                (todayABStats?.a_profit_total ?? 0) >= 0 ? 'text-cyber-green' : 'text-red-400'
              }`}>
                {(todayABStats?.a_profit_total ?? 0) >= 0 ? '+' : ''}{(todayABStats?.a_profit_total ?? 0).toFixed(2)}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">6. B盈利總數:</span>
              <span className={`text-sm font-medium ${
                (todayABStats?.b_profit_total ?? 0) >= 0 ? 'text-cyber-green' : 'text-red-400'
              }`}>
                {(todayABStats?.b_profit_total ?? 0) >= 0 ? '+' : ''}{(todayABStats?.b_profit_total ?? 0).toFixed(2)}
              </span>
            </div>
            
            <div className="flex justify-between items-center border-t border-gray-700/50 pt-2">
              <span className="text-xs text-gray-400 font-bold">7. AB總盈利:</span>
              <span className={`text-lg font-bold ${
                (todayABStats?.ab_profit_total ?? 0) >= 0 ? 'text-cyber-green' : 'text-red-400'
              }`}>
                {(todayABStats?.ab_profit_total ?? 0) >= 0 ? '+' : ''}{(todayABStats?.ab_profit_total ?? 0).toFixed(2)}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">8. A總息:</span>
              <span className="text-sm text-gray-300">
                {(todayABStats?.a_interest_total ?? 0).toFixed(2)}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">9. 每手成本:</span>
              <span className={`text-sm font-medium ${
                (todayABStats?.cost_per_lot ?? 0) >= 0 ? 'text-cyber-green' : 'text-red-400'
              }`}>
                {(todayABStats?.cost_per_lot ?? 0) >= 0 ? '+' : ''}{(todayABStats?.cost_per_lot ?? 0).toFixed(2)}
              </span>
            </div>
          </div>
        ) : todayStats ? (
          // 顯示舊格式統計（向後兼容）
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">當日盈虧:</span>
              <span className={`text-lg font-bold ${
                (todayStats?.profit_loss ?? 0) >= 0 ? 'text-cyber-green' : 'text-red-400'
              }`}>
                {(todayStats?.profit_loss ?? 0) >= 0 ? '+' : ''}{(todayStats?.profit_loss ?? 0).toFixed(2)}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">利息:</span>
              <span className="text-sm text-gray-300">{(todayStats?.interest ?? 0).toFixed(2)}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">勝率:</span>
              <span className="text-sm text-cyber-blue">
                {((todayStats?.avg_lots_success ?? 0) * 100).toFixed(1)}%
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">交易手數:</span>
              <span className="text-sm text-gray-300">{(todayStats?.lots_traded ?? 0).toFixed(2)}</span>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500 text-sm">
            尚無統計數據
          </div>
        )
      ) : (
        <div className="text-center py-4 text-gray-600 text-sm">
          暫無當日統計資料
        </div>
      )}

      {/* Offline overlay */}
      {!isOnline && (
        <div className="absolute inset-0 bg-red-500/5 pointer-events-none"></div>
      )}
    </div>
  )
}

export default NodeCard
