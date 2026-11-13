/**
 * 紫微斗数排盘。
 *
 * 安星链：命宫 → 命宫干支 → 纳音 → 五行局 → 紫微 → 天府镜像 → 十四主星 → 六吉六煞。
 * 口径真源：constants/rulings.js 的 ZIWEI_RULINGS / SHARED_RULINGS。
 * - 闰月归本月（负数月份取绝对值）
 * - 大限阳男阴女顺、阴男阳女逆（看年干）
 * - 庙旺利陷不实现（断语层）
 */

import { Solar } from 'lunar-javascript';

import { BRANCHES_MAP } from '../constants/stems.js';
import { STEMS } from '../constants/ganzhi.js';
import { GUCHEN_GUASU } from '../constants/shensha.js';
import { normalizeGender } from '../utils/validation.js';
import { withSchool } from '../constants/rulings.js';
import { getFiveElementBureau } from './ganzhi.service.js';
import {
  ZIWEI_BRANCH_ORDER,
  ZIWEI_MONTH_BRANCH_ORDER,
  ZIWEI_PALACES,
  ZIWEI_MAJOR_STARS,
  ZIWEI_MINOR_STARS,
  ZIWEI_MALEFIC_STARS,
  ZIWEI_GROUP_OFFSETS,
  TIANFU_GROUP_OFFSETS,
  YEAR_STEM_TO_YIN_PALACE_STEM,
  KUIYUE_BY_YEAR_STEM,
  LUCUN_BY_YEAR_STEM,
  HUOLING_START_BY_YEAR_GROUP,
  TIANMA_BY_YEAR_GROUP,
  ZIWEI_SIHUA_BY_STEM,
  ZIWEI_SIHUA_TYPES,
  MINGZHU_BY_MING_BRANCH,
  SHENZHU_BY_YEAR_BRANCH,
  ZIWEI_MINOR_B_STARS,
  ZIWEI_ANCHORED_B_STARS,
  TIANWU_BY_MONTH,
  YINSHA_BY_MONTH,
  POSUI_BY_YEAR_GROUP,
  CHANGSHENG_TWELVE,
  CHANGSHENG_START_BY_BUREAU,
  BOSHI_TWELVE,
  SUIQIAN_TWELVE,
  JIANGQIAN_TWELVE,
  JIANGXING_BY_YEAR_GROUP,
  XIAOXIAN_START_BY_YEAR_GROUP,
  YANG_STEMS,
} from '../constants/ziwei.js';

const YIN_INDEX = ZIWEI_BRANCH_ORDER.indexOf('寅');

const normalizeIndex = (value, modulo = 12) => ((value % modulo) + modulo) % modulo;

const branchIndexOf = (branch) => ZIWEI_BRANCH_ORDER.indexOf(branch);

/** 子时跨日：23 时起即入次日子时，故 (hour + 1) / 2 取整。 */
const getTimeBranchIndex = (birthHour) => {
  const hour = Number(birthHour);
  if (!Number.isFinite(hour)) return 0;
  return Math.floor((hour + 1) / 2) % 12;
};

/**
 * 五虎遁排十二宫天干：年干定寅宫之干，其余各宫自寅顺排。
 * 命宫天干由此得出，再取其干支纳音定五行局。
 */
const buildPalaceStems = (yearStem) => {
  const yinStem = YEAR_STEM_TO_YIN_PALACE_STEM[yearStem];
  if (!yinStem) return null;
  const yinStemIndex = STEMS.indexOf(yinStem);
  return ZIWEI_BRANCH_ORDER.map((_, branchIdx) => {
    const offset = normalizeIndex(branchIdx - YIN_INDEX);
    return STEMS[(yinStemIndex + offset) % 10];
  });
};

/**
 * 紫微星定位。
 *
 * 取最小的 n 使 n × 局数 ≥ 生日，余数 R = n × 局数 − 生日：
 *   R 为偶数 → 自寅宫顺数 (n−1) 后，再顺行 R 位
 *   R 为奇数 → 自寅宫顺数 (n−1) 后，再逆行 R 位
 *
 * 例：水二局初一 → n=1、R=1（奇）→ 寅逆一位得丑；火六局初一 → n=1、R=5（奇）→ 寅逆五位得酉。
 * 二者均与斗数全书的紫微诸星安星表相符。
 */
