// ===== renderer.js - 页面渲染函数 =====

// ========== 数据总览页面 ==========
function renderOverview() {
    setTopBar(`<label class="flex items-center space-x-1.5 cursor-pointer"><input type="radio" name="globalRegion" value="all" ${State.currentFilterRegion==='all'?'checked':''} class="w-3.5 h-3.5 accent-green-600"><span>全部订单</span></label><label class="flex items-center space-x-1.5 cursor-pointer"><input type="radio" name="globalRegion" value="macau" ${State.currentFilterRegion==='macau'?'checked':''} class="w-3.5 h-3.5 accent-green-600"><span>只看澳门</span></label><label class="flex items-center space-x-1.5 cursor-pointer"><input type="radio" name="globalRegion" value="hongkong" ${State.currentFilterRegion==='hongkong'?'checked':''} class="w-3.5 h-3.5 accent-green-600"><span>只看香港</span></label><label class="flex items-center space-x-1.5 cursor-pointer"><input type="radio" name="globalRegion" value="yuegang" ${State.currentFilterRegion==='yuegang'?'checked':''} class="w-3.5 h-3.5 accent-green-600"><span>只看粤港</span></label>`);
    return `
    <div class="overview-container">
        <div class="overview-charts-row">
            <div id="overviewBarChart" class="overview-chart-box"></div>
            <div id="overviewPieChart" class="overview-chart-box"></div>
        </div>
        <div class="overview-bottom-row">
            <div class="overview-info-panel" id="overviewInfoPanel">
                <div>全部总金额：0</div>
                <div>澳门单总额：0</div>
                <div>香港单总额：0</div>
            </div>
            <div class="overview-profit-panel" id="overviewProfitPanel">
                <div id="overviewProfitLines"></div>
            </div>
        </div>
    </div>`;
}

function initOverviewCharts() {
    const barDom = document.getElementById('overviewBarChart');
    const pieDom = document.getElementById('overviewPieChart');
    if (!barDom || !pieDom) return;
    const existingBar = echarts.getInstanceByDom(barDom);
    const existingPie = echarts.getInstanceByDom(pieDom);
    if (existingBar) existingBar.dispose();
    if (existingPie) existingPie.dispose();
    const barChart = echarts.init(barDom);
    const pieChart = echarts.init(pieDom);

    const filtered = getFilteredOrders();
    const typeMap = {};
    let totalAll = 0, totalMacau = 0, totalHongkong = 0;
    filtered.forEach(o => {
        const amt = parseFloat(o.totalAmount) || 0;
        if (amt <= 0) return;
        const type = (o.betType || '其他').trim();
        if (!typeMap[type]) typeMap[type] = 0;
        typeMap[type] += amt;
        totalAll += amt;
        if (o.region === '澳门') totalMacau += amt;
        else if (o.region === '香港') totalHongkong += amt;
    });
    const sortedTypes = Object.keys(typeMap).sort((a, b) => typeMap[b] - typeMap[a]);
    const barData = sortedTypes.map(t => typeMap[t]);
    const pieData = sortedTypes.map(t => ({ value: Math.round(typeMap[t] * 100) / 100, name: t }));
    const baseColors = ['#9a60b4','#ee6666','#91cc75','#fc8452','#5470c6','#73c0de','#3ba272','#fa8c16','#2f4554','#c23531','#61a0a8','#d48265','#91c7ae','#749f83','#ca8622','#bda29a'];
    const getColor = (idx) => baseColors[idx % baseColors.length];

    barChart.setOption({
        title: { text: '各投注类型的总金额', left: 'center', top: 10, textStyle: { fontSize: 16, fontWeight: 'normal' } },
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: '8%', right: '3%', bottom: '10%', top: '20%' },
        xAxis: { type: 'value', name: '总金额', nameLocation: 'middle', nameGap: 25, axisLabel: { formatter: '{value}' } },
        yAxis: { type: 'category', data: sortedTypes, axisTick: { show: false }, inverse: true },
        series: [{
            name: '总金额',
            type: 'bar',
            data: barData.map((v, idx) => ({
                value: Math.round(v * 100) / 100,
                itemStyle: { color: getColor(idx) }
            })),
            label: { show: true, position: 'right', formatter: '{c}', fontSize: 12 }
        }]
    });

    pieChart.setOption({
        title: { text: '各投注类型的占比', left: 'center', top: 10, textStyle: { fontSize: 16, fontWeight: 'normal' } },
        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
        legend: { orient: 'vertical', left: 'left', top: 'center' },
        series: [{
            name: '占比',
            type: 'pie',
            radius: '80%',
            center: ['55%', '55%'],
            label: { show: true, position: 'inside', formatter: '{b}\n{d}%', fontSize: 13 },
            emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' } },
            data: pieData
        }]
    });

    const infoPanel = document.getElementById('overviewInfoPanel');
    if (infoPanel) {
        infoPanel.innerHTML = `
            <div>全部总金额：${formatMoney(totalAll)}</div>
            <div>澳门单总额：${formatMoney(totalMacau)}</div>
            <div>香港单总额：${formatMoney(totalHongkong)}</div>
        `;
    }

    const profitLinesDiv = document.getElementById('overviewProfitLines');
    if (profitLinesDiv) {
        const scheme = window.schemes[State.selectedSchemeIdx];
        let html = '<strong>当前赔率和返水设置的盈利情况分析</strong><br>';
        html += '<span style="font-size:12px;color:#888;">(仅供参考)</span><br>';
        html += '<span class="overview-color-red">低于0%：亏损</span> | ';
        html += '<span class="overview-color-green">0~3%：微利</span> | ';
        html += '<span class="overview-color-green">3%~6%：还不错</span> | ';
        html += '<span class="overview-color-green">大于6%：可观</span><br><br>';
        if (scheme && scheme.rows) {
            const rows = scheme.rows.filter(r => r.type && !r.type.startsWith('包') && !r.type.includes('连肖带') && !r.type.includes('连尾零') && !r.type.includes('平特肖带') && !r.type.includes('平特尾零'));
            const uniquePlays = [...new Set(rows.map(r => r.type))];
            uniquePlays.forEach(play => {
                const row = rows.find(r => r.type === play);
                if (row) {
                    const odds = parseFloat(row.odds) || 0;
                    const rebate = parseFloat(row.rebate) || 0;
                    const rate = odds > 0 ? ((odds - 1) - (rebate / 100) * odds) * 100 : 0;
                    const rateFixed = Math.round(rate * 100) / 100;
                    let level = '', cls = '';
                    if (rateFixed < 0) { level = '亏损'; cls = 'overview-color-red'; }
                    else if (rateFixed <= 3) { level = '微利'; cls = 'overview-color-green'; }
                    else if (rateFixed <= 6) { level = '还不错'; cls = 'overview-color-green'; }
                    else { level = '可观'; cls = 'overview-color-green'; }
                    html += `<div class="overview-profit-text-line">${play}的盈利率为：<span class="${cls}">${level}</span> (${rateFixed}%)</div>`;
                }
            });
        }
        html += '<div style="color:#888;margin-top:10px;">(仅显示主要玩法，更多类型敬请期待)</div>';
        profitLinesDiv.innerHTML = html;
    }

    const resizeHandler = () => { barChart.resize(); pieChart.resize(); };
    window.addEventListener('resize', resizeHandler);
}

// ========== 订单分析页面 ==========
function renderOrderAnalysis() {
    setTopBar(`<label class="flex items-center space-x-1.5 cursor-pointer"><input type="radio" name="globalRegion" value="all" ${State.currentFilterRegion==='all'?'checked':''} class="w-3.5 h-3.5 accent-green-600"><span>全部订单</span></label><label class="flex items-center space-x-1.5 cursor-pointer"><input type="radio" name="globalRegion" value="macau" ${State.currentFilterRegion==='macau'?'checked':''} class="w-3.5 h-3.5 accent-green-600"><span>只看澳门</span></label><label class="flex items-center space-x-1.5 cursor-pointer"><input type="radio" name="globalRegion" value="hongkong" ${State.currentFilterRegion==='hongkong'?'checked':''} class="w-3.5 h-3.5 accent-green-600"><span>只看香港</span></label><label class="flex items-center space-x-1.5 cursor-pointer"><input type="radio" name="globalRegion" value="yuegang" ${State.currentFilterRegion==='yuegang'?'checked':''} class="w-3.5 h-3.5 accent-green-600"><span>只看粤港</span></label>`);
    const betData = getNumberBetData();
    const sorted = sortedNumbers().sort((a, b) => (betData[b.num]||0) - (betData[a.num]||0));
    const { odds, rebate } = getTeMaOddsAndRebate();
    const totalBet = Object.values(betData).reduce((s,v)=>s+v,0);
    const tbodyHTML = sorted.map((item, idx) => {
        const cc = colorClass(item.color);
        const bet = betData[item.num] || 0;
        const profit = totalBet - (totalBet * (rebate / 100)) - (bet * odds);
        return `<tr data-num="${item.num}"><td class="${cc}">${item.num}${item.sheng}</td><td class="${cc} bet-cell">${formatMoney(bet)}</td><td class="${cc} profit-cell">${Math.round(profit)}</td><td class="${cc}">${idx+1}</td></tr>`;
    }).join('');
    return `<div class="flex gap-3 h-full"><div class="w-[16.8rem] bg-white border border-gray-300 flex-shrink-0 overflow-y-auto rounded shadow-sm"><table><thead class="sticky top-0"><tr><th>号码</th><th>下注数</th><th>盈亏</th><th>ID</th></tr></thead><tbody>${tbodyHTML}</tbody></table></div><div class="flex-1 flex flex-col gap-3 min-w-0"><div class="bg-white border border-gray-300 rounded shadow-sm" style="height:35%; width:85%; margin:0 auto;"><div class="text-center py-2 font-medium text-sm border-b">平特尾押注情况</div><div class="relative px-4 py-2" style="height:calc(100% - 36px);"><div class="absolute left-0 top-2 bottom-6 w-7 flex flex-col justify-between items-end pr-1 text-[10px] text-gray-400" id="weiScaleLabels"><span>12</span><span>8</span><span>4</span><span>0</span></div><div class="h-full flex items-end justify-around border-y border-gray-200 bg-gray-50 chart-grid rounded" id="chartPingTeWei"></div><div class="flex justify-around text-sm font-bold text-gray-700 mt-1" id="weiLabels"><span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span><span>9</span></div></div></div><div class="bg-white border border-gray-300 rounded shadow-sm" style="height:35%; width:85%; margin:0 auto;"><div class="text-center py-2 font-medium text-sm border-b">平特一肖押注情况</div><div class="relative px-4 py-2" style="height:calc(100% - 36px);"><div class="absolute left-0 top-2 bottom-6 w-7 flex flex-col justify-between items-end pr-1 text-[10px] text-gray-400" id="xiaoScaleLabels"><span>12</span><span>8</span><span>4</span><span>0</span></div><div class="h-full flex items-end justify-around border-y border-gray-200 bg-gray-50 chart-grid rounded" id="chartPingTeXiao"></div><div class="flex justify-around text-sm font-bold text-gray-700 mt-1" id="xiaoLabels">${shengOrder.map(s=>`<span>${s}</span>`).join('')}</div></div></div><div class="bg-white border border-gray-300 p-3 text-xs rounded shadow-sm" style="margin-top:16px;"><div class="font-medium mb-1.5">订单分析报告（仅参考）：</div><div class="text-gray-600 leading-5 text-[11px]" id="analysisReport"></div></div></div></div>`;
}

