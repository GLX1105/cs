// ===== calculator.js - 赔率、中奖、盈亏、赔付计算 =====

// ========== 辅助函数：开奖数据获取 ==========
function getCurrentDrawData() {
    if (!State.drawData[State.currentFilterDate]) {
        State.drawData[State.currentFilterDate] = {
            macau: { nums: [], shengs: [] },
            hongkong: { nums: [], shengs: [] },
            yuegang: { nums: [], shengs: [] }
        };
    }
    return State.drawData[State.currentFilterDate];
}

function getDrawDataByDate(date) {
    if (!date) return { macau: { nums: [], shengs: [] }, hongkong: { nums: [], shengs: [] }, yuegang: { nums: [], shengs: [] } };
    if (!State.drawData[date]) {
        State.drawData[date] = {
            macau: { nums: [], shengs: [] },
            hongkong: { nums: [], shengs: [] },
            yuegang: { nums: [], shengs: [] }
        };
    }
    return State.drawData[date];
}

// ========== 号码等价表示 ==========
function getNumAllEquivalents(numStr) {
    if (!numStr) return new Set();
    const num = String(numStr).padStart(2, '0');
    const sheng = getShengByNum(num);
    const color = getColorByNum(num);
    const intNum = parseInt(num);
    const results = new Set();
    results.add(num);
    results.add(String(intNum));
    if (sheng) results.add(sheng);
    if (color) {
        const colorMap = { red: '红波', blue: '蓝波', green: '绿波' };
        results.add(colorMap[color] || '');
        results.add(color === 'red' ? '红' : color === 'blue' ? '蓝' : '绿');
    }
    if (intNum % 2 === 1) { results.add('单'); results.add('单数'); }
    else { results.add('双'); results.add('双数'); }
    if (intNum >= 25) { results.add('大'); results.add('大数'); }
    else { results.add('小'); results.add('小数'); }
    results.add(String(intNum % 10) + '尾');
    results.add(String(Math.floor(intNum / 10)) + '头');
    const wuxingMap = {
        '金': ['04','05','12','13','26','27','34','35','42','43'],
        '木': ['08','09','16','17','24','25','38','39','46','47'],
        '水': ['01','14','15','22','23','30','31','44','45'],
        '火': ['02','03','10','11','18','19','32','33','40','41','48','49'],
        '土': ['06','07','20','21','28','29','36','37']
    };
    for (const [wx, nums] of Object.entries(wuxingMap)) {
        if (nums.includes(num)) { results.add(wx); break; }
    }
    const jiaqin = ['牛','马','羊','鸡','狗','猪'];
    const yeshou = ['鼠','虎','兔','龙','蛇','猴'];
    if (sheng) {
        if (jiaqin.includes(sheng)) { results.add('家禽'); results.add('家肖'); }
        if (yeshou.includes(sheng)) { results.add('野兽'); results.add('野肖'); }
    }
    const he = Math.floor(intNum / 10) + (intNum % 10);
    results.add(he + '合');
    if (color === 'red') {
        results.add('红' + (intNum % 2 === 1 ? '单' : '双'));
        results.add('红' + (intNum >= 25 ? '大' : '小'));
    } else if (color === 'blue') {
        results.add('蓝' + (intNum % 2 === 1 ? '单' : '双'));
        results.add('蓝' + (intNum >= 25 ? '大' : '小'));
    } else if (color === 'green') {
        results.add('绿' + (intNum % 2 === 1 ? '单' : '双'));
        results.add('绿' + (intNum >= 25 ? '大' : '小'));
    }
    results.delete('');
    results.delete(undefined);
    return results;
}

function getAllDrawEquivalents(drawNums) {
    const allEq = new Set();
    if (!drawNums || !drawNums.length) return allEq;
    drawNums.forEach(num => {
        const eqs = getNumAllEquivalents(num);
        eqs.forEach(e => allEq.add(e));
    });
    const shengs = drawNums.map(n => getShengByNum(n)).filter(Boolean);
    shengs.forEach(s => allEq.add(s));
    drawNums.forEach(n => {
        const tail = String(parseInt(n) % 10);
        allEq.add(tail + '尾');
    });
    return allEq;
}

function getZhengMaEquivalents(drawNums) {
    if (!drawNums || drawNums.length < 6) return new Set();
    const zhengMa = drawNums.slice(0, 6);
    return getAllDrawEquivalents(zhengMa);
}

// ========== 获取筛选后的订单 ==========
function getFilteredOrders() {
    return State.orderList.filter(order => {
        const dateMatch = !State.currentFilterDate || order.date === State.currentFilterDate;
        const regionMatch = State.currentFilterRegion === 'all' ||
            (order.region === '澳门' && State.currentFilterRegion === 'macau') ||
            (order.region === '香港' && State.currentFilterRegion === 'hongkong') ||
            (order.region === '粤港' && State.currentFilterRegion === 'yuegang');
        return dateMatch && regionMatch;
    });
}

// ========== 各号码押注数据 ==========
function getNumberBetData() {
    const betMap = {};
    numberList.forEach(item => { betMap[item.num] = 0; });
    const filtered = getFilteredOrders();
    filtered.forEach(order => {
        if (order.betType === '特码' && order.orderInfo) {
            const tokens = order.orderInfo.split('-').map(t => t.trim());
            tokens.forEach(token => {
                if (/^\d{1,2}$/.test(token)) {
                    const n = token.length === 1 ? '0' + token : token;
                    if (betMap[n] !== undefined) betMap[n] += (parseFloat(order.amount) || 0);
                } else {
                    const nums = keyToAllNums(token);
                    nums.forEach(num => { if (betMap[num] !== undefined) betMap[num] += (parseFloat(order.amount) || 0); });
                }
            });
        }
    });
    return betMap;
}

// ========== 赔率/返水获取 ==========
function getTeMaOddsAndRebate() {
    const scheme = window.schemes[State.selectedSchemeIdx];
    if (!scheme) return { odds: 47, rebate: 0 };
    const row = scheme.rows.find(r => r.type === '特码');
    return { odds: row ? parseFloat(row.odds) : 47, rebate: row ? parseFloat(row.rebate) : 0 };
}

