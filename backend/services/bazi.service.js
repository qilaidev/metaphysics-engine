/**
 * 八字断命层：在四柱之上做藏干加权、旺衰、用神、神煞与刑冲合会。
 *
 * 与 calculations.service 的分工：那边负责「排出四柱」（走 lunar-javascript，节气换月与
 * 五鼠遁时由库保证），这边负责「拿四柱断命」。两边不互相 import 断命逻辑，避免循环依赖。
 *
 * 口径真源：constants/rulings.js 的 BAZI_RULINGS / SHARED_RULINGS。
 * 换派只改 rulings + 此处读取的常量，禁止另写魔法数。
 * 调候表与格局表在 constants/geju.js，rulings 里对应 tiaohou / monthlyStructure 两条声明。
 */

import { TEN_GOD_TO_GEJU, MONTH_COMMAND_GEJU, GEJU_POLARITY, TIAOHOU } from '../constants/geju.js';
import { STEMS_MAP, ELEMENTS } from '../constants/stems.js';
import { BAZI_RULINGS } from '../constants/rulings.js';
import {
  getHiddenStems,
  getNayin,
  getTwelveStage,
  detectBranchRelations,
  detectStemRelations,
  getXunkong,
  getTaiYuan,
  getTaiXi,
  getMingGong,
  getShenGong,
} from './ganzhi.service.js';
import {
  TIANYI_NOBLE,
  WENCHANG_NOBLE,
  LUSHEN,
  YANGREN,
  BRANCH_GROUP_SHENSHA,
  GUCHEN_GUASU,
  KUIGANG,
  SHENSHA_META,
  TIANDE_BY_MONTH_BRANCH,
  YUEDE_BY_MONTH_BRANCH,
  JIESHA_WANGSHEN_BY_GROUP,
} from '../constants/shensha.js';

/**
 * 月令当权，力量加倍。这是扶抑法里最吃重的一个系数。
 *
 * 只加在**月支藏干**上。当权的是月令提纲，月干并不因坐在月柱而加倍 ——
 * 它和年干时干一样各计一分。此前月干也吃了这个系数，实测会让 22% 的盘
 * 旺衰判反，进而把用神喜忌整条链带偏。
 */
const MONTH_BRANCH_MULTIPLIER = BAZI_RULINGS.monthBranchMultiplier.value;

const STRONG_THRESHOLD = BAZI_RULINGS.strengthThresholds.strongAbove;
const WEAK_THRESHOLD = BAZI_RULINGS.strengthThresholds.weakBelow;

const FOLLOW_THRESHOLD = BAZI_RULINGS.specialPattern.followWeakBelow;
const DOMINANT_THRESHOLD = BAZI_RULINGS.specialPattern.dominantAtLeast;

export const getElementRelation = (me, other) => {
  if (me === other) return 'Same';
  const meIdx = ELEMENTS.indexOf(me);
  const otherIdx = ELEMENTS.indexOf(other);
  if (meIdx === -1 || otherIdx === -1) return 'Unknown';
  if ((meIdx + 1) % 5 === otherIdx) return 'Generates';
  if ((otherIdx + 1) % 5 === meIdx) return 'GeneratedBy';
  if ((meIdx + 2) % 5 === otherIdx) return 'Controls';
  if ((otherIdx + 2) % 5 === meIdx) return 'ControlledBy';
  return 'Unknown';
};

export const TEN_GODS = {
  bijian: { key: 'bijian', cn: '比肩', name: 'Friend (Bi Jian)' },
  jiecai: { key: 'jiecai', cn: '劫财', name: 'Rob Wealth (Jie Cai)' },
  shishen: { key: 'shishen', cn: '食神', name: 'Eating God (Shi Shen)' },
  shangguan: { key: 'shangguan', cn: '伤官', name: 'Hurting Officer (Shang Guan)' },
  pianyin: { key: 'pianyin', cn: '偏印', name: 'Indirect Resource (Pian Yin)' },
  zhengyin: { key: 'zhengyin', cn: '正印', name: 'Direct Resource (Zheng Yin)' },
  piancai: { key: 'piancai', cn: '偏财', name: 'Indirect Wealth (Pian Cai)' },
  zhengcai: { key: 'zhengcai', cn: '正财', name: 'Direct Wealth (Zheng Cai)' },
  qisha: { key: 'qisha', cn: '七杀', name: 'Seven Killings (Qi Sha)' },
  zhengguan: { key: 'zhengguan', cn: '正官', name: 'Direct Officer (Zheng Guan)' },
};