function renderCharts() {
    const weiContainer = document.getElementById('chartPingTeWei');
    if (weiContainer) {
        const weiData = Array(10).fill(0);
        const filtered = getFilteredOrders();
        filtered.forEach(order => {
            if (order.betType === '平特尾' && order.orderInfo) {
                const tails = order.orderInfo.split('-').filter(t => /\d+尾/.test(t));
                tails.forEach(t => { const d = parseInt(t.replace('尾', '')); if (!isNaN(d) && d >= 0 && d <= 9) weiData[d] += (parseFloat(order.amount) || 0); });
            }
        });
        const weiMax = Math.max(...weiData, 1);
        const weiYMax = Math.ceil(weiMax / 10) * 10;
        const weiStep = weiYMax / 4;
        const weiScaleLabels = document.getElementById('weiScaleLabels');
        if (weiScaleLabels) {
            let labelsHTML = '';
            for (let i = 4; i >= 0; i--) { labelsHTML += `<span>${Math.round(weiStep * i)}</span>`; }
            weiScaleLabels.innerHTML = labelsHTML;
        }
        const weiLabels = document.getElementById('weiLabels');
        if (weiLabels) { weiLabels.style.fontSize = '24px'; }
        const weiColors = ['#60a5fa','#3b82f6','#2563eb','#1d4ed8','#7c3aed','#a855f7','#ec4899','#f43f5e','#f97316','#eab308'];
        weiContainer.innerHTML = weiData.map((v,i) => {
            const h = (v/weiYMax)*100;
            return `<div class="bar-chart flex-1 mx-0.5" style="height:${Math.max(h,2)}%;background:${weiColors[i]};max-width:48px;position:relative;" data-tip="尾${i}: ${v}"><span style="position:absolute;top:-18px;left:50%;transform:translateX(-50%);font-size:20px;color:#333;font-weight:bold;">${v}</span></div>`;
        }).join('');
    }
    const xiaoContainer = document.getElementById('chartPingTeXiao');
    if (xiaoContainer) {
        const xiaoData = {};
        shengOrder.forEach(s => { xiaoData[s] = 0; });
        const filtered = getFilteredOrders();
        filtered.forEach(order => {
            if (order.betType === '平特肖' && order.orderInfo) {
                const zodiacs = order.orderInfo.split('-').filter(z => shengOrder.includes(z));
                zodiacs.forEach(z => { xiaoData[z] = (xiaoData[z]||0) + (parseFloat(order.amount) || 0); });
            }
        });
        const xiaoMax = Math.max(...Object.values(xiaoData), 1);
        const xiaoYMax = Math.ceil(xiaoMax / 10) * 10;
        const xiaoStep = xiaoYMax / 6;
        const xiaoScaleLabels = document.getElementById('xiaoScaleLabels');
        if (xiaoScaleLabels) {
            let labelsHTML = '';
            for (let i = 6; i >= 0; i--) { labelsHTML += `<span>${Math.round(xiaoStep * i)}</span>`; }
            xiaoScaleLabels.innerHTML = labelsHTML;
        }
        const xiaoLabels = document.getElementById('xiaoLabels');
        if (xiaoLabels) { xiaoLabels.style.fontSize = '24px'; }
        const xiaoColors = ['#60a5fa','#3b82f6','#2563eb','#1d4ed8','#7c3aed','#a855f7','#ec4899','#f43f5e','#f97316','#eab308','#84cc16','#ef4444'];
        xiaoContainer.innerHTML = shengOrder.map((s, i) => {
            const v = xiaoData[s] || 0;
            const h = (v/xiaoYMax)*100;
            return `<div class="bar-chart flex-1 mx-0.5" style="height:${Math.max(h,2)}%;background:${xiaoColors[i]};max-width:48px;position:relative;" data-tip="${s}: ${v}"><span style="position:absolute;top:-18px;left:50%;transform:translateX(-50%);font-size:20px;color:#333;font-weight:bold;">${v}</span></div>`;
        }).join('');
    }
    const report = document.getElementById('analysisReport');
    if (report) report.innerHTML = State.orderList.length === 0 ? '暂无订单数据。' : `澳门特码胜负差过大，建议降低亏损大的数字的押注数额。`;
}

// ========== 特码调单页面 ==========
function renderSpecialCode() {
    setTopBar(`<label class="flex items-center space-x-1.5 cursor-pointer"><input type="radio" name="globalRegion" value="all" ${State.currentFilterRegion==='all'?'checked':''} class="w-3.5 h-3.5 accent-green-600"><span>全部订单</span></label><label class="flex items-center space-x-1.5 cursor-pointer"><input type="radio" name="globalRegion" value="macau" ${State.currentFilterRegion==='macau'?'checked':''} class="w-3.5 h-3.5 accent-green-600"><span>只看澳门</span></label><label class="flex items-center space-x-1.5 cursor-pointer"><input type="radio" name="globalRegion" value="hongkong" ${State.currentFilterRegion==='hongkong'?'checked':''} class="w-3.5 h-3.5 accent-green-600"><span>只看香港</span></label><label class="flex items-center space-x-1.5 cursor-pointer"><input type="radio" name="globalRegion" value="yuegang" ${State.currentFilterRegion==='yuegang'?'checked':''} class="w-3.5 h-3.5 accent-green-600"><span>只看粤港</span></label>`);
    const betData = getNumberBetData();
    const sorted = sortedNumbers().sort((a, b) => {
        const valA = (betData[a.num]||0) - (State.adjustValues[a.num]||0);
        const valB = (betData[b.num]||0) - (State.adjustValues[b.num]||0);
        return valB - valA;
    });
    const schemeSel = document.getElementById('orderDetailSchemeSelect');
    const schemeIdx = schemeSel ? parseInt(schemeSel.value) : State.selectedSchemeIdx;
    const scheme = window.schemes[schemeIdx];
    const teMaRow = scheme ? scheme.rows.find(r => r.type === '特码') : null;
    const odds = teMaRow ? parseFloat(teMaRow.odds) : 47;
    const rebate = teMaRow ? parseFloat(teMaRow.rebate) : 0;
    const totalBet = Object.values(betData).reduce((s,v)=>s+v,0);
    const rebateAmount = totalBet * (rebate / 100);

    const tbodyHTML = sorted.map((item, idx) => {
        const cc = colorClass(item.color);
        const val = betData[item.num] || 0;
        const adj = State.adjustValues[item.num] || 0;
        const total = val - adj;
        const profit = totalBet - rebateAmount - (total * odds);
        return `<tr data-num="${item.num}"><td class="${cc}">${item.num}${item.sheng}</td><td class="${cc} bet-cell">${formatMoney(total)}</td><td class="${cc} profit-cell">${Math.round(profit)}</td><td class="${cc}">${idx+1}</td></tr>`;
    }).join('');

    const sortedAll = sortedNumbers();
    function buildColWithHeader(list) {
        return `
            <div class="grid grid-cols-4 text-[11px] items-center gap-0.5">
                <span class="text-center font-medium text-gray-600">号码</span>
                <span class="text-center font-medium text-gray-600">原金额</span>
                <span class="text-center font-medium text-gray-600">调整</span>
                <span class="text-center font-medium text-gray-600">总计</span>
            </div>
            ${list.map(item=>{
                const cc = colorClass(item.color);
                const val = betData[item.num] || 0;
                const adj = State.adjustValues[item.num] || 0;
                const total = val - adj;
                return`<div class="grid grid-cols-4 text-[11px] items-center gap-0.5">
                    <span class="${cc} text-center">${item.num}${item.sheng}</span>
                    <span class="text-center">${val}</span>
                    <input type="text" class="adj-input border border-gray-300 w-full text-center h-5 text-[11px] rounded" data-num="${item.num}" value="${adj||''}">
                    <span class="total-cell font-medium text-center">${total}</span>
                </div>`;
            }).join('')}
        `;
    }

    const origAmounts = sortedAll.map(item => betData[item.num] || 0);
    const minOrig = origAmounts.length ? Math.min(...origAmounts) : 0;
    const maxOrig = origAmounts.length ? Math.max(...origAmounts) : 0;
    const maxProfitOrig = totalBet - rebateAmount - (minOrig * odds);
    const maxLossOrig = totalBet - rebateAmount - (maxOrig * odds);
    let profitCountOrig = 0, lossCountOrig = 0;
    sortedAll.forEach(item => {
        const val = betData[item.num] || 0;
        const profit = totalBet - rebateAmount - (val * odds);
        if (profit > 0) profitCountOrig++;
        else if (profit < 0) lossCountOrig++;
    });

    const adjAmounts = sortedAll.map(item => {
        const val = betData[item.num] || 0;
        const adj = State.adjustValues[item.num] || 0;
        return val - adj;
    });
    const adjTotalBet = adjAmounts.reduce((s,v)=>s+v,0);
    const adjRebateAmount = adjTotalBet * (rebate / 100);
    const minAdj = adjAmounts.length ? Math.min(...adjAmounts) : 0;
    const maxAdj = adjAmounts.length ? Math.max(...adjAmounts) : 0;
    const maxProfitAdj = adjTotalBet - adjRebateAmount - (minAdj * odds);
    const maxLossAdj = adjTotalBet - adjRebateAmount - (maxAdj * odds);
    let profitCountAdj = 0, lossCountAdj = 0;
    sortedAll.forEach((item, idx) => {
        const val = adjAmounts[idx];
        const profit = adjTotalBet - adjRebateAmount - (val * odds);
        if (profit > 0) profitCountAdj++;
        else if (profit < 0) lossCountAdj++;
    });
    const adjustTotal = totalBet - adjTotalBet;

    const statsHTML = `
        <div class="text-center text-red-600 font-medium">原特码数据</div>
        <div class="grid grid-cols-5 gap-1 mb-2">
            <div class="border border-gray-300 py-1 text-center rounded">特码总额:${formatMoney(totalBet)}</div>
            <div class="border border-gray-300 py-1 text-center rounded">最大盈利:${formatMoney(maxProfitOrig)}</div>
            <div class="border border-gray-300 py-1 text-center rounded">最大亏损:<span class="num-red">${formatMoney(maxLossOrig)}</span></div>
            <div class="border border-gray-300 py-1 text-center rounded">盈利数量:${profitCountOrig}</div>
            <div class="border border-gray-300 py-1 text-center rounded">亏损数量:${lossCountOrig}</div>
        </div>
        <div class="text-center text-blue-600 font-medium">调整后数据</div>
        <div class="grid grid-cols-6 gap-1 mb-2">
            <div class="border border-gray-300 py-1 text-center rounded">吃码总额:${formatMoney(adjTotalBet)}</div>
            <div class="border border-gray-300 py-1 text-center rounded">调整金额:${formatMoney(adjustTotal)}</div>
            <div class="border border-gray-300 py-1 text-center rounded">最大盈利:${formatMoney(maxProfitAdj)}</div>
            <div class="border border-gray-300 py-1 text-center rounded">最大亏损:<span class="num-red">${formatMoney(maxLossAdj)}</span></div>
            <div class="border border-gray-300 py-1 text-center rounded">盈利数量:${profitCountAdj}</div>
            <div class="border border-gray-300 py-1 text-center rounded">亏损数量:${lossCountAdj}</div>
        </div>
        <div class="flex items-center gap-2 pt-1">
            <span class="text-[11px]">最大亏损</span>
            <input type="range" min="0" max="50" value="0" class="flex-1 h-1.5" id="adjustSlider">
            <span class="text-[11px]">调整器:<b id="sliderVal">0</b></span>
        </div>
    `;

    let reportedHTML = '<div class="text-center font-medium text-sm py-1 border-b mb-2">上报订单</div>';
    const regionFilter = State.currentFilterRegion === 'all' ? null : (State.currentFilterRegion === 'macau' ? '澳门' : (State.currentFilterRegion === 'hongkong' ? '香港' : '粤港'));
    const filteredReported = regionFilter ? State.reportedOrdersSpecial.filter(o => o.region === regionFilter) : State.reportedOrdersSpecial;
    if (filteredReported.length === 0) {
        reportedHTML += '<div style="color:#999;padding:10px;">暂无上报订单</div>';
    } else {
        reportedHTML += filteredReported.map((o, idx) => {
            const origIdx = regionFilter ? State.reportedOrdersSpecial.findIndex(r => r.region === regionFilter && r.orderInfo === o.orderInfo && r.amount === o.amount && r.betType === o.betType) : idx;
            return `<div style="display:flex;justify-content:space-between;align-items:center;padding:2px 0;border-bottom:1px solid #f0f0f0;">
                <span>${o.betType}:${o.orderInfo} 各${formatMoney(o.amount)} 合计${formatMoney(o.totalAmount)}</span>
                <button class="delete-reported-btn" data-type="special" data-index="${origIdx}" style="color:#dc2626;border:1px solid #fca5a5;background:#fef2f2;padding:1px 6px;border-radius:3px;font-size:11px;">删除</button>
            </div>`;
        }).join('');
    }

    return `<div class="flex gap-3 h-full"><div class="w-[16.8rem] bg-white border border-gray-300 flex-shrink-0 overflow-y-auto rounded shadow-sm"><table><thead class="sticky top-0"><tr><th>号码</th><th>下注数</th><th>盈亏</th><th>ID</th></tr></thead><tbody id="specialCodeLeftBody">${tbodyHTML}</tbody></table></div><div class="flex-1 flex flex-col gap-3 min-w-0"><div class="bg-white border border-gray-300 p-3 rounded shadow-sm"><div class="grid grid-cols-4 gap-3"><div>${buildColWithHeader(sortedAll.slice(0,12))}</div><div>${buildColWithHeader(sortedAll.slice(12,24))}</div><div>${buildColWithHeader(sortedAll.slice(24,36))}</div><div>${buildColWithHeader(sortedAll.slice(36,49))}</div></div></div><div class="bg-white border border-gray-300 p-3 text-xs rounded shadow-sm" id="specialCodeStats">${statsHTML}</div><div class="bg-white border border-gray-300 grid grid-cols-6 gap-1 p-2 text-xs rounded shadow-sm"><button class="border border-gray-300 py-1.5 hover:bg-gray-50 rounded" id="btnSaveAdjust">保存本次调整</button><button class="border border-gray-300 py-1.5 hover:bg-gray-50 rounded" id="btnRound10">改为10的倍数</button><button class="border border-gray-300 py-1.5 hover:bg-gray-50 rounded" id="btnClearAdjust">清空当前调整</button><button class="border border-gray-300 py-1.5 hover:bg-gray-50 rounded" id="btnClearOutput">清空输出框</button><button class="border border-gray-300 py-1.5 hover:bg-gray-50 rounded" id="btnResetAll">重置所有数据</button><button class="border border-gray-300 py-1.5 hover:bg-gray-50 rounded bg-green-50 text-green-700 font-medium">特码兑奖</button></div><div class="flex-1 min-h-0 bg-white border border-gray-300 rounded shadow-sm p-2 overflow-y-auto text-xs">${reportedHTML}</div><div class="flex gap-2 mt-1 mb-2"><button id="btnCopyReport" class="border border-gray-300 px-3 py-1 text-xs rounded hover:bg-gray-50 bg-white">复制上报</button><input type="text" class="flex-1 border border-gray-300 rounded px-2 py-1 text-xs" placeholder="输入调整记录..."><button class="border border-gray-300 px-3 py-1 text-xs rounded hover:bg-gray-50 bg-white">调整记录</button></div></div></div>`;
}

