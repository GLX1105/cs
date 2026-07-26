// ===== state.js - 集中式状态管理 =====

// 生肖顺序
const shengOrder = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];

// 号码列表
const numberList = [
    {sheng:'马',num:'01',color:'red'},{sheng:'马',num:'13',color:'red'},{sheng:'马',num:'25',color:'blue'},{sheng:'马',num:'37',color:'blue'},{sheng:'马',num:'49',color:'green'},
    {sheng:'蛇',num:'02',color:'red'},{sheng:'蛇',num:'14',color:'blue'},{sheng:'蛇',num:'26',color:'blue'},{sheng:'蛇',num:'38',color:'green'},
    {sheng:'龙',num:'03',color:'blue'},{sheng:'龙',num:'15',color:'blue'},{sheng:'龙',num:'27',color:'green'},{sheng:'龙',num:'39',color:'green'},
    {sheng:'兔',num:'04',color:'blue'},{sheng:'兔',num:'16',color:'green'},{sheng:'兔',num:'28',color:'green'},{sheng:'兔',num:'40',color:'red'},
    {sheng:'虎',num:'05',color:'green'},{sheng:'虎',num:'17',color:'green'},{sheng:'虎',num:'29',color:'red'},{sheng:'虎',num:'41',color:'blue'},
    {sheng:'牛',num:'06',color:'green'},{sheng:'牛',num:'18',color:'red'},{sheng:'牛',num:'30',color:'red'},{sheng:'牛',num:'42',color:'blue'},
    {sheng:'鼠',num:'07',color:'red'},{sheng:'鼠',num:'19',color:'red'},{sheng:'鼠',num:'31',color:'blue'},{sheng:'鼠',num:'43',color:'green'},
    {sheng:'猪',num:'08',color:'red'},{sheng:'猪',num:'20',color:'blue'},{sheng:'猪',num:'32',color:'green'},{sheng:'猪',num:'44',color:'green'},
    {sheng:'狗',num:'09',color:'blue'},{sheng:'狗',num:'21',color:'green'},{sheng:'狗',num:'33',color:'green'},{sheng:'狗',num:'45',color:'red'},
    {sheng:'鸡',num:'10',color:'blue'},{sheng:'鸡',num:'22',color:'green'},{sheng:'鸡',num:'34',color:'red'},{sheng:'鸡',num:'46',color:'red'},
    {sheng:'猴',num:'11',color:'green'},{sheng:'猴',num:'23',color:'red'},{sheng:'猴',num:'35',color:'red'},{sheng:'猴',num:'47',color:'blue'},
    {sheng:'羊',num:'12',color:'red'},{sheng:'羊',num:'24',color:'red'},{sheng:'羊',num:'36',color:'blue'},{sheng:'羊',num:'48',color:'blue'},
];

// 生肖颜色映射
const shengColorMap = {'鼠':'red','兔':'red','马':'red','鸡':'red','虎':'blue','蛇':'blue','猴':'blue','猪':'blue','牛':'green','龙':'green','羊':'green','狗':'green'};

// ===== 集中式状态管理 =====
const State = {
    // 基础数据
    adjustValues: {},
    drawData: {},
    drawLocked: {},
    historyRecords: [],
    orderList: [],
    operationLogs: [],

    // 配置
    selectedSchemeIdx: 0,
    yearZodiac: '马',

    // 上报订单
    reportedOrdersSpecial: [],
    reportedOrdersLianXiao: [],
    reportedOrdersLianMa: [],

    // 筛选状态
    currentFilterRegion: 'macau',
    currentFilterDate: '',
    historyRegionFilter: 'macau',    // ✅ 修复：默认只看澳门
    orderDetailFilters: {
        region: '不限',
        betType: '不限',
        winStatus: '不限',
        reporter: '不限'
    },

    // UI 状态
    sidebarCollapsed: false,
    globalModalZIndex: 100000,

    // 录单状态
    entryOrders: [],
    entryBatchSeq: 0,
    entrySelectedIndices: new Set(),
    lastSavedPureLines: null,

    // 特码调单
    specialCodeSelectedRows: new Set(),

    // 剪贴板
    clipboardData: [],
    selectedOrderIndices: new Set(),

    // 运行时标志
    filterDuijiangDone: false,
    dotRegion: 'auto',
    pureOrderLines: [],
    pureOrderRegions: [],
    cachedMaxLossData: [],
    recognizedTotal: 0,
};

// 向后兼容的 window 属性
window.yearZodiac = '马';
window.reportedOrdersSpecial = State.reportedOrdersSpecial;
window.reportedOrdersLianXiao = State.reportedOrdersLianXiao;
window.reportedOrdersLianMa = State.reportedOrdersLianMa;
window._filterDuijiangDone = false;
window._dotRegion = 'auto';
window._pureOrderLines = State.pureOrderLines;
window._pureOrderRegions = State.pureOrderRegions;
window._cachedMaxLossData = State.cachedMaxLossData;
window._recognizedTotal = State.recognizedTotal;

// 初始化 adjustValues
numberList.forEach(item => { State.adjustValues[item.num] = 0; });

// ===== 通用区域转换函数 =====
function regionToKey(region) {
    const map = { '澳门': 'macau', '香港': 'hongkong', '粤港': 'yuegang' };
    return map[region] || 'macau';
}