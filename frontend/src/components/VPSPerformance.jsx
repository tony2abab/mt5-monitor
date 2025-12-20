import { useState, useEffect } from 'react'
import LoadingSpinner from './LoadingSpinner'
import ErrorAlert from './ErrorAlert'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

function VPSPerformance() {
  const [vpsList, setVpsList] = useState([])
  const [thresholds, setThresholds] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [expandedVPS, setExpandedVPS] = useState(null)
  const [historyData, setHistoryData] = useState({})

  // 獲取 VPS 列表
  const fetchVPSList = async () => {
    try {
      const token = localStorage.getItem('sessionToken')
      const response = await fetch(`${API_BASE}/vps/list`, {
        headers: token ? { 'X-Session-Token': token } : {}
      })
      
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('權限不足：僅管理員可查看 VPS 效能')
        }
        throw new Error('Failed to fetch VPS list')
      }
      
      const data = await response.json()
      if (data.ok) {
        setVpsList(data.vpsList)
        setThresholds(data.thresholds)
        setError(null)
      } else {
        throw new Error(data.error || 'Unknown error')
      }
    } catch (err) {
      console.error('Fetch VPS list error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // 獲取 VPS 歷史數據
  const fetchVPSHistory = async (vpsName) => {
    try {
      const token = localStorage.getItem('sessionToken')
      const response = await fetch(`${API_BASE}/vps/metrics/${vpsName}?hours=24`, {
        headers: token ? { 'X-Session-Token': token } : {}
      })
      
      if (!response.ok) throw new Error('Failed to fetch VPS history')
      
      const data = await response.json()
      if (data.ok) {
        setHistoryData(prev => ({ ...prev, [vpsName]: data.history }))
      }
    } catch (err) {
      console.error('Fetch VPS history error:', err)
    }
  }

  useEffect(() => {
    fetchVPSList()
    
    let interval
    if (autoRefresh) {
      interval = setInterval(fetchVPSList, 30000) // 每 30 秒刷新
    }
    
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [autoRefresh])

  // 切換展開/收起
  const toggleExpand = (vpsName) => {
    if (expandedVPS === vpsName) {
      setExpandedVPS(null)
    } else {
      setExpandedVPS(vpsName)
      if (!historyData[vpsName]) {
        fetchVPSHistory(vpsName)
      }
    }
  }

  // 獲取狀態顏色和圖標
  const getStatusDisplay = (status) => {
    switch (status) {
      case 'normal':
        return { icon: '🟢', text: '正常', color: 'text-green-400' }
      case 'warning':
        return { icon: '🟡', text: '警告', color: 'text-yellow-400' }
      case 'critical':
        return { icon: '🔴', text: '嚴重', color: 'text-red-400' }
      case 'offline':
        return { icon: '⚫', text: '離線', color: 'text-gray-400' }
      default:
        return { icon: '❓', text: '未知', color: 'text-gray-400' }
    }
  }

  // 格式化數值
  const formatValue = (value, metricName) => {
    if (value === null || value === undefined) return '-'
    
    if (metricName.includes('percent')) {
      return `${value.toFixed(1)}%`
    } else if (metricName.includes('latency')) {
      return `${value.toFixed(1)}ms`
    } else if (metricName.includes('memory_available')) {
      return `${(value / 1024).toFixed(2)}GB`
    } else {
      return value.toFixed(2)
    }
  }

  // 檢查數值是否超過閾值
  const getValueClass = (value, metricName) => {
    if (value === null || value === undefined) return ''
    
    const threshold = thresholds.find(t => t.metric_name === metricName)
    if (!threshold) return ''
    
    if (value >= threshold.critical_threshold) {
      return 'bg-red-500/30 text-red-300 font-bold'
    } else if (value >= threshold.warning_threshold) {
      return 'bg-yellow-500/30 text-yellow-300 font-bold'
    }
    return ''
  }

  // 指標中文名稱
  const metricNames = {
    'cpu_queue_length': 'CPU 隊列',
    'cpu_usage_percent': 'CPU 使用率',
    'context_switches_per_sec': '上下文切換',
    'disk_queue_length': '磁碟隊列',
    'disk_read_latency_ms': '讀取延遲',
    'disk_write_latency_ms': '寫入延遲',
    'memory_available_mb': '可用記憶體',
    'memory_usage_percent': '記憶體使用率'
  }

  // 統計摘要
  const summary = {
    total: vpsList.length,
    normal: vpsList.filter(v => v.status === 'normal').length,
    warning: vpsList.filter(v => v.status === 'warning').length,
    critical: vpsList.filter(v => v.status === 'critical').length,
    offline: vpsList.filter(v => v.status === 'offline').length
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cyber-dark flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 標題和控制 */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">VPS 效能監控</h2>
        <div className="flex gap-3 items-center">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-4 py-2 rounded-lg transition-all ${
              autoRefresh
                ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                : 'bg-gray-700/20 text-gray-400 border border-gray-600/50'
            }`}
          >
            {autoRefresh ? '⏸️ 自動刷新' : '▶️ 手動模式'}
          </button>
          <button
            onClick={fetchVPSList}
            className="px-4 py-2 bg-cyber-blue/20 text-cyber-blue border border-cyber-blue/50 rounded-lg hover:bg-cyber-blue/30 transition-all"
          >
            🔄 刷新
          </button>
        </div>
      </div>

      {/* 錯誤提示 */}
      {error && <ErrorAlert message={error} onClose={() => setError(null)} />}

      {/* 總覽卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-cyber-darker border border-cyber-blue/20 rounded-lg p-4">
          <div className="text-gray-400 text-sm mb-1">總 VPS 數</div>
          <div className="text-3xl font-bold text-white">{summary.total}</div>
        </div>
        <div className="bg-cyber-darker border border-green-500/20 rounded-lg p-4">
          <div className="text-gray-400 text-sm mb-1">正常</div>
          <div className="text-3xl font-bold text-green-400">{summary.normal}</div>
        </div>
        <div className="bg-cyber-darker border border-yellow-500/20 rounded-lg p-4">
          <div className="text-gray-400 text-sm mb-1">警告</div>
          <div className="text-3xl font-bold text-yellow-400">{summary.warning}</div>
        </div>
        <div className="bg-cyber-darker border border-red-500/20 rounded-lg p-4">
          <div className="text-gray-400 text-sm mb-1">嚴重</div>
          <div className="text-3xl font-bold text-red-400">{summary.critical}</div>
        </div>
        <div className="bg-cyber-darker border border-gray-500/20 rounded-lg p-4">
          <div className="text-gray-400 text-sm mb-1">離線</div>
          <div className="text-3xl font-bold text-gray-400">{summary.offline}</div>
        </div>
      </div>

      {/* VPS 列表 */}
      {vpsList.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-lg mb-2">尚無 VPS 數據</div>
          <div className="text-sm">請在被監察 VPS 上部署監測腳本</div>
        </div>
      ) : (
        <div className="bg-cyber-darker border border-cyber-blue/20 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-cyber-blue/10 border-b border-cyber-blue/20">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">VPS 名稱</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-300">狀態</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-300">CPU 隊列 (1)</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-300">上下文切換 (2)</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-300">磁碟隊列 (3)</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-300">讀延遲 (4)</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-300">寫延遲 (5)</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-300">CPU % (6)</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-300">記憶體 % (7)</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-300">最後更新</th>
              </tr>
            </thead>
            <tbody>
              {vpsList.map((vps) => {
                const statusDisplay = getStatusDisplay(vps.status)
                const metrics = vps.metrics
                
                return (
                  <tr
                    key={vps.vps_name}
                    className="border-b border-cyber-blue/10 hover:bg-cyber-blue/5 cursor-pointer transition-colors"
                    onClick={() => toggleExpand(vps.vps_name)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">{vps.vps_name}</span>
                        {vps.vps_ip && (
                          <span className="text-xs text-gray-500">({vps.vps_ip})</span>
                        )}
                      </div>
                      {vps.description && (
                        <div className="text-xs text-gray-500 mt-1">{vps.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 ${statusDisplay.color}`}>
                        {statusDisplay.icon} {statusDisplay.text}
                      </span>
                    </td>
                    {metrics ? (
                      <>
                        <td className={`px-4 py-3 text-center ${getValueClass(metrics.cpu_queue_length, 'cpu_queue_length')}`}>
                          {formatValue(metrics.cpu_queue_length, 'cpu_queue_length')}
                        </td>
                        <td className={`px-4 py-3 text-center ${getValueClass(metrics.context_switches_per_sec, 'context_switches_per_sec')}`}>
                          {formatValue(metrics.context_switches_per_sec, 'context_switches_per_sec')}
                        </td>
                        <td className={`px-4 py-3 text-center ${getValueClass(metrics.disk_queue_length, 'disk_queue_length')}`}>
                          {formatValue(metrics.disk_queue_length, 'disk_queue_length')}
                        </td>
                        <td className={`px-4 py-3 text-center ${getValueClass(metrics.disk_read_latency_ms, 'disk_read_latency_ms')}`}>
                          {formatValue(metrics.disk_read_latency_ms, 'disk_read_latency_ms')}
                        </td>
                        <td className={`px-4 py-3 text-center ${getValueClass(metrics.disk_write_latency_ms, 'disk_write_latency_ms')}`}>
                          {formatValue(metrics.disk_write_latency_ms, 'disk_write_latency_ms')}
                        </td>
                        <td className={`px-4 py-3 text-center ${getValueClass(metrics.cpu_usage_percent, 'cpu_usage_percent')}`}>
                          {formatValue(metrics.cpu_usage_percent, 'cpu_usage_percent')}
                        </td>
                        <td className={`px-4 py-3 text-center ${getValueClass(metrics.memory_usage_percent, 'memory_usage_percent')}`}>
                          {formatValue(metrics.memory_usage_percent, 'memory_usage_percent')}
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-gray-400">
                          {vps.minutesSinceLastSeen < 1 ? '剛剛' : `${vps.minutesSinceLastSeen}分鐘前`}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-center text-gray-500" colSpan="8">無數據</td>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 閾值配置說明 */}
      <div className="bg-cyber-darker border border-cyber-blue/20 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-3">告警閾值配置</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {thresholds.map((threshold) => (
            <div key={threshold.metric_name} className="bg-cyber-dark/50 rounded p-3">
              <div className="text-sm font-medium text-gray-300 mb-1">
                {metricNames[threshold.metric_name] || threshold.metric_name}
              </div>
              <div className="text-xs text-gray-500 mb-2">{threshold.description}</div>
              <div className="flex gap-4 text-xs">
                <div>
                  <span className="text-yellow-400">⚠️ 警告: </span>
                  <span className="text-gray-300">{threshold.warning_threshold}</span>
                </div>
                <div>
                  <span className="text-red-400">🔴 嚴重: </span>
                  <span className="text-gray-300">{threshold.critical_threshold}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default VPSPerformance
