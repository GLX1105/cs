// ===== ui.js - UI交互、窗口管理、拖拽、自定义下拉框 =====

// ========== 报告窗口拖拽与调整大小 ==========
function initReportModalDraggable(modalId) {
    const mask = document.getElementById(modalId);
    const box = mask?.querySelector('.report-box');
    if (!mask || !box) return;

    const resizers = ['n','s','e','w','ne','nw','se','sw'];
    resizers.forEach(dir => {
        const div = document.createElement('div');
        div.className = `report-resizer report-resizer-${dir}`;
        box.appendChild(div);
    });

    let originalRect = null, isMaximized = false;
    let startX, startY, startWidth, startHeight, startLeft, startTop;
    let currentResizeDir = null;
    let dragState = { isDragging: false, startMouseX: 0, startMouseY: 0, startLeft: 0, startTop: 0 };

    function getBoxRect() {
        const rect = box.getBoundingClientRect();
        return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    }
    function setBoxStyle(left, top, width, height) {
        box.style.left = left + 'px';
        box.style.top = top + 'px';
        box.style.width = width + 'px';
        box.style.height = height + 'px';
        box.style.position = 'absolute';
        box.style.margin = '0';
    }

    function toggleMaximize() {
        if (isMaximized) {
            box.style.position = '';
            box.style.left = '';
            box.style.top = '';
            box.style.width = '';
            box.style.height = '';
            isMaximized = false;
        } else {
            box.style.position = 'fixed';
            box.style.left = '0';
            box.style.top = '0';
            box.style.width = '100vw';
            box.style.height = '100vh';
            isMaximized = true;
        }
    }

    mask.addEventListener('mousedown', function(e) {
        if (e.target === mask) {
            State.globalModalZIndex++;
            mask.style.zIndex = State.globalModalZIndex;
            return;
        }
    });

    box.addEventListener('mousedown', function(e) {
        State.globalModalZIndex++;
        mask.style.zIndex = State.globalModalZIndex;
    });

    const header = box.querySelector('.report-header');
    const maximizeBtn = box.querySelector('.report-maximize-btn');
    const minimizeBtn = box.querySelector('.report-minimize-btn');
    const closeBtn = box.querySelector('.report-close-btn');

    maximizeBtn?.addEventListener('click', (e) => { e.stopPropagation(); toggleMaximize(); });
    minimizeBtn?.addEventListener('click', (e) => { e.stopPropagation(); mask.style.display = 'none'; });
    closeBtn?.addEventListener('click', (e) => { e.stopPropagation(); mask.style.display = 'none'; });

    header?.addEventListener('mousedown', (e) => {
        if (isMaximized) return;
        if (e.target.closest('button') || e.target.closest('select') || e.target.closest('input') || e.target.closest('.custom-select-wrapper')) return;
        dragState.isDragging = true;
        const rect = getBoxRect();
        dragState.startMouseX = e.clientX;
        dragState.startMouseY = e.clientY;
        dragState.startLeft = rect.left;
        dragState.startTop = rect.top;
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'move';
        e.stopPropagation();
    });

    box.addEventListener('mousedown', (e) => {
        if (isMaximized) return;
        const resizeDir = e.target.className.match(/report-resizer-(\w+)/)?.[1];
        if (!resizeDir) return;
        e.preventDefault();
        currentResizeDir = resizeDir;
        startX = e.clientX; startY = e.clientY;
        const rect = getBoxRect();
        startWidth = rect.width; startHeight = rect.height;
        startLeft = rect.left; startTop = rect.top;
        document.body.style.userSelect = 'none';
        document.body.style.cursor = e.target.style.cursor;
        e.stopPropagation();
    });

    document.addEventListener('mousemove', (e) => {
        if (dragState.isDragging) {
            const dx = e.clientX - dragState.startMouseX;
            const dy = e.clientY - dragState.startMouseY;
            setBoxStyle(dragState.startLeft + dx, dragState.startTop + dy, box.offsetWidth, box.offsetHeight);
        } else if (currentResizeDir) {
            const dx = e.clientX - startX, dy = e.clientY - startY;
            let newWidth = startWidth, newHeight = startHeight, newLeft = startLeft, newTop = startTop;
            if (currentResizeDir.includes('e')) newWidth = startWidth + dx;
            if (currentResizeDir.includes('w')) { newWidth = startWidth - dx; newLeft = startLeft + dx; }
            if (currentResizeDir.includes('s')) newHeight = startHeight + dy;
            if (currentResizeDir.includes('n')) { newHeight = startHeight - dy; newTop = startTop + dy; }
            if (newWidth < 300) newWidth = 300;
            if (newHeight < 200) newHeight = 200;
            setBoxStyle(newLeft, newTop, newWidth, newHeight);
        }
    });

    document.addEventListener('mouseup', () => {
        if (dragState.isDragging) {
            dragState.isDragging = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            constrainWindowPosition(box);
        }
        if (currentResizeDir) {
            currentResizeDir = null;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    });
}

// ========== 模态框拖拽与调整大小 ==========
function initModalDraggableResizable(modalId) {
    const mask = document.getElementById(modalId);
    const modal = mask?.querySelector('.modal') || (modalId === 'promptModal' ? mask?.querySelector('div[style]') : null) || mask?.querySelector('.confirm-box');
    if (!modal) return;
    const resizers = ['n','s','e','w','ne','nw','se','sw'];
    resizers.forEach(dir => {
        const div = document.createElement('div');
        div.className = `modal-resizer resizer-${dir}`;
        div.setAttribute('data-resize', dir);
        modal.appendChild(div);
    });
    let originalRect = null, isMaximized = false;
    let startX, startY, startWidth, startHeight, startLeft, startTop;
    let currentResizeDir = null;
    let dragState = { isDragging: false, startMouseX: 0, startMouseY: 0, startLeft: 0, startTop: 0 };
    function getModalRect() { const rect = modal.getBoundingClientRect(); return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }; }
    function setModalStyle(left, top, width, height) { modal.style.left = left + 'px'; modal.style.top = top + 'px'; modal.style.width = width + 'px'; modal.style.height = height + 'px'; modal.style.transform = 'none'; }
    function toggleMaximize() {
        if (isMaximized) { if (originalRect) setModalStyle(originalRect.left, originalRect.top, originalRect.width, originalRect.height); modal.classList.remove('maximized'); isMaximized = false; }
        else { const rect = getModalRect(); originalRect = rect; modal.classList.add('maximized'); isMaximized = true; }
    }
    function minimize() { mask.style.display = 'none'; let icon = document.querySelector(`.minimized-icon[data-modal="${modalId}"]`); if (!icon) { icon = document.createElement('div'); icon.className = 'minimized-icon'; icon.setAttribute('data-modal', modalId); icon.textContent = '□'; document.body.appendChild(icon); icon.addEventListener('click', () => { mask.style.display = 'block'; icon.remove(); }); } }
    const header = modal.querySelector('.modal-header');
    const maximizeBtn = header?.querySelector('.maximize-btn');
    const minimizeBtn = header?.querySelector('.minimize-btn');
    maximizeBtn?.addEventListener('click', (e) => { e.stopPropagation(); toggleMaximize(); });
    minimizeBtn?.addEventListener('click', (e) => { e.stopPropagation(); minimize(); });
    header?.addEventListener('mousedown', (e) => {
        if (isMaximized) return;
        if (e.target.tagName === 'BUTTON') return;
        if (e.target.closest('.custom-select-wrapper')) return;
        dragState.isDragging = true;
        const rect = getModalRect();
        dragState.startMouseX = e.clientX;
        dragState.startMouseY = e.clientY;
        dragState.startLeft = rect.left;
        dragState.startTop = rect.top;
        startWidth = null; startHeight = null;
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'move';
    });
    modal.addEventListener('mousedown', (e) => {
        if (isMaximized) return;
        const resizeDir = e.target.getAttribute('data-resize');
        if (!resizeDir) return;
        e.preventDefault();
        currentResizeDir = resizeDir;
        startX = e.clientX; startY = e.clientY;
        const rect = getModalRect();
        startWidth = rect.width; startHeight = rect.height; startLeft = rect.left; startTop = rect.top;
        document.body.style.userSelect = 'none';
        document.body.style.cursor = e.target.style.cursor;
    });
    document.addEventListener('mousemove', (e) => {
        if (dragState.isDragging) {
            const dx = e.clientX - dragState.startMouseX;
            const dy = e.clientY - dragState.startMouseY;
            const rect = getModalRect();
            setModalStyle(dragState.startLeft + dx, dragState.startTop + dy, rect.width, rect.height);
        } else if (currentResizeDir) {
            const dx = e.clientX - startX, dy = e.clientY - startY;
            let newWidth = startWidth, newHeight = startHeight, newLeft = startLeft, newTop = startTop;
            const dir = currentResizeDir;
            if (dir.includes('e')) newWidth = startWidth + dx;
            if (dir.includes('w')) { newWidth = startWidth - dx; newLeft = startLeft + dx; }
            if (dir.includes('s')) newHeight = startHeight + dy;
            if (dir.includes('n')) { newHeight = startHeight - dy; newTop = startTop + dy; }
            if (newWidth < 300) newWidth = 300; if (newHeight < 200) newHeight = 200;
            setModalStyle(newLeft, newTop, newWidth, newHeight);
        }
    });
    document.addEventListener('mouseup', () => {
        if (dragState.isDragging) {
            dragState.isDragging = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            constrainWindowPosition(modal);
        }
        if (currentResizeDir) {
            currentResizeDir = null;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    });
}

// ========== 窗口位置边界修正 ==========
function constrainWindowPosition(box) {
    if (!box) return;
    const rect = box.getBoundingClientRect();
    const titleBar = box.querySelector('.modal-header') || box.querySelector('.report-header');
    const headerHeight = titleBar ? titleBar.offsetHeight : 30;
    const minVisible = 20;
    let newLeft = rect.left, newTop = rect.top;
    const screenW = window.innerWidth, screenH = window.innerHeight;

    if (rect.left + headerHeight < minVisible) {
        newLeft = minVisible - headerHeight;
    } else if (rect.right - headerHeight > screenW - minVisible) {
        newLeft = screenW - minVisible - rect.width + headerHeight;
    }
    if (rect.top + headerHeight < minVisible) {
        newTop = minVisible - headerHeight;
    } else if (rect.bottom - headerHeight > screenH - minVisible) {
        newTop = screenH - minVisible - rect.height + headerHeight;
    }
    if (rect.top > screenH - minVisible) {
        newTop = screenH - minVisible;
    }
    if (rect.left > screenW - minVisible) {
        newLeft = screenW - minVisible;
    }

    if (newLeft !== rect.left || newTop !== rect.top) {
        box.style.left = newLeft + 'px';
        box.style.top = newTop + 'px';
        if (!box.style.position || box.style.position === 'static') {
            box.style.position = 'absolute';
        }
    }
}

// ========== 自定义下拉框组件 ==========
function createCustomSelect(container, options, selectedValue, onChange) {
    if (!container) return { getValue: () => '', setValue: () => {} };
    container.innerHTML = '';
    container.style.position = 'relative';

    const trigger = document.createElement('div');
    trigger.className = 'custom-select-trigger';
    trigger.textContent = selectedValue || (options.length > 0 ? options[0] : '');

    const dropdown = document.createElement('div');
    dropdown.className = 'custom-select-dropdown';

    let currentValue = selectedValue || (options.length > 0 ? options[0] : '');

    options.forEach(opt => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'custom-select-option';
        if (opt === currentValue) optionDiv.classList.add('selected');
        optionDiv.textContent = opt;
        optionDiv.addEventListener('click', (e) => {
            e.stopPropagation();
            currentValue = opt;
            trigger.textContent = opt;
            dropdown.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
            optionDiv.classList.add('selected');
            dropdown.classList.remove('show');
            if (onChange) onChange(opt);
        });
        dropdown.appendChild(optionDiv);
    });

    container.appendChild(trigger);
    container.appendChild(dropdown);

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.custom-select-dropdown.show').forEach(d => {
            if (d !== dropdown) d.classList.remove('show');
        });
        const isOpen = dropdown.classList.contains('show');
        if (isOpen) {
            dropdown.classList.remove('show');
        } else {
            dropdown.classList.add('show');
            const rect = trigger.getBoundingClientRect();
            const dropdownHeight = Math.min(options.length * 28, 12 * 16 + 8);
            const spaceBelow = window.innerHeight - rect.bottom;
            if (spaceBelow < dropdownHeight && rect.top > dropdownHeight) {
                dropdown.style.bottom = '100%';
                dropdown.style.top = 'auto';
            } else {
                dropdown.style.top = '100%';
                dropdown.style.bottom = 'auto';
            }
        }
    });

    document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) {
            dropdown.classList.remove('show');
        }
    }, true);

    return {
        getValue: () => currentValue,
        setValue: (val) => {
            currentValue = val;
            trigger.textContent = val;
            dropdown.querySelectorAll('.custom-select-option').forEach(o => {
                o.classList.toggle('selected', o.textContent === val);
            });
        }
    };
}