function updateSpecialCodeStats() {
    const container = document.getElementById('specialCodeStats');
    if (!container) return;
    const betData = getNumberBetData();
    const totalBet = Object.values(betData).reduce((s,v)=>s+v,0);
    const schemeSel = document.getElementById('orderDetailSchemeSelect');
    const schemeIdx = schemeSel ? parseInt(schemeSel.value) : State.selectedSchemeIdx;
    const scheme = window.schemes[schemeIdx];
    const teMaRow = scheme ? scheme.rows.find(r => r.type === '特码') : null;
    const odds = teMaRow ? parseFloat(teMaRow.odds) : 47;
    const rebate = teMaRow ? parseFloat(teMaRow.rebate) : 0;
    const rebateAmount = totalBet * (rebate / 100);

    const sortedAll = sortedNumbers();
    const origAmounts = sortedAll.map(item => betData[item.num] || 0);
    const minOrig = origAmounts.length ? Math.min(...origAmounts) : 0;
    const maxOrig = origAmounts.length ? Math.max(...origAmounts) : 0;
    const maxProfitOrig = totalBet - rebateAmount - (minOrig * odds);
    const maxLossOrig = totalBet - rebateAmount - (maxOrig * odds);
    let profitCountOrig = 0, lossCountOrig = 0;
    sortedAll.forEach(item => {
        const val = betData[item.num] || 0;
        const profit = totalBet - rebateAmount - (val * odds);
        if (profit > 0) profitCountOrig++;
        else if (profit < 0) lossCountOrig++;
    });

    const adjAmounts = sortedAll.map(item => {
        const val = betData[item.num] || 0;
        const adj = State.adjustValues[item.num] || 0;
        return val - adj;
    });
    const adjTotalBet = adjAmounts.reduce((s,v)=>s+v,0);
    const adjRebateAmount = adjTotalBet * (rebate / 100);
    const minAdj = adjAmounts.length ? Math.min(...adjAmounts) : 0;
    const maxAdj = adjAmounts.length ? Math.max(...adjAmounts) : 0;
    const maxProfitAdj = adjTotalBet - adjRebateAmount - (minAdj * odds);
    const maxLossAdj = adjTotalBet - adjRebateAmount - (maxAdj * odds);
    let profitCountAdj = 0, lossCountAdj = 0;
    sortedAll.forEach((item, idx) => {
        const val = adjAmounts[idx];
        const profit = adjTotalBet - adjRebateAmount - (val * odds);
        if (profit > 0) profitCountAdj++;
        else if (profit < 0) lossCountAdj++;
    });
    const adjustTotal = totalBet - adjTotalBet;

    container.innerHTML = `
        <div class="text-center text-red-600 font-medium">原特码数据</div>
        <div class="grid grid-cols-5 gap-1 mb-2">
            <div class="border border-gray-300 py-1 text-center rounded">特码总额:${formatMoney(totalBet)}</div>
            <div class="border border-gray-300 py-1 text-center rounded">最大盈利:${formatMoney(maxProfitOrig)}</div>
            <div class="border border-gray-300 py-1 text-center rounded">最大亏损:<span class="num-red">${formatMoney(maxLossOrig)}</span></div>
            <div class="border border-gray-300 py-1 text-center rounded">盈利数量:${profitCountOrig}</div>
            <div class="border border-gray-300 py-1 text-center rounded">亏损数量:${lossCountOrig}</div>
        </div>
        <div class="text-center text-blue-600 font-medium">调整后数据</div>
        <div class="grid grid-cols-6 gap-1 mb-2">
            <div class="border border-gray-300 py-1 text-center rounded">吃码总额:${formatMoney(adjTotalBet)}</div>
            <div class="border border-gray-300 py-1 text-center rounded">调整金额:${formatMoney(adjustTotal)}</div>
            <div class="border border-gray-300 py-1 text-center rounded">最大盈利:${formatMoney(maxProfitAdj)}</div>
            <div class="border border-gray-300 py-1 text-center rounded">最大亏损:<span class="num-red">${formatMoney(maxLossAdj)}</span></div>
            <div class="border border-gray-300 py-1 text-center rounded">盈利数量:${profitCountAdj}</div>
            <div class="border border-gray-300 py-1 text-center rounded">亏损数量:${lossCountAdj}</div>
        </div>
        <div class="flex items-center gap-2 pt-1">
            <span class="text-[11px]">最大亏损</span>
            <input type="range" min="0" max="50" value="0" class="flex-1 h-1.5" id="adjustSlider">
            <span class="text-[11px]">调整器:<b id="sliderVal">0</b></span>
        </div>`;
    bindSpecialCodeEvents();
}

