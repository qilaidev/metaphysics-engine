/**
 * 六爻纳甲（京房筮法）装卦层。
 *
 * 输入一个六爻卦（自初爻至上爻的 0/1 数组）与起卦日的干支，输出可断的卦：
 * 卦名、所属宫、世应、纳甲干支、六亲、六神、伏神、旬空，以及动爻与变卦。
 *
 * 两个容易写错的地方，这里都显式处理：
 * - **八宫归属不硬编**。六十四卦的宫与世爻由「本宫→一世→…→五世→游魂→归魂」七条
 *   推衍规则算出来（见 PALACE_DERIVATION）。抄一张 64 行的表远比抄七条规则容易出错。
 * - **变卦的六亲仍以本卦之宫为我**，不按变卦自己的宫重排。这是纳甲筮法的定例，
 *   按变卦宫重排会让整个动爻分析失去参照。
 */

import { TRIGRAMS, ZHOUYI_TEXT } from '../data/ichingHexagrams.js';
import { BRANCHES_MAP } from '../constants/stems.js';
import {
  HEXAGRAM_NAMES,
  TRIGRAM_CN,
  NAJIA,
  PALACE_ELEMENTS,
  PALACE_ORDER,
  PALACE_DERIVATION,
  SIX_RELATIVES,
  SIX_GODS,
  SIX_GOD_START_BY_DAY_STEM,
} from '../constants/liuyao.js';
import { withSchool } from '../constants/rulings.js';
import { getElementRelation } from './bazi.service.js';
import { getSeasonalState, getXunkong } from './ganzhi.service.js';
import { BRANCH_CLASHES, BRANCH_SIX_COMBINATIONS } from '../constants/ganzhi.js';

const trigramByLines = new Map(TRIGRAMS.map((t) => [t.lines.join(''), t]));

const linesKey = (lines) => lines.join('');

/** 由三爻取八卦。lines 自下而上，1 为阳。 */
export const getTrigram = (lines) => trigramByLines.get(linesKey(lines)) || null;

/**
 * 生成六十四卦的宫属表。
 *
 * 自每个八纯卦出发，依次施加世卦推衍规则，每一步落到的卦即该宫的对应世卦。
 * 八宫 × 八步 = 64 卦，恰好覆盖且互不重叠 —— 测试里会验证这一点。
 */
const buildPalaceMap = () => {
  const map = new Map();
  PALACE_ORDER.forEach((palaceKey) => {
    const trigram = TRIGRAMS.find((t) => t.name === palaceKey);
    if (!trigram) return;
    let lines = [...trigram.lines, ...trigram.lines];
    PALACE_DERIVATION.forEach((step) => {
      const next = [...lines];
      step.flip.forEach((position) => {
        next[position - 1] = next[position - 1] ? 0 : 1;
      });
      lines = next;
      map.set(linesKey(lines), {
        palace: palaceKey,
        palaceCn: TRIGRAM_CN[palaceKey]?.cn || palaceKey,
        palaceElement: PALACE_ELEMENTS[palaceKey],
        type: step.key,
        typeCn: step.cn,
        shiYao: step.shiYao,
        // 世应相隔两爻：世在初应在四，世在四应在初，余类推
        yingYao: ((step.shiYao - 1 + 3) % 6) + 1,
      });
    });
  });
  return map;
};

const PALACE_MAP = buildPalaceMap();

export const getPalaceInfo = (lines) => PALACE_MAP.get(linesKey(lines)) || null;

/** 供测试与调试用：导出整张宫属表。 */
export const listPalaceMap = () => new Map(PALACE_MAP);

