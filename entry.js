// ===== entry.js - 录单窗口逻辑 =====

function bindEntryButtons() {
    document.getElementById('btnRemoveSep')?.addEventListener('click', removeSep);
    document.getElementById('btnMark')?.addEventListener('click', markText);
    document.getElementById('btnChangeSep')?.addEventListener('click', changeSep);
    document.getElementById('btnSemantic')?.addEventListener('click', semanticReplace);
    document.getElementById('btnReplace')?.addEventListener('click', () => handleTool('指定替换'));
    document.getElementById('btnReplacePreset')?.addEventListener('click', showReplacePresetModal);
    document.getElementById('btnPaste')?.addEventListener('click', pasteFromClipboard);
    document.getElementById('btnSaveOrder')?.addEventListener('click', saveOrder);
    document.getElementById('btnClear')?.addEventListener('click', clearInput);
    document.getElementById('btnSendToMain')?.addEventListener('click', sendToMain);
    document.getElementById('btnReport')?.addEventListener('click', reportOrders);
}

function removeSep() {
    const ta = getInputArea();
    if (!ta || !ta.value) { showAlert('输入框无内容'); return; }
    const start = ta.selectionStart, end = ta.selectionEnd;
    if (start !== end) {
        const selected = ta.value.substring(start, end);
        const result = selected.replace(/[^\dA-Za-z\u4e00-\u9fa5\s]/g, '');
        ta.value = ta.value.substring(0, start) + result + ta.value.substring(end);
        performRecognition(ta.value);
    } else { showAlert('请先选择内容'); }
}

function markText() {
    const ta = getInputArea();
    if (!ta || !ta.value) { showAlert('输入框无内容'); return; }
    const start = ta.selectionStart, end = ta.selectionEnd;
    if (start !== end) {
        const selected = ta.value.substring(start, end);
        const result = selected.replace(/[\r\n]+/g, ' ').replace(/[\s]{2,}/g, ' ').trim();
        ta.value = ta.value.substring(0, start) + result + ta.value.substring(end);
        performRecognition(ta.value);
    } else { showAlert('请先选择内容'); }
}

function changeSep() {
    const ta = getInputArea();
    if (!ta || !ta.value) { showAlert('输入框无内容'); return; }
    const start = ta.selectionStart, end = ta.selectionEnd;
    if (start !== end) {
        const selected = ta.value.substring(start, end);
        const result = selected.replace(/[^\dA-Za-z\u4e00-\u9fa5\s]/g, '-');
        ta.value = ta.value.substring(0, start) + result + ta.value.substring(end);
        performRecognition(ta.value);
    } else { showAlert('请先选择内容'); }
}

function handleTool(name) { showAlert(`已执行：${name}`); }

async function pasteFromClipboard() {
    try {
        const t = await navigator.clipboard.readText();
        const ta = getInputArea();
        if (t && ta) { ta.value = t; performRecognition(t); showToast('已粘贴'); }
    } catch (e) { showAlert('无法访问剪切板'); }
}

async function semanticReplace() {
    const ta = getInputArea();
    if (!ta) { showToast('未找到输入框'); return; }
    const start = ta.selectionStart, end = ta.selectionEnd;
    if (start === end) { showToast('请先选择文本'); return; }
    const selected = ta.value.substring(start, end);
    const tokens = selected.split(/[\s,，.。、+\-*＊\/\\|]+/).filter(t => t.trim());
    if (!tokens.length) { showToast('未识别有效分类'); return; }
    if (typeof D === 'undefined') { showToast('字典未加载，请稍后重试'); return; }
    const matched = tokens.filter(t => D[t]);
    if (!matched.length) { showToast('未识别有效分类'); return; }
    let sets = matched.map(cat => {
        const nums = keyToAllNums(cat);
        return new Set(nums);
    });
    let intersection = sets[0];
    for (let i = 1; i < sets.length; i++) intersection = new Set([...intersection].filter(x => sets[i].has(x)));
    const result = [...intersection].sort((a, b) => parseInt(a) - parseInt(b));
    if (!result.length) { showToast('无共同号码'); return; }
    const str = result.join('-');
    const confirmed = await showConfirm(`转换结果：${str}\n是否替换选中文本？`);
    if (confirmed) {
        ta.value = ta.value.substring(0, start) + str + ta.value.substring(end);
        performRecognition(ta.value);
    }
}

