/**
 * 八宅风水、择吉、姓名五格。
 *
 * 三者共性是「规则明确、可逐条验证」，故合于一处。都只做结构：
 * 八宅给出命卦与八方游年星，择吉给出当日的建除、值宿、吉神凶煞，
 * 姓名给出五格与三才配置 —— 吉凶断语一概不下，那属于调用方。
 *
 * 口径真源：rulings.js 的 BAZHAI / ALMANAC / NAME（分模块，不混装）。
 */

import { Solar } from 'lunar-javascript';

import {
  TRIGRAM_LINES,
  TRIGRAM_BY_NUMBER,
  YOUNIAN_SEQUENCE,
  GROUP_NAMES,
  NUMBER_ELEMENTS,
  MOUNTAIN_TRIGRAM,
  DIRECTION_TRIGRAM,
  TRIGRAM_OPPOSITE,
} from '../constants/bazhai.js';
import {
  BRANCH_PALACE,
  SANSHA_BY_GROUP,
  SANSHA_NAMES,
  LUOSHU_FLIGHT,
  PALACE_META,
  NINE_STAR_META,
} from '../constants/almanac.js';
import { normalizeGender } from '../utils/validation.js';
import { withSchool } from '../constants/rulings.js';
import { getElementRelation } from './bazi.service.js';
import { resolveLiChun, resolveLiChunYear } from './jieqi.service.js';

const linesKey = (lines) => lines.join('');

const TRIGRAM_BY_LINES = Object.entries(TRIGRAM_LINES).reduce((acc, [cn, lines]) => {
  acc[linesKey(lines)] = cn;
  return acc;
}, {});

/** 数字各位相加，反复至个位。 */
const digitalRoot = (value) => {
  let n = Math.abs(Math.trunc(value));
  while (n > 9) {
    n = String(n)
      .split('')
      .reduce((sum, d) => sum + Number(d), 0);
  }
  return n;
};

/**
 * 本命卦（三元命卦）。
 *
 * 年份四位相加至个位得 N：男取 11 − N，女取 N + 4（逾九减九）。
 * 得五者男寄坤二、女寄艮八 —— 中五宫无卦，必须寄出去。
 *
 * 这个数字根写法跨世纪同样成立：数字根恒等于年份模九，与常见的
 * 「男 (100−YY) mod 9 / 女 (YY−4) mod 9」那组分世纪公式结果一致。
 *
 * 年以**立春**为界，不是元旦，且交节精确到分：2024 立春在 2/4 16:27，
 * 当天 16:27 前出生的命卦属 2023 年，差一位卦，东四西四也可能翻。
 * 因此给了月日却不给时刻时，交节当天只能按零点算，结果标 `precision: 'day'`
 * —— 那一天的结论调用方必须自己去核实，不要当成确定值。
 */
export const resolveLifeTrigram = (
  birthYear,
  gender,
  { birthMonth, birthDay, birthHour, birthMinute } = {}
) => {
  const rawYear = Number(birthYear);
  if (!Number.isFinite(rawYear)) return null;

  const hasMonthDay = Number.isFinite(Number(birthMonth)) && Number.isFinite(Number(birthDay));
  const hasHour = Number.isFinite(Number(birthHour));

  let year = rawYear;
  let precision = 'year';
  let lichunAt = null;

  if (hasMonthDay) {
    const parts = {
      year: rawYear,
      month: Number(birthMonth),
      day: Number(birthDay),
      hour: hasHour ? Number(birthHour) : 0,
      minute: Number.isFinite(Number(birthMinute)) ? Number(birthMinute) : 0,
    };
    const resolved = resolveLiChunYear(parts);
    if (resolved !== null) year = resolved;
    precision = hasHour ? 'minute' : 'day';
    const lichun = resolveLiChun(rawYear);
    lichunAt = lichun ? lichun.iso : null;
  }

  const normalizedGender = normalizeGender(gender);
  if (!normalizedGender) return null;
  const male = normalizedGender === 'male';
  const root = digitalRoot(year);
  let number = male ? 11 - root : root + 4;
  if (number > 9) number -= 9;
  if (number === 5) number = male ? 2 : 8;

  const trigram = TRIGRAM_BY_NUMBER[number];
  if (!trigram) return null;
  return {
    number,
    ...trigram,
    solarYearUsed: year,
    /** `year` 表示只按公历年算、完全没有过立春这道关，交节当天必然存疑。 */
    precision,
    lichunAt,
    group: trigram.group,
    groupCn: GROUP_NAMES[trigram.group].cn,
  };
};

