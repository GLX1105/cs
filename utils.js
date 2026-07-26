// ===== utils.js - 通用工具函数 =====

// 获取生肖颜色类名
function getShengColorClass(s) {
    const c = shengColorMap[s];
    return c === 'red' ? 'num-red' : c === 'blue' ? 'num-blue' : c === 'green' ? 'num-green' : '';
}

// 获取生肖颜色值
function getShengColorStyle(s) {
    const c = shengColorMap[s];
    return c === 'red' ? '#dc2626' : c === 'blue' ? '#2563eb' : c === 'green' ? '#059669' : '';
}

// 格式化金额
function formatMoney(num) {
    if (num === null || num === undefined || isNaN(num)) return '0';
    if (Number.isInteger(num)) return num.toString();
    const fixed = num.toFixed(2);
    return parseFloat(fixed).toString();
}

// 颜色类名
function colorClass(c) {
    return 'num-' + c;
}

// 号码排序
function sortedNumbers() {
    return [...numberList].sort((a, b) => parseInt(a.num) - parseInt(b.num));
}

// 设置顶部栏HTML
function setTopBar(html) {
    const el = document.getElementById('topBarArea');
    if (el) el.innerHTML = html || '';
}

// 根据号码获取生肖
function getShengByNum(numStr) {
    if (!numStr) return '';
    let n = numStr.trim();
    if (n.length === 1) n = '0' + n;
    const found = numberList.find(item => item.num === n);
    return found ? found.sheng : '';
}

// 根据号码获取颜色
function getColorByNum(numStr) {
    if (!numStr) return '';
    let n = numStr.trim();
    if (n.length === 1) n = '0' + n;
    const found = numberList.find(item => item.num === n);
    return found ? found.color : '';
}

// 构建号码球HTML（大号）
function buildBallHTML(num) {
    if (!num) return `<div class="w-10 h-10 border border-gray-300 rounded-full flex items-center justify-center text-xs text-gray-400">--</div>`;
    const color = getColorByNum(num);
    const bgClass = color === 'red' ? 'bg-red-500' : color === 'blue' ? 'bg-blue-600' : color === 'green' ? 'bg-green-600' : 'bg-gray-400';
    return `<div class="w-10 h-10 ${bgClass} text-white flex items-center justify-center font-bold text-sm rounded-full shadow-md">${num}</div>`;
}

// 构建生肖块HTML（大号）
function buildShengBlock(sheng) {
    const sc = getShengColorStyle(sheng);
    return `<div class="w-10 text-center text-sm font-bold" style="color:${sc || '#333'}">${sheng || '--'}</div>`;
}

// 构建号码球HTML（小号）
function buildSmallBallHTML(num) {
    if (!num) return `<div class="w-7 h-7 border border-gray-300 rounded-full flex items-center justify-center text-[10px] text-gray-400">--</div>`;
    const color = getColorByNum(num);
    const bgClass = color === 'red' ? 'bg-red-500' : color === 'blue' ? 'bg-blue-600' : color === 'green' ? 'bg-green-600' : 'bg-gray-400';
    return `<div class="w-7 h-7 ${bgClass} text-white flex items-center justify-center font-bold text-[10px] rounded-full shadow-sm">${num}</div>`;
}

// 构建生肖块HTML（小号）
function buildSmallShengBlock(sheng) {
    const sc = getShengColorStyle(sheng);
    return `<div class="w-7 text-center text-xs font-bold" style="color:${sc || '#333'}">${sheng || '--'}</div>`;
}

// 补齐两位数
function padTwo(numStr) {
    if (!numStr) return numStr;
    const s = String(numStr).trim();
    if (/^\d$/.test(s)) return '0' + s;
    if (/^\d{2}$/.test(s)) return s;
    return s;
}