function initQuickTagsClick() {
    const container = document.getElementById('quickTagsContainer');
    if (!container) return;
    container.addEventListener('click', (e) => {
        const tag = e.target.closest('.quick-tag');
        if (!tag) return;
        const text = tag.textContent;
        const ta = getInputArea();
        if (!ta) return;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        ta.value = ta.value.substring(0, start) + text + ta.value.substring(end);
        ta.focus();
        ta.setSelectionRange(start + text.length, start + text.length);
        performRecognition(ta.value);
    });
}

let lastSavedPureLines = null;

function saveOrder() {
    const reporterName = getEntryReporterSelectValue();
    if (!reporterName) { showAlert('请选择申报人'); return; }
    const pureLines = State.pureOrderLines || [];
    const pureRegions = State.pureOrderRegions || [];
    if (!pureLines.length) { showAlert('无订单'); return; }

    if (lastSavedPureLines && lastSavedPureLines.length === pureLines.length) {
        let same = true;
        for (let i = 0; i < pureLines.length; i++) {
            if (pureLines[i] !== lastSavedPureLines[i]) { same = false; break; }
        }
        if (same) {
            showConfirm('检测到与上一批完全相同的订单，可能重复录入，是否继续保存？').then(ok => {
                if (!ok) return;
                proceedSave();
            });
            return;
        }
    }
    proceedSave();

    function proceedSave() {
        const currentBatch = ++State.entryBatchSeq;
        for (let i = 0; i < pureLines.length; i++) {
            const line = pureLines[i];
            const regionKey = pureRegions[i] || (State.dotRegion === 'auto' ? 'macau' : State.dotRegion);
            const regionName = REGION_LABELS[regionKey] || '澳门';
            let category = '', numbers = '', kw = '', unitAmount = 0, totalCount = 1;
            // 尝试标准格式匹配：玩法:内容 各/各组/各数/各号 金额
            const match = line.match(/^(.+?):\s*(.+?)\s+(各|各组|各数|各号)\s*(\d+)$/);
            if (match) {
                category = match[1];
                numbers = match[2];
                kw = match[3];
                unitAmount = parseFloat(match[4]) || 0;
                // 根据玩法类型计算注数，与 updateOrderTotalDisplay 保持一致
                if (category.startsWith('包')) {
                    totalCount = 1;
                } else if (category === '特码') {
                    const tokens = numbers.split('-').map(t => t.trim()).filter(t => t);
                    let sum = 0;
                    tokens.forEach(token => {
                        if (/^\d{1,2}$/.test(token)) { sum += 1; }
                        else { const nums = keyToAllNums(token); sum += nums.length || 1; }
                    });
                    totalCount = sum || 1;
                } else if (category === '平特肖' || category === '特肖' || category === '平特尾' || category === '平码') {
                    // 多注玩法：按连字符拆分的项目数
                    const items = numbers.split('-').filter(s => s.trim());
                    totalCount = items.length || 1;
                } else if (category.includes('连肖') || category.includes('连尾') || category === '二中二' || category === '三中三' || category === '特碰' || category.includes('不中')) {
                    // 组合玩法：统计括号组数，若无括号则按连字符组数
                    const cleaned = numbers.replace(/[()]/g, '');
                    const groups = cleaned.split(/\s+/).filter(c => c.trim());
                    totalCount = groups.length || 1;
                } else {
                    totalCount = 1;
                }
            } else {
                // 兼容旧格式或简单格式
                const parts = line.split(' ');
                if (parts.length >= 2) {
                    const catNum = parts[0].split(':');
                    if (catNum.length === 2) { category = catNum[0]; numbers = catNum[1]; }
                    kw = '各'; unitAmount = parseFloat(parts[parts.length - 1]) || 0;
                    if (category === '特码') {
                        const tokens = numbers.split('-').map(t => t.trim()).filter(t => t);
                        let sum = 0;
                        tokens.forEach(token => {
                            if (/^\d{1,2}$/.test(token)) { sum += 1; }
                            else { const nums = keyToAllNums(token); sum += nums.length || 1; }
                        });
                        totalCount = sum || 1;
                    } else if (category === '平特肖' || category === '特肖' || category === '平特尾' || category === '平码') {
                        totalCount = numbers ? numbers.split('-').length : 1;
                    } else if (numbers) {
                        const cleaned = numbers.replace(/[()]/g, '');
                        const groups = cleaned.split(/\s+/).filter(c => c.trim());
                        totalCount = groups.length || 1;
                    }
                }
            }
            const totalAmount = unitAmount * totalCount;
            State.entryOrders.push({
                region: regionName,
                betType: category || '',
                orderInfo: numbers || '',
                complexType: '',
                calcMethod: kw || '各',
                amount: unitAmount,
                totalAmount: totalAmount,
                reporter: reporterName,
                remark: '',
                batchSeq: currentBatch
            });
        }
        lastSavedPureLines = [...pureLines];
        renderEntryTable();
        clearInput();
        setTimeout(() => {
            const wrapper = document.getElementById('entryTableWrapper');
            if (wrapper) {
                wrapper.scrollTop = wrapper.scrollHeight;
            }
        }, 100);
    }
}