/**
 * 八方游年星：自本命卦起依次变上、中、下、中、上、中、下、中爻，
 * 顺次得生气、五鬼、延年、六煞、祸害、天医、绝命、伏位。
 */
export const buildYounianMap = (trigramCn) => {
  const base = TRIGRAM_LINES[trigramCn];
  if (!base) return null;

  let lines = [...base];
  const result = [];
  YOUNIAN_SEQUENCE.forEach(({ flip, star }) => {
    lines = lines.map((bit, i) => (i === flip - 1 ? (bit ? 0 : 1) : bit));
    const cn = TRIGRAM_BY_LINES[linesKey(lines)];
    const meta = Object.values(TRIGRAM_BY_NUMBER).find((t) => t.cn === cn);
    result.push({
      trigram: cn,
      direction: meta?.direction || null,
      star,
    });
  });
  return result;
};

const trigramMeta = (cn) =>
  Object.entries(TRIGRAM_BY_NUMBER)
    .map(([number, meta]) => ({ number: Number(number), ...meta }))
    .find((meta) => meta.cn === cn) || null;

/**
 * 把调用方给的坐山归到某一卦。
 *
 * 三种写法都收：卦名（`坎`）、二十四山（`子` / `壬` / `乾`）、方位（`正北`）。
 * 认不出返回 null —— 与地名表一样，宁可明说不认识，也不要猜一个卦出来，
 * 猜错了整张宅盘的八方吉凶全反。
 */
export const resolveSittingTrigram = (input) => {
  const raw = String(input ?? '').trim();
  if (!raw) return null;
  // 「子山午向」这类写法取「山」字之前那一个字
  const shan = raw.match(/^(.)山/);
  const key = shan ? shan[1] : raw;
  const cn = TRIGRAM_LINES[key]
    ? key
    : MOUNTAIN_TRIGRAM[key] || DIRECTION_TRIGRAM[key] || DIRECTION_TRIGRAM[raw] || null;
  if (!cn) return null;
  return { cn, source: key };
};

/**
 * 宅盘：由**坐山**定宅卦，再自宅卦起游年，得八方吉凶。
 *
 * 这与命卦那一半互相独立：命卦是人的，宅卦是房子的，八宅之所以叫「八宅」，
 * 论的正是两者相配 —— 只给命卦那一半，「这房子对我合不合」是答不了的。
 */
export const buildHouseChart = (sitting) => {
  const resolved = resolveSittingTrigram(sitting);
  if (!resolved) return null;
  const meta = trigramMeta(resolved.cn);
  const facingCn = TRIGRAM_OPPOSITE[resolved.cn];
  const facingMeta = trigramMeta(facingCn);
  const younian = buildYounianMap(resolved.cn);
  return {
    input: resolved.source,
    sitting: { cn: resolved.cn, ...meta },
    facing: { cn: facingCn, ...facingMeta },
    group: meta?.group || null,
    groupCn: GROUP_NAMES[meta?.group]?.houseCn || null,
    younian,
    auspiciousDirections: younian.filter((y) => y.star.auspicious).map((y) => y.direction),
    inauspiciousDirections: younian.filter((y) => !y.star.auspicious).map((y) => y.direction),
  };
};

/**
 * 八宅盘：命卦 + 八方吉凶；给了坐山则同时排宅卦并论命宅相配。
 *
 * `sitting` 收卦名 / 二十四山 / 方位名 / 「子山午向」四种写法，认不出会明说
 * （`houseResolution: 'unresolved'`），不猜。
 */
