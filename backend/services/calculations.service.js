/**
 * 八字排盘入口：四柱由 lunar-javascript 排出，真太阳时由本层校正。
 *
 * 口径真源：constants/rulings.js（SHARED_RULINGS + BAZI_RULINGS）。
 * - 晚子时不换日（库默认，无开关）
 * - 节气交节精确到分（库 + jieqi.service 共用）
 * - 给齐出生地与时区时默认用真太阳时；trueSolarTime:false 退回钟表时间
 * - 断命层（藏干加权/旺衰/用神）在 bazi.service，结果挂在 analysis
 */

import { Solar } from 'lunar-javascript';

import { STEMS_MAP, BRANCHES_MAP, ELEMENTS } from '../constants/stems.js';
import { withSchool } from '../constants/rulings.js';
import { normalizeGender } from '../utils/validation.js';
import { createInFlightDeduper } from '../lib/concurrency.js';
import {
  parseTimezoneOffsetMinutes,
  formatTimezoneOffset,
  buildBirthTimeMeta,
} from '../utils/timezone.js';
import {
  buildBaziCacheKey,
  getCachedBaziCalculationAsync,
  setBaziCacheEntry,
  primeBaziCalculationCache,
} from './cache.service.js';
import { analyzeChart, getTenGod } from './bazi.service.js';
import { getNayin, detectBranchRelations } from './ganzhi.service.js';
import {
  normalizeLocationKey,
  resolveLocationCoordinates,
  describeLocationResolution,
  computeTrueSolarTime,
  listKnownLocations,
  isChinaLocation,
  DEFAULT_CHINA_TIMEZONE,
} from './solarTime.service.js';

// 兼容旧 import 路径；干支表真源在 constants/stems.js。
export { STEMS_MAP, BRANCHES_MAP, ELEMENTS };
export {
  normalizeLocationKey,
  resolveLocationCoordinates,
  describeLocationResolution,
  computeTrueSolarTime,
  listKnownLocations,
  isChinaLocation,
  DEFAULT_CHINA_TIMEZONE,
};

/** 晚子时不换日（日柱当日、时干按次日遁）。钉死，避免库默认变更时全站静默翻派。 */
const BAZI_DAY_SECT = 2;

/**
 * 把「某时区的墙钟数字」换算成 Asia/Shanghai 墙钟数字。
 * lunar-javascript 的节气表是东八区墙钟语义；海外出生必须先换到这个坐标系再排盘。
 *
 * 中国墙钟不二次换算：IANA 中国区或裸 +8。裸 +9 / 东京 / 首尔必须换算，
 * 否则会把日韩时间当中国排盘，交节日可错年柱。
 */
const CHINA_IANA = /^(Asia\/(Shanghai|Chongqing|Harbin|Kashgar|Urumqi)|PRC)$/i;

/** 北京标准时。lunar-javascript 的节气表、国内排盘的时辰，都在这个坐标系上。 */
const CHINA_STANDARD_OFFSET_MINUTES = 480;

const isChinaIana = (timezone) => typeof timezone === 'string' && CHINA_IANA.test(timezone.trim());

const isChinaWallClockInput = (data, offsetMinutes) => {
  if (isChinaIana(data?.timezone)) return true;
  return offsetMinutes === CHINA_STANDARD_OFFSET_MINUTES;
};

/** 墙钟整体平移若干分钟（跨日跨月由 Date 进位）。 */
const shiftWallClock = (wall, minutes) => {
  const d = new Date(
    Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, 0) + minutes * 60000
  );
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
  };
};

const wallClockToShanghai = (wall, offsetMinutes, data = {}) => {
  if (!Number.isFinite(offsetMinutes)) return { ...wall };
  if (isChinaWallClockInput(data, offsetMinutes)) return { ...wall };
  const absMs =
    Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, 0) -
    offsetMinutes * 60 * 1000;
  /**
   * 参照系是**固定 UTC+8**，不是 IANA 的 Asia/Shanghai：lunar-javascript 的节气表按北京标准时给出，
   * 1986–1991 夏季 IANA 会报 +9，若照它换算，一个裸 +9 偏移的输入（东京，或把当年夏令时墙钟
   * 当作 +9 传进来）会被原样送回 —— 该减的一小时没减，交节日错月柱。
   */
  const shMs = absMs + CHINA_STANDARD_OFFSET_MINUTES * 60 * 1000;
  const d = new Date(shMs);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
  };
};

