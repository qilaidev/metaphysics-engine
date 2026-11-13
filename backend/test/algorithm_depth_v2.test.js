/**
 * 第二批算法深度：从格与专旺、旺相休囚死、紫微宫干四化、塔罗 seed。
 *
 * 与第一批（algorithm_depth.test.js）同一个理由：**这些错了都不会报错**。
 * 从格判反只是给出一句方向相反的用神建议，旺相档写反只是多一个看着合理的字，
 * 飞化落错宫只是让某一宫多一条断语 —— 全都不抛异常、不改变盘的形状。
 *
 * 所以断言尽量钉在能独立核对的东西上：
 * - 旺相休囚死钉在「春木旺火相水休金囚土死」这四句口诀的全部 25 组上；
 * - 宫干四化钉在守恒（十二宫各四化＝自化＋飞化＋未上盘）与丙干四化名单上；
 * - seed 钉在一个**写死的牌面**上 —— 换了 PRNG 就会红，这正是要的。
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  determineSpecialPattern,
  determineStrength,
  determineUsefulGod,
} from '../services/bazi.service.js';
import { performCalculation } from '../services/calculations.service.js';
import { getSeasonalState } from '../services/ganzhi.service.js';
import { buildLiuyaoChart } from '../services/liuyao.service.js';
import { castQimenChart } from '../services/qimen.service.js';
import { calculateZiweiChart } from '../services/ziwei.service.js';
import { createSeededRng, drawTarot } from '../services/tarot.service.js';
import { ZIWEI_SIHUA_BY_STEM } from '../constants/ziwei.js';

const chartOf = (y, m, d, h, gender = 'male') =>
  performCalculation({ birthYear: y, birthMonth: m, birthDay: d, birthHour: h, gender });

const pillarsOf = (year, month, day, hour) => ({
  year: { charStem: year[0], charBranch: year[1] },
  month: { charStem: month[0], charBranch: month[1] },
  day: { charStem: day[0], charBranch: day[1] },
  hour: { charStem: hour[0], charBranch: hour[1] },
});

// ------------------------------------------------------------ 八字：从格与专旺

describe('从格与专旺格', () => {
  /**
   * 戊午 己未 癸未 甲寅：日主癸水，未月土旺当令。
   * 四支午未未寅 —— 午藏丁己、未藏己丁乙、寅藏甲丙戊，**没有一个水或金**，
   * 即癸水全无通根。天干戊己土（官杀）当权，此为标准的从杀格。
   * 这一条是整个特殊格局层的理由：不判从格时它会被断成「身弱宜以印比生扶」，
   * 而癸水根本无根可扶，方向是反的。
   */
  it('癸水无根、土旺当权 → 从杀格，且用神与扶抑法相反', () => {
    const chart = chartOf(1978, 7, 20, 4);
    const ganzhi = ['year', 'month', 'day', 'hour']
      .map((p) => `${chart.pillars[p].charStem}${chart.pillars[p].charBranch}`)
      .join(' ');
    assert.equal(ganzhi, '戊午 己未 癸未 甲寅', '基准盘的四柱变了，下面的断言就没有意义了');

    const special = chart.analysis.specialPattern;
    assert.equal(special.facts.rootless, true, '四支应全无同党通根');
    assert.equal(special.suggested.key, 'congSha');
    assert.equal(special.suggested.cn, '从杀格');
    assert.equal(special.suggested.followElement, 'Earth', '所从者为土（官杀）');

    // 从格喜克泄耗、忌印比 —— 与「身弱宜生扶」恰好相反
    const useful = chart.analysis.usefulGod;
    assert.equal(useful.method, 'follow');
    assert.ok(useful.favorable.includes('Earth'), '从杀格应以官杀为喜');
    assert.ok(!useful.favorable.includes('Water'), '从格不得以比劫为喜');
    assert.ok(!useful.favorable.includes('Metal'), '从格不得以印为喜');
    assert.deepEqual(useful.unfavorable.sort(), ['Metal', 'Water'], '印比为忌');

    // 同一张盘若退回纯扶抑（不传 specialPattern），给出的正是相反的那一组
    const fallback = determineUsefulGod(chart.analysis.strength);
    assert.equal(fallback.method, 'support');
    assert.ok(fallback.favorable.includes('Water'), '扶抑法在这张盘上会建议生扶 —— 那正是要绕开的');
  });

  /**
   * 戊戌 辛酉 辛酉 己亥：日主辛金，酉月得令，戊己戌土生金。
   * 金土满盘、无火克无木耗，为从革格（金之专旺）。
   * 不判专旺时它会被断成「身强宜以官杀食伤财耗其气」—— 一行得气宜顺不宜逆，也是反的。
   */
  it('辛金得令、金土满盘 → 从革格（专旺），宜顺不宜逆', () => {
    const chart = chartOf(2018, 9, 26, 22);
    const special = chart.analysis.specialPattern;
    assert.equal(special.facts.commanded, true, '月令本气应即日主五行');
    assert.equal(special.suggested.key, 'congge');
    assert.equal(special.suggested.cn, '从革格');

    const useful = chart.analysis.usefulGod;
    assert.equal(useful.method, 'dominant');
    assert.ok(useful.favorable.includes('Metal'), '比劫扶其势');
    assert.ok(useful.favorable.includes('Earth'), '印生其势');
    assert.ok(useful.favorable.includes('Water'), '食伤泄其秀');
    assert.deepEqual(useful.unfavorable.sort(), ['Fire', 'Wood'], '官杀逆其势、财破其印，皆忌');
  });

  it('五种专旺格各有其名，按日主五行取', () => {
    const chart = chartOf(1947, 3, 26, 22); // 丁亥 癸卯 甲辰 乙亥，甲木卯月
    assert.equal(chart.analysis.specialPattern.suggested.cn, '曲直格');
    assert.equal(chart.analysis.specialPattern.suggested.followElement, 'Wood');
  });

  /**
   * 无根是**硬条件**，但只有无根还不够。
   * 乙未 癸未 壬午 壬寅：壬水同样四支无根，可天干透着癸壬两个比劫 ——
   * 有比劫可依就不是弃命相从，是身弱用印比。这条边界不设，「假从」会被当成真从。
   */
  it('四支无根但天干透比劫 → 不成从格，退回扶抑', () => {
    const chart = chartOf(1955, 7, 20, 4);
    const special = chart.analysis.specialPattern;
    assert.equal(special.facts.rootless, true, '这张盘确实四支无根');
    assert.ok(
      special.facts.allyRatio >= special.facts.thresholds.followWeakBelow,
      '天干透了比劫，占比应已越过从格阈值'
    );
    assert.equal(special.suggested, null, '越过阈值就不该判从格');
    assert.equal(chart.analysis.usefulGod.method, 'support', '退回扶抑法');
  });

  it('有一点根就不是从格 —— 哪怕只是余气根', () => {
    // 癸水日主，时支子为癸之本气根；其余同上面那张从杀格的构造
    const pillars = pillarsOf('戊午', '己未', '癸未', '壬子');
    const strength = determineStrength(pillars, '癸');
    const special = determineSpecialPattern(strength, pillars);
    assert.equal(special.facts.rootless, false);
    assert.equal(special.suggested, null);
  });

  it('绝大多数盘两格都不成立，此时 suggested 为 null 而 facts 照给', () => {
    const chart = chartOf(1990, 5, 20, 14);
    const special = chart.analysis.specialPattern;
    assert.equal(special.suggested, null);
    // facts 是无分歧的结构事实，换派要自行重推就靠它
    assert.equal(typeof special.facts.allyRatio, 'number');
    assert.equal(special.facts.ranked.length, 3, '非同党恰好三组五行');
    assert.ok(
      special.facts.ranked[0].score >= special.facts.ranked[1].score,
      'ranked 必须按力量降序 —— 从格所从的就是第一位'
    );
    assert.equal(chart.analysis.usefulGod.method, 'support');
  });

  it('不传 specialPattern 时 determineUsefulGod 行为不变（老调用方兼容）', () => {
    const chart = chartOf(1978, 7, 20, 4);
    const withoutArg = determineUsefulGod(chart.analysis.strength);
    const withNull = determineUsefulGod(chart.analysis.strength, null);
    assert.deepEqual(withoutArg, withNull);
    assert.equal(withoutArg.method, 'support', '纯扶抑仍按 level 走');
  });
});

