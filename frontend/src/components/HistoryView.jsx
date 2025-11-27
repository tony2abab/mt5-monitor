import { useState, useEffect } from 'react';
import { Calendar, TrendingUp, DollarSign, Activity } from 'lucide-react';

function HistoryView() {
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

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/history');
      const data = await response.json();
      
      if (data.ok) {
        setSnapshots(data.snapshots);
        setFilteredSnapshots(data.snapshots);
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
      const response = await fetch(`/api/history/range?startDate=${startDate}&endDate=${endDate}`);
      const data = await response.json();
      
      if (data.ok) {
        setFilteredSnapshots(data.snapshots);
        setRangeSummary(data.summary);
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
      {/* 標題 */}
      <div className="flex items-center gap-3">
        <Calendar className="w-8 h-8 text-cyber-blue" />
        <h2 className="text-2xl font-bold text-white">歷史數據</h2>
        <span className="text-sm text-gray-400">
          (每日倫敦時間 00:30 快照)
        </span>
      </div>

      {/* 日期範圍篩選 */}
      <div className="bg-cyber-darker/60 rounded-xl p-6 cyber-border">
        <h3 className="text-lg font-semibold text-white mb-4">日期範圍篩選</h3>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm text-gray-400 mb-2">開始日期</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800/50 border border-gray-600 rounded-lg text-white focus:border-cyber-blue focus:outline-none"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm text-gray-400 mb-2">結束日期</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800/50 border border-gray-600 rounded-lg text-white focus:border-cyber-blue focus:outline-none"
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
                    setFilteredSnapshots(data.snapshots);
                    setRangeSummary(data.summary);
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

      {/* 歷史數據表格 */}
      <div className="bg-cyber-darker/60 rounded-xl cyber-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-800/50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-300">日期</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-gray-300">節點</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-300">A手數</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-300">B手數</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-300">手數差</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-300">A盈利</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-300">B盈利</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-300">AB總盈虧</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-300">A總息</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-300">總回佣</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-300">總盈含息佣</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-300">每手成本</th>
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
                    <td className="px-3 py-3 text-xs text-white font-medium">
                      {snapshot.snapshot_date}
                    </td>
                    <td className="px-3 py-3 text-xs text-center text-gray-300">
                      {snapshot.total_nodes}
                    </td>
                    <td className="px-3 py-3 text-xs text-right text-cyan-400">
                      {(snapshot.total_a_lots || 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-3 text-xs text-right text-cyan-400">
                      {(snapshot.total_b_lots || 0).toFixed(2)}
                    </td>
                    <td className={`px-3 py-3 text-xs text-right font-medium ${
                      (snapshot.total_lots_diff || 0) !== 0 ? 'text-red-400' : 'text-gray-300'
                    }`}>
                      {(snapshot.total_lots_diff || 0) >= 0 ? '+' : ''}{(snapshot.total_lots_diff || 0).toFixed(2)}
                    </td>
                    <td className={`px-3 py-3 text-xs text-right font-medium ${
                      (snapshot.total_a_profit || 0) >= 0 ? 'text-cyber-green' : 'text-red-400'
                    }`}>
                      {(snapshot.total_a_profit || 0) >= 0 ? '+' : ''}{(snapshot.total_a_profit || 0).toFixed(2)}
                    </td>
                    <td className={`px-3 py-3 text-xs text-right font-medium ${
                      (snapshot.total_b_profit || 0) >= 0 ? 'text-cyber-green' : 'text-red-400'
                    }`}>
                      {(snapshot.total_b_profit || 0) >= 0 ? '+' : ''}{(snapshot.total_b_profit || 0).toFixed(2)}
                    </td>
                    <td className={`px-3 py-3 text-sm text-right font-bold ${
                      (snapshot.total_ab_profit || 0) >= 0 ? 'text-cyber-green' : 'text-red-400'
                    }`}>
                      {(snapshot.total_ab_profit || 0) >= 0 ? '+' : ''}{(snapshot.total_ab_profit || 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-3 text-xs text-right text-cyan-400">
                      {(snapshot.total_a_interest || 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-3 text-xs text-right text-cyan-400 font-medium">
                      ${(snapshot.total_commission || 0).toFixed(2)}
                    </td>
                    <td className={`px-3 py-3 text-sm text-right font-bold ${
                      ((snapshot.total_ab_profit || 0) + (snapshot.total_a_interest || 0) + (snapshot.total_commission || 0)) >= 0 ? 'text-cyber-green' : 'text-red-400'
                    }`}>
                      {((snapshot.total_ab_profit || 0) + (snapshot.total_a_interest || 0) + (snapshot.total_commission || 0)) >= 0 ? '+' : ''}{((snapshot.total_ab_profit || 0) + (snapshot.total_a_interest || 0) + (snapshot.total_commission || 0)).toFixed(2)}
                    </td>
                    <td className={`px-3 py-3 text-xs text-right font-medium ${
                      (snapshot.total_cost_per_lot || 0) >= 0 ? 'text-cyber-green' : 'text-red-400'
                    }`}>
                      {(snapshot.total_cost_per_lot || 0) >= 0 ? '+' : ''}{(snapshot.total_cost_per_lot || 0).toFixed(2)}
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