function getPlayOddsRebate(playType) {
    const scheme = window.schemes[State.selectedSchemeIdx];
    if (!scheme) return { odds: 1, rebate: 0 };
    const row = scheme.rows.find(r => r.type === playType);
    return { odds: row ? parseFloat(row.odds) : 1, rebate: row ? parseFloat(row.rebate) : 0 };
}

// ========== 中奖判断（已修复空值保护） ==========
function checkWin(category, orderInfo, drawNums) {
    // 增强的空值保护，避免崩溃
    if (!category || !orderInfo || !drawNums || drawNums.length < 7) return false;
    const teMa = drawNums[6];
    const zhengMa = drawNums.slice(0, 6);
    const allNums = drawNums;
    const info = orderInfo || '';

    if (category === '特码') {
        const teSheng = getShengByNum(teMa);
        const teColor = getColorByNum(teMa);
        const tokens = info.split('-').map(t => t.trim()).filter(t => t);
        return tokens.some(token => {
            if (/^\d{1,2}$/.test(token)) {
                return padTwo(token) === teMa;
            }
            if (token === teSheng) return true;
            if (token === '红波' || token === '红' || token === '蓝波' || token === '蓝' || token === '绿波' || token === '绿') {
                if (teColor === 'red' && (token === '红波' || token === '红')) return true;
                if (teColor === 'blue' && (token === '蓝波' || token === '蓝')) return true;
                if (teColor === 'green' && (token === '绿波' || token === '绿')) return true;
            }
            const teNum = parseInt(teMa);
            if ((token === '单' || token === '单数') && teNum % 2 === 1) return true;
            if ((token === '双' || token === '双数') && teNum % 2 === 0) return true;
            if ((token === '大' || token === '大数') && teNum >= 25) return true;
            if ((token === '小' || token === '小数') && teNum <= 24) return true;
            const teEq = getNumAllEquivalents(teMa);
            if (teEq.has(token)) return true;
            return false;
        });
    }

    if (category === '特肖' || category === '特肖带主肖') {
        const teSheng = getShengByNum(teMa) || '';
        const tokens = info.split('-').map(t => t.trim());
        return tokens.some(t => t === teSheng || (t === '本年肖' && teSheng === window.yearZodiac));
    }

    if (category.startsWith('包')) {
        const teSheng = getShengByNum(teMa) || '';
        const teColor = getColorByNum(teMa) || '';
        const teNum = parseInt(teMa) || 0;
        if (category === '包红波') return teColor === 'red';
        if (category === '包蓝波') return teColor === 'blue';
        if (category === '包绿波') return teColor === 'green';
        if (category === '包红单') return teColor === 'red' && teNum % 2 === 1;
        if (category === '包红双') return teColor === 'red' && teNum % 2 === 0;
        if (category === '包红大') return teColor === 'red' && teNum >= 25;
        if (category === '包红小') return teColor === 'red' && teNum <= 24;
        if (category === '包蓝单') return teColor === 'blue' && teNum % 2 === 1;
        if (category === '包蓝双') return teColor === 'blue' && teNum % 2 === 0;
        if (category === '包蓝大') return teColor === 'blue' && teNum >= 25;
        if (category === '包蓝小') return teColor === 'blue' && teNum <= 24;
        if (category === '包绿单') return teColor === 'green' && teNum % 2 === 1;
        if (category === '包绿双') return teColor === 'green' && teNum % 2 === 0;
        if (category === '包绿大') return teColor === 'green' && teNum >= 25;
        if (category === '包绿小') return teColor === 'green' && teNum <= 24;
        if (category === '包单') return teNum % 2 === 1;
        if (category === '包双') return teNum % 2 === 0;
        if (category === '包大') return teNum >= 25;
        if (category === '包小') return teNum <= 24;
        return false;
    }
    if (category === '平特肖' || category === '平特肖带主肖') {
        const drawShengs = allNums.map(n => getShengByNum(n)).filter(Boolean);
        const betShengs = info.split('-').map(t => {
            if (t.trim() === '本年肖') return window.yearZodiac;
            return t.trim();
        });
        return betShengs.some(s => drawShengs.includes(s));
    }
    if (category === '平特尾') {
        const drawTails = allNums.map(n => String(parseInt(n) % 10));
        const betTails = info.split('-').map(t => t.replace('尾', '').trim());
        return betTails.some(t => drawTails.includes(t));
    }
    if (category && (category.includes('连肖带主肖') || category.includes('连肖'))) {
        const drawShengs = allNums.map(n => getShengByNum(n)).filter(Boolean);
        const groups = parseGroups(info);
        if (groups.length === 0) {
            const zodList = info.split('-').map(z => {
                const t = z.trim();
                if (t === '本年肖') return window.yearZodiac;
                return t;
            });
            return zodList.every(z => drawShengs.includes(z));
        }
        return groups.some(g => {
            const zodList = g.split('-').map(z => {
                const t = z.trim();
                if (t === '本年肖') return window.yearZodiac;
                return t;
            });
            return zodList.length > 0 && zodList.every(z => drawShengs.includes(z));
        });
    }
    if (category && category.includes('连尾')) {
        const drawTails = allNums.map(n => String(parseInt(n) % 10));
        const groups = parseGroups(info);
        if (groups.length === 0) {
            const tailList = info.split('-').map(t => t.replace('尾', '').trim());
            return tailList.every(t => drawTails.includes(t));
        }
        return groups.some(g => {
            const tailList = g.split('-').map(t => t.replace('尾', '').trim());
            return tailList.length > 0 && tailList.every(t => drawTails.includes(t));
        });
    }
    if (category === '二中二' || category === '三中三') {
        const zhengSet = new Set(zhengMa);
        const groups = parseGroups(info);
        if (groups.length === 0) {
            const combos = info.split('-').map(n => padTwo(n.trim()));
            return combos.every(n => zhengSet.has(n));
        }
        return groups.some(g => {
            const nums = g.split('-').map(n => padTwo(n.trim()));
            return nums.length > 0 && nums.every(n => zhengSet.has(n));
        });
    }
    if (category === '特碰') {
        const groups = parseGroups(info);
        if (groups.length === 0) {
            const parts = info.split('-').map(n => padTwo(n.trim()));
            if (parts.length !== 2) return false;
            return teMa === parts[0] && zhengMa.includes(parts[1]);
        }
        return groups.some(g => {
            const parts = g.split('-').map(n => padTwo(n.trim()));
            if (parts.length !== 2) return false;
            return teMa === parts[0] && zhengMa.includes(parts[1]);
        });
    }
    if (category && category.includes('不中')) {
        const allSet = new Set(allNums);
        const groups = parseGroups(info);
        if (groups.length === 0) {
            const betNums = info.split('-').map(n => padTwo(n.trim()));
            return !betNums.some(n => allSet.has(n));
        }
        return groups.some(g => {
            const betNums = g.split('-').map(n => padTwo(n.trim()));
            return !betNums.some(n => allSet.has(n));
        });
    }
    if (category === '平码') {
        const betNums = info.split('-').map(n => padTwo(n.trim()));
        return betNums.some(n => zhengMa.includes(n));
    }
    return false;
}

