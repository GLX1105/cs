// ===== events.js - 全局事件绑定、页面路由与刷新控制 =====

let currentPage = null;

// ========== 订单详情过滤函数 ==========
function getFilteredOrdersForDetail() {
    const today = State.currentFilterDate;
    const filterRegion = State.orderDetailFilters.region;
    const filterBetType = State.orderDetailFilters.betType;
    const filterWinStatus = State.orderDetailFilters.winStatus;
    const filterRep = State.orderDetailFilters.reporter;
    return State.orderList.filter(o => {
        if (o.date !== today) return false;
        if (filterRegion !== '不限' && o.region !== filterRegion) return false;
        if (filterBetType !== '不限' && o.betType !== filterBetType) return false;
        if (filterWinStatus !== '不限' && o.winStatus !== filterWinStatus) return false;
        if (filterRep !== '不限' && o.reporter !== filterRep) return false;
        return true;
    });
}

// ========== 页面路由与切换 ==========
function switchPage(pageName) {
    const oldPage = currentPage;
    currentPage = pageName;
    const main = document.getElementById('mainContent');

    // 同页刷新优化（订单分析和特码调单已移除，走完整渲染）
    if (oldPage === pageName && oldPage) {
        const refreshMap = {
            overview: refreshOverviewData,
            lianXiao: refreshLianXiaoData,
            lianMa: refreshLianMaData,
            orderDetail: refreshOrderDetailData,
            todayDraw: refreshTodayDrawData,
            drawHistory: refreshDrawHistoryData,
            operationLog: refreshOperationLogData
        };
        if (refreshMap[pageName]) {
            refreshMap[pageName]();
            document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
            document.querySelectorAll('.sub-menu-item').forEach(item => item.classList.remove('active'));
            const activeEl = document.querySelector(`[data-page="${pageName}"]`);
            if (activeEl && !activeEl.classList.contains('sub-menu-item')) activeEl.classList.add('active');
            if (['lianXiao', 'lianMa'].includes(pageName)) document.querySelector(`.sub-menu-item[data-page="${pageName}"]`)?.classList.add('active');
            if (pageName === 'specialCode') document.querySelector('[data-page="specialCode"]')?.classList.add('active');
            updateStoragePanel();
            return;
        }
    }

    const renderFn = pageRenderers[pageName];
    if (renderFn) {
        main.innerHTML = renderFn();
        main.classList.remove('fade-in');
        void main.offsetWidth;
        main.classList.add('fade-in');
    }
    document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
    document.querySelectorAll('.sub-menu-item').forEach(item => item.classList.remove('active'));
    const activeEl = document.querySelector(`[data-page="${pageName}"]`);
    if (activeEl && !activeEl.classList.contains('sub-menu-item')) activeEl.classList.add('active');
    if (['lianXiao', 'lianMa'].includes(pageName)) document.querySelector(`.sub-menu-item[data-page="${pageName}"]`)?.classList.add('active');
    if (pageName === 'specialCode') document.querySelector('[data-page="specialCode"]')?.classList.add('active');
    bindGlobalRegionEvents();
    updateStoragePanel();

    // 各页面后续初始化
    if (pageName === 'drawHistory') {
        setTimeout(() => {
            document.querySelectorAll('input[name="historyRegion"]').forEach(radio => {
                radio.addEventListener('change', function() {
                    if (this.checked) {
                        State.historyRegionFilter = this.value;
                        refreshDrawHistoryData();
                    }
                });
            });
            document.querySelectorAll('.delete-history-btn').forEach(btn => {
                btn.addEventListener('click', async function() {
                    const date = this.getAttribute('data-date');
                    const area = this.getAttribute('data-area');
                    const ok = await showConfirm('确定删除该条开奖记录吗？');
                    if (!ok) return;
                    State.historyRecords = State.historyRecords.filter(r => !(r.date === date && r.area === area));
                    addOperationLog('删除开奖', `删除了${area} ${date} 的开奖记录`);
                    persistAll();
                    refreshDrawHistoryData();
                });
            });
            const clearBtn = document.getElementById('clearAllHistoryBtn');
            if (clearBtn) {
                clearBtn.addEventListener('click', async function() {
                    const ok = await showConfirm('确定清空全部开奖历史吗？此操作不可恢复。');
                    if (!ok) return;
                    State.historyRecords = [];
                    addOperationLog('清空开奖', '清空了全部开奖历史');
                    persistAll();
                    refreshDrawHistoryData();
                });
            }
        }, 80);
    }

    setTimeout(() => {
        if (pageName === 'overview') {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    initOverviewCharts();
                });
            });
        }
        if (pageName === 'orderAnalysis') renderCharts();
        if (pageName === 'specialCode') {
            updateSpecialCodeStats();
            updateSpecialCodeLeftTable();
            bindSpecialDeleteBtns();
            bindSpecialCodeDragSelect();
            document.getElementById('btnCopyReport')?.addEventListener('click', handleCopyReport);
        }
        if (pageName === 'lianXiao') { bindLianXiaoDeleteBtns(); }
        if (pageName === 'lianMa') { bindLianMaDeleteBtns(); }
        if (pageName === 'todayDraw') { bindDrawInputs(); bindTodayDrawControls(); }
        if (pageName === 'tools') bindCalcButton();
        if (pageName === 'orderDetail') {
            // 直接使用 renderOrderDetail 返回的完整表格，不需要虚拟滚动初始化
            const filterRegionOpts = ['不限', '澳门', '香港', '粤港'];
            const filterBetTypeOpts = ['不限', ...new Set(State.orderList.filter(o => o.date === State.currentFilterDate).map(o => o.betType))].filter(Boolean);
            const filterWinStatusOpts = ['不限', '中奖', '未中奖', '未知'];
            const filterReporterOpts = ['不限', ...new Set(State.orderList.filter(o => o.date === State.currentFilterDate).map(o => o.reporter))].filter(Boolean);
            const schemeNames = window.schemes.map((s, i) => s.name);
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
            createCustomSelect(document.getElementById('orderDetailSchemeSelectWrapper'), schemeNames, window.schemes[State.selectedSchemeIdx].name, (val) => {
                State.selectedSchemeIdx = window.schemes.findIndex(s => s.name === val);
                persistAll();
                switchPage('orderDetail');
            });

            bindOrderDetailEvents();
            // 不再调用 initOrderDetailVirtualScroll，表格已包含所有行
            document.getElementById('btnFilterDuijiang')?.addEventListener('click', performFilterDuijiang);
            document.getElementById('btnComprehensiveDuijiang')?.addEventListener('click', performComprehensiveDuijiang);
            document.getElementById('btnResetDraw')?.addEventListener('click', () => {
                showConfirm('确定重置所有兑奖结果吗？').then(ok => { if (ok) resetDrawData(); });
            });
            document.getElementById('orderSearchBtn')?.addEventListener('click', performOrderSearch);
            document.getElementById('orderSearchInput')?.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') performOrderSearch();
            });
            updateOrderGroupCount();
        }
        if (pageName === 'addOrder') {
            document.getElementById('orderEntryModal').style.display = 'block';
            State.entryOrders = [];
            State.entrySelectedIndices.clear();
            renderEntryTable();
            initEntryContextMenu();
            bindEntryTableDblClick();
            updateEntryReporterSelect();
        }
        if (pageName === 'numberList') {
            const yearZodiacSelect = document.getElementById('yearZodiacSelect');
            if (yearZodiacSelect) {
                yearZodiacSelect.addEventListener('change', async function() {
                    const newValue = this.value;
                    const pwd = await showPrompt('请输入密码以修改本年肖：');
                    if (pwd === null) {
                        this.value = window.yearZodiac;
                        return;
                    }
                    if (pwd === '891185') {
                        window.yearZodiac = newValue;
                        addOperationLog('修改本年肖', `本年肖变更为：${newValue}`);
                        persistAll();
                        showToast('本年肖已更新为：' + newValue);
                    } else {
                        this.value = window.yearZodiac;
                        showAlert('密码错误，本年肖未修改');
                    }
                });
            }
        }
    }, 60);
}