function updateSpecialCodeLeftTable() {
    const tbody = document.getElementById('specialCodeLeftBody');
    if (!tbody) return;
    const betData = getNumberBetData();
    const schemeSel = document.getElementById('orderDetailSchemeSelect');
    const schemeIdx = schemeSel ? parseInt(schemeSel.value) : State.selectedSchemeIdx;
    const scheme = window.schemes[schemeIdx];
    const teMaRow = scheme ? scheme.rows.find(r => r.type === '特码') : null;
    const odds = teMaRow ? parseFloat(teMaRow.odds) : 47;
    const rebate = teMaRow ? parseFloat(teMaRow.rebate) : 0;
    const totalBet = Object.values(betData).reduce((s,v)=>s+v,0);
    const rows = Array.from(tbody.querySelectorAll('tr[data-num]'));

    rows.forEach(row => {
        const num = row.getAttribute('data-num');
        const val = betData[num] || 0;
        const adj = State.adjustValues[num] || 0;
        const total = val - adj;
        const profit = totalBet - (totalBet * (rebate / 100)) - (total * odds);
        const betCell = row.querySelector('.bet-cell');
        const profitCell = row.querySelector('.profit-cell');
        if (betCell) betCell.textContent = formatMoney(total);
        if (profitCell) profitCell.textContent = Math.round(profit);
        row.dataset.sortVal = total;
    });

    rows.sort((a, b) => {
        const valA = parseFloat(a.dataset.sortVal) || 0;
        const valB = parseFloat(b.dataset.sortVal) || 0;
        return valB - valA;
    });
    rows.forEach(row => tbody.appendChild(row));

    const rowElements = tbody.querySelectorAll('tr[data-num]');
    rowElements.forEach((row, idx) => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 4) {
            cells[3].textContent = idx + 1;
        }
    });
}

function bindSpecialCodeEvents() {
    document.querySelectorAll('.adj-input').forEach(input => {
        input.addEventListener('input', function() {
            State.adjustValues[this.getAttribute('data-num')] = parseFloat(this.value) || 0;
            updateAllTotals();
            updateSpecialCodeStats();
            updateSpecialCodeLeftTable();
            persistAll();
        });
    });
    const slider = document.getElementById('adjustSlider');
    if (slider) {
        slider.addEventListener('input', function() {
            const val = parseInt(this.value);
            document.getElementById('sliderVal').textContent = val;
            numberList.forEach(item => { State.adjustValues[item.num] = val; });
            document.querySelectorAll('.adj-input').forEach(inp => { inp.value = val || ''; });
            updateAllTotals();
            updateSpecialCodeStats();
            updateSpecialCodeLeftTable();
            persistAll();
        });
    }
    document.getElementById('btnRound10')?.addEventListener('click', () => {
        numberList.forEach(item => { State.adjustValues[item.num] = Math.round((State.adjustValues[item.num] || 0) / 10) * 10; });
        document.querySelectorAll('.adj-input').forEach(inp => { inp.value = State.adjustValues[inp.getAttribute('data-num')] || ''; });
        updateAllTotals();
        updateSpecialCodeStats();
        updateSpecialCodeLeftTable();
        persistAll();
    });
    document.getElementById('btnClearAdjust')?.addEventListener('click', () => {
        numberList.forEach(item => { State.adjustValues[item.num] = 0; });
        document.querySelectorAll('.adj-input').forEach(inp => { inp.value = ''; });
        updateAllTotals();
        updateSpecialCodeStats();
        updateSpecialCodeLeftTable();
        persistAll();
    });
    document.getElementById('btnSaveAdjust')?.addEventListener('click', () => {
        persistAll();
        showToast('调整已保存！');
    });
}

function updateAllTotals() {
    document.querySelectorAll('.adj-input').forEach(input => {
        const num = input.getAttribute('data-num');
        const betData = getNumberBetData();
        const total = (betData[num] || 0) - (State.adjustValues[num] || 0);
        const row = input.closest('.grid');
        if (row) { const tc = row.querySelector('.total-cell'); if (tc) tc.textContent = total; }
    });
}

// ========== 连肖调单页面 ==========
function renderLianXiao() {
    setTopBar(`<label class="flex items-center space-x-1.5 cursor-pointer"><input type="radio" name="globalRegion" value="all" ${State.currentFilterRegion==='all'?'checked':''} class="w-3.5 h-3.5 accent-green-600"><span>全部订单</span></label><label class="flex items-center space-x-1.5 cursor-pointer"><input type="radio" name="globalRegion" value="macau" ${State.currentFilterRegion==='macau'?'checked':''} class="w-3.5 h-3.5 accent-green-600"><span>只看澳门</span></label><label class="flex items-center space-x-1.5 cursor-pointer"><input type="radio" name="globalRegion" value="hongkong" ${State.currentFilterRegion==='hongkong'?'checked':''} class="w-3.5 h-3.5 accent-green-600"><span>只看香港</span></label><label class="flex items-center space-x-1.5 cursor-pointer"><input type="radio" name="globalRegion" value="yuegang" ${State.currentFilterRegion==='yuegang'?'checked':''} class="w-3.5 h-3.5 accent-green-600"><span>只看粤港</span></label>`);
    const filtered = getFilteredOrders();
    const lianXiaoOrders = filtered.filter(o => o.betType && o.betType.includes('连肖') && o.betType !== '平特肖');
    const lxMap = {};
    lianXiaoOrders.forEach(o => {
        const info = o.orderInfo || '';
        const cleanInfo = info.replace(/[\(\)（）]/g, '|').replace(/\|+/g, '|').replace(/^\||\|$/g, '');
        const combos = cleanInfo.split('|').filter(c => c.trim());
        combos.forEach(combo => { const key = combo.trim(); if (key) { if (!lxMap[key]) lxMap[key] = { amount: 0, category: o.betType }; lxMap[key].amount += (parseFloat(o.amount) || 0); } });
    });
    const allCombos = Object.keys(lxMap).sort();
    const drawNums = (getCurrentDrawData().macau && getCurrentDrawData().macau.nums && getCurrentDrawData().macau.nums.length >= 7) ? getCurrentDrawData().macau.nums : [];
    const leftRows = allCombos.length > 0 ? allCombos.map(k => { const profit = calcProfit(lxMap[k].category, k, lxMap[k].amount, drawNums); return `<tr><td>${k}</td><td>${lxMap[k].amount}</td><td class="${profit < 0 ? 'num-red' : 'num-green'}">${profit}</td></tr>`; }).join('') : '';
    const byN = { 2:[], 3:[], 4:[], 5:[] };
    allCombos.forEach(k => { const len = k.replace(/-/g, '').length; if (len>=2 && len<=5 && byN[len]) byN[len].push(k); });
    function renderLxTable(keys, cat) {
        if (!keys.length) return '<table><thead><tr><th>生肖组</th><th>下注数</th><th>盈亏</th></tr></thead><tbody></tbody></table>';
        return `<table><thead><tr><th>生肖组</th><th>下注数</th><th>盈亏</th></tr></thead><tbody>${keys.map(k => { const profit = calcProfit(cat, k, lxMap[k].amount, drawNums); return `<tr><td>${k}</td><td>${lxMap[k].amount}</td><td class="${profit < 0 ? 'num-red' : 'num-green'}">${profit}</td></tr>`; }).join('')}</tbody></table>`;
    }
    const teXiaoOrders = filtered.filter(o => o.betType === '特肖');
    const baoOrders = filtered.filter(o => o.betType && o.betType.startsWith('包'));
    const pingMaOrders = filtered.filter(o => o.betType === '平码');
    const specialOrders = [...teXiaoOrders, ...baoOrders, ...pingMaOrders];
    let specialHTML = '<table><thead><tr><th>类型</th><th>下注数</th><th>盈亏</th></tr></thead><tbody>';
    if (specialOrders.length > 0) specialOrders.forEach(o => { const profit = calcProfit(o.betType, o.orderInfo, (parseFloat(o.amount)||0), drawNums); specialHTML += `<tr><td>${o.betType}:${o.orderInfo}</td><td>${(parseFloat(o.amount)||0)}</td><td class="${profit < 0 ? 'num-red' : 'num-green'}">${profit}</td></tr>`; });
    specialHTML += '</tbody></table>';
    const lxStats = calcStatsByCombos(lxMap, drawNums);
    const lianXiaoTotal = lianXiaoOrders.reduce((s,o)=>s+(parseFloat(o.totalAmount)||0),0);

    const adjLxMap = {};
    for (const key of Object.keys(lxMap)) {
        const zodiacs = key.replace(/-/g, '').split('');
        let totalAdj = 0;
        zodiacs.forEach(z => {
            const nums = ZODIAC_NUMS[z] ? ZODIAC_NUMS[z].split(/[\s,，]+/) : [];
            nums.forEach(num => { totalAdj += State.adjustValues[num] || 0; });
        });
        const adjAmount = lxMap[key].amount - totalAdj;
        adjLxMap[key] = { amount: adjAmount, category: lxMap[key].category };
    }
    const adjLxStats = calcStatsByCombos(adjLxMap, drawNums);
    const adjLxTotal = Object.values(adjLxMap).reduce((s, v) => s + v.amount, 0);
    const adjustLxTotal = lianXiaoTotal - adjLxTotal;

    let reportedHTML = '<div class="text-center font-medium text-sm py-1 border-b mb-2">上报订单</div>';
    const regionFilter = State.currentFilterRegion === 'all' ? null : (State.currentFilterRegion === 'macau' ? '澳门' : (State.currentFilterRegion === 'hongkong' ? '香港' : '粤港'));
    const filteredReported = regionFilter ? State.reportedOrdersLianXiao.filter(o => o.region === regionFilter) : State.reportedOrdersLianXiao;
    if (filteredReported.length === 0) {
        reportedHTML += '<div style="color:#999;padding:10px;">暂无上报订单</div>';
    } else {
        reportedHTML += filteredReported.map((o, idx) => {
            const origIdx = regionFilter ? State.reportedOrdersLianXiao.findIndex(r => r.region === regionFilter && r.orderInfo === o.orderInfo && r.amount === o.amount && r.betType === o.betType) : idx;
            return `<div style="display:flex;justify-content:space-between;align-items:center;padding:2px 0;border-bottom:1px solid #f0f0f0;">
                <span>${o.betType}:${o.orderInfo} 各${formatMoney(o.amount)} 合计${formatMoney(o.totalAmount)}</span>
                <button class="delete-reported-btn" data-type="lianXiao" data-index="${origIdx}" style="color:#dc2626;border:1px solid #fca5a5;background:#fef2f2;padding:1px 6px;border-radius:3px;font-size:11px;">删除</button>
            </div>`;
        }).join('');
    }

    return `<div class="flex gap-3 h-full"><div class="w-[16.8rem] bg-white border border-gray-300 flex-shrink-0 rounded shadow-sm overflow-y-auto"><table><thead><tr><th>生肖组</th><th>下注数</th><th>盈亏</th></tr></thead><tbody>${leftRows || ''}</tbody></table></div><div class="flex-1 flex flex-col gap-3 min-w-0"><div class="grid grid-cols-5 gap-3 overflow-y-auto" style="flex:1; max-height:100%;"><div class="bg-white border border-gray-300 rounded shadow-sm overflow-y-auto"><div class="text-center font-medium text-sm py-1 border-b">二连肖</div>${renderLxTable(byN[2], '二连肖')}</div><div class="bg-white border border-gray-300 rounded shadow-sm overflow-y-auto"><div class="text-center font-medium text-sm py-1 border-b">三连肖</div>${renderLxTable(byN[3], '三连肖')}</div><div class="bg-white border border-gray-300 rounded shadow-sm overflow-y-auto"><div class="text-center font-medium text-sm py-1 border-b">四连肖</div>${renderLxTable(byN[4], '四连肖')}</div><div class="bg-white border border-gray-300 rounded shadow-sm overflow-y-auto"><div class="text-center font-medium text-sm py-1 border-b">五连肖</div>${renderLxTable(byN[5], '五连肖')}</div><div class="bg-white border border-gray-300 rounded shadow-sm overflow-y-auto"><div class="text-center font-medium text-sm py-1 border-b">特肖/包/平码</div>${specialHTML}</div></div><div class="space-y-2 text-xs"><div class="text-center text-red-600 font-medium">原连肖数据</div><div class="grid grid-cols-5 gap-1"><div class="border border-gray-300 bg-white py-1.5 text-center rounded">连肖总额:${lianXiaoTotal}</div><div class="border border-gray-300 bg-white py-1.5 text-center rounded">最大盈利:${lxStats.maxProfit}</div><div class="border border-gray-300 bg-white py-1.5 text-center rounded">最大亏损:<span class="num-red">${lxStats.maxLoss}</span></div><div class="border border-gray-300 bg-white py-1.5 text-center rounded">盈利数量:${lxStats.profitCount}</div><div class="border border-gray-300 bg-white py-1.5 text-center rounded">亏损数量:${lxStats.lossCount}</div></div>
        <div class="text-center text-blue-600 font-medium">调整后数据</div>
        <div class="grid grid-cols-5 gap-1">
            <div class="border border-gray-300 bg-white py-1.5 text-center rounded">吃单总额:${adjLxTotal}</div>
            <div class="border border-gray-300 bg-white py-1.5 text-center rounded">调整总额:${adjustLxTotal}</div>
            <div class="border border-gray-300 bg-white py-1.5 text-center rounded">最大盈利:${adjLxStats.maxProfit}</div>
            <div class="border border-gray-300 bg-white py-1.5 text-center rounded">最大亏损:<span class="num-red">${adjLxStats.maxLoss}</span></div>
            <div class="border border-gray-300 bg-white py-1.5 text-center rounded">调整后项数:${Object.keys(adjLxMap).length}</div>
        </div></div><div class="bg-white border border-gray-300 rounded shadow-sm p-2 overflow-y-auto text-xs" style="min-height:150px;max-height:300px;">${reportedHTML}</div><div class="grid grid-cols-3 gap-1 text-xs"><button class="border border-gray-300 bg-white py-1.5 hover:bg-gray-50 rounded">打印连肖调整</button><button class="border border-gray-300 bg-white py-1.5 hover:bg-gray-50 rounded">清空输出框</button><button class="border border-gray-300 bg-white py-1.5 hover:bg-gray-50 rounded">重置调整</button></div><div class="flex gap-2 mt-1 mb-2"><input type="text" class="flex-1 border border-gray-300 rounded px-2 py-1 text-xs" placeholder="输入调整记录..."><button class="border border-gray-300 px-3 py-1 text-xs rounded hover:bg-gray-50 bg-white">调整记录</button></div></div></div>`;
}