// ========== 通用右键菜单 ==========
function showGeneralContextMenu(menuId, x, y, dataArray, selectedIndicesSet, onDataChanged) {
    const originalPanel = document.querySelector(`#${menuId} .menu-panel`);
    if (!originalPanel) return;
    const panel = originalPanel.cloneNode(true);

    panel.style.cssText = `
        position: fixed;
        left: ${x}px;
        top: ${y}px;
        z-index: 99999;
        background: #fff;
        border: 2px solid #666;
        border-radius: 6px;
        box-shadow: 4px 4px 16px rgba(0,0,0,0.35);
        padding: 6px 0;
        min-width: 150px;
        font-size: 13px;
        line-height: 1.8;
        display: block;
    `;
    panel.querySelectorAll('.menu-item').forEach(item => {
        item.style.padding = '7px 20px';
        item.style.cursor = 'pointer';
        item.style.transition = 'background 0.1s';
        item.addEventListener('mouseenter', () => item.style.background = '#e0e0e0');
        item.addEventListener('mouseleave', () => item.style.background = '');
    });

    panel.querySelectorAll('.submenu-items').forEach(sub => { sub.style.display = 'none'; });

    panel.querySelectorAll('.submenu').forEach(submenu => {
        const subItems = submenu.querySelector('.submenu-items');
        if (subItems) {
            submenu.addEventListener('mouseenter', () => { subItems.style.display = 'block'; });
            submenu.addEventListener('mouseleave', () => { subItems.style.display = 'none'; });
        }
    });

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:99998;background:transparent;';

    document.querySelectorAll('.temp-context-menu').forEach(el => el.remove());
    document.querySelectorAll('.temp-context-overlay').forEach(el => el.remove());

    panel.classList.add('temp-context-menu');
    overlay.classList.add('temp-context-overlay');

    const closeMenu = () => {
        if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
        if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
        document.querySelectorAll('.temp-context-menu, .temp-context-overlay').forEach(el => {
            if (el.parentNode) el.parentNode.removeChild(el);
        });
        document.removeEventListener('keydown', escHandler);
    };

    overlay.addEventListener('click', (e) => { e.stopPropagation(); closeMenu(); });

    panel.addEventListener('click', async (e) => {
        const menuItem = e.target.closest('.menu-item');
        if (!menuItem) return;
        const action = menuItem.getAttribute('data-action');
        if (!action) return;
        e.preventDefault();
        e.stopPropagation();
        closeMenu();
        const indices = Array.from(selectedIndicesSet);
        if (indices.length === 0 && action !== 'pasteRow' && action !== 'createEmptyRow') return;

        const performAction = async (act) => {
            switch(act) {
                case 'deleteRow': {
                    const ok = await showConfirm(`确定删除选中的 ${indices.length} 行吗？`);
                    if (!ok) return;
                    const first = dataArray[indices[0]];
                    const date = first.date || State.currentFilterDate;
                    const reporter = first.reporter || '';
                    const deletedOrders = indices.map(i => dataArray[i]);
                    for (let i = indices.length - 1; i >= 0; i--) dataArray.splice(indices[i], 1);
                    selectedIndicesSet.clear();
                    reassignSeqForReporterDate(date, reporter);
                    deletedOrders.forEach(o => {
                        const logDetail = `${o.region||''} ${(o.betType||'').trim()} ${o.orderInfo||''} 各${formatMoney(o.amount)} 总额${formatMoney(o.totalAmount)} 申报人:${o.reporter||''}`;
                        addOperationLog('删除订单', logDetail + '（删除）');
                    });
                    persistAll();
                    break;
                }
                case 'copyRow': {
                    State.clipboardData = indices.map(i => ({...dataArray[i]}));
                    indices.forEach(i => {
                        const o = dataArray[i];
                        const logDetail = `${o.region||''} ${(o.betType||'').trim()} ${o.orderInfo||''} 各${formatMoney(o.amount)} 总额${formatMoney(o.totalAmount)} 申报人:${o.reporter||''}`;
                        addOperationLog('复制订单', logDetail + '（复制）');
                    });
                    persistAll();
                    return;
                }
                case 'cutRow':
                    State.clipboardData = indices.map(i => ({...dataArray[i]}));
                    {
                        const first = dataArray[indices[0]];
                        const date = first.date || State.currentFilterDate;
                        const reporter = first.reporter || '';
                        const cutOrders = indices.map(i => dataArray[i]);
                        cutOrders.forEach(o => {
                            const logDetail = `${o.region||''} ${(o.betType||'').trim()} ${o.orderInfo||''} 各${formatMoney(o.amount)} 总额${formatMoney(o.totalAmount)} 申报人:${o.reporter||''}`;
                            addOperationLog('剪切订单', logDetail + '（剪切）');
                        });
                        for (let i = indices.length - 1; i >= 0; i--) dataArray.splice(indices[i], 1);
                        selectedIndicesSet.clear();
                        reassignSeqForReporterDate(date, reporter);
                    }
                    persistAll();
                    break;
                case 'pasteRow': {
                    if (!State.clipboardData.length) return;
                    const insertIdx = indices.length ? indices[0] : dataArray.length;
                    const toInsert = State.clipboardData.map(o => ({...o}));
                    dataArray.splice(insertIdx, 0, ...toInsert);
                    selectedIndicesSet.clear();
                    const targetIdx = indices.length ? indices[0] : dataArray.length;
                    const targetOrder = dataArray[targetIdx];
                    if (targetOrder) reassignSeqForReporterDate(targetOrder.date || State.currentFilterDate, targetOrder.reporter || '');
                    const targetDate = targetOrder ? targetOrder.date : '';
                    const targetReporter = targetOrder ? targetOrder.reporter : '';
                    toInsert.forEach(o => {
                        const sourceDate = o.date || '';
                        const sourceReporter = o.reporter || '';
                        const logDetail = `${o.region||''} ${(o.betType||'').trim()} ${o.orderInfo||''} 各${formatMoney(o.amount)} 总额${formatMoney(o.totalAmount)} 申报人:${o.reporter||''}`;
                        addOperationLog('粘贴订单', logDetail + `（粘贴来源：${sourceDate}-${sourceReporter}）`);
                    });
                    persistAll();
                    break;
                }
                case 'batchChangeRegion': {
                    const modal = document.getElementById('promptModal');
                    const promptDiv = modal.querySelector('div[style]');
                    const originalHTML = promptDiv.innerHTML;
                    promptDiv.innerHTML = `
                        <p id="promptMessage" class="text-sm text-gray-700 mb-4">请选择新地区：</p>
                        <div class="custom-select-wrapper" id="promptSelectWrapper" style="width:100%;margin-bottom:8px;"></div>
                        <div class="flex justify-center gap-3">
                            <button id="promptOk" class="px-4 py-1.5 bg-green-500 text-white rounded hover:bg-green-600 text-xs">确定</button>
                            <button id="promptCancel" class="px-4 py-1.5 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 text-xs">取消</button>
                        </div>`;
                    modal.style.display = 'block';
                    modal.style.zIndex = '1000000';
                    const newRegion = await new Promise((resolve) => {
                        let selectedVal = '';
                        const wrapper = document.getElementById('promptSelectWrapper');
                        const regionOptions = ['澳门', '香港', '粤港'];
                        createCustomSelect(wrapper, regionOptions, regionOptions[0], (val) => { selectedVal = val; });
                        const okBtn = document.getElementById('promptOk');
                        const cancelBtn = document.getElementById('promptCancel');
                        const cleanup = () => {
                            modal.style.display = 'none';
                            modal.style.zIndex = '100000';
                            promptDiv.innerHTML = originalHTML;
                        };
                        okBtn.addEventListener('click', () => {
                            cleanup();
                            resolve(selectedVal);
                        });
                        cancelBtn.addEventListener('click', () => {
                            cleanup();
                            resolve(null);
                        });
                    });
                    if (!newRegion) return;
                    indices.forEach(i => { dataArray[i].region = newRegion; });
                    indices.forEach(i => {
                        const o = dataArray[i];
                        const logDetail = `${o.region||''} ${(o.betType||'').trim()} ${o.orderInfo||''} 各${formatMoney(o.amount)} 总额${formatMoney(o.totalAmount)} 申报人:${o.reporter||''}`;
                        addOperationLog('批量修改', logDetail + '（批量修改地区）');
                    });
                    persistAll();
                    break;
                }
                case 'batchChangeReporter': {
                    const modal = document.getElementById('promptModal');
                    const promptDiv = modal.querySelector('div[style]');
                    const originalHTML = promptDiv.innerHTML;
                    const applicants = window.applicants || [];
                    const optionsHTML = applicants.map(a => a.name);
                    promptDiv.innerHTML = `
                        <p id="promptMessage" class="text-sm text-gray-700 mb-4">选择或输入新申报人：</p>
                        <div class="custom-select-wrapper" id="promptSelectWrapper" style="width:100%;margin-bottom:8px;"></div>
                        <input type="text" id="promptInput" class="border border-gray-300 px-2 py-1 text-sm rounded w-full mb-4" placeholder="或手动输入" />
                        <div class="flex justify-center gap-3">
                            <button id="promptOk" class="px-4 py-1.5 bg-green-500 text-white rounded hover:bg-green-600 text-xs">确定</button>
                            <button id="promptCancel" class="px-4 py-1.5 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 text-xs">取消</button>
                        </div>`;
                    modal.style.display = 'block';
                    modal.style.zIndex = '1000000';
                    const newReporter = await new Promise((resolve) => {
                        let selectedVal = '';
                        const wrapper = document.getElementById('promptSelectWrapper');
                        createCustomSelect(wrapper, optionsHTML, '', (val) => { selectedVal = val; });
                        const inputEl = document.getElementById('promptInput');
                        const okBtn = document.getElementById('promptOk');
                        const cancelBtn = document.getElementById('promptCancel');
                        const cleanup = () => {
                            modal.style.display = 'none';
                            modal.style.zIndex = '100000';
                            promptDiv.innerHTML = originalHTML;
                        };
                        okBtn.addEventListener('click', () => {
                            const val = selectedVal || inputEl.value.trim();
                            cleanup();
                            resolve(val);
                        });
                        cancelBtn.addEventListener('click', () => {
                            cleanup();
                            resolve(null);
                        });
                        inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { okBtn.click(); } });
                    });
                    if (!newReporter) return;
                    if (!applicants.some(a => a.name === newReporter)) { await showAlert('申报人不在列表中，请重新输入。'); return; }
                    const ref = dataArray[indices[0]];
                    const date = ref.date || State.currentFilterDate;
                    indices.forEach(i => { dataArray[i].reporter = newReporter; });
                    reassignSeqForReporterDate(date, newReporter);
                    indices.forEach(i => {
                        const o = dataArray[i];
                        const logDetail = `${o.region||''} ${(o.betType||'').trim()} ${o.orderInfo||''} 各${formatMoney(o.amount)} 总额${formatMoney(o.totalAmount)} 申报人:${o.reporter||''}`;
                        addOperationLog('批量修改', logDetail + '（批量修改申报人）');
                    });
                    persistAll();
                    break;
                }
                case 'batchChangeRemark': {
                    const newRemark = await showPrompt('请输入新备注：');
                    if (newRemark === null) return;
                    indices.forEach(i => { dataArray[i].remark = newRemark; });
                    indices.forEach(i => {
                        const o = dataArray[i];
                        const logDetail = `${o.region||''} ${(o.betType||'').trim()} ${o.orderInfo||''} 各${formatMoney(o.amount)} 总额${formatMoney(o.totalAmount)} 申报人:${o.reporter||''}`;
                        addOperationLog('批量修改', logDetail + '（批量修改备注）');
                    });
                    persistAll();
                    break;
                }
                case 'createEmptyRow': {
                    const empty = { region:'澳门', betType:'', orderInfo:'', complexType:'', calcMethod:'', amount:0, totalAmount:0, reporter:'', winStatus:'未知', winAmount:'', date:State.currentFilterDate, remark:'', batchSeq: State.entryBatchSeq + 1 };
                    if (indices.length > 0) dataArray.splice(indices[0], 0, empty);
                    else dataArray.push(empty);
                    selectedIndicesSet.clear();
                    break;
                }
            }
            if (onDataChanged) onDataChanged();
        };
        await performAction(action);
    });

    const escHandler = (e) => { if (e.key === 'Escape') closeMenu(); };
    document.addEventListener('keydown', escHandler);
    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    const rect = panel.getBoundingClientRect();
    if (rect.right > window.innerWidth) panel.style.left = (window.innerWidth - rect.width - 5) + 'px';
    if (rect.bottom > window.innerHeight) panel.style.top = (window.innerHeight - rect.height - 5) + 'px';
}