/**
 * 十神：以日主为我，看目标天干与我的五行生克及阴阳异同。
 * 同性为偏（比肩/食神/偏印/偏财/七杀），异性为正（劫财/伤官/正印/正财/正官）。
 */
export const getTenGod = (dayMasterStem, targetStem) => {
  const dm = STEMS_MAP[dayMasterStem];
  const target = STEMS_MAP[targetStem];
  if (!dm || !target) return null;
  const relation = getElementRelation(dm.element, target.element);
  const same = dm.polarity === target.polarity;
  switch (relation) {
    case 'Same':
      return same ? TEN_GODS.bijian : TEN_GODS.jiecai;
    case 'Generates':
      return same ? TEN_GODS.shishen : TEN_GODS.shangguan;
    case 'GeneratedBy':
      return same ? TEN_GODS.pianyin : TEN_GODS.zhengyin;
    case 'Controls':
      return same ? TEN_GODS.piancai : TEN_GODS.zhengcai;
    case 'ControlledBy':
      return same ? TEN_GODS.qisha : TEN_GODS.zhengguan;
    default:
      return null;
  }
};

/**
 * 逐柱展开：天干十神、地支藏干及各自十神、纳音、日主在该支的十二长生。
 * 旧实现每支只取本气一个十神，中气余气整个丢掉，这里全数展开。
 */
export const buildPillarDetails = (pillars, dayMasterStem) => {
  const positions = ['year', 'month', 'day', 'hour'];
  return positions.reduce((acc, position) => {
    const pillar = pillars[position];
    if (!pillar) return acc;
    const stem = pillar.charStem;
    const branch = pillar.charBranch;
    acc[position] = {
      stem,
      branch,
      ganzhi: `${stem}${branch}`,
      stemTenGod:
        position === 'day'
          ? { key: 'rizhu', cn: '日主', name: 'Day Master' }
          : getTenGod(dayMasterStem, stem),
      hiddenStems: getHiddenStems(branch).map((hidden) => ({
        ...hidden,
        element: STEMS_MAP[hidden.stem]?.element || null,
        tenGod: getTenGod(dayMasterStem, hidden.stem),
      })),
      nayin: getNayin(stem, branch),
      twelveStage: getTwelveStage(dayMasterStem, branch),
    };
    return acc;
  }, {});
};

/**
 * 藏干加权五行力量。
 *
 * 四个天干各计 1 分；每个地支按藏干权重分配 1 分（本气独藏者本气即得满分，
 * 三藏者 0.6/0.3/0.1，两藏者 0.7/0.3 —— 逐支归一，见 constants/ganzhi.js）；
 * 月**支**的藏干再整体 ×2，因为月令当权。月干不加倍。
 *
 * 返回原始分与归一化百分比，断旺衰用的是这里的分数，不是干支个数。
 */
export const calculateWeightedElements = (pillars) => {
  const scores = ELEMENTS.reduce((acc, element) => ({ ...acc, [element]: 0 }), {});
  const add = (element, weight) => {
    if (element && scores[element] !== undefined) scores[element] += weight;
  };

  ['year', 'month', 'day', 'hour'].forEach((position) => {
    const pillar = pillars[position];
    if (!pillar) return;
    // 当权的是月令提纲，只有月支藏干加倍；四个天干一律各计一分
    const branchMultiplier = position === 'month' ? MONTH_BRANCH_MULTIPLIER : 1;
    add(STEMS_MAP[pillar.charStem]?.element, 1);
    getHiddenStems(pillar.charBranch).forEach((hidden) => {
      add(STEMS_MAP[hidden.stem]?.element, hidden.weight * branchMultiplier);
    });
  });

  const total = Object.values(scores).reduce((sum, value) => sum + value, 0);
  const percent = ELEMENTS.reduce((acc, element) => {
    acc[element] = total ? Math.round((scores[element] / total) * 1000) / 10 : 0;
    return acc;
  }, {});
  const rounded = ELEMENTS.reduce((acc, element) => {
    acc[element] = Math.round(scores[element] * 100) / 100;
    return acc;
  }, {});

  return { scores: rounded, percent, total: Math.round(total * 100) / 100 };
};

/**
 * 身强身弱：同党（比肩劫财 + 正偏印）力量占全局比重。
 *
 * 这是扶抑法的量化实现。得令（月支藏干含日主同党）单独标出，因为月令是旺衰第一决定因素，
 * 调用方可能要单独看这一项。
 */
