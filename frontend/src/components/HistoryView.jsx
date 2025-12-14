import { useState, useEffect } from 'react';
import { Calendar, TrendingUp, DollarSign, Activity, User, FileSpreadsheet } from 'lucide-react';

function HistoryView({ allowedGroups = [], selectedGroup = '', username = '' }) {
  const [snapshots, setSnapshots] = useState([]);
  const [filteredSnapshots, setFilteredSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // 日期範圍篩選
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [rangeSummary, setRangeSummary] = useState(null);
  
  // 顯示模式
  const [showAll, setShowAll] = useState(false);
  
  // 單一節點查詢
  const [nodeList, setNodeList] = useState([]);
  const [selectedNode, setSelectedNode] = useState('');
  const [nodeStartDate, setNodeStartDate] = useState('');
  const [nodeEndDate, setNodeEndDate] = useState('');
  const [nodeSummary, setNodeSummary] = useState(null);
  const [nodeStats, setNodeStats] = useState([]);
  const [showNodeStats, setShowNodeStats] = useState(false);
  
  // 單日節點詳情查詢
  const [dailyDetailDate, setDailyDetailDate] = useState('');
  const [dailyNodeStats, setDailyNodeStats] = useState([]);
  const [showDailyDetail, setShowDailyDetail] = useState(false);
  const [loadingDailyDetail, setLoadingDailyDetail] = useState(false);
  
  // 功能區塊顯示控制：'range' | 'node' | 'daily' | 'excel' | null
  const [activePanel, setActivePanel] = useState(null);
  
  // Excel 導出
  const [excelStartDate, setExcelStartDate] = useState('');
  const [excelEndDate, setExcelEndDate] = useState('');
  const [excelSelectedNodes, setExcelSelectedNodes] = useState([]);
  const [excelLoading, setExcelLoading] = useState(false);

  useEffect(() => {
    fetchHistory();
    fetchNodeList();
  }, [allowedGroups, selectedGroup]);
  
  // 獲取節點列表（按用戶分組過濾）
  const fetchNodeList = async () => {
    try {
      const response = await fetch('/api/nodes');
      const data = await response.json();
      if (data.ok) {
        let nodes = data.nodes || [];
        // 如果有分組限制，過濾節點列表
        if (allowedGroups.length > 0) {
          nodes = nodes.filter(node => 
            node.client_group && allowedGroups.includes(node.client_group)
          );
        }
        setNodeList(nodes);
      }
    } catch (err) {
      console.error('Failed to fetch node list:', err);
    }
  };
  
  // 查詢單一節點歷史數據
  const fetchNodeHistory = async () => {
    if (!selectedNode || !nodeStartDate || !nodeEndDate) {
      alert('請選擇節點和日期範圍');
      return;
    }
    
    try {
      const response = await fetch(`/api/history/node?nodeId=${encodeURIComponent(selectedNode)}&startDate=${nodeStartDate}&endDate=${nodeEndDate}`);
      const data = await response.json();
      
      if (data.ok) {
        setNodeSummary(data.summary);
        setNodeStats(data.stats);
        setShowNodeStats(true);
      } else {
        alert(data.error || '無法獲取節點數據');
      }
    } catch (err) {
      alert('網絡錯誤：' + err.message);
    }
  };
  
  // 重置節點查詢
  const resetNodeQuery = () => {
    setSelectedNode('');
    setNodeStartDate('');
    setNodeEndDate('');
    setNodeSummary(null);
    setNodeStats([]);
    setShowNodeStats(false);
  };
  
  // 獲取單日各節點詳情
  const fetchDailyNodeStats = async () => {
    if (!dailyDetailDate) {
      alert('請選擇日期');
      return;
    }
    
    try {
      setLoadingDailyDetail(true);
      const groupsToQuery = (selectedGroup && selectedGroup !== 'all')
        ? [selectedGroup] 
        : allowedGroups;
      const params = new URLSearchParams();
      params.set('date', dailyDetailDate);
      if (groupsToQuery.length > 0) {
        params.set('groups', groupsToQuery.join(','));
      }
      if (username) {
        params.set('username', username);
      }
      const response = await fetch(`/api/history/daily-nodes?${params.toString()}`);
      const data = await response.json();
      
      if (data.ok) {
        setDailyNodeStats(data.stats);
        setShowDailyDetail(true);
      } else {
        alert(data.error || '無法獲取數據');
      }
    } catch (err) {
      alert('網絡錯誤：' + err.message);
    } finally {
      setLoadingDailyDetail(false);
    }
  };
  
  // 重置單日詳情查詢
  const resetDailyDetail = () => {
    setDailyDetailDate('');
    setDailyNodeStats([]);
    setShowDailyDetail(false);
  };
  
  // 生成 Excel 導出
  const generateExcel = async () => {
    if (!excelStartDate || !excelEndDate) {
      alert('請選擇開始和結束日期');
      return;
    }
    
    try {
      setExcelLoading(true);
      
      const response = await fetch('/api/export/history-excel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          startDate: excelStartDate,
          endDate: excelEndDate,
          nodeIds: excelSelectedNodes.length > 0 ? excelSelectedNodes : null,
          allowedGroups: allowedGroups.length > 0 ? allowedGroups : null
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '導出失敗');
      }
      
      // 下載文件
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `歷史數據_${excelStartDate}_${excelEndDate}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
    } catch (err) {
      alert('導出失敗：' + err.message);
    } finally {
      setExcelLoading(false);
    }
  };
  
  // 重置 Excel 導出
  const resetExcelExport = () => {
    setExcelStartDate('');
    setExcelEndDate('');
    setExcelSelectedNodes([]);
  };
  
  // 切換節點選擇
  const toggleNodeSelection = (nodeId) => {
    setExcelSelectedNodes(prev => 
      prev.includes(nodeId) 
        ? prev.filter(id => id !== nodeId)
        : [...prev, nodeId]
    );
  };
  
  // 全選/取消全選節點
  const toggleAllNodes = () => {
    if (excelSelectedNodes.length === nodeList.length) {
      setExcelSelectedNodes([]);
    } else {
      setExcelSelectedNodes(nodeList.map(n => n.id));
    }
  };

  const fetchHistory = async () => {
    try {
      setLoading(true);
      // 如果選擇了特定分組（非'all'），只查詢該分組；否則查詢所有允許的分組
      const groupsToQuery = (selectedGroup && selectedGroup !== 'all')
        ? [selectedGroup] 
        : allowedGroups;
      const params = new URLSearchParams();
      if (groupsToQuery.length > 0) {
        params.set('groups', groupsToQuery.join(','));
      }
      if (username) {
        params.set('username', username);
      }
      const queryString = params.toString() ? `?${params.toString()}` : '';
      const response = await fetch(`/api/history${queryString}`);
      const data = await response.json();
      
      if (data.ok) {
        // 過濾休市日：A盈利和AB總盈利都為0時認為是休市
        const tradingDays = data.snapshots.filter(s => 
          (s.total_a_profit !== 0 || s.total_ab_profit !== 0)
        );
        setSnapshots(tradingDays);
        setFilteredSnapshots(tradingDays);
      } else {
        setError(data.error || '無法獲取歷史數據');
      }
    } catch (err) {
      setError('網絡錯誤：' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchRangeSummary = async () => {
    if (!startDate || !endDate) {
      alert('請選擇開始和結束日期');
      return;
    }

    try {
      // 如果選擇了特定分組（非'all'），只查詢該分組；否則查詢所有允許的分組
      const groupsToQuery = (selectedGroup && selectedGroup !== 'all')
        ? [selectedGroup] 
        : allowedGroups;
      const params = new URLSearchParams();
      params.set('startDate', startDate);
      params.set('endDate', endDate);
      if (groupsToQuery.length > 0) {
        params.set('groups', groupsToQuery.join(','));
      }
      if (username) {
        params.set('username', username);
      }
      const response = await fetch(`/api/history/range?${params.toString()}`);
      const data = await response.json();
      
      if (data.ok) {
        // 過濾休市日
        const tradingDays = data.snapshots.filter(s => 
          (s.total_a_profit !== 0 || s.total_ab_profit !== 0)
        );
        setFilteredSnapshots(tradingDays);
        // 重新計算摘要（只計算交易日）
        const recalculatedSummary = {
          ...data.summary,
          days_count: tradingDays.length,
          total_a_lots: tradingDays.reduce((sum, s) => sum + (s.total_a_lots || 0), 0),
          total_b_lots: tradingDays.reduce((sum, s) => sum + (s.total_b_lots || 0), 0),
          total_lots_diff: tradingDays.reduce((sum, s) => sum + (s.total_lots_diff || 0), 0),
          total_a_profit: tradingDays.reduce((sum, s) => sum + (s.total_a_profit || 0), 0),
          total_b_profit: tradingDays.reduce((sum, s) => sum + (s.total_b_profit || 0), 0),
          total_ab_profit: tradingDays.reduce((sum, s) => sum + (s.total_ab_profit || 0), 0),
          total_a_interest: tradingDays.reduce((sum, s) => sum + (s.total_a_interest || 0), 0),
          total_cost_per_lot: tradingDays.reduce((sum, s) => sum + (s.total_cost_per_lot || 0), 0),
          total_commission: tradingDays.reduce((sum, s) => sum + (s.total_commission || 0), 0),
          avg_daily_profit: tradingDays.length > 0 
            ? tradingDays.reduce((sum, s) => sum + (s.total_ab_profit || 0), 0) / tradingDays.length 
            : 0
        };
        setRangeSummary(recalculatedSummary);
      } else {
        alert(data.error || '無法獲取範圍數據');
      }
    } catch (err) {
      alert('網絡錯誤：' + err.message);
    }
  };

  const resetFilter = () => {
    setStartDate('');
    setEndDate('');
    setFilteredSnapshots(snapshots);
    setRangeSummary(null);
  };

  const toggleShowAll = () => {
    setShowAll(!showAll);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-cyber-blue text-lg">載入歷史數據中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-400 text-lg">{error}</div>
      </div>
    );
  }

  const displayedSnapshots = showAll ? filteredSnapshots : filteredSnapshots.slice(0, 10);

  return (
    <div className="space-y-6">
      {/* 標題和功能按鈕 */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Calendar className="w-8 h-8 text-cyber-blue" />
          <h2 className="text-2xl font-bold text-white">歷史數據</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActivePanel(activePanel === 'range' ? null : 'range')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activePanel === 'range' 
                ? 'bg-cyber-blue text-white' 
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
          >
            日期範圍篩選
          </button>
          <button
            onClick={() => setActivePanel(activePanel === 'node' ? null : 'node')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activePanel === 'node' 
                ? 'bg-purple-600 text-white' 
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
          >
            單一節點查詢
          </button>
          <button
            onClick={() => setActivePanel(activePanel === 'daily' ? null : 'daily')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activePanel === 'daily' 
                ? 'bg-orange-600 text-white' 
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
          >
            單日節點詳情
          </button>
          <button
            onClick={() => setActivePanel(activePanel === 'excel' ? null : 'excel')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              activePanel === 'excel' 
                ? 'bg-green-600 text-white' 
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            生成歷史Excel
          </button>
        </div>
      </div>

      {/* 日期範圍篩選 */}
      {activePanel === 'range' && (
      <div className="bg-cyber-darker/60 rounded-xl p-6 cyber-border">
        <h3 className="text-lg font-semibold text-white mb-4">日期範圍篩選</h3>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm text-gray-400 mb-2">開始日期</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800/50 border border-gray-600 rounded-lg text-white focus:border-cyber-blue focus:outline-none [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:brightness-100"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm text-gray-400 mb-2">結束日期</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800/50 border border-gray-600 rounded-lg text-white focus:border-cyber-blue focus:outline-none [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:brightness-100"
            />
          </div>
          <button
            onClick={fetchRangeSummary}
            className="px-6 py-2 bg-cyber-blue hover:bg-cyber-blue/80 text-white rounded-lg font-medium transition-colors"
          >
            查詢範圍
          </button>
          <button
            onClick={async () => {
              if (snapshots.length > 0) {
                const dates = snapshots.map(s => s.snapshot_date).sort();
                const earliest = dates[0]; // 最早日期（排序後第一個）
                const latest = dates[dates.length - 1]; // 最新日期（排序後最後一個）
                
                setStartDate(earliest);
                setEndDate(latest);
                
                // 直接使用計算的日期調用 API
                try {
                  const response = await fetch(`/api/history/range?startDate=${earliest}&endDate=${latest}`);
                  const data = await response.json();
                  
                  if (data.ok) {
                    // 過濾休市日
                    const tradingDays = data.snapshots.filter(s => 
                      (s.total_a_profit !== 0 || s.total_ab_profit !== 0)
                    );
                    setFilteredSnapshots(tradingDays);
                    // 重新計算摘要
                    const recalculatedSummary = {
                      ...data.summary,
                      days_count: tradingDays.length,
                      total_a_lots: tradingDays.reduce((sum, s) => sum + (s.total_a_lots || 0), 0),
                      total_b_lots: tradingDays.reduce((sum, s) => sum + (s.total_b_lots || 0), 0),
                      total_lots_diff: tradingDays.reduce((sum, s) => sum + (s.total_lots_diff || 0), 0),
                      total_a_profit: tradingDays.reduce((sum, s) => sum + (s.total_a_profit || 0), 0),
                      total_b_profit: tradingDays.reduce((sum, s) => sum + (s.total_b_profit || 0), 0),
                      total_ab_profit: tradingDays.reduce((sum, s) => sum + (s.total_ab_profit || 0), 0),
                      total_a_interest: tradingDays.reduce((sum, s) => sum + (s.total_a_interest || 0), 0),
                      total_cost_per_lot: tradingDays.reduce((sum, s) => sum + (s.total_cost_per_lot || 0), 0),
                      total_commission: tradingDays.reduce((sum, s) => sum + (s.total_commission || 0), 0),
                      avg_daily_profit: tradingDays.length > 0 
                        ? tradingDays.reduce((sum, s) => sum + (s.total_ab_profit || 0), 0) / tradingDays.length 
                        : 0
                    };
                    setRangeSummary(recalculatedSummary);
                  } else {
                    alert(data.error || '無法獲取範圍數據');
                  }
                } catch (err) {
                  alert('網絡錯誤：' + err.message);
                }
              }
            }}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition-colors"
          >
            全部日期
          </button>
          <button
            onClick={resetFilter}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
          >
            重置
          </button>
        </div>

        {/* 範圍統計摘要 */}
        {rangeSummary && (
          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-5 h-5 text-cyan-400" />
                  <span className="text-sm text-gray-400">總 A 手數</span>
                </div>
                <div className="text-2xl font-bold text-cyan-400">
                  {(rangeSummary.total_a_lots || 0).toFixed(2)}
                </div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-5 h-5 text-cyan-400" />
                  <span className="text-sm text-gray-400">總 B 手數</span>
                </div>
                <div className="text-2xl font-bold text-cyan-400">
                  {(rangeSummary.total_b_lots || 0).toFixed(2)}
                </div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-5 h-5 text-red-400" />
                  <span className="text-sm text-gray-400">手數差 (A-B)</span>
                </div>
                <div className={`text-2xl font-bold ${(rangeSummary.total_lots_diff || 0) !== 0 ? 'text-red-400' : 'text-gray-300'}`}>
                  {(rangeSummary.total_lots_diff || 0) >= 0 ? '+' : ''}{(rangeSummary.total_lots_diff || 0).toFixed(2)}
                </div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-5 h-5 text-yellow-400" />
                  <span className="text-sm text-gray-400">總 A 總息</span>
                </div>
                <div className="text-2xl font-bold text-gray-300">
                  {(rangeSummary.total_a_interest || 0).toFixed(2)}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-cyber-green" />
                  <span className="text-sm text-gray-400">總 A 盈利</span>
                </div>
                <div className={`text-2xl font-bold ${(rangeSummary.total_a_profit || 0) >= 0 ? 'text-cyber-green' : 'text-red-400'}`}>
                  {(rangeSummary.total_a_profit || 0) >= 0 ? '+' : ''}{(rangeSummary.total_a_profit || 0).toFixed(2)}
                </div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-cyber-green" />
                  <span className="text-sm text-gray-400">總 B 盈利</span>
                </div>
                <div className={`text-2xl font-bold ${(rangeSummary.total_b_profit || 0) >= 0 ? 'text-cyber-green' : 'text-red-400'}`}>
                  {(rangeSummary.total_b_profit || 0) >= 0 ? '+' : ''}{(rangeSummary.total_b_profit || 0).toFixed(2)}
                </div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-cyber-green" />
                  <span className="text-sm text-gray-400">總 AB 盈虧</span>
                </div>
                <div className={`text-3xl font-bold ${(rangeSummary.total_ab_profit || 0) >= 0 ? 'text-cyber-green' : 'text-red-400'}`}>
                  {(rangeSummary.total_ab_profit || 0) >= 0 ? '+' : ''}{(rangeSummary.total_ab_profit || 0).toFixed(2)}
                </div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-5 h-5 text-yellow-400" />
                  <span className="text-sm text-gray-400">總每手成本</span>
                </div>
                <div className={`text-2xl font-bold ${(rangeSummary.total_cost_per_lot || 0) >= 0 ? 'text-cyber-green' : 'text-red-400'}`}>
                  {(rangeSummary.total_cost_per_lot || 0) >= 0 ? '+' : ''}{(rangeSummary.total_cost_per_lot || 0).toFixed(2)}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-5 h-5 text-cyan-400" />
                  <span className="text-sm text-gray-400">總回佣</span>
                </div>
                <div className="text-2xl font-bold text-cyan-400">
                  ${(rangeSummary.total_commission || 0).toFixed(2)}
                </div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-cyber-green" />
                  <span className="text-sm text-gray-400">總盈含息佣</span>
                </div>
                <div className={`text-3xl font-bold ${((rangeSummary.total_ab_profit || 0) + (rangeSummary.total_a_interest || 0) + (rangeSummary.total_commission || 0)) >= 0 ? 'text-cyber-green' : 'text-red-400'}`}>
                  {((rangeSummary.total_ab_profit || 0) + (rangeSummary.total_a_interest || 0) + (rangeSummary.total_commission || 0)) >= 0 ? '+' : ''}{((rangeSummary.total_ab_profit || 0) + (rangeSummary.total_a_interest || 0) + (rangeSummary.total_commission || 0)).toFixed(2)}
                </div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4 flex items-center justify-center">
                <span className="text-sm text-gray-400">平均每日盈利：</span>
                <span className={`text-xl font-bold ml-2 ${(rangeSummary.avg_daily_profit || 0) >= 0 ? 'text-cyber-green' : 'text-red-400'}`}>
                  {(rangeSummary.avg_daily_profit || 0) >= 0 ? '+' : ''}{(rangeSummary.avg_daily_profit || 0).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {/* 單一節點查詢 */}
      {activePanel === 'node' && (
      <div className="bg-cyber-darker/60 rounded-xl p-6 cyber-border">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <User className="w-5 h-5 text-purple-400" />
          單一節點查詢
        </h3>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm text-gray-400 mb-2">選擇節點</label>
            <select
              value={selectedNode}
              onChange={(e) => setSelectedNode(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800/50 border border-gray-600 rounded-lg text-white focus:border-cyber-blue focus:outline-none"
            >
              <option value="">-- 請選擇節點 --</option>
              {nodeList.map(node => (
                <option key={node.id} value={node.id}>{node.id}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm text-gray-400 mb-2">開始日期</label>
            <input
              type="date"
              value={nodeStartDate}
              onChange={(e) => setNodeStartDate(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800/50 border border-gray-600 rounded-lg text-white focus:border-cyber-blue focus:outline-none [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:brightness-100"
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm text-gray-400 mb-2">結束日期</label>
            <input
              type="date"
              value={nodeEndDate}
              onChange={(e) => setNodeEndDate(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800/50 border border-gray-600 rounded-lg text-white focus:border-cyber-blue focus:outline-none [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:brightness-100"
            />
          </div>
          <button
            onClick={fetchNodeHistory}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition-colors"
          >
            查詢節點
          </button>
          <button
            onClick={resetNodeQuery}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
          >
            重置
          </button>
        </div>

        {/* 節點查詢結果 */}
        {nodeSummary && (
          <div className="mt-6 space-y-4">
            <div className="text-sm text-gray-400 mb-2">
              節點 <span className="text-white font-semibold">{nodeSummary.node_id}</span> 在 {nodeStartDate} 至 {nodeEndDate} 的統計（{nodeSummary.days_count} 個交易日）
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-5 h-5 text-cyan-400" />
                  <span className="text-sm text-gray-400">總 A 手數</span>
                </div>
                <div className="text-2xl font-bold text-cyan-400">
                  {(nodeSummary.total_a_lots || 0).toFixed(2)}
                </div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-5 h-5 text-cyan-400" />
                  <span className="text-sm text-gray-400">總 B 手數</span>
                </div>
                <div className="text-2xl font-bold text-cyan-400">
                  {(nodeSummary.total_b_lots || 0).toFixed(2)}
                </div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-5 h-5 text-red-400" />
                  <span className="text-sm text-gray-400">手數差 (A-B)</span>
                </div>
                <div className={`text-2xl font-bold ${(nodeSummary.total_lots_diff || 0) !== 0 ? 'text-red-400' : 'text-gray-300'}`}>
                  {(nodeSummary.total_lots_diff || 0) >= 0 ? '+' : ''}{(nodeSummary.total_lots_diff || 0).toFixed(2)}
                </div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-5 h-5 text-yellow-400" />
                  <span className="text-sm text-gray-400">總 A 總息</span>
                </div>
                <div className="text-2xl font-bold text-gray-300">
                  {(nodeSummary.total_a_interest || 0).toFixed(2)}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-cyber-green" />
                  <span className="text-sm text-gray-400">總 A 盈利</span>
                </div>
                <div className={`text-2xl font-bold ${(nodeSummary.total_a_profit || 0) >= 0 ? 'text-cyber-green' : 'text-red-400'}`}>
                  {(nodeSummary.total_a_profit || 0) >= 0 ? '+' : ''}{(nodeSummary.total_a_profit || 0).toFixed(2)}
                </div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-cyber-green" />
                  <span className="text-sm text-gray-400">總 B 盈利</span>
                </div>
                <div className={`text-2xl font-bold ${(nodeSummary.total_b_profit || 0) >= 0 ? 'text-cyber-green' : 'text-red-400'}`}>
                  {(nodeSummary.total_b_profit || 0) >= 0 ? '+' : ''}{(nodeSummary.total_b_profit || 0).toFixed(2)}
                </div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-cyber-green" />
                  <span className="text-sm text-gray-400">總 AB 盈虧</span>
                </div>
                <div className={`text-3xl font-bold ${(nodeSummary.total_ab_profit || 0) >= 0 ? 'text-cyber-green' : 'text-red-400'}`}>
                  {(nodeSummary.total_ab_profit || 0) >= 0 ? '+' : ''}{(nodeSummary.total_ab_profit || 0).toFixed(2)}
                </div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-5 h-5 text-cyan-400" />
                  <span className="text-sm text-gray-400">總回佣</span>
                </div>
                <div className="text-2xl font-bold text-cyan-400">
                  ${(nodeSummary.total_commission || 0).toFixed(2)}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-cyber-green" />
                  <span className="text-sm text-gray-400">總盈含息佣</span>
                </div>
                <div className={`text-3xl font-bold ${(nodeSummary.total_profit_with_interest_commission || 0) >= 0 ? 'text-cyber-green' : 'text-red-400'}`}>
                  {(nodeSummary.total_profit_with_interest_commission || 0) >= 0 ? '+' : ''}{(nodeSummary.total_profit_with_interest_commission || 0).toFixed(2)}
                </div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4 flex items-center justify-center">
                <span className="text-sm text-gray-400">平均每日盈利：</span>
                <span className={`text-xl font-bold ml-2 ${(nodeSummary.avg_daily_profit || 0) >= 0 ? 'text-cyber-green' : 'text-red-400'}`}>
                  {(nodeSummary.avg_daily_profit || 0) >= 0 ? '+' : ''}{(nodeSummary.avg_daily_profit || 0).toFixed(2)}
                </span>
              </div>
            </div>

            {/* 節點每日明細表格 */}
            {showNodeStats && nodeStats.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-gray-300 mb-2">每日明細</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-800/50">
                      <tr>
                        <th className="px-2 py-2 text-left text-gray-400">日期</th>
                        <th className="px-2 py-2 text-right text-gray-400">A手數</th>
                        <th className="px-2 py-2 text-right text-gray-400">B手數</th>
                        <th className="px-2 py-2 text-right text-gray-400">手數差</th>
                        <th className="px-2 py-2 text-right text-gray-400">A盈利</th>
                        <th className="px-2 py-2 text-right text-gray-400">B盈利</th>
                        <th className="px-2 py-2 text-right text-gray-400">AB盈虧</th>
                        <th className="px-2 py-2 text-right text-gray-400">A總息</th>
                        <th className="px-2 py-2 text-right text-gray-400">回佣</th>
                        <th className="px-2 py-2 text-right text-gray-400">總盈含息佣</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700/50">
                      {nodeStats.map((stat) => {
                        const commission = (stat.a_lots_total || 0) * (stat.commission_per_lot || 0);
                        const totalWithInterestCommission = (stat.ab_profit_total || 0) + (stat.a_interest_total || 0) + commission;
                        return (
                          <tr key={stat.date} className="hover:bg-gray-800/30">
                            <td className="px-2 py-2 text-white">{stat.date}</td>
                            <td className="px-2 py-2 text-right text-cyan-400">{(stat.a_lots_total || 0).toFixed(2)}</td>
                            <td className="px-2 py-2 text-right text-cyan-400">{(stat.b_lots_total || 0).toFixed(2)}</td>
                            <td className={`px-2 py-2 text-right ${(stat.lots_diff || 0) !== 0 ? 'text-red-400' : 'text-gray-300'}`}>
                              {(stat.lots_diff || 0) >= 0 ? '+' : ''}{(stat.lots_diff || 0).toFixed(2)}
                            </td>
                            <td className={`px-2 py-2 text-right ${(stat.a_profit_total || 0) >= 0 ? 'text-cyber-green' : 'text-red-400'}`}>
                              {(stat.a_profit_total || 0) >= 0 ? '+' : ''}{(stat.a_profit_total || 0).toFixed(2)}
                            </td>
                            <td className={`px-2 py-2 text-right ${(stat.b_profit_total || 0) >= 0 ? 'text-cyber-green' : 'text-red-400'}`}>
                              {(stat.b_profit_total || 0) >= 0 ? '+' : ''}{(stat.b_profit_total || 0).toFixed(2)}
                            </td>
                            <td className={`px-2 py-2 text-right font-semibold ${(stat.ab_profit_total || 0) >= 0 ? 'text-cyber-green' : 'text-red-400'}`}>
                              {(stat.ab_profit_total || 0) >= 0 ? '+' : ''}{(stat.ab_profit_total || 0).toFixed(2)}
                            </td>
                            <td className="px-2 py-2 text-right text-gray-300">{(stat.a_interest_total || 0).toFixed(2)}</td>
                            <td className="px-2 py-2 text-right text-cyan-400">${commission.toFixed(2)}</td>
                            <td className={`px-2 py-2 text-right font-semibold ${totalWithInterestCommission >= 0 ? 'text-cyber-green' : 'text-red-400'}`}>
                              {totalWithInterestCommission >= 0 ? '+' : ''}{totalWithInterestCommission.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      )}

      {/* 單日節點詳情查詢 */}
      {activePanel === 'daily' && (
      <div className="bg-cyber-darker/60 rounded-xl p-6 cyber-border">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-orange-400" />
          單日節點詳情
        </h3>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm text-gray-400 mb-2">選擇日期</label>
            <input
              type="date"
              value={dailyDetailDate}
              onChange={(e) => setDailyDetailDate(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800/50 border border-gray-600 rounded-lg text-white focus:border-cyber-blue focus:outline-none [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:brightness-100"
            />
          </div>
          <button
            onClick={fetchDailyNodeStats}
            disabled={loadingDailyDetail}
            className="px-6 py-2 bg-orange-600 hover:bg-orange-500 disabled:bg-orange-800 text-white rounded-lg font-medium transition-colors"
          >
            {loadingDailyDetail ? '查詢中...' : '查詢該日節點'}
          </button>
          <button
            onClick={resetDailyDetail}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
          >
            重置
          </button>
        </div>

        {/* 單日節點詳情表格 */}
        {showDailyDetail && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-gray-300">
                {dailyDetailDate} 各節點數據 ({dailyNodeStats.length} 個節點)
              </h4>
              {dailyNodeStats.length > 0 && (
                <div className="text-sm text-gray-400">
                  總 AB 盈虧: 
                  <span className={`ml-2 font-bold ${dailyNodeStats.reduce((sum, s) => sum + (s.ab_profit_total || 0), 0) >= 0 ? 'text-cyber-green' : 'text-red-400'}`}>
                    {dailyNodeStats.reduce((sum, s) => sum + (s.ab_profit_total || 0), 0) >= 0 ? '+' : ''}
                    {dailyNodeStats.reduce((sum, s) => sum + (s.ab_profit_total || 0), 0).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-800/50">
                  <tr>
                    <th className="px-3 py-2 text-left text-gray-400">節點名稱</th>
                    <th className="px-3 py-2 text-center text-gray-400">分組</th>
                    <th className="px-3 py-2 text-right text-gray-400">A手數</th>
                    <th className="px-3 py-2 text-right text-gray-400">B手數</th>
                    <th className="px-3 py-2 text-right text-gray-400">手數差</th>
                    <th className="px-3 py-2 text-right text-gray-400">A盈利</th>
                    <th className="px-3 py-2 text-right text-gray-400">B盈利</th>
                    <th className="px-3 py-2 text-right text-gray-400">AB盈虧</th>
                    <th className="px-3 py-2 text-right text-gray-400">A總息</th>
                    <th className="px-3 py-2 text-right text-gray-400">回佣</th>
                    <th className="px-3 py-2 text-right text-gray-400">總盈含息佣</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50">
                  {dailyNodeStats.length === 0 ? (
                    <tr>
                      <td colSpan="11" className="px-4 py-8 text-center text-gray-500">
                        {dailyDetailDate < '2024-12-12' 
                          ? '此日期無節點明細數據（僅有匯總數據）' 
                          : '該日期無數據'}
                      </td>
                    </tr>
                  ) : (
                    dailyNodeStats.map((stat) => {
                      const commission = (stat.a_lots_total || 0) * (stat.commission_per_lot || 0);
                      const totalWithInterestCommission = (stat.ab_profit_total || 0) + (stat.a_interest_total || 0) + commission;
                      return (
                        <tr key={stat.node_id} className="hover:bg-gray-800/30">
                          <td className="px-3 py-2 text-white font-medium">{stat.node_name}</td>
                          <td className="px-3 py-2 text-center text-purple-400">{stat.client_group || '-'}</td>
                          <td className="px-3 py-2 text-right text-cyan-400">{(stat.a_lots_total || 0).toFixed(2)}</td>
                          <td className="px-3 py-2 text-right text-cyan-400">{(stat.b_lots_total || 0).toFixed(2)}</td>
                          <td className={`px-3 py-2 text-right ${(stat.lots_diff || 0) !== 0 ? 'text-red-400' : 'text-gray-300'}`}>
                            {(stat.lots_diff || 0) >= 0 ? '+' : ''}{(stat.lots_diff || 0).toFixed(2)}
                          </td>
                          <td className={`px-3 py-2 text-right ${(stat.a_profit_total || 0) >= 0 ? 'text-cyber-green' : 'text-red-400'}`}>
                            {(stat.a_profit_total || 0) >= 0 ? '+' : ''}{(stat.a_profit_total || 0).toFixed(2)}
                          </td>
                          <td className={`px-3 py-2 text-right ${(stat.b_profit_total || 0) >= 0 ? 'text-cyber-green' : 'text-red-400'}`}>
                            {(stat.b_profit_total || 0) >= 0 ? '+' : ''}{(stat.b_profit_total || 0).toFixed(2)}
                          </td>
                          <td className={`px-3 py-2 text-right font-medium ${(stat.ab_profit_total || 0) >= 0 ? 'text-cyber-green' : 'text-red-400'}`}>
                            {(stat.ab_profit_total || 0) >= 0 ? '+' : ''}{(stat.ab_profit_total || 0).toFixed(2)}
                          </td>
                          <td className={`px-3 py-2 text-right ${(stat.a_interest_total || 0) >= 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {(stat.a_interest_total || 0) >= 0 ? '+' : ''}{(stat.a_interest_total || 0).toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right text-cyan-400">
                            ${commission.toFixed(2)}
                          </td>
                          <td className={`px-3 py-2 text-right font-bold ${totalWithInterestCommission >= 0 ? 'text-cyber-green' : 'text-red-400'}`}>
                            {totalWithInterestCommission >= 0 ? '+' : ''}{totalWithInterestCommission.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {dailyNodeStats.length > 0 && (
                  <tfoot className="bg-gray-800/70 font-semibold">
                    <tr>
                      <td className="px-3 py-2 text-white">合計</td>
                      <td className="px-3 py-2 text-center text-gray-400">{dailyNodeStats.length}</td>
                      <td className="px-3 py-2 text-right text-cyan-400">
                        {dailyNodeStats.reduce((sum, s) => sum + (s.a_lots_total || 0), 0).toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right text-cyan-400">
                        {dailyNodeStats.reduce((sum, s) => sum + (s.b_lots_total || 0), 0).toFixed(2)}
                      </td>
                      <td className={`px-3 py-2 text-right ${dailyNodeStats.reduce((sum, s) => sum + (s.lots_diff || 0), 0) !== 0 ? 'text-red-400' : 'text-gray-300'}`}>
                        {dailyNodeStats.reduce((sum, s) => sum + (s.lots_diff || 0), 0) >= 0 ? '+' : ''}
                        {dailyNodeStats.reduce((sum, s) => sum + (s.lots_diff || 0), 0).toFixed(2)}
                      </td>
                      <td className={`px-3 py-2 text-right ${dailyNodeStats.reduce((sum, s) => sum + (s.a_profit_total || 0), 0) >= 0 ? 'text-cyber-green' : 'text-red-400'}`}>
                        {dailyNodeStats.reduce((sum, s) => sum + (s.a_profit_total || 0), 0) >= 0 ? '+' : ''}
                        {dailyNodeStats.reduce((sum, s) => sum + (s.a_profit_total || 0), 0).toFixed(2)}
                      </td>
                      <td className={`px-3 py-2 text-right ${dailyNodeStats.reduce((sum, s) => sum + (s.b_profit_total || 0), 0) >= 0 ? 'text-cyber-green' : 'text-red-400'}`}>
                        {dailyNodeStats.reduce((sum, s) => sum + (s.b_profit_total || 0), 0) >= 0 ? '+' : ''}
                        {dailyNodeStats.reduce((sum, s) => sum + (s.b_profit_total || 0), 0).toFixed(2)}
                      </td>
                      <td className={`px-3 py-2 text-right font-bold ${dailyNodeStats.reduce((sum, s) => sum + (s.ab_profit_total || 0), 0) >= 0 ? 'text-cyber-green' : 'text-red-400'}`}>
                        {dailyNodeStats.reduce((sum, s) => sum + (s.ab_profit_total || 0), 0) >= 0 ? '+' : ''}
                        {dailyNodeStats.reduce((sum, s) => sum + (s.ab_profit_total || 0), 0).toFixed(2)}
                      </td>
                      <td className={`px-3 py-2 text-right ${dailyNodeStats.reduce((sum, s) => sum + (s.a_interest_total || 0), 0) >= 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {dailyNodeStats.reduce((sum, s) => sum + (s.a_interest_total || 0), 0) >= 0 ? '+' : ''}
                        {dailyNodeStats.reduce((sum, s) => sum + (s.a_interest_total || 0), 0).toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right text-cyan-400">
                        ${dailyNodeStats.reduce((sum, s) => sum + ((s.a_lots_total || 0) * (s.commission_per_lot || 0)), 0).toFixed(2)}
                      </td>
                      <td className={`px-3 py-2 text-right font-bold ${
                        dailyNodeStats.reduce((sum, s) => {
                          const commission = (s.a_lots_total || 0) * (s.commission_per_lot || 0);
                          return sum + (s.ab_profit_total || 0) + (s.a_interest_total || 0) + commission;
                        }, 0) >= 0 ? 'text-cyber-green' : 'text-red-400'
                      }`}>
                        {dailyNodeStats.reduce((sum, s) => {
                          const commission = (s.a_lots_total || 0) * (s.commission_per_lot || 0);
                          return sum + (s.ab_profit_total || 0) + (s.a_interest_total || 0) + commission;
                        }, 0) >= 0 ? '+' : ''}
                        {dailyNodeStats.reduce((sum, s) => {
                          const commission = (s.a_lots_total || 0) * (s.commission_per_lot || 0);
                          return sum + (s.ab_profit_total || 0) + (s.a_interest_total || 0) + commission;
                        }, 0).toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Excel 導出面板 */}
      {activePanel === 'excel' && (
      <div className="bg-cyber-darker/60 rounded-xl p-6 cyber-border">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-green-400" />
          生成歷史 Excel
        </h3>
        <div className="space-y-4">
          {/* 日期範圍選擇 */}
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[150px]">
              <label className="block text-sm text-gray-400 mb-2">開始日期</label>
              <input
                type="date"
                value={excelStartDate}
                onChange={(e) => setExcelStartDate(e.target.value)}
                className="w-full px-4 py-2 bg-gray-800/50 border border-gray-600 rounded-lg text-white focus:border-green-500 focus:outline-none [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:brightness-100"
              />
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="block text-sm text-gray-400 mb-2">結束日期</label>
              <input
                type="date"
                value={excelEndDate}
                onChange={(e) => setExcelEndDate(e.target.value)}
                className="w-full px-4 py-2 bg-gray-800/50 border border-gray-600 rounded-lg text-white focus:border-green-500 focus:outline-none [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:brightness-100"
              />
            </div>
          </div>
          
          {/* 節點選擇 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-gray-400">選擇節點（不選則導出全部）</label>
              <button
                onClick={toggleAllNodes}
                className="text-xs text-green-400 hover:text-green-300"
              >
                {excelSelectedNodes.length === nodeList.length ? '取消全選' : '全選'}
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-48 overflow-y-auto p-2 bg-gray-800/30 rounded-lg">
              {nodeList.map(node => (
                <label
                  key={node.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer transition-colors ${
                    excelSelectedNodes.includes(node.id)
                      ? 'bg-green-600/30 border border-green-500/50'
                      : 'bg-gray-700/50 hover:bg-gray-700 border border-transparent'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={excelSelectedNodes.includes(node.id)}
                    onChange={() => toggleNodeSelection(node.id)}
                    className="w-4 h-4 rounded border-gray-500 text-green-500 focus:ring-green-500"
                  />
                  <span className="text-xs text-white truncate">{node.id}</span>
                </label>
              ))}
            </div>
            {excelSelectedNodes.length > 0 && (
              <div className="mt-2 text-xs text-gray-400">
                已選擇 {excelSelectedNodes.length} 個節點
              </div>
            )}
          </div>
          
          {/* 操作按鈕 */}
          <div className="flex gap-4 pt-2">
            <button
              onClick={generateExcel}
              disabled={excelLoading || !excelStartDate || !excelEndDate}
              className={`px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                excelLoading || !excelStartDate || !excelEndDate
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-500 text-white'
              }`}
            >
              {excelLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  生成中...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-4 h-4" />
                  生成 Excel
                </>
              )}
            </button>
            <button
              onClick={resetExcelExport}
              className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
            >
              重置
            </button>
          </div>
          
          {/* 說明 */}
          <div className="text-xs text-gray-500 mt-2">
            <p>Excel 文件包含以下分頁：</p>
            <ul className="list-disc list-inside mt-1 space-y-0.5">
              <li>每日節點數據 - 每個節點每日的詳細數據</li>
              <li>每日加總 - 每日所有節點的加總數據</li>
              <li>每月加總 - 每月各節點及全部節點的加總數據</li>
            </ul>
          </div>
        </div>
      </div>
      )}

      {/* 歷史數據表格 */}
      <div className="bg-cyber-darker/60 rounded-xl cyber-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-max">
            <thead className="bg-gray-800/50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-300 whitespace-nowrap">日期</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-gray-300 whitespace-nowrap">節點</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-300 whitespace-nowrap">A手數</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-300 whitespace-nowrap">B手數</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-300 whitespace-nowrap">手數差</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-300 whitespace-nowrap">A盈利</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-300 whitespace-nowrap">B盈利</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-300 whitespace-nowrap">AB總盈虧</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-300 whitespace-nowrap">A總息</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-300 whitespace-nowrap">總回佣</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-300 whitespace-nowrap">每手成本</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-300 whitespace-nowrap">總盈含息佣</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {displayedSnapshots.length === 0 ? (
                <tr>
                  <td colSpan="12" className="px-4 py-8 text-center text-gray-500">
                    暫無歷史數據
                  </td>
                </tr>
              ) : (
                displayedSnapshots.map((snapshot) => (
                  <tr key={snapshot.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-3 py-3 text-xs text-white font-medium whitespace-nowrap">
                      {snapshot.snapshot_date}
                    </td>
                    <td className="px-3 py-3 text-xs text-center text-gray-300 whitespace-nowrap">
                      {snapshot.total_nodes}
                    </td>
                    <td className="px-3 py-3 text-xs text-right text-cyan-400 whitespace-nowrap">
                      {(snapshot.total_a_lots || 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-3 text-xs text-right text-cyan-400 whitespace-nowrap">
                      {(snapshot.total_b_lots || 0).toFixed(2)}
                    </td>
                    <td className={`px-3 py-3 text-xs text-right font-medium whitespace-nowrap ${
                      (snapshot.total_lots_diff || 0) !== 0 ? 'text-red-400' : 'text-gray-300'
                    }`}>
                      {(snapshot.total_lots_diff || 0) >= 0 ? '+' : ''}{(snapshot.total_lots_diff || 0).toFixed(2)}
                    </td>
                    <td className={`px-3 py-3 text-xs text-right font-medium whitespace-nowrap ${
                      (snapshot.total_a_profit || 0) >= 0 ? 'text-cyber-green' : 'text-red-400'
                    }`}>
                      {(snapshot.total_a_profit || 0) >= 0 ? '+' : ''}{(snapshot.total_a_profit || 0).toFixed(2)}
                    </td>
                    <td className={`px-3 py-3 text-xs text-right font-medium whitespace-nowrap ${
                      (snapshot.total_b_profit || 0) >= 0 ? 'text-cyber-green' : 'text-red-400'
                    }`}>
                      {(snapshot.total_b_profit || 0) >= 0 ? '+' : ''}{(snapshot.total_b_profit || 0).toFixed(2)}
                    </td>
                    <td className={`px-3 py-3 text-sm text-right font-bold whitespace-nowrap ${
                      (snapshot.total_ab_profit || 0) >= 0 ? 'text-cyber-green' : 'text-red-400'
                    }`}>
                      {(snapshot.total_ab_profit || 0) >= 0 ? '+' : ''}{(snapshot.total_ab_profit || 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-3 text-xs text-right text-cyan-400 whitespace-nowrap">
                      {(snapshot.total_a_interest || 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-3 text-xs text-right text-cyan-400 font-medium whitespace-nowrap">
                      ${(snapshot.total_commission || 0).toFixed(2)}
                    </td>
                    <td className={`px-3 py-3 text-xs text-right font-medium whitespace-nowrap ${
                      (snapshot.total_cost_per_lot || 0) >= 0 ? 'text-cyber-green' : 'text-red-400'
                    }`}>
                      {(snapshot.total_cost_per_lot || 0) >= 0 ? '+' : ''}{(snapshot.total_cost_per_lot || 0).toFixed(2)}
                    </td>
                    <td className={`px-3 py-3 text-sm text-right font-bold whitespace-nowrap ${
                      ((snapshot.total_ab_profit || 0) + (snapshot.total_a_interest || 0) + (snapshot.total_commission || 0)) >= 0 ? 'text-cyber-green' : 'text-red-400'
                    }`}>
                      {((snapshot.total_ab_profit || 0) + (snapshot.total_a_interest || 0) + (snapshot.total_commission || 0)) >= 0 ? '+' : ''}{((snapshot.total_ab_profit || 0) + (snapshot.total_a_interest || 0) + (snapshot.total_commission || 0)).toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 顯示全部按鈕 */}
        {filteredSnapshots.length > 10 && (
          <div className="px-4 py-4 bg-gray-800/30 border-t border-gray-700/50 text-center">
            <button
              onClick={toggleShowAll}
              className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
            >
              {showAll ? '顯示前 10 筆' : `顯示全部 (${filteredSnapshots.length} 筆)`}
            </button>
          </div>
        )}
      </div>

      {/* 數據統計 */}
      <div className="text-sm text-gray-500 text-center">
        共 {filteredSnapshots.length} 筆歷史記錄
        {rangeSummary && ` (${rangeSummary.days_count} 天)`}
      </div>
    </div>
  );
}

export default HistoryView;