// -------------------------------------------------------------- 旺相休囚死

describe('旺相休囚死', () => {
  /**
   * 四句口诀逐字展开，25 组全查。
   * 这张表唯一容易记反的是「休」与「囚」—— 两者都是与月令相克，差别只在方向。
   */
  const MNEMONIC = {
    Wood: { Wood: '旺', Fire: '相', Water: '休', Metal: '囚', Earth: '死' },
    Fire: { Fire: '旺', Earth: '相', Wood: '休', Water: '囚', Metal: '死' },
    Earth: { Earth: '旺', Metal: '相', Fire: '休', Wood: '囚', Water: '死' },
    Metal: { Metal: '旺', Water: '相', Earth: '休', Fire: '囚', Wood: '死' },
    Water: { Water: '旺', Wood: '相', Metal: '休', Earth: '囚', Fire: '死' },
  };

  it('五个月令 × 五个五行共 25 组与口诀逐组相符', () => {
    Object.entries(MNEMONIC).forEach(([monthElement, row]) => {
      Object.entries(row).forEach(([target, expected]) => {
        assert.equal(
          getSeasonalState(monthElement, target)?.cn,
          expected,
          `${monthElement} 月令下 ${target} 应为「${expected}」`
        );
      });
    });
  });

  it('认不出的五行返回 null，不猜一个档出来', () => {
    assert.equal(getSeasonalState('Wood', 'Plasma'), null);
    assert.equal(getSeasonalState(null, 'Fire'), null);
    assert.equal(getSeasonalState(undefined, undefined), null);
  });

  it('六爻：爻的旺衰按月建判，寅月卯木旺、申金囚', () => {
    const chart = buildLiuyaoChart([1, 0, 1, 0, 1, 0], {
      changingLines: [3],
      dayGanzhi: '甲子',
      monthBranch: '寅',
    });
    const byBranch = Object.fromEntries(
      chart.yaos.map((yao) => [yao.branch, yao.influence.seasonalState?.cn])
    );
    assert.equal(byBranch['卯'], '旺');
    assert.equal(byBranch['申'], '囚');
    assert.equal(byBranch['亥'], '休');
    assert.equal(byBranch['丑'], '死');
  });

  it('六爻：不给月建时旺衰为 null，不拿日辰凑一个', () => {
    const chart = buildLiuyaoChart([1, 0, 1, 0, 1, 0], {
      changingLines: [3],
      dayGanzhi: '甲子',
    });
    chart.yaos.forEach((yao) => assert.equal(yao.influence.seasonalState, null));
    // 日辰该给的生克关系照给 —— 缺的只是旺衰这一档
    assert.ok(chart.yaos[0].influence.dayRelation);
  });

  it('奇门：门星旺相按节气月支判，酉月金旺木死', () => {
    const chart = castQimenChart({ year: 2024, month: 10, day: 1, hour: 10 });
    assert.equal(chart.monthCommand.branch, '酉', '2024-10-01 应在酉月');
    assert.equal(chart.monthCommand.element, 'Metal');

    chart.palaces.forEach((palace) => {
      if (palace.star) {
        assert.equal(
          palace.relations.starSeasonalState.cn,
          MNEMONIC.Metal[palace.star.element],
          `${palace.star.cn || palace.star.name} 的旺衰与口诀不符`
        );
      }
      if (palace.gate) {
        assert.equal(palace.relations.gateSeasonalState.cn, MNEMONIC.Metal[palace.gate.element]);
      }
      // 中五宫无门，那一格恒为 null
      if (palace.index === 5) assert.equal(palace.relations.gateSeasonalState, null);
    });
  });
});

