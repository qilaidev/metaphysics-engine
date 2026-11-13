/**
 * 塔罗抽牌。
 *
 * 口径真源：constants/rulings.js 的 TAROT_RULINGS。
 * - 不给 seed 时随机、不可复现；给了 seed 则完全确定
 * - 默认逆位概率 0.5
 * - 牌阵名支持别名归一，响应回显真实牌阵名；未知阵回退单牌并标 fallback
 */

import tarotDeck from '../data/tarotData.js';
import { TAROT_RULINGS, withSchool } from '../constants/rulings.js';

/**
 * 牌阵与各位置的含义。
 *
 * `label` 是机器契约（枚举键，英文，不要改），`labelCn` / `meaningCn` 是给人看的中文 ——
 * 与本仓库其余各术数同一约定：界面元素给中文，牌义那类描述性内容保留英文原文。
 */
export const TAROT_SPREADS = {
  SingleCard: {
    count: 1,
    positions: [
      {
        label: 'Insight',
        labelCn: '指引',
        meaning: 'The core message to focus on right now.',
        meaningCn: '当下最该留意的一句话。',
      },
    ],
  },
  ThreeCard: {
    count: 3,
    positions: [
      {
        label: 'Past',
        labelCn: '过去',
        meaning: 'What led to this moment.',
        meaningCn: '把事情带到此刻的来路。',
      },
      {
        label: 'Present',
        labelCn: '现在',
        meaning: 'The current energy or situation.',
        meaningCn: '当下的处境与气氛。',
      },
      {
        label: 'Future',
        labelCn: '未来',
        meaning: 'Likely direction if the path continues.',
        meaningCn: '照此下去大致的走向。',
      },
    ],
  },
  CelticCross: {
    count: 10,
    positions: [
      {
        label: 'Present',
        labelCn: '现况',
        meaning: 'Your current situation or heart of the matter.',
        meaningCn: '事情的核心与当前处境。',
      },
      {
        label: 'Challenge',
        labelCn: '阻碍',
        meaning: 'The obstacle, tension, or crossing influence.',
        meaningCn: '横在中间的阻力或张力。',
      },
      {
        label: 'Past',
        labelCn: '过去',
        meaning: 'Recent past events or influences fading.',
        meaningCn: '正在退去的近因。',
      },
      {
        label: 'Future',
        labelCn: '近未来',
        meaning: 'Near-future direction or next steps.',
        meaningCn: '接下来的一步。',
      },
      {
        label: 'Above',
        labelCn: '显意识',
        meaning: 'Conscious goals, aspirations, or ideals.',
        meaningCn: '自己清楚知道的目标与期望。',
      },
      {
        label: 'Below',
        labelCn: '潜意识',
        meaning: 'Subconscious roots, foundations, or hidden motives.',
        meaningCn: '底下的根由与说不出口的动机。',
      },
      {
        label: 'Advice',
        labelCn: '建议',
        meaning: 'Guidance on how to respond or proceed.',
        meaningCn: '该怎么应对。',
      },
      {
        label: 'External',
        labelCn: '外在影响',
        meaning: 'Outside influences, people, or environment.',
        meaningCn: '环境与他人这一侧的力量。',
      },
      {
        label: 'Hopes/Fears',
        labelCn: '期待与恐惧',
        meaning: 'Inner desires, anxieties, or expectations.',
        meaningCn: '心里既盼着又怕着的那一件。',
      },
      {
        label: 'Outcome',
        labelCn: '结果',
        meaning: 'Likely outcome if current course continues.',
        meaningCn: '照此下去的落点。',
      },
    ],
  },
};

/** 别名 → 规范牌阵名。大小写/空格/连字符不敏感。 */
const SPREAD_ALIASES = {
  single: 'SingleCard',
  singlecard: 'SingleCard',
  one: 'SingleCard',
  1: 'SingleCard',
  three: 'ThreeCard',
  threecard: 'ThreeCard',
  threecards: 'ThreeCard',
  3: 'ThreeCard',
  celtic: 'CelticCross',
  celticcross: 'CelticCross',
  cross: 'CelticCross',
  10: 'CelticCross',
};

const normalizeAliasKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');

/**
 * 解析牌阵名：规范名优先，其次别名，再否则回退 SingleCard。
 * 返回结构让调用方/响应能区分「用户要的」和「实际用的」。
 */
export const resolveTarotSpread = (spreadType) => {
  const requested = spreadType == null || spreadType === '' ? null : String(spreadType);
  if (!requested) {
    return { key: 'SingleCard', requested: null, alias: false, fallback: false };
  }
  if (TAROT_SPREADS[requested]) {
    return { key: requested, requested, alias: false, fallback: false };
  }
  // 大小写不敏感的规范名
  const exactInsensitive = Object.keys(TAROT_SPREADS).find(
    (name) => name.toLowerCase() === requested.toLowerCase()
  );
  if (exactInsensitive) {
    return { key: exactInsensitive, requested, alias: true, fallback: false };
  }
  const alias = SPREAD_ALIASES[normalizeAliasKey(requested)];
  if (alias) {
    return { key: alias, requested, alias: true, fallback: false };
  }
  return { key: 'SingleCard', requested, alias: false, fallback: true };
};

