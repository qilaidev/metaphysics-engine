/**
 * 奇门遁甲排盘层。
 *
 * 排盘链条：定节气三元 → 定阴阳遁与局数 → 地盘三奇六仪 → 定旬首值符值使 →
 * 转天盘九星 → 转八门 → 布八神。
 *
 * 覆盖的是**盘的结构**。格局判定（青龙返首、飞鸟跌穴、三奇得使之类）不实现：
 * 那属于断语层，各家取名与成立条件出入极大，由调用方按所宗流派叠加。
 * 引擎给出的每一格都带宫位、地盘干、天盘干、星、门、神，断语所需的原料是齐的。
 */

import { Solar } from 'lunar-javascript';

import { BRANCHES, SEXAGENARY_CYCLE } from '../constants/ganzhi.js';
import { BRANCHES_MAP } from '../constants/stems.js';
import {
  PALACES,
  YIQI_ORDER,
  NINE_STARS,
  EIGHT_GATES,
  EIGHT_GODS,
  XUNSHOU_TO_YI,
  JIEQI_JU,
  YUAN_BY_FUTOU_BRANCH,
  YUAN_NAMES,
  PALACE_BRANCHES,
  STEM_TOMB_PALACE,
  LIUYI_JIXING_PALACE,
  QIMEN_YIMA_BY_DAY_BRANCH,
} from '../constants/qimen.js';
import { resolveDayForHour } from '../utils/civilDate.js';
import { withSchool } from '../constants/rulings.js';
import { getElementRelation } from './bazi.service.js';
import { getSeasonalState, getXunkong } from './ganzhi.service.js';
import { resolveSolarTerm } from './jieqi.service.js';

/**
 * 九宫飞泊次序。顺飞即 1→2→…→9→1，此处用一个环表表示，
 * 便于阳遁顺行、阴遁逆行统一处理。
 */
const PALACE_CYCLE = [1, 2, 3, 4, 5, 6, 7, 8, 9];

const stepPalace = (palace, step) => {
  const idx = PALACE_CYCLE.indexOf(palace);
  if (idx === -1) return null;
  return PALACE_CYCLE[(((idx + step) % 9) + 9) % 9];
};

/**
 * 洛书八宫顺时针环：坎一 → 艮八 → 震三 → 巽四 → 离九 → 坤二 → 兑七 → 乾六。
 *
 * 九星、八门、八神都在这个八宫环上转动，**中五宫不参与** —— 中宫寄坤二。
 * 地盘三奇六仪则不同，它是按一到九顺（逆）飞九宫的，中宫要占一位。
 * 这两套飞泊次序不能混用：拿九宫环去转八门，会转出「中五宫有门」这种不存在的盘。
 */
const OCTAGON = [1, 8, 3, 4, 9, 2, 7, 6];

/** 中五宫寄坤二。 */
const lodgeCenter = (palace) => (palace === 5 ? 2 : palace);

const octIndex = (palace) => OCTAGON.indexOf(lodgeCenter(palace));

const octStep = (palace, step) => {
  const idx = octIndex(palace);
  if (idx === -1) return null;
  return OCTAGON[(((idx + step) % 8) + 8) % 8];
};

/** 天干五行。奇门的天地盘干生克与十干克应都从这里起。 */
const STEM_ELEMENTS = {
  甲: 'Wood',
  乙: 'Wood',
  丙: 'Fire',
  丁: 'Fire',
  戊: 'Earth',
  己: 'Earth',
  庚: 'Metal',
  辛: 'Metal',
  壬: 'Water',
  癸: 'Water',
};

/** 某地支落在哪一宫。中五宫无支，故查不到的返回 null。 */
const palaceOfBranch = (branch) => {
  const hit = Object.entries(PALACE_BRANCHES).find(([, branches]) => branches.includes(branch));
  return hit ? Number(hit[0]) : null;
};

/** 时辰地支。子时含 23 时。 */
const hourBranchIndex = (hour) => Math.floor((Number(hour) + 1) / 2) % 12;

/** 节气 → 月支。以节换月（立春起寅月），中气不换，故每支对应一节一气。 */
const MONTH_BRANCH_BY_JIEQI = {
  立春: '寅',
  雨水: '寅',
  惊蛰: '卯',
  春分: '卯',
  清明: '辰',
  谷雨: '辰',
  立夏: '巳',
  小满: '巳',
  芒种: '午',
  夏至: '午',
  小暑: '未',
  大暑: '未',
  立秋: '申',
  处暑: '申',
  白露: '酉',
  秋分: '酉',
  寒露: '戌',
  霜降: '戌',
  立冬: '亥',
  小雪: '亥',
  大雪: '子',
  冬至: '子',
  小寒: '丑',
  大寒: '丑',
};