// 中文数字转阿拉伯数字
function toNum(s) {
    if (!s) return 0;
    s = String(s).trim();
    if (/^-?\d+(\.\d+)?$/.test(s)) return parseFloat(s);
    const m = {
        '零': 0, '〇': 0, '一': 1, '壹': 1, '二': 2, '贰': 2, '两': 2,
        '三': 3, '叁': 3, '四': 4, '肆': 4, '五': 5, '伍': 5,
        '六': 6, '陆': 6, '七': 7, '柒': 7, '八': 8, '捌': 8,
        '九': 9, '玖': 9
    };
    const u = {
        '十': 10, '拾': 10, '百': 100, '佰': 100,
        '千': 1000, '仟': 1000, '万': 10000
    };
    let r = 0, c = 0, t = 0;
    for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (m[ch] !== undefined) {
            t = m[ch];
        } else if (u[ch] !== undefined) {
            const ut = u[ch];
            if (t === 0 && (ch == '十' || ch == '拾')) t = 1;
            if (ut >= 10000) {
                c = (c + t) * ut;
                r += c;
                c = 0;
            } else {
                c += t * ut;
            }
            t = 0;
        }
    }
    r += c + t;
    return r || 0;
}

// 号码排序（连字符）
function sortNDash(s) {
    const ns = s.split('-').map(n => parseInt(n)).filter(n => !isNaN(n));
    ns.sort((a, b) => a - b);
    return ns.map(n => String(n).padStart(2, '0')).join('-');
}

// 生肖排序
function sortZ(s) {
    const cs = s.split('');
    cs.sort((a, b) => ZODIAC.indexOf(a) - ZODIAC.indexOf(b));
    return cs.join('');
}

// 组合函数（已排序）
function combos(arr, k) {
    const res = [];
    function bt(st, cur) {
        if (cur.length === k) { res.push([...cur]); return; }
        for (let i = st; i < arr.length; i++) { cur.push(arr[i]); bt(i + 1, cur); cur.pop(); }
    }
    bt(0, []);
    return res;
}

// 组合函数（保持原序）
function combosNoSort(arr, k) {
    const res = [];
    function bt(st, cur) {
        if (cur.length === k) { res.push([...cur]); return; }
        for (let i = st; i < arr.length; i++) { cur.push(arr[i]); bt(i + 1, cur); cur.pop(); }
    }
    bt(0, []);
    return res;
}

// 生肖组合（排序后）
function zCombos(zStr, k) {
    const cs = zStr.split('');
    return combos(cs, k).map(c => sortZ(c.join('')));
}

// 生肖组合（保持原序）
function zCombosKeepOrder(zStr, k) {
    const cs = zStr.split('');
    return combosNoSort(cs, k).map(c => c.join(''));
}

// 尾数组合（排序后）
function tailC(tStr, k) {
    const ns = tStr.split(/[,\-，]/).filter(n => n.trim());
    return combos(ns, k).map(c => {
        const s = c.slice().sort((a, b) => parseInt(a) - parseInt(b));
        return s.map(d => d + '尾').join('-');
    });
}

// 尾数组合（保持原序）
function tailCKeepOrder(tStr, k) {
    const ns = tStr.split(/[,\-，]/).filter(n => n.trim());
    return combosNoSort(ns, k).map(c => c.join('尾-') + '尾');
}

// 生肖转号码
function zodiacToNums(zStr) {
    const ns = [];
    for (const z of zStr) {
        if (D[z]) D[z].split(/[\s,，]+/).forEach(n => ns.push(n));
    }
    return ns.sort((a, b) => parseInt(a) - parseInt(b));
}

// 提取文本中的号码
function extractNums(txt) {
    return (txt.match(/\d+/g) || []).map(n => parseInt(n)).filter(n => n >= 1 && n <= 49).map(n => String(n).padStart(2, '0'));
}

// 提取文本中的生肖
function extractZodiacs(txt) {
    return (txt.match(new RegExp(`[${ZODIAC}]`, 'g')) || []);
}

// 查找无效号码
function findInvalidNums(txt) {
    if (!txt) return [];
    const allNums = (txt.match(/\d+/g) || []).map(n => parseInt(n));
    return allNums.filter(n => n > 49);
}

