import { useState, useEffect } from 'react'

function Header({ summary, autoRefresh, onToggleRefresh, onRefresh, onRequestReport, username, selectedGroup, onLogout }) {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <header className="bg-cyber-darker border-b border-cyber-blue/20 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          {/* Title */}
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-cyber-blue via-cyber-purple to-cyber-pink bg-clip-text text-transparent">
              WintradeX
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              {currentTime.toLocaleString('zh-TW', { 
                year: 'numeric',
                month: '2-digit', 
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              })}
            </p>
          </div>

          {/* Summary stats */}
          {summary && (
            <div className="flex flex-wrap gap-2">
              <div className="cyber-border px-3 py-2 rounded-lg bg-cyber-darker/50 backdrop-blur">
                <div className="text-[10px] text-gray-400 mb-0.5">總節點</div>
                <div className="text-lg font-bold text-white">{summary.total}</div>
              </div>
              
              <div className="cyber-border px-3 py-2 rounded-lg bg-cyber-darker/50 backdrop-blur">
                <div className="text-[10px] text-gray-400 mb-0.5">在線</div>
                <div className="text-lg font-bold text-cyber-green">{summary.online}</div>
              </div>
              
              <div className="cyber-border px-3 py-2 rounded-lg bg-cyber-darker/50 backdrop-blur">
                <div className="text-[10px] text-gray-400 mb-0.5">離線</div>
                <div className="text-lg font-bold text-red-400">{summary.offline}</div>
              </div>
              
              <div className="cyber-border px-3 py-2 rounded-lg bg-cyber-darker/50 backdrop-blur">
                <div className="text-[10px] text-gray-400 mb-0.5">AB總盈虧</div>
                <div className={`text-lg font-bold ${
                  (summary.totalABProfit ?? 0) >= 0 ? 'text-cyber-green' : 'text-red-400'
                }`}>
                  {(summary.totalABProfit ?? 0) >= 0 ? '+' : ''}${(summary.totalABProfit ?? 0).toFixed(2)}
                </div>
              </div>
              
              <div className="cyber-border px-3 py-2 rounded-lg bg-cyber-darker/50 backdrop-blur">
                <div className="text-[10px] text-gray-400 mb-0.5">A總手數</div>
                <div className="text-lg font-bold text-cyan-400">
                  {(summary.totalALots ?? 0).toFixed(2)}
                </div>
              </div>
              
              <div className="cyber-border px-3 py-2 rounded-lg bg-cyber-darker/50 backdrop-blur">
                <div className="text-[10px] text-gray-400 mb-0.5">B總手數</div>
                <div className="text-lg font-bold text-cyan-400">
                  {(summary.totalBLots ?? 0).toFixed(2)}
                </div>
              </div>

              <div className="cyber-border px-3 py-2 rounded-lg bg-cyber-darker/50 backdrop-blur">
                <div className="text-[10px] text-gray-400 mb-0.5">A總息</div>
                <div className="text-lg font-bold text-cyan-400">
                  {(summary.totalAInterest ?? 0).toFixed(2)}
                </div>
              </div>

              <div className="cyber-border px-3 py-2 rounded-lg bg-cyber-darker/50 backdrop-blur">
                <div className="text-[10px] text-gray-400 mb-0.5">總回佣</div>
                <div className="text-lg font-bold text-cyan-400">
                  ${(summary.totalCommission ?? 0).toFixed(2)}
                </div>
              </div>

              <div className="cyber-border px-3 py-2 rounded-lg bg-cyber-darker/50 backdrop-blur">
                <div className="text-[10px] text-gray-400 mb-0.5">總盈含息佣</div>
                <div className={`text-lg font-bold ${
                  ((summary.totalABProfit ?? 0) + (summary.totalAInterest ?? 0) + (summary.totalCommission ?? 0)) >= 0 ? 'text-cyber-green' : 'text-red-400'
                }`}>
                  {((summary.totalABProfit ?? 0) + (summary.totalAInterest ?? 0) + (summary.totalCommission ?? 0)) >= 0 ? '+' : ''}${((summary.totalABProfit ?? 0) + (summary.totalAInterest ?? 0) + (summary.totalCommission ?? 0)).toFixed(2)}
                </div>
              </div>
            </div>
          )}

          {/* Refresh controls */}
          <div className="flex gap-2 items-center">
            {/* User info and current group */}
            {username && (
              <div className="text-sm mr-2 text-right">
                <div className="text-gray-400">
                  用戶: <span className="text-cyber-blue">{username}</span>
                </div>
                {selectedGroup && (
                  <div className="text-gray-400">
                    分組: <span className="text-cyber-purple">{selectedGroup === 'all' ? '全部' : selectedGroup}</span>
                  </div>
                )}
              </div>
            )}
            {onLogout && (
              <button
                onClick={onLogout}
                className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-400 rounded-lg transition-all"
              >
                登出
              </button>
            )}
            <button
              onClick={async () => {
                if (isRefreshing) return
                setIsRefreshing(true)
                try {
                  await onRefresh()
                } finally {
                  setTimeout(() => setIsRefreshing(false), 500)
                }
              }}
              disabled={isRefreshing}
              className={`px-4 py-2 border rounded-lg transition-all ${
                isRefreshing
                  ? 'bg-cyber-green/30 border-cyber-green/50 text-cyber-green animate-pulse'
                  : 'bg-cyber-blue/20 hover:bg-cyber-blue/30 border-cyber-blue/50 text-cyber-blue hover:cyber-glow'
              }`}
            >
              {isRefreshing ? '🔄 刷新中...' : '刷新'}
            </button>
            <button
              onClick={onToggleRefresh}
              className={`px-4 py-2 border rounded-lg transition-all ${
                autoRefresh
                  ? 'bg-cyber-green/20 border-cyber-green/50 text-cyber-green'
                  : 'bg-gray-700/20 border-gray-600/50 text-gray-400'
              }`}
            >
              {autoRefresh ? '自動刷新' : '手動模式'}
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