// Collapse concurrent identical chart requests into one performCalculation. Without this,
// a cold-cache burst (or a multi-instance stampede before Redis fills) pays N times the
// CPU cost for the same birth data and races on the cache write.
const baziCalculationDeduper = createInFlightDeduper();

const coerceInt = (value) => {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return null;
  return Math.trunc(numberValue);
};

const parseJsonField = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

export function getElementRelation(me, other) {
  if (me === other) return 'Same';
  const meIdx = ELEMENTS.indexOf(me);
  const otherIdx = ELEMENTS.indexOf(other);
  if (meIdx === -1 || otherIdx === -1) return 'Unknown';
  if ((meIdx + 1) % 5 === otherIdx) return 'Generates';
  if ((otherIdx + 1) % 5 === meIdx) return 'GeneratedBy';
  if ((meIdx + 2) % 5 === otherIdx) return 'Controls';
  if ((otherIdx + 2) % 5 === meIdx) return 'ControlledBy';
  return 'Unknown';
}

export function calculateTenGod(dayMasterStemVal, targetStemVal) {
  const dm = STEMS_MAP[dayMasterStemVal];
  const target = STEMS_MAP[targetStemVal];
  if (!dm || !target) return 'Unknown';
  const relation = getElementRelation(dm.element, target.element);
  const samePolarity = dm.polarity === target.polarity;
  switch (relation) {
    case 'Same':
      return samePolarity ? 'Friend (Bi Jian)' : 'Rob Wealth (Jie Cai)';
    case 'Generates':
      return samePolarity ? 'Eating God (Shi Shen)' : 'Hurting Officer (Shang Guan)';
    case 'GeneratedBy':
      return samePolarity ? 'Indirect Resource (Pian Yin)' : 'Direct Resource (Zheng Yin)';
    case 'Controls':
      return samePolarity ? 'Indirect Wealth (Pian Cai)' : 'Direct Wealth (Zheng Cai)';
    case 'ControlledBy':
      return samePolarity ? 'Seven Killings (Qi Sha)' : 'Direct Officer (Zheng Guan)';
    default:
      return 'Unknown';
  }
}

export function buildPillar(ganChar, zhiChar) {
  const ganInfo = STEMS_MAP[ganChar] || { name: ganChar, element: 'Unknown' };
  const zhiInfo = BRANCHES_MAP[zhiChar] || { name: zhiChar, element: 'Unknown' };
  return {
    stem: ganInfo.name,
    branch: zhiInfo.name,
    elementStem: ganInfo.element,
    elementBranch: zhiInfo.element,
    charStem: ganChar,
    charBranch: zhiChar,
  };
}

/**
 * 定出用于排盘的实际时刻。
 *
 * **时间体系以中国为主**（命理实务默认）：
 *
 * 1. **输入墙钟默认是中国民用时间**（北京时间 / 东八区语义）。不给 timezone 时，
 *    年月日时数字直接进 lunar-javascript 节气表，与国内主流排盘一致。
 * 2. **中国出生地 + 缺时区 → 默认 Asia/Shanghai**。全国钟表统一按北京时间记录，
 *    真太阳时只靠经度相对 120°E 回拨；乌鲁木齐等西部也走这条，不必再传 timezone。
 * 3. **海外必须显式传 timezone**。给了非中国 IANA 时，先换算成东八区墙钟再比节气，
 *    否则交节日会错年/月。
 * 4. **真太阳时**：有经度且有时区偏移（含中国默认）时参与排盘；
 *    `trueSolarTime: false` 可关。
 */