// 解析括号分组
function parseGroups(info) {
    if (!info) return [];
    let clean = info.replace(/[（(）)]/g, '|').replace(/\s+/g, '|');
    clean = clean.replace(/\|+/g, '|');
    clean = clean.replace(/^\||\|$/g, '');
    const groups = clean.split('|').filter(g => g.trim());
    return groups.map(g => g.trim());
}

// 字典键转号码
function keyToAllNums(key) {
    if (!D[key]) return [];
    const val = D[key];
    if (/[鼠牛虎兔龙蛇马羊猴鸡狗猪]/.test(val)) {
        const ns = [];
        for (const z of val) {
            if (ZODIAC_NUMS[z]) {
                ZODIAC_NUMS[z].split(/[\s,，]+/).forEach(n => ns.push(n));
            }
        }
        return ns.sort((a, b) => parseInt(a) - parseInt(b));
    }
    return val.split(/[\s,，]+/).filter(n => n.trim());
}

// 判断字符串是否包含字典元素
function containsDictElement(str) {
    if (!str) return false;
    const nums = str.match(/\d+/g);
    if (nums) {
        for (const n of nums) {
            const intVal = parseInt(n);
            if (intVal >= 1 && intVal <= 49) return true;
        }
    }
    if (/[鼠牛虎兔龙蛇马羊猴鸡狗猪]/.test(str)) return true;
    if (/\d+尾/.test(str)) return true;
    const dictKeywords = ['金','木','水','火','土','红波','蓝波','绿波','红单','红双','蓝单','蓝双','绿单','绿双','单数','双数','家禽','野兽','平特肖','平特尾','连肖','连尾','二中二','三中三','不中','特码','特肖','特碰','红','蓝','绿','单','双','大','小','各','各数','各号','各组','到'];
    for (const kw of dictKeywords) {
        if (str.includes(kw)) return true;
    }
    return false;
}