async function sendToMain() {
    if (!State.entryOrders.length) { showAlert('无订单可发送'); return; }
    const ok = await showConfirm('确定发送到总表吗？');
    if (!ok) return;
    let maxId = State.orderList.reduce((m, o) => Math.max(m, o.id || 0), 0);
    const seqMap = {};

    const batchGroups = {};
    State.entryOrders.forEach(item => {
        const batch = item.batchSeq || 1;
        if (!batchGroups[batch]) batchGroups[batch] = [];
        batchGroups[batch].push(item);
    });

    const logLines = [];
    const batches = Object.keys(batchGroups).sort((a, b) => parseInt(a) - parseInt(b));
    for (const batch of batches) {
        const items = batchGroups[batch];
        const firstItem = items[0];
        const reporter = firstItem.reporter || '未知';
        const date = State.currentFilterDate;
        const key = date + '|||' + reporter;
        if (!seqMap[key]) {
            const same = State.orderList.filter(o => o.date === date && o.reporter === reporter);
            seqMap[key] = same.reduce((m, o) => Math.max(m, o.orderSeq || 0), 0) + 1;
        }
        const groupSeq = seqMap[key]++;
        for (const item of items) {
            State.orderList.push({
                ...item,
                id: ++maxId,
                date: State.currentFilterDate,
                winStatus: '未知',
                winAmount: '',
                orderSeq: groupSeq,
                remark: item.remark || ''
            });
            logLines.push(`${item.region||''} ${(item.betType||'').trim()} ${item.orderInfo||''} 各${formatMoney(item.amount)} 总额${formatMoney(item.totalAmount)} 申报人:${item.reporter||''}`);
        }
    }

    if (logLines.length > 0) {
        addOperationLog('订单新增', logLines.join('\n') + '\n');
    }

    State.entryOrders = [];
    State.entrySelectedIndices.clear();
    renderEntryTable();
    persistAll();
    State.filterDuijiangDone = false;
    switchPage(currentPage);
    showToast('已发送到总表');
}