// ========== 连码调单页面 ==========
function renderLianMa() {
    setTopBar(`<label class="flex items-center space-x-1.5 cursor-pointer"><input type="radio" name="globalRegion" value="all" ${State.currentFilterRegion==='all'?'checked':''} class="w-3.5 h-3.5 accent-green-600"><span>全部订单</span></label><label class="flex items-center space-x-1.5 cursor-pointer"><input type="radio" name="globalRegion" value="macau" ${State.currentFilterRegion==='macau'?'checked':''} class="w-3.5 h-3.5 accent-green-600"><span>只看澳门</span></label><label class="flex items-center space-x-1.5 cursor-pointer"><input type="radio" name="globalRegion" value="hongkong" ${State.currentFilterRegion==='hongkong'?'checked':''} class="w-3.5 h-3.5 accent-green-600"><span>只看香港</span></label><label class="flex items-center space-x-1.5 cursor-pointer"><input type="radio" name="globalRegion" value="yuegang" ${State.currentFilterRegion==='yuegang'?'checked':''} class="w-3.5 h-3.5 accent-green-600"><span>只看粤港</span></label>`);
    const filtered = getFilteredOrders();
    const drawNums = (getCurrentDrawData().macau && getCurrentDrawData().macau.nums && getCurrentDrawData().macau.nums.length >= 7) ? getCurrentDrawData().macau.nums : [];
    const erZhongEr = filtered.filter(o => o.betType === '二中二');
    const sanZhongSan = filtered.filter(o => o.betType === '三中三');
    const tePeng = filtered.filter(o => o.betType === '特碰');
    const buZhong = filtered.filter(o => o.betType && o.betType.includes('不中'));
    const lianWei = filtered.filter(o => o.betType && o.betType.includes('连尾'));
    function buildNumTable(orders) {
        if (orders.length === 0) return `<table><thead><tr><th>号码组</th><th>下注数</th><th>盈亏</th></tr></thead><tbody></tbody></table>`;
        const map = {};
        orders.forEach(o => {
            const info = o.orderInfo || '';
            const cleanInfo = info.replace(/[\(\)（）]/g, '|').replace(/\|+/g, '|').replace(/^\||\|$/g, '');
            const combos = cleanInfo.split('|').filter(c => c.trim());
            combos.forEach(c => { const key = c.trim(); if (key) { if (!map[key]) map[key] = { amount: 0, category: o.betType }; map[key].amount += (parseFloat(o.amount) || 0); } });
        });
        const keys = Object.keys(map).sort();
        return `<table><thead><tr><th>号码组</th><th>下注数</th><th>盈亏</th></tr></thead><tbody>${keys.map(k => { const profit = calcProfit(map[k].category, k, map[k].amount, drawNums); return `<tr><td>${k}</td><td>${map[k].amount}</td><td class="${profit < 0 ? 'num-red' : 'num-green'}">${profit}</td></tr>`; }).join('')}</tbody></table>`;
    }
    const leftAll = [...erZhongEr, ...sanZhongSan, ...tePeng];
    let leftHTML = '<table><thead><tr><th>号码组</th><th>下注数</th><th>盈亏</th></tr></thead><tbody>';
    if (leftAll.length > 0) {
        const leftMap = {};
        leftAll.forEach(o => {
            const info = o.orderInfo || '';
            const cleanInfo = info.replace(/[\(\)（）]/g, '|').replace(/\|+/g, '|').replace(/^\||\|$/g, '');
            const combos = cleanInfo.split('|').filter(c => c.trim());
            combos.forEach(c => { const key = c.trim(); if (key) { if (!leftMap[key]) leftMap[key] = { amount: 0, category: o.betType }; leftMap[key].amount += (parseFloat(o.amount) || 0); } });
        });
        Object.keys(leftMap).sort().forEach(k => { const profit = calcProfit(leftMap[k].category, k, leftMap[k].amount, drawNums); leftHTML += `<tr><td>${k}</td><td>${leftMap[k].amount}</td><td class="${profit < 0 ? 'num-red' : 'num-green'}">${profit}</td></tr>`; });
    }
    leftHTML += '</tbody></table>';
    const lmMap = {};
    [...erZhongEr, ...sanZhongSan, ...tePeng].forEach(o => {
        const info = o.orderInfo || '';
        const cleanInfo = info.replace(/[\(\)（）]/g, '|').replace(/\|+/g, '|').replace(/^\||\|$/g, '');
        const combos = cleanInfo.split('|').filter(c => c.trim());
        combos.forEach(c => { const key = c.trim(); if (key) { if (!lmMap[key]) lmMap[key] = { amount: 0, category: o.betType }; lmMap[key].amount += (parseFloat(o.amount) || 0); } });
    });
    const lmStats = calcStatsByCombos(lmMap, drawNums);
    const lianMaTotal = leftAll.reduce((s,o)=>s+(parseFloat(o.totalAmount)||0),0);

    const adjLmMap = {};
    for (const key of Object.keys(lmMap)) {
        const nums = key.replace(/[()]/g, '').split('-').filter(n => n.trim());
        let totalAdj = 0;
        nums.forEach(num => {
            const padded = num.length === 1 ? '0' + num : num;
            totalAdj += State.adjustValues[padded] || 0;
        });
        const adjAmount = lmMap[key].amount - totalAdj;
        adjLmMap[key] = { amount: adjAmount, category: lmMap[key].category };
    }
    const adjLmStats = calcStatsByCombos(adjLmMap, drawNums);
    const adjLmTotal = Object.values(adjLmMap).reduce((s, v) => s + v.amount, 0);
    const adjustLmTotal = lianMaTotal - adjLmTotal;

    let reportedHTML = '<div class="text-center font-medium text-sm py-1 border-b mb-2">上报订单</div>';
    const regionFilter = State.currentFilterRegion === 'all' ? null : (State.currentFilterRegion === 'macau' ? '澳门' : (State.currentFilterRegion === 'hongkong' ? '香港' : '粤港'));
    const filteredReported = regionFilter ? State.reportedOrdersLianMa.filter(o => o.region === regionFilter) : State.reportedOrdersLianMa;
    if (filteredReported.length === 0) {
        reportedHTML += '<div style="color:#999;padding:10px;">暂无上报订单</div>';
    } else {
        reportedHTML += filteredReported.map((o, idx) => {
            const origIdx = regionFilter ? State.reportedOrdersLianMa.findIndex(r => r.region === regionFilter && r.orderInfo === o.orderInfo && r.amount === o.amount && r.betType === o.betType) : idx;
            return `<div style="display:flex;justify-content:space-between;align-items:center;padding:2px 0;border-bottom:1px solid #f0f0f0;">
                <span>${o.betType}:${o.orderInfo} 各${formatMoney(o.amount)} 合计${formatMoney(o.totalAmount)}</span>
                <button class="delete-reported-btn" data-type="lianMa" data-index="${origIdx}" style="color:#dc2626;border:1px solid #fca5a5;background:#fef2f2;padding:1px 6px;border-radius:3px;font-size:11px;">删除</button>
            </div>`;
        }).join('');
    }

    return `<div class="flex gap-3 h-full"><div class="w-[16.8rem] bg-white border border-gray-300 flex-shrink-0 overflow-y-auto rounded shadow-sm">${leftHTML}</div><div class="flex-1 flex flex-col gap-3 min-w-0"><div class="grid grid-cols-4 gap-3 overflow-y-auto" style="flex:1; max-height:100%;"><div class="bg-white border border-gray-300 rounded shadow-sm overflow-y-auto"><div class="text-center font-medium text-sm py-1 border-b">二中二+特碰</div>${buildNumTable([...erZhongEr, ...tePeng])}</div><div class="bg-white border border-gray-300 rounded shadow-sm overflow-y-auto"><div class="text-center font-medium text-sm py-1 border-b">三中三</div>${buildNumTable(sanZhongSan)}</div><div class="bg-white border border-gray-300 rounded shadow-sm overflow-y-auto"><div class="text-center font-medium text-sm py-1 border-b">N不中</div>${buildNumTable(buZhong)}</div><div class="bg-white border border-gray-300 rounded shadow-sm overflow-y-auto"><div class="text-center font-medium text-sm py-1 border-b">连尾</div>${buildNumTable(lianWei)}</div></div><div class="space-y-2 text-xs"><div class="text-center text-red-600 font-medium">原连码数据</div><div class="grid grid-cols-5 gap-1"><div class="border border-gray-300 bg-white py-1.5 text-center rounded">连码总额:${lianMaTotal}</div><div class="border border-gray-300 bg-white py-1.5 text-center rounded">最大盈利:${lmStats.maxProfit}</div><div class="border border-gray-300 bg-white py-1.5 text-center rounded">最大亏损:<span class="num-red">${lmStats.maxLoss}</span></div><div class="border border-gray-300 bg-white py-1.5 text-center rounded">盈利数量:${lmStats.profitCount}</div><div class="border border-gray-300 bg-white py-1.5 text-center rounded">亏损数量:${lmStats.lossCount}</div></div>
        <div class="text-center text-blue-600 font-medium">调整后数据</div>
        <div class="grid grid-cols-5 gap-1">
            <div class="border border-gray-300 bg-white py-1.5 text-center rounded">吃单总额:${adjLmTotal}</div>
            <div class="border border-gray-300 bg-white py-1.5 text-center rounded">调整总额:${adjustLmTotal}</div>
            <div class="border border-gray-300 bg-white py-1.5 text-center rounded">最大盈利:${adjLmStats.maxProfit}</div>
            <div class="border border-gray-300 bg-white py-1.5 text-center rounded">最大亏损:<span class="num-red">${adjLmStats.maxLoss}</span></div>
            <div class="border border-gray-300 bg-white py-1.5 text-center rounded">调整后项数:${Object.keys(adjLmMap).length}</div>
        </div></div><div class="bg-white border border-gray-300 rounded shadow-sm p-2 overflow-y-auto text-xs" style="min-height:150px;max-height:300px;">${reportedHTML}</div><div class="grid grid-cols-3 gap-1 text-xs"><button class="border border-gray-300 bg-white py-1.5 hover:bg-gray-50 rounded">打印连码调整</button><button class="border border-gray-300 bg-white py-1.5 hover:bg-gray-50 rounded">清空输出框</button><button class="border border-gray-300 bg-white py-1.5 hover:bg-gray-50 rounded">重置调整</button></div><div class="flex gap-2 mt-1 mb-2"><input type="text" class="flex-1 border border-gray-300 rounded px-2 py-1 text-xs" placeholder="输入调整记录..."><button class="border border-gray-300 px-3 py-1 text-xs rounded hover:bg-gray-50 bg-white">调整记录</button></div></div></div>`;
}