const locateZiwei = (bureauValue, lunarDay) => {
  if (!bureauValue || !lunarDay) return null;
  const steps = Math.ceil(lunarDay / bureauValue);
  const remainder = steps * bureauValue - lunarDay;
  const base = YIN_INDEX + (steps - 1);
  return normalizeIndex(remainder % 2 === 0 ? base + remainder : base - remainder);
};

/**
 * 天府与紫微关于「寅—申」轴镜像对称，即 tianfu = 4 − ziwei（模 12）。
 * 紫微在寅或申时两星同宫。旧实现用的 ziwei + 6 只在个别位置巧合成立。
 */
const locateTianfu = (ziweiIndex) => normalizeIndex(4 - ziweiIndex);

const findGroupBranch = (groups, yearBranch, field) => {
  const hit = groups.find((group) => group.branches.includes(yearBranch));
  return hit ? hit[field] : null;
};

const buildPalaces = (mingIndex, palaceStems) => {
  const palaces = ZIWEI_BRANCH_ORDER.map((branch, index) => ({
    index,
    stem: palaceStems ? palaceStems[index] : null,
    branch: {
      key: branch,
      name: BRANCHES_MAP[branch]?.name || branch,
      element: BRANCHES_MAP[branch]?.element || 'Unknown',
      polarity: BRANCHES_MAP[branch]?.polarity || null,
    },
    palace: null,
    stars: { major: [], minor: [], malefic: [], minorB: [] },
    /** 四组十二神：长生、博士、岁前、将前。每宫各值一位。 */
    gods: { changsheng: null, boshi: null, suiqian: null, jiangqian: null },
    transformations: [],
  }));

  // 自命宫起**逆布**：兄弟宫在命宫前一位、父母宫在命宫后一位。
  // 用减不用加 —— 判据与常量注释同一条（阳男第二大限走父母宫）。
  ZIWEI_PALACES.forEach((palace, offset) => {
    palaces[normalizeIndex(mingIndex - offset)].palace = palace;
  });

  return palaces;
};

const STAR_REGISTRY = { ...ZIWEI_MAJOR_STARS, ...ZIWEI_MINOR_STARS, ...ZIWEI_MALEFIC_STARS };

/**
 * 三方四正：本宫 + 对宫（+6）+ 三合二宫（±4）。
 *
 * 这是斗数的第一读盘单位 —— 论任何一宫都要连它的三方四正一起看，
 * 单看本宫星曜等于只读了四分之一张盘。纯几何，无流派分歧。
 *
 * 「四正」指本宫与对宫这一组对冲，「三方」指本宫与两个三合宫，
 * 合称时习惯连本宫一起数，故返回的 palaces 含本宫自身。
 */
const trineIndexes = (index) => ({
  self: index,
  opposite: normalizeIndex(index + 6),
  trine: [normalizeIndex(index + 4), normalizeIndex(index - 4)],
});

/** 把一宫的三方四正展开成星曜清单，供调用方直接判格。 */
const collectTrine = (palaces, index) => {
  const map = trineIndexes(index);
  const members = [map.self, map.opposite, ...map.trine];
  const stars = [];
  members.forEach((memberIndex) => {
    const palace = palaces[memberIndex];
    if (!palace) return;
    const role =
      memberIndex === map.self ? 'self' : memberIndex === map.opposite ? 'opposite' : 'trine';
    ['major', 'minor', 'malefic', 'minorB'].forEach((group) => {
      palace.stars[group].forEach((star) => {
        stars.push({
          key: star.key,
          cn: star.cn,
          group,
          role,
          palaceIndex: memberIndex,
          transforms: star.transforms || [],
        });
      });
    });
  });
  return {
    indexes: map,
    branches: members.map((i) => palaces[i]?.branch?.key || null),
    stars,
  };
};

const isMale = (gender) => normalizeGender(gender) === 'male';

/**
 * 大限顺逆：阳男阴女顺行，阴男阳女逆行。阴阳看**年干**。
 */
export const getMajorPeriodDirection = (yearStem, gender) => {
  const yang = YANG_STEMS.includes(yearStem);
  const male = isMale(gender);
  return (yang && male) || (!yang && !male) ? 1 : -1;
};