function clearInput() {
    const ta = getInputArea();
    if (ta) ta.value = '';
    const resultDiv = document.getElementById('orderResult');
    if (resultDiv) resultDiv.innerHTML = '';
    State.pureOrderLines = [];
    State.pureOrderRegions = [];
    State.cachedMaxLossData = [];
    updateOrderTotalDisplay();
    clearOrderDraft();
}

function reportOrders() {
    const pureLines = State.pureOrderLines || [];
    const pureRegions = State.pureOrderRegions || [];
    if (!pureLines.length) { showAlert('无识别结果'); return; }
    const regionMap = { 'auto': '澳门', 'macau': '澳门', 'hongkong': '香港', 'yuegang': '粤港' };
    const logLines = [];
    for (let i = 0; i < pureLines.length; i++) {
        const line = pureLines[i];
        const regionKey = pureRegions[i] || 'auto';
        const region = regionMap[regionKey] || '澳门';
        let category = '', numbers = '', kw = '', unitAmount = 0, totalCount = 1;
        const match = line.match(/^(.+?):\s*(.+?)\s+(各|各组|各数|各号)\s*(\d+)/);
        if (match) {
            category = match[1]; numbers = match[2]; kw = match[3]; unitAmount = parseFloat(match[4]) || 0;
        } else { continue; }
        const cnt = calcTotalByPlayType(category, numbers, unitAmount) / unitAmount;
        const total = unitAmount * cnt;
        const orderObj = { region, betType: category, orderInfo: numbers, amount: unitAmount, totalAmount: total, kw };
        if (category === '特码') {
            State.reportedOrdersSpecial.push(orderObj);
            const tokens = numbers.split('-').map(t => t.trim()).filter(t => t);
            tokens.forEach(token => {
                if (/^\d{1,2}$/.test(token)) {
                    const n = token.length === 1 ? '0' + token : token;
                    if (State.adjustValues[n] !== undefined) State.adjustValues[n] += unitAmount;
                } else {
                    const nums = keyToAllNums(token);
                    nums.forEach(num => {
                        if (State.adjustValues[num] !== undefined) State.adjustValues[num] += unitAmount;
                    });
                }
            });
        } else if (category.includes('连肖') || category === '特肖' || category.startsWith('包') || category === '平码' || category === '平特肖' || category === '平特尾') {
            State.reportedOrdersLianXiao.push(orderObj);
        } else if (category === '二中二' || category === '特碰' || category === '三中三' || (category && category.includes('不中')) || (category && category.includes('连尾'))) {
            State.reportedOrdersLianMa.push(orderObj);
        }
        logLines.push(`${region} ${category} ${numbers} 各${formatMoney(unitAmount)} 总额${formatMoney(total)} 申报人:${getEntryReporterSelectValue()}`);
    }
    if (logLines.length > 0) {
        addOperationLog('上报订单', logLines.join('\n') + '\n');
    }
    persistAll();
    clearInput();
    showToast('订单已上报');
}

// ========== 录单输入框行数限制与实时识别 ==========
function bindOrderEntryRecognition() {
    const textarea = document.getElementById('sourceOrderInput');
    if (!textarea) return;

    const MAX_LINES = 300;

    textarea.addEventListener('input', function() {
        const lines = this.value.split('\n');
        if (lines.length > MAX_LINES) {
            const truncated = lines.slice(0, MAX_LINES).join('\n');
            this.value = truncated;
            showToast(`文本过长（共${lines.length}行），已自动截断至前${MAX_LINES}行，超出部分已丢弃`);
            this.setSelectionRange(truncated.length, truncated.length);
        }
        performRecognition(this.value);
    });

    const regionRadios = document.querySelectorAll('#orderEntryModal input[name="regionMode"]');
    regionRadios.forEach((radio, index) => {
        radio.addEventListener('change', function() {
            if (this.checked) {
                const modes = ['auto', 'macau', 'hongkong', 'yuegang'];
                State.dotRegion = modes[index] || 'auto';
                const ta = getInputArea();
                if (ta) performRecognition(ta.value);
            }
        });
    });
}