/** 卦名。data/ichingHexagrams.js 里的 name 是描述不是卦名，断卦要用这里的。 */
export const getHexagramName = (lines) => {
  const lower = getTrigram(lines.slice(0, 3));
  const upper = getTrigram(lines.slice(3, 6));
  if (!lower || !upper) return null;
  const entry = HEXAGRAM_NAMES[`${upper.name}-${lower.name}`];
  if (!entry) return null;
  const text = ZHOUYI_TEXT[entry.sequence] || null;
  return {
    ...entry,
    upper: upper.name,
    lower: lower.name,
    upperCn: TRIGRAM_CN[upper.name]?.cn,
    lowerCn: TRIGRAM_CN[lower.name]?.cn,
    /** 《周易》卦辞与大象传。经文是原料不是断语，底本见 data/zhouyiText.js。 */
    text: text ? { gua: text.gua, daXiang: text.daXiang } : null,
  };
};

/**
 * 纳甲装卦：内卦（初二三）取下卦的前三支，外卦（四五六）取上卦的后三支。
 * 天干只有乾坤内外有别（乾内甲外壬、坤内乙外癸），其余六卦内外同干。
 */
export const buildNajia = (lines) => {
  const lower = getTrigram(lines.slice(0, 3));
  const upper = getTrigram(lines.slice(3, 6));
  if (!lower || !upper) return [];
  const lowerNajia = NAJIA[lower.name];
  const upperNajia = NAJIA[upper.name];
  if (!lowerNajia || !upperNajia) return [];

  return [0, 1, 2]
    .map((i) => ({ stem: lowerNajia.innerStem, branch: lowerNajia.branches[i] }))
    .concat([3, 4, 5].map((i) => ({ stem: upperNajia.outerStem, branch: upperNajia.branches[i] })));
};

/**
 * 六亲：以本宫五行为「我」，看爻支五行与我的生克。
 * 生我者父母、我生者子孙、克我者官鬼、我克者妻财、同我者兄弟。
 */
export const getSixRelative = (palaceElement, branchElement) => {
  switch (getElementRelation(palaceElement, branchElement)) {
    case 'Same':
      return SIX_RELATIVES.xiongdi;
    case 'Generates':
      return SIX_RELATIVES.zisun;
    case 'GeneratedBy':
      return SIX_RELATIVES.fumu;
    case 'Controls':
      return SIX_RELATIVES.qicai;
    case 'ControlledBy':
      return SIX_RELATIVES.guangui;
    default:
      return null;
  }
};

/** 六神：日干定初爻所安之神，其余顺序而上，六神循环。 */
export const buildSixGods = (dayStem) => {
  const start = SIX_GOD_START_BY_DAY_STEM[dayStem];
  if (start === undefined) return [];
  return Array.from({ length: 6 }, (_, i) => SIX_GODS[(start + i) % 6]);
};

/**
 * 伏神：本卦六亲不全时，缺的那一路从本宫首卦（八纯卦）同名六亲处取，
 * 伏于本卦对应爻位之下。用神不上卦时全靠它来断。
 */
export const findHiddenSpirits = (lines, palaceInfo) => {
  if (!palaceInfo) return [];
  const palaceTrigram = TRIGRAMS.find((t) => t.name === palaceInfo.palace);
  if (!palaceTrigram) return [];

  const pureLines = [...palaceTrigram.lines, ...palaceTrigram.lines];
  const pureNajia = buildNajia(pureLines);
  const presentRelatives = new Set(
    buildNajia(lines)
      .map((yao) => getSixRelative(palaceInfo.palaceElement, BRANCHES_MAP[yao.branch]?.element))
      .filter(Boolean)
      .map((relative) => relative.key)
  );

  // 一亲一伏：缺哪一类六亲只取一条，不把本宫纯卦里同亲的多爻全挂上。
  const hidden = [];
  const hiddenKeys = new Set();
  pureNajia.forEach((yao, index) => {
    const element = BRANCHES_MAP[yao.branch]?.element;
    const relative = getSixRelative(palaceInfo.palaceElement, element);
    if (!relative || presentRelatives.has(relative.key) || hiddenKeys.has(relative.key)) return;
    hiddenKeys.add(relative.key);
    hidden.push({
      position: index + 1,
      stem: yao.stem,
      branch: yao.branch,
      element,
      relative,
    });
  });
  return hidden;
};