// ========== 无闪烁局部刷新函数 ==========
function refreshOverviewData() {
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            initOverviewCharts();
        });
    });
}
function refreshOrderAnalysisData() { renderCharts(); }
function refreshSpecialCodeData() { updateSpecialCodeStats(); updateSpecialCodeLeftTable(); }

function refreshLianXiaoData() {
    const main = document.getElementById('mainContent');
    if (!main) return;
    main.innerHTML = renderLianXiao();
    bindLianXiaoDeleteBtns();
    bindGlobalRegionEvents();
}

function refreshLianMaData() {
    const main = document.getElementById('mainContent');
    if (!main) return;
    main.innerHTML = renderLianMa();
    bindLianMaDeleteBtns();
    bindGlobalRegionEvents();
}

function refreshTodayDrawData() {
    const main = document.getElementById('mainContent');
    if (!main) return;
    main.innerHTML = renderTodayDraw();
    bindDrawInputs();
    bindTodayDrawControls();
    bindGlobalRegionEvents();
}

function refreshDrawHistoryData() {
    const main = document.getElementById('mainContent');
    if (!main) return;
    main.innerHTML = renderDrawHistory();
    document.querySelectorAll('input[name="historyRegion"]').forEach(radio => {
        radio.addEventListener('change', function() {
            if (this.checked) {
                State.historyRegionFilter = this.value;
                refreshDrawHistoryData();
            }
        });
    });
    document.querySelectorAll('.delete-history-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const date = this.getAttribute('data-date');
            const area = this.getAttribute('data-area');
            const ok = await showConfirm('确定删除该条开奖记录吗？');
            if (!ok) return;
            State.historyRecords = State.historyRecords.filter(r => !(r.date === date && r.area === area));
            addOperationLog('删除开奖', `删除了${area} ${date} 的开奖记录`);
            await persistAll();
            refreshDrawHistoryData();
        });
    });
    const clearBtn = document.getElementById('clearAllHistoryBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', async function() {
            const ok = await showConfirm('确定清空全部开奖历史吗？此操作不可恢复。');
            if (!ok) return;
            State.historyRecords = [];
            addOperationLog('清空开奖', '清空了全部开奖历史');
            await persistAll();
            refreshDrawHistoryData();
        });
    }
}