export const determineStrength = (pillars, dayMasterStem) => {
  const dmElement = STEMS_MAP[dayMasterStem]?.element;
  if (!dmElement) return null;

  const { scores, total } = calculateWeightedElements(pillars);
  // 同党：与我同类（比劫）+ 生我者（印）
  const allyElements = ELEMENTS.filter((element) => {
    const relation = getElementRelation(dmElement, element);
    return relation === 'Same' || relation === 'GeneratedBy';
  });
  const allyScore = allyElements.reduce((sum, element) => sum + scores[element], 0);
  const ratio = total ? allyScore / total : 0;

  let level = 'balanced';
  if (ratio > STRONG_THRESHOLD) level = 'strong';
  else if (ratio < WEAK_THRESHOLD) level = 'weak';

  /**
   * 通根的强弱按藏干的 role 分：本气为强根，中气为中根，余气为弱根。
   * 「有根即算」与「唯本气才算」是两派，这里两种口径所需的原料都给出，
   * 由调用方按所宗流派取用 —— 布尔值只表示「有没有根」。
   */
  const rootsOf = (branch) =>
    getHiddenStems(branch)
      .filter((hidden) => allyElements.includes(STEMS_MAP[hidden.stem]?.element))
      .map((hidden) => ({
        stem: hidden.stem,
        element: STEMS_MAP[hidden.stem]?.element || null,
        role: hidden.role,
        strength: { primary: 'strong', middle: 'medium', residual: 'weak' }[hidden.role] || null,
      }));

  // 月令同党根（比劫+印）：调用方论「得生/得气」可用
  const monthBranch = pillars.month?.charBranch;
  const seasonalRoots = rootsOf(monthBranch);
  const hasSeasonalSupport = seasonalRoots.length > 0;
  // 得令（严口径）：月令本气与日主同五行。印星得月算得生，不算得令。
  const monthPrimary = getHiddenStems(monthBranch).find((h) => h.role === 'primary');
  const hasSeasonalCommand = !!monthPrimary && STEMS_MAP[monthPrimary.stem]?.element === dmElement;

  // 得地：年日时三支中通根者
  const roots = ['year', 'day', 'hour']
    .map((position) => ({ position, roots: rootsOf(pillars[position]?.charBranch) }))
    .filter((entry) => entry.roots.length > 0);
  const rootedIn = roots.map((entry) => entry.position);

  return {
    dayMaster: dayMasterStem,
    dayMasterElement: dmElement,
    level,
    levelCn: { strong: '身强', weak: '身弱', balanced: '中和' }[level],
    allyScore: Math.round(allyScore * 100) / 100,
    totalScore: total,
    ratio: Math.round(ratio * 1000) / 1000,
    allyElements,
    /**
     * 月支藏干含日主同党（比劫或印）。偏宽，不等于严格「得令」。
     * 严格得令看 hasSeasonalCommand。
     */
    hasSeasonalSupport,
    /** 月令本气与日主同五行（严口径得令）。 */
    hasSeasonalCommand,
    /** 月令里的同党藏干及其强弱。空数组即月令无同党。 */
    seasonalRoots,
    rootedIn,
    /** 年日时三支的通根明细，含本气/中气/余气之别。 */
    roots,
  };
};

/**
 * 从格与专旺格。
 *
 * 扶抑法有一个没写出来的前提：**日主还扶得起来**。日主全无通根时扶不起来，
 * 正解是弃命相从，用神与扶抑法**恰好相反** —— 从格喜的正是扶抑法要克的那一党。
 * 此前没有这一层，偏枯到极处的盘会被判 weak 然后建议「宜以印比生扶」，方向是反的；
 * 专旺格同理会被判 strong 然后建议「宜以官杀食伤财耗其气」，也是反的。
 * 这是本模块唯一一处「不补这层就会给出反向结论」的地方，故判据取硬条件、不取近似。
 *
 * - **从格（弃命从旺神）**：四支全无同党（比劫印）藏干，且同党占比低于阈值。
 *   无根是硬条件 —— 有一点根就不是从格，而是身弱用印，两者用神相反。
 *   占比阈值（<20%）等价于「天干也不见印比」：日主自身即占 1/9≈11.1%，
 *   再透一个印比就到 22.2%。即只认真从，不认假从。
 * - **专旺格（一行得气）**：得令（月令本气即日主五行）且同党占比不低于阈值。
 *   只得地不算 —— 一行得气，得的是令。
 *
 * 返回分两截，与 determineMonthlyStructure 同一模式：`facts` 是无分歧的结构事实
 * （无根与否、各五行力量、所从之神的排序），`suggested` 是按选定口径推出的格。
 * 两格都不成立时 `suggested` 为 null —— 那是常态，不是缺数据。
 */
