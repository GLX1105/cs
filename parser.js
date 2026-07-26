// ===== parser.js - 订单文本解析与识别 =====

// ===== 预处理管道 =====

function step_convertFullWidth(txt) {
    return txt.replace(/[\uFF01-\uFF5E]/g, ch =>
        String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)
    ).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
     .replace(/[oO]/g, '0').replace(/[liI！!]/g, '1');
}

function step_fixTypos(txt) {
    let result = txt;
    for (const [k, v] of Object.entries(TYPO_MAP)) {
        result = result.split(k).join(v);
    }
    ['天天彩', '天天采', '天天', '天彩', '天采', '总单'].forEach(s => {
        result = result.split(s).join('');
    });
    result = result.replace(/澳门\d+期/g, '');
    return result;
}

function step_removePlayPunctuation(txt) {
    let result = txt;
    const patterns = buildPlayPatterns();
    const puncts = '[，。！？；：、,\\.\\!\\?;:]';
    for (const pattern of patterns) {
        const re = new RegExp(`(${pattern})${puncts}`, 'g');
        result = result.replace(re, '$1');
    }
    return result;
}

function step_stripAmountSuffix(txt) {
    return txt.replace(/(\d+(?:\.\d+)?)\s*(?:米|元|块|角|分|厘|眯|咪|井|#|快|斤)(?=\d|-$)/g, '$1 ');
}

function step_handleChinesePunctuation(txt) {
    let result = txt;
    result = result.replace(/(\d) ([。！？；，])/g, '$1$2');
    const moneyKwPart = `(?:${KW_LIST.join('|')})`;
    const reKw = new RegExp(`(${moneyKwPart}\\s*\\d+(?:\\.\d+)?)\\s*([。！？；，])`, 'g');
    result = result.replace(reKw, '$1\n');
    const reSuffix = new RegExp(`(\\d+(?:\\.\d+)?\\s*(?:米|元|块|角|分|厘|眯|咪|井|#|快|斤))\\s*([。！？；，])`, 'g');
    result = result.replace(reSuffix, '$1\n');
    result = result.replace(/[。！？；，]/g, ' ');
    return result;
}

function step_cleanSpecialChars(txt) {
    return txt.replace(/[^\dA-Za-z\u4e00-\u9fa5\s,\-，\=＝\.]/g, ' ');
}

function step_collapseSpaces(txt) {
    let result = txt.replace(/\n/g, '[[[NL]]]');
    result = result.replace(/[\s]{2,}/g, ' ');
    result = result.replace(/\[\[\[NL\]\]\]/g, '\n');
    return result;
}

function step_expandHeadTail(txt) {
    let result = txt;
    result = result.replace(/((?:\d[\s,，.。、+\-*＊\/\\|]*)+)头/g, (match, digits) => {
        const nums = (digits.match(/\d/g) || []);
        if (nums.length >= 2) return nums.map(n => n + '头').join('-');
        return match;
    });
    result = result.replace(/((?:\d[\s,，.。、+\-*＊\/\\|]*)+)尾/g, (match, digits) => {
        const nums = (digits.match(/\d/g) || []);
        if (nums.length >= 2) return nums.map(n => n + '尾').join('-');
        return match;
    });
    return result;
}

const preprocessPipeline = [
    step_convertFullWidth,
    step_fixTypos,
    step_removePlayPunctuation,
    step_stripAmountSuffix,
    step_handleChinesePunctuation,
    step_cleanSpecialChars,
    step_collapseSpaces,
    step_expandHeadTail,
];

function preprocess(txt) {
    let result = txt;
    for (const step of preprocessPipeline) {
        result = step(result);
    }
    return result.trim();
}

// ===== 正则常量 =====
const KW_RE_STR = `(${KW_LIST.join('|')})`;
const AMT_RE_STR = '(\\d+|[一二三四五六七八九十百千两]+)';
const SEP_CHARS = '[\\s\\-,\\.\u3001\uff0c\u3002\uff01\uff1f\uff1b\uff1a\\(\\)\\[\\]{}<>/|@#$%^&*+=]';
const SEP = SEP_CHARS + '*';
const KW_GROUP = `(${KW_LIST.join('|')})`;
const AMT_GROUP = `(${AMT_RE_STR})`;
const END_AMT_RE = `\\s*(?:(?:${KW_GROUP})\\s*)?${AMT_GROUP}`;

// ===== 辅助函数 =====
function extractAmtAndKw(matchedText) {
    let amt = 0, kw = '';
    const re = new RegExp(`(${KW_LIST.join('|')})${SEP}(${AMT_RE_STR})`, 'g');
    let m, last = null;
    while ((m = re.exec(matchedText)) !== null) { last = m; }
    if (last) { kw = last[1]; amt = toNum(last[2]); }
    else { const nums = matchedText.match(new RegExp(AMT_RE_STR, 'g')); if (nums) amt = toNum(nums[nums.length - 1]); }
    return { amt, kw };
}

// ===== 特码段解析 =====
function parseTeMaSegment(content) {
    if (!content.trim()) return null;
    const allDictKeys = Object.keys(D).filter(k => !ZODIAC.includes(k) && !/^\d+$/.test(k) && !/^\d{2}$/.test(k));
    allDictKeys.sort((a, b) => b.length - a.length);
    let remaining = content.trim();
    const tokens = [];
    const invalidNums = [];
    const zodRegex = new RegExp(`^[${ZODIAC}]`);
    while (remaining.length > 0) {
        remaining = remaining.trim();
        let matched = false;
        for (const key of allDictKeys) {
            if (remaining.startsWith(key)) {
                if (keyToAllNums(key).length > 0) tokens.push({ type: 'key', value: key });
                remaining = remaining.slice(key.length);
                matched = true; break;
            }
        }
        if (matched) continue;
        const zodMatch = remaining.match(zodRegex);
        if (zodMatch) { tokens.push({ type: 'zodiac', value: zodMatch[0] }); remaining = remaining.slice(1); continue; }
        const numMatch = remaining.match(/^(\d+)/);
        if (numMatch) {
            const nStr = numMatch[1]; const n = parseInt(nStr);
            if (n >= 1 && n <= 49) { tokens.push({ type: 'num', value: String(n) }); remaining = remaining.slice(nStr.length); continue; }
            else { invalidNums.push(nStr); remaining = remaining.slice(nStr.length); continue; }
        }
        remaining = remaining.slice(1);
    }
    if (tokens.length === 0) return null;
    const allNumsArr = []; const displayItems = [];
    for (const t of tokens) {
        if (t.type === 'num') { const padded = String(parseInt(t.value)).padStart(2, '0'); displayItems.push(padded); allNumsArr.push(padded); }
        else if (t.type === 'zodiac') { displayItems.push(t.value); const nums = ZODIAC_NUMS[t.value] ? ZODIAC_NUMS[t.value].split(/[\s,，]+/) : []; nums.forEach(n => allNumsArr.push(n)); }
        else if (t.type === 'key') { displayItems.push(t.value); const nums = keyToAllNums(t.value); nums.forEach(n => allNumsArr.push(n)); }
    }
    const cnt = allNumsArr.length;
    const warnings = invalidNums.length ? ['无效号码: ' + invalidNums.join(', ')] : [];
    return { displayItems, totalCount: cnt, warnings, allNumsArr: allNumsArr };
}

// ===== 复杂玩法匹配收集 =====
function collectSpecialMatches(text) {
    const Z = ZODIAC;
    const allMatches = [];
    function isOverlap(start, end, intervals) { return intervals.some(iv => start < iv.end && end > iv.start); }
    function itemsToNums(items) {
        const nums = [];
        for (const item of items) {
            if (/^[鼠牛虎兔龙蛇马羊猴鸡狗猪]+$/.test(item)) { for (const ch of item) { if (ZODIAC_NUMS[ch]) nums.push(...ZODIAC_NUMS[ch].split(/[\s,，]+/)); } }
            else if (/^\d+尾$/.test(item)) { const d = item.replace('尾', ''); if (D[d + '尾']) nums.push(...D[d + '尾'].split(/[\s,，]+/)); }
            else if (/^\d{1,2}$/.test(item) && parseInt(item) >= 1 && parseInt(item) <= 49) { nums.push(String(parseInt(item)).padStart(2, '0')); }
        }
        return [...new Set(nums)].sort((a, b) => parseInt(a) - parseInt(b));
    }
    function handleDragMatch(leftPart, rightPart, amt, kw, catName) {
        const leftItems = leftPart.split(new RegExp(SEP_CHARS + '+')).filter(s => s.trim());
        const rightItems = rightPart.split(new RegExp(SEP_CHARS + '+')).filter(s => s.trim());
        if (leftItems.length === 0 || rightItems.length === 0) return null;
        const leftNums = itemsToNums(leftItems); const rightNums = itemsToNums(rightItems);
        if (leftNums.length === 0 || rightNums.length === 0) return null;
        const pairs = [];
        for (const a of leftNums) { for (const b of rightNums) { if (a !== b) pairs.push(a + '-' + b); } }
        if (pairs.length === 0) return null;
        const warnings = []; if (pairs.length > 1 && !kw) warnings.push('缺少金额关键字');
        return { cat: catName || '二中二', nums: pairs, amt, cnt: pairs.length, total: amt * pairs.length, kw, warnings };
    }

    const multiMatches = []; const lockedIntervals = [];

    // 连肖匹配
    const reLianXiaoNoKw = new RegExp(`^[\\s]*((?:[${Z}]+))[\\s]*([二三四五2345两])(?:连肖|连[肖]?|肖连|肖全中|连?肖|肖中|连)[\\s]*(?:(${KW_GROUP})\\s*)?(${AMT_GROUP})\\s*$`, 'gm');
    let mLX;
    while ((mLX = reLianXiaoNoKw.exec(text)) !== null) {
        const full = mLX[0].trim();
        const zPart = mLX[1];
        const k = toNum(mLX[2].replace(/[^0-9二三四五两]/g, ''));
        if (!k || k < 2 || k > 5) continue;
        const kw = mLX[4] || '';
        const amt = toNum(mLX[5] || mLX[6]);
        if (!amt || amt <= 0) continue;
        const zChars = (zPart.match(new RegExp(`[${Z}]`, 'g')) || []).join('');
        if (zChars.length !== k) {
            const warnings = [`${zChars}：连肖数(${k})与生肖数(${zChars.length})不匹配`];
            multiMatches.push({ start: mLX.index, end: mLX.index + mLX[0].length, result: { cat: k + '连肖', nums: [], amt, cnt: 0, total: 0, kw, warnings } });
            lockedIntervals.push({ start: mLX.index, end: mLX.index + mLX[0].length });
            continue;
        }
        const comb = zCombosKeepOrder(zChars, k);
        const warnings = [];
        if (!kw && comb.length > 1) warnings.push('缺少金额关键字');
        multiMatches.push({ start: mLX.index, end: mLX.index + mLX[0].length, result: { cat: k + '连肖', nums: comb, amt, cnt: comb.length, total: amt * comb.length, kw: kw || '各组', warnings } });
        lockedIntervals.push({ start: mLX.index, end: mLX.index + mLX[0].length });
    }

    const reLianXiaoNoKw2 = new RegExp(`^[\\s]*([二三四五2345两])(?:连肖|连[肖]?|肖连|肖全中|连?肖|肖中|连)[\\s，,]*((?:[${Z}]+))\\s*(${AMT_GROUP})\\s*$`, 'gm');
    let mLX2;
    while ((mLX2 = reLianXiaoNoKw2.exec(text)) !== null) {
        if (isOverlap(mLX2.index, mLX2.index + mLX2[0].length, lockedIntervals)) continue;
        const k = toNum(mLX2[1].replace(/[^0-9二三四五两]/g, ''));
        if (!k || k < 2 || k > 5) continue;
        const zPart = mLX2[2];
        const amt = toNum(mLX2[3] || mLX2[4]);
        if (!amt || amt <= 0) continue;
        const zChars = (zPart.match(new RegExp(`[${Z}]`, 'g')) || []).join('');
        if (zChars.length !== k) {
            const warnings = [`${zChars}：连肖数(${k})与生肖数(${zChars.length})不匹配`];
            multiMatches.push({ start: mLX2.index, end: mLX2.index + mLX2[0].length, result: { cat: k + '连肖', nums: [], amt, cnt: 0, total: 0, kw: '', warnings } });
            lockedIntervals.push({ start: mLX2.index, end: mLX2.index + mLX2[0].length });
            continue;
        }
        const comb = zCombosKeepOrder(zChars, k);
        const warnings = [];
        if (comb.length > 1) warnings.push('缺少金额关键字');
        multiMatches.push({ start: mLX2.index, end: mLX2.index + mLX2[0].length, result: { cat: k + '连肖', nums: comb, amt, cnt: comb.length, total: amt * comb.length, kw: '各组', warnings } });
        lockedIntervals.push({ start: mLX2.index, end: mLX2.index + mLX2[0].length });
    }

    const reLianXiaoNoKw3 = new RegExp(`^[\\s]*([二三四五2345两])(?:连肖|连[肖]?|肖连|肖全中|连?肖|肖中|连)[\\s]*((?:[${Z}]+))[\\s]*[\\/]?\\s*(${AMT_GROUP})\\s*$`, 'gm');
    let mLX3;
    while ((mLX3 = reLianXiaoNoKw3.exec(text)) !== null) {
        if (isOverlap(mLX3.index, mLX3.index + mLX3[0].length, lockedIntervals)) continue;
        const k = toNum(mLX3[1].replace(/[^0-9二三四五两]/g, ''));
        if (!k || k < 2 || k > 5) continue;
        const zPart = mLX3[2];
        const amt = toNum(mLX3[3] || mLX3[4]);
        if (!amt || amt <= 0) continue;
        const zChars = (zPart.match(new RegExp(`[${Z}]`, 'g')) || []).join('');
        if (zChars.length !== k) {
            const warnings = [`${zChars}：连肖数(${k})与生肖数(${zChars.length})不匹配`];
            multiMatches.push({ start: mLX3.index, end: mLX3.index + mLX3[0].length, result: { cat: k + '连肖', nums: [], amt, cnt: 0, total: 0, kw: '', warnings } });
            lockedIntervals.push({ start: mLX3.index, end: mLX3.index + mLX3[0].length });
            continue;
        }
        const comb = zCombosKeepOrder(zChars, k);
        const warnings = [];
        if (comb.length > 1) warnings.push('缺少金额关键字');
        multiMatches.push({ start: mLX3.index, end: mLX3.index + mLX3[0].length, result: { cat: k + '连肖', nums: comb, amt, cnt: comb.length, total: amt * comb.length, kw: '', warnings } });
        lockedIntervals.push({ start: mLX3.index, end: mLX3.index + mLX3[0].length });
    }

    const reMultiLX = new RegExp(`([二三四五2345两])(?:连肖|连[肖]?|肖连|肖全中|连?肖|肖中|连)${SEP}((?:[${Z}]+${SEP_CHARS}+)+[${Z}]+)[\\s]*(?=${KW_GROUP})${KW_GROUP}${SEP}${AMT_GROUP}`, 'g');
    let m;
    while ((m = reMultiLX.exec(text)) !== null) {
        if (isOverlap(m.index, m.index + m[0].length, lockedIntervals)) continue;
        const full = m[0]; const { amt, kw } = extractAmtAndKw(full); if (!amt || amt <= 0) continue;
        const k = toNum(m[1].replace(/[^0-9二三四五两]/g, '')); if (!k || k < 2 || k > 5) continue;
        const zPart = m[2]; const groups = zPart.split(new RegExp(SEP_CHARS + '+')).filter(g => g.trim().length >= k);
        if (groups.length <= 1) continue;
        const allCombos = [];
        for (const zg of groups) { const zChars = zg.trim(); if (zChars.length === k) { allCombos.push(...zCombosKeepOrder(zChars, k)); } }
        if (allCombos.length === 0) continue;
        const warnings = []; if (allCombos.length > 1 && !kw) warnings.push('缺少金额关键字');
        multiMatches.push({ start: m.index, end: m.index + m[0].length, result: { cat: k + '连肖', nums: allCombos, amt, cnt: allCombos.length, total: amt * allCombos.length, kw, warnings } });
        lockedIntervals.push({ start: m.index, end: m.index + m[0].length });
    }

    const reMultiLW = new RegExp(`([二三四五2345])(?:连尾|尾连)${SEP}((?:\\d+尾${SEP_CHARS}+)+\\d+尾)[\\s]*(?=${KW_GROUP})${KW_GROUP}${SEP}${AMT_GROUP}`, 'g');
    while ((m = reMultiLW.exec(text)) !== null) {
        if (isOverlap(m.index, m.index + m[0].length, lockedIntervals)) continue;
        const full = m[0]; const { amt, kw } = extractAmtAndKw(full); if (!amt || amt <= 0) continue;
        const k = toNum(m[1]); if (!k || k < 2 || k > 5) continue;
        const tailPart = m[2]; const groups = tailPart.split(new RegExp(SEP_CHARS + '+')).filter(g => g.trim().length > 0);
        if (groups.length <= 1) continue;
        const allCombos = [];
        for (const g of groups) { const digits = (g.match(/\d/g) || []); if (digits.length === k) { allCombos.push(...tailCKeepOrder(digits.join(','), k)); } }
        if (allCombos.length === 0) continue;
        const warnings = []; if (allCombos.length > 1 && !kw) warnings.push('缺少金额关键字');
        multiMatches.push({ start: m.index, end: m.index + m[0].length, result: { cat: k + '连尾', nums: allCombos, amt, cnt: allCombos.length, total: amt * allCombos.length, kw, warnings } });
        lockedIntervals.push({ start: m.index, end: m.index + m[0].length });
    }

    // 通用正则匹配
    const addMatch = (re, handler) => { let m; while ((m = re.exec(text)) !== null) { if (isOverlap(m.index, m.index + m[0].length, lockedIntervals)) continue; const info = handler(m); if (info) { allMatches.push({ start: m.index, end: m.index + m[0].length, result: info }); } } };

    addMatch(new RegExp(`特肖${SEP}((?:[${Z}]+${SEP_CHARS}*)+?)[\\s]*${END_AMT_RE}`, 'g'), m => {
        const full = m[0]; const { amt, kw } = extractAmtAndKw(full); if (!amt || amt <= 0) return null;
        const zPart = m[1]; const zodiacs = (zPart.match(new RegExp(`[${Z}]`, 'g')) || []); if (zodiacs.length === 0) return null;
        const warnings = []; if (zodiacs.length > 1 && !kw) warnings.push('缺少金额关键字');
        return { cat: '特肖', nums: zodiacs, amt, cnt: zodiacs.length, total: amt * zodiacs.length, kw: kw || '各', warnings };
    });

    const BAO_ATTRS = ['红波','蓝波','绿波','红单','红双','蓝单','蓝双','绿单','绿双','红大','红小','蓝大','蓝小','绿大','绿小','单','双','大','小','家禽','野兽'];
    const BAO_ATTRS_SORTED = [...BAO_ATTRS].sort((a, b) => b.length - a.length);
    addMatch(new RegExp(`包${SEP}(${BAO_ATTRS_SORTED.join('|')})\\s*(\\d+)`, 'g'), m => {
        const full = m[0]; const attr = m[1]; const amt = toNum(m[2]); if (!amt || amt <= 0) return null;
        if (full.includes('各')) return { cat: '__unrecognized__', nums: [], amt: 0, cnt: 0, total: 0, kw: '', warnings: ['包玩法不允许使用"各"关键字'], rawLine: full };
        return { cat: '包' + attr, nums: [attr], amt, cnt: 1, total: amt, kw: '各' };
    });

    addMatch(new RegExp(`特碰${SEP}((?:[${Z}]+|\\d+尾|\\d{1,2})(?:${SEP_CHARS}+(?:[${Z}]+|\\d+尾|\\d{1,2}))*)${SEP_CHARS}*(?:碰)${SEP_CHARS}*((?:[${Z}]+|\\d+尾|\\d{1,2})(?:${SEP_CHARS}+(?:[${Z}]+|\\d+尾|\\d{1,2}))*?)[\\s]*${END_AMT_RE}`, 'g'), m => { const full = m[0]; const { amt, kw } = extractAmtAndKw(full); if (!amt || amt <= 0) return null; const leftPart = m[1], rightPart = m[2]; return handleDragMatch(leftPart, rightPart, amt, kw, '特碰'); });

    addMatch(new RegExp(`[二2]中[二2]${SEP}((?:[${Z}]+|\\d+尾|\\d{1,2})(?:${SEP_CHARS}+(?:[${Z}]+|\\d+尾|\\d{1,2}))*)${SEP_CHARS}*(?:拖|托)${SEP_CHARS}*((?:[${Z}]+|\\d+尾|\\d{1,2})(?:${SEP_CHARS}+(?:[${Z}]+|\\d+尾|\\d{1,2}))*?)[\\s]*${END_AMT_RE}`, 'g'), m => { const full = m[0]; const { amt, kw } = extractAmtAndKw(full); if (!amt || amt <= 0) return null; const leftPart = m[1], rightPart = m[2]; return handleDragMatch(leftPart, rightPart, amt, kw, '二中二'); });

    addMatch(new RegExp(`复[式试]?[二2]中[二2]${SEP}((?:\\d+${SEP_CHARS}+)+\\d+)(?!${SEP_CHARS}*[拖托碰])[\\s]*${END_AMT_RE}`, 'g'), m => { const full = m[0]; const { amt, kw } = extractAmtAndKw(full); if (!amt || amt <= 0) return null; const nums = extractNums(m[1]); const invalidNums = findInvalidNums(m[1]); const warnings = invalidNums.length ? ['无效号码: ' + invalidNums.join(', ')] : []; const pairs = combosNoSort(nums, 2).map(c => c.join('-')); if (pairs.length > 1 && !kw) warnings.push('缺少金额关键字'); return { cat: '二中二', nums: pairs, amt, cnt: pairs.length, total: amt * pairs.length, kw, warnings }; });

    addMatch(new RegExp(`[二2]中[二2]${SEP}((?:\\d{1,2}${SEP_CHARS}+\\d{1,2}${SEP_CHARS}*)+)(?!${SEP_CHARS}*[拖托碰])[\\s]*${END_AMT_RE}`, 'g'), m => { const full = m[0]; const { amt, kw } = extractAmtAndKw(full); if (!amt || amt <= 0) return null; const numPart = m[1]; const invalidNums = findInvalidNums(numPart); const warnings = invalidNums.length ? ['无效号码: ' + invalidNums.join(', ')] : []; const pairs = []; const pr = new RegExp(`(\\d{1,2})${SEP_CHARS}+(\\d{1,2})`, 'g'); let pm; while ((pm = pr.exec(numPart)) !== null) { pairs.push(pm[1] + '-' + pm[2]); } if (pairs.length === 0) { const nums = extractNums(numPart); if (nums.length % 2 !== 0 || nums.length === 0) { warnings.push(`号码数(${nums.length})与二中二不匹配`); return { cat: '二中二', nums: [], amt, cnt: 0, total: 0, kw, warnings }; } const uniq = [...new Set(nums)].sort((a, b) => parseInt(a) - parseInt(b)); combosNoSort(uniq, 2).forEach(c => pairs.push(c.join('-'))); } if (pairs.length > 1 && !kw) warnings.push('缺少金额关键字'); return { cat: '二中二', nums: pairs, amt, cnt: pairs.length, total: amt * pairs.length, kw, warnings }; });

    addMatch(new RegExp(`((?:\\d{1,2}${SEP_CHARS}+\\d{1,2}${SEP_CHARS}*)+)[\\s]*([二2]中[二2]|[三3]中[三3]|特碰)[\\s]*(${KW_GROUP})${SEP}${AMT_GROUP}`, 'g'), m => {
        const full = m[0]; const { amt, kw } = extractAmtAndKw(full); if (!amt || amt <= 0) return null;
        const numPart = m[1]; const playName = m[2].trim();
        const invalidNums = findInvalidNums(numPart); const warnings = invalidNums.length ? ['无效号码: ' + invalidNums.join(', ')] : [];
        const pairs = [];
        const pr = new RegExp(`(\\d{1,2})${SEP_CHARS}+(\\d{1,2})`, 'g');
        let pm;
        while ((pm = pr.exec(numPart)) !== null) { pairs.push(pm[1] + '-' + pm[2]); }
        if (pairs.length === 0) {
            const nums = extractNums(numPart);
            if (nums.length < 2) { warnings.push(`号码数不足`); return { cat: playName, nums: [], amt, cnt: 0, total: 0, kw, warnings }; }
            if (playName === '二中二' || playName === '特碰') {
                combosNoSort(nums, 2).forEach(c => pairs.push(c.join('-')));
            } else if (playName === '三中三') {
                if (nums.length < 3) { warnings.push(`号码数不足`); return { cat: playName, nums: [], amt, cnt: 0, total: 0, kw, warnings }; }
                combosNoSort(nums, 3).forEach(c => pairs.push(c.join('-')));
            }
        }
        if (pairs.length === 0) return null;
        if (pairs.length > 1 && !kw) warnings.push('缺少金额关键字');
        return { cat: playName, nums: pairs, amt, cnt: pairs.length, total: amt * pairs.length, kw, warnings };
    });

    addMatch(new RegExp(`((?:\\d+${SEP_CHARS}+)+\\d+)[\\s]*(复[式试]?(?:[二2]中[二2]|[三3]中[三3]|特碰))[\\s]*(${KW_GROUP})${SEP}${AMT_GROUP}`, 'g'), m => {
        const full = m[0]; const { amt, kw } = extractAmtAndKw(full); if (!amt || amt <= 0) return null;
        const nums = extractNums(m[1]); const playPart = m[2].trim();
        const invalidNums = findInvalidNums(m[1]); const warnings = invalidNums.length ? ['无效号码: ' + invalidNums.join(', ')] : [];
        let cat = ''; let k = 0;
        if (/[二2]中[二2]/.test(playPart)) { cat = '二中二'; k = 2; }
        else if (/[三3]中[三3]/.test(playPart)) { cat = '三中三'; k = 3; }
        else if (/特碰/.test(playPart)) { cat = '特碰'; k = 2; }
        if (!cat || nums.length < k) { warnings.push(`号码数不足`); return { cat: cat || playPart, nums: [], amt, cnt: 0, total: 0, kw, warnings }; }
        const pairs = combosNoSort(nums, k).map(c => c.join('-'));
        if (pairs.length > 1 && !kw) warnings.push('缺少金额关键字');
        return { cat, nums: pairs, amt, cnt: pairs.length, total: amt * pairs.length, kw, warnings };
    });

    addMatch(new RegExp(`复[式试]?特碰${SEP}((?:\\d+${SEP_CHARS}+)+\\d+)(?!${SEP_CHARS}*[拖托碰])[\\s]*${END_AMT_RE}`, 'g'), m => { const full = m[0]; const { amt, kw } = extractAmtAndKw(full); if (!amt || amt <= 0) return null; const nums = extractNums(m[1]); const invalidNums = findInvalidNums(m[1]); const warnings = invalidNums.length ? ['无效号码: ' + invalidNums.join(', ')] : []; const pairs = combosNoSort(nums, 2).map(c => c.join('-')); if (pairs.length > 1 && !kw) warnings.push('缺少金额关键字'); return { cat: '特碰', nums: pairs, amt, cnt: pairs.length, total: amt * pairs.length, kw, warnings }; });
    addMatch(new RegExp(`特碰${SEP}((?:\\d{1,2}${SEP_CHARS}+\\d{1,2}${SEP_CHARS}*)+)(?!${SEP_CHARS}*[拖托碰])[\\s]*${END_AMT_RE}`, 'g'), m => { const full = m[0]; const { amt, kw } = extractAmtAndKw(full); if (!amt || amt <= 0) return null; const numPart = m[1]; const invalidNums = findInvalidNums(numPart); const warnings = invalidNums.length ? ['无效号码: ' + invalidNums.join(', ')] : []; const pairs = []; const pr = new RegExp(`(\\d{1,2})${SEP_CHARS}+(\\d{1,2})`, 'g'); let pm; while ((pm = pr.exec(numPart)) !== null) { pairs.push(pm[1] + '-' + pm[2]); } if (pairs.length === 0) { const nums = extractNums(numPart); if (nums.length % 2 !== 0 || nums.length === 0) { warnings.push(`号码数(${nums.length})与特碰不匹配`); return { cat: '特碰', nums: [], amt, cnt: 0, total: 0, kw, warnings }; } const uniq = [...new Set(nums)].sort((a, b) => parseInt(a) - parseInt(b)); combosNoSort(uniq, 2).forEach(c => pairs.push(c.join('-'))); } if (pairs.length > 1 && !kw) warnings.push('缺少金额关键字'); return { cat: '特碰', nums: pairs, amt, cnt: pairs.length, total: amt * pairs.length, kw, warnings }; });
    addMatch(new RegExp(`复[式试]?[三3]中[三3]${SEP}((?:\\d+${SEP_CHARS}+)+\\d+)[\\s]*${END_AMT_RE}`, 'g'), m => { const full = m[0]; const { amt, kw } = extractAmtAndKw(full); if (!amt || amt <= 0) return null; const nums = extractNums(m[1]); const invalidNums = findInvalidNums(m[1]); const warnings = invalidNums.length ? ['无效号码: ' + invalidNums.join(', ')] : []; const triples = combosNoSort(nums, 3).map(c => c.join('-')); if (triples.length > 1 && !kw) warnings.push('缺少金额关键字'); return { cat: '三中三', nums: triples, amt, cnt: triples.length, total: amt * triples.length, kw, warnings }; });
    addMatch(new RegExp(`[三3]中[三3]${SEP}((?:\\d{1,2}${SEP_CHARS}+\\d{1,2}${SEP_CHARS}+\\d{1,2}${SEP_CHARS}*)+)[\\s]*${END_AMT_RE}`, 'g'), m => { const full = m[0]; const { amt, kw } = extractAmtAndKw(full); if (!amt || amt <= 0) return null; const numPart = m[1]; const invalidNums = findInvalidNums(numPart); const warnings = invalidNums.length ? ['无效号码: ' + invalidNums.join(', ')] : []; const triples = []; const tr = new RegExp(`(\\d{1,2})${SEP_CHARS}+(\\d{1,2})${SEP_CHARS}+(\\d{1,2})`, 'g'); let tm; while ((tm = tr.exec(numPart)) !== null) { triples.push(tm[1] + '-' + tm[2] + '-' + tm[3]); } if (triples.length === 0) { const nums = extractNums(numPart); if (nums.length % 3 !== 0 || nums.length === 0) { warnings.push(`号码数(${nums.length})与三中三不匹配`); return { cat: '三中三', nums: [], amt, cnt: 0, total: 0, kw, warnings }; } const uniq = [...new Set(nums)].sort((a, b) => parseInt(a) - parseInt(b)); combosNoSort(uniq, 3).forEach(c => triples.push(c.join('-'))); } if (triples.length > 1 && !kw) warnings.push('缺少金额关键字'); return { cat: '三中三', nums: triples, amt, cnt: triples.length, total: amt * triples.length, kw, warnings }; });
    addMatch(new RegExp(`([二三四五2345两])(?:连肖|连[肖]?|肖连|肖全中|连?肖|肖中|连)${SEP}复[式试]?${SEP}((?:[${Z}]+))\\s*${END_AMT_RE}`, 'g'), m => { const full = m[0]; const { amt, kw } = extractAmtAndKw(full); if (!amt || amt <= 0) return null; const k = toNum(m[1].replace(/[^0-9二三四五两]/g, '')); if (!k || k < 2 || k > 5) return null; const zPart = m[2].trim(); const zChars = (zPart.match(new RegExp(`[${Z}]`, 'g')) || []).join(''); if (!zChars || zChars.length < k) return null; const comb = zCombosKeepOrder(zChars, k); const warnings = []; if (!kw) warnings.push('缺少金额关键字'); return { cat: k + '连肖', nums: comb, amt, cnt: comb.length, total: amt * comb.length, kw, warnings }; });
    addMatch(new RegExp(`((?:[${Z}]+))[\\s]*([二三四五2345两])(?:连肖|连[肖]?|肖连|肖全中|连?肖|肖中|连)${SEP}复[式试]?[\\s]*(${KW_GROUP})${SEP}${AMT_GROUP}`, 'g'), m => {
        const full = m[0];
        const { amt, kw } = extractAmtAndKw(full);
        if (!amt || amt <= 0) return null;
        const zPart = m[1];
        const k = toNum(m[2].replace(/[^0-9二三四五两]/g, ''));
        if (!k || k < 2 || k > 5) return null;
        const zChars = (zPart.match(new RegExp(`[${Z}]`, 'g')) || []).join('');
        if (zChars.length < k) return null;
        const comb = zCombosKeepOrder(zChars, k);
        if (comb.length === 0) return null;
        const warnings = [];
        if (!kw) warnings.push('缺少金额关键字');
        return { cat: k + '连肖', nums: comb, amt, cnt: comb.length, total: amt * comb.length, kw, warnings };
    });
    addMatch(new RegExp(`((?:[${Z}]+))[\\s]*(?:连肖|连[肖]?|肖连|肖全中|连?肖|肖中|连)${SEP}([二三四五2345两])\\s*${END_AMT_RE}`, 'g'), m => { const full = m[0]; const { amt, kw } = extractAmtAndKw(full); if (!amt || amt <= 0) return null; const zPart = m[1]; const zChars = (zPart.match(new RegExp(`[${Z}]`, 'g')) || []).join(''); const k = toNum(m[2].replace(/[^0-9二三四五两]/g, '')); if (!k || k < 2 || k > 5) return null; const warnings = []; const afterEnd = text.substring(m.index + m[0].length); if (!kw && /^\s*[鼠牛虎兔龙蛇马羊猴鸡狗猪]+/.test(afterEnd)) return null; if (zChars.length !== k) { warnings.push(`${zChars}：连肖数(${k})与生肖数(${zChars.length})不匹配`); return { cat: k + '连肖', nums: [], amt, cnt: 0, total: 0, kw, warnings }; } const groups = zPart.split(new RegExp(SEP_CHARS + '+')).filter(g => g.trim().length >= k); const results = []; for (const zg of groups) { results.push(...zCombosKeepOrder(zg, k)); } const cnt = results.length || 0; if (cnt > 1 && !kw) warnings.push('缺少金额关键字'); return { cat: k + '连肖', nums: results, amt, cnt, total: amt * cnt, kw, warnings }; });
    addMatch(new RegExp(`([二三四五2345])(?:连尾|尾连)${SEP}复[式试]?${SEP}((?:\\d+尾${SEP_CHARS}+)+\\d+尾)\\s*${END_AMT_RE}`, 'g'), m => { const full = m[0]; const { amt, kw } = extractAmtAndKw(full); if (!amt || amt <= 0) return null; const k = toNum(m[1]); if (!k || k < 2 || k > 5) return null; const tailPart = m[2]; const digits = (tailPart.match(/\d/g) || []); if (digits.length < k) return null; const comb = tailCKeepOrder(digits.join(','), k); const warnings = []; if (!kw) warnings.push('缺少金额关键字'); return { cat: k + '连尾', nums: comb, amt, cnt: comb.length, total: amt * comb.length, kw, warnings }; });
    addMatch(new RegExp(`((?:\\d+尾${SEP_CHARS}+)+\\d+尾)[\\s]*(?:连尾|尾连)${SEP}([二三四五2345])\\s*${END_AMT_RE}`, 'g'), m => { const full = m[0]; const { amt, kw } = extractAmtAndKw(full); if (!amt || amt <= 0) return null; const tailPart = m[1]; const digits = (tailPart.match(/\d/g) || []); const k = toNum(m[2]); if (!k || k < 2 || k > 5) return null; const warnings = []; const afterEnd = text.substring(m.index + m[0].length); if (!kw && /^\s*\d+尾/.test(afterEnd)) return null; if (digits.length !== k) { warnings.push(`${digits.map(d => d + '尾').join('')}：连尾数(${k})与尾数数量(${digits.length})不匹配`); return { cat: k + '连尾', nums: [], amt, cnt: 0, total: 0, kw, warnings }; } const comb = tailCKeepOrder(digits.join(','), k); if (comb.length > 1 && !kw) warnings.push('缺少金额关键字'); return { cat: k + '连尾', nums: comb, amt, cnt: comb.length, total: amt * comb.length, kw, warnings }; });
    addMatch(new RegExp(`复[式试]?([二三四五2345两])?(?:连肖|平连|连)${SEP}((?:[${Z}]+${SEP_CHARS}*)+)[\\s]*${END_AMT_RE}`, 'g'), m => { const full = m[0]; const { amt, kw } = extractAmtAndKw(full); if (!amt || amt <= 0) return null; const kDigit = m[1] ? toNum(m[1].replace(/[^0-9二三四五两]/g, '')) : null; const zPart = m[2].trim(); const zChars = (zPart.match(new RegExp(`[${Z}]`, 'g')) || []).join(''); if (!zChars || zChars.length < 2) return null; const k = kDigit || Math.min(zChars.length, 5); if (k < 2 || k > 5 || zChars.length < k) return null; const comb = zCombosKeepOrder(zChars, k); const warnings = []; if (comb.length > 1 && !kw) warnings.push('缺少金额关键字'); return { cat: k + '连肖', nums: comb, amt, cnt: comb.length, total: amt * comb.length, kw, warnings }; });
    addMatch(new RegExp(`复[式试]?([二三四五2345])?(?:连尾|尾连)${SEP}((?:\\d+${SEP_CHARS}*尾${SEP_CHARS}*)+)[\\s]*${END_AMT_RE}`, 'g'), m => { const full = m[0]; const { amt, kw } = extractAmtAndKw(full); if (!amt || amt <= 0) return null; const kDigit = m[1] ? toNum(m[1]) : null; const tailPart = m[2]; const digits = (tailPart.match(/\d/g) || []); const k = kDigit || Math.min(digits.length, 5); if (k < 2 || k > 5 || digits.length < k) return null; const comb = tailCKeepOrder(digits.join(','), k); const warnings = []; if (comb.length > 1 && !kw) warnings.push('缺少金额关键字'); return { cat: k + '连尾', nums: comb, amt, cnt: comb.length, total: amt * comb.length, kw, warnings }; });
    addMatch(/([五六七八九十]|十一|十二|[5-9]|1[0-2])不[中出]\s*((?:\d{1,2}[\s,\-，、./]*)+)\s*[下共买个—来=＝\/各组四各]*\s*(\d+|[一二三四五六七八九十百千两]+)/g, m => { const cn = { 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 十一: 11, 十二: 12 }; let k = cn[m[1]] || parseInt(m[1]); if (!k || k < 5 || k > 12) return null; const full = m[0]; const { amt, kw } = extractAmtAndKw(full); if (!amt || amt <= 0) return null; const nums = extractNums(m[2]); const invalidNums = findInvalidNums(m[2]); const warnings = invalidNums.length ? ['无效号码: ' + invalidNums.join(', ')] : []; if (nums.length !== k) { warnings.push(`号码数(${nums.length})与不中数(${k})不匹配`); return { cat: k + '不中', nums: [], amt, cnt: 0, total: 0, kw, warnings }; } const cbs = combos(nums, k).map(c => c.join('-')); if (cbs.length > 1 && !kw) warnings.push('缺少金额关键字'); return { cat: k + '不中', nums: cbs, amt, cnt: cbs.length, total: amt * cbs.length, kw, warnings }; });
    addMatch(new RegExp(`([二三四五2345两])(?:连肖|连[肖]?|肖连|肖全中|连?肖|肖中|连)[\\s]*((?:[${Z}]+(?:${SEP_CHARS}+[${Z}]+)*))${SEP}(?:(?=${KW_GROUP})${KW_GROUP}${SEP}${AMT_GROUP}|${END_AMT_RE})`, 'g'), m => { const full = m[0]; const { amt, kw } = extractAmtAndKw(full); if (!amt || amt <= 0) return null; const k = toNum(m[1].replace(/[^0-9二三四五两]/g, '')); if (!k || k < 2 || k > 5) return null; const zPart = m[2]; const warnings = []; const afterEnd = text.substring(m.index + m[0].length); if (!kw && /^\s*[鼠牛虎兔龙蛇马羊猴鸡狗猪]/.test(afterEnd)) return null; const groups = zPart.split(new RegExp(SEP_CHARS + '+')).filter(g => g.trim().length > 0); const validCombos = []; const invalidGroups = []; for (const g of groups) { const zs = g.trim(); if (zs.length === k) { validCombos.push(...zCombosKeepOrder(zs, k)); } else { invalidGroups.push(zs); } } if (invalidGroups.length > 0) { invalidGroups.forEach(zs => { warnings.push(`${zs}：连肖数(${k})与生肖数(${zs.length})不匹配`); }); } if (validCombos.length > 0) { const cnt = validCombos.length; if (cnt > 1 && !kw) warnings.push('缺少金额关键字'); return { cat: k + '连肖', nums: validCombos, amt, cnt, total: amt * cnt, kw, warnings }; } else { return { cat: k + '连肖', nums: [], amt, cnt: 0, total: 0, kw, warnings }; } });
    addMatch(new RegExp(`([二三四五2345])(?:连尾|尾连)[\\s]*((?:\\d+${SEP_CHARS}*尾(?:${SEP_CHARS}+\\d+${SEP_CHARS}*尾)*)+)${SEP}(?:(?=${KW_GROUP})${KW_GROUP}${SEP}${AMT_GROUP}|${END_AMT_RE})`, 'g'), m => { const full = m[0]; const { amt, kw } = extractAmtAndKw(full); if (!amt || amt <= 0) return null; const k = toNum(m[1]); if (!k || k < 2 || k > 5) return null; const tailPart = m[2]; const digits = (tailPart.match(/\d/g) || []); const warnings = []; const afterEnd = text.substring(m.index + m[0].length); if (!kw && /^\s*\d+尾/.test(afterEnd)) return null; if (digits.length !== k) { warnings.push(`${digits.map(d => d + '尾').join('')}：连尾数(${k})与尾数数量(${digits.length})不匹配`); return { cat: k + '连尾', nums: [], amt, cnt: 0, total: 0, kw, warnings }; } const comb = tailCKeepOrder(digits.join(','), k); if (comb.length > 1 && !kw) warnings.push('缺少金额关键字'); return { cat: k + '连尾', nums: comb, amt, cnt: comb.length, total: amt * comb.length, kw, warnings }; });
    addMatch(new RegExp(`(?:平特(?:一肖|肖)?|[1一]肖中|平肖|平码[肖]?|一肖|独肖)${SEP}((?:[${Z}]+${SEP_CHARS}*)+)\\s*${END_AMT_RE}`, 'g'), m => { const full = m[0]; const { amt, kw } = extractAmtAndKw(full); if (!amt || amt <= 0) return null; const zs = extractZodiacs(m[1]); const warnings = []; if (zs.length >= 2 && !kw) { warnings.push('缺少金额关键字'); } return { cat: '平特肖', nums: zs, amt, cnt: zs.length, total: amt * zs.length, kw, warnings }; });
    addMatch(new RegExp(`(?:平特(?:一尾|尾)?|平尾|尾中)${SEP}((?:\\d+尾${SEP_CHARS}*)+)\\s*${END_AMT_RE}`, 'g'), m => { const full = m[0]; const { amt, kw } = extractAmtAndKw(full); if (!amt || amt <= 0) return null; const tails = (m[1].match(/\d/g) || []).map(d => d + '尾'); const warnings = []; if (tails.length >= 2 && !kw) { warnings.push('缺少金额关键字'); } return { cat: '平特尾', nums: tails, amt, cnt: tails.length, total: amt * tails.length, kw, warnings }; });
    addMatch(new RegExp(`(?:平码|独平)${SEP}((?:\\d+${SEP_CHARS}*)+)[\\s]*${END_AMT_RE}`, 'g'), m => { const full = m[0]; const { amt, kw } = extractAmtAndKw(full); if (!amt || amt <= 0) return null; const nums = extractNums(m[1]); const invalidNums = findInvalidNums(m[1]); const warnings = invalidNums.length ? ['无效号码: ' + invalidNums.join(', ')] : []; if (nums.length > 1 && !kw) warnings.push('缺少金额关键字'); return { cat: '平码', nums, amt, cnt: nums.length, total: amt * nums.length, kw, warnings }; });

    allMatches.push(...multiMatches);
    allMatches.sort((a, b) => a.start - b.start);
    const deduped = []; let lastEnd = 0;
    for (const match of allMatches) { if (match.start >= lastEnd) { deduped.push(match); lastEnd = match.end; } }
    return deduped;
}

// ===== 单行解析 =====
function processOneLine(line, inheritedPlay = null) {
    if (!line.trim()) return [];

    const defaultSuffixes = ['米', '元', '块', '角', '分', '厘', '眯', '咪', '井', '#', '快', '斤'];
    const userSuffixes = getCustomAmountSuffixes();
    const combinedSuffixes = [...new Set([...defaultSuffixes, ...userSuffixes])];
    const suffixList = combinedSuffixes.length ? combinedSuffixes.join('|') : '';
    const suffixPattern = suffixList ? `(?:${suffixList})?` : '';
    const amtPart = `((?:\\d+|[一二三四五六七八九十百千两]+)${suffixPattern})`;
    const numPart = '(\\d{1,2})';
    const sepPart = `[\\s,\\-.。、+\\-*＊\\/\\\\|]+`;
    const pairRe = new RegExp(`^\\s*${numPart}\\s*${sepPart}\\s*${amtPart}\\s*$`);
    const pairMatch = line.match(pairRe);
    if (pairMatch) {
        const num = pairMatch[1].padStart(2, '0');
        let amtStr = pairMatch[2];
        if (suffixList) { const suffixRe = new RegExp(`(${suffixList})$`); amtStr = amtStr.replace(suffixRe, ''); }
        const amt = toNum(amtStr);
        if (parseInt(num) >= 1 && parseInt(num) <= 49 && amt > 0) {
            return [{ cat: '特码', nums: [num], amt, cnt: 1, total: amt, kw: '各', warnings: [] }];
        }
    }

    const ZODIAC_SET = new Set('鼠牛虎兔龙蛇马羊猴鸡狗猪'.split(''));

    function tryMatchTeXiao(content) {
        if (!content || !content.trim()) return null;
        if (/特码/.test(content)) return null;
        if (/号各|号\s*各/.test(content)) return null;
        const trimmed = content.trim();
        const shxMatch = trimmed.match(new RegExp(`(.+?)(各肖|各(?!数|号|组|码|注|下|买))\\s*(\\d+)`));
        if (!shxMatch) return null;
        const rawContent = shxMatch[1]; const amtRaw = parseInt(shxMatch[3]) || 0; const kw = shxMatch[2] || '';
        if (amtRaw <= 0) return null;
        if (kw && kw.includes('号')) return null;
        const zodiacChars = []; for (const ch of rawContent) { if (ZODIAC_SET.has(ch)) zodiacChars.push(ch); }
        if (zodiacChars.length > 0) { const cnt = zodiacChars.length; const total = amtRaw * cnt; const warnings = []; if (cnt > 1 && !kw) warnings.push('缺少金额关键字'); return { cat: '特肖', nums: zodiacChars, amt: amtRaw, cnt: cnt, total: total, kw: kw || '各', warnings }; }
        return null;
    }

    const specialMatches = collectSpecialMatches(line);
    const results = [];
    let lastEnd = 0;

    for (const m of specialMatches) {
        if (m.start > lastEnd) {
            const content = line.substring(lastEnd, m.start);
            let subLast = 0;
            const kwReLocal = new RegExp(`(${KW_LIST.join('|')})\\s*(${AMT_RE_STR})`, 'g');
            let subMatch;
            while ((subMatch = kwReLocal.exec(content)) !== null) {
                const subContent = content.substring(subLast, subMatch.index);

                if (subContent.includes('到') || (subMatch[0] && subMatch[0].includes('到'))) {
                    const combined = subContent + (subMatch ? subMatch[0] : '');
                    const rangeMatch = combined.match(/(\d{1,2})\s*到\s*(\d{1,2})/);
                    if (rangeMatch) {
                        const start = parseInt(rangeMatch[1]); const end = parseInt(rangeMatch[2]);
                        const amt = toNum(subMatch[2]); const kw = subMatch[1];
                        if (!kw) { results.push({ cat: '__unrecognized__', nums: [], amt: 0, cnt: 0, total: 0, kw: '', warnings: ['缺少金额关键字'], rawLine: combined.trim() }); }
                        else if (start >= 1 && end <= 49 && start <= end) { const nums = []; for (let i = start; i <= end; i++) { nums.push(String(i).padStart(2, '0')); } results.push({ cat: '特码', nums: nums, amt: amt, cnt: nums.length, total: amt * nums.length, kw: kw, warnings: [] }); }
                        else { results.push({ cat: '__unrecognized__', nums: [], amt: 0, cnt: 0, total: 0, kw: '', warnings: ['号码范围无效，请检查'], rawLine: combined.trim() }); }
                        subLast = subMatch.index + subMatch[0].length; continue;
                    }
                }

                const teXiaoResult = tryMatchTeXiao(subContent + subMatch[0]);
                if (teXiaoResult) { results.push(teXiaoResult); }
                else { const seg = parseTeMaSegment(subContent); if (seg) { const amt = toNum(subMatch[2]); const kw = subMatch[1]; const cnt = seg.allNumsArr ? seg.allNumsArr.length : seg.totalCount; results.push({ cat: '特码', nums: seg.displayItems, amt, cnt: cnt, total: amt * cnt, kw, warnings: seg.warnings || [] }); } }
                subLast = subMatch.index + subMatch[0].length;
            }
        }
        results.push(m.result);
        lastEnd = m.end;
    }

    if (lastEnd < line.length) {
        const content = line.substring(lastEnd);
        let subLast = 0;
        const kwReLocal = new RegExp(`(${KW_LIST.join('|')})\\s*(${AMT_RE_STR})`, 'g');
        let subMatch;
        while ((subMatch = kwReLocal.exec(content)) !== null) {
            const subContent = content.substring(subLast, subMatch.index);

            if (subContent.includes('到') || (subMatch[0] && subMatch[0].includes('到'))) {
                const combined = subContent + (subMatch ? subMatch[0] : '');
                const rangeMatch = combined.match(/(\d{1,2})\s*到\s*(\d{1,2})/);
                if (rangeMatch) {
                    const start = parseInt(rangeMatch[1]); const end = parseInt(rangeMatch[2]);
                    const amt = toNum(subMatch[2]); const kw = subMatch[1];
                    if (!kw) { results.push({ cat: '__unrecognized__', nums: [], amt: 0, cnt: 0, total: 0, kw: '', warnings: ['缺少金额关键字'], rawLine: combined.trim() }); }
                    else if (start >= 1 && end <= 49 && start <= end) { const nums = []; for (let i = start; i <= end; i++) { nums.push(String(i).padStart(2, '0')); } results.push({ cat: '特码', nums: nums, amt: amt, cnt: nums.length, total: amt * nums.length, kw: kw, warnings: [] }); }
                    else { results.push({ cat: '__unrecognized__', nums: [], amt: 0, cnt: 0, total: 0, kw: '', warnings: ['号码范围无效，请检查'], rawLine: combined.trim() }); }
                    subLast = subMatch.index + subMatch[0].length; continue;
                }
            }

            const teXiaoResult = tryMatchTeXiao(subContent + subMatch[0]);
            if (teXiaoResult) { results.push(teXiaoResult); }
            else { const seg = parseTeMaSegment(subContent); if (seg) { const amt = toNum(subMatch[2]); const kw = subMatch[1]; const cnt = seg.allNumsArr ? seg.allNumsArr.length : seg.totalCount; results.push({ cat: '特码', nums: seg.displayItems, amt, cnt: cnt, total: amt * cnt, kw, warnings: seg.warnings || [] }); } }
            subLast = subMatch.index + subMatch[0].length;
        }
        if (subLast < content.length) {
            const remaining = content.substring(subLast).trim();
            if (remaining.includes('到')) {
                const rangeMatch = remaining.match(/(\d{1,2})\s*到\s*(\d{1,2})/);
                if (rangeMatch) {
                    const start = parseInt(rangeMatch[1]); const end = parseInt(rangeMatch[2]);
                    const amtMatch = remaining.match(/(各(?:数|号|组|码|注|下|买)?)\s*(\d+)/);
                    if (amtMatch) { const amt = toNum(amtMatch[2]); if (start >= 1 && end <= 49 && start <= end && amt > 0) { const nums = []; for (let i = start; i <= end; i++) { nums.push(String(i).padStart(2, '0')); } results.push({ cat: '特码', nums: nums, amt: amt, cnt: nums.length, total: amt * nums.length, kw: amtMatch[1], warnings: [] }); } else { results.push({ cat: '__unrecognized__', nums: [], amt: 0, cnt: 0, total: 0, kw: '', warnings: ['号码范围无效，请检查'], rawLine: remaining }); } }
                    else { results.push({ cat: '__unrecognized__', nums: [], amt: 0, cnt: 0, total: 0, kw: '', warnings: ['缺少金额关键字'], rawLine: remaining }); }
                }
            } else if (remaining && containsDictElement(remaining)) {
                if (inheritedPlay && !new RegExp(`(${KW_LIST.join('|')})`).test(remaining)) {
                    results.push({ cat: '__unrecognized__', nums: [], amt: 0, cnt: 0, total: 0, kw: '', warnings: [], rawLine: remaining });
                } else {
                    const teXiaoResult = tryMatchTeXiao(remaining);
                    if (teXiaoResult) { results.push(teXiaoResult); }
                    else { results.push({ cat: '__unrecognized__', nums: [], amt: 0, cnt: 0, total: 0, kw: '', warnings: ['缺少金额关键字或有效玩法'], rawLine: remaining }); }
                }
            }
        }
    }

    if (specialMatches.length === 0 && results.length === 0) {
        if (line.includes('到')) {
            const rangeMatch = line.match(/(\d{1,2})\s*到\s*(\d{1,2})/);
            if (rangeMatch) {
                const start = parseInt(rangeMatch[1]); const end = parseInt(rangeMatch[2]);
                const amtMatch = line.match(/(各(?:数|号|组|码|注|下|买)?)\s*(\d+)/);
                if (amtMatch) { const amt = toNum(amtMatch[2]); if (start >= 1 && end <= 49 && start <= end && amt > 0) { const nums = []; for (let i = start; i <= end; i++) { nums.push(String(i).padStart(2, '0')); } return [{ cat: '特码', nums: nums, amt: amt, cnt: nums.length, total: amt * nums.length, kw: amtMatch[1], warnings: [] }]; } else { return [{ cat: '__unrecognized__', nums: [], amt: 0, cnt: 0, total: 0, kw: '', warnings: ['号码范围无效，请检查'], rawLine: line.trim() }]; } }
                else { return [{ cat: '__unrecognized__', nums: [], amt: 0, cnt: 0, total: 0, kw: '', warnings: ['缺少金额关键字'], rawLine: line.trim() }]; }
            }
        }
        if (inheritedPlay && !new RegExp(`(${KW_LIST.join('|')})`).test(line)) {
            if (containsDictElement(line)) {
                return [{ cat: '__unrecognized__', nums: [], amt: 0, cnt: 0, total: 0, kw: '', warnings: [], rawLine: line.trim() }];
            }
        }
        const teXiaoResult = tryMatchTeXiao(line);
        if (teXiaoResult) { return [teXiaoResult]; }
        let subLast = 0;
        const kwReLocal = new RegExp(`(${KW_LIST.join('|')})\\s*(${AMT_RE_STR})`, 'g');
        let subMatch;
        while ((subMatch = kwReLocal.exec(line)) !== null) { const subContent = line.substring(subLast, subMatch.index); const seg = parseTeMaSegment(subContent); if (seg) { const amt = toNum(subMatch[2]); const kw = subMatch[1]; const cnt = seg.allNumsArr ? seg.allNumsArr.length : seg.totalCount; results.push({ cat: '特码', nums: seg.displayItems, amt, cnt: cnt, total: amt * cnt, kw, warnings: seg.warnings || [] }); } subLast = subMatch.index + subMatch[0].length; }
        if (subLast < line.length) { const remaining = line.substring(subLast).trim(); if (remaining && containsDictElement(remaining)) { const teXiaoResult = tryMatchTeXiao(remaining); if (teXiaoResult) { results.push(teXiaoResult); } else { results.push({ cat: '__unrecognized__', nums: [], amt: 0, cnt: 0, total: 0, kw: '', warnings: ['缺少金额关键字或有效玩法'], rawLine: remaining }); } } }
    }

    return results;
}

// ===== 增强版继承函数 =====
function applyInlineInheritance(lineResults, lastInheritablePlay = null) {
    if (!lineResults || lineResults.length === 0) return { results: lineResults, lastPlay: lastInheritablePlay };

    const inheritableCats = { '平特肖': { type: 'zodiac', count: 1 }, '平特尾': { type: 'tail', count: 1 } };
    for (let i = 2; i <= 5; i++) { inheritableCats[i + '连肖'] = { type: 'zodiac', count: i }; inheritableCats[i + '连尾'] = { type: 'tail', count: i }; }

    let inheritedPlay = lastInheritablePlay;
    for (const r of lineResults) { if (r.cat !== '__unrecognized__' && inheritableCats[r.cat]) { inheritedPlay = { cat: r.cat, kw: r.kw || '', ...inheritableCats[r.cat] }; break; } }

    const processed = [];
    for (const r of lineResults) {
        if (inheritedPlay && inheritedPlay.type === 'zodiac' && inheritedPlay.count >= 2 && r.cat === '特肖') {
            const zodiacs = r.nums || [];
            if (zodiacs.length === inheritedPlay.count && (r.kw || '') === (inheritedPlay.kw || '')) {
                const comboStr = zodiacs.join('-');
                processed.push({ cat: inheritedPlay.cat, nums: [comboStr], amt: r.amt, cnt: 1, total: r.amt, kw: inheritedPlay.kw || '各组', warnings: [], rawLine: r.rawLine || '', _inherited: true });
                continue;
            }
        }
        if (r.cat !== '__unrecognized__') { processed.push(r); continue; }
        if (!inheritedPlay) { processed.push(r); continue; }

        const raw = (r.rawLine || '').trim(); if (!raw) { processed.push(r); continue; }
        const amtMatch = raw.match(/(\d+)\s*$/); if (!amtMatch) { processed.push(r); continue; }
        const amt = parseInt(amtMatch[1]) || 0; if (amt <= 0) { processed.push(r); continue; }
        let content = raw.substring(0, amtMatch.index).trim(); if (!content) { processed.push(r); continue; }

        let contentKw = ''; for (const kw of KW_LIST) { if (content.includes(kw)) { contentKw = kw; break; } }
        const inheritedKw = inheritedPlay.kw || '';
        if (contentKw !== inheritedKw) { r.warnings = [`关键字不一致（需要"${inheritedKw || '无关键字'}"，实际"${contentKw || '无关键字'}"）`]; processed.push(r); continue; }

        let cleanContent = content; if (contentKw) { cleanContent = content.replace(new RegExp(contentKw), '').trim(); }
        cleanContent = cleanContent.replace(/[\s,，.。、+\-*＊\/\\|]+/g, '-');

        let matched = false;
        if (inheritedPlay.type === 'zodiac') {
            let items = cleanContent.split('-').filter(i => i.trim());
            if (items.length !== inheritedPlay.count) { const pureZodiacStr = cleanContent.replace(/[^鼠牛虎兔龙蛇马羊猴鸡狗猪]/g, ''); if (pureZodiacStr.length === inheritedPlay.count) { items = pureZodiacStr.split(''); } }
            if (inheritedPlay.count === 1) { if (items.length === 1 && /^[鼠牛虎兔龙蛇马羊猴鸡狗猪]$/.test(items[0].trim())) { processed.push({ cat: inheritedPlay.cat, nums: [items[0].trim()], amt: amt, cnt: 1, total: amt, kw: inheritedPlay.kw || '各', warnings: [], rawLine: raw, _inherited: true }); matched = true; } }
            else { if (items.length === inheritedPlay.count && items.every(i => /^[鼠牛虎兔龙蛇马羊猴鸡狗猪]$/.test(i.trim()))) { const comboStr = items.map(i => i.trim()).join('-'); processed.push({ cat: inheritedPlay.cat, nums: [comboStr], amt: amt, cnt: 1, total: amt, kw: inheritedPlay.kw || '各组', warnings: [], rawLine: raw, _inherited: true }); matched = true; } }
        } else if (inheritedPlay.type === 'tail') {
            let items = cleanContent.split('-').filter(i => /\d+尾/.test(i.trim()));
            if (items.length !== inheritedPlay.count) { const pureDigits = cleanContent.replace(/[^0-9]/g, ''); if (pureDigits.length === inheritedPlay.count) { items = pureDigits.split('').map(d => d + '尾'); } }
            if (inheritedPlay.count === 1) { if (items.length === 1 && /\d+尾$/.test(items[0].trim())) { processed.push({ cat: inheritedPlay.cat, nums: [items[0].trim()], amt: amt, cnt: 1, total: amt, kw: inheritedPlay.kw || '各', warnings: [], rawLine: raw, _inherited: true }); matched = true; } }
            else { if (items.length === inheritedPlay.count && items.every(i => /\d+尾$/.test(i.trim()))) { const comboStr = items.map(i => i.trim()).join('-'); processed.push({ cat: inheritedPlay.cat, nums: [comboStr], amt: amt, cnt: 1, total: amt, kw: inheritedPlay.kw || '各组', warnings: [], rawLine: raw, _inherited: true }); matched = true; } }
        }
        if (!matched) { r.warnings = [`格式不匹配（需要${inheritedPlay.count}个${inheritedPlay.type === 'zodiac' ? '生肖' : '尾数'}）`]; processed.push(r); }
    }

    let outgoingPlay = lastInheritablePlay;
    for (let i = lineResults.length - 1; i >= 0; i--) { const r = lineResults[i]; if (r.cat !== '__unrecognized__' && inheritableCats[r.cat]) { outgoingPlay = { cat: r.cat, kw: r.kw || '', ...inheritableCats[r.cat] }; break; } }
    return { results: processed, lastPlay: outgoingPlay };
}

// ===== 地区提取 =====
function extractRegion(line) {
    const allKeywords = [];
    for (const [region, keywords] of Object.entries(REGION_KEYWORDS)) { for (const kw of keywords) { allKeywords.push({ region, keyword: kw, len: kw.length }); } }
    allKeywords.sort((a, b) => b.len - a.len);
    for (const { region, keyword } of allKeywords) {
        const idx = line.indexOf(keyword);
        if (idx !== -1) {
            if (idx > 0 && /[\u4e00-\u9fa5]/.test(line.charAt(idx - 1))) { continue; }
            const remaining = (line.substring(0, idx) + line.substring(idx + keyword.length)).trim();
            return { region, remaining };
        }
    }
    return null;
}

// ===== 识别入口（含替换预设应用） =====
function performRecognition(text) {
    const resultDiv = document.getElementById('orderResult');
    if (!text || !text.trim()) {
        if (resultDiv) resultDiv.innerHTML = '';
        State.pureOrderLines = [];
        State.pureOrderRegions = [];
        State.cachedMaxLossData = [];
        updateOrderTotalDisplay();
        updateMaxLossDisplay();
        return;
    }

    text = applyReplacePresets(text);

    let processedText = preprocess(text);
    const lines = processedText.split('\n');
    const allResults = [];
    const lineRegions = [];
    let currentLineRegion = State.currentFilterRegion;
    const dotRegion = State.dotRegion || 'auto';
    let lastInheritablePlay = null;

    for (const line of lines) {
        if (!line.trim()) { continue; }
        let orderLine = line;
        if (dotRegion !== 'auto') { currentLineRegion = dotRegion; }
        else { const extracted = extractRegion(line); if (extracted) { currentLineRegion = extracted.region; orderLine = extracted.remaining; } }
        lineRegions.push(currentLineRegion);
        if (!orderLine.trim()) continue;

        const parsed = processOneLine(orderLine, lastInheritablePlay);
        let lineResults = [];
        if (parsed.length === 0) {
            if (containsDictElement(orderLine)) {
                lineResults.push({ cat: '__unrecognized__', nums: [], amt: 0, cnt: 0, total: 0, kw: '', warnings: ['缺少金额关键字或有效玩法'], rawLine: orderLine.trim() });
            }
        } else { lineResults.push(...parsed); }
        if (lineResults.length > 0) {
            const inheritResult = applyInlineInheritance(lineResults, lastInheritablePlay);
            lineResults = inheritResult.results;
            lastInheritablePlay = inheritResult.lastPlay;
            lineResults.forEach(r => { r.region = currentLineRegion; });
            allResults.push(...lineResults);
        }
    }

    const mergedArray = allResults.map(r => ({
        category: r.cat,
        numbers: r.nums,
        unitAmount: r.amt,
        totalCount: r.cnt,
        totalAmount: r.total,
        kw: r.kw || '',
        warnings: r.warnings || [],
        rawLine: r.rawLine || '',
        region: r.region || State.currentFilterRegion,
        _inherited: r._inherited || false
    }));

    if (resultDiv) {
        if (mergedArray.length === 0) {
            resultDiv.innerHTML = text ? `<div class="result-line">${text}</div>` : '';
            State.pureOrderLines = [];
            State.pureOrderRegions = [];
            State.cachedMaxLossData = [];
        } else {
            displayResults(mergedArray, resultDiv);
        }
    }
    updateOrderTotalDisplay();
    updateMaxLossDisplay();
}

// ===== 结果展示（含警告点击定位） =====
function displayResults(rs, container) {
    if (!container) container = document.getElementById('orderResult');
    if (!container) return;
    if (rs.length === 0) {
        container.innerHTML = '';
        State.pureOrderLines = [];
        State.pureOrderRegions = [];
        State.cachedMaxLossData = [];
        return;
    }
    let total = 0;
    let html = '';
    const pureLines = [];
    const pureRegions = [];
    const maxLossData = [];
    const regionColorMap = { 'macau': '#e74c3c', 'hongkong': '#3498db', 'yuegang': '#27ae60' };
    let warningCount = 0;

    for (const r of rs) {
        if (r.category === '__unrecognized__') {
            const regionLabel = REGION_LABELS[r.region] || '';
            const warnText = (r.warnings && r.warnings.length) ? r.warnings.join('；') : '缺少金额关键字或有效玩法';
            if (r.region && r.region !== State.currentFilterRegion && !r.warnings.length) {
                html += `<div class="result-line"><span style="color:${regionColorMap[r.region] || '#333'};">${regionLabel}·</span>${r.rawLine} <span style="color:red;">[已提取地区${regionLabel}，但内容无法识别]</span></div>`;
            } else {
                html += `<div class="result-line"><span style="color:${r.region !== State.currentFilterRegion ? (regionColorMap[r.region] || '#e74c3c') : '#000'};">${regionLabel}·</span>${r.rawLine} <span class="warning-text" style="color:red;cursor:pointer;" data-rawline="${r.rawLine.replace(/"/g, '&quot;')}">[${warnText}]</span></div>`;
            }
            warningCount++;
            continue;
        }
        if (r.warnings && r.warnings.length) { warningCount++; }
        total += r.totalAmount;
        const regionLabel = REGION_LABELS[r.region] || '';
        const isCurrentRegion = r.region === State.currentFilterRegion;
        const regionColor = isCurrentRegion ? 'color:#000;' : `color:${regionColorMap[r.region] || '#333'};`;
        const kwDisplay = (r.category === '特码') ? '各数' : '各';
        const amountStr = `${kwDisplay}${Math.round(r.unitAmount)}`;
        const info = r.totalCount > 1 ? `(${r.totalCount}注, 共${Math.round(r.totalAmount)})` : `(共${Math.round(r.totalAmount)})`;
        const numStr = formatNums(r.category, r.numbers);
        let line = `<span style="${regionColor}">${regionLabel}·</span>${r.category}:${numStr}${amountStr} ${info}`;
        if (r._inherited) { line += ` <span style="color:#27ae60;">[继承]</span>`; }
        if (r.warnings && r.warnings.length) { line += ` <span class="warning-text" style="color:red;cursor:pointer;" data-rawline="${r.rawLine.replace(/"/g, '&quot;')}">[${r.warnings.join('；')}]</span>`; }
        html += `<div class="result-line">${line}</div>`;
        const pureNumStr = formatNums(r.category, r.numbers);
        pureLines.push(`${r.category}:${pureNumStr} ${kwDisplay} ${Math.round(r.unitAmount)}`);
        pureRegions.push(r.region);
        if (r.category === '特码' || r.category === '特肖') { maxLossData.push({ category: r.category, numbers: r.numbers, unitAmount: Math.round(r.unitAmount) }); }
    }
    container.innerHTML = html;
    State.pureOrderLines = pureLines;
    State.pureOrderRegions = pureRegions;
    State.cachedMaxLossData = maxLossData;

    container.querySelectorAll('.warning-text').forEach(span => {
        span.addEventListener('click', function(e) {
            e.stopPropagation();
            const rawLine = this.getAttribute('data-rawline');
            if (!rawLine) return;
            const ta = document.getElementById('sourceOrderInput');
            if (!ta) return;
            const text = ta.value;
            const lines = text.split('\n');
            let targetLineIndex = -1;
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].trim() === rawLine.trim()) {
                    targetLineIndex = i;
                    break;
                }
            }
            if (targetLineIndex !== -1) {
                let pos = 0;
                for (let i = 0; i < targetLineIndex; i++) {
                    pos += lines[i].length + 1;
                }
                pos += lines[targetLineIndex].length;
                ta.focus();
                ta.setSelectionRange(pos, pos);
                const lineHeight = parseFloat(getComputedStyle(ta).lineHeight) || 20;
                const targetScrollTop = targetLineIndex * lineHeight;
                const visibleHeight = ta.clientHeight;
                if (targetScrollTop < ta.scrollTop || targetScrollTop > ta.scrollTop + visibleHeight - lineHeight) {
                    ta.scrollTop = targetScrollTop - visibleHeight / 2 + lineHeight / 2;
                }
            } else {
                showToast('未在源输入框中找到对应行');
            }
        });
    });

    const warnSpan = document.getElementById('recognitionWarning');
    if (warnSpan) {
        if (warningCount > 0) {
            warnSpan.textContent = '⚠ ' + warningCount + '条警告';
            warnSpan.style.display = 'inline';
        } else {
            warnSpan.textContent = '';
            warnSpan.style.display = 'none';
        }
    }
}

