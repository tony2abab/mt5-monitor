const express = require('express');
const ExcelJS = require('exceljs');
const db = require('../database/db');

const router = express.Router();

/**
 * POST /api/export/history-excel
 * 生成歷史數據 Excel 文件
 * 
 * Request body:
 * {
 *   startDate: "YYYY-MM-DD",  // 開始日期
 *   endDate: "YYYY-MM-DD",    // 結束日期
 *   nodeIds: ["VPS1", "VPS2"], // 節點 ID 列表（可選，為空則導出所有節點）
 *   allowedGroups: ["A", "B"]  // 用戶允許的分組（前端傳入，用於權限過濾）
 * }
 */
router.post('/history-excel', async (req, res) => {
    try {
        const { startDate, endDate, nodeIds, allowedGroups } = req.body;
        
        // 驗證日期
        if (!startDate || !endDate) {
            return res.status(400).json({
                ok: false,
                error: '請提供開始日期和結束日期'
            });
        }
        
        // 獲取數據
        let allStats = db.getAllABStatsByDateRange(startDate, endDate, nodeIds);
        
        // 如果有分組限制，過濾數據（確保用戶只能導出其有權限的分組）
        if (allowedGroups && allowedGroups.length > 0) {
            allStats = allStats.filter(stat => 
                stat.client_group && allowedGroups.includes(stat.client_group)
            );
        }
        
        if (allStats.length === 0) {
            return res.status(404).json({
                ok: false,
                error: '指定日期範圍內沒有數據'
            });
        }
        
        // 創建 Excel 工作簿
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'MT5 Monitor';
        workbook.created = new Date();
        
        // 獲取所有唯一的節點和日期
        const uniqueNodes = [...new Set(allStats.map(s => s.node_id))];
        const uniqueDates = [...new Set(allStats.map(s => s.date))].sort();
        
        // 定義通用的列標題和樣式
        const columns = [
            { header: '日期', key: 'date', width: 12 },
            { header: '節點ID', key: 'node_id', width: 15 },
            { header: 'A手數', key: 'a_lots_total', width: 12 },
            { header: 'B手數', key: 'b_lots_total', width: 12 },
            { header: '手數差', key: 'lots_diff', width: 12 },
            { header: 'A盈利', key: 'a_profit_total', width: 14 },
            { header: 'B盈利', key: 'b_profit_total', width: 14 },
            { header: 'AB總盈利', key: 'ab_profit_total', width: 14 },
            { header: 'A總息', key: 'a_interest_total', width: 12 },
            { header: '每手成本', key: 'cost_per_lot', width: 12 },
            { header: '回佣/手', key: 'commission_per_lot', width: 12 },
            { header: '場上手數', key: 'open_lots', width: 12 },
            { header: '回佣總額', key: 'commission_total', width: 12 },
            { header: '總盈含息佣', key: 'total_profit_with_interest', width: 14 }
        ];
        
        // 設置標題行樣式
        const headerStyle = {
            font: { bold: true, color: { argb: 'FFFFFFFF' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } },
            alignment: { horizontal: 'center', vertical: 'middle' },
            border: {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            }
        };
        
        // 設置數據行樣式
        const dataStyle = {
            border: {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            }
        };
        
        // ========== 分頁1：每個節點每日數據 ==========
        const dailySheet = workbook.addWorksheet('每日節點數據');
        dailySheet.columns = columns;
        
        // 添加標題行樣式
        dailySheet.getRow(1).eachCell(cell => {
            Object.assign(cell, headerStyle);
        });
        
        // 添加數據
        allStats.forEach(stat => {
            const commissionTotal = (stat.a_lots_total || 0) * (stat.commission_per_lot || 0);
            const totalProfitWithInterest = (stat.ab_profit_total || 0) + (stat.a_interest_total || 0) + commissionTotal;
            
            const row = dailySheet.addRow({
                date: stat.date,
                node_id: stat.node_id,
                a_lots_total: stat.a_lots_total || 0,
                b_lots_total: stat.b_lots_total || 0,
                lots_diff: stat.lots_diff || 0,
                a_profit_total: stat.a_profit_total || 0,
                b_profit_total: stat.b_profit_total || 0,
                ab_profit_total: stat.ab_profit_total || 0,
                a_interest_total: stat.a_interest_total || 0,
                cost_per_lot: stat.cost_per_lot || 0,
                commission_per_lot: stat.commission_per_lot || 0,
                open_lots: stat.open_lots || 0,
                commission_total: commissionTotal,
                total_profit_with_interest: totalProfitWithInterest
            });
            
            // 設置數據行樣式
            row.eachCell(cell => {
                Object.assign(cell, dataStyle);
            });
        });
        
        // ========== 分頁2：每日加總數據 ==========
        const dailySummarySheet = workbook.addWorksheet('每日加總');
        dailySummarySheet.columns = [
            { header: '日期', key: 'date', width: 12 },
            { header: '節點數', key: 'node_count', width: 10 },
            { header: 'A手數合計', key: 'a_lots_total', width: 14 },
            { header: 'B手數合計', key: 'b_lots_total', width: 14 },
            { header: '手數差合計', key: 'lots_diff', width: 14 },
            { header: 'A盈利合計', key: 'a_profit_total', width: 14 },
            { header: 'B盈利合計', key: 'b_profit_total', width: 14 },
            { header: 'AB總盈利合計', key: 'ab_profit_total', width: 16 },
            { header: 'A總息合計', key: 'a_interest_total', width: 14 },
            { header: '回佣總額合計', key: 'commission_total', width: 14 },
            { header: '總盈含息佣合計', key: 'total_profit_with_interest', width: 16 }
        ];
        
        dailySummarySheet.getRow(1).eachCell(cell => {
            Object.assign(cell, headerStyle);
        });
        
        // 按日期分組計算
        const dailySummary = {};
        allStats.forEach(stat => {
            if (!dailySummary[stat.date]) {
                dailySummary[stat.date] = {
                    date: stat.date,
                    node_count: 0,
                    a_lots_total: 0,
                    b_lots_total: 0,
                    lots_diff: 0,
                    a_profit_total: 0,
                    b_profit_total: 0,
                    ab_profit_total: 0,
                    a_interest_total: 0,
                    commission_total: 0,
                    total_profit_with_interest: 0
                };
            }
            const d = dailySummary[stat.date];
            d.node_count++;
            d.a_lots_total += stat.a_lots_total || 0;
            d.b_lots_total += stat.b_lots_total || 0;
            d.lots_diff += stat.lots_diff || 0;
            d.a_profit_total += stat.a_profit_total || 0;
            d.b_profit_total += stat.b_profit_total || 0;
            d.ab_profit_total += stat.ab_profit_total || 0;
            d.a_interest_total += stat.a_interest_total || 0;
            const commissionTotal = (stat.a_lots_total || 0) * (stat.commission_per_lot || 0);
            d.commission_total += commissionTotal;
            d.total_profit_with_interest += (stat.ab_profit_total || 0) + (stat.a_interest_total || 0) + commissionTotal;
        });
        
        Object.values(dailySummary).sort((a, b) => a.date.localeCompare(b.date)).forEach(d => {
            const row = dailySummarySheet.addRow(d);
            row.eachCell(cell => {
                Object.assign(cell, dataStyle);
            });
        });
        
        // ========== 分頁3：每月加總數據 ==========
        const monthlySummarySheet = workbook.addWorksheet('每月加總');
        monthlySummarySheet.columns = [
            { header: '月份', key: 'month', width: 10 },
            { header: '節點ID', key: 'node_id', width: 15 },
            { header: 'A手數合計', key: 'a_lots_total', width: 14 },
            { header: 'B手數合計', key: 'b_lots_total', width: 14 },
            { header: 'A盈利合計', key: 'a_profit_total', width: 14 },
            { header: 'B盈利合計', key: 'b_profit_total', width: 14 },
            { header: 'AB總盈利合計', key: 'ab_profit_total', width: 16 },
            { header: 'A總息合計', key: 'a_interest_total', width: 14 },
            { header: '回佣總額合計', key: 'commission_total', width: 14 },
            { header: '總盈含息佣合計', key: 'total_profit_with_interest', width: 16 }
        ];
        
        monthlySummarySheet.getRow(1).eachCell(cell => {
            Object.assign(cell, headerStyle);
        });
        
        // 按月份和節點分組計算
        const monthlySummary = {};
        const monthlyTotal = {};
        
        allStats.forEach(stat => {
            const month = stat.date.substring(0, 7); // YYYY-MM
            const key = `${month}_${stat.node_id}`;
            
            if (!monthlySummary[key]) {
                monthlySummary[key] = {
                    month,
                    node_id: stat.node_id,
                    a_lots_total: 0,
                    b_lots_total: 0,
                    a_profit_total: 0,
                    b_profit_total: 0,
                    ab_profit_total: 0,
                    a_interest_total: 0,
                    commission_total: 0,
                    total_profit_with_interest: 0
                };
            }
            
            if (!monthlyTotal[month]) {
                monthlyTotal[month] = {
                    month,
                    node_id: '【全部節點合計】',
                    a_lots_total: 0,
                    b_lots_total: 0,
                    a_profit_total: 0,
                    b_profit_total: 0,
                    ab_profit_total: 0,
                    a_interest_total: 0,
                    commission_total: 0,
                    total_profit_with_interest: 0
                };
            }
            
            const m = monthlySummary[key];
            const t = monthlyTotal[month];
            const commissionTotal = (stat.a_lots_total || 0) * (stat.commission_per_lot || 0);
            const totalProfit = (stat.ab_profit_total || 0) + (stat.a_interest_total || 0) + commissionTotal;
            
            // 節點月度統計
            m.a_lots_total += stat.a_lots_total || 0;
            m.b_lots_total += stat.b_lots_total || 0;
            m.a_profit_total += stat.a_profit_total || 0;
            m.b_profit_total += stat.b_profit_total || 0;
            m.ab_profit_total += stat.ab_profit_total || 0;
            m.a_interest_total += stat.a_interest_total || 0;
            m.commission_total += commissionTotal;
            m.total_profit_with_interest += totalProfit;
            
            // 月度總計
            t.a_lots_total += stat.a_lots_total || 0;
            t.b_lots_total += stat.b_lots_total || 0;
            t.a_profit_total += stat.a_profit_total || 0;
            t.b_profit_total += stat.b_profit_total || 0;
            t.ab_profit_total += stat.ab_profit_total || 0;
            t.a_interest_total += stat.a_interest_total || 0;
            t.commission_total += commissionTotal;
            t.total_profit_with_interest += totalProfit;
        });
        
        // 按月份排序，每個月先顯示各節點，再顯示合計
        const months = [...new Set(Object.values(monthlySummary).map(m => m.month))].sort();
        
        months.forEach(month => {
            // 該月各節點數據
            const nodeData = Object.values(monthlySummary)
                .filter(m => m.month === month)
                .sort((a, b) => a.node_id.localeCompare(b.node_id));
            
            nodeData.forEach(d => {
                const row = monthlySummarySheet.addRow(d);
                row.eachCell(cell => {
                    Object.assign(cell, dataStyle);
                });
            });
            
            // 該月合計（用不同顏色標記）
            const totalRow = monthlySummarySheet.addRow(monthlyTotal[month]);
            totalRow.eachCell(cell => {
                cell.font = { bold: true };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
                Object.assign(cell, dataStyle);
            });
            
            // 添加空行分隔不同月份
            monthlySummarySheet.addRow([]);
        });
        
        // 設置響應頭
        const filename = `歷史數據_${startDate}_${endDate}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
        
        // 寫入響應
        await workbook.xlsx.write(res);
        res.end();
        
    } catch (error) {
        console.error('Error generating Excel:', error);
        res.status(500).json({
            ok: false,
            error: 'Internal server error: ' + error.message
        });
    }
});

/**
 * GET /api/export/available-nodes
 * 獲取可用的節點列表（用於前端節點選擇器）
 */
router.get('/available-nodes', (req, res) => {
    try {
        const nodes = db.getAllNodes();
        res.json({
            ok: true,
            nodes: nodes.map(n => ({
                id: n.id,
                name: n.name,
                client_group: n.client_group
            }))
        });
    } catch (error) {
        console.error('Error fetching nodes:', error);
        res.status(500).json({
            ok: false,
            error: 'Internal server error'
        });
    }
});

module.exports = router;
