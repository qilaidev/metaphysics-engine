/**
 * 干支关系判定层。
 *
 * 只做「给定干支，返回它们之间的客观关系」——纳音、藏干、长生、合冲刑害破会、旬空、五行局。
 * 不做吉凶断语，不做强弱评分：那些属于各术数模块自己的口径，放在上层。
 */

import {
  STEMS,
  BRANCHES,
  NAYIN,
  HIDDEN_STEMS,
  TWELVE_STAGE_NAMES,
  TWELVE_STAGE_START,
  STEM_COMBINATIONS,
  STEM_CLASHES,
  BRANCH_SIX_COMBINATIONS,
  BRANCH_TRIPLE_COMBINATIONS,
  BRANCH_DIRECTIONAL_COMBINATIONS,
  BRANCH_CLASHES,
  BRANCH_PUNISHMENTS,
  BRANCH_HARMS,
  BRANCH_DESTRUCTIONS,
  FIVE_ELEMENT_BUREAU,
  SEXAGENARY_CYCLE,
  XUNKONG_BY_DECADE,
} from '../constants/ganzhi.js';
import { ELEMENTS } from '../constants/stems.js';

const branchIndex = (branch) => BRANCHES.indexOf(branch);

const normalize12 = (value) => ((value % 12) + 12) % 12;

/** 六十甲子纳音。接受 ('甲', '子') 或 ('甲子')。 */
export const getNayin = (stemOrGanzhi, branch) => {
  const ganzhi = branch ? `${stemOrGanzhi}${branch}` : stemOrGanzhi;
  return NAYIN[ganzhi] || null;
};

/** 地支藏干，顺序为 [本气, 中气, 余气]。 */
export const getHiddenStems = (branch) => HIDDEN_STEMS[branch] || [];

/** 地支本气（藏干之主），十神与五行统计的默认取值。 */
export const getPrimaryHiddenStem = (branch) => {
  const hidden = getHiddenStems(branch);
  return hidden.length ? hidden[0].stem : null;
};

/**
 * 十二长生：给定天干落在某地支上处于哪一位。
 * 阳干自长生顺行，阴干自长生逆行。
 */
export const getTwelveStage = (stem, branch) => {
  const start = TWELVE_STAGE_START[stem];
  const target = branchIndex(branch);
  if (!start || target === -1) return null;
  const startIdx = branchIndex(start.branch);
  const offset = start.forward ? normalize12(target - startIdx) : normalize12(startIdx - target);
  return { ...TWELVE_STAGE_NAMES[offset], index: offset };
};

/** 天干五合，命中返回合化五行。 */
export const getStemCombination = (stemA, stemB) => {
  return (
    STEM_COMBINATIONS.find(
      ({ pair }) =>
        (pair[0] === stemA && pair[1] === stemB) || (pair[0] === stemB && pair[1] === stemA)
    ) || null
  );
};

/** 天干相冲。 */
export const isStemClash = (stemA, stemB) =>
  STEM_CLASHES.some(([a, b]) => (a === stemA && b === stemB) || (a === stemB && b === stemA));

/**
 * 地支关系全集检测。
 *
 * 入参是一组地支（通常是四柱的年月日时四支，也可以加入大运流年支），
 * 返回其中成立的所有六合/三合/三会/六冲/相刑/相害/相破。
 *
 * 三合与三会按「全见」和「半合」分别标记：三合缺中神（子午卯酉）只作半合，
 * 力量不同，断命时要能区分，所以这里不合并成一个布尔。
 */
export const detectBranchRelations = (branches = []) => {
  const list = branches.filter((b) => branchIndex(b) !== -1);
  const has = (branch) => list.includes(branch);
  const countOf = (branch) => list.filter((b) => b === branch).length;

  const sixCombinations = BRANCH_SIX_COMBINATIONS.filter(
    ({ pair }) => has(pair[0]) && has(pair[1])
  );

  const tripleCombinations = [];
  const halfCombinations = [];
  BRANCH_TRIPLE_COMBINATIONS.forEach((entry) => {
    const present = entry.branches.filter(has);
    if (present.length === 3) {
      tripleCombinations.push(entry);
    } else if (present.length === 2 && present.includes(entry.center)) {
      // 半合必须带中神，缺中神的两支（如申辰）不成局
      halfCombinations.push({ ...entry, present, cn: `${present.join('')}半合${entry.transform}` });
    }
  });

  const directional = BRANCH_DIRECTIONAL_COMBINATIONS.filter(({ branches: trio }) =>
    trio.every(has)
  );

  const clashes = BRANCH_CLASHES.filter(([a, b]) => has(a) && has(b)).map(([a, b]) => ({
    pair: [a, b],
    cn: `${a}${b}相冲`,
  }));

  const punishments = [];
  BRANCH_PUNISHMENTS.triple.forEach((entry) => {
    const present = entry.branches.filter(has);
    if (present.length === 3) {
      punishments.push({ type: 'triple', branches: entry.branches, cn: entry.cn });
    } else if (present.length === 2) {
      punishments.push({ type: 'partial', branches: present, cn: `${present.join('')}相刑` });
    }
  });
  BRANCH_PUNISHMENTS.mutual.forEach((entry) => {
    if (entry.pair.every(has)) {
      punishments.push({ type: 'mutual', branches: entry.pair, cn: entry.cn });
    }
  });
  BRANCH_PUNISHMENTS.self.forEach((branch) => {
    if (countOf(branch) >= 2) {
      punishments.push({ type: 'self', branches: [branch, branch], cn: `${branch}${branch}自刑` });
    }
  });

  const harms = BRANCH_HARMS.filter(([a, b]) => has(a) && has(b)).map(([a, b]) => ({
    pair: [a, b],
    cn: `${a}${b}相害`,
  }));

  const destructions = BRANCH_DESTRUCTIONS.filter(([a, b]) => has(a) && has(b)).map(([a, b]) => ({
    pair: [a, b],
    cn: `${a}${b}相破`,
  }));

  return {
    sixCombinations,
    tripleCombinations,
    halfCombinations,
    directional,
    clashes,
    punishments,
    harms,
    destructions,
  };
};