// ========== 盈亏计算 ==========
function calcProfit(category, orderInfo, amount, drawNums) {
    if (!drawNums || drawNums.length < 7) return 0;
    const won = checkWin(category, orderInfo, drawNums);
    let playType = category;
    const hasYearZodiac = orderInfo.includes(window.yearZodiac) || orderInfo.includes('本年肖');
    const hasZeroTail = orderInfo.includes('0尾');
    if (category.includes('连肖') && hasYearZodiac) playType = category.replace('连肖', '连肖带主肖');
    else if (category.includes('连尾') && hasZeroTail) playType = category.replace('连尾', '连尾零尾');
    else if (category === '平特肖' && hasYearZodiac) playType = '平特肖带主肖';
    else if (category === '平特尾' && hasZeroTail) playType = '平特尾零尾';
    const { odds, rebate } = getPlayOddsRebate(playType);
    const rebateAmount = amount * (rebate / 100);
    const winAmount = won ? amount * odds : 0;
    const profit = amount - rebateAmount - winAmount;
    return Math.round(profit * 100) / 100;
}

// ========== 中奖本金计算（已修复空值保护） ==========
function calcWinPrincipal(order, drawNums) {
    if (!order || !drawNums || drawNums.length < 7) return '0';
    const betType = order.betType || '';
    const orderInfo = order.orderInfo || '';
    const unitAmount = parseFloat(order.amount) || 0;
    if (!orderInfo || unitAmount <= 0) return '0';
    const teMa = drawNums[6];
    const allNums = drawNums;
    const zhengMa = drawNums.slice(0, 6);

    let hitCount = 0;
    if (betType === '特码') {
        const tokens = orderInfo.split('-').map(t => t.trim()).filter(t => t);
        tokens.forEach(token => {
            if (/^\d{1,2}$/.test(token)) { if (padTwo(token) === teMa) hitCount++; }
            else { if (getNumAllEquivalents(teMa).has(token)) hitCount++; }
        });
    } else if (betType === '特肖' || betType === '特肖带主肖') {
        const teSheng = getShengByNum(teMa);
        const zodiacs = orderInfo.split('-');
        if (teSheng) hitCount = zodiacs.filter(z => z === teSheng || (z === '本年肖' && teSheng === window.yearZodiac)).length;
    } else if (betType === '平特肖' || betType === '平特肖带主肖') {
        const drawShengs = allNums.map(n => getShengByNum(n)).filter(Boolean);
        hitCount = orderInfo.split('-').filter(s => drawShengs.includes(s === '本年肖' ? window.yearZodiac : s)).length;
    } else if (betType === '平特尾') {
        const drawTails = allNums.map(n => String(parseInt(n) % 10));
        hitCount = orderInfo.split('-').map(t => t.replace('尾', '').trim()).filter(t => drawTails.includes(t)).length;
    } else if (betType === '平码') {
        hitCount = orderInfo.split('-').map(n => padTwo(n.trim())).filter(n => zhengMa.includes(n)).length;
    } else if (betType.includes('连肖')) {
        const drawShengs = allNums.map(n => getShengByNum(n)).filter(Boolean);
        const groups = parseGroups(orderInfo);
        groups.forEach(g => {
            const zodList = g.split('-').map(z => z === '本年肖' ? window.yearZodiac : z).filter(z => /^[鼠牛虎兔龙蛇马羊猴鸡狗猪]$/.test(z));
            if (zodList.length > 0 && zodList.every(z => drawShengs.includes(z))) hitCount++;
        });
    } else if (betType.includes('连尾')) {
        const drawTails = allNums.map(n => String(parseInt(n) % 10));
        const groups = parseGroups(orderInfo);
        groups.forEach(g => {
            const tails = g.split('-').filter(t => /^\d尾$/.test(t));
            if (tails.length > 0 && tails.every(t => drawTails.includes(t.replace('尾', '')))) hitCount++;
        });
    } else if (betType === '二中二' || betType === '三中三') {
        const groups = parseGroups(orderInfo);
        groups.forEach(g => {
            const nums = g.split('-').map(n => padTwo(n.trim()));
            if (nums.length > 0 && nums.every(n => zhengMa.includes(n))) hitCount++;
        });
    } else if (betType === '特碰') {
        const groups = parseGroups(orderInfo);
        groups.forEach(g => {
            const parts = g.split('-').map(n => padTwo(n.trim()));
            if (parts.length === 2 && parts[0] === teMa && zhengMa.includes(parts[1])) hitCount++;
        });
    } else if (betType && betType.includes('不中')) {
        hitCount = 1;
    } else if (betType && betType.startsWith('包')) {
        hitCount = 1;
    }
    return (unitAmount * hitCount).toFixed(1);
}

// ========== 订单总额计算 ==========
function calcTotalByPlayType(betType, orderInfo, amount) {
    const amt = parseFloat(amount) || 0;
    if (!betType || !orderInfo || amt <= 0) return 0;
    let cnt = 1;
    const info = orderInfo.trim();

    if (betType === '特码') {
        const tokens = info.split('-').map(t => t.trim()).filter(t => t);
        let total = 0;
        tokens.forEach(token => {
            if (/^\d{1,2}$/.test(token)) {
                total += 1;
            } else {
                const nums = keyToAllNums(token);
                total += nums.length || 1;
            }
        });
        cnt = total || 1;
    } else if (betType === '平特肖' || betType === '特肖' || betType === '平特尾' || betType === '平码') {
        cnt = info.split('-').filter(s => s.trim()).length || 1;
    } else if (betType.startsWith('包')) {
        cnt = 1;
    } else if (betType.includes('连肖') || betType.includes('连尾') || betType === '二中二' || betType === '三中三' || betType === '特碰' || betType.includes('不中')) {
        const groups = info.match(/\)/g);
        cnt = groups ? groups.length : 1;
    }
    return amt * cnt;
}