/**
 * 定当前所处节气及其交节时刻。奇门按节气行局，节气一换局数即变。
 *
 * 判定精确到分，且给了 `hour` 才作数：交节当天，交节时刻前后分属两个节气，
 * 局数完全不同 —— 冬至、夏至那两天更是阳遁与阴遁的分界。
 */
export const resolveJieQi = (year, month, day, hour = 0, minute = 0) =>
  resolveSolarTerm({ year, month, day, hour, minute });

/**
 * 符头：自占日**向前**寻最近的甲日或己日。
 *
 * 六十甲子里甲己日每五天一个，符头地支恰好三个一循环：
 * 子午卯酉为上元、寅申巳亥为中元、辰戌丑未为下元 —— 拆补法的三元就由它定。
 */
export const resolveFutou = (year, month, day) => {
  let cursor = Solar.fromYmd(year, month, day);
  for (let back = 0; back < 60; back += 1) {
    const ganzhi = cursor.getLunar().getDayInGanZhi();
    if (ganzhi[0] === '甲' || ganzhi[0] === '己') {
      return { futou: ganzhi, daysSinceFutou: back, futouBranch: ganzhi[1] };
    }
    cursor = cursor.next(-1);
  }
  return null;
};

/**
 * 定三元（拆补法）：自占日向前取最近的符头，按其地支定上中下元。
 *
 * **一个节气之内三元出现非「上→中→下」的次序是拆补法的正常形态，不是错。**
 * 符头三天一轮、十五天一周，而交节日在六十甲子上逐年漂移，两者对不齐 ——
 * 拆补法处理这件事的办法就写在它的名字里：
 *
 * - **拆**：交节之后头一段用的那个元不足五日（符头在交节前就已起，被交节「拆」断）
 * - **补**：本节气末尾用完三元后还余两三日，拿来补上被拆掉的那一元
 *
 * 于是实际排出来是「残中—下—上—补中」「残上—中—下—补上」「残下—上—中—补下」
 * 三种形态之一。古籍例证：夏至节内先用三天多中元阴三局，再五天下元阴六局，
 * 再五天上元阴九局，最后补用中元阴三局两天多 —— 与本表夏至 [9, 3, 6] 一致。
 *
 * 曾经据「三元次序错乱」把这里改成按距交节日数定元（0–4 上元 / 5–9 中元 / 10+ 下元），
 * 那是错的：按日数定元既不是拆补法也不是置闰法，且会让符头这一层彻底失效。
 * 置闰法才是另一派 —— 它同样用符头定元，但要把符头配到它所领起的那个节气，
 * 并在超神满九日时置一个闰局（闰局只出现在芒种与大雪之间）。
 */
export const resolveYuan = (year, month, day) => {
  const futou = resolveFutou(year, month, day);
  if (!futou) return null;
  const yuan = YUAN_BY_FUTOU_BRANCH[futou.futouBranch];
  if (yuan === undefined) return null;
  return { ...futou, yuan, yuanCn: YUAN_NAMES[yuan] };
};

/**
 * 定阴阳遁与局数。
 *
 * 节气按**实际占时**判（到分）；符头按**子初换日后**的日取，故 23 点与次日 0 点同符头。
 *
 * @param {object} [dayForYuan] 可选：符头按此公历日取（子初换日后的日）。缺省同 year/month/day。
 */
export const resolveJu = (year, month, day, hour = 0, minute = 0, dayForYuan = null) => {
  const jieqi = resolveJieQi(year, month, day, hour, minute);
  if (!jieqi) return null;
  const entry = JIEQI_JU[jieqi.name];
  if (!entry) return null;

  const yuanDay = dayForYuan || { year, month, day };
  const yuanInfo = resolveYuan(yuanDay.year, yuanDay.month, yuanDay.day);
  if (!yuanInfo) return null;

  return {
    jieqi: jieqi.name,
    // 交节时刻按东八区墙钟给出，不是某个瞬时的 UTC 表示，故不走 toISOString
    jieqiAt: jieqi.iso,
    jieqiDate: jieqi.iso.slice(0, 10),
    daysSinceJieQi: jieqi.daysSinceTerm,
    yang: entry.yang,
    dunCn: entry.yang ? '阳遁' : '阴遁',
    ju: entry.ju[yuanInfo.yuan],
    /** 本节气三元各自的局数，回显以便直接核对取的是哪一元。 */
    juByYuan: [...entry.ju],
    /** 定元依据：拆补法以符头地支定元，不按距交节的日数。 */
    yuanBasis: 'futou-branch',
    ...yuanInfo,
  };
};