export const getTarotSpreadConfig = (spreadType) => {
  const { key } = resolveTarotSpread(spreadType);
  return TAROT_SPREADS[key] || TAROT_SPREADS.SingleCard;
};

/**
 * seed → 确定性随机流。
 *
 * 抽牌本来恒不可复现，于是这条能力永远进不了回归基准，调用方也没法复演一次牌局。
 * 给了 seed 就走这里：同一 seed + 同一牌阵必得同一副牌与同一组正逆。
 *
 * **算法钉死在实现里，不借用任何随平台变化的东西** —— 「可复现」若只在一台机器上
 * 成立，那不叫可复现。FNV-1a 把 seed 哈希成 32 位整数，再喂 mulberry32：
 * 两者都是纯 32 位整数运算，Node 版本、CPU、字节序都影响不到结果。
 *
 * seed 收字符串或数字，数字会先转成字符串再哈希 —— 于是 `42` 与 `'42'` 同解，
 * 调用方从 JSON 里传过来是哪一种都不必操心。
 */
const hashSeed = (seed) => {
  const text = String(seed);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    // FNV 素数 16777619，用移位加法写以避免 32 位乘法溢出成浮点
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash >>> 0;
};

const mulberry32 = (state) => {
  let a = state >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** 由 seed 造一条确定性随机流；seed 为空则返回 null（调用方退回 Math.random）。 */
export const createSeededRng = (seed) => {
  if (seed === undefined || seed === null || seed === '') return null;
  return mulberry32(hashSeed(seed));
};

const shuffleDeck = (deck, rng) => {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const temp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = temp;
  }
  return shuffled;
};

/**
 * 逆位概率。
 *
 * 洗牌时每张牌的朝向是独立的，正逆应当等概率 —— 此前硬编的 0.3 没有出处，
 * 只会让逆位系统性偏少。要按自家牌阵习惯调（有些实践确实压低逆位率），
 * 传 reversalRate 覆盖，不要再改这个默认值。
 */
const DEFAULT_REVERSAL_RATE = TAROT_RULINGS.reversalRate.value;

export const drawTarot = ({
  spreadType = 'SingleCard',
  rng: injectedRng = null,
  seed = null,
  reversalRate = DEFAULT_REVERSAL_RATE,
} = {}) => {
  // 显式注入的 rng 优先（测试用），其次 seed，最后才是真随机
  const seededRng = injectedRng ? null : createSeededRng(seed);
  const rng = injectedRng || seededRng || Math.random;
  const seedUsed = seededRng ? String(seed) : null;
  const resolved = resolveTarotSpread(spreadType);
  const rate = Number.isFinite(reversalRate)
    ? Math.min(Math.max(reversalRate, 0), 1)
    : DEFAULT_REVERSAL_RATE;
  const spreadConfig = TAROT_SPREADS[resolved.key] || TAROT_SPREADS.SingleCard;
  const positions = spreadConfig.positions || [];

  const shuffled = shuffleDeck(tarotDeck, rng);

  const drawCount = spreadConfig.count || 1;
  const drawnCards = shuffled.slice(0, drawCount).map((card, index) => ({
    ...card,
    position: index + 1,
    positionLabel: positions[index]?.label || spreadConfig.labels?.[index] || null,
    positionLabelCn: positions[index]?.labelCn || null,
    positionMeaning: positions[index]?.meaning || null,
    positionMeaningCn: positions[index]?.meaningCn || null,
    isReversed: rng() < rate,
  }));

  return withSchool('tarot', {
    // 回显**实际**牌阵名，避免 alias 把 three 显示成 three 却只抽一张
    spreadType: resolved.key,
    spreadRequested: resolved.requested,
    spreadAlias: resolved.alias,
    spreadFallback: resolved.fallback,
    /**
     * 实际生效的 seed（未给 seed 时为 null）。
     * `reproducible` 是给调用方的一句明话：为 true 时同参数重放必得同一副牌，
     * 可以拿去做幂等重试与回归基准；为 false 时不可以。
     */
    seed: seedUsed,
    reproducible: seedUsed !== null,
    reversalRate: rate,
    cards: drawnCards,
    spreadMeta: {
      positions: positions.map((position, index) => ({
        position: index + 1,
        label: position.label,
        labelCn: position.labelCn || null,
        meaning: position.meaning,
        meaningCn: position.meaningCn || null,
      })),
    },
  });
};