const FOLLOW_NAMES = {
  Generates: { key: 'congEr', cn: '从儿格', followCn: '食伤' },
  Controls: { key: 'congCai', cn: '从财格', followCn: '财' },
  ControlledBy: { key: 'congSha', cn: '从杀格', followCn: '官杀' },
};

const DOMINANT_NAMES = {
  Wood: { key: 'quzhi', cn: '曲直格' },
  Fire: { key: 'yanshang', cn: '炎上格' },
  Earth: { key: 'jiase', cn: '稼穑格' },
  Metal: { key: 'congge', cn: '从革格' },
  Water: { key: 'runxia', cn: '润下格' },
};

export const determineSpecialPattern = (strength, pillars) => {
  if (!strength || !pillars) return null;
  const dmElement = strength.dayMasterElement;
  const { scores, percent } = calculateWeightedElements(pillars);

  // 无根：月令与年日时三支里都没有同党藏干。这是从格的硬条件。
  const rootless = strength.seasonalRoots.length === 0 && strength.roots.length === 0;

  // 非同党各五行按力量降序，最强者即「所从之神」
  const ranked = ELEMENTS.filter((element) => !strength.allyElements.includes(element))
    .map((element) => {
      const relation = getElementRelation(dmElement, element);
      return {
        element,
        score: scores[element],
        percent: percent[element],
        relation,
        tenGodGroupCn: FOLLOW_NAMES[relation]?.followCn || null,
      };
    })
    .sort((a, b) => b.score - a.score);

  const drains = ranked.map((entry) => entry.element);
  const supports = strength.allyElements;

  const facts = {
    /** 四支（含月令）全无比劫印藏干。从格的硬条件。 */
    rootless,
    /** 月令本气即日主五行。专旺格的硬条件，与 strength.hasSeasonalCommand 同义。 */
    commanded: strength.hasSeasonalCommand,
    allyRatio: strength.ratio,
    elementScores: scores,
    elementPercent: percent,
    /** 非同党五行按力量降序 —— 从格所从的就是这里的第一位。 */
    ranked,
    thresholds: { followWeakBelow: FOLLOW_THRESHOLD, dominantAtLeast: DOMINANT_THRESHOLD },
  };

  if (rootless && strength.ratio < FOLLOW_THRESHOLD && ranked.length) {
    const followed = ranked[0];
    const named = FOLLOW_NAMES[followed.relation];
    return {
      facts,
      suggested: {
        type: 'follow',
        key: named?.key || 'cong',
        cn: named?.cn || '从格',
        followElement: followed.element,
        followTenGodCn: named?.followCn || null,
        // 从格顺其旺势：克泄耗一党皆喜，印比反为忌（与身强同向，与身弱相反）
        favorable: drains,
        unfavorable: supports,
        basis: 'rootless',
        basisCn:
          `四支全无同党通根，同党占比 ${strength.ratio} 低于 ${FOLLOW_THRESHOLD}，` +
          `日主无所依托，弃命从${named?.followCn || '旺神'}`,
        method: '从格（弃命相从）',
      },
    };
  }

  if (strength.hasSeasonalCommand && strength.ratio >= DOMINANT_THRESHOLD) {
    const named = DOMINANT_NAMES[dmElement];
    // 专旺顺其气势：印比扶其势、食伤泄其秀皆喜；官杀逆其势、财破其印为忌
    const leak = ELEMENTS.filter(
      (element) => getElementRelation(dmElement, element) === 'Generates'
    );
    const against = ELEMENTS.filter((element) => {
      const relation = getElementRelation(dmElement, element);
      return relation === 'Controls' || relation === 'ControlledBy';
    });
    return {
      facts,
      suggested: {
        type: 'dominant',
        key: named?.key || 'dominant',
        cn: named?.cn || '专旺格',
        followElement: dmElement,
        followTenGodCn: '印比',
        favorable: [...supports, ...leak],
        unfavorable: against,
        basis: 'commanded',
        basisCn:
          `月令本气即日主${dmElement}，同党占比 ${strength.ratio} 不低于 ${DOMINANT_THRESHOLD}，` +
          `一行得气，宜顺不宜逆`,
        method: '专旺格（一行得气）',
      },
    };
  }

  return { facts, suggested: null };
};