// ========== 报告窗口显示 ==========
function showReportModal(reportHTML) {
    const modal = document.getElementById('reportModal');
    const body = document.getElementById('reportBody');
    if (!modal || !body) return;

    body.innerHTML = reportHTML;
    State.globalModalZIndex++;
    modal.style.zIndex = State.globalModalZIndex;
    modal.style.display = 'block';

    initReportModalDraggable('reportModal');

    const copyBtn = document.getElementById('reportCopyBtn');
    if (copyBtn) {
        const newCopyBtn = copyBtn.cloneNode(true);
        copyBtn.parentNode.replaceChild(newCopyBtn, copyBtn);
        newCopyBtn.addEventListener('click', async () => {
            if (body) {
                const text = body.innerText;
                try {
                    await navigator.clipboard.writeText(text);
                    showToast('已复制全部内容到剪贴板');
                } catch (e) {
                    showAlert('复制失败，请手动选择复制');
                }
            }
        });
    }

    const detailBtn = document.getElementById('reportDetailBtn');
    if (detailBtn) {
        const newDetailBtn = detailBtn.cloneNode(true);
        detailBtn.parentNode.replaceChild(newDetailBtn, detailBtn);
        newDetailBtn.addEventListener('click', () => {
            showOrderGroupModal();
        });
    }
}