function refreshOperationLogData() {
    const main = document.getElementById('mainContent');
    if (!main) return;
    main.innerHTML = renderOperationLog();
    bindGlobalRegionEvents();
}

function refreshOrderDetailData() {
    // 直接更新表格数据，不再使用虚拟滚动
    const wrapper = document.getElementById('orderDetailTableWrapper');
    const tbody = document.getElementById('orderDetailTbody');
    if (!tbody) return;

    const today = State.currentFilterDate;
    const filterRegion = State.orderDetailFilters.region;
    const filterBetType = State.orderDetailFilters.betType;
    const filterWinStatus = State.orderDetailFilters.winStatus;
    const filterRep = State.orderDetailFilters.reporter;

    let filteredOrders = [];
    for (let i = 0; i < State.orderList.length; i++) {
        const o = State.orderList[i];
        if (o.date !== today) continue;
        if (filterRegion !== '不限' && o.region !== filterRegion) continue;
        if (filterBetType !== '不限' && o.betType !== filterBetType) continue;
        if (filterWinStatus !== '不限' && o.winStatus !== filterWinStatus) continue;
        if (filterRep !== '不限' && o.reporter !== filterRep) continue;
        filteredOrders.push({ ...o, _realIdx: i });
    }

    const areas = ['macau','hongkong','yuegang'];
    const todayDraw = getCurrentDrawData();
    const drawDataForHL = {};
    areas.forEach(area => {
        const data = todayDraw[area];
        drawDataForHL[area] = data && data.nums && data.nums.length >= 7 ? data.nums : null;
    });

    let rowsHTML = '';
    filteredOrders.forEach((o, idx) => {
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

        rowsHTML += `<tr data-index="${idx}" data-real-index="${o._realIdx}" class="order-row ${rowClass}">
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
    });

    tbody.innerHTML = rowsHTML;

    updateOrderGroupCount();
    const totalEl = document.querySelector('#orderDetailTableWrapper + div span b');
    if (totalEl) {
        const total = filteredOrders.reduce((s, o) => s + (parseFloat(o.totalAmount) || 0), 0);
        totalEl.textContent = formatMoney(total);
    }

    // --- 更新开奖区域（通过 id 定位） ---
    const drawContainer = document.getElementById('drawAreaContainer');
    if (drawContainer) {
        const innerDiv = drawContainer.querySelector('div');
        if (innerDiv) {
            const areas = ['macau','hongkong','yuegang'];
            const areaLabels = {macau:'澳门',hongkong:'香港',yuegang:'粤港'};
            const todayDraw = getCurrentDrawData();
            let drawHTML = '';
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
                    <div class="flex justify-center gap-1 flex-wrap items-end">${cellsHTML}</div>
                </div>`;
                if (idx < areas.length - 1) drawHTML += `<div class="border-l border-gray-300"></div>`;
            });
            innerDiv.innerHTML = drawHTML;
        }
    }

    // --- 更新兑奖结果框（若已兑奖） ---
    if (State.filterDuijiangDone) {
        const macauDiv = document.getElementById('duijiangMacauContent');
        const hkDiv = document.getElementById('duijiangHongkongContent');
        const ygDiv = document.getElementById('duijiangYuegangContent');
        const allDiv = document.getElementById('duijiangAllContent');
        if (macauDiv) macauDiv.innerHTML = generateRegionProfitSummary('澳门', State.orderList);
        if (hkDiv) hkDiv.innerHTML = generateRegionProfitSummary('香港', State.orderList);
        if (ygDiv) ygDiv.innerHTML = generateRegionProfitSummary('粤港', State.orderList);
        if (allDiv) allDiv.innerHTML = generateRegionProfitSummary('all', State.orderList);
    }

    // --- 重新创建筛选下拉框（确保选项列表为最新） ---
    const filterRegionOpts = ['不限', '澳门', '香港', '粤港'];
    const filterBetTypeOpts = ['不限', ...new Set(State.orderList.filter(o => o.date === State.currentFilterDate).map(o => o.betType))].filter(Boolean);
    const filterWinStatusOpts = ['不限', '中奖', '未中奖', '未知'];
    const filterReporterOpts = ['不限', ...new Set(State.orderList.filter(o => o.date === State.currentFilterDate).map(o => o.reporter))].filter(Boolean);
    const schemeNames = window.schemes.map((s, i) => s.name);

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
    createCustomSelect(document.getElementById('orderDetailSchemeSelectWrapper'), schemeNames, window.schemes[State.selectedSchemeIdx].name, (val) => {
        State.selectedSchemeIdx = window.schemes.findIndex(s => s.name === val);
        persistAll();
        switchPage('orderDetail');
    });
}

