/**
 * 周易起卦。
 *
 * 两种起法都出自梅花易数，先天八卦数为准（乾一兑二离三震四巽五坎六艮七坤八）：
 *
 * - **三数起卦**：一数定上卦，二数定下卦，三数之和定动爻。给定数字即确定性。
 * - **时间起卦**：年支数、农历月、农历日、时支数四者相加取卦。
 *
 * 时间起卦：年支序数（子一至亥十二）+ 农历月日 + 时支序数；分钟不入卦，动爻唯一。
 * 口径真源：constants/rulings.js 的 ICHING_RULINGS。
 */

import { Solar } from 'lunar-javascript';

import {
  TRIGRAMS,
  hexagramByTrigrams,
  hexagramByLines,
  getYaoText,
} from '../data/ichingHexagrams.js';

/** 地支序数：子一、丑二……亥十二。梅花易数的年数与时数都取它。 */
const BRANCH_ORDER = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const branchNumber = (branch) => {
  const index = BRANCH_ORDER.indexOf(branch);
  return index === -1 ? null : index + 1;
};

const normalizeNumber = (value, modulo) => {
  const safe = Math.abs(Number(value));
  if (!Number.isFinite(safe)) return null;
  const remainder = safe % modulo;
  return remainder === 0 ? modulo : remainder;
};

const pickTrigram = (value) => {
  const index = normalizeNumber(value, 8);
  if (!index) return null;
  return TRIGRAMS[index - 1];
};

const buildHexagram = (upper, lower) => {
  if (!upper || !lower) return null;
  return hexagramByTrigrams.get(`${upper.id}-${lower.id}`) || null;
};

const applyChangingLines = (hexagram, changingLines = []) => {
  if (!hexagram || !changingLines.length) return hexagram;
  const nextLines = [...hexagram.lines];
  changingLines.forEach((line) => {
    // 越界爻位直接忽略：此前钳到初爻/上爻再翻，等于悄悄改了一个动爻
    if (!Number.isInteger(line) || line < 1 || line > 6) return;
    nextLines[line - 1] = nextLines[line - 1] ? 0 : 1;
  });
  return hexagramByLines.get(nextLines.join('')) || { ...hexagram, lines: nextLines };
};

const deriveChangingLinesFromNumbers = (numbers) => {
  if (!Array.isArray(numbers) || numbers.length !== 3) return [];
  // Traditional Plum Blossom method: sum of numbers modulo 6 for changing line
  const sum = numbers.reduce((total, value) => total + Number(value), 0);
  const changingLine = normalizeNumber(sum, 6);
  return changingLine ? [changingLine] : [];
};

/**
 * 时间起卦（梅花易数年月日时起例）。
 *
 * 上卦 = (年支数 + 农历月 + 农历日) ÷ 8 之余，
 * 下卦 = (年支数 + 农历月 + 农历日 + 时支数) ÷ 8 之余，
 * 动爻 = 同一个和 ÷ 6 之余。余零则取满数（8 或 6）。
 *
 * 闰月按归本月取（与紫微同一口径）。返回 null 表示日期无法解析。
 *
 * @param {object} moment 公历年月日时
 */
const buildTimeDivinationNumbers = (moment) => {
  // 默认参数只挡 undefined，null 会一路穿到解构那里炸掉
  if (!moment || typeof moment !== 'object') return null;
  const y = Number(moment.year);
  const m = Number(moment.month);
  const d = Number(moment.day);
  const h = Number(moment.hour);
  if (![y, m, d, h].every(Number.isFinite)) return null;

  const lunar = Solar.fromYmdHms(y, m, d, h, 0, 0).getLunar();
  const yearNumber = branchNumber(lunar.getYearZhi());
  const hourNumber = branchNumber(lunar.getTimeZhi());
  if (!yearNumber || !hourNumber) return null;

  // 闰月以负数表示，取绝对值即归本月
  const lunarMonth = Math.abs(lunar.getMonth());
  const lunarDay = lunar.getDay();

  const upperSum = yearNumber + lunarMonth + lunarDay;
  const lowerSum = upperSum + hourNumber;
  return {
    upperSum,
    lowerSum,
    lunar: {
      yearZhi: lunar.getYearZhi(),
      yearNumber,
      month: lunarMonth,
      isLeapMonth: lunar.getMonth() < 0,
      day: lunarDay,
      timeZhi: lunar.getTimeZhi(),
      hourNumber,
    },
  };
};