/**
 * 大限：自命宫起，每宫十年，起限岁数即五行局数（水二局 2 岁上运、火六局 6 岁上运）。
 * 这里用虚岁，与斗数传统一致。
 */
export const calculateMajorPeriods = ({ mingIndex, bureauValue, yearStem, gender, count = 12 }) => {
  if (!bureauValue) return [];
  const direction = getMajorPeriodDirection(yearStem, gender);
  return Array.from({ length: count }, (_, i) => {
    const index = normalizeIndex(mingIndex + direction * i);
    const startAge = bureauValue + i * 10;
    return {
      order: i + 1,
      palaceIndex: index,
      branch: ZIWEI_BRANCH_ORDER[index],
      startAge,
      endAge: startAge + 9,
    };
  });
};

/**
 * 小限：年支三合组定起宫，男顺女逆，一岁一宫。与大限各行其是，不共用顺逆。
 */
export const calculateMinorPeriodIndex = (yearBranch, gender, age) => {
  const start = findGroupBranch(XIAOXIAN_START_BY_YEAR_GROUP, yearBranch, 'branch');
  if (!start || !Number.isFinite(age) || age < 1) return null;
  const direction = isMale(gender) ? 1 : -1;
  return normalizeIndex(branchIndexOf(start) + direction * (age - 1));
};

