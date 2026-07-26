// ===== config.js - 配置窗口逻辑 =====

(function initConfigModal() {
    let isConfigDirty = false;
    let configSnapshot = null;

    function takeConfigSnapshot() {
        configSnapshot = {
            schemes: JSON.parse(JSON.stringify(window.schemes)),
            applicants: JSON.parse(JSON.stringify(window.applicants)),
            selectedSchemeIdx: State.selectedSchemeIdx
        };
    }

    function restoreConfigSnapshot() {
        if (!configSnapshot) return;
        window.schemes = JSON.parse(JSON.stringify(configSnapshot.schemes));
        window.applicants = JSON.parse(JSON.stringify(configSnapshot.applicants));
        State.selectedSchemeIdx = configSnapshot.selectedSchemeIdx;
        isConfigDirty = false;
        configSnapshot = null;
    }

    function formatOddsDisplay(val) {
        if (val === null || val === undefined || isNaN(val)) return '0';
        if (Number.isInteger(val)) return val.toString();
        let s = val.toFixed(10).replace(/0+$/, '').replace(/\.$/, '');
        if (!s.includes('.')) s += '.0';
        return s;
    }

    const modal = document.getElementById('configModal');

    document.getElementById('configBtn').addEventListener('click', () => {
        takeConfigSnapshot();
        modal.style.display = 'block';
    });

    modal.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const type = this.dataset.tab;
            if (!type) return;
            modal.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            modal.querySelectorAll('.content').forEach(c => c.classList.remove('active'));
            document.getElementById(type + '-content').classList.add('active');
            if (type === 'applicant' && window.renderApplicants) window.renderApplicants();
        });
    });

    modal.querySelector('.save-config-btn').addEventListener('click', async () => {
        if (!isConfigDirty) {
            showToast('没有需要保存的修改');
            return;
        }
        const ok = await showConfirm('确定保存当前配置吗？');
        if (!ok) return;
        await persistAll();
        addOperationLog('配置修改', '保存了赔率/申报人配置');
        isConfigDirty = false;
        takeConfigSnapshot();
        showToast('保存成功');
    });

    modal.querySelector('.close-btn').addEventListener('click', async () => {
        if (isConfigDirty) {
            const ok = await showConfirm('有未保存的修改，是否保存？');
            if (ok) {
                await persistAll();
                addOperationLog('配置修改', '保存了赔率/申报人配置');
                isConfigDirty = false;
                configSnapshot = null;
            } else {
                restoreConfigSnapshot();
            }
        }
        modal.style.display = 'none';
        if (currentPage === 'orderDetail') switchPage('orderDetail');
    });

    function getDefaultRebate(name) {
        if (name === '47倍计算') return '4.00';
        const match = name.match(/(\d+)水/);
        if (match) { const n = parseFloat(match[1]); if (!isNaN(n)) return n.toFixed(2); }
        return '0.00';
    }
    function getFullRows() {
        return [
            {type:'特码',odds:'47.00',rebate:''},{type:'特肖',odds:'11.00',rebate:''},{type:'特肖带主肖',odds:'10.00',rebate:''},
            {type:'平特肖',odds:'2.00',rebate:''},{type:'平特肖带主肖',odds:'1.80',rebate:''},
            {type:'2连肖',odds:'4.00',rebate:''},{type:'2连肖带主肖',odds:'3.50',rebate:''},
            {type:'3连肖',odds:'10.00',rebate:''},{type:'3连肖带主肖',odds:'9.00',rebate:''},
            {type:'4连肖',odds:'30.00',rebate:''},{type:'4连肖带主肖',odds:'25.00',rebate:''},
            {type:'5连肖',odds:'100.00',rebate:''},{type:'5连肖带主肖',odds:'90.00',rebate:''},
            {type:'平特尾',odds:'1.80',rebate:''},{type:'平特尾零尾',odds:'2.00',rebate:''},
            {type:'2连尾',odds:'3.00',rebate:''},{type:'2连尾零尾',odds:'3.50',rebate:''},
            {type:'3连尾',odds:'6.00',rebate:''},{type:'3连尾零尾',odds:'6.50',rebate:''},
            {type:'4连尾',odds:'14.00',rebate:''},{type:'4连尾零尾',odds:'15.00',rebate:''},
            {type:'5连尾',odds:'28.00',rebate:''},{type:'5连尾零尾',odds:'30.00',rebate:''},
            {type:'5不中',odds:'2.00',rebate:''},{type:'6不中',odds:'2.50',rebate:''},
            {type:'7不中',odds:'3.00',rebate:''},{type:'8不中',odds:'3.50',rebate:''},
            {type:'9不中',odds:'4.00',rebate:''},{type:'10不中',odds:'5.00',rebate:''},
            {type:'11不中',odds:'6.00',rebate:''},{type:'12不中',odds:'7.00',rebate:''},
            {type:'二中二',odds:'60.00',rebate:''},{type:'三中三',odds:'600.00',rebate:''},
            {type:'平码',odds:'7.00',rebate:''},
            {type:'包红波',odds:'2.60',rebate:''},{type:'包蓝波',odds:'2.70',rebate:''},{type:'包绿波',odds:'2.70',rebate:''},
            {type:'包红单',odds:'5.00',rebate:''},{type:'包红双',odds:'4.70',rebate:''},
            {type:'包红大',odds:'6.00',rebate:''},{type:'包红小',odds:'4.00',rebate:''},
            {type:'包蓝单',odds:'5.00',rebate:''},{type:'包蓝双',odds:'5.00',rebate:''},
            {type:'包蓝大',odds:'4.70',rebate:''},{type:'包蓝小',odds:'6.00',rebate:''},
            {type:'包绿单',odds:'5.00',rebate:''},{type:'包绿双',odds:'5.00',rebate:''},
            {type:'包绿大',odds:'5.00',rebate:''},{type:'包绿小',odds:'6.00',rebate:''},
            {type:'包单',odds:'1.80',rebate:''},{type:'包双',odds:'1.80',rebate:''},
            {type:'包大',odds:'1.80',rebate:''},{type:'包小',odds:'1.80',rebate:''},
            {type:'包家禽',odds:'1.80',rebate:''},{type:'包野兽',odds:'1.80',rebate:''},
            {type:'特碰',odds:'120.00',rebate:''}
        ];
    }

    window.schemes = [
        {name:'47倍计算'},{name:'47倍无水'},{name:'47倍3水'},{name:'47倍4水'},
        {name:'47倍4水28'},{name:'47倍2水'},{name:'47倍3水28'}
    ].map(s => {
        const rows = getFullRows();
        const reb = getDefaultRebate(s.name);
        rows.forEach(r => r.rebate = reb);
        return { name: s.name, rows };
    });

    let currentSchemeIdx = 0;
    let selectedOddsRow = null;
    const schemeSelect = document.getElementById('scheme-select');
    const oddsTbody = document.getElementById('odds-tbody');

    function renderSchemeSelect() {
        schemeSelect.innerHTML = '';
        window.schemes.forEach((s, i) => {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = s.name;
            if (i === currentSchemeIdx) opt.selected = true;
            schemeSelect.appendChild(opt);
        });
    }

    function renderOddsTable() {
        oddsTbody.innerHTML = '';
        window.schemes[currentSchemeIdx].rows.forEach((r, idx) => {
            const tr = document.createElement('tr');
            tr.dataset.rowIndex = idx;

            const tdType = document.createElement('td');
            tdType.textContent = r.type;
            tr.appendChild(tdType);

            const tdOdds = document.createElement('td');
            const oddsSpan = document.createElement('span');
            oddsSpan.className = 'cell-text';
            oddsSpan.textContent = formatOddsDisplay(parseFloat(r.odds));
            const oddsInput = document.createElement('input');
            oddsInput.type = 'text';
            oddsInput.className = 'cell-input';
            oddsInput.value = r.odds;
            oddsSpan.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                oddsSpan.classList.add('editing');
                oddsInput.classList.add('editing');
                oddsInput.focus();
                oddsInput.select();
            });
            const saveOdds = () => {
                oddsSpan.classList.remove('editing');
                oddsInput.classList.remove('editing');
                const val = parseFloat(oddsInput.value);
                if (!isNaN(val) && val >= 0) {
                    r.odds = formatOddsDisplay(val);
                    oddsSpan.textContent = r.odds;
                } else {
                    oddsInput.value = r.odds;
                }
                isConfigDirty = true;
            };
            oddsInput.addEventListener('blur', saveOdds);
            oddsInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); saveOdds(); }
                if (e.key === 'Escape') { oddsInput.value = r.odds; oddsInput.blur(); }
            });
            tdOdds.appendChild(oddsSpan);
            tdOdds.appendChild(oddsInput);
            tr.appendChild(tdOdds);

            const tdRebate = document.createElement('td');
            const rebateSpan = document.createElement('span');
            rebateSpan.className = 'cell-text';
            rebateSpan.textContent = formatOddsDisplay(parseFloat(r.rebate)) + '%';
            const rebateInput = document.createElement('input');
            rebateInput.type = 'text';
            rebateInput.className = 'cell-input';
            rebateInput.value = r.rebate;
            rebateSpan.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                rebateSpan.classList.add('editing');
                rebateInput.classList.add('editing');
                rebateInput.focus();
                rebateInput.select();
            });
            const saveRebate = () => {
                rebateSpan.classList.remove('editing');
                rebateInput.classList.remove('editing');
                const val = parseFloat(rebateInput.value);
                if (!isNaN(val) && val >= 0 && val <= 100) {
                    r.rebate = formatOddsDisplay(val);
                    rebateSpan.textContent = r.rebate + '%';
                } else {
                    rebateInput.value = r.rebate;
                }
                isConfigDirty = true;
            };
            rebateInput.addEventListener('blur', saveRebate);
            rebateInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); saveRebate(); }
                if (e.key === 'Escape') { rebateInput.value = r.rebate; rebateInput.blur(); }
            });
            tdRebate.appendChild(rebateSpan);
            tdRebate.appendChild(rebateInput);
            tr.appendChild(tdRebate);

            oddsTbody.appendChild(tr);
        });
        selectedOddsRow = null;
    }

    oddsTbody.addEventListener('click', function(e) {
        if (e.target.closest('.cell-text') || e.target.closest('.cell-input')) return;
        const tr = e.target.closest('tr');
        if (!tr) return;
        if (selectedOddsRow) selectedOddsRow.classList.remove('selected');
        tr.classList.add('selected');
        selectedOddsRow = tr;
    });

    schemeSelect.addEventListener('change', () => {
        currentSchemeIdx = parseInt(schemeSelect.value, 10);
        renderOddsTable();
    });

    document.getElementById('btn-add-scheme').addEventListener('click', () => {
        const src = window.schemes[currentSchemeIdx];
        let newName = src.name + '_副本';
        let cnt = 1;
        while (window.schemes.some(s => s.name === newName)) newName = src.name + '_副本' + (++cnt);
        const newRows = src.rows.map(r => ({...r}));
        window.schemes.push({ name: newName, rows: newRows });
        currentSchemeIdx = window.schemes.length - 1;
        renderSchemeSelect();
        renderOddsTable();
        isConfigDirty = true;
    });

    document.getElementById('btn-del-scheme').addEventListener('click', async () => {
        if (window.schemes.length <= 1) return showAlert('至少保留一个配置方案。');
        const ok = await showConfirm(`确定删除方案"${window.schemes[currentSchemeIdx].name}"吗？`);
        if (!ok) return;
        window.schemes.splice(currentSchemeIdx, 1);
        if (currentSchemeIdx >= window.schemes.length) currentSchemeIdx = window.schemes.length - 1;
        renderSchemeSelect();
        renderOddsTable();
        isConfigDirty = true;
    });

    document.getElementById('btn-add-row').addEventListener('click', () => {
        const type = document.getElementById('input-bet-type').value.trim();
        const oddsVal = document.getElementById('input-odds').value.trim();
        const rebateVal = document.getElementById('input-rebate').value.trim();
        if (!type) return showAlert('请输入投注类型。');
        const odds = parseFloat(oddsVal);
        if (isNaN(odds) || odds < 0) return showAlert('赔率必须为有效数字。');
        let rebate = parseFloat(rebateVal);
        if (isNaN(rebate) || rebate < 0 || rebate > 100) {
            rebate = parseFloat(getDefaultRebate(window.schemes[currentSchemeIdx].name));
        }
        window.schemes[currentSchemeIdx].rows.push({
            type,
            odds: formatOddsDisplay(odds),
            rebate: formatOddsDisplay(rebate)
        });
        renderOddsTable();
        isConfigDirty = true;
        document.getElementById('input-bet-type').value = '';
        document.getElementById('input-odds').value = '';
        document.getElementById('input-rebate').value = '';
    });

    document.getElementById('btn-del-row').addEventListener('click', async () => {
        if (!selectedOddsRow) return showAlert('请先选中一行。');
        const rowIndex = parseInt(selectedOddsRow.dataset.rowIndex, 10);
        if (isNaN(rowIndex)) return;
        const typeName = window.schemes[currentSchemeIdx].rows[rowIndex].type;
        const ok = await showConfirm(`确定删除投注类型"${typeName}"吗？`);
        if (!ok) return;
        window.schemes[currentSchemeIdx].rows.splice(rowIndex, 1);
        renderOddsTable();
        isConfigDirty = true;
    });

    document.getElementById('btn-rename-confirm').addEventListener('click', () => {
        if (!document.getElementById('chk-rename').checked) return showAlert('请先勾选复选框。');
        const newName = document.getElementById('input-rename').value.trim();
        if (!newName) return showAlert('名称不能为空。');
        if (window.schemes.some(s => s.name === newName)) return showAlert('方案名称已存在。');
        window.schemes[currentSchemeIdx].name = newName;
        renderSchemeSelect();
        isConfigDirty = true;
        document.getElementById('input-rename').value = '';
        document.getElementById('chk-rename').checked = false;
        if (document.getElementById('applicant-content').classList.contains('active')) {
            window.renderApplicants();
        }
    });

    document.getElementById('btn-unify-confirm').addEventListener('click', () => {
        if (!document.getElementById('chk-unify').checked) return showAlert('请先勾选复选框。');
        const rebateStr = document.getElementById('input-unify-rebate').value.trim();
        const rebate = parseFloat(rebateStr);
        if (isNaN(rebate) || rebate < 0 || rebate > 100) return showAlert('请输入有效的返水比例（0-100）。');
        window.schemes[currentSchemeIdx].rows.forEach(r => r.rebate = formatOddsDisplay(rebate));
        renderOddsTable();
        isConfigDirty = true;
        document.getElementById('input-unify-rebate').value = '';
        document.getElementById('chk-unify').checked = false;
    });

    renderSchemeSelect();
    renderOddsTable();

    // ========== 申报人管理 ==========
    window.applicants = [];
    window.nextApplicantId = 1;
    window.selectedApplicantId = null;

    const initNames = ['张三','01群','02群','03群','04群','05群','06群','07群','08群','09群'];
    initNames.forEach(name => {
        const defaultCfg = window.schemes.length > 0 ? window.schemes[0].name : '47倍计算';
        window.applicants.push({
            id: window.nextApplicantId++,
            name,
            oddsConfig: defaultCfg,
            shangxia: '澳门下家'   // 新增字段，默认澳门下家
        });
    });

    function getAvailableSchemeNames() {
        return window.schemes.map(s => s.name);
    }

    const SHANGXIA_OPTIONS = ['澳门下家', '澳门上家', '粤港下家', '粤港上家'];

    window.renderApplicants = function() {
        const tbody = document.getElementById('applicant-tbody');
        tbody.innerHTML = '';
        const schemeNames = getAvailableSchemeNames();
        window.applicants.forEach(a => {
            const tr = document.createElement('tr');
            tr.dataset.id = a.id;
            if (a.id === window.selectedApplicantId) tr.classList.add('selected');

            // 名称单元格
            const tdName = document.createElement('td');
            const span = document.createElement('span');
            span.className = 'name-text';
            span.textContent = a.name || '（空）';
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'name-input';
            input.value = a.name;
            span.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                span.classList.add('editing');
                input.classList.add('editing');
                input.focus();
                input.select();
            });
            input.addEventListener('blur', () => {
                span.classList.remove('editing');
                input.classList.remove('editing');
                const val = input.value.trim();
                if (val && val !== a.name) {
                    if (window.applicants.some(p => p.id !== a.id && p.name === val)) {
                        showAlert('申报人名称已存在，请使用其他名称。');
                        input.value = a.name;
                        return;
                    }
                    a.name = val;
                    span.textContent = val;
                    isConfigDirty = true;
                } else {
                    input.value = a.name;
                }
            });
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') input.blur();
                if (e.key === 'Escape') { input.value = a.name; input.blur(); }
            });
            tdName.appendChild(span);
            tdName.appendChild(input);
            tr.appendChild(tdName);

            // 赔率配置单元格
            const tdOdds = document.createElement('td');
            const sel = document.createElement('select');
            const orderedOptions = schemeNames.slice();
            orderedOptions.forEach(opt => {
                const optionEl = document.createElement('option');
                optionEl.value = opt;
                optionEl.textContent = opt;
                if (opt === a.oddsConfig) optionEl.selected = true;
                sel.appendChild(optionEl);
            });
            sel.addEventListener('change', () => {
                a.oddsConfig = sel.value;
                isConfigDirty = true;
            });
            tdOdds.appendChild(sel);
            tr.appendChild(tdOdds);

            // 上下家单元格
            const tdSx = document.createElement('td');
            const sxSel = document.createElement('select');
            SHANGXIA_OPTIONS.forEach(opt => {
                const optEl = document.createElement('option');
                optEl.value = opt;
                optEl.textContent = opt;
                if (opt === (a.shangxia || '澳门下家')) optEl.selected = true;
                sxSel.appendChild(optEl);
            });
            sxSel.addEventListener('change', () => {
                a.shangxia = sxSel.value;
                isConfigDirty = true;
            });
            tdSx.appendChild(sxSel);
            tr.appendChild(tdSx);

            tbody.appendChild(tr);
        });
    };

    document.getElementById('applicant-tbody').addEventListener('click', function(e) {
        if (e.target.closest('.name-text') || e.target.closest('.name-input')) return;
        if (e.target.tagName === 'SELECT') return;
        const tr = e.target.closest('tr');
        if (!tr) return;
        const id = parseInt(tr.dataset.id, 10);
        if (isNaN(id)) return;
        if (window.selectedApplicantId === id) {
            window.selectedApplicantId = null;
        } else {
            window.selectedApplicantId = id;
        }
        window.renderApplicants();
    });

    window.deleteApplicant = async function() {
        if (window.selectedApplicantId === null) return showAlert('请先单击选中一个申报人行（蓝色高亮）。');
        const applicant = window.applicants.find(a => a.id === window.selectedApplicantId);
        if (!applicant) { window.selectedApplicantId = null; window.renderApplicants(); return; }
        const ok = await showConfirm(`确定删除申报人"${applicant.name}"吗？`);
        if (!ok) return;
        window.applicants = window.applicants.filter(a => a.id !== window.selectedApplicantId);
        window.selectedApplicantId = null;
        window.renderApplicants();
        isConfigDirty = true;
    };

    document.getElementById('btn-add-applicant').addEventListener('click', () => {
        const input = document.getElementById('new-applicant-name');
        const name = input.value.trim();
        if (!name) return showAlert('请输入申报人名称。');
        if (window.applicants.some(a => a.name === name)) {
            showAlert('申报人名称已存在，请使用其他名称。');
            return;
        }
        const defaultConfig = window.schemes.length > 0 ? window.schemes[0].name : '47倍计算';
        window.applicants.push({
            id: window.nextApplicantId++,
            name,
            oddsConfig: defaultConfig,
            shangxia: '澳门下家'   // 默认值
        });
        input.value = '';
        window.selectedApplicantId = null;
        window.renderApplicants();
        isConfigDirty = true;
    });

    document.getElementById('new-applicant-name').addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('btn-add-applicant').click();
    });

    document.getElementById('btn-delete-applicant').addEventListener('click', () => window.deleteApplicant());

    document.getElementById('btn-move-up').addEventListener('click', () => {
        if (window.selectedApplicantId === null) {
            showAlert('请先选中一个申报人。');
            return;
        }
        const idx = window.applicants.findIndex(a => a.id === window.selectedApplicantId);
        if (idx === 0) {
            showAlert('已经在最顶部，无法上移。');
            return;
        }
        if (idx > 0) {
            const item = window.applicants.splice(idx, 1)[0];
            window.applicants.splice(idx - 1, 0, item);
            window.renderApplicants();
            isConfigDirty = true;
        }
    });

    document.getElementById('btn-move-down').addEventListener('click', () => {
        if (window.selectedApplicantId === null) {
            showAlert('请先选中一个申报人。');
            return;
        }
        const idx = window.applicants.findIndex(a => a.id === window.selectedApplicantId);
        if (idx === window.applicants.length - 1) {
            showAlert('已经在最底部，无法下移。');
            return;
        }
        if (idx < window.applicants.length - 1) {
            const item = window.applicants.splice(idx, 1)[0];
            window.applicants.splice(idx + 1, 0, item);
            window.renderApplicants();
            isConfigDirty = true;
        }
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Delete' && document.getElementById('applicant-content').classList.contains('active')) {
            if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
            window.deleteApplicant();
        }
    });

    window.renderApplicants();
})();