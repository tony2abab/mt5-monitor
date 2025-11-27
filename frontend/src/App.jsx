import { useState, useEffect, useCallback } from 'react'
import Header from './components/Header'
import NodeCard from './components/NodeCard'
import NodeTable from './components/NodeTable'
import HistoryView from './components/HistoryView'
import LoadingSpinner from './components/LoadingSpinner'
import ErrorAlert from './components/ErrorAlert'
import LoginPage from './components/LoginPage'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

function App() {
  const [nodes, setNodes] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentPage, setCurrentPage] = useState('monitor') // 'monitor' or 'history'
  const [viewMode, setViewMode] = useState('grid') // 'grid' or 'table'
  const [sortBy, setSortBy] = useState('name') // 'name', 'profit', 'lots', 'status'
  const [filterText, setFilterText] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [hideInactive, setHideInactive] = useState(false) // 隱藏不活躍節點
  const [inactiveHours, setInactiveHours] = useState(24) // 多久算不活躍（小時）
  const [hiddenNodes, setHiddenNodes] = useState({}) // 暫時隱藏的節點（直到下次心跳）
  const [selectedDate, setSelectedDate] = useState('today') // 'today' or 'yesterday'
  const [snapshotInfo, setSnapshotInfo] = useState(null) // 快照時間信息
  
  // 登入狀態
  const [authChecking, setAuthChecking] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loginRequired, setLoginRequired] = useState(false)
  
  // 檢查登入狀態
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('sessionToken')
        const response = await fetch(`${API_BASE}/auth/check`, {
          headers: token ? { 'X-Session-Token': token } : {}
        })
        const data = await response.json()
        
        if (data.ok) {
          setIsAuthenticated(data.authenticated)
          setLoginRequired(data.loginRequired)
        }
      } catch (err) {
        console.error('Auth check failed:', err)
        // 如果檢查失敗，假設不需要登入（向後兼容）
        setIsAuthenticated(true)
        setLoginRequired(false)
      } finally {
        setAuthChecking(false)
      }
    }
    
    checkAuth()
  }, [])
  
  // 登入成功回調
  const handleLoginSuccess = () => {
    setIsAuthenticated(true)
  }

  // On first load, restore hidden nodes from localStorage so they stay hidden across refresh
  useEffect(() => {
    try {
      const stored = localStorage.getItem('mt5_hidden_nodes')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed && typeof parsed === 'object') {
          setHiddenNodes(parsed)
        }
      }
    } catch (err) {
      console.error('Failed to restore hidden nodes from storage:', err)
    }
  }, [])
  // Helper function to calculate relative time
  const getRelativeTime = (timestamp) => {
    if (!timestamp) return '從未'
    
    // Handle backend format: "2025-11-20 14:09:46" (assume UTC)
    // Convert to ISO format for proper parsing
    let past
    if (timestamp.includes('T')) {
      // Already ISO format
      past = new Date(timestamp)
    } else {
      // Backend format: "YYYY-MM-DD HH:MM:SS" - treat as UTC
      past = new Date(timestamp + 'Z')
    }
    
    const now = new Date()
    const diffMs = now - past
    const diffSec = Math.floor(diffMs / 1000)
    const diffMin = Math.floor(diffSec / 60)
    const diffHour = Math.floor(diffMin / 60)
    const diffDay = Math.floor(diffHour / 24)
    
    if (diffSec < 0) return '剛剛'
    if (diffSec < 60) return `${diffSec} 秒前`
    if (diffMin < 60) return `${diffMin} 分鐘前`
    if (diffHour < 24) return `${diffHour} 小時前`
    return `${diffDay} 天前`
  }

  const fetchNodes = useCallback(async (dateOverride = null) => {
    try {
      const dateParam = dateOverride || selectedDate
      const url = dateParam === 'today' 
        ? `${API_BASE}/nodes`
        : `${API_BASE}/nodes-by-date?date=${dateParam}`
      
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch nodes')
      
      const data = await response.json()
      if (data.ok) {
        // Add relative time fields to each node (override backend's English version with Chinese)
        const nodesWithRelativeTime = data.nodes.map(node => ({
          ...node,
          lastHeartbeatRelative: getRelativeTime(node.last_heartbeat),
          lastStatsRelative: getRelativeTime(
            node.todayABStats?.reported_at || 
            node.todayStats?.reported_at || 
            node.last_ab_stats_at || 
            node.last_stats_at
          )
        }))
        
        setNodes(nodesWithRelativeTime)
        setSummary(data.summary)
        setError(null)
      } else {
        throw new Error(data.error || 'Unknown error')
      }
    } catch (err) {
      console.error('Fetch error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [selectedDate])

  // 獲取快照時間信息
  const fetchSnapshotInfo = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/snapshot-info`)
      if (response.ok) {
        const data = await response.json()
        if (data.ok) {
          setSnapshotInfo(data)
        }
      }
    } catch (err) {
      console.error('Failed to fetch snapshot info:', err)
    }
  }, [])

  const handleManualRefresh = useCallback(async () => {
    // 先刷新節點資料
    await fetchNodes()

    // 再請後端針對目前離線節點強制重發 TG 離線通知（方便測試）
    try {
      const response = await fetch(`${API_BASE}/nodes/resend-offline`, { method: 'POST' })
      if (!response.ok) {
        console.error('Failed to trigger offline notification resend')
      }
    } catch (err) {
      console.error('Error triggering offline notification resend:', err)
    }
  }, [fetchNodes])

  useEffect(() => {
    fetchNodes()
    fetchSnapshotInfo()
    
    let interval
    let snapshotInterval
    if (autoRefresh) {
      interval = setInterval(fetchNodes, 10000) // Refresh every 10 seconds
      snapshotInterval = setInterval(fetchSnapshotInfo, 30000) // Refresh snapshot info every 30 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval)
      if (snapshotInterval) clearInterval(snapshotInterval)
    }
  }, [fetchNodes, fetchSnapshotInfo, autoRefresh])

  // 當選擇日期改變時重新獲取數據
  useEffect(() => {
    fetchNodes()
  }, [selectedDate])

  // Filter and sort nodes
  const processedNodes = nodes
    .filter(node => {
      // 自動解除：如果節點有新心跳或新數據，從隱藏清單移除
      const hiddenInfo = hiddenNodes[node.id]
      if (hiddenInfo !== undefined) {
        // 檢查心跳時間或統計數據時間是否有更新
        const currentHeartbeat = node.last_heartbeat
        const currentStatsTime = node.todayABStats?.reported_at || 
                                 node.todayStats?.reported_at || 
                                 node.last_ab_stats_at || 
                                 node.last_stats_at
        
        // 如果是舊格式（只存時間字串），轉換為新格式
        let storedHeartbeat, storedStatsTime
        if (typeof hiddenInfo === 'string') {
          storedHeartbeat = hiddenInfo
          storedStatsTime = null
        } else {
          storedHeartbeat = hiddenInfo.heartbeat
          storedStatsTime = hiddenInfo.statsTime
        }
        
        // 如果心跳或統計時間有變化，解除隱藏
        const heartbeatChanged = currentHeartbeat !== storedHeartbeat
        const statsChanged = currentStatsTime && currentStatsTime !== storedStatsTime
        
        if (heartbeatChanged || statsChanged) {
          const updated = { ...hiddenNodes }
          delete updated[node.id]
          setHiddenNodes(updated)
          try {
            localStorage.setItem('mt5_hidden_nodes', JSON.stringify(updated))
          } catch (err) {
            console.error('Failed to persist hidden nodes:', err)
          }
        } else {
          return false
        }
      }

      // 文字搜尋過濾
      if (filterText) {
        const searchText = filterText.toLowerCase()
        const matchesText = (
          node.name?.toLowerCase().includes(searchText) ||
          node.id?.toLowerCase().includes(searchText) ||
          node.broker?.toLowerCase().includes(searchText) ||
          node.account?.toLowerCase().includes(searchText)
        )
        if (!matchesText) return false
      }
      
      // 不活躍節點過濾
      if (hideInactive && node.last_heartbeat) {
        const lastHeartbeat = new Date(node.last_heartbeat)
        const now = new Date()
        const hoursDiff = (now - lastHeartbeat) / (1000 * 60 * 60)
        if (hoursDiff > inactiveHours) return false
      }
      
      return true
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'profit':
          return (b.todayStats?.profit_loss || 0) - (a.todayStats?.profit_loss || 0)
        case 'lots':
          return (b.todayStats?.lots_traded || 0) - (a.todayStats?.lots_traded || 0)
        case 'status':
          if (a.status === b.status) return 0
          return a.status === 'online' ? -1 : 1
        default:
          return (a.name || '').localeCompare(b.name || '')
      }
    })

  // 重新計算 summary，只統計顯示中的節點
  const displaySummary = {
    total: processedNodes.length,
    online: processedNodes.filter(n => n.status === 'online').length,
    offline: processedNodes.filter(n => n.status === 'offline').length,
    totalABProfit: processedNodes.reduce((sum, n) => sum + (n.todayABStats?.ab_profit_total || 0), 0),
    totalALots: processedNodes.reduce((sum, n) => sum + (n.todayABStats?.a_lots_total || 0), 0),
    totalBLots: processedNodes.reduce((sum, n) => sum + (n.todayABStats?.b_lots_total || 0), 0),
    totalAInterest: processedNodes.reduce((sum, n) => sum + (n.todayABStats?.a_interest_total || 0), 0),
    // A和B是同一筆交易的兩邊，手數只需算一次
    totalCommission: processedNodes.reduce((sum, n) => {
      const lots = n.todayABStats?.a_lots_total || 0;
      const commissionRate = n.todayABStats?.commission_per_lot || 0;
      return sum + (lots * commissionRate);
    }, 0)
  }

  // 正在檢查認證狀態
  if (authChecking) {
    return (
      <div className="min-h-screen bg-cyber-dark flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }
  
  // 需要登入但未認證
  if (loginRequired && !isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />
  }

  return (
    <div className="min-h-screen bg-cyber-dark">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyber-blue/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyber-purple/5 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10">
        <Header 
          summary={displaySummary} 
          autoRefresh={autoRefresh}
          onToggleRefresh={() => setAutoRefresh(!autoRefresh)}
          onRefresh={handleManualRefresh}
          onRequestReport={fetchSnapshotInfo}
        />

        <main className="container mx-auto px-4 py-8">
          {/* Snapshot Time Info */}
          {currentPage === 'monitor' && snapshotInfo && (
            <div className="mb-2 text-sm text-white">
              <span>
                最後上報: {snapshotInfo.lastSnapshot 
                  ? `${snapshotInfo.lastSnapshot.platform} (${snapshotInfo.lastSnapshot.hk})`
                  : '尚無記錄'
                }
                {' | '}
                下次快照: {snapshotInfo.nextSnapshot.platform} ({snapshotInfo.nextSnapshot.hk})
              </span>
            </div>
          )}

          {/* Monitor Page Controls - Combined Navigation and View Controls */}
          {currentPage === 'monitor' && (
            <div className="mb-6 flex flex-wrap gap-3 items-center">
              {/* Page Navigation */}
              <div className="flex gap-2 bg-cyber-darker p-1 rounded-lg border border-cyber-blue/20">
                <button
                  onClick={() => setCurrentPage('monitor')}
                  className={`px-6 py-2 rounded transition-all ${
                    currentPage === 'monitor' 
                      ? 'bg-cyber-blue/20 text-cyber-blue font-semibold' 
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  即時監控
                </button>
                <button
                  onClick={() => setCurrentPage('history')}
                  className={`px-6 py-2 rounded transition-all ${
                    currentPage === 'history' 
                      ? 'bg-cyber-blue/20 text-cyber-blue font-semibold' 
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  歷史數據
                </button>
              </div>

              {/* View mode toggle */}
              <div className="flex gap-2 bg-cyber-darker p-1 rounded-lg border border-cyber-blue/20">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-4 py-2 rounded transition-all ${
                    viewMode === 'grid' 
                      ? 'bg-cyber-blue/20 text-cyber-blue' 
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  網格
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-4 py-2 rounded transition-all ${
                    viewMode === 'table' 
                      ? 'bg-cyber-blue/20 text-cyber-blue' 
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  表格
                </button>
              </div>

              {/* Sort dropdown */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-2 bg-cyber-darker border border-cyber-blue/20 rounded-lg text-gray-200 focus:outline-none focus:border-cyber-blue/60"
              >
                <option value="name">按名稱排序</option>
                <option value="profit">按盈虧排序</option>
                <option value="lots">按手數排序</option>
                <option value="status">按狀態排序</option>
              </select>

              {/* Hide inactive nodes toggle */}
              <button
                onClick={() => setHideInactive(!hideInactive)}
                className={`px-4 py-2 rounded-lg transition-all border ${
                  hideInactive
                    ? 'bg-red-500/20 border-red-500/50 text-red-400'
                    : 'bg-gray-700/20 border-gray-600/50 text-gray-400 hover:text-gray-200'
                }`}
                title={`隱藏 ${inactiveHours} 小時無更新的節點`}
              >
                {hideInactive ? '🚫 已隱藏舊節點' : '👁️ 顯示全部'}
              </button>

              {/* Inactive hours selector */}
              {hideInactive && (
                <select
                  value={inactiveHours}
                  onChange={(e) => setInactiveHours(Number(e.target.value))}
                  className="px-3 py-2 bg-cyber-darker border border-red-500/30 rounded-lg text-gray-200 text-sm focus:outline-none focus:border-red-500/60"
                >
                  <option value="1">1小時</option>
                  <option value="6">6小時</option>
                  <option value="12">12小時</option>
                  <option value="24">24小時</option>
                  <option value="72">3天</option>
                  <option value="168">7天</option>
                </select>
              )}

              {/* Search filter */}
              <input
                type="text"
                placeholder="搜尋節點..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="w-full sm:w-64 px-4 py-2 bg-cyber-darker border border-cyber-blue/20 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyber-blue/60"
              />

              {/* Clear stats button */}
              <button
              onClick={async () => {
                try {
                  const res = await fetch(`${API_BASE}/nodes/clear-stats`, { method: 'POST' })
                  if (!res.ok) throw new Error('Failed to clear stats')
                  await fetchNodes()
                } catch (err) {
                  console.error('Clear stats error:', err)
                  setError('清除數據失敗: ' + err.message)
                }
              }}
              className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/60 text-red-400 rounded-lg text-sm transition-all"
            >
              清除所有統計數據
            </button>

            {/* Date selector - Today/Yesterday */}
            <div className="flex gap-2 bg-cyber-darker p-1 rounded-lg border border-cyber-blue/20">
              <button
                onClick={() => setSelectedDate('today')}
                className={`px-4 py-2 rounded transition-all ${
                  selectedDate === 'today' 
                    ? 'bg-cyber-green/20 text-cyber-green font-semibold' 
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                今天
              </button>
              <button
                onClick={() => setSelectedDate('yesterday')}
                className={`px-4 py-2 rounded transition-all ${
                  selectedDate === 'yesterday' 
                    ? 'bg-cyber-green/20 text-cyber-green font-semibold' 
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                昨天
              </button>
            </div>
            </div>
          )}

          {/* History Page Navigation */}
          {currentPage === 'history' && (
            <div className="mb-6 flex gap-2 bg-cyber-darker p-1 rounded-lg border border-cyber-blue/20 w-fit">
              <button
                onClick={() => setCurrentPage('monitor')}
                className={`px-6 py-2 rounded transition-all ${
                  currentPage === 'monitor' 
                    ? 'bg-cyber-blue/20 text-cyber-blue font-semibold' 
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                即時監控
              </button>
              <button
                onClick={() => setCurrentPage('history')}
                className={`px-6 py-2 rounded transition-all ${
                  currentPage === 'history' 
                    ? 'bg-cyber-blue/20 text-cyber-blue font-semibold' 
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                歷史數據
              </button>
            </div>
          )}

          {/* Monitor Page Content */}
          {currentPage === 'monitor' && (
            <>
              {/* Error display */}
              {error && <ErrorAlert message={error} onClose={() => setError(null)} />}

              {/* Loading state */}
              {loading && <LoadingSpinner />}

              {/* Nodes display */}
              {!loading && processedNodes.length === 0 && (
            <div className="text-center py-16">
              <div className="text-gray-400 text-lg mb-2">
                {filterText ? '無符合的節點' : '尚無節點資料'}
              </div>
              <div className="text-gray-600 text-sm">
                {filterText ? '請嘗試其他搜尋條件' : '請等待 EA 節點連線'}
              </div>
            </div>
          )}

          {!loading && processedNodes.length > 0 && (
            viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                {processedNodes.map((node) => (
                  <NodeCard
                    key={node.id}
                    node={node}
                    onHide={async () => {
                      // 前端隱藏：保存當前心跳和統計時間，直到有新心跳或新數據才重新顯示
                      setHiddenNodes(prev => {
                        const currentStatsTime = node.todayABStats?.reported_at || 
                                                 node.todayStats?.reported_at || 
                                                 node.last_ab_stats_at || 
                                                 node.last_stats_at
                        
                        const updated = {
                          ...prev,
                          [node.id]: {
                            heartbeat: node.last_heartbeat || null,
                            statsTime: currentStatsTime || null
                          }
                        }
                        try {
                          localStorage.setItem('mt5_hidden_nodes', JSON.stringify(updated))
                        } catch (err) {
                          console.error('Failed to persist hidden nodes:', err)
                        }
                        return updated
                      })

                      // 後端靜音：這個節點離線時不發 TG 通知（直到下次心跳自動解除）
                      try {
                        const res = await fetch(`${API_BASE}/nodes/${encodeURIComponent(node.id)}/mute`, {
                          method: 'POST'
                        })
                        if (!res.ok) {
                          console.error('Failed to mute node for Telegram notifications')
                        }
                      } catch (err) {
                        console.error('Error muting node for Telegram notifications:', err)
                      }
                    }}
                  />
                ))}
              </div>
            ) : (
              <NodeTable nodes={processedNodes} />
            )
          )}
            </>
          )}

          {/* History Page Content */}
          {currentPage === 'history' && (
            <HistoryView />
          )}
        </main>

        {/* Footer */}
        <footer className="mt-12 pb-8 text-center text-gray-600 text-sm">
          <div className="border-t border-cyber-blue/10 pt-6">
            MT5 Trading Monitor System © 2025
          </div>
        </footer>
      </div>
    </div>
  )
}

export default App