export const buildBazhaiChart = ({
  birthYear,
  birthMonth,
  birthDay,
  birthHour,
  birthMinute,
  gender,
  sitting = null,
}) => {
  const life = resolveLifeTrigram(birthYear, gender, {
    birthMonth,
    birthDay,
    birthHour,
    birthMinute,
  });
  if (!life) return null;
  const younian = buildYounianMap(life.cn);

  const house = sitting ? buildHouseChart(sitting) : null;
  const houseResolution = !sitting ? 'absent' : house ? 'applied' : 'unresolved';

  /**
   * 命宅相配：同为东四或同为西四即相配。
   * 另外给出命卦游年里**宅之坐山方**所值之星 —— 相配与否是粗判，
   * 坐山方对本人是生气还是绝命才是细判，两者都要看。
   */
  const match =
    house && life.group
      ? {
          matched: house.group === life.group,
          lifeGroupCn: GROUP_NAMES[life.group]?.cn || null,
          houseGroupCn: house.groupCn,
          sittingStarForLife:
            younian.find((entry) => entry.trigram === house.sitting.cn)?.star || null,
          facingStarForLife:
            younian.find((entry) => entry.trigram === house.facing.cn)?.star || null,
        }
      : null;

  return withSchool('bazhai', {
    lifeTrigram: life,
    younian,
    auspiciousDirections: younian.filter((y) => y.star.auspicious).map((y) => y.direction),
    inauspiciousDirections: younian.filter((y) => !y.star.auspicious).map((y) => y.direction),
    suitableHouseGroup: GROUP_NAMES[life.group],
    /** 宅卦这一半。没给坐山时为 null，此时 houseResolution 是 'absent'。 */
    house,
    houseResolution,
    match,
  });
};

/**
 * 择日：当日的建除十二神、值宿、吉神凶煞、彭祖百忌。
 *
 * 这些历注由 lunar-javascript 提供 —— 它已经是一份经过验证的实现，
 * 重写一遍只会多一处出错的地方。本函数负责的是把它组织成稳定的响应结构。
 */
const BRANCHES_ORDER = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

/**
 * 流年入中紫白星。下元自 1984 甲子七赤入中起，逐年退一。
 *
 * 年界是**立春**，与年柱同界 —— 正月初一到立春之间年星仍属上一年。
 * 这个数是方位吉凶（五黄、二黑、三煞之外的那一层）的底数，故自己算不查表：
 * 手抄的流年紫白表极易整体错位一年，而这条公式永不过期。
 */
export const resolveYearNineStar = (lichunYear) => {
  const y = Number(lichunYear);
  if (!Number.isFinite(y)) return null;
  const n = (((7 - (y - 1984)) % 9) + 9) % 9;
  return n === 0 ? 9 : n;
};

/**
 * 九宫飞星盘：给定入中星，按洛书次序顺飞九宫。
 * 返回 `{ 宫数: 星数 }`，以及每宫的卦、方位与星名。
 */
export const buildNineStarChart = (centerStar) => {
  const center = Number(centerStar);
  if (!Number.isInteger(center) || center < 1 || center > 9) return null;
  return LUOSHU_FLIGHT.map((palace, step) => {
    const star = ((center - 1 + step) % 9) + 1;
    return {
      palace,
      ...PALACE_META[palace],
      star,
      ...NINE_STAR_META[star],
      // 星宫生克：方位吉凶的落点。宫为体、星为用，故以宫为「我」看星
      starPalaceRelation: getElementRelation(
        PALACE_META[palace].palaceElement,
        NINE_STAR_META[star].starElement
      ),
    };
  }).sort((a, b) => a.palace - b.palace);
};

/**
 * 流年方位煞：太岁、岁破、三煞、五黄、二黑。
 *
 * 五黄二黑的落宫由入中星飞泊得出，不是查表 —— 见 resolveYearNineStar 的理由。
 * 太岁精确到**山**（年支那一山，15°），这里附带给出它所在的宫（45°），
 * 两个精度都回显，是因为「避太岁」到底避多宽各家做法不同。
 */
export const buildYearDirections = (yearGanzhi, lichunYear) => {
  const branch = typeof yearGanzhi === 'string' ? yearGanzhi.slice(1, 2) : null;
  const seat = BRANCH_PALACE[branch];
  if (!seat) return null;

  const branches = BRANCHES_ORDER;
  const clash = branches[(branches.indexOf(branch) + 6) % 12];
  const sansha = SANSHA_BY_GROUP.find((entry) => entry.group.includes(branch)) || null;
  const center = resolveYearNineStar(lichunYear);
  const chart = buildNineStarChart(center) || [];
  const seatOfStar = (star) => chart.find((cell) => cell.star === star) || null;

  return {
    lichunYear,
    yearGanzhi,
    taiSui: { branch, ...seat, cn: `${branch}山太岁` },
    suiPo: { branch: clash, ...BRANCH_PALACE[clash], cn: `岁破（冲太岁）` },
    sanSha: sansha
      ? {
          direction: sansha.direction,
          branches: sansha.branches,
          detail: sansha.branches.map((b, i) => ({ branch: b, cn: SANSHA_NAMES[i] })),
          cn: sansha.cn,
        }
      : null,
    nineStar: { center, centerCn: NINE_STAR_META[center]?.cn || null, chart },
    wuHuang: seatOfStar(5),
    erHei: seatOfStar(2),
  };
};