export const resolveChartTime = (data) => {
  const minute = coerceInt(data.birthMinute) ?? 0;

  const clock = {
    year: data.birthYear,
    month: data.birthMonth,
    day: data.birthDay,
    hour: data.birthHour || 0,
    minute,
  };

  const location =
    data.trueSolarTime === false ? null : resolveLocationCoordinates(data.birthLocation);

  // 中国为主：中国地点未给时区时默认北京时间，真太阳时才能落地
  let timezone = data.timezone;
  let timezoneOffsetMinutes = data.timezoneOffsetMinutes;
  let timezoneDefaulted = false;
  const explicitTz =
    (typeof timezone === 'string' && timezone.trim()) ||
    Number.isFinite(Number(timezoneOffsetMinutes));
  if (!explicitTz && location && isChinaLocation(location) && data.trueSolarTime !== false) {
    timezone = DEFAULT_CHINA_TIMEZONE;
    timezoneDefaulted = true;
  }

  const meta = buildBirthTimeMeta({
    birthYear: data.birthYear,
    birthMonth: data.birthMonth,
    birthDay: data.birthDay,
    birthHour: data.birthHour,
    birthMinute: minute,
    timezone,
    timezoneOffsetMinutes,
  });

  /**
   * 中国夏令时归一。1986–1991 年夏季全国墙钟拨快一小时，IANA 对那段时间的 Asia/Shanghai
   * 给出 +9。此前对中国 IANA 一律短路不换算，于是夏令时墙钟被原样拿去比东八区节气表、
   * 排时辰：1988-08-07 15:40（夏令时，标准时 14:40，立秋 15:20 之前）传 Asia/Shanghai
   * 会排成立秋后的庚申月、申时，而正解是己未月、未时。
   *
   * 处理：偏移不等于 +8 的中国墙钟先减去多出的那一小时归一到北京标准时，之后一律按
   * +8 / 120°E 走 —— 真太阳时的经度校正与此前按 +9 / 135°E 算的结果逐分相同，
   * 已给出生地的盘不受影响；不给地点只给时区的盘才会变（变成对的那张）。
   * 不给 timezone 的输入不动：那条路径按文档就是「输入即北京标准时」。
   */
  let chartClock = clock;
  let offset = meta?.timezoneOffsetMinutes;
  let dstNormalized = null;
  if (
    Number.isFinite(offset) &&
    offset !== CHINA_STANDARD_OFFSET_MINUTES &&
    isChinaIana(timezone)
  ) {
    const shiftMinutes = CHINA_STANDARD_OFFSET_MINUTES - offset;
    chartClock = shiftWallClock(clock, shiftMinutes);
    dstNormalized = {
      timezone,
      offsetMinutes: offset,
      shiftMinutes,
      clockTime: { ...clock },
      standardTime: { ...chartClock },
    };
    offset = CHINA_STANDARD_OFFSET_MINUTES;
  }

  const effectiveData = { ...data, timezone, timezoneOffsetMinutes: offset };
  const locationResolution = describeLocationResolution({
    ...effectiveData,
    birthLocation: data.birthLocation,
    timezoneOffsetMinutes: offset ?? null,
  });
  if (timezoneDefaulted && locationResolution.status === 'applied') {
    locationResolution.timezoneDefaulted = DEFAULT_CHINA_TIMEZONE;
    locationResolution.hint =
      locationResolution.hint ||
      `未传 timezone，中国地点已默认 ${DEFAULT_CHINA_TIMEZONE}（北京时间）做真太阳时。`;
  }

  const hasTz = Number.isFinite(offset);

  /**
   * 排盘要的是**两个**时刻，不是一个：
   *
   * - 顶层 year/month/day/hour/minute 是**当地**时刻（含真太阳时校正）。日柱与时柱
   *   按它定 —— 时辰本就是当地太阳位置，纽约中午必须是午时。
   * - `termReference` 是同一时刻换算成的**东八区墙钟**。年柱月柱看节气，节气是绝对
   *   时刻而 lunar-javascript 的节气表是东八区语义，不换算则交节日会错年/月。
   *
   * 中国墙钟两者相同（wallClockToShanghai 原样返回），国内路径行为不变。
   */
  const termOf = (wall) => (hasTz ? wallClockToShanghai(wall, offset, effectiveData) : { ...wall });

  const resolved = (wall, extra) => ({
    ...wall,
    termReference: termOf(wall),
    /** 夏令时归一记录；未归一为 null。 */
    dstNormalized,
    ...extra,
  });

  if (data.trueSolarTime === false) {
    return resolved(chartClock, {
      trueSolarTime: null,
      locationResolution: describeLocationResolution({
        ...data,
        timezoneOffsetMinutes: offset ?? null,
      }),
    });
  }

  if (!location || !hasTz) {
    return resolved(chartClock, { trueSolarTime: null, locationResolution });
  }

  // 真太阳时在（已归一的）墙钟上校正（中国默认相对 120°E）
  const corrected = computeTrueSolarTime({
    birthYear: chartClock.year,
    birthMonth: chartClock.month,
    birthDay: chartClock.day,
    birthHour: chartClock.hour,
    birthMinute: chartClock.minute,
    timezoneOffsetMinutes: offset,
    longitude: location.longitude,
  });
  if (!corrected?.corrected) {
    return resolved(chartClock, { trueSolarTime: null, locationResolution });
  }

  const dstShift = dstNormalized ? dstNormalized.shiftMinutes : 0;
  return resolved(corrected.corrected, {
    locationResolution,
    trueSolarTime: {
      applied: true,
      /** 相对**输入墙钟**的总校正 = 夏令时归一 + 经度差 + 均时差，恒等于 used − clockTime。 */
      correctionMinutes: Math.round((corrected.correctionMinutes + dstShift) * 100) / 100,
      longitudeCorrection: corrected.longitudeCorrection,
      eotCorrection: corrected.eotCorrection,
      /** 夏令时归一那一截；非夏令时为 0。 */
      dstCorrection: dstShift,
      timezoneDefaulted: timezoneDefaulted ? DEFAULT_CHINA_TIMEZONE : null,
      // clockTime 是「校正前的输入墙钟」，只该有时刻本身
      clockTime: { ...clock },
      location: {
        name: location.name || null,
        cn: location.cn ?? null,
        region: location.region || (isChinaLocation(location) ? 'cn' : null),
        latitude: location.latitude,
        longitude: location.longitude,
      },
    },
  });
};