// ========== 全局地区筛选事件 ==========
function bindGlobalRegionEvents() {
    document.querySelectorAll('input[name="globalRegion"]').forEach(radio => {
        radio.addEventListener('change', function() {
            if (this.checked) {
                State.currentFilterRegion = this.value;
                State.selectedOrderIndices.clear();
                switchPage(currentPage);
            }
        });
    });
}

// ========== 日期选择器 ==========
function initDatePicker() {
    const picker = document.getElementById('globalDatePicker');
    if (picker) {
        const now = new Date();
        const beijingTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
        picker.value = `${beijingTime.getFullYear()}-${String(beijingTime.getMonth() + 1).padStart(2, '0')}-${String(beijingTime.getDate()).padStart(2, '0')}`;
        State.currentFilterDate = picker.value;
        picker.addEventListener('change', () => {
            State.currentFilterDate = picker.value;
            State.selectedOrderIndices.clear();
            if (currentPage && currentPage !== 'addOrder' && currentPage !== 'numberList') {
                switchPage(currentPage);
            } else {
                switchPage(currentPage);
            }
            updateStoragePanel();
        });
    }
}

// ========== 删除上报订单事件绑定 ==========
function bindSpecialDeleteBtns() {
    document.querySelectorAll('.delete-reported-btn').forEach(btn => {
        btn.removeEventListener('click', handleSpecialDelete);
        btn.addEventListener('click', handleSpecialDelete);
    });
}
async function handleSpecialDelete(e) {
    const type = e.target.dataset.type;
    const index = parseInt(e.target.dataset.index);
    if (isNaN(index)) return;
    const ok = await showConfirm('确定删除该条上报订单吗？');
    if (!ok) return;
    let order;
    if (type === 'special') {
        order = State.reportedOrdersSpecial[index];
        if (order) {
            const nums = order.orderInfo.split('-').map(t => t.trim());
            const unitAmount = parseFloat(order.amount) || 0;
            nums.forEach(token => {
                const ns = keyToAllNums(token);
                ns.forEach(num => { State.adjustValues[num] = Math.max(0, (State.adjustValues[num] || 0) - unitAmount); });
            });
            const logDetail = `${order.region||''} ${(order.betType||'').trim()} ${order.orderInfo||''} 各${formatMoney(order.amount)} 总额${formatMoney(order.totalAmount)}`;
            addOperationLog('删除上报订单', logDetail);
            State.reportedOrdersSpecial.splice(index, 1);
        }
    }
    persistAll();
    refreshSpecialCodeData();
}