const isClash = (a, b) =>
  BRANCH_CLASHES.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

const isCombine = (a, b) =>
  BRANCH_SIX_COMBINATIONS.some(
    ({ pair }) => (pair[0] === a && pair[1] === b) || (pair[0] === b && pair[1] === a)
  );

/**
 * 月建日辰对各爻的作用。这是六爻断卦里决定爻之旺衰的两个外部力量：
 * 月建管一月之权，日辰管一日之令，二者都能生扶或冲克爻神。
 */
const analyzeExternalInfluence = (branch, { monthBranch, dayBranch, xunkongBranches }) => {
  const element = BRANCHES_MAP[branch]?.element;
  const result = {
    monthBroken: false,
    clashedByDay: false,
    combinedWithDay: false,
    xunkong: xunkongBranches.includes(branch),
    monthRelation: null,
    dayRelation: null,
    /**
     * 爻的四时旺衰。**只按月建判**，不按日辰：月建管一月之权，四时旺衰是它的事；
     * 日辰管一日之令，作用是生克冲合，不另立旺衰档 —— 两者都折成旺衰会让同一爻
     * 出现两个互相矛盾的档。不给月建时为 null（此前连这一档都没有，
     * 只有月/日的生克关系，而「这爻旺不旺」正是断卦的第一问）。
     */
    seasonalState: null,
  };

  if (monthBranch) {
    // 月破：爻支与月建相冲
    result.monthBroken = isClash(branch, monthBranch);
    result.monthRelation = getElementRelation(BRANCHES_MAP[monthBranch]?.element, element);
    result.seasonalState = getSeasonalState(BRANCHES_MAP[monthBranch]?.element, element);
  }
  if (dayBranch) {
    result.clashedByDay = isClash(branch, dayBranch);
    result.combinedWithDay = isCombine(branch, dayBranch);
    result.dayRelation = getElementRelation(BRANCHES_MAP[dayBranch]?.element, element);
  }
  return result;
};

/**
 * 六冲卦与六合卦。断卦时这两类卦本身就带方向性（冲主散、合主聚），
 * 与逐爻的冲合是两回事，故在卦名一级单列。
 *
 * 六冲十卦 = 八纯卦 + 天雷无妄 + 雷天大壮；六合八卦如下。各家名单一致，无分歧。
 */
const SIX_CLASH_HEXAGRAMS = new Set([
  '乾为天',
  '坎为水',
  '艮为山',
  '震为雷',
  '巽为风',
  '离为火',
  '坤为地',
  '兑为泽',
  '天雷无妄',
  '雷天大壮',
]);

const SIX_COMBINE_HEXAGRAMS = new Set([
  '天地否',
  '地天泰',
  '泽水困',
  '水泽节',
  '雷地豫',
  '地雷复',
  '火山旅',
  '山火贲',
]);

/**
 * 进神：动爻所变之支与本支同五行且序数递进。八组，逐组写死不推导 ——
 * 水只有亥子两支、土有丑辰未戌四支，用「同五行的下一位」去算，两支那一组两个方向
 * 都会算成进神。
 */
const ADVANCE_PAIRS = {
  亥: '子',
  寅: '卯',
  巳: '午',
  申: '酉',
  丑: '辰',
  辰: '未',
  未: '戌',
  戌: '丑',
};

/** 动爻变出之支与本支的关系：进神 / 退神 / 伏吟（同支）/ 反吟（相冲）。 */
const classifyChange = (from, to) => {
  if (!from || !to) return null;
  if (from === to) return { key: 'fuyin', cn: '伏吟' };
  if (isClash(from, to)) return { key: 'fanyin', cn: '反吟' };
  if (ADVANCE_PAIRS[from] === to) return { key: 'advance', cn: '进神' };
  if (ADVANCE_PAIRS[to] === from) return { key: 'retreat', cn: '退神' };
  return null;
};