/** 天干关系检测，用于四柱天干之间的合与冲。 */
export const detectStemRelations = (stems = []) => {
  const combinations = [];
  const clashes = [];
  for (let i = 0; i < stems.length; i += 1) {
    for (let j = i + 1; j < stems.length; j += 1) {
      const combo = getStemCombination(stems[i], stems[j]);
      if (combo) combinations.push({ ...combo, positions: [i, j] });
      if (isStemClash(stems[i], stems[j])) {
        clashes.push({
          pair: [stems[i], stems[j]],
          positions: [i, j],
          cn: `${stems[i]}${stems[j]}相冲`,
        });
      }
    }
  }
  return { combinations, clashes };
};

/**
 * 旬空（空亡）：定出干支所属之旬，返回该旬的两个空亡地支。
 * 六爻断卦与八字论空亡都用这个。
 */
export const getXunkong = (stemOrGanzhi, branch) => {
  const ganzhi = branch ? `${stemOrGanzhi}${branch}` : stemOrGanzhi;
  const index = SEXAGENARY_CYCLE.indexOf(ganzhi);
  if (index === -1) return null;
  const decadeHead = SEXAGENARY_CYCLE[Math.floor(index / 10) * 10];
  return { decade: decadeHead, branches: XUNKONG_BY_DECADE[decadeHead] || [] };
};

/** 判断某地支对给定干支而言是否落空亡。 */
export const isXunkong = (dayGanzhi, targetBranch) => {
  const xunkong = getXunkong(dayGanzhi);
  return xunkong ? xunkong.branches.includes(targetBranch) : false;
};

/**
 * 旺相休囚死：某五行在给定月令下的四时旺衰。
 *
 * 五档由月令与目标五行的生克唯一决定，无流派分歧：
 * **与月令同类者旺、月令所生者相、生月令者休、克月令者囚、月令所克者死。**
 * 「春木旺、火相、水休、金囚、土死」这句口诀就是它的一个实例。
 *
 * 放在基座层是因为六爻论爻之旺衰、奇门论门星之旺相吃的是同一张表 ——
 * 各自抄一份，迟早有一边把「休」和「囚」写反（两者都是「与月令相克」，
 * 差别只在克的方向，是这张表里唯一容易记反的一处）。
 *
 * 这里不调用 bazi.service 的 getElementRelation：那会让基座层反过来依赖上层，
 * 形成 ganzhi ⇄ bazi 的循环。五行相生序就是 ELEMENTS 的下标序，直接算差值即可。
 *
 * @param {string} monthElement 月令五行（六爻取月建地支五行，奇门取节气月支五行）
 * @param {string} targetElement 被判旺衰的五行
 * @returns {{key: string, cn: string, index: number}|null} 认不出五行时返回 null
 */
const SEASONAL_STATES = [
  { key: 'wang', cn: '旺' }, // 与月令同类
  { key: 'xiang', cn: '相' }, // 月令所生
  { key: 'si', cn: '死' }, // 月令所克
  { key: 'qiu', cn: '囚' }, // 克月令者
  { key: 'xiu', cn: '休' }, // 生月令者
];

export const getSeasonalState = (monthElement, targetElement) => {
  const monthIdx = ELEMENTS.indexOf(monthElement);
  const targetIdx = ELEMENTS.indexOf(targetElement);
  if (monthIdx === -1 || targetIdx === -1) return null;
  // ELEMENTS 按相生序排列，故下标差 +1 为「我生」、+2 为「我克」
  const offset = (((targetIdx - monthIdx) % 5) + 5) % 5;
  return { ...SEASONAL_STATES[offset], index: offset };
};