// ========== 订单详情页面 ==========
function highlightOrderInfo(orderInfo, winStatus, betType, drawNums) {
    if (!orderInfo) return '';
    if (winStatus !== '中奖' || !drawNums || drawNums.length < 7) {
        return orderInfo.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }
    if (betType && betType.includes('不中')) {
        return '<span class="hit-red">' + orderInfo.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</span>';
    }
    const teMa = drawNums[6];
    const zhengMa = drawNums.slice(0, 6);
    const allNums = drawNums;
    const allDrawEq = getAllDrawEquivalents(drawNums);
    const zhengMaEq = getZhengMaEquivalents(drawNums);
    const teMaEq = getNumAllEquivalents(teMa);

    const isGroupPlay = betType && (
        betType.includes('连肖') ||
        betType.includes('连尾') ||
        betType === '二中二' || betType === '三中三' ||
        betType === '特碰' ||
        betType.includes('不中')
    );

    if (isGroupPlay) {
        const groups = parseGroups(orderInfo);
        if (groups.length === 0) {
            let result = '';
            const parts = orderInfo.split(/(-)/);
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                if (part === '-') { result += '-'; continue; }
                if (isTokenHitSingle(part, betType, drawNums)) {
                    result += `<span class="hit-red">${part.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</span>`;
                } else {
                    result += part.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
                }
            }
            return result;
        }

        let resultHtml = orderInfo;
        const escapeRegex = (str) => str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        groups.forEach(group => {
            let groupWon = false;
            if (betType.includes('连肖')) {
                const drawShengs = allNums.map(n => getShengByNum(n)).filter(Boolean);
                const zodList = group.split('-').map(z => z.trim());
                groupWon = zodList.length > 0 && zodList.every(z => drawShengs.includes(z));
            } else if (betType.includes('连尾')) {
                const drawTails = allNums.map(n => String(parseInt(n) % 10));
                const tailList = group.split('-').map(t => t.replace('尾','').trim());
                groupWon = tailList.length > 0 && tailList.every(t => drawTails.includes(t));
            } else if (betType === '二中二' || betType === '三中三') {
                const zhengSet = new Set(zhengMa);
                const nums = group.split('-').map(n => padTwo(n.trim()));
                groupWon = nums.length > 0 && nums.every(n => zhengSet.has(n));
            } else if (betType === '特碰') {
                const parts = group.split('-').map(n => padTwo(n.trim()));
                groupWon = parts.length === 2 && teMa === parts[0] && zhengMa.includes(parts[1]);
            } else if (betType.includes('不中')) {
                const allSet = new Set(allNums);
                const betNums = group.split('-').map(n => padTwo(n.trim()));
                groupWon = !betNums.some(n => allSet.has(n));
            }
            if (groupWon) {
                const escapedGroup = escapeRegex(group);
                const groupPattern = new RegExp(`(\\(|（)?${escapedGroup}(\\)|）)?`, 'g');
                resultHtml = resultHtml.replace(groupPattern, (match) => {
                    return `<span class="hit-red">${match}</span>`;
                });
            }
        });
        return resultHtml;
    }

    function isTokenHitSingle(token, betType, drawNums) {
        const trimmed = token.trim();
        if (!trimmed) return false;
        const teMa = drawNums[6];
        const allNums = drawNums;
        const teSheng = getShengByNum(teMa);
        const drawShengs = allNums.map(n => getShengByNum(n)).filter(Boolean);
        const drawTails = allNums.map(n => String(parseInt(n) % 10));
        const zhengMa = drawNums.slice(0, 6);

        if (betType === '特码') return teMaEq.has(trimmed);
        if (betType === '特肖') return trimmed === teSheng;
        if (betType === '平特肖') return drawShengs.includes(trimmed);
        if (betType === '平特尾') {
            const tokenTail = trimmed.replace('尾','');
            return drawTails.includes(tokenTail);
        }
        if (betType === '平码') return zhengMaEq.has(trimmed);
        if (betType && betType.startsWith('包')) return teMaEq.has(trimmed);
        return allDrawEq.has(trimmed);
    }

    let result = '';
    const parts = orderInfo.split(/(-)/);
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (part === '-') { result += '-'; continue; }
        if (isTokenHitSingle(part, betType, drawNums)) {
            result += `<span class="hit-red">${part.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</span>`;
        } else {
            result += part.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        }
    }
    return result;
}