// 统计行内项目数
function countItemsInLine(line) {
    const teXiaoMatch = line.match(/^特肖:(.+?)\s+各\s*(\d+)$/);
    if (teXiaoMatch) {
        const zodiacsStr = teXiaoMatch[1];
        const amt = parseInt(teXiaoMatch[2]) || 0;
        const zodiacs = zodiacsStr.split('-').map(z => z.trim()).filter(z => z);
        return { numbers: [], zodiacs: zodiacs, amount: amt, playType: '特肖', zodiacCount: zodiacs.length };
    }
    const baoMatch = line.match(/^包(.+?):(.+?)\s+各\s*(\d+)$/);
    if (baoMatch) {
        const attr = baoMatch[2].trim();
        const amt = parseInt(baoMatch[3]) || 0;
        return { numbers: [], zodiacs: [], amount: amt, playType: '包' + attr };
    }
    const tepengMatch = line.match(/^特碰:(.+?)\s+各\s*(\d+)$/);
    if (tepengMatch) {
        const content = tepengMatch[1].trim();
        const amt = parseInt(tepengMatch[2]) || 0;
        const groups = content.split(/\s+/).filter(g => g.trim());
        const nums = [];
        groups.forEach(g => {
            const cleaned = g.replace(/[()]/g, '');
            const tokens = cleaned.split('-');
            tokens.forEach(t => { if (/^\d{2}$/.test(t)) nums.push(t); });
        });
        return { numbers: nums, zodiacs: [], amount: amt, playType: '特碰' };
    }
    const newMatch = line.match(/^(.+?):(.+?)\s+(各(?:数|))\s*(\d+)$/);
    if (newMatch) {
        const playType = newMatch[1];
        const content = newMatch[2];
        const amt = parseInt(newMatch[4]) || 0;
        if (playType !== '特码') {
            return { numbers: [], zodiacs: [], amount: 0, playType };
        }
        const items = content.split('-').map(i => i.trim()).filter(i => i);
        const nums = [];
        const zods = [];
        items.forEach(item => {
            if (/^\d{2}$/.test(item) && parseInt(item) >= 1 && parseInt(item) <= 49) {
                nums.push(item);
            } else if (/^\d$/.test(item) && parseInt(item) >= 1 && parseInt(item) <= 49) {
                nums.push(item.padStart(2, '0'));
            } else if (/^[\u4e00-\u9fa5]$/.test(item) && ZODIAC_NUMS[item]) {
                zods.push(item);
                ZODIAC_NUMS[item].split(/[\s,，]+/).forEach(n => nums.push(n.padStart(2, '0')));
            } else if (D[item]) {
                const val = D[item];
                if (/[鼠牛虎兔龙蛇马羊猴鸡狗猪]/.test(val)) {
                    if (/^[\u4e00-\u9fa5]$/.test(item) && ZODIAC_NUMS[item]) {
                        zods.push(item);
                        ZODIAC_NUMS[item].split(/[\s,，]+/).forEach(n => nums.push(n.padStart(2, '0')));
                    } else {
                        for (const z of val) {
                            if (ZODIAC_NUMS[z]) {
                                zods.push(z);
                                ZODIAC_NUMS[z].split(/[\s,，]+/).forEach(n => nums.push(n.padStart(2, '0')));
                            }
                        }
                    }
                } else {
                    val.split(/[\s,，]+/).filter(n => n.trim()).forEach(n => nums.push(n.padStart(2, '0')));
                }
            }
        });
        return { numbers: nums, zodiacs: [...new Set(zods)], amount: amt, playType };
    }
    const oldMatch = line.match(/^(.+?)\s+各(?:数|)\s*(\d+)$/);
    if (oldMatch) {
        const content = oldMatch[1];
        const amt = parseInt(oldMatch[2]) || 0;
        const items = content.split('-').map(i => i.trim()).filter(i => i);
        const nums = [];
        const zods = [];
        items.forEach(item => {
            if (/^\d{2}$/.test(item) && parseInt(item) >= 1 && parseInt(item) <= 49) {
                nums.push(item);
            } else if (/^\d$/.test(item) && parseInt(item) >= 1 && parseInt(item) <= 49) {
                nums.push(item.padStart(2, '0'));
            } else if (/^[\u4e00-\u9fa5]$/.test(item) && ZODIAC_NUMS[item]) {
                zods.push(item);
                ZODIAC_NUMS[item].split(/[\s,，]+/).forEach(n => nums.push(n.padStart(2, '0')));
            } else if (D[item]) {
                const val = D[item];
                if (/[鼠牛虎兔龙蛇马羊猴鸡狗猪]/.test(val)) {
                    if (/^[\u4e00-\u9fa5]$/.test(item) && ZODIAC_NUMS[item]) {
                        zods.push(item);
                        ZODIAC_NUMS[item].split(/[\s,，]+/).forEach(n => nums.push(n.padStart(2, '0')));
                    } else {
                        for (const z of val) {
                            if (ZODIAC_NUMS[z]) {
                                zods.push(z);
                                ZODIAC_NUMS[z].split(/[\s,，]+/).forEach(n => nums.push(n.padStart(2, '0')));
                            }
                        }
                    }
                } else {
                    val.split(/[\s,，]+/).filter(n => n.trim()).forEach(n => nums.push(n.padStart(2, '0')));
                }
            }
        });
        return { numbers: nums, zodiacs: [...new Set(zods)], amount: amt };
    }
    return { numbers: [], zodiacs: [], amount: 0 };
}

// Toast 轻量提示
function showToast(message, duration = 3000) {
    let toast = document.getElementById('globalToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'globalToast';
        toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:999999;background:#1f2937;color:#fff;padding:10px 24px;border-radius:6px;font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,0.3);opacity:0;transition:opacity 0.3s;pointer-events:none;white-space:nowrap;';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = '1';
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
        toast.style.opacity = '0';
    }, duration);
}