/**
 * 地盘三奇六仪：自局数所指之宫起，按戊己庚辛壬癸丁丙乙的次序，
 * 阳遁顺飞九宫、阴遁逆飞。
 */
export const buildEarthPlate = ({ yang, ju }) => {
  const plate = {};
  YIQI_ORDER.forEach((gan, offset) => {
    const palace = stepPalace(ju, yang ? offset : -offset);
    plate[palace] = gan;
  });
  return plate;
};

/** 干支所属旬首。 */
export const getXunShou = (ganzhi) => {
  const index = SEXAGENARY_CYCLE.indexOf(ganzhi);
  if (index === -1) return null;
  return SEXAGENARY_CYCLE[Math.floor(index / 10) * 10];
};

/**
 * 时干支。以日干起时干（五鼠遁），与八字同法。
 */
export const getHourGanzhi = (dayStem, hour) => {
  const branchIdx = hourBranchIndex(hour);
  const startStemIndex = { 甲: 0, 己: 0, 乙: 2, 庚: 2, 丙: 4, 辛: 4, 丁: 6, 壬: 6, 戊: 8, 癸: 8 }[
    dayStem
  ];
  if (startStemIndex === undefined) return null;
  const stems = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  return `${stems[(startStemIndex + branchIdx) % 10]}${BRANCHES[branchIdx]}`;
};

/**
 * 排一局奇门盘。
 *
 * @param {object} input 公历年月日与时辰
 */