// ========== 订单组明细窗口 ==========
function showOrderGroupModal() {
    const modal = document.getElementById('orderGroupModal');
    if (!modal) return;

    const reporterSelectWrapper = document.getElementById('orderGroupReporterSelectWrapper');
    const filterReporter = document.getElementById('filterReporter');
    let reporters = [];
    if (filterReporter) {
        const options = filterReporter.options;
        for (let i = 1; i < options.length; i++) {
            reporters.push(options[i].value);
        }
    }
    if (reporters.length === 0) {
        const reporterSet = new Set();
        State.orderList.forEach(o => {
            if (o.date === State.currentFilterDate && o.reporter) {
                reporterSet.add(o.reporter);
            }
        });
        reporters = Array.from(reporterSet).sort();
    }

    if (reporterSelectWrapper) {
        const options = reporters.length > 0 ? reporters : [];
        createCustomSelect(reporterSelectWrapper, options, options[0] || '', (val) => {
            updateLeftPanel();
            updateRightPanel();
        });
    }

    const getSelectedReporter = () => {
        const trigger = document.querySelector('#orderGroupReporterSelectWrapper .custom-select-trigger');
        if (!trigger) return reporters.length > 0 ? reporters[0] : '';
        return trigger.textContent || (reporters.length > 0 ? reporters[0] : '');
    };

    const regionCheckboxes = document.querySelectorAll('.orderGroupRegion');
    const getSelectedRegions = () => {
        const selected = [];
        regionCheckboxes.forEach(cb => {
            if (cb.checked) selected.push(cb.value);
        });
        return selected;
    };

    const body = document.getElementById('orderGroupBody');
    if (body) {
        body.style.overflowY = 'auto';
        body.style.display = 'flex';
    }

    const updateRightPanel = () => {
        const rightDiv = document.getElementById('orderGroupRight');
        if (!rightDiv) return;
        rightDiv.style.background = '#ffffff';
        rightDiv.style.border = 'none';
        rightDiv.style.overflowY = 'visible';
        rightDiv.style.maxHeight = 'none';
        const selectedRegions = getSelectedRegions();
        const selectedReporter = getSelectedReporter();
        if (!selectedReporter) { rightDiv.innerHTML = ''; return; }

        let html = '';
        if (selectedRegions.length > 0) {
            const todayDraw = getCurrentDrawData();
            const areaLabels = {macau:'澳门',hongkong:'香港',yuegang:'粤港'};
            selectedRegions.forEach((region, index) => {
                const data = todayDraw[region] || {nums:[], shengs:[]};
                let qihaoStr = '';
                const areaName = areaLabels[region];
                const areaHist = State.historyRecords.filter(r => r.area === areaName && r.date === State.currentFilterDate);
                if (areaHist.length) {
                    const latestQihao = areaHist[areaHist.length-1].qihao;
                    qihaoStr = ' ' + String(latestQihao).slice(-3) + '期';
                }
                let titleText = areaLabels[region] + '开奖';
                if (region !== 'hongkong') titleText += qihaoStr;

                const nums = data.nums || [];
                const shengs = data.shengs || [];
                html += `<div style="display:flex; flex-direction:column; align-items:flex-start; margin:0 0 1.2em 0; padding:0; line-height:1.2;">`;
                html += `<div style="font-weight:bold; font-size:12px; margin:0 0 2px 0; padding:0;">${titleText}</div>`;
                
                let ballsHTML = '<div style="display:flex; align-items:flex-end; gap:4px; margin:0; padding:0;">';
                let shengsHTML = '<div style="display:flex; align-items:flex-end; gap:4px; margin:0; padding:0;">';
                
                for (let i = 0; i < 7; i++) {
                    if (i === 6) {
                        ballsHTML += `<span style="display:inline-flex; width:28px; justify-content:center; align-items:flex-end; font-size:16px; font-weight:bold; line-height:1;">+</span>`;
                        shengsHTML += `<span style="width:28px;"></span>`;
                    }
                    ballsHTML += buildSmallBallHTML(nums[i] || '');
                    shengsHTML += buildSmallShengBlock(shengs[i] || '');
                }
                ballsHTML += '</div>';
                shengsHTML += '</div>';

                html += ballsHTML;
                html += shengsHTML;
                html += `</div>`;
                html += '<hr style="border:none;border-top:1px solid #e5e7eb;margin:12px 0;">';
            });
        }

        html += '<div style="height:10px;"></div>';
        const reportHtml = generateReporterProfitReport(selectedReporter, selectedRegions);
        html += reportHtml;
        rightDiv.innerHTML = html;
    };

    const updateLeftPanel = () => {
        const leftDiv = document.getElementById('orderGroupLeft');
        if (!leftDiv) return;
        leftDiv.style.background = '#ffffff';
        leftDiv.style.border = 'none';
        leftDiv.style.overflowY = 'visible';
        leftDiv.style.maxHeight = 'none';
        const selectedReporter = getSelectedReporter();
        if (!selectedReporter) {
            leftDiv.innerHTML = '<div style="padding:20px;color:#999;">无申报人数据</div>';
            return;
        }
        const reporterOrders = State.orderList.filter(o => o.date === State.currentFilterDate && o.reporter === selectedReporter);
        if (reporterOrders.length === 0) {
            leftDiv.innerHTML = '<div style="padding:20px;color:#999;">暂无订单</div>';
            return;
        }
        const seqMap = {};
        reporterOrders.forEach(o => {
            const seq = o.orderSeq || 1;
            if (!seqMap[seq]) seqMap[seq] = { totalAmount: 0, wins: [] };
            seqMap[seq].totalAmount += (parseFloat(o.totalAmount) || 0);
            if (o.winStatus === '中奖') {
                seqMap[seq].wins.push({
                    betType: (o.betType || '').trim(),
                    winAmount: parseFloat(o.winAmount) || 0
                });
            }
        });
        const seqs = Object.keys(seqMap).sort((a, b) => parseInt(a) - parseInt(b));
        const items = seqs.map(seq => ({
            seq: seq,
            amount: Math.round(seqMap[seq].totalAmount),
            wins: seqMap[seq].wins
        }));

        const ITEMS_PER_COL = 25;
        const columns = [];
        for (let i = 0; i < items.length; i += ITEMS_PER_COL) {
            columns.push(items.slice(i, i + ITEMS_PER_COL));
        }

        let columnsHTML = columns.map((col, colIdx) => {
            const colItemsHTML = col.map(item => {
                const mergedWins = [];
                const typeMap = {};
                item.wins.forEach(w => {
                    if (!typeMap[w.betType]) {
                        typeMap[w.betType] = { betType: w.betType, winAmount: 0 };
                        mergedWins.push(typeMap[w.betType]);
                    }
                    typeMap[w.betType].winAmount += w.winAmount;
                });

                let itemHTML = `<div style="margin:0;padding:2px 4px;border:1px solid #d5dce3;border-radius:3px;background:#fff;text-align:center;">`;
                itemHTML += `<div style="margin:0;padding:0;text-align:center;">`;
                itemHTML += `<span style="color:#000;font-weight:normal;">${item.seq}条：</span>`;
                itemHTML += `<span style="color:#2563eb;font-weight:bold;font-size:15px;">${item.amount}</span>`;
                itemHTML += `</div>`;
                if (mergedWins.length > 0) {
                    mergedWins.forEach(w => {
                        itemHTML += `<div style="margin:0;padding:0;text-align:center;"><span style="color:#dc2626;font-weight:normal;">${w.betType}：${formatMoney(w.winAmount)}</span></div>`;
                    });
                }
                itemHTML += `</div>`;
                return itemHTML;
            }).join('');

            return `<div class="order-column" style="border-right:none;padding-right:0;margin-right:8px;padding-top:2px;">${colItemsHTML}</div>`;
        }).join('');

        leftDiv.innerHTML = columnsHTML;
    };

    regionCheckboxes.forEach(cb => {
        cb.addEventListener('change', () => {
            updateRightPanel();
        });
    });

    updateLeftPanel();
    updateRightPanel();

    const screenshotBtn = document.getElementById('orderGroupScreenshotBtn');
    if (screenshotBtn) {
        screenshotBtn.addEventListener('click', async function() {
            const leftDiv = document.getElementById('orderGroupLeft');
            const rightDiv = document.getElementById('orderGroupRight');
            if (!leftDiv || !rightDiv) return;

            const tempContainer = document.createElement('div');
            Object.assign(tempContainer.style, {
                display: 'flex',
                background: '#f5f5f5',
                position: 'fixed',
                left: '-9999px',
                top: '0',
                width: 'max-content',
                height: 'auto',
                padding: '15px',
                gap: '0',
                fontFamily: getComputedStyle(document.body).fontFamily
            });

            const leftClone = leftDiv.cloneNode(true);
            Object.assign(leftClone.style, {
                display: 'flex',
                flexWrap: 'nowrap',
                alignItems: 'flex-start',
                justifyContent: 'flex-end',
                maxHeight: 'none',
                overflow: 'visible',
                border: 'none',
                padding: '10px 15px',
                boxSizing: 'border-box',
                background: '#ffffff',
                flexShrink: '0',
                width: 'max-content'
            });

            const rightClone = rightDiv.cloneNode(true);
            Object.assign(rightClone.style, {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                maxHeight: 'none',
                overflow: 'visible',
                border: 'none',
                borderLeft: 'none',
                padding: '10px 15px',
                boxSizing: 'border-box',
                background: '#fff',
                flexShrink: '0',
                fontFamily: getComputedStyle(document.body).fontFamily,
                fontSize: '13px'
            });

            tempContainer.appendChild(leftClone);
            tempContainer.appendChild(rightClone);
            document.body.appendChild(tempContainer);

            try {
                const canvas = await html2canvas(tempContainer, {
                    scale: 2,
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: '#ffffff'
                });

                const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
                try {
                    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                    showToast('已复制到剪贴板');
                } catch (clipErr) {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = '订单明细截图.png';
                    a.click();
                    URL.revokeObjectURL(url);
                    showToast('已下载截图（剪贴板不可用）');
                }
            } catch (err) {
                console.error('截图失败', err);
                showAlert('截图失败，请重试或手动截屏');
            } finally {
                document.body.removeChild(tempContainer);
            }
        });
    }

    State.globalModalZIndex++;
    modal.style.zIndex = State.globalModalZIndex;
    modal.style.display = 'block';
    initReportModalDraggable('orderGroupModal');

    const closeBtn = document.getElementById('orderGroupCloseBtn');
    if (closeBtn) {
        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
        newCloseBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }
}