// ---------------------------------------------------------- 紫微：宫干四化

describe('紫微宫干四化（自化与飞化）', () => {
  const chart = calculateZiweiChart({
    birthYear: 1990,
    birthMonth: 5,
    birthDay: 20,
    birthHour: 14,
    gender: 'male',
  });

  /**
   * 守恒：十二宫各以本宫干起四化，共 48 条。每一条要么落本宫（自化）、
   * 要么落他宫（飞化）、要么那颗星没上盘。三者之和必须恰好是 48 ——
   * 少了说明有条化被丢了，多了说明有条被算了两遍。
   */
  it('十二宫共发出 48 条化，自化＋飞化＋未上盘恰好守恒', () => {
    const sent = chart.palaces.flatMap((p) => p.palaceTransformations || []);
    const self = chart.palaces.flatMap((p) => p.selfTransformations || []);
    const incoming = chart.palaces.flatMap((p) => p.incomingTransformations || []);
    const unplaced = sent.filter((t) => t.toPalaceIndex === null);

    assert.equal(sent.length, 48, '十二宫 × 四化');
    assert.equal(self.length + incoming.length + unplaced.length, 48);
  });

  it('自化的定义就是落回本宫，飞化一定落在别的宫', () => {
    chart.palaces.forEach((palace) => {
      (palace.selfTransformations || []).forEach((t) => {
        assert.equal(t.toPalaceIndex, palace.index);
        assert.equal(t.isSelf, true);
      });
      (palace.incomingTransformations || []).forEach((t) => {
        assert.equal(t.toPalaceIndex, palace.index, '飞化必须记在落点那一宫');
        assert.notEqual(t.fromPalaceIndex, palace.index, '落回本宫的是自化，不该出现在这里');
      });
    });
  });

  it('宫干四化用的是宫干，不是年干 —— 丙宫必出丙干那一组', () => {
    const bing = chart.palaces.find((p) => p.stem === '丙');
    assert.ok(bing, '这张盘应当有丙干之宫');
    const byType = Object.fromEntries(bing.palaceTransformations.map((t) => [t.type, t.starKey]));
    assert.deepEqual(byType, ZIWEI_SIHUA_BY_STEM['丙'], '丙干四化名单应与常量表逐项一致');
  });

  it('每一条飞化都能在落点宫找到那颗星', () => {
    chart.palaces.forEach((palace) => {
      (palace.palaceTransformations || []).forEach((t) => {
        if (t.toPalaceIndex === null) return;
        const target = chart.palaces[t.toPalaceIndex];
        const present = ['major', 'minor', 'malefic'].some((group) =>
          target.stars[group].some((star) => star.key === t.starKey)
        );
        assert.ok(present, `${t.starKey} 记为落在宫 ${t.toPalaceIndex}，但那一宫没有这颗星`);
      });
    });
  });

  it('大限四化取该大限所在宫的宫干，与本命四化（年干）分属两层', () => {
    chart.majorPeriods.forEach((period) => {
      const palace = chart.palaces[period.palaceIndex];
      assert.equal(period.stem, palace.stem);
      assert.deepEqual(period.transformations, palace.palaceTransformations);
    });
    // 本命四化仍取年干，两者不是同一组
    const yearStem = chart.lunar.yearStem;
    const byType = Object.fromEntries(chart.fourTransformations.map((t) => [t.type, t.starKey]));
    assert.deepEqual(byType, ZIWEI_SIHUA_BY_STEM[yearStem]);
  });
});