/**
 * 内外卦的伏吟返吟。判据是**三爻纳甲支整体**与之卦对应三爻的关系：
 * 三支全同为伏吟，三支全冲为返吟。只看卦名或只看一爻都会漏判。
 *
 * 前提是这一卦里**有爻在动**：静卦的三支必然与自己相同，若不设这道闸，
 * 任何一个未动的内卦或外卦都会被报成伏吟 —— 那不是伏吟，那是它没动。
 */
const classifyTrigramShift = (najia, changedNajia, offset, changing) => {
  if (!changedNajia.length) return null;
  const positions = [offset + 1, offset + 2, offset + 3];
  if (!positions.some((position) => changing.has(position))) return null;
  const slice = [0, 1, 2].map((i) => ({
    from: najia[offset + i]?.branch,
    to: changedNajia[offset + i]?.branch,
  }));
  if (slice.some((pair) => !pair.from || !pair.to)) return null;
  if (slice.every((pair) => pair.from === pair.to)) return { key: 'fuyin', cn: '伏吟' };
  if (slice.every((pair) => isClash(pair.from, pair.to))) return { key: 'fanyin', cn: '返吟' };
  return null;
};

/**
 * 完整装卦。
 *
 * @param {number[]} lines 本卦六爻，自初爻至上爻，1 阳 0 阴
 * @param {object} options
 * @param {number[]} options.changingLines 动爻位置（1..6）
 * @param {string} options.dayGanzhi 起卦日干支，用于六神、旬空与日辰
 * @param {string} options.monthBranch 起卦月建地支
 */