// ========== 录单表格拖选（修复：自动滚动期间禁止 onMouseMove 更新选区，且 stopAutoScroll 不重置标志） ==========
function initEntryTableDragSelect() {
    const tbody = document.getElementById('entryTableBody');
    if (!tbody) return;
    const wrapper = document.getElementById('entryTableWrapper');
    let isDragging = false, startIndex = -1, endIndex = -1;
    let autoScrollInterval = null;
    let autoScrolling = false;   // 标志：是否处于自动滚动中

    function stopAutoScroll() {
        if (autoScrollInterval) { clearInterval(autoScrollInterval); autoScrollInterval = null; }
        // 不再这里设置 autoScrolling = false，由调用方显式控制
    }

    function getFirstRow() {
        const rows = tbody.querySelectorAll('tr.order-row');
        return rows.length > 0 ? rows[0] : null;
    }

    function getLastRow() {
        const rows = tbody.querySelectorAll('tr.order-row');
        return rows.length > 0 ? rows[rows.length - 1] : null;
    }

    // 只扩展不缩小的更新函数
    function expandSelectionToRow(tr) {
        if (!tr) return;
        const idx = parseInt(tr.dataset.index);
        const currentMin = Math.min(startIndex, endIndex !== -1 ? endIndex : startIndex);
        const currentMax = Math.max(startIndex, endIndex !== -1 ? endIndex : startIndex);
        const newMin = Math.min(idx, currentMin);
        const newMax = Math.max(idx, currentMax);
        if (newMin === currentMin && newMax === currentMax) return;
        endIndex = idx;
        State.entrySelectedIndices.clear();
        for (let i = newMin; i <= newMax; i++) State.entrySelectedIndices.add(i);
        updateEntryRowSelection();
    }

    tbody.addEventListener('mousedown', (e) => {
        if (e.button === 2) return;
        const tr = e.target.closest('tr.order-row');
        if (!tr) return;
        if (e.target.closest('input') || e.target.closest('select') || e.target.closest('.custom-select-wrapper')) return;
        const idx = parseInt(tr.dataset.index);
        if (e.ctrlKey || e.metaKey) {
            if (State.entrySelectedIndices.has(idx)) State.entrySelectedIndices.delete(idx);
            else State.entrySelectedIndices.add(idx);
            updateEntryRowSelection();
            return;
        }
        if (e.shiftKey && startIndex !== -1) {
            const min = Math.min(startIndex, idx), max = Math.max(startIndex, idx);
            State.entrySelectedIndices.clear();
            for (let i = min; i <= max; i++) State.entrySelectedIndices.add(i);
            endIndex = idx;
            updateEntryRowSelection();
            return;
        }
        isDragging = true;
        startIndex = idx;
        autoScrolling = false;
        State.entrySelectedIndices.clear();
        State.entrySelectedIndices.add(idx);
        updateEntryRowSelection();
        document.addEventListener('mouseup', onMouseUp);
        document.addEventListener('mousemove', onMouseMove);
    });

    const onMouseMove = (e) => {
        if (!isDragging) return;

        const rect = wrapper.getBoundingClientRect();
        const topThreshold = rect.top + 30;
        const bottomThreshold = rect.bottom - 30;

        if (e.clientY < topThreshold) {
            if (!autoScrolling) {
                autoScrolling = true;
                // 直接启动定时器，不调用 stopAutoScroll，避免重置标志
                if (autoScrollInterval) clearInterval(autoScrollInterval);
                autoScrollInterval = setInterval(() => {
                    wrapper.scrollTop -= 15;
                    const tr = getFirstRow();
                    if (tr) expandSelectionToRow(tr);
                }, 30);
            }
            // 自动滚动期间，onMouseMove 不更新选区，只保持定时器运行
            return;
        } else if (e.clientY > bottomThreshold) {
            if (!autoScrolling) {
                autoScrolling = true;
                if (autoScrollInterval) clearInterval(autoScrollInterval);
                autoScrollInterval = setInterval(() => {
                    wrapper.scrollTop += 15;
                    const tr = getLastRow();
                    if (tr) expandSelectionToRow(tr);
                }, 30);
            }
            return;
        } else {
            // 鼠标回到表格内部，停止自动滚动，并允许手动更新
            if (autoScrolling) {
                autoScrolling = false;
                stopAutoScroll();
            }
            let tr = document.elementFromPoint(e.clientX, e.clientY)?.closest('tr.order-row');
            if (!tr) {
                if (e.clientY < rect.top) tr = getFirstRow();
                else if (e.clientY > rect.bottom) tr = getLastRow();
            }
            if (tr) expandSelectionToRow(tr);
        }
    };

    const onMouseUp = () => {
        isDragging = false;
        endIndex = -1;
        autoScrolling = false;
        stopAutoScroll();
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };
}

// ========== 录单右键菜单 ==========
function initEntryContextMenu() {
    const tbody = document.getElementById('entryTableBody');
    if (!tbody) return;
    const newTbody = tbody.cloneNode(true); tbody.parentNode.replaceChild(newTbody, tbody);
    newTbody.addEventListener('click', (e) => { if (e.button === 2) return; const tr = e.target.closest('tr.order-row'); if (!tr) return; const idx = parseInt(tr.dataset.index); if (e.ctrlKey || e.metaKey) { if (State.entrySelectedIndices.has(idx)) State.entrySelectedIndices.delete(idx); else State.entrySelectedIndices.add(idx); } else { State.entrySelectedIndices.clear(); State.entrySelectedIndices.add(idx); } updateEntryRowSelection(); });
    newTbody.addEventListener('contextmenu', (e) => { e.preventDefault(); const tr = e.target.closest('tr.order-row'); if (tr) { const idx = parseInt(tr.dataset.index); if (!State.entrySelectedIndices.has(idx) && !e.ctrlKey) { State.entrySelectedIndices.clear(); State.entrySelectedIndices.add(idx); updateEntryRowSelection(); } } showGeneralContextMenu('entryContextMenu', e.clientX, e.clientY, State.entryOrders, State.entrySelectedIndices, () => { renderEntryTable(); updateEntryRowSelection(); }); });
    initEntryTableDragSelect();
}

function updateEntryRowSelection() { document.querySelectorAll('#entryTableBody .order-row').forEach(row => { const idx = parseInt(row.dataset.index); row.classList.toggle('selected', State.entrySelectedIndices.has(idx)); }); }