// ========== 录单窗口输入内容缓存 ==========
function saveOrderDraft() {
    const ta = getInputArea();
    if (ta) {
        localStorage.setItem('orderEntryDraft', ta.value);
    }
}

function loadOrderDraft() {
    const ta = getInputArea();
    if (ta) {
        const draft = localStorage.getItem('orderEntryDraft') || '';
        ta.value = draft;
        if (draft) performRecognition(draft);
    }
}

function clearOrderDraft() {
    localStorage.removeItem('orderEntryDraft');
}

// ========== 导出/导入数据 ==========
function handleExportAllData() {
    const exportData = {
        orders: State.orderList,
        drawData: State.drawData,
        drawLocked: State.drawLocked,
        historyRecords: State.historyRecords,
        operationLogs: State.operationLogs,
        schemes: window.schemes,
        applicants: window.applicants,
        replacePresets: getReplacePresets(),
        reportedOrdersSpecial: State.reportedOrdersSpecial,
        reportedOrdersLianXiao: State.reportedOrdersLianXiao,
        reportedOrdersLianMa: State.reportedOrdersLianMa
    };
    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    a.download = `数据导出_${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addOperationLog('导出数据', '导出了全部数据');
    showToast('导出成功！');
}

async function handleImportAllData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const text = await file.text();
            const importData = JSON.parse(text);
            if (!importData.orders && !importData.drawData && !importData.schemes) {
                await showAlert('文件格式不正确，缺少关键数据。');
                return;
            }
            const ok = await showConfirm('导入将覆盖当前全部数据，确定继续吗？');
            if (!ok) return;

            if (importData.orders) {
                State.orderList = importData.orders;
                State.orderList.forEach(o => {
                    o.winStatus = '未知';
                    o.winAmount = '';
                    o.date = o.date || State.currentFilterDate;
                });
            }
            if (importData.drawData) State.drawData = importData.drawData;
            if (importData.drawLocked) State.drawLocked = importData.drawLocked;
            if (importData.historyRecords) State.historyRecords = importData.historyRecords;
            if (importData.operationLogs) State.operationLogs = importData.operationLogs;
            if (importData.schemes) window.schemes = importData.schemes;
            if (importData.applicants) window.applicants = importData.applicants;
            if (importData.replacePresets) saveReplacePresets(importData.replacePresets);
            if (importData.reportedOrdersSpecial) State.reportedOrdersSpecial = importData.reportedOrdersSpecial;
            if (importData.reportedOrdersLianXiao) State.reportedOrdersLianXiao = importData.reportedOrdersLianXiao;
            if (importData.reportedOrdersLianMa) State.reportedOrdersLianMa = importData.reportedOrdersLianMa;
            window.reportedOrdersSpecial = State.reportedOrdersSpecial;
            window.reportedOrdersLianXiao = State.reportedOrdersLianXiao;
            window.reportedOrdersLianMa = State.reportedOrdersLianMa;

            numberList.forEach(item => { State.adjustValues[item.num] = 0; });
            State.reportedOrdersSpecial.forEach(rp => {
                if (rp.orderInfo) {
                    const tokens = rp.orderInfo.split('-').map(t => t.trim()).filter(t => t);
                    const unitAmount = parseFloat(rp.amount) || 0;
                    tokens.forEach(token => {
                        const nums = keyToAllNums(token);
                        nums.forEach(num => {
                            if (State.adjustValues[num] !== undefined) {
                                State.adjustValues[num] += unitAmount;
                            }
                        });
                    });
                }
            });

            await persistAll();
            State.selectedOrderIndices.clear();
            addOperationLog('导入数据', '导入了全部数据');
            switchPage(currentPage);
            showToast('导入成功！');
        } catch (err) {
            console.error('导入失败:', err);
            showAlert('导入失败，请检查文件格式。');
        }
    };
    input.click();
}

function performOrderSearch() {
    const searchInput = document.getElementById('orderSearchInput');
    if (!searchInput) return;
    const keyword = searchInput.value.trim().toLowerCase();
    const tbody = document.getElementById('orderDetailTbody');
    if (!tbody) return;
    const rows = tbody.querySelectorAll('tr.order-row');
    rows.forEach(row => {
        if (!keyword) {
            row.style.display = '';
            return;
        }
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(keyword) ? '' : 'none';
    });
}

// ========== 清空订单 ==========
window.handleClearOrders = async function() {
    if (State.orderList.length === 0 && State.operationLogs.length === 0) { await showAlert('当前没有订单和日志可清空'); return; }
    const ok = await showConfirm('确定要清空所有订单和操作日志吗？此操作不可恢复。');
    if (ok) { State.orderList = []; State.operationLogs = []; persistAll(); switchPage(currentPage); }
};

// ========== 过滤兑奖 ==========
async function performFilterDuijiang() {
    try {
        if (!hasValidDrawData()) { await showAlert('请先在今日开奖中录入至少一个地区的开奖号码（7个）'); return; }
        const areasMap = { 'macau': '澳门', 'hongkong': '香港', 'yuegang': '粤港' };
        let updatedCount = 0;
        const todayDraw = getCurrentDrawData();
        let skippedAreas = new Set();
        const filterRegion = State.orderDetailFilters.region;
        const filterBetType = State.orderDetailFilters.betType;
        const filterWinStatus = State.orderDetailFilters.winStatus;
        const filterRep = State.orderDetailFilters.reporter;
        for (let i = 0; i < State.orderList.length; i++) {
            const order = State.orderList[i];
            if (order.date !== State.currentFilterDate) continue;
            if (filterRegion !== '不限' && order.region !== filterRegion) continue;
            if (filterBetType !== '不限' && order.betType !== filterBetType) continue;
            if (filterWinStatus !== '不限' && order.winStatus !== filterWinStatus) continue;
            if (filterRep !== '不限' && order.reporter !== filterRep) continue;
            const regionKey = Object.keys(areasMap).find(k => areasMap[k] === order.region);
            if (!regionKey) continue;
            const draw = todayDraw[regionKey];
            if (!draw || !draw.nums || draw.nums.length < 7) { skippedAreas.add(order.region); continue; }
            const won = checkWin(order.betType, order.orderInfo, draw.nums);
            order.winStatus = won ? '中奖' : '未中奖';
            if (won) { order.winAmount = calcWinPrincipal(order, draw.nums); } else { order.winAmount = ''; }
            updatedCount++;
        }
        await persistAll();
        State.filterDuijiangDone = true;
        addOperationLog('兑奖操作', '过滤兑奖完成，更新 ' + updatedCount + ' 条订单');

        // 强制刷新兑奖结果框
        const main = document.getElementById('mainContent');
        if (main && currentPage === 'orderDetail') {
            main.innerHTML = renderOrderDetail();
            bindOrderDetailEvents();
            initOrderDetailVirtualScroll();
            document.getElementById('btnFilterDuijiang')?.addEventListener('click', performFilterDuijiang);
            document.getElementById('btnComprehensiveDuijiang')?.addEventListener('click', performComprehensiveDuijiang);
            document.getElementById('btnResetDraw')?.addEventListener('click', () => {
                showConfirm('确定重置所有兑奖结果吗？').then(ok => { if (ok) resetDrawData(); });
            });
            document.getElementById('orderSearchBtn')?.addEventListener('click', performOrderSearch);
            document.getElementById('orderSearchInput')?.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') performOrderSearch();
            });
            const schemeNames = window.schemes.map((s,i)=> s.name);
            createCustomSelect(document.getElementById('orderDetailSchemeSelectWrapper'), schemeNames, window.schemes[State.selectedSchemeIdx].name, (val) => {
                State.selectedSchemeIdx = window.schemes.findIndex(s => s.name === val);
                persistAll();
                switchPage('orderDetail');
            });
            const filterRegionOpts = ['不限','澳门','香港','粤港'];
            const filterBetTypeOpts = ['不限', ...new Set(State.orderList.filter(o => o.date === State.currentFilterDate).map(o => o.betType))].filter(Boolean);
            const filterWinStatusOpts = ['不限','中奖','未中奖','未知'];
            const filterReporterOpts = ['不限', ...new Set(State.orderList.filter(o => o.date === State.currentFilterDate).map(o => o.reporter))].filter(Boolean);
            createCustomSelect(document.getElementById('filterRegionWrapper'), filterRegionOpts, State.orderDetailFilters.region, (val) => {
                State.orderDetailFilters.region = val; State.selectedOrderIndices.clear(); switchPage('orderDetail');
            });
            createCustomSelect(document.getElementById('filterBetTypeWrapper'), filterBetTypeOpts, State.orderDetailFilters.betType, (val) => {
                State.orderDetailFilters.betType = val; State.selectedOrderIndices.clear(); switchPage('orderDetail');
            });
            createCustomSelect(document.getElementById('filterWinStatusWrapper'), filterWinStatusOpts, State.orderDetailFilters.winStatus, (val) => {
                State.orderDetailFilters.winStatus = val; State.selectedOrderIndices.clear(); switchPage('orderDetail');
            });
            createCustomSelect(document.getElementById('filterReporterWrapper'), filterReporterOpts, State.orderDetailFilters.reporter, (val) => {
                State.orderDetailFilters.reporter = val; State.selectedOrderIndices.clear(); switchPage('orderDetail');
            });
            updateOrderGroupCount();
        }

        let extraMsg = skippedAreas.size > 0 ? `以下区域开奖数据不足7个，已跳过：${[...skippedAreas].join('、')}` : '';
        showAlert(`兑奖完成，共更新 ${updatedCount} 条订单。${extraMsg}`);
    } catch (err) { console.error(err); showAlert('兑奖过程中出现错误，请重试'); }
}

async function performComprehensiveDuijiang() {
    try {
        if (!hasValidDrawData()) { await showAlert('请先在今日开奖中录入至少一个地区的开奖号码（7个）'); return; }
        const areasMap = { 'macau': '澳门', 'hongkong': '香港', 'yuegang': '粤港' };
        let updatedCount = 0;
        const todayDraw = getCurrentDrawData();
        let skippedAreas = new Set();
        for (let i = 0; i < State.orderList.length; i++) {
            const order = State.orderList[i];
            if (order.date !== State.currentFilterDate) continue;
            const regionKey = Object.keys(areasMap).find(k => areasMap[k] === order.region);
            if (!regionKey) continue;
            const draw = todayDraw[regionKey];
            if (!draw || !draw.nums || draw.nums.length < 7) { skippedAreas.add(order.region); continue; }
            const won = checkWin(order.betType, order.orderInfo, draw.nums);
            order.winStatus = won ? '中奖' : '未中奖';
            if (won) { order.winAmount = calcWinPrincipal(order, draw.nums); } else { order.winAmount = ''; }
            updatedCount++;
        }
        await persistAll();
        addOperationLog('兑奖操作', '综合兑奖完成，更新 ' + updatedCount + ' 条订单');
        switchPage(currentPage);
        const reportHTML = generateDuijiangReport();
        showReportModal(reportHTML);
        if (skippedAreas.size > 0) { setTimeout(() => showAlert(`以下区域开奖数据不足7个，已跳过：${[...skippedAreas].join('、')}`), 500); }
    } catch (err) { console.error(err); showAlert('兑奖过程中出现错误，请重试'); }
}

function resetDrawData() {
    for (let i = 0; i < State.orderList.length; i++) { State.orderList[i].winStatus = '未知'; State.orderList[i].winAmount = ''; }
    addOperationLog('重置开奖', '重置了所有兑奖结果');
    persistAll();
    switchPage(currentPage);
}