/**
 * 择吉历注。
 *
 * 分三层，混在一起读会看错：
 * - **论日**：建除、值宿、黄道黑道、宜忌、日冲日煞、彭祖百忌。
 * - **论时**：十二时辰各自的天神、吉凶与宜忌 —— 「今天几点动土」只能在这一层答。
 * - **论方**：太岁、岁破、三煞、五黄二黑。年界用立春，与年柱同界。
 *
 * 宜忌与吉神凶煞都是通书的**既有条目**，不是本引擎下的断语，故照录。
 * 真正属于断语层的是「这些条目对你这件事意味着什么」，那一句仍然不给。
 */
export const buildAlmanac = ({ year, month, day }) => {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (![y, m, d].every(Number.isFinite)) return null;

  const solar = Solar.fromYmd(y, m, d);
  const lunar = solar.getLunar();

  // 术数通书年柱以立春为界，不是春节。春节后、立春前仍属上一年干支。
  const yearGanzhi =
    typeof lunar.getYearInGanZhiByLiChun === 'function'
      ? lunar.getYearInGanZhiByLiChun()
      : lunar.getYearInGanZhi();
  /**
   * 方位煞与年柱同界，且历注这一层**按日**给出，没有时刻可比：立春当日整日归新年，
   * 与上面 getYearInGanZhiByLiChun 同一判法。此前这里另按当日 0 点比交节时刻，
   * 立春当天（交节多在白天）年柱已是新年而 lichunYear 仍是旧年 —— 太岁岁破三煞取新年支，
   * 紫白入中与五黄二黑却按旧年飞，同一响应里两套年。
   */
  const lichunYear = yearGanzhi === Solar.fromYmd(y, 7, 1).getLunar().getYearInGanZhi() ? y : y - 1;

  const call = (obj, name, fallback = null) =>
    typeof obj?.[name] === 'function' ? obj[name]() : fallback;

  return withSchool('almanac', {
    date: { year: y, month: m, day: d },
    ganzhi: {
      year: yearGanzhi,
      month: lunar.getMonthInGanZhi(),
      day: lunar.getDayInGanZhi(),
    },
    lunarDate: {
      year: lunar.getYear(),
      month: lunar.getMonth(),
      day: lunar.getDay(),
      monthCn: lunar.getMonthInChinese(),
      dayCn: lunar.getDayInChinese(),
    },
    zhiXing: lunar.getZhiXing(),
    xiu: {
      name: lunar.getXiu(),
      luck: lunar.getXiuLuck(),
      animal: lunar.getAnimal(),
      gong: lunar.getGong(),
      zheng: lunar.getZheng(),
    },
    /** 黄道黑道十二神。type 是「黄道 / 黑道」，luck 是「吉 / 凶」。 */
    tianShen: {
      name: call(lunar, 'getDayTianShen'),
      type: call(lunar, 'getDayTianShenType'),
      luck: call(lunar, 'getDayTianShenLuck'),
    },
    /** 通书的宜忌条目，照录不加工。 */
    yi: call(lunar, 'getDayYi', []),
    ji: call(lunar, 'getDayJi', []),
    /** 日冲：所冲之支与生肖；日煞：所煞之方。择日第一道筛。 */
    chongSha: {
      branch: call(lunar, 'getDayChong'),
      shengXiao: call(lunar, 'getDayChongShengXiao'),
      desc: call(lunar, 'getDayChongDesc'),
      sha: call(lunar, 'getDaySha'),
    },
    /** 当日吉神所在之方（八卦宫）。 */
    dayPositions: {
      xi: {
        palace: call(lunar, 'getDayPositionXi'),
        direction: call(lunar, 'getDayPositionXiDesc'),
      },
      cai: {
        palace: call(lunar, 'getDayPositionCai'),
        direction: call(lunar, 'getDayPositionCaiDesc'),
      },
      fu: {
        palace: call(lunar, 'getDayPositionFu'),
        direction: call(lunar, 'getDayPositionFuDesc'),
      },
      yangGui: {
        palace: call(lunar, 'getDayPositionYangGui'),
        direction: call(lunar, 'getDayPositionYangGuiDesc'),
      },
      yinGui: {
        palace: call(lunar, 'getDayPositionYinGui'),
        direction: call(lunar, 'getDayPositionYinGuiDesc'),
      },
      taiSui: {
        palace: call(lunar, 'getDayPositionTaiSui'),
        direction: call(lunar, 'getDayPositionTaiSuiDesc'),
      },
    },
    /**
     * 各时辰的天神吉凶与宜忌。择时只能看这一层，看日是答不了的。
     *
     * **共十三条不是十二条**：子时跨两个公历日，故一日之内有早子（00:00–00:59）
     * 与晚子（23:00–23:59）两段。两段的时干不同 —— 晚子的时干由次日日干起五鼠遁，
     * 与本仓库八字「晚子时不换日」的口径同源。按十二条去取下标会把晚子整段丢掉。
     */
    hours: (call(lunar, 'getTimes', []) || []).map((t) => ({
      ganzhi: call(t, 'getGanZhi'),
      range: { from: call(t, 'getMinHm'), to: call(t, 'getMaxHm') },
      tianShen: {
        name: call(t, 'getTianShen'),
        type: call(t, 'getTianShenType'),
        luck: call(t, 'getTianShenLuck'),
      },
      chongSha: {
        branch: call(t, 'getChong'),
        desc: call(t, 'getChongDesc'),
        sha: call(t, 'getSha'),
      },
      yi: call(t, 'getYi', []),
      ji: call(t, 'getJi', []),
    })),
    /** 流年方位煞。与年柱同以立春为界。 */
    directions: buildYearDirections(yearGanzhi, lichunYear),
    auspiciousGods: lunar.getDayJiShen(),
    inauspiciousGods: lunar.getDayXiongSha(),
    pengzu: { gan: lunar.getPengZuGan(), zhi: lunar.getPengZuZhi() },
    dayLu: lunar.getDayLu(),
    xunkong: call(lunar, 'getDayXunKong'),
    festivals: lunar.getFestivals(),
  });
};