// ========== 订单详情拖选（修复：自动滚动期间禁止 onMouseMove 更新选区，且 stopAutoScroll 不重置标志） ==========
function initOrderDetailDragSelect(tbody) {
    let isDragging = false;
    let startRealIdx = -1;
    let endRealIdx = -1;
    let autoScrollTimer = null;
    let pendingUpdate = false;
    let autoScrolling = false;

    function getWrapper() {
        return document.getElementById('orderDetailTableWrapper');
    }

    function getFirstRow() {
        const rows = tbody.querySelectorAll('tr.order-row');
        return rows.length > 0 ? rows[0] : null;
    }

    function getLastRow() {
        const rows = tbody.querySelectorAll('tr.order-row');
        return rows.length > 0 ? rows[rows.length - 1] : null;
    }

    function stopAutoScroll() {
        if (autoScrollTimer) {
            clearInterval(autoScrollTimer);
            autoScrollTimer = null;
        }
        // 不在这里改 autoScrolling
    }

    function scheduleUpdate() {
        if (!pendingUpdate) {
            pendingUpdate = true;
            requestAnimationFrame(() => {
                updateRowSelection();
                pendingUpdate = false;
            });
        }
    }

    // 只扩展不缩小的更新函数
    function expandSelectionToRow(tr) {
        if (!tr) return;
        const realIdx = parseInt(tr.dataset.realIndex);
        const currentMin = Math.min(startRealIdx, endRealIdx !== -1 ? endRealIdx : startRealIdx);
        const currentMax = Math.max(startRealIdx, endRealIdx !== -1 ? endRealIdx : startRealIdx);
        const newMin = Math.min(realIdx, currentMin);
        const newMax = Math.max(realIdx, currentMax);
        if (newMin === currentMin && newMax === currentMax) return;
        endRealIdx = realIdx;
        State.selectedOrderIndices.clear();
        const rows = tbody.querySelectorAll('tr.order-row');
        let inRange = false;
        rows.forEach(r => {
            const idx = parseInt(r.dataset.realIndex);
            if (idx === newMin) inRange = true;
            if (inRange) State.selectedOrderIndices.add(idx);
            if (idx === newMax) inRange = false;
        });
        scheduleUpdate();
    }

    tbody.addEventListener('mousedown', (e) => {
        if (e.button === 2) return;
        const tr = e.target.closest('tr.order-row');
        if (!tr || e.target.closest('input, select, button, .custom-select-wrapper')) return;

        const realIdx = parseInt(tr.dataset.realIndex);
        if (e.ctrlKey || e.metaKey) return;

        if (e.shiftKey && startRealIdx !== -1) {
            const min = Math.min(startRealIdx, realIdx);
            const max = Math.max(startRealIdx, realIdx);
            State.selectedOrderIndices.clear();
            const rows = tbody.querySelectorAll('tr.order-row');
            let started = false;
            rows.forEach(r => {
                const idx = parseInt(r.dataset.realIndex);
                if (idx === min) started = true;
                if (started) State.selectedOrderIndices.add(idx);
                if (idx === max) started = false;
            });
            endRealIdx = realIdx;
            updateRowSelection();
            return;
        }

        isDragging = true;
        startRealIdx = realIdx;
        autoScrolling = false;
        State.selectedOrderIndices.clear();
        State.selectedOrderIndices.add(realIdx);
        updateRowSelection();

        const onMouseMove = (e) => {
            if (!isDragging) return;

            const wrapper = getWrapper();
            if (!wrapper) return;
            const rect = wrapper.getBoundingClientRect();
            const threshold = 35;

            if (e.clientY < rect.top + threshold) {
                if (!autoScrolling) {
                    autoScrolling = true;
                    if (autoScrollTimer) clearInterval(autoScrollTimer);
                    autoScrollTimer = setInterval(() => {
                        wrapper.scrollTop -= 12;
                        const tr = getFirstRow();
                        if (tr) expandSelectionToRow(tr);
                    }, 25);
                }
                return;
            } else if (e.clientY > rect.bottom - threshold) {
                if (!autoScrolling) {
                    autoScrolling = true;
                    if (autoScrollTimer) clearInterval(autoScrollTimer);
                    autoScrollTimer = setInterval(() => {
                        wrapper.scrollTop += 12;
                        const tr = getLastRow();
                        if (tr) expandSelectionToRow(tr);
                    }, 25);
                }
                return;
            } else {
                if (autoScrolling) {
                    autoScrolling = false;
                    stopAutoScroll();
                }
                let targetTr = document.elementFromPoint(e.clientX, e.clientY)?.closest('tr.order-row');
                if (!targetTr) {
                    if (e.clientY < rect.top) targetTr = getFirstRow();
                    else if (e.clientY > rect.bottom) targetTr = getLastRow();
                }
                if (targetTr) expandSelectionToRow(targetTr);
            }
        };

        const onMouseUp = () => {
            isDragging = false;
            endRealIdx = -1;
            autoScrolling = false;
            stopAutoScroll();
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });
}

function updateRowSelection() { document.querySelectorAll('#orderDetailTbody .order-row').forEach(row => { const realIdx = parseInt(row.dataset.realIndex); row.classList.toggle('selected', State.selectedOrderIndices.has(realIdx)); }); }

// ========== 订单详情事件绑定 ==========
function bindOrderDetailEvents() {
    const tbody = document.getElementById('orderDetailTbody');
    if (!tbody) return;
    const newTbody = tbody.cloneNode(true); tbody.parentNode.replaceChild(newTbody, tbody);
    newTbody.addEventListener('click', (e) => { if (e.button === 2) return; const tr = e.target.closest('tr.order-row'); if (!tr) return; const realIdx = parseInt(tr.dataset.realIndex); if (isNaN(realIdx)) return; if (e.ctrlKey || e.metaKey) { if (State.selectedOrderIndices.has(realIdx)) State.selectedOrderIndices.delete(realIdx); else State.selectedOrderIndices.add(realIdx); } else { State.selectedOrderIndices.clear(); State.selectedOrderIndices.add(realIdx); } updateRowSelection(); });
    newTbody.addEventListener('contextmenu', (e) => { e.preventDefault(); const tr = e.target.closest('tr.order-row'); if (tr) { const realIdx = parseInt(tr.dataset.realIndex); if (!isNaN(realIdx) && !State.selectedOrderIndices.has(realIdx) && !e.ctrlKey) { State.selectedOrderIndices.clear(); State.selectedOrderIndices.add(realIdx); updateRowSelection(); } } showGeneralContextMenu('contextMenu', e.clientX, e.clientY, State.orderList, State.selectedOrderIndices, () => { persistAll(); switchPage('orderDetail'); }); });
    initOrderDetailDragSelect(newTbody);

    newTbody.addEventListener('dblclick', function(e) {
        const td = e.target.closest('td');
        if (!td) return;
        const tr = td.closest('tr.order-row');
        if (!tr) return;
        const realIdx = parseInt(tr.dataset.realIndex);
        if (isNaN(realIdx)) return;
        const colIndex = Array.from(tr.querySelectorAll('td')).indexOf(td);
        if (colIndex === 0 || colIndex === 7) return;
        if (td.querySelector('input') || td.querySelector('select') || td.querySelector('.custom-select-wrapper')) return;
        const originalText = td.textContent.trim();
        const order = State.orderList[realIdx];
        if (colIndex === 9) {
            const wrapper = document.createElement('div');
            wrapper.className = 'custom-select-wrapper';
            wrapper.style.width = '100%';
            const applicants = window.applicants || [];
            const options = applicants.map(a => a.name);
            const selectedValue = originalText;
            td.textContent = '';
            td.appendChild(wrapper);
            createCustomSelect(wrapper, options, selectedValue, (newVal) => {
                const oldReporter = order.reporter;
                order.reporter = newVal;
                if (oldReporter !== newVal) reassignSeqForReporterDate(order.date, newVal);
                const amt = parseFloat(order.amount) || 0;
                if (amt > 0 && order.orderInfo) order.totalAmount = calcTotalByPlayType(order.betType, order.orderInfo, amt);
                const logDetail = `${order.region||''} ${(order.betType||'').trim()} ${order.orderInfo||''} 各${formatMoney(order.amount)} 总额${formatMoney(order.totalAmount)} 申报人:${order.reporter||''}`;
                addOperationLog('修改订单', logDetail + '（修改申报人）');
                persistAll();
                switchPage('orderDetail');
            });
            setTimeout(() => {
                const trigger = wrapper.querySelector('.custom-select-trigger');
                if (trigger) trigger.click();
            }, 50);
            return;
        }
        const input = document.createElement('input'); input.type = 'text'; input.style.width = '100%'; input.style.border = '1px solid #4a90e2'; input.value = originalText;
        td.textContent = ''; td.appendChild(input); input.focus(); input.select();
        const finish = () => { const newVal = input.value.trim(); td.textContent = newVal;
            let changedField = '';
            switch(colIndex) { case 1: order.region = newVal; changedField = '区域'; break; case 2: order.betType = newVal; changedField = '玩法'; break; case 3: order.orderInfo = newVal; changedField = '订单信息'; break; case 4: order.complexType = newVal; changedField = '计算方式'; break; case 5: order.amount = parseFloat(newVal) || 0; changedField = '金额'; break; case 8: order.orderSeq = parseInt(newVal) || order.orderSeq; changedField = '序号'; break; case 9: { const oldReporter = order.reporter; order.reporter = newVal; if (oldReporter !== newVal) reassignSeqForReporterDate(order.date, newVal); changedField = '申报人'; } break; case 10: order.winStatus = newVal; changedField = '中奖状态'; break; case 11: order.winAmount = newVal; changedField = '中奖金额'; break; case 12: order.remark = newVal; changedField = '备注'; break; }
            const amt = parseFloat(order.amount) || 0; if (amt > 0 && order.orderInfo) order.totalAmount = calcTotalByPlayType(order.betType, order.orderInfo, amt);
            if (changedField) {
                const logDetail = `${order.region||''} ${(order.betType||'').trim()} ${order.orderInfo||''} 各${formatMoney(order.amount)} 总额${formatMoney(order.totalAmount)} 申报人:${order.reporter||''}`;
                addOperationLog('修改订单', logDetail + `（修改${changedField}）`);
            }
            persistAll(); switchPage('orderDetail'); };
        input.addEventListener('blur', finish);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); finish(); } if (e.key === 'Escape') { input.value = originalText; finish(); } });
    });
}

// ========== 序号重新分配 ==========
function reassignSeqForReporterDate(date, reporter) {
    const same = [];
    for (let i = 0; i < State.orderList.length; i++) {
        const o = State.orderList[i];
        if (o.date === date && o.reporter === reporter) {
            same.push(o);
        }
    }
    let currentOrderSeq = 0;
    let lastBatchSeq = null;
    for (const o of same) {
        const bs = o.batchSeq;
        if (bs === undefined || bs !== lastBatchSeq) {
            currentOrderSeq++;
            lastBatchSeq = bs;
        }
        o.orderSeq = currentOrderSeq;
    }
}

// ========== 录单表格渲染与事件 ==========
function renderEntryTable() {
    const tbody = document.getElementById('entryTableBody');
    if (!tbody) return;
    tbody.innerHTML = State.entryOrders.map((order, idx) => {
        const rowClass = State.entrySelectedIndices.has(idx) ? 'selected' : '';
        const info = order.orderInfo || '';
        return `<tr class="order-row ${rowClass}" data-index="${idx}">
            <td>${order.batchSeq || (idx + 1)}</td>
            <td>${order.region || ''}</td>
            <td>${order.betType || ''}</td>
            <td title="${info.replace(/"/g,'&quot;')}">${info}</td>
            <td>${order.calcMethod || ''}</td>
            <td>${formatMoney(order.amount)}</td>
            <td>${formatMoney(order.totalAmount)}</td>
            <td>${order.reporter || ''}</td>
            <td>${order.remark || ''}</td>
        </tr>`;
    }).join('');
    const total = State.entryOrders.reduce((s, o) => s + (parseFloat(o.totalAmount) || 0), 0);
    const totalEl = document.getElementById('entryTotal');
    if (totalEl) totalEl.textContent = formatMoney(total);
    bindEntryTableDblClick();
}