// ------------------------------------------------------------ 塔罗：可复现

describe('塔罗 seed', () => {
  it('同一 seed 配同一牌阵必得同一副牌与同一组正逆', () => {
    const sig = (r) => r.cards.map((c) => `${c.name}${c.isReversed ? 'R' : 'U'}`).join('|');
    const a = drawTarot({ spreadType: 'ThreeCard', seed: 'hello' });
    const b = drawTarot({ spreadType: 'ThreeCard', seed: 'hello' });
    assert.equal(sig(a), sig(b));
    assert.equal(a.seed, 'hello');
    assert.equal(a.reproducible, true);
  });

  /**
   * 写死一个牌面。
   *
   * 这条断言的用处不是「这三张牌是对的」（哪三张都对），而是**锁住随机算法本身**：
   * 换了 PRNG、改了洗牌顺序、动了正逆的取数次序，这里立刻会红。
   * 「可复现」若能被一次无声的实现改动废掉，那它就不是可复现。
   */
  it('随机算法本身被钉死：换 PRNG 就会红', () => {
    const drawn = drawTarot({ spreadType: 'ThreeCard', seed: 'hello' });
    assert.deepEqual(
      drawn.cards.map((c) => c.name),
      ['Eight of Wands', 'Page of Pentacles', 'Page of Cups']
    );
    assert.deepEqual(
      drawn.cards.map((c) => c.isReversed),
      [false, false, false]
    );
  });

  it('数字与同值字符串同解 —— 调用方不必操心 JSON 里传的是哪一种', () => {
    const sig = (r) => r.cards.map((c) => c.name).join('|');
    assert.equal(
      sig(drawTarot({ spreadType: 'ThreeCard', seed: 42 })),
      sig(drawTarot({ spreadType: 'ThreeCard', seed: '42' }))
    );
  });

  it('不同 seed 给出不同牌', () => {
    const sig = (r) => r.cards.map((c) => c.name).join('|');
    assert.notEqual(
      sig(drawTarot({ spreadType: 'ThreeCard', seed: 'hello' })),
      sig(drawTarot({ spreadType: 'ThreeCard', seed: 'world' }))
    );
  });

  it('不给 seed 时明说不可复现', () => {
    const drawn = drawTarot({ spreadType: 'ThreeCard' });
    assert.equal(drawn.seed, null);
    assert.equal(drawn.reproducible, false);
  });

  it('空 seed 等同于没给，不会哈希出一条「空串」的固定牌流', () => {
    ['', null, undefined].forEach((seed) => {
      assert.equal(createSeededRng(seed), null);
      assert.equal(drawTarot({ spreadType: 'SingleCard', seed }).reproducible, false);
    });
  });

  it('显式注入的 rng 优先于 seed（既有测试依赖这条路径）', () => {
    const drawn = drawTarot({ spreadType: 'SingleCard', seed: 'hello', rng: () => 0 });
    assert.equal(drawn.cards.length, 1);
    assert.equal(drawn.seed, null, '走注入 rng 时不该声称自己可复现');
    assert.equal(drawn.reproducible, false);
  });

  it('seeded 随机流分布均匀，逆位不会系统性偏多或偏少', () => {
    const rng = createSeededRng('distribution');
    let sum = 0;
    for (let i = 0; i < 20000; i += 1) sum += rng();
    const mean = sum / 20000;
    assert.ok(mean > 0.48 && mean < 0.52, `均值 ${mean} 偏离 0.5 过多`);

    let reversed = 0;
    let total = 0;
    for (let i = 0; i < 500; i += 1) {
      drawTarot({ spreadType: 'ThreeCard', seed: `s${i}` }).cards.forEach((card) => {
        total += 1;
        if (card.isReversed) reversed += 1;
      });
    }
    const rate = reversed / total;
    assert.ok(rate > 0.44 && rate < 0.56, `逆位率 ${rate} 偏离 0.5 过多`);
  });
});
