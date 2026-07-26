// ===== storage.js - IndexedDB 持久化存储 =====

const DB_NAME = 'WealthyDB';
const DB_VERSION = 4;
const STORES = {
    orders: { keyPath: null, autoIncrement: true },
    adjustValues: { keyPath: 'key' },
    drawData: { keyPath: 'key' },
    drawLocked: { keyPath: 'key' },
    historyRecords: { keyPath: null, autoIncrement: true },
    operationLogs: { keyPath: null, autoIncrement: true },
    schemes: { keyPath: 'key' },
    applicants: { keyPath: 'key' },
    selectedScheme: { keyPath: 'key' },
    clipboard: { keyPath: 'key' },
    yearZodiac: { keyPath: 'key' },
    reportedOrdersSpecial: { keyPath: 'key' },
    reportedOrdersLianXiao: { keyPath: 'key' },
    reportedOrdersLianMa: { keyPath: 'key' }
};

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            const existingStores = Array.from(db.objectStoreNames);
            existingStores.forEach(storeName => {
                if (db.objectStoreNames.contains(storeName)) {
                    db.deleteObjectStore(storeName);
                }
            });
            for (const [name, config] of Object.entries(STORES)) {
                const opts = {};
                if (config.keyPath) opts.keyPath = config.keyPath;
                if (config.autoIncrement) opts.autoIncrement = true;
                db.createObjectStore(name, opts);
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

function saveData(storeName, data) {
    return openDB().then(db => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            store.clear();
            if (Array.isArray(data)) {
                data.forEach(item => store.put(item));
            } else {
                store.put(data);
            }
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e.target.error);
        });
    });
}

function loadData(storeName) {
    return openDB().then(db => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e.target.error);
        });
    });
}

async function persistAll() {
    try {
        await saveData('orders', State.orderList);
        await saveData('adjustValues', { key: 'current', data: JSON.parse(JSON.stringify(State.adjustValues)) });
        await saveData('drawData', { key: 'current', data: JSON.parse(JSON.stringify(State.drawData)) });
        await saveData('drawLocked', { key: 'current', data: JSON.parse(JSON.stringify(State.drawLocked)) });
        await saveData('historyRecords', State.historyRecords);
        await saveData('operationLogs', State.operationLogs);
        await saveData('schemes', { key: 'current', data: JSON.parse(JSON.stringify(window.schemes)) });
        await saveData('applicants', { key: 'current', data: JSON.parse(JSON.stringify(window.applicants)) });
        await saveData('selectedScheme', { key: 'current', value: State.selectedSchemeIdx });
        await saveData('clipboard', { key: 'current', data: State.clipboardData });
        await saveData('yearZodiac', { key: 'current', value: window.yearZodiac });
        await saveData('reportedOrdersSpecial', { key: 'current', data: JSON.parse(JSON.stringify(State.reportedOrdersSpecial)) });
        await saveData('reportedOrdersLianXiao', { key: 'current', data: JSON.parse(JSON.stringify(State.reportedOrdersLianXiao)) });
        await saveData('reportedOrdersLianMa', { key: 'current', data: JSON.parse(JSON.stringify(State.reportedOrdersLianMa)) });
    } catch (e) {
        console.error('IndexedDB save error:', e);
    }
}

async function restoreAll() {
    try {
        const [orders, adjust, draw, drawLock, hist, logs, schemes, applicants, selected, clipboard, yearZodiacData, repSp, repLx, repLm] = await Promise.all([
            loadData('orders'), loadData('adjustValues'), loadData('drawData'),
            loadData('drawLocked'), loadData('historyRecords'), loadData('operationLogs'), loadData('schemes'),
            loadData('applicants'), loadData('selectedScheme'), loadData('clipboard'),
            loadData('yearZodiac'), loadData('reportedOrdersSpecial'), loadData('reportedOrdersLianXiao'), loadData('reportedOrdersLianMa')
        ]);
        if (orders && orders.length) State.orderList = orders;
        if (adjust && adjust[0] && adjust[0].data) State.adjustValues = adjust[0].data;
        if (draw && draw[0] && draw[0].data) State.drawData = draw[0].data;
        if (drawLock && drawLock[0] && drawLock[0].data) State.drawLocked = drawLock[0].data;
        if (hist && hist.length) State.historyRecords = hist;
        if (logs && logs.length) State.operationLogs = logs;
        if (schemes && schemes[0] && schemes[0].data) window.schemes = schemes[0].data;
        if (applicants && applicants[0] && applicants[0].data) window.applicants = applicants[0].data;
        if (selected && selected[0] && selected[0].value !== undefined) State.selectedSchemeIdx = selected[0].value;
        if (clipboard && clipboard[0] && clipboard[0].data) State.clipboardData = clipboard[0].data;
        if (yearZodiacData && yearZodiacData[0] && yearZodiacData[0].value) window.yearZodiac = yearZodiacData[0].value;
        if (repSp && repSp[0] && repSp[0].data) State.reportedOrdersSpecial = repSp[0].data;
        if (repLx && repLx[0] && repLx[0].data) State.reportedOrdersLianXiao = repLx[0].data;
        if (repLm && repLm[0] && repLm[0].data) State.reportedOrdersLianMa = repLm[0].data;

        numberList.forEach(item => { if (!(item.num in State.adjustValues)) State.adjustValues[item.num] = 0; });
        if (State.selectedSchemeIdx >= window.schemes.length) State.selectedSchemeIdx = 0;
        State.orderList.forEach(o => {
            o.date = o.date || '';
            o.winStatus = o.winStatus || '未知';
            o.winAmount = o.winAmount || '';
            o.remark = o.remark || '';
            o.orderSeq = o.orderSeq || 1;
            o.amount = parseFloat(o.amount) || 0;
            o.totalAmount = parseFloat(o.totalAmount) || 0;
            o.batchSeq = o.batchSeq || 0;
        });
        if (!State.drawData || Object.keys(State.drawData).length === 0) State.drawData = {};
        if (!State.drawLocked || Object.keys(State.drawLocked).length === 0) State.drawLocked = {};

        // 同步 window 引用
        window.reportedOrdersSpecial = State.reportedOrdersSpecial;
        window.reportedOrdersLianXiao = State.reportedOrdersLianXiao;
        window.reportedOrdersLianMa = State.reportedOrdersLianMa;
    } catch (e) {
        console.error('IndexedDB load error:', e);
    }
}