function formatNums(cat, numsArr) {
    const simpleCats = ['特码', '特肖', '平特肖', '平码', '平特尾'];
    if (simpleCats.includes(cat)) return numsArr.join('-');
    if (cat.startsWith('包')) return numsArr.join('-');
    if (cat.includes('连肖')) return numsArr.map(g => { if (g.includes('-')) return '(' + g + ')'; return '(' + g.split('').join('-') + ')'; }).join(' ');
    return numsArr.map(g => `(` + g + `)`).join(' ');
}

// ===== 合计与行数计算（已修复多注玩法计算） =====
function updateOrderTotalDisplay() {
    const re = document.getElementById('orderResult');
    const box = document.getElementById('orderTotalAmountBox');
    const span = document.getElementById('orderTotalAmount');
    const lineCountSpan = document.getElementById('orderLineCount');
    if (!re || !box || !span) return;
    const pureLines = State.pureOrderLines || [];
    if (pureLines.length === 0) { box.style.display = 'none'; if (lineCountSpan) lineCountSpan.style.display = 'none'; return; }
    let total = 0;
    let validLineCount = pureLines.length;
    pureLines.forEach(line => {
        // 尝试匹配标准格式：玩法:内容 各/各组/各数/各号 金额
        const stdMatch = line.match(/^(.+?):\s*(.+?)\s+(各|各组|各数|各号)\s*(\d+)$/);
        if (stdMatch) {
            const playType = stdMatch[1].trim();
            const content = stdMatch[2].trim();
            const kw = stdMatch[3];
            const amt = parseInt(stdMatch[4]) || 0;

            if (playType.startsWith('包')) {
                total += amt;
            } else if (playType === '特码') {
                // 特码需要展开每个 token，累加对应号码数
                const tokens = content.split('-').map(t => t.trim()).filter(t => t);
                let cnt = 0;
                tokens.forEach(token => {
                    if (/^\d{1,2}$/.test(token)) { cnt += 1; }
                    else { const nums = keyToAllNums(token); cnt += nums.length || 1; }
                });
                total += cnt * amt;
            } else if (playType === '平特肖' || playType === '特肖' || playType === '平特尾' || playType === '平码') {
                // 多注玩法：按连字符拆分后每注算一份
                const items = content.split('-').filter(i => i.trim());
                total += items.length * amt;
            } else if (playType.includes('连肖') || playType.includes('连尾') || playType === '二中二' || playType === '三中三' || playType === '特碰' || playType.includes('不中')) {
                // 组合玩法：统计括号组数
                const cleaned = content.replace(/[()]/g, '');
                const groups = cleaned.split(/\s+/).filter(c => c.trim());
                total += groups.length * amt;
            } else {
                total += amt;
            }
        } else {
            // 非标准格式（如旧格式 特肖:鼠牛虎 各 100），尝试用 countItemsInLine 兜底
            const { numbers, amount } = countItemsInLine(line);
            if (amount > 0) {
                if (numbers.length > 0) {
                    total += numbers.length * amount;
                } else {
                    total += amount;
                }
            }
        }
    });
    State.recognizedTotal = total;
    span.textContent = total;
    if (total > 0) {
        box.style.display = 'inline-flex';
        if (lineCountSpan) { lineCountSpan.innerHTML = '<span style="color:#000;">' + validLineCount + '</span>行'; lineCountSpan.style.display = 'inline'; }
    } else { box.style.display = 'none'; if (lineCountSpan) lineCountSpan.style.display = 'none'; }
}