// ========== 统计函数 ==========
function calcStats(mapData, category, drawNums) {
    let maxProfit = 0, maxLoss = 0, profitCount = 0, lossCount = 0;
    const keys = Object.keys(mapData);
    if (keys.length === 0) return { maxProfit: 0, maxLoss: 0, profitCount: 0, lossCount: 0 };
    keys.forEach(key => {
        const profit = calcProfit(category || mapData[key].category, key, mapData[key].amount, drawNums);
        if (profit > 0) { profitCount++; if (profit > maxProfit) maxProfit = profit; }
        else if (profit < 0) { lossCount++; if (profit < maxLoss) maxLoss = profit; }
    });
    return { maxProfit, maxLoss, profitCount, lossCount };
}

function calcStatsByCombos(mapData, drawNums) {
    let maxProfit = 0, maxLoss = 0, profitCount = 0, lossCount = 0;
    const keys = Object.keys(mapData);
    if (keys.length === 0) return { maxProfit: 0, maxLoss: 0, profitCount: 0, lossCount: 0 };
    keys.forEach(key => {
        const data = mapData[key];
        const category = data.category;
        const amount = data.amount;
        const combos = key.split('|').filter(c => c.trim());
        if (combos.length === 0) {
            const profit = calcProfit(category, key, amount, drawNums);
            if (profit > 0) { profitCount++; if (profit > maxProfit) maxProfit = profit; }
            else if (profit < 0) { lossCount++; if (profit < maxLoss) maxLoss = profit; }
        } else {
            combos.forEach(combo => {
                const profit = calcProfit(category, combo.trim(), amount, drawNums);
                if (profit > 0) { profitCount++; if (profit > maxProfit) maxProfit = profit; }
                else if (profit < 0) { lossCount++; if (profit < maxLoss) maxLoss = profit; }
            });
        }
    });
    return { maxProfit, maxLoss, profitCount, lossCount };
}

// ========== 报告赔付计算 ==========
function computePayoutForReport(order, scheme) {
    const betType = (order.betType || '').trim();
    const winAmount = parseFloat(order.winAmount) || 0;
    if (winAmount <= 0 || !betType) return null;
    const row = scheme.rows.find(r => r.type === betType);
    const odds = row ? parseFloat(row.odds) : 1;
    const payout = winAmount * odds;
    return {
        totalWinAmount: winAmount,
        payout,
        parts: [{ type: betType, winAmount, odds, payout }]
    };
}

function processWinSplit(order, scheme, drawNums) {
    const betType = (order.betType || '').trim();
    const orderInfo = order.orderInfo || '';
    const unitAmount = parseFloat(order.amount) || 0;
    if (unitAmount <= 0 || !orderInfo) return null;
    if (!drawNums || drawNums.length < 7) return null;

    const drawShengs = drawNums.map(n => getShengByNum(n)).filter(Boolean);
    const drawTails = drawNums.map(n => String(parseInt(n) % 10));

    let normalWinAmount = 0;
    let specialWinAmount = 0;
    let normalType = betType;
    let specialType = betType;

    if (betType === '特肖' || betType === '平特肖') {
        const items = orderInfo.split('-').map(s => s.trim());
        items.forEach(item => {
            const isYear = (item === window.yearZodiac || item === '本年肖');
            const hit = drawShengs.includes(isYear ? window.yearZodiac : item);
            if (hit) {
                if (isYear) specialWinAmount += unitAmount;
                else normalWinAmount += unitAmount;
            }
        });
        if (normalWinAmount > 0) normalType = betType;
        if (specialWinAmount > 0) specialType = betType + '带主肖';
    } else if (betType === '平特尾') {
        const items = orderInfo.split('-').map(s => s.replace('尾', '').trim());
        items.forEach(item => {
            const isZero = item === '0';
            const hit = drawTails.includes(item);
            if (hit) {
                if (isZero) specialWinAmount += unitAmount;
                else normalWinAmount += unitAmount;
            }
        });
        if (normalWinAmount > 0) normalType = betType;
        if (specialWinAmount > 0) specialType = '平特尾零尾';
    } else if (betType.includes('连肖')) {
        const groups = parseGroups(orderInfo);
        groups.forEach(g => {
            const zodList = g.split('-').map(z => z.trim());
            const containsYear = zodList.some(z => z === window.yearZodiac || z === '本年肖');
            const allHit = zodList.every(z => {
                const realZ = (z === '本年肖') ? window.yearZodiac : z;
                return drawShengs.includes(realZ);
            });
            if (allHit) {
                if (containsYear) specialWinAmount += unitAmount;
                else normalWinAmount += unitAmount;
            }
        });
        const k = betType.replace('连肖', '').replace('带主肖', '');
        normalType = k + '连肖';
        specialType = k + '连肖带主肖';
    } else if (betType.includes('连尾')) {
        const groups = parseGroups(orderInfo);
        groups.forEach(g => {
            const tailList = g.split('-').map(t => t.replace('尾', '').trim());
            const containsZero = tailList.includes('0');
            const allHit = tailList.every(t => drawTails.includes(t));
            if (allHit) {
                if (containsZero) specialWinAmount += unitAmount;
                else normalWinAmount += unitAmount;
            }
        });
        const k = betType.replace('连尾', '').replace('零尾', '');
        normalType = k + '连尾';
        specialType = k + '连尾零尾';
    }

    const normalOdds = normalWinAmount > 0 ? (scheme.rows.find(r => r.type === normalType) ? parseFloat(scheme.rows.find(r => r.type === normalType).odds) : 1) : 0;
    const specialOdds = specialWinAmount > 0 ? (scheme.rows.find(r => r.type === specialType) ? parseFloat(scheme.rows.find(r => r.type === specialType).odds) : 1) : 0;
    const normalPayout = normalWinAmount * normalOdds;
    const specialPayout = specialWinAmount * specialOdds;
    const totalWinAmount = normalWinAmount + specialWinAmount;
    const totalPayout = normalPayout + specialPayout;

    if (totalWinAmount === 0) return null;

    const parts = [];
    if (normalWinAmount > 0) parts.push({ type: normalType, winAmount: normalWinAmount, odds: normalOdds, payout: normalPayout });
    if (specialWinAmount > 0) parts.push({ type: specialType, winAmount: specialWinAmount, odds: specialOdds, payout: specialPayout });

    return { totalWinAmount, payout: totalPayout, parts };
}