// 操作日志记录函数
function addOperationLog(type, detail, result = '成功') {
    const now = new Date();
    const time = now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0') + ' ' +
        String(now.getHours()).padStart(2, '0') + ':' +
        String(now.getMinutes()).padStart(2, '0') + ':' +
        String(now.getSeconds()).padStart(2, '0');
    State.operationLogs.push({ time, type, detail, result });
    saveData('operationLogs', State.operationLogs);
}

// 自定义弹窗 - 确认
function showConfirm(message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        const msgEl = document.getElementById('confirmMessage');
        const okBtn = document.getElementById('confirmOk');
        const cancelBtn = document.getElementById('confirmCancel');
        msgEl.textContent = message;
        modal.style.zIndex = '1000000';
        modal.style.display = 'block';
        cancelBtn.style.display = '';
        const cleanup = () => {
            modal.style.display = 'none';
            modal.style.zIndex = '100000';
            cancelBtn.style.display = '';
            okBtn.removeEventListener('click', onOk);
            cancelBtn.removeEventListener('click', onCancel);
            document.removeEventListener('keydown', onKey);
        };
        const onOk = () => { cleanup(); resolve(true); };
        const onCancel = () => { cleanup(); resolve(false); };
        const onKey = (e) => { if (e.key === 'Enter') onOk(); if (e.key === 'Escape') onCancel(); };
        okBtn.addEventListener('click', onOk);
        cancelBtn.addEventListener('click', onCancel);
        document.addEventListener('keydown', onKey);
    });
}

// 自定义弹窗 - 提示
function showAlert(message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        const msgEl = document.getElementById('confirmMessage');
        const okBtn = document.getElementById('confirmOk');
        const cancelBtn = document.getElementById('confirmCancel');
        msgEl.textContent = message;
        modal.style.zIndex = '1000000';
        modal.style.display = 'block';
        cancelBtn.style.display = 'none';
        const cleanup = () => {
            modal.style.display = 'none';
            modal.style.zIndex = '100000';
            cancelBtn.style.display = '';
            okBtn.removeEventListener('click', onOk);
            document.removeEventListener('keydown', onKey);
        };
        const onOk = () => { cleanup(); resolve(true); };
        const onKey = (e) => { if (e.key === 'Enter') onOk(); if (e.key === 'Escape') onOk(); };
        okBtn.addEventListener('click', onOk);
        document.addEventListener('keydown', onKey);
    });
}

// 自定义弹窗 - 输入
function showPrompt(message, defaultValue) {
    return new Promise((resolve) => {
        const modal = document.getElementById('promptModal');
        const msgEl = document.getElementById('promptMessage');
        const inputEl = document.getElementById('promptInput');
        const okBtn = document.getElementById('promptOk');
        const cancelBtn = document.getElementById('promptCancel');
        msgEl.textContent = message;
        inputEl.value = defaultValue || '';
        modal.style.zIndex = '1000000';
        modal.style.display = 'block';
        inputEl.focus();
        const cleanup = () => {
            modal.style.display = 'none';
            modal.style.zIndex = '100000';
            okBtn.removeEventListener('click', onOk);
            cancelBtn.removeEventListener('click', onCancel);
            document.removeEventListener('keydown', onKey);
        };
        const onOk = () => { cleanup(); resolve(inputEl.value); };
        const onCancel = () => { cleanup(); resolve(null); };
        const onKey = (e) => { if (e.key === 'Enter') onOk(); if (e.key === 'Escape') onCancel(); };
        okBtn.addEventListener('click', onOk);
        cancelBtn.addEventListener('click', onCancel);
        document.addEventListener('keydown', onKey);
    });
}

// 构建玩法正则模式列表
function buildPlayPatterns() {
    const patterns = [];
    for (const name of PLAY_NAMES) {
        patterns.push(name);
        for (let i = 2; i <= 5; i++) patterns.push(i + name);
    }
    patterns.sort((a, b) => b.length - a.length);
    return patterns;
}

// 获取输入框
function getInputArea() {
    return document.getElementById('sourceOrderInput');
}

// 获取自定义金额后缀
function getCustomAmountSuffixes() {
    return [];
}