export const buildLiuyaoChart = (lines, options = {}) => {
  if (!Array.isArray(lines) || lines.length !== 6) return null;
  const { changingLines = [], dayGanzhi = null, monthBranch = null } = options;

  const palaceInfo = getPalaceInfo(lines);
  const najia = buildNajia(lines);
  const name = getHexagramName(lines);
  if (!palaceInfo || !najia.length) return null;

  const dayStem = dayGanzhi ? dayGanzhi[0] : null;
  const dayBranch = dayGanzhi ? dayGanzhi[1] : null;
  const sixGods = buildSixGods(dayStem);
  const xunkong = dayGanzhi ? getXunkong(dayGanzhi) : null;
  const xunkongBranches = xunkong?.branches || [];

  const changing = new Set(changingLines.filter((n) => n >= 1 && n <= 6));

  // 之卦：动爻阴阳反转。变爻的六亲仍以**本卦之宫**为我，不按之卦的宫重排。
  const changedLines = lines.map((bit, index) => (changing.has(index + 1) ? (bit ? 0 : 1) : bit));
  const hasChange = changing.size > 0;
  const changedNajia = hasChange ? buildNajia(changedLines) : [];

  /**
   * 本卦的《周易》爻辞，按爻位挂上。
   *
   * 纳甲筮法断的是六亲六神与生克，爻辞是另一路参照 —— 两者不冲突，
   * 常有断卦先看纳甲、再拿动爻爻辞印证。此前引擎只给卦名，爻辞得去别处找。
   * 用九/用六不属于某一爻，故不挂在爻上，在 name.text 之外由易经端点单列。
   */
  const benGuaText = ZHOUYI_TEXT[name?.sequence] || null;

  const yaos = najia.map((yao, index) => {
    const position = index + 1;
    const element = BRANCHES_MAP[yao.branch]?.element || null;
    const isChanging = changing.has(position);
    const changedYao = hasChange ? changedNajia[index] : null;
    const yaoText = benGuaText?.yao?.[index] || null;

    return {
      position,
      /** 该爻的《周易》爻辞（爻题 + 辞）。取不到时为 null。 */
      yaoText: yaoText && !/^用/.test(yaoText.title) ? { ...yaoText } : null,
      yin: lines[index] === 0,
      yang: lines[index] === 1,
      stem: yao.stem,
      branch: yao.branch,
      ganzhi: `${yao.stem}${yao.branch}`,
      element,
      relative: getSixRelative(palaceInfo.palaceElement, element),
      sixGod: sixGods[index] || null,
      isShi: position === palaceInfo.shiYao,
      isYing: position === palaceInfo.yingYao,
      isChanging,
      influence: analyzeExternalInfluence(yao.branch, {
        monthBranch,
        dayBranch,
        xunkongBranches,
      }),
      changedTo:
        isChanging && changedYao
          ? {
              stem: changedYao.stem,
              branch: changedYao.branch,
              element: BRANCHES_MAP[changedYao.branch]?.element || null,
              // 之爻六亲依旧以本卦之宫论
              relative: getSixRelative(
                palaceInfo.palaceElement,
                BRANCHES_MAP[changedYao.branch]?.element
              ),
              /** 进神 / 退神 / 爻伏吟 / 爻反吟。四者都是本支与变支的客观关系。 */
              shift: classifyChange(yao.branch, changedYao.branch),
            }
          : null,
    };
  });

  // ---- 爻与爻之间 ------------------------------------------------------
  // 月建日辰是外力，这里是**盘内**的力：动爻生克他爻是断卦的核心，
  // 只算外力等于只算了一半。静爻之间不相互作用，故生克一律自动爻发出。
  const interactions = [];
  yaos.forEach((source) => {
    if (!source.isChanging) return;
    yaos.forEach((target) => {
      if (target.position === source.position) return;
      const relation = getElementRelation(source.element, target.element);
      if (relation !== 'Generates' && relation !== 'Controls') return;
      interactions.push({
        from: source.position,
        to: target.position,
        fromBranch: source.branch,
        toBranch: target.branch,
        relation,
        cn: relation === 'Generates' ? '动爻生' : '动爻克',
      });
    });
  });

  // 爻支之间的六冲六合。与动静无关，静爻之间同样成立（日辰引动时用得上）。
  const pairRelations = [];
  for (let i = 0; i < yaos.length; i += 1) {
    for (let j = i + 1; j < yaos.length; j += 1) {
      const a = yaos[i];
      const b = yaos[j];
      if (isClash(a.branch, b.branch)) {
        pairRelations.push({ kind: 'clash', cn: '爻冲', positions: [a.position, b.position] });
      } else if (isCombine(a.branch, b.branch)) {
        pairRelations.push({ kind: 'combine', cn: '爻合', positions: [a.position, b.position] });
      }
    }
  }

  const hexagramName = name?.cn || null;
  const changedName = hasChange ? getHexagramName(changedLines)?.cn || null : null;

  return withSchool('liuyao', {
    lines: [...lines],
    name,
    palace: palaceInfo,
    yaos,
    /** 卦一级的冲合属性。之卦同判 —— 六冲变六合与六合变六冲断法迥异。 */
    hexagramType: {
      isSixClash: !!hexagramName && SIX_CLASH_HEXAGRAMS.has(hexagramName),
      isSixCombine: !!hexagramName && SIX_COMBINE_HEXAGRAMS.has(hexagramName),
      changed: changedName
        ? {
            isSixClash: SIX_CLASH_HEXAGRAMS.has(changedName),
            isSixCombine: SIX_COMBINE_HEXAGRAMS.has(changedName),
          }
        : null,
    },
    /** 内外卦的伏吟返吟。无动爻时恒为 null。 */
    trigramShift: hasChange
      ? {
          inner: classifyTrigramShift(najia, changedNajia, 0, changing),
          outer: classifyTrigramShift(najia, changedNajia, 3, changing),
        }
      : null,
    /** 动爻对他爻的生克。 */
    interactions,
    /** 六爻之间的冲与合，不分动静。 */
    pairRelations,
    shiYao: palaceInfo.shiYao,
    yingYao: palaceInfo.yingYao,
    hiddenSpirits: findHiddenSpirits(lines, palaceInfo),
    xunkong,
    dayGanzhi,
    monthBranch,
    changedHexagram: hasChange
      ? {
          lines: changedLines,
          name: getHexagramName(changedLines),
          palace: getPalaceInfo(changedLines),
        }
      : null,
  });
};