export const performCalculation = (data) => {
  // 性别必须已是 male/female；非法值不静默当女（会反转大运顺逆）
  const gender = normalizeGender(data.gender);
  if (!gender) {
    throw new Error('gender must be male or female');
  }
  const chartTime = resolveChartTime(data);

  // 显式钉死晚子时不换日，不依赖库默认 sect
  const buildEightChar = (t) => {
    const ec = Solar.fromYmdHms(t.year, t.month, t.day, t.hour, t.minute, 0)
      .getLunar()
      .getEightChar();
    if (typeof ec.setSect === 'function') ec.setSect(BAZI_DAY_SECT);
    return ec;
  };

  /**
   * 日时柱按**当地**时刻，年月柱与大运按换算到东八区的时刻 —— 见 resolveChartTime。
   * 中国墙钟两者是同一时刻，此时复用同一个 eightChar，国内路径与从前逐字节一致。
   */
  const term = chartTime.termReference || chartTime;
  const sameFrame =
    term.year === chartTime.year &&
    term.month === chartTime.month &&
    term.day === chartTime.day &&
    term.hour === chartTime.hour &&
    term.minute === chartTime.minute;

  const eightChar = buildEightChar(chartTime);
  const termEightChar = sameFrame ? eightChar : buildEightChar(term);

  // 年月柱看节气（绝对时刻），日时柱看当地时辰。各自的干支推导都在同一个对象内闭合：
  // 月干由年干起五虎遁、时干由日干起五鼠遁，跨对象取不会串。
  const yearPillar = buildPillar(termEightChar.getYearGan(), termEightChar.getYearZhi());
  const monthPillar = buildPillar(termEightChar.getMonthGan(), termEightChar.getMonthZhi());
  const dayPillar = buildPillar(eightChar.getDayGan(), eightChar.getDayZhi());
  const hourPillar = buildPillar(eightChar.getTimeGan(), eightChar.getTimeZhi());

  const pillars = { year: yearPillar, month: monthPillar, day: dayPillar, hour: hourPillar };

  const counts = { Wood: 0, Fire: 0, Earth: 0, Metal: 0, Water: 0 };
  const addCount = (el) => {
    if (counts[el] !== undefined) counts[el]++;
  };
  [yearPillar, monthPillar, dayPillar, hourPillar].forEach((p) => {
    addCount(p.elementStem);
    addCount(p.elementBranch);
  });
  const totalElements = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const fiveElementsPercent = ELEMENTS.reduce((acc, element) => {
    acc[element] = totalElements ? Math.round((counts[element] / totalElements) * 100) : 0;
    return acc;
  }, {});

  const dayMasterChar = eightChar.getDayGan();
  const tenGodsCounts = {};
  const allTenGodsTypes = [
    'Friend (Bi Jian)',
    'Rob Wealth (Jie Cai)',
    'Eating God (Shi Shen)',
    'Hurting Officer (Shang Guan)',
    'Indirect Wealth (Pian Cai)',
    'Direct Wealth (Zheng Cai)',
    'Seven Killings (Qi Sha)',
    'Direct Officer (Zheng Guan)',
    'Indirect Resource (Pian Yin)',
    'Direct Resource (Zheng Yin)',
  ];
  allTenGodsTypes.forEach((t) => (tenGodsCounts[t] = 0));

  const getCharStemEquivalent = (char) => {
    if (STEMS_MAP[char]) return char;
    const branchToMainQi = {
      子: '癸',
      丑: '己',
      寅: '甲',
      卯: '乙',
      辰: '戊',
      巳: '丙',
      午: '丁',
      未: '己',
      申: '庚',
      酉: '辛',
      戌: '戊',
      亥: '壬',
    };
    return branchToMainQi[char];
  };

  [
    yearPillar.charStem,
    yearPillar.charBranch,
    monthPillar.charStem,
    monthPillar.charBranch,
    dayPillar.charBranch,
    hourPillar.charStem,
    hourPillar.charBranch,
  ].forEach((char) => {
    const stemVal = getCharStemEquivalent(char);
    if (stemVal) {
      const tg = calculateTenGod(dayMasterChar, stemVal);
      if (tenGodsCounts[tg] !== undefined) tenGodsCounts[tg] += 10;
      else if (tg.includes('Friend')) tenGodsCounts['Friend (Bi Jian)'] += 10;
    }
  });

  // 顶层 tenGods 的 name 是历史遗留的英文串，保留以免破坏既有调用方；
  // 补上 cn 让它与 analysis.pillarDetails 里的十神口径一致，不再一份数据两种语言。
  const TEN_GOD_CN = {
    'Friend (Bi Jian)': '比肩',
    'Rob Wealth (Jie Cai)': '劫财',
    'Eating God (Shi Shen)': '食神',
    'Hurting Officer (Shang Guan)': '伤官',
    'Indirect Wealth (Pian Cai)': '偏财',
    'Direct Wealth (Zheng Cai)': '正财',
    'Seven Killings (Qi Sha)': '七杀',
    'Direct Officer (Zheng Guan)': '正官',
    'Indirect Resource (Pian Yin)': '偏印',
    'Direct Resource (Zheng Yin)': '正印',
  };
  const tenGods = Object.entries(tenGodsCounts).map(([name, val]) => ({
    name,
    cn: TEN_GOD_CN[name] || null,
    strength: val,
  }));

  const genderInt = gender === 'male' ? 1 : 0;
  // sect=2：按分钟折算起运（4320 分=1 年），比默认时辰法更贴近主流网盘交运日。
  // 起运是「到交节还差多久」，是绝对时长，故与年月柱同取东八区那个坐标系。
  const yun = termEightChar.getYun(genderInt, 2);
  const daYunArr = yun.getDaYun();
  const dayMasterForLuck = eightChar.getDayGan();
  // daYunArr[0] 是起运之前的那段（只行小运，无大运干支），故自 1 起取八步。
  const luckCycles = daYunArr.slice(1, 9).map((dy) => {
    const startAge = dy.getStartAge();
    const endAge = dy.getEndAge();
    const startYear = typeof dy.getStartYear === 'function' ? dy.getStartYear() : null;
    const endYear = typeof dy.getEndYear === 'function' ? dy.getEndYear() : null;
    const ganZhi = dy.getGanZhi();
    const gan = ganZhi.substring(0, 1);
    const zhi = ganZhi.substring(1, 2);
    return {
      range: `${startAge}-${endAge}`,
      stem: STEMS_MAP[gan]?.name || gan,
      branch: BRANCHES_MAP[zhi]?.name || zhi,
      startYear,
      endYear,
      ganZhi,
      charStem: gan,
      charBranch: zhi,
      stemTenGod: getTenGod(dayMasterForLuck, gan),
      nayin: getNayin(gan, zhi),
      liuNian:
        typeof dy.getLiuNian === 'function'
          ? dy.getLiuNian().map((ln) => {
              const lnGanZhi = ln.getGanZhi();
              return {
                year: ln.getYear(),
                age: ln.getAge(),
                ganZhi: lnGanZhi,
                charStem: lnGanZhi.substring(0, 1),
                charBranch: lnGanZhi.substring(1, 2),
                stemTenGod: getTenGod(dayMasterForLuck, lnGanZhi.substring(0, 1)),
              };
            })
          : [],
    };
  });

  // 起运：还需几年几月几天，以及交运的公历日期。旧实现只给年龄区间，
  // 交运具体落在哪一天看不出来，跨年出生的人差一天就差一步运。
  const startSolar = typeof yun.getStartSolar === 'function' ? yun.getStartSolar() : null;
  const luckStart = {
    years: yun.getStartYear(),
    months: yun.getStartMonth(),
    days: yun.getStartDay(),
    /** 不足一日折成的小时。solarDate 已把它进位在内，只按年月日往出生日上加会差一天。 */
    hours: typeof yun.getStartHour === 'function' ? yun.getStartHour() : 0,
    solarDate: startSolar ? startSolar.toYmd() : null,
  };

  // fiveElements/tenGods 保留原义（干支个数统计），供既有调用方使用；
  // 真正用于断命的藏干加权、旺衰、用神、神煞在 analysis 里，见 bazi.service.js。
  // school 字段标明本盘所用流派口径，见 constants/rulings.js。
  return withSchool('bazi', {
    pillars,
    fiveElements: counts,
    fiveElementsPercent,
    tenGods,
    luckCycles,
    luckStart,
    analysis: analyzeChart(pillars),
    chartTime: {
      used: {
        year: chartTime.year,
        month: chartTime.month,
        day: chartTime.day,
        hour: chartTime.hour,
        minute: chartTime.minute,
      },
      /**
       * `used` 换算成东八区墙钟的样子 —— 年柱月柱与起运就是拿它去比节气的。
       * 中国墙钟与 `used` 相同；海外出生两者会差出整整一个时区，
       * 日时柱按 `used`（当地时辰）、年月柱按这里，两个都要能被核对。
       */
      termReference: chartTime.termReference || null,
      /** 中国夏令时（1986–1991）归一记录：输入墙钟、归一后的标准时、平移分钟数。非夏令时为 null。 */
      dstNormalized: chartTime.dstNormalized || null,
      trueSolarTime: chartTime.trueSolarTime,
      /**
       * 出生地为什么没能参与排盘 —— `trueSolarTime: null` 把「没填」「关掉了」
       * 「填了但认不出」压成了同一个值，只有最后一种需要调用方改输入。
       */
      locationResolution: chartTime.locationResolution,
    },
  });
};