export const calculateZiweiChart = (data) => {
  const { birthYear, birthMonth, birthDay, birthHour } = data;
  // 未传性别时仍可排出星盘结构（大限/小限按女命顺逆占位，调用方应显式传 gender）；
  // 传了但非法则拒绝，避免「男」被静默当女。
  const hasGenderInput = data.gender !== undefined && data.gender !== null && data.gender !== '';
  const gender = hasGenderInput ? normalizeGender(data.gender) : null;
  if (hasGenderInput && !gender) return null;
  const solar = Solar.fromYmdHms(birthYear, birthMonth, birthDay, birthHour || 0, 0, 0);
  const lunar = solar.getLunar();
  const eightChar = lunar.getEightChar();

  // lunar-javascript 用**负数月份**表示闰月：闰二月 = -2。这个约定有两个后果，
  // 都必须显式处理，否则闰月出生的盘会静默算错：
  //
  // 1. 判闰月只能看正负。这个版本的 Lunar 没有 isLeap 属性/方法，
  //    早先那句 `typeof lunar.isLeap === 'function' ? ... : Boolean(lunar.isLeap)`
  //    实际恒等于 Boolean(undefined)，也就是永远 false —— 连闰月都识别不出来。
  // 2. 负数不能直接拿去查表。normalizeIndex(-2 - 1) 得 9，而二月应当是 1，
  //    月支整个错位，紫微星落宫连带全错。
  //
  // 取绝对值 = 闰月归本月（闰二月与二月落同一个月支）。这是选定的流派。
  const rawLunarMonth = lunar.getMonth();
  const isLeapMonth = rawLunarMonth < 0;
  const lunarMonth = Math.abs(rawLunarMonth);
  const lunarDay = lunar.getDay();
  const lunarYear = lunar.getYear();
  // 紫微年干支取**农历年**（正月初一换年），不是立春。
  // 五虎遁、四化、禄存羊陀、魁钺、天马、火铃、大限顺逆皆系于此。
  // 立春后～春节前若用 eightChar.getYearGan()（立春派）会与农历月日整盘不一致。
  const lunarYearGanzhi = lunar.getYearInGanZhi();
  const yearStem = lunarYearGanzhi[0];
  const yearBranch = lunarYearGanzhi[1];

  const monthBranch = ZIWEI_MONTH_BRANCH_ORDER[normalizeIndex(lunarMonth - 1)];
  const monthBranchIndex = branchIndexOf(monthBranch);
  const timeBranchIndex = getTimeBranchIndex(birthHour);

  // 寅宫起正月顺数至生月，再自生月起子时逆数至生时得命宫；身宫改顺数。
  const mingIndex = normalizeIndex(monthBranchIndex - timeBranchIndex);
  const shenIndex = normalizeIndex(monthBranchIndex + timeBranchIndex);

  const palaceStems = buildPalaceStems(yearStem);
  const mingStem = palaceStems ? palaceStems[mingIndex] : null;
  const mingBranch = ZIWEI_BRANCH_ORDER[mingIndex];
  const bureau = mingStem ? getFiveElementBureau(mingStem, mingBranch) : null;

  const ziweiIndex = bureau ? locateZiwei(bureau.value, lunarDay) : null;
  const tianfuIndex = ziweiIndex === null ? null : locateTianfu(ziweiIndex);

  const palaces = buildPalaces(mingIndex, palaceStems);

  // 本命四化：年干定四化，落在星曜所在之宫。
  const transformMap = ZIWEI_SIHUA_BY_STEM[yearStem] || {};
  const transformsByStar = Object.entries(transformMap).reduce((acc, [type, starKey]) => {
    if (!starKey) return acc;
    acc[starKey] = acc[starKey] || [];
    acc[starKey].push(type);
    return acc;
  }, {});

  const addStar = (index, starKey, group) => {
    const star = STAR_REGISTRY[starKey];
    if (index === null || !star) return;
    const target = palaces[normalizeIndex(index)];
    if (!target) return;
    const transforms = transformsByStar[starKey] || [];
    target.stars[group].push(transforms.length ? { ...star, transforms } : { ...star });
    transforms.forEach((type) => {
      target.transformations.push({
        type,
        typeCn: ZIWEI_SIHUA_TYPES[type]?.cn || type,
        starKey,
        starName: star.name,
        starCn: star.cn,
      });
    });
  };

  if (ziweiIndex !== null) {
    ZIWEI_GROUP_OFFSETS.forEach(({ key, offset }) =>
      addStar(normalizeIndex(ziweiIndex + offset), key, 'major')
    );
    TIANFU_GROUP_OFFSETS.forEach(({ key, offset }) =>
      addStar(normalizeIndex(tianfuIndex + offset), key, 'major')
    );
  }

  // 六吉星：昌曲由时支定，辅弼由生月定，魁钺由年干定。四条规则各不相同，
  // 旧实现把它们压成同一个基数加偏移，是错的。
  addStar(normalizeIndex(10 - timeBranchIndex), 'wenchang', 'minor'); // 戌宫起子时逆行
  addStar(normalizeIndex(4 + timeBranchIndex), 'wenqu', 'minor'); // 辰宫起子时顺行
  addStar(normalizeIndex(4 + (lunarMonth - 1)), 'zuofu', 'minor'); // 辰宫起正月顺行
  addStar(normalizeIndex(10 - (lunarMonth - 1)), 'youbi', 'minor'); // 戌宫起正月逆行

  const kuiyue = KUIYUE_BY_YEAR_STEM[yearStem];
  if (kuiyue) {
    addStar(branchIndexOf(kuiyue.kui), 'tiankui', 'minor');
    addStar(branchIndexOf(kuiyue.yue), 'tianyue', 'minor');
  }

  // 禄存定羊陀：擎羊在禄存前一位，陀罗在后一位。
  const lucunBranch = LUCUN_BY_YEAR_STEM[yearStem];
  if (lucunBranch) {
    const lucunIndex = branchIndexOf(lucunBranch);
    addStar(lucunIndex, 'lucun', 'minor');
    addStar(normalizeIndex(lucunIndex + 1), 'qingyang', 'malefic');
    addStar(normalizeIndex(lucunIndex - 1), 'tuoluo', 'malefic');
  }

  const tianmaBranch = findGroupBranch(TIANMA_BY_YEAR_GROUP, yearBranch, 'branch');
  if (tianmaBranch) addStar(branchIndexOf(tianmaBranch), 'tianma', 'minor');

  // 火铃：年支三合组定起点，自起点顺行至生时。
  const huoStart = findGroupBranch(HUOLING_START_BY_YEAR_GROUP, yearBranch, 'huo');
  const lingStart = findGroupBranch(HUOLING_START_BY_YEAR_GROUP, yearBranch, 'ling');
  if (huoStart)
    addStar(normalizeIndex(branchIndexOf(huoStart) + timeBranchIndex), 'huoxing', 'malefic');
  if (lingStart)
    addStar(normalizeIndex(branchIndexOf(lingStart) + timeBranchIndex), 'lingxing', 'malefic');

  // 空劫：亥宫起子时，地劫顺行、地空逆行。
  addStar(normalizeIndex(11 + timeBranchIndex), 'dijie', 'malefic');
  addStar(normalizeIndex(11 - timeBranchIndex), 'dikong', 'malefic');

  // ---- 乙级星 ----------------------------------------------------------
  // 甲级星定盘之骨，乙级星补断之肉。安星规则写在 constants 的每一条 basis 里。
  const addMinorB = (index, def) => {
    const target = palaces[normalizeIndex(index)];
    if (!target) return;
    target.stars.minorB.push({ key: def.key, cn: def.cn, basis: def.basis });
  };

  const stepValue = (kind) =>
    ({
      yearBranch: branchIndexOf(yearBranch),
      monthFrom1: lunarMonth - 1,
      hour: timeBranchIndex,
      dayFrom1: lunarDay - 1,
      dayFrom2: lunarDay - 2,
    })[kind] ?? 0;

  ZIWEI_MINOR_B_STARS.forEach((def) => {
    addMinorB(branchIndexOf(def.from) + def.dir * stepValue(def.step), def);
  });

  // 依附于他星的四颗：起宫是另一颗星所落之宫，故必须等甲级星安完再排
  const findStarIndex = (starKey) =>
    palaces.findIndex((palace) =>
      ['major', 'minor', 'malefic'].some((group) =>
        palace.stars[group].some((star) => star.key === starKey)
      )
    );
  ZIWEI_ANCHORED_B_STARS.forEach((def) => {
    const anchorIndex = findStarIndex(def.anchor);
    if (anchorIndex === -1) return;
    addMinorB(anchorIndex + def.dir * stepValue(def.step), def);
  });

  addMinorB(branchIndexOf(TIANWU_BY_MONTH[(lunarMonth - 1) % 4]), {
    key: 'tianwu',
    cn: '天巫',
    basis: '按生月四月一轮：正月巳、二月申、三月寅、四月亥',
  });
  addMinorB(branchIndexOf(YINSHA_BY_MONTH[(lunarMonth - 1) % 6]), {
    key: 'yinsha',
    cn: '阴煞',
    basis: '按生月六月一轮：正月寅、二月子、三月戌、四月申、五月午、六月辰',
  });
  const posui = POSUI_BY_YEAR_GROUP.find((entry) => entry.branches.includes(yearBranch));
  if (posui)
    addMinorB(branchIndexOf(posui.branch), { key: 'posui', cn: '破碎', basis: '按年支三合组' });
  const guhit = GUCHEN_GUASU.find((entry) => entry.branches.includes(yearBranch));
  if (guhit) {
    addMinorB(branchIndexOf(guhit.guchen), { key: 'guchen', cn: '孤辰', basis: '按年支三方组' });
    addMinorB(branchIndexOf(guhit.guasu), { key: 'guasu', cn: '寡宿', basis: '按年支三方组' });
  }

  // ---- 四组十二神 -------------------------------------------------------
  // 长生与博士分男女阴阳顺逆（判据同大限），岁前与将前一律顺行。
  // getMajorPeriodDirection 返回的是 **1 / -1**，不是字符串 —— 拿它去比 'forward'
  // 会恒为 false，于是阳男阴女那一半整体排成逆行，且盘看着仍然完整、不会报错。
  const direction = getMajorPeriodDirection(yearStem, gender);
  const fillGods = (key, names, startIndex, dir) => {
    if (startIndex === null || startIndex === undefined || startIndex < 0) return;
    names.forEach((name, offset) => {
      const target = palaces[normalizeIndex(startIndex + dir * offset)];
      if (target) target.gods[key] = name;
    });
  };
  const changshengStart = bureau ? CHANGSHENG_START_BY_BUREAU[bureau.value] : null;
  if (changshengStart) {
    fillGods('changsheng', CHANGSHENG_TWELVE, branchIndexOf(changshengStart), direction);
  }
  if (lucunBranch) {
    fillGods('boshi', BOSHI_TWELVE, branchIndexOf(lucunBranch), direction);
  }
  fillGods('suiqian', SUIQIAN_TWELVE, branchIndexOf(yearBranch), 1);
  const jiangxing = JIANGXING_BY_YEAR_GROUP.find((entry) => entry.branches.includes(yearBranch));
  if (jiangxing) fillGods('jiangqian', JIANGQIAN_TWELVE, branchIndexOf(jiangxing.branch), 1);

  // ---- 宫干四化：自化与飞化 --------------------------------------------
  /**
   * 本命四化取**年干**，只有一组；宫干四化是每一宫**各以本宫天干**再起一组四化，
   * 落到该星所在之宫。十二宫十二组，是斗数论「宫与宫之间怎么牵连」的那一层 ——
   * 此前整层没有，于是「夫妻宫化忌入财帛」这类最常用的断法一句也说不了。
   *
   * 落在本宫即**自化**（本宫之干化本宫之星），落在他宫即**飞化**（本宫飞入彼宫）。
   * 两者断法迥异，故分列而不合并：自化主「自己漏掉/自己成就」，飞化主「牵连到那一宫」。
   *
   * 必须等甲级星全部安完再算 —— 起点是星所落之宫，星没落定就找不到落点。
   */
  const starPalaceIndex = new Map();
  palaces.forEach((palace) => {
    ['major', 'minor', 'malefic'].forEach((group) => {
      palace.stars[group].forEach((star) => {
        if (!starPalaceIndex.has(star.key)) starPalaceIndex.set(star.key, palace.index);
      });
    });
  });

  /** 给定一个天干，算它的四化各落在哪一宫。星未上盘时 toPalaceIndex 为 null。 */
  const sihuaOf = (stem, fromIndex) =>
    Object.entries(ZIWEI_SIHUA_BY_STEM[stem] || {}).map(([type, starKey]) => {
      const toIndex = starPalaceIndex.has(starKey) ? starPalaceIndex.get(starKey) : null;
      return {
        type,
        typeCn: ZIWEI_SIHUA_TYPES[type]?.cn || type,
        starKey,
        starCn: STAR_REGISTRY[starKey]?.cn || null,
        fromPalaceIndex: fromIndex,
        toPalaceIndex: toIndex,
        toPalaceBranch: toIndex === null ? null : ZIWEI_BRANCH_ORDER[toIndex],
        toPalaceName: toIndex === null ? null : palaces[toIndex]?.palace?.cn || null,
        /** 化落本宫即自化。 */
        isSelf: toIndex !== null && toIndex === fromIndex,
      };
    });

  palaces.forEach((palace) => {
    if (!palace.stem) return;
    const sent = sihuaOf(palace.stem, palace.index);
    /** 本宫之干发出的四化（含自化）。 */
    palace.palaceTransformations = sent;
    /** 其中落在本宫的那些 —— 单列一份，自化是最常被单独问的一项。 */
    palace.selfTransformations = sent.filter((entry) => entry.isSelf);
  });

  // 反向索引：每宫收到了哪些宫飞来的化。发出方已经算完，这里只是换个方向读同一份数据。
  palaces.forEach((palace) => {
    palace.incomingTransformations = [];
  });
  palaces.forEach((palace) => {
    (palace.palaceTransformations || []).forEach((entry) => {
      if (entry.toPalaceIndex === null || entry.isSelf) return;
      palaces[entry.toPalaceIndex].incomingTransformations.push({
        ...entry,
        fromPalaceBranch: ZIWEI_BRANCH_ORDER[entry.fromPalaceIndex],
        fromPalaceName: palaces[entry.fromPalaceIndex]?.palace?.cn || null,
      });
    });
  });

  // ---- 身宫标记与三方四正 ----------------------------------------------
  if (palaces[shenIndex]) palaces[shenIndex].isShenPalace = true;
  palaces.forEach((palace) => {
    palace.trine = collectTrine(palaces, palace.index);
  });

  const fourTransformations = Object.entries(transformMap).map(([type, starKey]) => {
    const starDef = STAR_REGISTRY[starKey] || { key: starKey };
    return {
      type,
      typeCn: ZIWEI_SIHUA_TYPES[type]?.cn || type,
      starKey,
      starName: starDef.name || starKey,
      starCn: starDef.cn || null,
    };
  });

  const majorPeriods = calculateMajorPeriods({
    mingIndex,
    bureauValue: bureau?.value,
    yearStem,
    gender,
  });
  majorPeriods.forEach((period) => {
    const target = palaces[period.palaceIndex];
    if (!target) return;
    target.majorPeriod = {
      order: period.order,
      startAge: period.startAge,
      endAge: period.endAge,
    };
    /**
     * 大限四化取**该大限所在宫的宫干**，与本命四化（年干）、流年四化（流年干）
     * 三层各起各的，叠起来看才是斗数论运的常规读法。这一项即该宫的宫干四化，
     * 不另算一遍 —— 同一份数据换个入口给出，两处永远不会不一致。
     */
    period.stem = target.stem || null;
    period.transformations = target.palaceTransformations || [];
  });

  return withSchool('ziwei', {
    gender: gender || null,
    lunar: {
      year: lunarYear,
      month: lunarMonth,
      day: lunarDay,
      isLeap: isLeapMonth,
      yearStem,
      yearBranch,
      /** 排盘实际用的月支（农历月建，正月寅），与下面节气月柱在春节～立春窗口可能不同。 */
      monthBranchUsed: monthBranch,
      /** 以下四柱取自节气八字，供对照；紫微安星不用它们。 */
      monthStem: eightChar.getMonthGan(),
      monthBranch: eightChar.getMonthZhi(),
      dayStem: eightChar.getDayGan(),
      dayBranch: eightChar.getDayZhi(),
      timeStem: eightChar.getTimeGan(),
      timeBranch: eightChar.getTimeZhi(),
    },
    fiveElementBureau: bureau
      ? {
          key: bureau.key,
          value: bureau.value,
          cn: bureau.cn,
          element: bureau.element,
          nayin: bureau.nayin,
          mingGanzhi: `${mingStem}${mingBranch}`,
        }
      : null,
    mingPalace: {
      index: mingIndex,
      stem: mingStem,
      branch: palaces[mingIndex]?.branch,
      palace: palaces[mingIndex]?.palace,
    },
    shenPalace: {
      index: shenIndex,
      stem: palaceStems ? palaceStems[shenIndex] : null,
      branch: palaces[shenIndex]?.branch,
      palace: palaces[shenIndex]?.palace,
    },
    starPositions: {
      ziwei: ziweiIndex,
      tianfu: tianfuIndex,
    },
    /** 命主由命宫地支定，身主由生年地支定 —— 两者判据不同，不要互相代入。 */
    mingZhu: MINGZHU_BY_MING_BRANCH[mingBranch] || null,
    shenZhu: SHENZHU_BY_YEAR_BRANCH[yearBranch] || null,
    majorPeriods,
    majorPeriodDirection: getMajorPeriodDirection(yearStem, gender),
    fourTransformations,
    palaces,
  });
};