function getSchemeForReport(orders, firstOrder, defaultScheme) {
    const reporter = firstOrder ? firstOrder.reporter : (orders.length ? orders[0].reporter : '未知');
    const applicant = (window.applicants || []).find(a => a.name === reporter);
    let schemeName = applicant ? applicant.oddsConfig : (window.schemes[State.selectedSchemeIdx] ? window.schemes[State.selectedSchemeIdx].name : '47倍计算');
    return (window.schemes || []).find(s => s.name === schemeName) || defaultScheme;
}

// ========== 综合兑奖报告生成 ==========
function generateRegionProfitSummary(region, orderList) {
    const today = State.currentFilterDate;
    const filterRegion = State.orderDetailFilters.region;
    const filterBetType = State.orderDetailFilters.betType;
    const filterWinStatus = State.orderDetailFilters.winStatus;
    const filterRep = State.orderDetailFilters.reporter;

    let orders = orderList.filter(o => o.date === today);
    if (region !== 'all') {
        orders = orders.filter(o => o.region === region);
    }
    if (filterRegion !== '不限') {
        orders = orders.filter(o => o.region === filterRegion);
    }
    if (filterBetType !== '不限') {
        orders = orders.filter(o => o.betType === filterBetType);
    }
    if (filterWinStatus !== '不限') {
        orders = orders.filter(o => o.winStatus === filterWinStatus);
    }
    if (filterRep !== '不限') {
        orders = orders.filter(o => o.reporter === filterRep);
    }

    if (orders.length === 0) return '<div style="color:#999;">暂无数据</div>';

    const totalAmount = orders.reduce((s, o) => s + (parseFloat(o.totalAmount) || 0), 0);
    const scheme = getSchemeForReport(orders, orders[0], window.schemes[0]);
    let rebatePercent = 0;
    if (scheme && scheme.rows && scheme.rows.length > 0) {
        rebatePercent = parseFloat(scheme.rows[0].rebate) || 0;
    }
    const rebateAmount = Math.round(totalAmount * rebatePercent / 100);

    const todayDraw = getCurrentDrawData();
    const areaDrawNums = {};
    ['macau', 'hongkong', 'yuegang'].forEach(a => {
        const d = todayDraw[a];
        if (d && d.nums && d.nums.length >= 7) areaDrawNums[a] = d.nums;
    });

    const winByTypeMap = {};
    orders.forEach(o => {
        if (o.winStatus !== '中奖') return;
        const betType = (o.betType || '').trim();
        const winAmount = parseFloat(o.winAmount) || 0;
        if (winAmount <= 0 || !betType) return;

        let result = null;
        const isSplitPlay = (betType === '特肖' || betType === '平特肖' || betType.includes('连肖') || betType === '平特尾' || betType.includes('连尾'));
        if (isSplitPlay) {
            const regionKey = regionToKey(o.region);
            const drawNums = areaDrawNums[regionKey];
            if (drawNums) {
                result = processWinSplit(o, scheme, drawNums);
            }
        } else {
            result = computePayoutForReport(o, scheme);
        }

        if (!result || result.totalWinAmount === 0) return;

        result.parts.forEach(p => {
            if (p.winAmount <= 0) return;
            if (!winByTypeMap[p.type]) winByTypeMap[p.type] = { betType: p.type, details: [], totalWinAmount: 0 };
            winByTypeMap[p.type].details.push(p.winAmount);
            winByTypeMap[p.type].totalWinAmount += p.winAmount;
        });
    });

    const winByTypeOrdered = Object.values(winByTypeMap);
    winByTypeOrdered.sort((a, b) => {
        if (a.betType === '特码') return -1;
        if (b.betType === '特码') return 1;
        return 0;
    });

    let winLines = '';
    let totalPayout = 0;
    winByTypeOrdered.forEach(data => {
        const detailStrWin = data.details.map(v => formatMoney(v)).join('+') + '=' + formatMoney(data.totalWinAmount);
        const row = scheme.rows.find(r => r.type === data.betType);
        const odds = row ? parseFloat(row.odds) : 1;
        const payout = data.totalWinAmount * odds;
        totalPayout += payout;
        winLines += '<span style="user-select:none;">&emsp;&emsp;&emsp;&emsp;●&nbsp;</span>' + data.betType + ' 中: ' + detailStrWin + '——赔:<span style="color:red;">' + formatMoney(payout) + '</span><br>';
    });

    const profit = totalAmount - rebateAmount - totalPayout;
    const profitInt = Math.round(profit);
    const profitColor = profitInt >= 0 ? '#059669' : '#dc2626';
    const profitStr = '<span style="color:' + profitColor + ';">' + profitInt + '</span>';

    let html = '';
    if (region !== 'all') {
        html += region + '共计：' + formatMoney(totalAmount) + '<br>';
    } else {
        const seqSums = {};
        orders.forEach(o => {
            const seq = o.orderSeq || 1;
            if (!seqSums[seq]) seqSums[seq] = 0;
            seqSums[seq] += (parseFloat(o.totalAmount) || 0);
        });
        const seqKeys = Object.keys(seqSums).sort((a, b) => parseInt(a) - parseInt(b));
        const detailParts = seqKeys.map(seq => formatMoney(Math.round(seqSums[seq])));
        html += '金额明细：' + detailParts.join('+') + '=' + formatMoney(totalAmount) + ' (共计' + seqKeys.length + '条)<br>';
    }
    html += '订单总额：' + formatMoney(totalAmount) + '<br>';
    if (rebateAmount > 0) {
        html += '返水：' + rebateAmount + '<br>';
    }
    html += '中奖情况：<br>';
    if (winLines) {
        html += winLines;
    }
    html += '盈亏情况：' + profitStr;
    return html;
}