/**
 * 用神喜忌。
 *
 * 默认走扶抑法：身强则克泄耗为用（官杀、食伤、财），身弱则生扶为用（印、比劫）。
 * 中和局扶抑意义不大，此时 favorable 给空数组并说明理由，不硬凑一个用神。
 *
 * **从格与专旺格先于扶抑判**：那两格里扶抑给出的方向是反的（见 determineSpecialPattern）。
 * 传了 specialPattern 且其 suggested 成立时用神照它取；不传则退回纯扶抑，
 * 既有调用方的行为逐字节不变。
 */
export const determineUsefulGod = (strength, specialPattern = null) => {
  if (!strength) return null;
  const dmElement = strength.dayMasterElement;
  const classify = (element) => getElementRelation(dmElement, element);

  const drains = ELEMENTS.filter((element) => {
    const relation = classify(element);
    return relation === 'Generates' || relation === 'Controls' || relation === 'ControlledBy';
  });
  const supports = strength.allyElements;

  const special = specialPattern?.suggested;
  if (special) {
    return {
      method: special.type === 'follow' ? 'follow' : 'dominant',
      methodCn: special.method,
      favorable: special.favorable,
      unfavorable: special.unfavorable,
      reason: special.basisCn,
      /** 取用改走特殊格局时标出是哪一格；要退回扶抑，照 strength.level 自行重推。 */
      pattern: { key: special.key, cn: special.cn },
    };
  }

  if (strength.level === 'strong') {
    return {
      method: 'restraint',
      methodCn: '扶抑法（身强宜克泄耗）',
      favorable: drains,
      unfavorable: supports,
      reason: `日主${dmElement}偏旺（同党占比 ${strength.ratio}），宜以官杀食伤财耗其气`,
    };
  }
  if (strength.level === 'weak') {
    return {
      method: 'support',
      methodCn: '扶抑法（身弱宜生扶）',
      favorable: supports,
      unfavorable: drains,
      reason: `日主${dmElement}偏弱（同党占比 ${strength.ratio}），宜以印比生扶`,
    };
  }
  return {
    method: 'balanced',
    methodCn: '中和',
    favorable: [],
    unfavorable: [],
    reason: `日主${dmElement}中和（同党占比 ${strength.ratio}），扶抑法难分主次，宜改用调候或病药法取用`,
  };
};

/**
 * 月令取格。
 *
 * 子平法的正路是**先以月令定格**，扶抑只是其中一条辅线。此前只有身强身弱，
 * 等于跳过了整个格局层。
 *
 * 返回分两截：`facts` 是结构事实（本气中气余气各是什么、透在哪一柱、什么十神），
 * 这一截无流派分歧，取任何一派都用得上；`suggested` 是按选定口径推出的格，
 * 换派只需照 `facts` 重推，不必等引擎改。
 */