/**
 * 姓名五格。
 *
 * **笔画数由调用方提供**，引擎不内置字典。五格的算法是确定的，笔画数却不是：
 * 康熙笔画与现代简体笔画差异很大，部首另有独立算法（如「氵」按「水」计四画），
 * 内置一份来路不明的笔画表只会让结果看着精确、实则不可追溯。
 *
 * @param {number[]} surnameStrokes 姓的逐字笔画
 * @param {number[]} givenNameStrokes 名的逐字笔画
 */
export const buildNameGrids = (surnameStrokes, givenNameStrokes) => {
  const surname = (surnameStrokes || []).map(Number).filter(Number.isFinite);
  const given = (givenNameStrokes || []).map(Number).filter(Number.isFinite);
  if (!surname.length || !given.length) return null;
  // 汉字至少一画：0 与负数会让数理个位查表落空、天格出现 1 这种五格里不存在的数
  if ([...surname, ...given].some((n) => !Number.isInteger(n) || n < 1)) return null;

  const sum = (arr) => arr.reduce((a, b) => a + b, 0);

  // 单姓天格加一虚位，复姓则两字相加
  const heaven = surname.length === 1 ? surname[0] + 1 : sum(surname);
  const human = surname[surname.length - 1] + given[0];
  // 单名地格加一虚位
  const earth = given.length === 1 ? given[0] + 1 : sum(given);
  const total = sum(surname) + sum(given);
  // 外格 = 天格 + 地格 − 人格（等价于：单姓单名恒为 2；单姓双名 = 名末+1；
  // 复姓单名 = 姓首+1；复姓双名 = 姓首+名末）。
  // 旧式 total − human + 1 在单姓单名得 1、复姓双名多 1，个位五行会静默偏一档。
  const outer = heaven + earth - human;

  const toElement = (n) => NUMBER_ELEMENTS[n % 10];
  const grids = { heaven, human, earth, outer, total };

  const sancai = {
    heaven: toElement(heaven),
    human: toElement(human),
    earth: toElement(earth),
  };
  // 三才配置的相生相克关系：天生人、人生地为顺
  const relations = {
    heavenToHuman: getElementRelation(sancai.heaven, sancai.human),
    humanToEarth: getElementRelation(sancai.human, sancai.earth),
  };

  return withSchool('name', {
    strokes: { surname, given },
    grids,
    gridElements: {
      heaven: sancai.heaven,
      human: sancai.human,
      earth: sancai.earth,
      outer: toElement(outer),
      total: toElement(total),
    },
    sancai,
    sancaiRelations: relations,
  });
};