/** 时间起卦的动爻：与下卦同一个和取六之余，只有一个动爻。 */
const deriveChangingLinesFromTimeContext = (timeContext) => {
  const numbers = buildTimeDivinationNumbers(timeContext);
  if (!numbers) return [];
  const changingLine = normalizeNumber(numbers.lowerSum, 6);
  return changingLine ? [changingLine] : [];
};

/**
 * 卦变三种：互卦、错卦、综卦。
 *
 * 三者都是纯位运算，确定性到没有讨论余地，却是断卦的基础参照 ——
 * 只有本卦与之卦时，「事情的中段」「事情的反面」「对方的立场」都无从谈起。
 *
 * - **互卦**：取二三四爻为下卦、三四五爻为上卦。论事之中段、过程。
 * - **错卦**（变卦 / 旁通卦）：六爻逐爻阴阳互易。论事之反面。
 * - **综卦**（覆卦）：六爻整体倒置。论对方所见的同一件事。
 *
 * lines 一律自初爻至上爻，与本仓库其余各处一致。
 */
const deriveHexagramVariants = (hexagram) => {
  const lines = hexagram?.lines;
  if (!Array.isArray(lines) || lines.length !== 6) return null;

  const lookup = (next) => hexagramByLines.get(next.join('')) || null;

  // 互卦：下卦取 2·3·4 爻，上卦取 3·4·5 爻（下标 1..3 与 2..4）
  const mutual = [...lines.slice(1, 4), ...lines.slice(2, 5)];
  const opposite = lines.map((bit) => (bit ? 0 : 1));
  const reversed = [...lines].reverse();

  return {
    mutual: {
      lines: mutual,
      hexagram: lookup(mutual),
      cn: '互卦',
      note: '取二三四为下、三四五为上，论事之中段',
    },
    opposite: {
      lines: opposite,
      hexagram: lookup(opposite),
      cn: '错卦',
      note: '六爻阴阳互易，论事之反面',
    },
    reversed: {
      lines: reversed,
      hexagram: lookup(reversed),
      cn: '综卦',
      note: '六爻整体倒置，论对方所见',
    },
  };
};

const getDetailedLines = (hexagram, changingLines = []) => {
  if (!hexagram?.lines) return [];
  return hexagram.lines.map((bit, idx) => {
    const position = idx + 1;
    const isChanging = changingLines.includes(position);
    // 1 = Yang, 0 = Yin
    let status = '';
    if (bit === 1) {
      status = isChanging ? 'Old Yang (Moving)' : 'Young Yang (Stable)';
    } else {
      status = isChanging ? 'Old Yin (Moving)' : 'Young Yin (Stable)';
    }
    /**
     * 该爻的《周易》爻辞。梅花起卦只有一个动爻，断的就是那一爻的爻辞 ——
     * 此前只给卦名，动爻是哪一句还得去别处找。经文是原料不是断语。
     */
    const yaoText = getYaoText(hexagram, position);
    return { position, bit, isChanging, status, yaoText: yaoText ? { ...yaoText } : null };
  });
};

export {
  normalizeNumber,
  branchNumber,
  pickTrigram,
  buildHexagram,
  applyChangingLines,
  deriveChangingLinesFromNumbers,
  buildTimeDivinationNumbers,
  deriveChangingLinesFromTimeContext,
  deriveHexagramVariants,
  getDetailedLines,
};