export const determineMonthlyStructure = (pillars) => {
  const dayMasterStem = pillars?.day?.charStem;
  const monthBranch = pillars?.month?.charBranch;
  if (!dayMasterStem || !monthBranch) return null;

  // 「透」只看年月时三干 —— 日干是我，我不能同时是我的格
  const revealPositions = ['year', 'month', 'hour'];
  const revealedStems = revealPositions
    .map((position) => ({ position, stem: pillars[position]?.charStem }))
    .filter((entry) => entry.stem);

  const hidden = getHiddenStems(monthBranch).map((entry) => {
    const revealedIn = revealedStems
      .filter((reveal) => reveal.stem === entry.stem)
      .map((reveal) => reveal.position);
    return {
      stem: entry.stem,
      role: entry.role,
      weight: entry.weight,
      element: STEMS_MAP[entry.stem]?.element || null,
      tenGod: getTenGod(dayMasterStem, entry.stem),
      revealed: revealedIn.length > 0,
      revealedIn,
    };
  });

  const primary = hidden.find((entry) => entry.role === 'primary') || null;
  const dmElement = STEMS_MAP[dayMasterStem]?.element;
  const dmPolarity = STEMS_MAP[dayMasterStem]?.polarity;
  const primaryElement = primary?.element;

  /**
   * 「月令即我」的三格不看透干：月令本气与日主同五行时，
   * 同阴阳为建禄；异阴阳者，**阳干为羊刃、阴干为月劫**。
   * 这三格本来就没有可透之神，故必须先于透干规则判。
   *
   * 阴干无刃：《子平真诠》「禄前一位，惟五阳有之，故为阳刃」。
   * 此前阴干（如乙日寅月）也判羊刃格，与 shensha.js 的 YANGREN 只列五阳干、
   * 以及 rulings 的 shenshaYangren 直接冲突 —— 同一个概念在同一个引擎里两套判据。
   */
  /**
   * 建禄与羊刃按**禄刃表**定，不按「月令本气与我同五行」推：两者对甲乙丙丁庚辛壬癸八干
   * 结果相同，对戊己却不同 —— 土寄火乡，戊禄在巳、刃在午，己禄在午，而巳午的本气是丙丁。
   * 此前按本气同五行判：戊日巳月不判建禄（报成偏印格）、戊日午月不判羊刃，
   * 戊日辰戌月反而因本气戊同阴阳被报成建禄 —— 与 shensha.js 的 LUSHEN / YANGREN 表自相矛盾，
   * 同一个引擎对「戊之禄在哪」给了两个答案。
   *
   * 阴干月劫：月令本气即我之劫财（乙寅、丁巳、辛申、癸亥）。己土无此月（戊土只在四季月作本气），
   * 己日辰戌月与戊日丑未月一样走下面的透干规则，比劫透干或皆不透时归月劫。
   */
  const isYangStem = dmPolarity === '+';
  const isJianlu = monthBranch === LUSHEN[dayMasterStem];
  const isYangren = isYangStem && monthBranch === YANGREN[dayMasterStem];
  const isYuejie =
    !isYangStem &&
    !isJianlu &&
    !!primaryElement &&
    primaryElement === dmElement &&
    STEMS_MAP[primary.stem]?.polarity !== dmPolarity &&
    !['辰', '戌', '丑', '未'].includes(monthBranch);

  let basis = null;
  let source = null;
  if (isJianlu) {
    basis = 'jianlu';
    source = primary;
  } else if (isYangren) {
    basis = 'yangren';
    source = primary;
  } else if (isYuejie) {
    basis = 'yuejie';
    source = primary;
  } else if (primary?.revealed) {
    basis = 'primaryRevealed';
    source = primary;
  } else {
    // 本气不透，退而取中气余气之透者；同透则本气序在前者优先
    const revealedHidden = hidden.find((entry) => entry.role !== 'primary' && entry.revealed);
    if (revealedHidden) {
      basis = 'secondaryRevealed';
      source = revealedHidden;
    } else {
      basis = 'primaryUnrevealed';
      source = primary;
    }
  }

  const tenGodKey = source?.tenGod?.key || null;
  /**
   * 建禄羊刃月劫由 basis 直取；其余走十神表。表里比肩劫财都指向月劫：
   * 走到那里的比劫要么是中气余气之透（戊日寅月寅之余气戊透 —— 戊禄在巳不在寅），
   * 要么是四季月的本气土，都够不上禄刃两格，统归月劫。
   */
  let geju = MONTH_COMMAND_GEJU[basis] || null;
  if (!geju && tenGodKey) geju = TEN_GOD_TO_GEJU[tenGodKey] || null;

  const BASIS_CN = {
    jianlu: '月支即日主之禄（临官），为建禄',
    yangren: '月支即阳干之刃（禄前一位），为羊刃',
    yuejie: '月令本气为日主之劫财而日主为阴干，阴干无刃，为月劫',
    primaryRevealed: '月令本气透干，以透干论格',
    secondaryRevealed: '本气不透，取中气余气之透者论格',
    primaryUnrevealed: '藏干皆不透，以月令本气论格',
  };

  return {
    monthBranch,
    dayMaster: dayMasterStem,
    /** 月令藏干的结构事实。无流派分歧，任何取格法都从这里出发。 */
    facts: { hiddenStems: hidden, revealedStems },
    /** 按选定口径推出的格。换派只改 service 里这一段规则。 */
    suggested: geju
      ? {
          ...geju,
          tenGod: source?.tenGod || null,
          fromStem: source?.stem || null,
          fromRole: source?.role || null,
          basis,
          basisCn: BASIS_CN[basis] || null,
          polarity: GEJU_POLARITY[geju.key] || null,
          method: '子平真诠·月令取格',
        }
      : null,
  };
};

/**
 * 调候用神（《穷通宝鉴》）。
 *
 * 与扶抑并列而非替代：扶抑论强弱，调候论寒暖燥湿。中和之局扶抑难分主次，
 * 调候正是那时候的主答案 —— 此前中和局只说了一句「宜改用调候」然后就没有下文。
 *
 * 首位为主用、其余为辅用。`present` 标出该用神在四柱天干里是否已现，
 * 已现者为「有」、未现者要看大运流年补 —— 这个判断调用方常要，故一并给出。
 */
