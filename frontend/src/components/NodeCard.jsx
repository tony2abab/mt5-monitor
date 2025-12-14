function NodeCard({ node, onHide }) {
  const { id, name, broker, account, status, lastHeartbeatRelative, lastStatsRelative, todayABStats, todayStats, meta,
          open_buy_lots, open_sell_lots, floating_pl, balance, equity } = node
  const isOnline = status === 'online'
  
  // 檢查是否有場上數據（Monitor_OnlyHeartbeat 模式）
  // balance 和 equity 只要有值就算有場上數據
  const hasOpenData = (
    (open_buy_lots != null) || 
    (open_sell_lots != null) || 
    (floating_pl != null) ||
    (balance != null && balance > 0) || 
    (equity != null && equity > 0)
  )
  
  // 檢查 todayABStats 是否有實際的交易數據（a_lots_total 或 b_lots_total > 0）
  // 如果沒有實際交易數據但有場上數據，說明是 OnlyHeartbeat 模式
  const hasRealABStats = todayABStats && (
    (todayABStats.a_lots_total > 0) || 
    (todayABStats.b_lots_total > 0) ||
    (todayABStats.ab_profit_total !== 0 && todayABStats.ab_profit_total != null)
  )
  
  // 優先顯示場上數據（如果有），否則顯示詳細統計
  // 這樣當從詳細模式切換到 OnlyHeartbeat 模式時，會正確顯示場上數據
  const stats = hasOpenData ? null : (hasRealABStats ? todayABStats : todayStats)

  return (
    <div
      className={`
        relative overflow-hidden rounded-lg p-3 backdrop-blur
        transition-all duration-300 fade-in hover:scale-[1.01]
        ${isOnline 
          ? 'bg-cyber-darker/80 cyber-border hover:cyber-glow' 
          : 'bg-red-900/10 border border-red-500/30 hover:border-red-500/50'
        }
      `}
    >
      {/* Status indicator */}
      <div className="absolute top-2 right-2 flex items-center gap-1.5">
        <div className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'status-online' : 'status-offline'} animate-pulse`}></div>
      </div>

      {/* Header */}
      <div className="mb-2">
        <h3 className="text-base font-bold text-white mb-0.5 pr-8 truncate">{id}</h3>
      </div>

      {/* 交易對（如有） */}
      {meta?.symbols && meta.symbols.length > 0 && (
        <div className="mb-2">
          <div className="flex items-start gap-1.5">
            <span className="text-sm text-white">交易對:</span>
            <span className="text-xs text-gray-300 truncate">{meta.symbols.join(', ')}</span>
          </div>
        </div>
      )}

      {/* Heartbeat */}
      <div className="mb-2 pb-2 border-b border-gray-400/50 space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm text-white min-w-[60px]">最後心跳:</span>
          <span className={`text-xs font-medium ml-auto ${isOnline ? 'text-cyber-green' : 'text-red-400'}`}>
            {lastHeartbeatRelative}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-white min-w-[60px]">最後統計:</span>
          <span className="text-xs text-gray-300 ml-auto">
            {lastStatsRelative || '尚未收到'}
          </span>
        </div>
      </div>

      {/* A/B System Stats */}
      {stats ? (
        hasRealABStats ? (
          // 顯示 A/B 系統統計（新格式）
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm text-white min-w-[90px]">A手數總數:</span>
              <span className="text-xs font-medium text-cyan-400 ml-auto">
                {(todayABStats?.a_lots_total ?? 0).toFixed(2)}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-white min-w-[90px]">B手數總數:</span>
              <span className="text-xs font-medium text-cyan-400 ml-auto">
                {(todayABStats?.b_lots_total ?? 0).toFixed(2)}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-white min-w-[90px]">手數差 (A-B):</span>
              <span className={`text-xs font-medium ml-auto ${
                (todayABStats?.lots_diff ?? 0) !== 0 ? 'text-red-400' : 'text-gray-300'
              }`}>
                {(todayABStats?.lots_diff ?? 0) >= 0 ? '+' : ''}{(todayABStats?.lots_diff ?? 0).toFixed(2)}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-white min-w-[90px]">A盈利總數:</span>
              <span className={`text-xs font-medium ml-auto ${
                (todayABStats?.a_profit_total ?? 0) >= 0 ? 'text-cyber-green' : 'text-red-400'
              }`}>
                {(todayABStats?.a_profit_total ?? 0) >= 0 ? '+' : ''}{(todayABStats?.a_profit_total ?? 0).toFixed(2)}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-white min-w-[90px]">B盈利總數:</span>
              <span className={`text-xs font-medium ml-auto ${
                (todayABStats?.b_profit_total ?? 0) >= 0 ? 'text-cyber-green' : 'text-red-400'
              }`}>
                {(todayABStats?.b_profit_total ?? 0) >= 0 ? '+' : ''}{(todayABStats?.b_profit_total ?? 0).toFixed(2)}
              </span>
            </div>
            
            <div className="flex items-center gap-2 border-t border-gray-400/50 pt-1">
              <span className="text-sm text-cyan-400 min-w-[90px]">AB總盈利:</span>
              <span className={`text-sm font-bold ml-auto ${
                (todayABStats?.ab_profit_total ?? 0) >= 0 ? 'text-cyber-green' : 'text-red-400'
              }`}>
                {(todayABStats?.ab_profit_total ?? 0) >= 0 ? '+' : ''}{(todayABStats?.ab_profit_total ?? 0).toFixed(2)}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-white min-w-[90px]">A總息:</span>
              <span className="text-xs text-cyan-400 ml-auto">
                {(todayABStats?.a_interest_total ?? 0).toFixed(2)}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-white min-w-[90px]">回佣:</span>
              <span className="text-xs font-medium text-cyan-400 ml-auto">
                ${((todayABStats?.a_lots_total || 0) * (todayABStats?.commission_per_lot || 0)).toFixed(2)}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-white min-w-[90px]">場上手數:</span>
              <span className={`text-xs font-medium ml-auto ${
                (todayABStats?.open_lots ?? 0) === 0 ? 'text-gray-200' : 'text-yellow-400'
              }`}>
                {(todayABStats?.open_lots ?? 0).toFixed(2)}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-white min-w-[90px]">每手成本:</span>
              <span className={`text-xs font-medium ml-auto ${
                (todayABStats?.cost_per_lot ?? 0) >= 0 ? 'text-cyber-green' : 'text-red-400'
              }`}>
                {(todayABStats?.cost_per_lot ?? 0) >= 0 ? '+' : ''}{(todayABStats?.cost_per_lot ?? 0).toFixed(2)}
              </span>
            </div>
            
            <div className="flex items-center gap-2 border-t border-gray-400/50 pt-1">
              <span className="text-sm text-cyan-400 min-w-[90px]">總盈含息佣:</span>
              <span className={`text-sm font-bold ml-auto ${
                ((todayABStats?.ab_profit_total ?? 0) + (todayABStats?.a_interest_total ?? 0) + ((todayABStats?.a_lots_total || 0) * (todayABStats?.commission_per_lot || 0))) >= 0 ? 'text-cyber-green' : 'text-red-400'
              }`}>
                {((todayABStats?.ab_profit_total ?? 0) + (todayABStats?.a_interest_total ?? 0) + ((todayABStats?.a_lots_total || 0) * (todayABStats?.commission_per_lot || 0))) >= 0 ? '+' : ''}
                {((todayABStats?.ab_profit_total ?? 0) + (todayABStats?.a_interest_total ?? 0) + ((todayABStats?.a_lots_total || 0) * (todayABStats?.commission_per_lot || 0))).toFixed(2)}
              </span>
            </div>
          </div>
        ) : todayStats ? (
          // 顯示舊格式統計（向後相容）
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm text-white min-w-[60px]">當日盈虧:</span>
              <span className={`text-sm font-bold ml-auto ${
                (todayStats?.profit_loss ?? 0) >= 0 ? 'text-cyber-green' : 'text-red-400'
              }`}>
                {(todayStats?.profit_loss ?? 0) >= 0 ? '+' : ''}{(todayStats?.profit_loss ?? 0).toFixed(2)}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-white min-w-[60px]">利息:</span>
              <span className="text-[11px] text-gray-300 ml-auto">{(todayStats?.interest ?? 0).toFixed(2)}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-white min-w-[60px]">勝率:</span>
              <span className="text-[11px] text-cyber-blue ml-auto">
                {((todayStats?.avg_lots_success ?? 0) * 100).toFixed(1)}%
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-white min-w-[60px]">交易手數:</span>
              <span className="text-[11px] text-gray-300 ml-auto">{(todayStats?.lots_traded ?? 0).toFixed(2)}</span>
            </div>
          </div>
        ) : (
          <div className="text-center py-2 text-gray-500 text-[10px]">
            尚無統計數據
          </div>
        )
      ) : hasOpenData ? (
        // 顯示場上數據（Monitor_OnlyHeartbeat 模式）
        <div className="space-y-1">
          <div className="text-center text-xs text-yellow-400 mb-1 border-b border-yellow-400/30 pb-1">
            只顯示場上手數盈虧
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-white min-w-[90px]">Buy手數:</span>
            <span className="text-xs font-medium text-cyan-400 ml-auto">
              {(open_buy_lots ?? 0).toFixed(2)}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-white min-w-[90px]">Sell手數:</span>
            <span className="text-xs font-medium text-cyan-400 ml-auto">
              {(open_sell_lots ?? 0).toFixed(2)}
            </span>
          </div>
          
          <div className="flex items-center gap-2 border-t border-gray-400/50 pt-1">
            <span className="text-sm text-cyan-400 min-w-[90px]">浮動盈虧:</span>
            <span className={`text-sm font-bold ml-auto ${
              (floating_pl ?? 0) >= 0 ? 'text-cyber-green' : 'text-red-400'
            }`}>
              {(floating_pl ?? 0) >= 0 ? '+' : ''}{(floating_pl ?? 0).toFixed(2)}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-white min-w-[90px]">餘額:</span>
            <span className="text-xs font-medium text-gray-300 ml-auto">
              {(balance ?? 0).toFixed(2)}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-white min-w-[90px]">淨值:</span>
            <span className="text-xs font-medium text-white ml-auto">
              {(equity ?? 0).toFixed(2)}
            </span>
          </div>
        </div>
      ) : (
        <div className="text-center py-2 text-gray-600 text-[10px]">
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
