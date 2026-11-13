/**
 * 择吉方位常量：太岁、岁破、三煞、流年紫白。
 *
 * 这一组与历注（建除、值宿、宜忌）不是一回事：历注论**日**，这里论**方**。
 * 动土装修择吉的第一问是「哪个方向不能动」，答案全在这一层。
 *
 * 年的界线一律用**立春**，与 buildAlmanac 的年柱、与 lunar-javascript 的年紫白同界。
 */

/**
 * 十二地支所居之宫与方位。太岁方就是年支这一山。
 *
 * 注意精度：太岁占的是二十四山里的**一山**（15°），这里给到的是它所在的
 * 八卦宫（45°）。要精确到山就直接看 `branch` 本身，不要把整个宫都当禁区。
 */
export const BRANCH_PALACE = {
  子: { palace: '坎', direction: '正北' },
  丑: { palace: '艮', direction: '东北' },
  寅: { palace: '艮', direction: '东北' },
  卯: { palace: '震', direction: '正东' },
  辰: { palace: '巽', direction: '东南' },
  巳: { palace: '巽', direction: '东南' },
  午: { palace: '离', direction: '正南' },
  未: { palace: '坤', direction: '西南' },
  申: { palace: '坤', direction: '西南' },
  酉: { palace: '兑', direction: '正西' },
  戌: { palace: '乾', direction: '西北' },
  亥: { palace: '乾', direction: '西北' },
};

/**
 * 三煞：按年支三合局取，煞在局之**对方**三支。
 * 申子辰水局会北，三煞在南；寅午戌火局会南，三煞在北；余类推。
 *
 * 三支各有名目：劫煞（对方之首）、灾煞（对方之中）、岁煞（对方之末）。
 */
export const SANSHA_BY_GROUP = [
  {
    group: ['申', '子', '辰'],
    branches: ['巳', '午', '未'],
    direction: '正南',
    cn: '申子辰年三煞在南',
  },
  {
    group: ['寅', '午', '戌'],
    branches: ['亥', '子', '丑'],
    direction: '正北',
    cn: '寅午戌年三煞在北',
  },
  {
    group: ['亥', '卯', '未'],
    branches: ['申', '酉', '戌'],
    direction: '正西',
    cn: '亥卯未年三煞在西',
  },
  {
    group: ['巳', '酉', '丑'],
    branches: ['寅', '卯', '辰'],
    direction: '正东',
    cn: '巳酉丑年三煞在东',
  },
];

/** 三煞三支的名目，次序与 SANSHA_BY_GROUP.branches 一一对应。 */
export const SANSHA_NAMES = ['劫煞', '灾煞', '岁煞'];

/**
 * 洛书飞泊次序：中 → 乾 → 兑 → 艮 → 离 → 坎 → 坤 → 震 → 巽。
 * 数组元素是宫数，第 i 位收到的是「入中星 + i」那颗星。
 *
 * 这一串与奇门地盘的九宫顺飞（1→2→…→9）不是一回事，两者不能互相代用。
 */
export const LUOSHU_FLIGHT = [5, 6, 7, 8, 9, 1, 2, 3, 4];

/**
 * 九宫的卦、方位与五行。宫数即洛书数。
 *
 * 字段名刻意与九星那张表错开（宫用 trigram/palaceElement，星用 name/starElement）：
 * 「宫」与「星」都各有五行，方位吉凶断的正是两者的生克，合并成一个 element 会算错。
 */
export const PALACE_META = {
  1: { trigram: '坎', direction: '正北', palaceElement: 'Water' },
  2: { trigram: '坤', direction: '西南', palaceElement: 'Earth' },
  3: { trigram: '震', direction: '正东', palaceElement: 'Wood' },
  4: { trigram: '巽', direction: '东南', palaceElement: 'Wood' },
  5: { trigram: '中', direction: '中宫', palaceElement: 'Earth' },
  6: { trigram: '乾', direction: '西北', palaceElement: 'Metal' },
  7: { trigram: '兑', direction: '正西', palaceElement: 'Metal' },
  8: { trigram: '艮', direction: '东北', palaceElement: 'Earth' },
  9: { trigram: '离', direction: '正南', palaceElement: 'Fire' },
};

/** 九星本名与色。星数即紫白数，与所临宫数无关。 */
export const NINE_STAR_META = {
  1: { cn: '一白', name: '贪狼', starElement: 'Water' },
  2: { cn: '二黑', name: '巨门', starElement: 'Earth' },
  3: { cn: '三碧', name: '禄存', starElement: 'Wood' },
  4: { cn: '四绿', name: '文曲', starElement: 'Wood' },
  5: { cn: '五黄', name: '廉贞', starElement: 'Earth' },
  6: { cn: '六白', name: '武曲', starElement: 'Metal' },
  7: { cn: '七赤', name: '破军', starElement: 'Metal' },
  8: { cn: '八白', name: '左辅', starElement: 'Earth' },
  9: { cn: '九紫', name: '右弼', starElement: 'Fire' },
};