function renderOrderDetail() {
    setTopBar('');
    const areas = ['macau','hongkong','yuegang'];
    const areaLabels = {macau:'澳门',hongkong:'香港',yuegang:'粤港'};
    let drawHTML = '';
    const todayDraw = getCurrentDrawData();
    areas.forEach((area, idx) => {
        const data = todayDraw[area] || {nums:[], shengs:[]};
        let cellsHTML = '';
        for(let i=0;i<7;i++){
            const num = data.nums[i] || '';
            const sheng = data.shengs[i] || '';
            if (i === 6) {
                cellsHTML += `<div class="flex flex-col items-center justify-end" style="width:40px;">
                    <span style="font-size:20px;font-weight:bold;line-height:40px;">+</span>
                    <div style="height:28px;"></div>
                </div>`;
            }
            cellsHTML += `<div class="flex flex-col items-center gap-1">
                ${buildBallHTML(num)}
                ${buildShengBlock(sheng)}
            </div>`;
        }
        const areaHist = State.historyRecords.filter(r => r.area === areaLabels[area] && r.date === State.currentFilterDate);
        const latestQihao = areaHist.length ? areaHist[areaHist.length-1].qihao : '';
        const qihaoShort = latestQihao ? String(latestQihao).slice(-3) + '期' : '';
        let titleText = areaLabels[area] + '开奖';
        if (area !== 'hongkong' && qihaoShort) titleText += ' ' + qihaoShort;
        drawHTML += `<div class="flex flex-col items-center gap-1 px-2">
            <div class="text-[11px] font-medium text-gray-600">${titleText}</div>
            <div class="flex justify-center gap-1 flex-wrap items-end">
                ${cellsHTML}
            </div>
        </div>`;
        if (idx < areas.length - 1) drawHTML += `<div class="border-l border-gray-300"></div>`;
    });

    const filteredWithRealIdx = [];
    for (let i = 0; i < State.orderList.length; i++) {
        const o = State.orderList[i];
        const dateMatch = !State.currentFilterDate || o.date === State.currentFilterDate;
        if (dateMatch) {
            if (State.orderDetailFilters.region !== '不限' && o.region !== State.orderDetailFilters.region) continue;
            if (State.orderDetailFilters.betType !== '不限' && o.betType !== State.orderDetailFilters.betType) continue;
            if (State.orderDetailFilters.winStatus !== '不限' && o.winStatus !== State.orderDetailFilters.winStatus) continue;
            if (State.orderDetailFilters.reporter !== '不限' && o.reporter !== State.orderDetailFilters.reporter) continue;
            filteredWithRealIdx.push({ ...o, _realIdx: i });
        }
    }
    const regions = ['不限', '澳门', '香港', '粤港'];
    const betTypes = ['不限', ...new Set(State.orderList.filter(o => o.date === State.currentFilterDate).map(o => o.betType))].filter(Boolean);
    const winStatuses = ['不限', '中奖', '未中奖', '未知'];
    const reporters = ['不限', ...new Set(State.orderList.filter(o => o.date === State.currentFilterDate).map(o => o.reporter))].filter(Boolean);

    const drawDataForHL = {};
    for (const area of areas) {
        const data = todayDraw[area];
        drawDataForHL[area] = data && data.nums && data.nums.length >= 7 ? data.nums : null;
    }

    const orderRows = filteredWithRealIdx.length > 0 ? filteredWithRealIdx.map((o, idx) => {
        const rowClass = State.selectedOrderIndices.has(o._realIdx) ? 'selected' : '';
        const info = o.orderInfo || '';
        const winDisplay = o.winStatus === '中奖' ? `<span style="color:red;font-weight:bold;">中奖</span>` : (o.winStatus === '未中奖' ? '未中奖' : '未知');
        const areaKey = o.region === '澳门' ? 'macau' : (o.region === '香港' ? 'hongkong' : (o.region === '粤港' ? 'yuegang' : null));
        const drawNums = areaKey ? drawDataForHL[areaKey] : null;
        const highlightedInfo = highlightOrderInfo(info, o.winStatus, o.betType, drawNums);

        let winAmountHtml = '';
        if (o.winStatus === '中奖' && o.winAmount !== undefined && o.winAmount !== '') {
            const amtVal = formatMoney(parseFloat(o.winAmount));
            winAmountHtml = `<span class="win-amount-red">${amtVal}</span>`;
        } else if (o.winStatus === '未中奖') {
            winAmountHtml = '';
        } else {
            winAmountHtml = '';
        }

        return `<tr data-index="${idx}" data-real-index="${o._realIdx}" class="order-row ${rowClass}">
            <td>${idx + 1}</td>
            <td>${o.region}</td>
            <td>${(o.betType || '').trim()}</td>
            <td class="order-info-cell" title="${info.replace(/"/g,'&quot;')}">${highlightedInfo}</td>
            <td>${o.calcMethod || ''}</td>
            <td>${formatMoney(o.amount)}</td>
            <td>${formatMoney(o.totalAmount)}</td>
            <td>${o.orderSeq || ''}条</td>
            <td>${o.reporter || ''}</td>
            <td>${winDisplay}</td>
            <td>${winAmountHtml}</td>
            <td>${o.remark || ''}</td>
        </tr>`;
    }).join('') : '';

    let duijiangMacau = '', duijiangHongkong = '', duijiangYuegang = '', duijiangAll = '';
    if (State.filterDuijiangDone) {
        duijiangMacau = generateRegionProfitSummary('澳门', State.orderList);
        duijiangHongkong = generateRegionProfitSummary('香港', State.orderList);
        duijiangYuegang = generateRegionProfitSummary('粤港', State.orderList);
        duijiangAll = generateRegionProfitSummary('all', State.orderList);
    }

    return `<div class="flex flex-col gap-3 h-full">
        <div class="bg-white border border-gray-300 p-2 flex items-center gap-2 text-xs flex-shrink-0 rounded shadow-sm flex-wrap">
            <button class="border border-gray-300 px-2.5 py-1 hover:bg-gray-50 rounded" onclick="handleClearOrders()">清空订单</button>
            <button class="border border-gray-300 px-2.5 py-1 hover:bg-gray-50 rounded" onclick="handleExportAllData()">导出数据</button>
            <button class="border border-gray-300 px-2.5 py-1 hover:bg-gray-50 rounded" onclick="handleImportAllData()">导入数据</button>
            <button class="border border-gray-300 px-2.5 py-1 hover:bg-gray-50 rounded" id="btnFilterDuijiang">过滤兑奖</button>
            <button class="border border-gray-300 px-2.5 py-1 hover:bg-gray-50 rounded" id="btnComprehensiveDuijiang">综合兑奖</button>
            <button class="border border-gray-300 px-2.5 py-1 hover:bg-gray-50 rounded" id="btnResetDraw">重置开奖</button>
            <div class="custom-select-wrapper" id="orderDetailSchemeSelectWrapper" style="width:110px;"></div>
            <div class="flex-1 flex min-w-[200px]">
                <input type="text" id="orderSearchInput" placeholder="搜索订单关键字" class="flex-1 border border-gray-300 px-2 py-1 bg-cyan-50 rounded-l">
                <button id="orderSearchBtn" class="border border-gray-300 px-3 py-1 hover:bg-gray-50 bg-white rounded-r">搜索</button>
            </div>
        </div>
        <div class="bg-white border border-gray-300 flex-1 overflow-auto min-h-0 rounded shadow-sm" id="orderDetailTableWrapper" style="position:relative;">
            <table id="orderDetailTable" style="table-layout:fixed; width:100%;">
                <thead class="sticky top-0">
                    <tr>
                        <th style="width:4%">序号</th>
                        <th style="width:7%">区域</th>
                        <th style="width:7%">投注类型</th>
                        <th style="width:16%">订单信息</th>
                        <th style="width:7%">计算方式</th>
                        <th style="width:7%">金额</th>
                        <th style="width:8%">订单总额</th>
                        <th style="width:7%">订单条数</th>
                        <th style="width:7%">申报人</th>
                        <th style="width:7%">中奖详情</th>
                        <th style="width:8%">中奖金额</th>
                        <th style="width:8%">备注</th>
                    </tr>
                </thead>
                <tbody id="orderDetailTbody">${orderRows}</tbody>
            </table>
        </div>
        <div class="bg-white border border-gray-300 p-2 text-xs flex justify-between items-center flex-shrink-0 rounded shadow-sm">
            <span>订单总额：<b>${formatMoney(filteredWithRealIdx.reduce((s,o)=>s+(parseFloat(o.totalAmount)||0),0))}</b></span>
            <span id="orderGroupCount"></span>
            <span>状态：<span class="text-green-600 font-medium">${filteredWithRealIdx.length>0?'正常':'无订单'}</span></span>
        </div>
        <div class="grid grid-cols-4 gap-3 text-xs flex-shrink-0">
            <div class="custom-select-wrapper" id="filterRegionWrapper"></div>
            <div class="custom-select-wrapper" id="filterBetTypeWrapper"></div>
            <div class="custom-select-wrapper" id="filterWinStatusWrapper"></div>
            <div class="custom-select-wrapper" id="filterReporterWrapper"></div>
        </div>
        <div class="bg-white border border-gray-300 p-3 flex-shrink-0 rounded shadow-sm" id="drawAreaContainer">
            <div class="flex justify-around items-center">${drawHTML}</div>
        </div>
        <div class="grid grid-cols-4 gap-3 flex-1 min-h-[80px]">
            <div class="duijiang-result-box bg-white border border-gray-300 p-2 text-xs rounded shadow-sm overflow-y-auto" style="max-height:250px; overflow-x: hidden; word-break: break-all;"><div class="font-medium mb-1">澳门兑奖结果</div><div id="duijiangMacauContent">${duijiangMacau}</div></div>
            <div class="duijiang-result-box bg-white border border-gray-300 p-2 text-xs rounded shadow-sm overflow-y-auto" style="max-height:250px; overflow-x: hidden; word-break: break-all;"><div class="font-medium mb-1">香港兑奖结果</div><div id="duijiangHongkongContent">${duijiangHongkong}</div></div>
            <div class="duijiang-result-box bg-white border border-gray-300 p-2 text-xs rounded shadow-sm overflow-y-auto" style="max-height:250px; overflow-x: hidden; word-break: break-all;"><div class="font-medium mb-1">粤港兑奖结果</div><div id="duijiangYuegangContent">${duijiangYuegang}</div></div>
            <div class="duijiang-result-box bg-white border border-gray-300 p-2 text-xs rounded shadow-sm overflow-y-auto" style="max-height:250px; overflow-x: hidden; word-break: break-all;"><div class="font-medium mb-1">综合结果</div><div id="duijiangAllContent">${duijiangAll}</div></div>
        </div>
    </div>`;
}

// ========== 今日开奖页面 ==========
function renderTodayDraw() {
    setTopBar('');
    const areas = ['macau','hongkong','yuegang'];
    const areaTitles = {macau:'澳门开奖',hongkong:'香港开奖',yuegang:'粤港开奖'};
    const areaColors = {macau:'text-red-600',hongkong:'text-blue-600',yuegang:'text-purple-600'};
    const todayDraw = getCurrentDrawData();
    const createAreaBlock = (area) => {
        const data = todayDraw[area] || {nums:[], shengs:[]};
        const locked = (State.drawLocked[State.currentFilterDate] && State.drawLocked[State.currentFilterDate][area]) || false;
        const dateStr = State.currentFilterDate;
        const year = dateStr.substring(0,4);
        const startOfYear = new Date(parseInt(year),0,1);
        const targetDate = new Date(dateStr);
        const dayOfYear = Math.floor((targetDate - startOfYear) / (1000*60*60*24)) + 1;
        const qihaoShort = String(dayOfYear).padStart(3,'0') + '期';
        const timeText = area === 'yuegang' ? '22:30' : '21:33';
        let titleText = areaTitles[area];
        if (area !== 'hongkong') titleText += ' ' + qihaoShort;
        let inputsHTML = '';
        for(let i=0;i<7;i++){
            const numVal = data.nums[i]||''; const sheng = data.shengs[i]||'--';
            const color = getColorByNum(numVal); const colorStyle = color?`color:${color==='red'?'#dc2626':color==='blue'?'#2563eb':'#059669'}`:'';
            const shengColorStyle = getShengColorStyle(sheng);
            if (i === 6) inputsHTML += '<span style="font-size:20px;font-weight:bold;margin:0 2px;">+</span>';
            inputsHTML += `<div class="flex flex-col items-center"><input type="text" class="draw-num-input w-12 h-9 text-center border border-gray-300 rounded text-sm font-bold" maxlength="2" data-area="${area}" data-index="${i}" value="${numVal}" style="${colorStyle}" ${locked?'disabled':''}><span class="text-xs font-bold draw-sheng mt-1" data-area="${area}" data-index="${i}" style="color:${shengColorStyle||'#333'}">${sheng}</span></div>`;
        }
        return `<div class="flex flex-col items-center gap-2"><div class="bg-white border border-gray-300 rounded shadow-sm p-4 w-full"><div class="text-center font-medium text-base mb-3 ${areaColors[area]}">${titleText}</div><div class="flex justify-center gap-2 mb-3 flex-wrap">${inputsHTML}</div></div><div class="flex gap-2"><button class="border border-gray-300 bg-white px-2 py-1 text-xs rounded hover:bg-gray-50 modify-btn" data-area="${area}">修改开奖</button><button class="border border-gray-300 bg-white px-2 py-1 text-xs rounded hover:bg-gray-50 save-draw-btn" data-area="${area}">保存兑奖</button></div><div class="text-center text-xs text-gray-500">预计开奖时间：${timeText}</div></div>`;
    };
    return `<div class="grid grid-cols-3 gap-6 flex-1">${areas.map(area => createAreaBlock(area)).join('')}</div>`;
}