export const hasFullBaziResult = (result) => {
  if (!result || typeof result !== 'object') return false;
  return !!(result.pillars && result.fiveElements && result.tenGods && result.luckCycles);
};

/**
 * `analyzeChart` 当前会给出的全部顶层字段。
 *
 * 存在的理由是缓存：缓存里那份 analysis 是**上一版引擎**算出来的，字段可能比现在少。
 * 只判「有没有 analysis」不够 —— 旧缓存是有 analysis 的，只是缺了新增的那几项，
 * 于是升级后它会**继续把上一版的结论当成当前结论发出去**，而且一切看着正常。
 *
 * 这一条在 specialPattern 上会直接变成线上事故：从格盘的旧缓存里存着的
 * `usefulGod` 正是方向相反的那一份，不重算就一直发到 TTL 过期为止。
 *
 * 往 analyzeChart 里加字段时**必须同步加到这里**；忘了也不会漏 ——
 * `baziCache.test.js` 有一条断言拿 analyzeChart 的真实返回逐键比对这张表。
 */
const ANALYSIS_FIELDS = [
  'dayMaster',
  'pillarDetails',
  'weightedElements',
  'strength',
  'usefulGod',
  'specialPattern',
  'tiaohou',
  'monthlyStructure',
  'shensha',
  'relations',
  'xunkong',
  'keyPoints',
];