function bindLianXiaoDeleteBtns() {
    document.querySelectorAll('.delete-reported-btn').forEach(btn => {
        btn.removeEventListener('click', handleLianXiaoDelete);
        btn.addEventListener('click', handleLianXiaoDelete);
    });
}
async function handleLianXiaoDelete(e) {
    const index = parseInt(e.target.dataset.index);
    if (isNaN(index)) return;
    const ok = await showConfirm('确定删除该条上报订单吗？');
    if (!ok) return;
    const order = State.reportedOrdersLianXiao[index];
    if (order) {
        const logDetail = `${order.region||''} ${(order.betType||'').trim()} ${order.orderInfo||''} 各${formatMoney(order.amount)} 总额${formatMoney(order.totalAmount)}`;
        addOperationLog('删除上报订单', logDetail);
    }
    State.reportedOrdersLianXiao.splice(index, 1);
    persistAll();
    refreshLianXiaoData();
}

function bindLianMaDeleteBtns() {
    document.querySelectorAll('.delete-reported-btn').forEach(btn => {
        btn.removeEventListener('click', handleLianMaDelete);
        btn.addEventListener('click', handleLianMaDelete);
    });
}
async function handleLianMaDelete(e) {
    const index = parseInt(e.target.dataset.index);
    if (isNaN(index)) return;
    const ok = await showConfirm('确定删除该条上报订单吗？');
    if (!ok) return;
    const order = State.reportedOrdersLianMa[index];
    if (order) {
        const logDetail = `${order.region||''} ${(order.betType||'').trim()} ${order.orderInfo||''} 各${formatMoney(order.amount)} 总额${formatMoney(order.totalAmount)}`;
        addOperationLog('删除上报订单', logDetail);
    }
    State.reportedOrdersLianMa.splice(index, 1);
    persistAll();
    refreshLianMaData();
}