// ========== 开奖历史页面 ==========
function renderDrawHistory() {
    setTopBar(`<label class="flex items-center space-x-1.5 cursor-pointer"><input type="radio" name="historyRegion" value="all" ${State.historyRegionFilter==='all'?'checked':''} class="w-3.5 h-3.5 accent-green-600"><span>全部地区</span></label><label class="flex items-center space-x-1.5 cursor-pointer"><input type="radio" name="historyRegion" value="macau" ${State.historyRegionFilter==='macau'?'checked':''} class="w-3.5 h-3.5 accent-green-600"><span>只看澳门</span></label><label class="flex items-center space-x-1.5 cursor-pointer"><input type="radio" name="historyRegion" value="hongkong" ${State.historyRegionFilter==='hongkong'?'checked':''} class="w-3.5 h-3.5 accent-green-600"><span>只看香港</span></label><label class="flex items-center space-x-1.5 cursor-pointer"><input type="radio" name="historyRegion" value="yuegang" ${State.historyRegionFilter==='yuegang'?'checked':''} class="w-3.5 h-3.5 accent-green-600"><span>只看粤港</span></label>`);
    const filtered = State.historyRegionFilter === 'all' ? State.historyRecords : State.historyRecords.filter(r => {
        if (State.historyRegionFilter === 'macau') return r.area === '澳门';
        if (State.historyRegionFilter === 'hongkong') return r.area === '香港';
        if (State.historyRegionFilter === 'yuegang') return r.area === '粤港';
        return true;
    });
    const sortedFiltered = [...filtered].sort((a, b) => {
        if (a.date > b.date) return -1;
        if (a.date < b.date) return 1;
        return 0;
    });
    const clearBtnHTML = sortedFiltered.length > 0 ? `<button id="clearAllHistoryBtn" class="border border-red-400 text-red-500 px-3 py-1 text-xs rounded hover:bg-red-50">清空全部开奖</button>` : '';
    if (sortedFiltered.length === 0) return `<div class="flex flex-col gap-3 h-full"><div class="flex justify-end">${clearBtnHTML}</div><div class="bg-white border border-gray-300 rounded shadow-sm flex-1 overflow-auto flex items-center justify-center text-gray-400">暂无开奖历史</div></div>`;
    const rows = sortedFiltered.map((r, idx) => {
        const qihaoShort = String(r.qihao).slice(-3) + '期';
        const numList = r.nums.split(',').map(n => n.trim()).filter(n => n);
        const shengList = r.shengs.split(',').map(s => s.trim()).filter(s => s);
        let cellsHTML = '';
        for (let i = 0; i < 7; i++) {
            if (i === 6) cellsHTML += '<span style="font-size:20px;font-weight:bold;margin:0 2px;">+</span>';
            const num = numList[i] || '';
            const sheng = shengList[i] || '';
            cellsHTML += `<div class="flex flex-col items-center gap-1">
                ${buildBallHTML(num)}
                ${buildShengBlock(sheng)}
            </div>`;
        }
        return `<tr>
            <td>${qihaoShort}</td>
            <td>${r.date}</td>
            <td>${r.area}</td>
            <td>
                <div class="flex justify-center gap-1 items-end flex-wrap">${cellsHTML}</div>
            </td>
            <td><button class="delete-history-btn border border-red-300 text-red-500 px-2 py-0.5 text-xs rounded hover:bg-red-50" data-idx="${idx}" data-area="${r.area}" data-date="${r.date}">删除</button></td>
        </tr>`;
    }).join('');
    return `<div class="flex flex-col gap-3 h-full"><div class="flex justify-end">${clearBtnHTML}</div><div class="bg-white border border-gray-300 rounded shadow-sm flex-1 overflow-auto"><table><thead class="sticky top-0"><tr><th>期号</th><th>日期</th><th>区域</th><th>开奖号码</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}

// ========== 操作日志页面（已修复：按日期过滤） ==========
function renderOperationLog() {
    setTopBar('');
    const redTypes = ['修改订单','剪切订单','复制订单','删除订单','粘贴订单','批量修改'];
    const today = State.currentFilterDate;
    const filteredLogs = State.operationLogs.filter(log => {
        const logDate = log.time ? log.time.substring(0, 10) : '';
        return logDate === today;
    });
    let html = '';
    if (filteredLogs.length === 0) {
        html += '<div class="bg-white border border-gray-300 rounded shadow-sm p-4 text-center text-gray-400">暂无操作日志</div>';
    } else {
        const reversedLogs = [...filteredLogs].reverse();
        html += '<div class="bg-white border border-gray-300 rounded shadow-sm p-4 overflow-y-auto flex-1" style="font-family:Consolas,Microsoft YaHei,monospace;font-size:13px;line-height:1.8;white-space:pre-wrap;">';
        reversedLogs.forEach(log => {
            const isRed = redTypes.includes(log.type);
            const line = `${log.detail}  ${log.time}`;
            html += `<div style="${isRed ? 'color:#dc2626;' : 'color:#333;'}">${line}</div>`;
        });
        html += '</div>';
    }
    return html;
}

// ========== 号码大全页面 ==========
function renderNumberList() {
    setTopBar('');
    const categoryOrder = [
        {name:'波色',keys:['红波','蓝波','绿波','红单','红双','蓝单','蓝双','绿单','绿双','红大','红小','蓝大','蓝小','绿大','绿小','红','蓝','绿','兰波','兰','兰单','兰双']},
        {name:'单双大小',keys:['单','单数','单号','双','双数','双号','大','大数','大号','小','小数','小号']},
        {name:'生肖',keys:shengOrder.concat(shengOrder.map(s=>'老'+s))},
        {name:'五行',keys:['金','木','水','火','土']},
        {name:'头数',keys:['0头','1头','2头','3头','4头','0头单','1头单','2头单','3头单','4头单','0头双','1头双','2头双','3头双','4头双']},
        {name:'尾数',keys:['0尾','1尾','2尾','3尾','4尾','5尾','6尾','7尾','8尾','9尾','小尾','大尾']},
        {name:'合数',keys:['合单','合数单','合双','合数双','合大','合小']},
        {name:'其他属性',keys:['家禽','家肖','家畜','家','野兽','野肖','野','马边','鼠边','单笔画肖','双笔画肖','吉肖','凶肖','天肖','地肖','阴肖','阳肖','男肖','女肖','朝肖','夕肖','前肖','后肖','左肖','右肖','有偏旁肖','无偏旁肖']},
        {name:'各类码',keys:['反数','内围码','外围码','前码','后码','左边码','右边码','楼上码','楼下码','风码','雨码','深码','浅码','拼码','搏码','高码','低码','长码','短码','黑码','白码','冷码','热码','爱码','恨码','顺码','逆码','天码','地码']}
    ];
    let html = '<div style="margin-bottom:12px;"><span style="font-weight:bold;font-size:14px;">本年肖</span> <select id="yearZodiacSelect" style="border:1px solid #d1d5db;padding:2px 8px;border-radius:4px;margin-left:8px;">';
    shengOrder.forEach(s => { html += `<option value="${s}" ${window.yearZodiac===s?'selected':''}>${s}</option>`; });
    html += '</select></div>';
    const usedKeys = new Set();
    let textContent = '';
    categoryOrder.forEach(cat => {
        let catText = '';
        cat.keys.forEach(key => {
            if (!D[key] || usedKeys.has(key) || /^\d{1,2}$/.test(key)) return;
            usedKeys.add(key);
            const nums = D[key].split(/[\s,，]+/).filter(n => n.trim());
            const numStr = nums.join(' ');
            catText += key + '\t' + numStr + '\n';
        });
        if (catText) { textContent += '—— ' + cat.name + ' ——\n' + catText + '\n'; }
    });
    const remaining = Object.keys(D).filter(k => !usedKeys.has(k) && !/^\d{1,2}$/.test(k));
    if (remaining.length > 0) {
        let otherText = '';
        remaining.forEach(key => {
            const nums = D[key].split(/[\s,，]+/).filter(n => n.trim());
            const numStr = nums.join(' ');
            otherText += key + '\t' + numStr + '\n';
        });
        textContent += '—— 其他 ——\n' + otherText;
    }
    return `<div class="bg-white border border-gray-300 rounded shadow-sm flex-1 overflow-auto p-4"><pre style="white-space:pre-wrap;font-family:inherit;font-size:13px;line-height:1.6;margin:0;">${html+'\n'+textContent}</pre></div>`;
}

// ========== 辅助工具页面（已修改：删除赔率计算器，三列两行六个框） ==========
function renderTools() {
    setTopBar('');
    
    const toolsHTML = `
    <div class="grid grid-cols-3 gap-4 flex-1">
        <div class="col-span-2 bg-white border border-gray-300 rounded shadow-sm p-4">
            <div class="font-medium text-sm mb-3">盈亏分析</div>
            <div class="grid grid-cols-3 gap-3 text-xs">
                <div class="bg-gray-50 border border-gray-200 rounded p-3" id="toolsBox1">${generateShangxiaSummary('澳门上家')}</div>
                <div class="bg-gray-50 border border-gray-200 rounded p-3" id="toolsBox2">${generateShangxiaSummary('澳门下家')}</div>
                <div class="bg-gray-50 border border-gray-200 rounded p-3" id="toolsBox3">${generateMyShangxiaSummary('澳门上家', '澳门下家', '我的澳门')}</div>
                <div class="bg-gray-50 border border-gray-200 rounded p-3" id="toolsBox4">${generateShangxiaSummary('粤港上家')}</div>
                <div class="bg-gray-50 border border-gray-200 rounded p-3" id="toolsBox5">${generateShangxiaSummary('粤港下家')}</div>
                <div class="bg-gray-50 border border-gray-200 rounded p-3" id="toolsBox6">${generateMyShangxiaSummary('粤港上家', '粤港下家', '我的粤港')}</div>
            </div>
        </div>
        <div class="bg-white border border-gray-300 rounded shadow-sm p-4">
            <div class="font-medium text-sm mb-3">更多工具</div>
            <div class="text-xs text-gray-600">开发中...</div>
        </div>
    </div>`;
    
    return toolsHTML;
}

// 页面渲染映射表
const pageRenderers = {
    overview: renderOverview,
    orderAnalysis: renderOrderAnalysis,
    specialCode: renderSpecialCode,
    lianXiao: renderLianXiao,
    lianMa: renderLianMa,
    orderDetail: renderOrderDetail,
    todayDraw: renderTodayDraw,
    drawHistory: renderDrawHistory,
    tools: renderTools,
    operationLog: renderOperationLog,
    numberList: renderNumberList
};