export const determineTiaohou = (pillars) => {
  const dayMasterStem = pillars?.day?.charStem;
  const monthBranch = pillars?.month?.charBranch;
  const stems = TIAOHOU[dayMasterStem]?.[monthBranch];
  if (!stems) return null;

  const chartStems = ['year', 'month', 'day', 'hour']
    .map((position) => pillars[position]?.charStem)
    .filter(Boolean);
  const hiddenAll = ['year', 'month', 'day', 'hour'].flatMap((position) =>
    getHiddenStems(pillars[position]?.charBranch).map((entry) => entry.stem)
  );

  return {
    method: 'tiaohou',
    methodCn: '调候法（穷通宝鉴）',
    source: '《穷通宝鉴》调候用神速查表（各刊本互有出入，见 constants/geju.js）',
    stems: stems.map((stem, index) => ({
      stem,
      element: STEMS_MAP[stem]?.element || null,
      tenGod: getTenGod(dayMasterStem, stem),
      role: index === 0 ? 'primary' : 'secondary',
      roleCn: index === 0 ? '主用' : '辅用',
      /** 已透于四柱天干。 */
      revealed: chartStems.includes(stem),
      /** 藏于四支之中（未透但有根）。 */
      hidden: hiddenAll.includes(stem),
    })),
  };
};

const groupShenshaFor = (branch, field) => {
  const hit = BRANCH_GROUP_SHENSHA.find((group) => group.branches.includes(branch));
  return hit ? hit[field] : null;
};

/**
 * 神煞检出。
 *
 * 查法基准：干系神煞（天乙/文昌/禄/刃）以日干为主，支系神煞（驿马/桃花/华盖/将星、
 * 孤辰寡宿）以年支与日支分别起，两处所得都列出并标注 basis，不合并 —— 年起与日起
 * 落点不同是常态，合并会丢信息。
 */