function generateDuijiangReport() {
    const reporterMap = {};
    State.orderList.forEach(o => {
        if (o.date !== State.currentFilterDate) return;
        const r = o.reporter || '未知';
        if (!reporterMap[r]) reporterMap[r] = [];
        reporterMap[r].push(o);
    });

    const reporters = Object.keys(reporterMap).sort();
    let html = '<div style="font-family:Courier New,Microsoft YaHei,monospace;line-height:1.8;font-weight:bold;">';
    // 顶部虚线：红色、加长
    html += '<span style="color:#dc2626;">-------------------按照申报人兑奖结果----------------------------------------------------------------</span><br>';

    const todayDraw = getCurrentDrawData();
    const areaDrawNums = {};
    ['macau', 'hongkong', 'yuegang'].forEach(a => {
        const d = todayDraw[a];
        if (d && d.nums && d.nums.length >= 7) areaDrawNums[a] = d.nums;
    });

    reporters.forEach(reporter => {
        const orders = reporterMap[reporter];
        const seqMap = {};
        orders.forEach(o => {
            const seq = o.orderSeq || 1;
            if (!seqMap[seq]) seqMap[seq] = [];
            seqMap[seq].push(o);
        });
        const seqs = Object.keys(seqMap).sort((a, b) => parseInt(a) - parseInt(b));

        const detailParts = [];
        let totalAmount = 0;
        seqs.forEach(seq => {
            const sum = seqMap[seq].reduce((s, o) => s + (parseFloat(o.totalAmount) || 0), 0);
            detailParts.push(formatMoney(sum));
            totalAmount += sum;
        });
        const detailStr = detailParts.join('+') + '=' + formatMoney(totalAmount) + ' (共计' + seqs.length + '条)';

        const applicant = (window.applicants || []).find(a => a.name === reporter);
        let reporterSchemeName = applicant ? applicant.oddsConfig : (window.schemes[State.selectedSchemeIdx] ? window.schemes[State.selectedSchemeIdx].name : '47倍计算');
        const reporterScheme = (window.schemes || []).find(s => s.name === reporterSchemeName) || window.schemes[0];
        let rebatePercent = 0;
        if (reporterScheme && reporterScheme.rows && reporterScheme.rows.length > 0) {
            rebatePercent = parseFloat(reporterScheme.rows[0].rebate) || 0;
        }
        const rebateAmount = Math.round(totalAmount * rebatePercent / 100);

        const winByTypeMap = {};
        seqs.forEach(seq => {
            const groupOrders = seqMap[seq];
            groupOrders.forEach(o => {
                if (o.winStatus !== '中奖') return;
                const betType = (o.betType || '').trim();
                const winAmount = parseFloat(o.winAmount) || 0;
                if (winAmount <= 0 || !betType) return;

                let result = null;
                const isSplitPlay = (betType === '特肖' || betType === '平特肖' || betType.includes('连肖') || betType === '平特尾' || betType.includes('连尾'));
                if (isSplitPlay) {
                    const regionKey = regionToKey(o.region);
                    const drawNums = areaDrawNums[regionKey];
                    if (drawNums) {
                        result = processWinSplit(o, reporterScheme, drawNums);
                    }
                } else {
                    result = computePayoutForReport(o, reporterScheme);
                }

                if (!result || result.totalWinAmount === 0) return;

                result.parts.forEach(p => {
                    if (p.winAmount <= 0) return;
                    if (!winByTypeMap[p.type]) winByTypeMap[p.type] = { betType: p.type, details: [], totalWinAmount: 0 };
                    winByTypeMap[p.type].details.push(p.winAmount);
                    winByTypeMap[p.type].totalWinAmount += p.winAmount;
                });
            });
        });

        const winByTypeOrdered = Object.values(winByTypeMap);
        winByTypeOrdered.sort((a, b) => {
            if (a.betType === '特码') return -1;
            if (b.betType === '特码') return 1;
            return 0;
        });

        let winLines = '';
        let totalPayout = 0;
        winByTypeOrdered.forEach(data => {
            const detailStrWin = data.details.map(v => formatMoney(v)).join('+') + '=' + formatMoney(data.totalWinAmount);
            const row = reporterScheme.rows.find(r => r.type === data.betType);
            const odds = row ? parseFloat(row.odds) : 1;
            const payout = data.totalWinAmount * odds;
            totalPayout += payout;
            // 黑点缩进对齐“情”字
            winLines += '<span style="user-select:none;">&emsp;&emsp;●&nbsp;</span>' + data.betType + ' 中: ' + detailStrWin + '——赔:<span style="color:red;">' + formatMoney(payout) + '</span><br>';
        });

        const profit = totalAmount - rebateAmount - totalPayout;
        const profitInt = Math.round(profit);
        const profitColor = profitInt >= 0 ? '#059669' : '#dc2626';
        const profitStr = '<span style="color:' + profitColor + ';">' + profitInt + '</span>';

        let shangxiaTag = '';
        if (applicant && applicant.shangxia) {
            const tagColors = {
                '澳门下家': '#e74c3c',
                '澳门上家': '#e67e22',
                '粤港下家': '#2ecc71',
                '粤港上家': '#3498db'
            };
            const color = tagColors[applicant.shangxia] || '#333';
            shangxiaTag = '<span style="color:' + color + ';font-weight:bold;">' + applicant.shangxia + '</span><br>';
        }

        html += shangxiaTag;
        html += '申报人：' + reporter + '<br>';
        html += '订单金额明细：' + detailStr + '<br>';
        html += '订单总额：<span style="color:#2563eb;font-weight:bold;">' + formatMoney(totalAmount) + '</span><br>';
        if (rebateAmount > 0) {
            html += '返水：' + rebateAmount + '<br>';
        }
        html += '中奖情况：<br>';
        if (winLines) {
            html += winLines;
        }
        html += '盈亏情况：' + profitStr + '<br>';
        // 结尾虚线：红色、加长
        html += '<span style="color:#dc2626;">-------------------' + '----------------------------------------------------------------</span><br>';
    });

    html += '</div>';
    return html;
}