function bindEntryTableDblClick() {
    const tbody = document.getElementById('entryTableBody');
    if (!tbody) return;
    tbody.querySelectorAll('tr').forEach(row => {
        row.querySelectorAll('td').forEach((td, colIndex) => {
            if (colIndex === 0 || colIndex === 4 || colIndex === 6) return;
            td.addEventListener('dblclick', function(e) {
                e.stopPropagation();
                if (td.querySelector('input') || td.querySelector('select') || td.querySelector('.custom-select-wrapper')) return;
                const originalText = td.textContent.trim();
                const rowIdx = parseInt(row.dataset.index);
                if (colIndex === 7) {
                    const wrapper = document.createElement('div');
                    wrapper.className = 'custom-select-wrapper';
                    wrapper.style.width = '100%';
                    const applicants = window.applicants || [];
                    const options = applicants.map(a => a.name);
                    const selectedValue = originalText;
                    td.textContent = '';
                    td.appendChild(wrapper);
                    const { getValue, setValue } = createCustomSelect(wrapper, options, selectedValue, (newVal) => {
                        State.entryOrders[rowIdx].reporter = newVal;
                        recalcEntryRow(rowIdx);
                    });
                    setTimeout(() => {
                        const trigger = wrapper.querySelector('.custom-select-trigger');
                        if (trigger) trigger.click();
                    }, 50);
                } else {
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.style.width = '100%';
                    input.style.border = '1px solid #4a90e2';
                    input.value = originalText;
                    td.textContent = '';
                    td.appendChild(input);
                    input.focus();
                    input.select();
                    const finish = () => {
                        const newVal = input.value.trim();
                        td.textContent = newVal;
                        const order = State.entryOrders[rowIdx];
                        switch(colIndex) {
                            case 1: order.region = newVal; break;
                            case 2: order.betType = newVal; break;
                            case 3: order.orderInfo = newVal; break;
                            case 5: order.amount = parseFloat(newVal) || 0; break;
                            case 7: order.reporter = newVal; break;
                            case 8: order.remark = newVal; break;
                        }
                        recalcEntryRow(rowIdx);
                    };
                    input.addEventListener('blur', finish);
                    input.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') { e.preventDefault(); finish(); }
                        if (e.key === 'Escape') { input.value = originalText; finish(); }
                    });
                }
            });
        });
    });
}

function recalcEntryRow(idx) {
    const order = State.entryOrders[idx];
    const amt = parseFloat(order.amount) || 0;
    if (amt > 0 && order.orderInfo) {
        order.totalAmount = calcTotalByPlayType(order.betType, order.orderInfo, amt);
    }
    renderEntryTable();
}

// ========== 特码调单拖选 ==========
function bindSpecialCodeDragSelect() {
    const tbody = document.getElementById('specialCodeLeftBody');
    if (!tbody) return;
    const wrapper = tbody.closest('.overflow-y-auto') || tbody.parentElement;
    let isDragging = false;
    let startNum = null;
    let endNum = null;
    let specialCodeAutoScrollTimer = null;

    function startAutoScroll(e) {
        if (!wrapper) return;
        const rect = wrapper.getBoundingClientRect();
        const mouseY = e.clientY;
        const topThreshold = rect.top + 30;
        const bottomThreshold = rect.bottom - 30;
        stopAutoScroll();
        if (mouseY < topThreshold) {
            specialCodeAutoScrollTimer = setInterval(() => {
                wrapper.scrollTop -= 15;
                const event = new MouseEvent('mousemove', { clientX: e.clientX, clientY: e.clientY });
                document.dispatchEvent(event);
            }, 30);
        } else if (mouseY > bottomThreshold) {
            specialCodeAutoScrollTimer = setInterval(() => {
                wrapper.scrollTop += 15;
                const event = new MouseEvent('mousemove', { clientX: e.clientX, clientY: e.clientY });
                document.dispatchEvent(event);
            }, 30);
        }
    }

    function stopAutoScroll() {
        if (specialCodeAutoScrollTimer) {
            clearInterval(specialCodeAutoScrollTimer);
            specialCodeAutoScrollTimer = null;
        }
    }

    tbody.addEventListener('mousedown', (e) => {
        if (e.button === 2) return;
        const tr = e.target.closest('tr[data-num]');
        if (!tr) return;
        const num = tr.getAttribute('data-num');
        if (e.ctrlKey || e.metaKey) {
            if (State.specialCodeSelectedRows.has(num)) State.specialCodeSelectedRows.delete(num);
            else State.specialCodeSelectedRows.add(num);
            updateSpecialCodeRowSelection();
            return;
        }
        if (e.shiftKey && startNum) {
            const allRows = Array.from(tbody.querySelectorAll('tr[data-num]'));
            const allNums = allRows.map(r => r.getAttribute('data-num'));
            const startIdx = allNums.indexOf(startNum);
            const endIdx = allNums.indexOf(num);
            if (startIdx !== -1 && endIdx !== -1) {
                State.specialCodeSelectedRows.clear();
                const min = Math.min(startIdx, endIdx);
                const max = Math.max(startIdx, endIdx);
                for (let i = min; i <= max; i++) State.specialCodeSelectedRows.add(allNums[i]);
                endNum = num;
                updateSpecialCodeRowSelection();
            }
            return;
        }
        isDragging = true;
        startNum = num;
        State.specialCodeSelectedRows.clear();
        State.specialCodeSelectedRows.add(num);
        updateSpecialCodeRowSelection();
        document.addEventListener('mouseup', onMouseUp);
        document.addEventListener('mousemove', onMouseMove);
    });

    const onMouseMove = (e) => {
        if (!isDragging) return;
        startAutoScroll(e);
        const tr = document.elementFromPoint(e.clientX, e.clientY)?.closest('tr[data-num]');
        if (!tr) return;
        const num = tr.getAttribute('data-num');
        if (num === endNum) return;
        endNum = num;
        const allRows = Array.from(tbody.querySelectorAll('tr[data-num]'));
        const allNums = allRows.map(r => r.getAttribute('data-num'));
        const startIdx = allNums.indexOf(startNum);
        const endIdx = allNums.indexOf(num);
        if (startIdx === -1 || endIdx === -1) return;
        State.specialCodeSelectedRows.clear();
        const min = Math.min(startIdx, endIdx);
        const max = Math.max(startIdx, endIdx);
        for (let i = min; i <= max; i++) State.specialCodeSelectedRows.add(allNums[i]);
        updateSpecialCodeRowSelection();
    };

    const onMouseUp = () => {
        isDragging = false;
        endNum = null;
        stopAutoScroll();
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };

    tbody.addEventListener('click', (e) => {
        if (e.ctrlKey || e.metaKey || e.shiftKey) return;
        if (isDragging) return;
        const tr = e.target.closest('tr[data-num]');
        if (!tr) return;
        const num = tr.getAttribute('data-num');
        State.specialCodeSelectedRows.clear();
        State.specialCodeSelectedRows.add(num);
        updateSpecialCodeRowSelection();
    });
}

function updateSpecialCodeRowSelection() {
    document.querySelectorAll('#specialCodeLeftBody tr[data-num]').forEach(row => {
        const num = row.getAttribute('data-num');
        row.classList.toggle('selected', State.specialCodeSelectedRows.has(num));
    });
}

function handleCopyReport() {
    if (State.specialCodeSelectedRows.size === 0) { showToast('请先在左侧表格选择号码'); return; }
    const nums = Array.from(State.specialCodeSelectedRows).sort((a, b) => parseInt(a) - parseInt(b));
    const text = nums.join('-') + '各号';
    navigator.clipboard.writeText(text).then(() => {
        showToast('已复制：' + text);
    }).catch(() => {
        showToast('复制失败，请手动复制');
    });
}

// ========== 侧边栏折叠 ==========
function initSidebarToggle() {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggleSidebarBtn');
    if (!sidebar || !toggleBtn) return;
    function setCollapsed(collapsed) {
        if (collapsed) { sidebar.classList.remove('w-52'); sidebar.classList.add('w-20'); sidebar.classList.add('collapsed'); toggleBtn.innerHTML = '»'; }
        else { sidebar.classList.remove('w-20'); sidebar.classList.remove('collapsed'); sidebar.classList.add('w-52'); toggleBtn.innerHTML = '«'; }
        State.sidebarCollapsed = collapsed;
    }
    toggleBtn.addEventListener('click', () => { setCollapsed(!State.sidebarCollapsed); });
    setCollapsed(false);
}

// ========== 今日开奖输入绑定 ==========
function bindDrawInputs() {
    document.querySelectorAll('.draw-num-input').forEach(input => {
        input.addEventListener('input', function() {
            const area = this.getAttribute('data-area');
            const index = this.getAttribute('data-index');
            const num = this.value.trim();
            const color = getColorByNum(num);
            this.style.color = color==='red'?'#dc2626':color==='blue'?'#2563eb':color==='green'?'#059669':'';
            const sheng = getShengByNum(num)||'--';
            const shengSpan = document.querySelector(`span.draw-sheng[data-area="${area}"][data-index="${index}"]`);
            if (shengSpan) { shengSpan.textContent = sheng; shengSpan.style.color = getShengColorStyle(sheng)||'#333'; }
        });
        input.addEventListener('keydown', function(e) { if(e.key==='Enter'){ e.preventDefault(); const area=this.getAttribute('data-area'); const index=parseInt(this.getAttribute('data-index')); const nextInput=document.querySelector(`.draw-num-input[data-area="${area}"][data-index="${index+1}"]`); if(nextInput){ nextInput.focus(); nextInput.select(); } else this.blur(); } });
        input.addEventListener('focus', function() { this.select(); });
    });
}