function updateMaxLossDisplay() {}

// ===== 替换预设管理 =====
function getReplacePresets() {
    try { return JSON.parse(localStorage.getItem('replacePresets') || '[]'); }
    catch (e) { return []; }
}

function saveReplacePresets(presets) {
    localStorage.setItem('replacePresets', JSON.stringify(presets));
}

function applyReplacePresets(text) {
    const presets = getReplacePresets();
    let result = text;
    presets.forEach(rule => {
        if (rule.old && rule.new) {
            const escapedOld = rule.old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escapedOld, 'g');
            result = result.replace(regex, rule.new);
        }
    });
    return result;
}

function renderPresetList() {
    const presets = getReplacePresets();
    const container = document.getElementById('presetList');
    if (!container) return;
    container.innerHTML = presets.length === 0
        ? '<div style="text-align:center;color:#666;padding:10px;">暂无替换预设</div>'
        : presets.map((rule, idx) =>
            `<div class="replace-preset-item">
                <span>${rule.old} → ${rule.new}</span>
                <button data-idx="${idx}" class="delete-preset-btn" style="margin-left:auto;padding:2px 8px;background:#e74c3c;color:#fff;border:none;border-radius:3px;cursor:pointer;">删除</button>
            </div>`
        ).join('');
    container.querySelectorAll('.delete-preset-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const idx = parseInt(this.getAttribute('data-idx'));
            const presets = getReplacePresets();
            presets.splice(idx, 1);
            saveReplacePresets(presets);
            renderPresetList();
        });
    });
}

function addReplacePreset() {
    const oldInput = document.getElementById('presetOld');
    const newInput = document.getElementById('presetNew');
    const oldVal = oldInput?.value.trim();
    const newVal = newInput?.value.trim();
    if (!oldVal || !newVal) { showToast('请输入原文字和替换文字'); return; }
    const presets = getReplacePresets();
    if (presets.some(r => r.old === oldVal)) { showToast('该预设已存在'); return; }
    presets.push({ old: oldVal, new: newVal });
    saveReplacePresets(presets);
    oldInput.value = '';
    newInput.value = '';
    renderPresetList();
}

function showReplacePresetModal() {
    const modal = document.getElementById('replacePresetModal');
    if (!modal) return;
    renderPresetList();
    modal.style.display = 'block';
    document.getElementById('presetOld')?.focus();
}