// ========== 应用初始化 ==========
async function initApp() {
    await restoreAll();
    initDatePicker();
    initModalDraggableResizable('configModal');
    initModalDraggableResizable('orderEntryModal');
    initModalDraggableResizable('replacePresetModal');
    initSidebarToggle();
    updateEntryReporterSelect();
    buildQuickTags();

    updateStoragePanel();
    const storageToggle = document.getElementById('storageToggle');
    const storagePanel = document.getElementById('storagePanel');
    if (storageToggle && storagePanel) {
        storageToggle.addEventListener('click', () => {
            const isOpen = storagePanel.classList.toggle('open');
            storageToggle.style.color = isOpen ? '#333' : '#888';
            updateStoragePanel();
        });
    }

    const originalPersistAll = persistAll;
    persistAll = async function(...args) {
        await originalPersistAll.apply(this, args);
        updateStoragePanel();
    };

    document.querySelector('#replacePresetModal .close-btn')?.addEventListener('click', () => {
        document.getElementById('replacePresetModal').style.display = 'none';
    });
    document.querySelector('#orderEntryModal .close-btn').addEventListener('click', async () => {
        saveOrderDraft();
        if (State.entryOrders.length > 0) {
            const ok = await showConfirm('录单窗口还有未发送的订单，是否发送到总表？');
            if (ok) { await sendToMain(); } else { return; }
        }
        document.getElementById('orderEntryModal').style.display = 'none';
    });

    const draftTextarea = document.getElementById('sourceOrderInput');
    if (draftTextarea) {
        draftTextarea.addEventListener('input', function() {
            localStorage.setItem('orderEntryDraft', this.value);
        });
    }

    if (State.orderList.length && !State.orderList[0].date) {
        const today = document.getElementById('globalDatePicker').value;
        State.orderList.forEach(o => o.date = today);
    }

    document.getElementById('configModal').addEventListener('click', function(e) {
        if (e.target === this) { this.style.display = 'none'; }
    });
    document.getElementById('confirmModal').addEventListener('click', function(e) {
        if (e.target === this) { this.style.display = 'none'; }
    });

    document.getElementById('replacePresetModal')?.addEventListener('click', function(e) {
        if (e.target === this) { this.style.display = 'none'; }
    });
    document.getElementById('addPresetBtn')?.addEventListener('click', addReplacePreset);
    document.getElementById('closePresetBtn')?.addEventListener('click', () => {
        document.getElementById('replacePresetModal').style.display = 'none';
    });
    document.getElementById('presetOld')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') { document.getElementById('presetNew').focus(); }
    });
    document.getElementById('presetNew')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') { addReplacePreset(); }
    });

    switchPage('overview');
    document.querySelectorAll('.menu-item, .sub-menu-item').forEach(item => {
        item.addEventListener('click', function() {
            if (this.getAttribute('data-page') === 'addOrder') {
                document.getElementById('orderEntryModal').style.display = 'block';
                State.entryOrders = [];
                State.entrySelectedIndices.clear();
                renderEntryTable();
                initEntryContextMenu();
                loadOrderDraft();
                updateEntryReporterSelect();
                return;
            }
            if (this.getAttribute('data-page') === 'specialCode' && this.classList.contains('menu-item')) {
                const sub = document.getElementById('specialCodeSubmenu');
                sub.style.display = sub.style.display === 'none' ? 'block' : 'none';
                switchPage('specialCode');
                return;
            }
            const page = this.getAttribute('data-page');
            if (page) switchPage(page);
        });
    });
    document.getElementById('specialCodeSubmenu').style.display = 'block';

    document.addEventListener('keydown', function(e) {
        if (e.altKey && e.key === '1') {
            e.preventDefault();
            const modal = document.getElementById('orderEntryModal');
            if (modal.style.display === 'block') {
                document.querySelector('#orderEntryModal .close-btn').click();
            } else {
                modal.style.display = 'block';
                const ta = document.getElementById('sourceOrderInput');
                if (ta) ta.focus();
            }
        }
        if (e.altKey && e.key === '3') {
            e.preventDefault();
            const modal = document.getElementById('orderEntryModal');
            if (modal.style.display === 'block') {
                saveOrder();
            }
        }
    });
}

// ========== 启动应用 ==========
window.addEventListener('DOMContentLoaded', function() {
    initApp();
    bindOrderEntryRecognition();
    bindEntryButtons();
    initQuickTagsClick();
});