export const castQimenChart = ({ year, month, day, hour, minute = 0 }) => {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  const h = Number(hour);
  const mi = Number(minute) || 0;
  if (![y, m, d, h].every(Number.isFinite)) return null;

  // 节气用实际占时（到分）；日干支与拆补符头按子初换日（23 点起入次日，与 0 点同盘）
  const dayCivil = resolveDayForHour(y, m, d, h);
  const juInfo = resolveJu(y, m, d, h, mi, dayCivil);
  if (!juInfo) return null;

  const lunar = Solar.fromYmd(dayCivil.year, dayCivil.month, dayCivil.day).getLunar();
  const dayGanzhi = lunar.getDayInGanZhi();
  /**
   * 月令：取**节气月支**（交节换月），不取农历月。
   * 八门九星的旺相休囚死是四时之气，四时按节气分，与农历月建差着半个月。
   *
   * 直接由定局所用的那个节气推出（节换月、气不换），与局数用同一个到分的判定。
   * 此前拿子初换日后那一天的 0 点去查 eightChar，交节日交节之后的时辰月令仍是上月，
   * 与同一盘里已经换了的局数互相矛盾。
   */
  const monthBranch = MONTH_BRANCH_BY_JIEQI[juInfo.jieqi] || null;
  const monthElement = BRANCHES_MAP[monthBranch]?.element || null;
  const hourGanzhi = getHourGanzhi(dayGanzhi[0], h);
  if (!hourGanzhi) return null;

  const earthPlate = buildEarthPlate(juInfo);
  const xunshou = getXunShou(hourGanzhi);
  const dunYi = XUNSHOU_TO_YI[xunshou];

  // 值符宫 = 旬首所遁之仪在地盘所落之宫；该宫的九星为值符、八门为值使
  const zhifuPalace = Number(
    Object.keys(earthPlate).find((palace) => earthPlate[palace] === dunYi)
  );

  // 时干在地盘所落之宫。甲时用其遁仪。
  const hourStem = hourGanzhi[0];
  const effectiveStem = hourStem === '甲' ? dunYi : hourStem;
  const hourStemPalace = Number(
    Object.keys(earthPlate).find((palace) => earthPlate[palace] === effectiveStem)
  );

  // 星门神一律在八宫环上论，故遁仪或时干落中宫时先寄坤二，否则取不到星门
  const zhifuSeat = lodgeCenter(zhifuPalace);
  const hourStemSeat = lodgeCenter(hourStemPalace);

  // 转盘：值符星加临时干之宫，九星整体随之在八宫环上转动
  const starShift = octIndex(hourStemSeat) - octIndex(zhifuSeat);

  /**
   * 值使门随时辰而行：自值符宫起，按时辰在本旬中的序数，阳遁顺、阴遁逆，
   * **按九宫数序（一二三四五六七八九）飞泊**，落中五宫寄坤二。
   *
   * 起点取**未寄宫**的 zhifuPalace：旬首遁仪落中五时自五起数 —— 甲子时寄坤二，
   * 乙丑时（阳遁）到乾六，不是坤二的下一格。
   *
   * 九星随值符在八宫环上**转**（转盘法），值使门的落宫却是按宫数**飞**的，两者不是同一条规则。
   * 此前把值使也放到八宫环（坎→艮→震→巽→离→坤→兑→乾）上转：阳遁一局乙丑时值使落艮八，
   * 而通行口径「甲子时休门在坎一，丑时到坤二，寅时到震三，卯时到巽四，遇中五寄坤二」
   * 应落坤二；一旬十个时辰里只有甲子、丙寅两个时辰巧合相同。八门整体随值使门转这一步不变。
   */
  const hourIndexInXun = SEXAGENARY_CYCLE.indexOf(hourGanzhi) - SEXAGENARY_CYCLE.indexOf(xunshou);
  const gateShift = juInfo.yang ? hourIndexInXun : -hourIndexInXun;
  const zhishiPalace = lodgeCenter(stepPalace(zhifuPalace, gateShift));
  const gateShiftFromOrigin = octIndex(zhishiPalace) - octIndex(zhifuSeat);

  // 天禽星居中，无独立方位，实务上寄坤二与天芮同宫
  const tianruiHome = 2;
  const tianqinPalace = octStep(tianruiHome, starShift);

  // ---- 关系量所需的三组落宫 ------------------------------------------
  // 旬空：时干支所属之旬的两个空亡支，落在哪一宫即那一宫空
  const hourXunkong = getXunkong(hourGanzhi);
  const xunkongPalaces = (hourXunkong?.branches || [])
    .map((branch) => ({ branch, palace: palaceOfBranch(branch) }))
    .filter((entry) => entry.palace !== null);
  const xunkongPalaceSet = new Set(xunkongPalaces.map((entry) => entry.palace));

  // 驿马：按**日支**取，与时旬无关
  const yimaBranch = QIMEN_YIMA_BY_DAY_BRANCH[dayGanzhi[1]] || null;
  const yimaPalace = yimaBranch ? palaceOfBranch(yimaBranch) : null;

  const palaces = PALACES.map((palace) => {
    const idx = palace.index;
    const isCenter = idx === 5;

    // 某宫现在所临之星/门，是原本在「本宫回退相应位移」那一宫的
    const starOrigin = isCenter ? 5 : octStep(idx, -starShift);
    const gateOrigin = isCenter ? null : octStep(idx, -gateShiftFromOrigin);

    // 八神自值符所临之宫起，阳遁顺布、阴遁逆布，只布八宫
    const godOffset = isCenter
      ? null
      : ((((octIndex(idx) - octIndex(hourStemPalace)) * (juInfo.yang ? 1 : -1)) % 8) + 8) % 8;

    const earthStem = earthPlate[idx] || null;
    const heavenStem = isCenter ? earthPlate[5] || null : earthPlate[starOrigin] || null;
    const star = isCenter ? NINE_STARS[5] : NINE_STARS[starOrigin] || null;
    const gate = gateOrigin ? EIGHT_GATES[gateOrigin] || null : null;

    /**
     * 盘面关系量。全部是**客观事实**，不是吉凶断语：
     * 「门迫」只是「门的五行被所临之宫所克」这件事的名字，各家无争议；
     * 有争议的是「门迫了会怎样」，那一句仍然留给调用方。
     */
    const relations = {
      /** 天盘干与地盘干的生克。以天盘为「我」。 */
      heavenEarth:
        heavenStem && earthStem
          ? getElementRelation(STEM_ELEMENTS[heavenStem], STEM_ELEMENTS[earthStem])
          : null,
      /**
       * 天地盘同干即伏吟于此宫。
       *
       * 中五宫恒排除：它的天盘干本就取自己的地盘干（中宫不参与转盘），
       * 不设这道闸的话中宫每一局都会报伏吟 —— 那不是伏吟，那是它不转。
       */
      isFuyin: !isCenter && !!heavenStem && heavenStem === earthStem,
      /** 星与所临之宫的生克。以宫为「我」（宫为体、星为用）。 */
      starPalace: star ? getElementRelation(palace.element, star.element) : null,
      /** 门与所临之宫的生克，同样以宫为「我」。 */
      gatePalace: gate ? getElementRelation(palace.element, gate.element) : null,
      /**
       * 门迫：**门克宫** —— 八门之五行克它所落之宫。
       *
       * 逐门核对得到的门迫清单（全部是门克宫）：
       *   伤门/杜门（木）落艮八、坤二（土）；开门/惊门（金）落震三、巽四（木）；
       *   休门（水）落离九（火）；景门（火）落乾六、兑七（金）；
       *   生门/死门（土）落坎一（水）。
       *
       * 此前这里取的是反向（宫克门），并把「开门落离九宫」写成经典例证 ——
       * 开门属金、离九属火，那是**宫克门**，即下面的门制，不是门迫。
       */
      isGatePo: !!gate && getElementRelation(palace.element, gate.element) === 'ControlledBy',
      /** 门制（门被制）：**宫克门**，与门迫相反的一向。 */
      isGateZhi: !!gate && getElementRelation(palace.element, gate.element) === 'Controls',
      /** 旬空：本宫地支落在时旬的空亡里。中五宫无支，恒非空。 */
      isXunkong: xunkongPalaceSet.has(idx),
      /** 驿马临宫。 */
      isYima: yimaPalace !== null && idx === yimaPalace,
      /** 天盘干入墓于此宫（五行墓库口径，见 constants）。 */
      heavenStemTomb: !!heavenStem && STEM_TOMB_PALACE[heavenStem] === idx,
      /** 六仪击刑。三奇不论击刑，故乙丙丁恒为 false。 */
      isJixing: !!earthStem && LIUYI_JIXING_PALACE[earthStem] === idx,
      /**
       * 星与门的四时旺衰，按**月令（节气月支）**判，与六爻共用同一张表。
       *
       * 此前每宫只给「星与宫生克」「门与宫生克」这类盘内关系，缺了「这门这星本身
       * 当不当令」—— 而同一个开门，秋令金旺与夏令火克金，力量差着两档。
       * 中五宫无门，故 gateSeasonalState 在中宫恒为 null。
       */
      starSeasonalState: star ? getSeasonalState(monthElement, star.element) : null,
      gateSeasonalState: gate ? getSeasonalState(monthElement, gate.element) : null,
    };

    return {
      ...palace,
      earthStem,
      heavenStem,
      star,
      // 天禽寄坤二随天芮，故其所临之宫会同时列出天禽
      lodgedStar: !isCenter && idx === tianqinPalace ? NINE_STARS[5] : null,
      gate,
      god: godOffset === null ? null : EIGHT_GODS[godOffset] || null,
      isZhifu: idx === hourStemSeat,
      isZhishi: idx === zhishiPalace,
      relations,
    };
  });

  return withSchool('qimen', {
    // 回显所用输入：minute 参与节气定局，不回显调用方无从核对
    date: { year: y, month: m, day: d, hour: h, minute: mi },
    dayGanzhi,
    hourGanzhi,
    xunshou,
    dunYi,
    /** 判门星旺相所用的月令。取节气月支，回显是为了让那一档能被独立核对。 */
    monthCommand: monthBranch ? { branch: monthBranch, element: monthElement } : null,
    ju: juInfo,
    earthPlate,
    /** 时旬空亡的两支及其落宫；中五宫无支，故落中宫的支不出现在这里。 */
    xunkong: hourXunkong ? { ...hourXunkong, palaces: xunkongPalaces } : null,
    /** 驿马由**日支**定，同一日各时辰不变。 */
    yima: yimaBranch ? { branch: yimaBranch, palace: yimaPalace } : null,
    zhifu: {
      palace: zhifuPalace,
      seat: zhifuSeat,
      /**
       * 值符星是**旬首遁仪本宫**之星：遁仪落中五宫时值符为天禽（寄坤二行事），
       * 不是坤二本身的天芮。此前一律按寄宫后的 zhifuSeat 取，
       * 于是九分之一的盘把值符报成了天芮。
       */
      star: NINE_STARS[zhifuPalace] || null,
      landedPalace: hourStemSeat,
    },
    zhishi: {
      palace: zhishiPalace,
      gate: EIGHT_GATES[zhifuSeat] || null,
    },
    palaces,
  });
};