/**
 * 五行局：紫微斗数取命宫干支的纳音五行定局。
 * 局数同时决定紫微星起宫与大限的步长，错了整盘皆错。
 */
export const getFiveElementBureau = (stem, branch) => {
  const nayin = getNayin(stem, branch);
  if (!nayin) return null;
  const bureau = FIVE_ELEMENT_BUREAU[nayin.element];
  if (!bureau) return null;
  return { ...bureau, nayin: nayin.name, element: nayin.element };
};

/** 由甲子数还原干支，index 可为任意整数（自动取模）。 */
export const ganzhiFromIndex = (index) => {
  const safe = ((Math.trunc(index) % 60) + 60) % 60;
  return SEXAGENARY_CYCLE[safe];
};

/** 干支在六十甲子中的序号，非法输入返回 -1。 */
export const ganzhiToIndex = (stemOrGanzhi, branch) => {
  const ganzhi = branch ? `${stemOrGanzhi}${branch}` : stemOrGanzhi;
  return SEXAGENARY_CYCLE.indexOf(ganzhi);
};

/**
 * 月建次序：正月建寅。胎元、命宫、身宫三者的数法都以寅为一，与地支本序（子为一）
 * 不是一回事 —— 身宫尤其反直觉：它的月支按寅数、时支按子数，两把尺子同时用。
 */
const MONTH_BRANCH_ORDER = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'];

/** 以寅为一的月建序（寅=1 … 丑=12）。 */
const monthOrdinal = (branch) => {
  const idx = MONTH_BRANCH_ORDER.indexOf(branch);
  return idx === -1 ? 0 : idx + 1;
};

/** 以子为一的地支序（子=1 … 亥=12）。 */
const branchOrdinal = (branch) => {
  const idx = branchIndex(branch);
  return idx === -1 ? 0 : idx + 1;
};

/**
 * 五虎遁：由年干推某月建之月干（甲己之年丙作首，乙庚之岁戊为头……）。
 * 命宫身宫的宫干与八字月柱的月干同出此法，故共用这一处。
 */
const monthStemByYearStem = (yearStem, ordinal) => {
  const y = STEMS.indexOf(yearStem);
  if (y === -1 || ordinal < 1) return null;
  return STEMS[((((y + 1) * 2 + ordinal - 1) % 10) + 10) % 10];
};

const withNayin = (stem, branch) =>
  stem && branch
    ? { stem, branch, ganzhi: `${stem}${branch}`, nayin: getNayin(stem, branch) }
    : null;

/**
 * 胎元：月干进一位、月支进三位 —— 受胎之月的干支。
 * 只由月柱决定，海外出生也跟着年月柱那个坐标系走。
 */
export const getTaiYuan = (monthStem, monthBranch) => {
  const g = STEMS.indexOf(monthStem);
  const z = branchIndex(monthBranch);
  if (g === -1 || z === -1) return null;
  return withNayin(STEMS[(g + 1) % 10], BRANCHES[(z + 3) % 12]);
};

/**
 * 胎息：日干合化之干配日支六合之支。与胎元不同，胎息由**日柱**定。
 */
export const getTaiXi = (dayStem, dayBranch) => {
  const combo = STEM_COMBINATIONS.find((entry) => entry.pair.includes(dayStem));
  const six = BRANCH_SIX_COMBINATIONS.find((entry) => entry.pair.includes(dayBranch));
  if (!combo || !six) return null;
  const stem = combo.pair.find((s) => s !== dayStem) || dayStem;
  const branch = six.pair.find((b) => b !== dayBranch) || dayBranch;
  return withNayin(stem, branch);
};

/**
 * 命宫：月支与时支之序相加，未满十四则以十四减之、已过则以二十六减之，
 * 所得之数即命宫在月建序上的位置；宫干由年干起五虎遁。
 *
 * 月支与时支**都按寅为一数**（这一条与身宫不同，最容易写反）。
 */
export const getMingGong = (yearStem, monthBranch, hourBranch) => {
  const m = monthOrdinal(monthBranch);
  const h = monthOrdinal(hourBranch);
  if (!m || !h) return null;
  const sum = m + h;
  const ordinal = (sum >= 14 ? 26 : 14) - sum;
  const branch = MONTH_BRANCH_ORDER[ordinal - 1];
  return withNayin(monthStemByYearStem(yearStem, ordinal), branch);
};

/**
 * 身宫：月支之序（寅为一）与时支之序（**子为一**）相加，逾十二减十二。
 * 宫干同样由年干起五虎遁。
 */
export const getShenGong = (yearStem, monthBranch, hourBranch) => {
  const m = monthOrdinal(monthBranch);
  const h = branchOrdinal(hourBranch);
  if (!m || !h) return null;
  const sum = m + h;
  const ordinal = sum > 12 ? sum - 12 : sum;
  const branch = MONTH_BRANCH_ORDER[ordinal - 1];
  return withNayin(monthStemByYearStem(yearStem, ordinal), branch);
};

export { STEMS, BRANCHES };