/**
 * 流年盘：流年地支所在之宫即流年命宫；同时给出该年所值的大限与小限。
 * age 用虚岁（出生即一岁），与大限小限的口径保持一致。
 */
export const calculateFlowYear = (chart, targetYear) => {
  if (!chart || !Number.isFinite(targetYear)) return null;
  const birthLunarYear = chart.lunar.year;
  const age = targetYear - birthLunarYear + 1;
  if (age < 1) return null;

  const flowYearGanzhi = Solar.fromYmd(targetYear, 7, 1).getLunar().getYearInGanZhi();
  const flowBranch = flowYearGanzhi[1];
  const flowIndex = branchIndexOf(flowBranch);

  const majorPeriod = chart.majorPeriods.find((p) => age >= p.startAge && age <= p.endAge) || null;
  const minorIndex = calculateMinorPeriodIndex(chart.lunar.yearBranch, chart.gender, age);

  return {
    year: targetYear,
    age,
    ganzhi: flowYearGanzhi,
    stem: flowYearGanzhi[0],
    branch: flowBranch,
    palaceIndex: flowIndex,
    palace: chart.palaces[flowIndex]?.palace || null,
    majorPeriod,
    minorPeriodIndex: minorIndex,
    minorPeriodBranch: minorIndex === null ? null : ZIWEI_BRANCH_ORDER[minorIndex],
    // 流年四化由流年天干起，与本命四化叠加论断
    flowTransformations: Object.entries(ZIWEI_SIHUA_BY_STEM[flowYearGanzhi[0]] || {}).map(
      ([type, starKey]) => ({
        type,
        typeCn: ZIWEI_SIHUA_TYPES[type]?.cn || type,
        starKey,
        starCn: STAR_REGISTRY[starKey]?.cn || null,
      })
    ),
  };
};

export { locateZiwei, locateTianfu, buildPalaceStems, getTimeBranchIndex };