export const detectShensha = (pillars) => {
  const positions = ['year', 'month', 'day', 'hour'];
  const dayStem = pillars.day?.charStem;
  const yearBranch = pillars.year?.charBranch;
  const dayBranch = pillars.day?.charBranch;
  const found = [];

  const push = (key, targetBranch, basis) => {
    if (!targetBranch) return;
    positions.forEach((position) => {
      if (pillars[position]?.charBranch === targetBranch) {
        found.push({ ...SHENSHA_META[key], branch: targetBranch, position, basis });
      }
    });
  };

  // 天乙贵人：日干、年干都查（通书两起；落点可能不同，分 basis 列出）
  const yearStem = pillars.year?.charStem;
  (TIANYI_NOBLE[dayStem] || []).forEach((branch) => push('tianyi', branch, 'dayStem'));
  if (yearStem && yearStem !== dayStem) {
    (TIANYI_NOBLE[yearStem] || []).forEach((branch) => push('tianyi', branch, 'yearStem'));
  }
  push('wenchang', WENCHANG_NOBLE[dayStem], 'dayStem');
  push('lushen', LUSHEN[dayStem], 'dayStem');
  push('yangren', YANGREN[dayStem], 'dayStem');

  [
    { basis: 'yearBranch', source: yearBranch },
    { basis: 'dayBranch', source: dayBranch },
  ].forEach(({ basis, source }) => {
    if (!source) return;
    ['yima', 'taohua', 'huagai', 'jiangxing'].forEach((key) => {
      push(key, groupShenshaFor(source, key), basis);
    });
    const guhit = GUCHEN_GUASU.find((entry) => entry.branches.includes(source));
    if (guhit) {
      push('guchen', guhit.guchen, basis);
      push('guasu', guhit.guasu, basis);
    }
  });

  const dayGanzhi = `${dayStem}${dayBranch}`;
  if (KUIGANG.includes(dayGanzhi)) {
    found.push({ ...SHENSHA_META.kuigang, branch: dayBranch, position: 'day', basis: 'dayPillar' });
  }

  // 天德月德按月支查：所得是天干时在四柱天干里找，是地支时在地支里找
  const monthBranch = pillars.month?.charBranch;
  const pushStemOrBranch = (key, target, basis) => {
    if (!target) return;
    if (STEMS_MAP[target]) {
      positions.forEach((position) => {
        if (pillars[position]?.charStem === target) {
          found.push({ ...SHENSHA_META[key], stem: target, position, basis });
        }
      });
      return;
    }
    push(key, target, basis);
  };
  pushStemOrBranch('tiande', TIANDE_BY_MONTH_BRANCH[monthBranch], 'monthBranch');
  pushStemOrBranch('yuede', YUEDE_BY_MONTH_BRANCH[monthBranch], 'monthBranch');

  // 劫煞亡神与驿马同法，年支日支两起
  [
    { basis: 'yearBranch', source: yearBranch },
    { basis: 'dayBranch', source: dayBranch },
  ].forEach(({ basis, source }) => {
    const hit = JIESHA_WANGSHEN_BY_GROUP.find((entry) => entry.branches.includes(source));
    if (!hit) return;
    push('jiesha', hit.jiesha, basis);
    push('wangshen', hit.wangshen, basis);
  });

  // 同一神煞可能由年起与日起同时命中同一支，去重时保留 basis 以便追溯
  const seen = new Set();
  return found.filter((item) => {
    const id = `${item.key}-${item.position}-${item.basis}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

/** 四柱之间的刑冲合会害破，以及天干合冲。 */
export const analyzeRelations = (pillars) => {
  const positions = ['year', 'month', 'day', 'hour'];
  const branches = positions.map((p) => pillars[p]?.charBranch).filter(Boolean);
  const stems = positions.map((p) => pillars[p]?.charStem).filter(Boolean);
  return {
    branches: detectBranchRelations(branches),
    stems: detectStemRelations(stems),
  };
};

/**
 * 胎元、胎息、命宫、身宫。
 *
 * 四者不共用同一根柱：胎元由**月柱**推，胎息由**日柱**推，命宫身宫由**月支与时支**推、
 * 宫干由年干起五虎遁。海外出生时年月柱与日时柱分属两个坐标系（见 calculations.service），
 * 这里一律取 pillars 里已经定好的那四柱，不再自己回头找时刻，两个坐标系因此不会串。
 */
export const buildKeyPoints = (pillars) => {
  const yearStem = pillars?.year?.charStem;
  const monthStem = pillars?.month?.charStem;
  const monthBranch = pillars?.month?.charBranch;
  const dayStem = pillars?.day?.charStem;
  const dayBranch = pillars?.day?.charBranch;
  const hourBranch = pillars?.hour?.charBranch;
  return {
    taiYuan: getTaiYuan(monthStem, monthBranch),
    taiXi: getTaiXi(dayStem, dayBranch),
    mingGong: getMingGong(yearStem, monthBranch, hourBranch),
    shenGong: getShenGong(yearStem, monthBranch, hourBranch),
  };
};

/**
 * 完整的八字分析：在四柱之上叠加藏干、旺衰、用神、神煞、刑冲、空亡。
 * 返回结构是新增的，不动 performCalculation 原有的 pillars/fiveElements/tenGods/luckCycles。
 */
export const analyzeChart = (pillars) => {
  const dayMasterStem = pillars?.day?.charStem;
  if (!dayMasterStem) return null;

  const strength = determineStrength(pillars, dayMasterStem);
  // 从格/专旺必须先于用神算出来 —— 那两格里扶抑给出的方向是反的
  const specialPattern = determineSpecialPattern(strength, pillars);
  const dayGanzhi = `${dayMasterStem}${pillars.day.charBranch}`;

  return {
    dayMaster: {
      stem: dayMasterStem,
      element: STEMS_MAP[dayMasterStem]?.element || null,
      polarity: STEMS_MAP[dayMasterStem]?.polarity || null,
    },
    pillarDetails: buildPillarDetails(pillars, dayMasterStem),
    weightedElements: calculateWeightedElements(pillars),
    strength,
    usefulGod: determineUsefulGod(strength, specialPattern),
    /**
     * 从格与专旺格。`suggested` 为 null 是常态（绝大多数盘两格都不成立），
     * 不为 null 时 usefulGod 已经照它取用，不必再自行覆盖。
     */
    specialPattern,
    /** 调候与扶抑并列。中和局时扶抑给不出答案，看这一项。 */
    tiaohou: determineTiaohou(pillars),
    /** 月令格局：结构事实 + 按选定口径推出的格。 */
    monthlyStructure: determineMonthlyStructure(pillars),
    shensha: detectShensha(pillars),
    relations: analyzeRelations(pillars),
    xunkong: getXunkong(dayGanzhi),
    keyPoints: buildKeyPoints(pillars),
  };
};