/** 缓存里的 analysis 是否出自旧版引擎（缺字段即算旧）。 */
const isStaleAnalysis = (analysis) =>
  !analysis || ANALYSIS_FIELDS.some((field) => analysis[field] === undefined);

const enrichCachedBaziResult = (cached) => {
  // 旧缓存可能缺 analysis / school，或 analysis 出自旧版引擎；就地补齐，不整条重排四柱。
  let result = cached;
  if (isStaleAnalysis(result.analysis)) {
    result = { ...result, analysis: analyzeChart(result.pillars) };
  }
  if (!result.school) {
    result = withSchool('bazi', result);
  }
  return result;
};

export { ANALYSIS_FIELDS };

export const getBaziCalculation = async (data, { bypassCache = false } = {}) => {
  const cacheKey = buildBaziCacheKey(data);
  if (!bypassCache && cacheKey) {
    const cached = await getCachedBaziCalculationAsync(cacheKey);
    if (cached && hasFullBaziResult(cached)) {
      // 引入 analysis 之前写入的缓存条目缺这一段，就地补算而不是整条丢弃重排四柱。
      return enrichCachedBaziResult(cached);
    }
  }

  const compute = () => {
    const result = performCalculation(data);
    if (cacheKey) setBaziCacheEntry(cacheKey, result);
    return result;
  };

  // No key (incomplete birth data) → nothing to dedupe on; run once and return.
  if (!cacheKey) return compute();

  const { promise } = baziCalculationDeduper.getOrCreate(cacheKey, async () => {
    // Another waiter may have filled the cache while we were queued on the same key.
    if (!bypassCache) {
      const cached = await getCachedBaziCalculationAsync(cacheKey);
      if (cached && hasFullBaziResult(cached)) {
        return enrichCachedBaziResult(cached);
      }
    }
    return compute();
  });
  return promise;
};