function bindTodayDrawControls() {
    document.querySelectorAll('.modify-btn').forEach(btn => { btn.addEventListener('click', function() { const area=this.getAttribute('data-area'); State.drawLocked[State.currentFilterDate] = State.drawLocked[State.currentFilterDate] || {}; State.drawLocked[State.currentFilterDate][area] = false; persistAll(); const inputs = document.querySelectorAll(`.draw-num-input[data-area="${area}"]`); inputs.forEach(inp=>{inp.disabled=false;}); if (inputs.length > 0) { inputs[0].focus(); inputs[0].select(); } }); });
    document.querySelectorAll('.save-draw-btn').forEach(btn => { btn.addEventListener('click', async function() {
        const area = this.getAttribute('data-area');
        const inputs = document.querySelectorAll(`.draw-num-input[data-area="${area}"]`);
        const nums = [], shengs = [];
        const seenNums = new Set();
        let hasDuplicate = false;
        let hasAnyNumber = false;
        inputs.forEach(inp => { const val = inp.value.trim(); const padded = val.length===1?'0'+val:val; if (padded && /^\d{2}$/.test(padded)) { hasAnyNumber = true; if (seenNums.has(padded)) { hasDuplicate = true; } seenNums.add(padded); } nums.push(padded); shengs.push(getShengByNum(val)||''); });
        if (!hasAnyNumber) { showAlert('请输入开奖号码'); return; }
        if (hasDuplicate) { showAlert('开奖号码不能重复，请检查。'); return; }
        if (!State.drawData[State.currentFilterDate]) State.drawData[State.currentFilterDate] = {macau:{nums:[],shengs:[]},hongkong:{nums:[],shengs:[]},yuegang:{nums:[],shengs:[]}};
        State.drawData[State.currentFilterDate][area] = { nums, shengs };
        if (!State.drawLocked[State.currentFilterDate]) State.drawLocked[State.currentFilterDate] = {};
        State.drawLocked[State.currentFilterDate][area] = true;
        inputs.forEach(inp => { inp.disabled = true; });
        for (let i=0; i<7; i++) { const shengSpan = document.querySelector(`span.draw-sheng[data-area="${area}"][data-index="${i}"]`); if (shengSpan) { shengSpan.textContent = shengs[i]||'--'; shengSpan.style.color = getShengColorStyle(shengs[i])||'#333'; } }
        const dateStr = State.currentFilterDate; const year = dateStr.substring(0,4); const startOfYear = new Date(parseInt(year),0,1); const targetDate = new Date(dateStr); const dayOfYear = Math.floor((targetDate - startOfYear) / (1000*60*60*24)) + 1; const qihao = `${year}${String(dayOfYear).padStart(3,'0')}`; const areaNames = {macau:'澳门',hongkong:'香港',yuegang:'粤港'}; const areaName = areaNames[area]; const existIdx = State.historyRecords.findIndex(r => r.date === dateStr && r.area === areaName); const record = { qihao, date:dateStr, area:areaName, nums:nums.join(','), shengs:shengs.join(',') }; if (existIdx >= 0) { State.historyRecords[existIdx] = record; } else { State.historyRecords.push(record); }
        addOperationLog('开奖录入', `录入${areaName}开奖号码：${nums.join(',')} (${shengs.join(',')})`);
        persistAll(); switchPage(currentPage);
    }); });
}

// ========== 赔率计算器 ==========
function bindCalcButton() {
    document.getElementById('btnCalc')?.addEventListener('click', () => { const bet = parseFloat(document.getElementById('calcBet')?.value)||0; const odds = parseFloat(document.getElementById('calcOdds')?.value)||0; document.getElementById('calcResult').textContent = formatMoney(bet*odds); });
}

// ========== 录单申报人下拉框 ==========
function updateEntryReporterSelect() {
    const wrapper = document.getElementById('entryReporterSelectWrapper');
    if (!wrapper) return;
    const applicants = window.applicants || [];
    const names = applicants.map(a => a.name);
    const zs = applicants.find(a => a.name === '张三');
    const defaultVal = zs ? '张三' : (names[0] || '');
    createCustomSelect(wrapper, names, defaultVal, null);
}

function getEntryReporterSelectValue() {
    const trigger = document.querySelector('#entryReporterSelectWrapper .custom-select-trigger');
    return trigger ? trigger.textContent : '';
}

function setEntryReporterSelectValue(val) {
    const trigger = document.querySelector('#entryReporterSelectWrapper .custom-select-trigger');
    if (trigger) {
        trigger.textContent = val;
        const dropdown = document.querySelector('#entryReporterSelectWrapper .custom-select-dropdown');
        if (dropdown) {
            dropdown.querySelectorAll('.custom-select-option').forEach(o => {
                o.classList.toggle('selected', o.textContent === val);
            });
        }
    }
}

// ========== 快捷标签构建 ==========
function buildQuickTags() {
    const container = document.getElementById('quickTagsContainer');
    if (!container) return;
    const rows = [
        '各 各号 单 双 大 小 鼠 牛 虎 兔 龙 蛇 马 羊 猴 鸡 狗 猪 金 木 水 火 土',
        '红波 蓝波 绿波 红单 红双  蓝单 蓝双  绿单 绿双  单数 双数 家禽 野兽',
        '平特肖 平特尾 二连肖 三连肖 四连肖 五连肖 二连尾 三连尾 四连尾',
        '复试 二中二 三中三 五不中 六不中 七不中 八不中 九不中 十不中 十一不中 十二不中 二中特 三中二 特串 拖'
    ];
    container.innerHTML = rows.map(row => { const words = row.split(/\s+/).filter(w => w.trim()); return words.map(w => `<span class="quick-tag">${w}</span>`).join(''); }).join('<br>');
}

// ========== 存储面板更新 ==========
function updateStoragePanel() {
    const todaySet = new Set();
    for (const o of State.orderList) {
        if (o.date === State.currentFilterDate) {
            const key = (o.reporter || '未知') + '|||' + (o.orderSeq || 1);
            todaySet.add(key);
        }
    }
    const todayCount = todaySet.size;

    const dateKeys = {};
    for (const o of State.orderList) {
        const date = o.date || '';
        if (!dateKeys[date]) dateKeys[date] = new Set();
        const key = (o.reporter || '未知') + '|||' + (o.orderSeq || 1);
        dateKeys[date].add(key);
    }
    let totalOrders = 0;
    for (const date in dateKeys) {
        totalOrders += dateKeys[date].size;
    }

    const allData = {
        orders: State.orderList,
        drawData: State.drawData,
        drawLocked: State.drawLocked,
        historyRecords: State.historyRecords,
        operationLogs: State.operationLogs,
        schemes: window.schemes,
        applicants: window.applicants,
        adjustValues: State.adjustValues,
        selectedSchemeIdx: State.selectedSchemeIdx,
        yearZodiac: window.yearZodiac,
        reportedOrdersSpecial: State.reportedOrdersSpecial || [],
        reportedOrdersLianXiao: State.reportedOrdersLianXiao || [],
        reportedOrdersLianMa: State.reportedOrdersLianMa || [],
        replacePresets: getReplacePresets()
    };
    const jsonStr = JSON.stringify(allData);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const realSizeBytes = blob.size;

    let realSizeStr;
    if (realSizeBytes >= 1024 * 1024) {
        realSizeStr = (realSizeBytes / 1024 / 1024).toFixed(2) + ' MB';
    } else if (realSizeBytes >= 1024) {
        realSizeStr = (realSizeBytes / 1024).toFixed(1) + ' KB';
    } else {
        realSizeStr = realSizeBytes + ' B';
    }

    const dbStatusEl = document.getElementById('storageDbStatus');
    const todayCountEl = document.getElementById('storageTodayCount');
    const orderCountEl = document.getElementById('storageOrderCount');
    const usedEl = document.getElementById('storageUsed');
    const remainingEl = document.getElementById('storageRemaining');
    
    if (!dbStatusEl || !todayCountEl || !orderCountEl || !usedEl || !remainingEl) return;

    dbStatusEl.textContent = '正常';
    dbStatusEl.style.color = '#059669';
    todayCountEl.textContent = todayCount;
    orderCountEl.textContent = totalOrders;

    usedEl.textContent = realSizeStr;
    if (remainingEl) remainingEl.textContent = '--';
}

// ========== 订单详情总条数更新 ==========
function updateOrderGroupCount() {
    const span = document.getElementById('orderGroupCount');
    if (!span) return;
    const today = State.currentFilterDate;
    const filterRegion = State.orderDetailFilters.region;
    const filterBetType = State.orderDetailFilters.betType;
    const filterWinStatus = State.orderDetailFilters.winStatus;
    const filterRep = State.orderDetailFilters.reporter;

    let orders = State.orderList.filter(o => o.date === today);
    if (filterRegion !== '不限') orders = orders.filter(o => o.region === filterRegion);
    if (filterBetType !== '不限') orders = orders.filter(o => o.betType === filterBetType);
    if (filterWinStatus !== '不限') orders = orders.filter(o => o.winStatus === filterWinStatus);
    if (filterRep !== '不限') orders = orders.filter(o => o.reporter === filterRep);

    const reporterSeqMap = {};
    orders.forEach(o => {
        const rep = o.reporter || '未知';
        if (!reporterSeqMap[rep]) reporterSeqMap[rep] = new Set();
        reporterSeqMap[rep].add(o.orderSeq || 1);
    });
    let totalGroups = 0;
    for (const rep in reporterSeqMap) {
        totalGroups += reporterSeqMap[rep].size;
    }
    span.textContent = '共' + totalGroups + '条';
}