function generateReporterProfitReport(reporter, selectedRegions) {
    const areaLabels = { macau: '澳门', hongkong: '香港', yuegang: '粤港' };
    let orders = State.orderList.filter(o => o.date === State.currentFilterDate && o.reporter === reporter);
    if (selectedRegions.length > 0) {
        const regionNames = selectedRegions.map(r => areaLabels[r] || '');
        orders = orders.filter(o => regionNames.includes(o.region));
    }
    if (orders.length === 0) return '<div style="color:#999;padding:10px;">该条件下无订单</div>';

    const totalAmount = orders.reduce((s, o) => s + (parseFloat(o.totalAmount) || 0), 0);
    const applicant = (window.applicants || []).find(a => a.name === reporter);
    let reporterSchemeName = applicant ? applicant.oddsConfig : (window.schemes[State.selectedSchemeIdx] ? window.schemes[State.selectedSchemeIdx].name : '47倍计算');
    const reporterScheme = (window.schemes || []).find(s => s.name === reporterSchemeName) || window.schemes[0];
    let rebatePercent = 0;
    if (reporterScheme && reporterScheme.rows && reporterScheme.rows.length > 0) {
        rebatePercent = parseFloat(reporterScheme.rows[0].rebate) || 0;
    }
    const rebateAmount = Math.round(totalAmount * rebatePercent / 100);

    const todayDraw = getCurrentDrawData();
    const areaDrawNums = {};
    ['macau', 'hongkong', 'yuegang'].forEach(a => {
        const d = todayDraw[a];
        if (d && d.nums && d.nums.length >= 7) areaDrawNums[a] = d.nums;
    });

    const winByTypeMap = {};
    orders.forEach(o => {
        if (o.winStatus !== '中奖') return;
        const betType = (o.betType || '').trim();
        const winAmount = parseFloat(o.winAmount) || 0;
        if (winAmount <= 0 || !betType) return;

        let result = null;
        const isSplitPlay = (betType === '特肖' || betType === '平特肖' || betType.includes('连肖') || betType === '平特尾' || betType.includes('连尾'));
        if (isSplitPlay) {
            const regionKey = regionToKey(o.region);
            const drawNums = areaDrawNums[regionKey];
            if (drawNums) {
                result = processWinSplit(o, reporterScheme, drawNums);
            }
        } else {
            result = computePayoutForReport(o, reporterScheme);
        }

        if (!result || result.totalWinAmount === 0) return;

        result.parts.forEach(p => {
            if (p.winAmount <= 0) return;
            if (!winByTypeMap[p.type]) winByTypeMap[p.type] = { betType: p.type, details: [], totalWinAmount: 0 };
            winByTypeMap[p.type].details.push(p.winAmount);
            winByTypeMap[p.type].totalWinAmount += p.winAmount;
        });
    });

    const winByTypeOrdered = Object.values(winByTypeMap);
    winByTypeOrdered.sort((a, b) => {
        if (a.betType === '特码') return -1;
        if (b.betType === '特码') return 1;
        return 0;
    });

    let winLines = '';
    let totalPayout = 0;
    winByTypeOrdered.forEach(data => {
        const detailStrWin = data.details.map(v => formatMoney(v)).join('+') + '=' + formatMoney(data.totalWinAmount);
        const row = reporterScheme.rows.find(r => r.type === data.betType);
        const odds = row ? parseFloat(row.odds) : 1;
        const payout = data.totalWinAmount * odds;
        totalPayout += payout;
        // 黑点缩进对齐“情”字
        winLines += '<span style="user-select:none;">&emsp;&emsp;●&nbsp;</span>' + data.betType + ' 中: <b>' + detailStrWin + '</b>——赔:<b><span style="color:red;">' + formatMoney(payout) + '</span></b><br>';
    });

    const profit = totalAmount - rebateAmount - totalPayout;
    const profitInt = Math.round(profit);
    const profitColor = profitInt >= 0 ? '#059669' : '#dc2626';
    const profitStr = '<b><span style="color:' + profitColor + ';">' + profitInt + '</span></b>';

    let html = '<div style="font-size:12px;line-height:1.5;padding:4px 0;font-weight:bold;">';
    html += '申报人：' + reporter + '<br>';
    html += '订单总额：<b><span style="color:#2563eb;">' + formatMoney(totalAmount) + '</span></b><br>';
    if (rebateAmount > 0) {
        html += '返水：<b>' + rebateAmount + '</b><br>';
    }
    html += '中奖情况：<br>';
    if (winLines) {
        html += winLines;
    }
    html += '盈亏情况：' + profitStr + '</div>';
    return html;
}