export const buildImportRecord = async (raw, userId) => {
  if (!raw || typeof raw !== 'object') return null;
  const birthYear = coerceInt(raw.birthYear);
  const birthMonth = coerceInt(raw.birthMonth);
  const birthDay = coerceInt(raw.birthDay);
  const birthHour = coerceInt(raw.birthHour);
  const gender = typeof raw.gender === 'string' ? raw.gender.trim() : '';
  if (!birthYear || !birthMonth || !birthDay || birthHour === null || !gender) return null;

  let pillars = parseJsonField(raw.pillars);
  let fiveElements = parseJsonField(raw.fiveElements);
  let tenGods = parseJsonField(raw.tenGods);
  let luckCycles = parseJsonField(raw.luckCycles);

  if (!pillars || !fiveElements) {
    const computed = await getBaziCalculation({
      birthYear,
      birthMonth,
      birthDay,
      birthHour,
      gender,
    });
    if (!pillars) pillars = computed.pillars;
    if (!fiveElements) fiveElements = computed.fiveElements;
    if (!tenGods) tenGods = computed.tenGods;
    if (!luckCycles) luckCycles = computed.luckCycles;
  }
  primeBaziCalculationCache(
    { birthYear, birthMonth, birthDay, birthHour, gender },
    { pillars, fiveElements, tenGods, luckCycles }
  );

  const createdAtRaw = raw.createdAt ? new Date(raw.createdAt) : null;
  const createdAt = createdAtRaw && !Number.isNaN(createdAtRaw.getTime()) ? createdAtRaw : null;
  const updatedAtRaw = raw.updatedAt ? new Date(raw.updatedAt) : null;
  const updatedAt = updatedAtRaw && !Number.isNaN(updatedAtRaw.getTime()) ? updatedAtRaw : null;

  const timezoneOffset = parseTimezoneOffsetMinutes(raw.timezoneOffsetMinutes);
  const timezoneFallback = Number.isFinite(timezoneOffset)
    ? formatTimezoneOffset(timezoneOffset)
    : null;

  return {
    userId,
    birthYear,
    birthMonth,
    birthDay,
    birthHour,
    gender,
    birthLocation: typeof raw.birthLocation === 'string' ? raw.birthLocation : null,
    timezone: typeof raw.timezone === 'string' ? raw.timezone : timezoneFallback,
    pillars: JSON.stringify(pillars),
    fiveElements: JSON.stringify(fiveElements),
    tenGods: JSON.stringify(tenGods),
    luckCycles: JSON.stringify(luckCycles),
    createdAt,
    updatedAt,
  };
};