// ========== 新增：上下家汇总函数 ==========
function generateShangxiaSummary(label) {
    const today = State.currentFilterDate;
    
    // 找出所有该上下家标签的申报人名称
    const reporterNames = (window.applicants || [])
        .filter(a => a.shangxia === label)
        .map(a => a.name);
    
    if (reporterNames.length === 0) {
        return '<div style="font-weight:bold;">' + label + '<br>暂无申报人</div>';
    }
    
    // 汇总这些申报人在当前日期的所有订单
    let orders = State.orderList.filter(o => 
        o.date === today && reporterNames.includes(o.reporter || '')
    );
    
    if (orders.length === 0) {
        return '<div style="font-weight:bold;">' + label + '<br>暂无订单</div>';
    }
    
    const totalAmount = orders.reduce((s, o) => s + (parseFloat(o.totalAmount) || 0), 0);
    
    // 汇总中奖情况：相同玩法类型金额累加
    const winTypeMap = {};
    const todayDraw = getCurrentDrawData();
    const areaDrawNums = {};
    ['macau', 'hongkong', 'yuegang'].forEach(a => {
        const d = todayDraw[a];
        if (d && d.nums && d.nums.length >= 7) areaDrawNums[a] = d.nums;
    });
    
    orders.forEach(o => {
        if (o.winStatus !== '中奖') return;
        const betType = (o.betType || '').trim();
        const winAmount = parseFloat(o.winAmount) || 0;
        if (winAmount <= 0 || !betType) return;
        
        if (!winTypeMap[betType]) winTypeMap[betType] = 0;
        winTypeMap[betType] += winAmount;
    });
    
    // 计算总赔付和盈亏
    let totalPayout = 0;
    const scheme = window.schemes[State.selectedSchemeIdx] || window.schemes[0];
    Object.keys(winTypeMap).forEach(type => {
        const row = scheme.rows.find(r => r.type === type);
        const odds = row ? parseFloat(row.odds) : 1;
        totalPayout += winTypeMap[type] * odds;
    });
    
    let rebatePercent = 0;
    if (scheme && scheme.rows && scheme.rows.length > 0) {
        rebatePercent = parseFloat(scheme.rows[0].rebate) || 0;
    }
    const rebateAmount = Math.round(totalAmount * rebatePercent / 100);
    const profit = totalAmount - rebateAmount - totalPayout;
    const profitInt = Math.round(profit);
    const profitColor = profitInt >= 0 ? '#059669' : '#dc2626';
    
    // 按玩法排序（特码优先）
    const orderedTypes = Object.keys(winTypeMap).sort((a, b) => {
        if (a === '特码') return -1;
        if (b === '特码') return 1;
        return 0;
    });
    
    let winLines = '';
    orderedTypes.forEach(type => {
        // 黑点缩进对齐“情”字
        winLines += '<span style="user-select:none;">&emsp;&emsp;●&nbsp;</span>' + type + ' 中: <span style="color:red;">' + formatMoney(winTypeMap[type]) + '</span><br>';
    });
    
    // 标签颜色映射
    const tagColors = {
        '澳门下家': '#e74c3c',
        '澳门上家': '#e67e22',
        '粤港下家': '#2ecc71',
        '粤港上家': '#3498db'
    };
    const titleColor = tagColors[label] || '#333';
    
    let html = '<div style="font-weight:bold;font-size:12px;line-height:1.6;">';
    html += '<span style="color:' + titleColor + ';">' + label + '</span><br>';
    html += '订单总额：' + formatMoney(totalAmount) + '<br>';
    html += '中奖情况：<br>';
    if (winLines) {
        html += winLines;
    }
    html += '盈亏情况：<span style="color:' + profitColor + ';">' + profitInt + '</span>';
    html += '</div>';
    return html;
}

// ========== 新增：我的汇总函数（上家减下家） ==========
function generateMyShangxiaSummary(label1, label2, myLabel) {
    const today = State.currentFilterDate;
    
    const reporterNames1 = (window.applicants || [])
        .filter(a => a.shangxia === label1)
        .map(a => a.name);
    const reporterNames2 = (window.applicants || [])
        .filter(a => a.shangxia === label2)
        .map(a => a.name);
    
    let orders1 = State.orderList.filter(o => 
        o.date === today && reporterNames1.includes(o.reporter || '')
    );
    let orders2 = State.orderList.filter(o => 
        o.date === today && reporterNames2.includes(o.reporter || '')
    );
    
    const totalAmount1 = orders1.reduce((s, o) => s + (parseFloat(o.totalAmount) || 0), 0);
    const totalAmount2 = orders2.reduce((s, o) => s + (parseFloat(o.totalAmount) || 0), 0);
    const totalAmount = totalAmount1 - totalAmount2;
    
    const winTypeMap = {};
    
    orders1.forEach(o => {
        if (o.winStatus !== '中奖') return;
        const betType = (o.betType || '').trim();
        const winAmount = parseFloat(o.winAmount) || 0;
        if (winAmount <= 0 || !betType) return;
        if (!winTypeMap[betType]) winTypeMap[betType] = 0;
        winTypeMap[betType] += winAmount;
    });
    
    orders2.forEach(o => {
        if (o.winStatus !== '中奖') return;
        const betType = (o.betType || '').trim();
        const winAmount = parseFloat(o.winAmount) || 0;
        if (winAmount <= 0 || !betType) return;
        if (!winTypeMap[betType]) winTypeMap[betType] = 0;
        winTypeMap[betType] -= winAmount;
    });
    
    let totalPayout = 0;
    const scheme = window.schemes[State.selectedSchemeIdx] || window.schemes[0];
    Object.keys(winTypeMap).forEach(type => {
        const row = scheme.rows.find(r => r.type === type);
        const odds = row ? parseFloat(row.odds) : 1;
        totalPayout += winTypeMap[type] * odds;
    });
    
    let rebatePercent = 0;
    if (scheme && scheme.rows && scheme.rows.length > 0) {
        rebatePercent = parseFloat(scheme.rows[0].rebate) || 0;
    }
    const rebateAmount = Math.round(totalAmount * rebatePercent / 100);
    const profit = totalAmount - rebateAmount - totalPayout;
    const profitInt = Math.round(profit);
    const profitColor = profitInt >= 0 ? '#059669' : '#dc2626';
    
    const orderedTypes = Object.keys(winTypeMap).sort((a, b) => {
        if (a === '特码') return -1;
        if (b === '特码') return 1;
        return 0;
    });
    
    let winLines = '';
    orderedTypes.forEach(type => {
        // 黑点缩进对齐“情”字
        winLines += '<span style="user-select:none;">&emsp;&emsp;●&nbsp;</span>' + type + ' 中: <span style="color:red;">' + formatMoney(winTypeMap[type]) + '</span><br>';
    });
    
    // “我的”标题颜色：我的澳门蓝色，我的粤港绿色
    const myTitleColor = myLabel === '我的澳门' ? '#2563eb' : (myLabel === '我的粤港' ? '#059669' : '#333');
    
    let html = '<div style="font-weight:bold;font-size:12px;line-height:1.6;">';
    html += '<span style="color:' + myTitleColor + ';">' + myLabel + '</span><br>';
    html += '订单总额：' + formatMoney(totalAmount) + '<br>';
    html += '中奖情况：<br>';
    if (winLines) {
        html += winLines;
    }
    html += '盈亏情况：<span style="color:' + profitColor + ';">' + profitInt + '</span>';
    html += '</div>';
    return html;
}

// 判断是否有有效开奖数据
function hasValidDrawData() {
    const todayDraw = getCurrentDrawData();
    for (const area of ['macau', 'hongkong', 'yuegang']) {
        if (todayDraw[area] && todayDraw[area].nums && todayDraw[area].nums.length >= 7) return true;
    }
    return false;
}