export const calculateDailyPillars = (date = new Date()) => {
  const solar = Solar.fromYmd(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const lunar = solar.getLunar();
  const eightChar = lunar.getEightChar();

  // Create simple pillar objects for the day
  const dayPillar = buildPillar(eightChar.getDayGan(), eightChar.getDayZhi());

  return {
    // 干支按 date 的本地年月日算出，date 字段就必须同样用本地日期。
    // 走 toISOString 会在 UTC 之东的时区把日期整体退一天，与干支自相矛盾。
    date: `${solar.getYear()}-${String(solar.getMonth()).padStart(2, '0')}-${String(
      solar.getDay()
    ).padStart(2, '0')}`,
    stem: dayPillar.stem,
    branch: dayPillar.branch,
    elementStem: dayPillar.elementStem,
    elementBranch: dayPillar.elementBranch,
    charStem: dayPillar.charStem,
    charBranch: dayPillar.charBranch,
  };
};

export const calculateDailyScore = (userChart, dailyPillars) => {
  if (!userChart || !dailyPillars) return { score: 50, advice: 'Stay balanced.' };

  let score = 60; // Base score
  let advice = [];

  const dmElement = userChart.pillars.day.elementStem;
  const dayElement = dailyPillars.elementStem;

  // Element Relationship
  const relation = getElementRelation(dayElement, dmElement); // Day acts on Me

  // 断语一律用中文：能力层面向的是中文使用者，英文只留给 README.en 那类介绍文件
  if (relation === 'Generates') {
    score += 15;
    advice.push('流日生扶日主，得力之日。');
  } else if (relation === 'Same') {
    score += 10;
    advice.push('流日与日主同气，宜与人协作。');
  } else if (relation === 'Controls') {
    score -= 10;
    advice.push('流日克身，压力偏重，宜守不宜进。');
  } else if (relation === 'ControlledBy') {
    score += 5; // 日主克流日，多为财星
    advice.push('日主克流日，多主财利，然须费力方得。');
  } else {
    // GeneratedBy：日主生流日，为食伤泄秀
    score += 5;
    advice.push('日主生流日，泄秀之象，宜表达创作。');
  }

  // 流日地支与本命日支的关系。这里曾经另抄了一份罗马字的六冲表，既与
  // constants/ganzhi.js 的那份重复，又只认冲、看不见合刑害 —— 改为直接走基础层。
  const userBranch = userChart.pillars.day.charBranch;
  const dayBranch = dailyPillars.charBranch;
  const relations = detectBranchRelations([userBranch, dayBranch].filter(Boolean));

  const branchEffects = [];
  relations.clashes.forEach((c) => {
    score -= 20;
    branchEffects.push({ type: 'clash', cn: c.cn });
    advice.push('流日地支冲本命日支，事多阻滞。');
  });
  relations.sixCombinations.forEach((c) => {
    score += 10;
    branchEffects.push({ type: 'sixCombination', cn: c.cn });
    advice.push('流日地支合本命日支，事易谐和。');
  });
  relations.punishments.forEach((p) => {
    score -= 10;
    branchEffects.push({ type: 'punishment', cn: p.cn });
  });
  relations.harms.forEach((h) => {
    score -= 5;
    branchEffects.push({ type: 'harm', cn: h.cn });
  });

  // Normalize
  score = Math.max(0, Math.min(100, score));

  return {
    score,
    advice: advice.join(' '),
    element: dayElement,
    // score 是按上面几条规则折算的粗略指标，真正可断的是这里的客观关系
    branchRelations: branchEffects,
    dayMasterRelation: relation,
    dayMasterRelationCn:
      {
        Same: '同气',
        Generates: '生身',
        GeneratedBy: '泄秀',
        Controls: '克身',
        ControlledBy: '为财',
      }[relation] || null,
  };
};
