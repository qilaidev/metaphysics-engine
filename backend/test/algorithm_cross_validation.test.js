/**
 * 外部交叉验证：把本仓库的排盘结果钉在**独立实现**的输出上。
 *
 * 与 algorithm_external_examples.test.js 的区别：那边是公开例课（个位数），这边是拿第三方
 * 库大样本逐盘比对后抽出的固定用例，期望值来自第三方库，不从本仓库读出。样本分布与比对
 * 记录见 fixtures/cross_validation.json 的 provenance。三方库与本仓库不一致的地方按古法
 * 逐条手核，手核结论以「六壬手核」一组为准 —— 它们是第三方库出错、本仓库正确的课。
 *
 * 这些用例挡的是「大面积静默错」：宫序反了、四化表错一格、值使飞错宫、涉害数错方向 ——
 * 这类错误在几百盘随机样本里必然露头，但在自洽式测试里永远不会。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { calculateZiweiChart } from '../services/ziwei.service.js';
import { castLiurenChart } from '../services/liuren.service.js';
import { castQimenChart } from '../services/qimen.service.js';
import { calculateRisingSign } from '../services/zodiac.service.js';
import { drawTarot } from '../services/tarot.service.js';
import tarotDeck from '../data/tarotData.js';

const fixture = JSON.parse(
  fs.readFileSync(new URL('./fixtures/cross_validation.json', import.meta.url), 'utf8')
);

// ------------------------------------------------------------------ 紫微 vs iztro

const PALACE_CN = {
  ming: '命宫',
  brothers: '兄弟',
  spouse: '夫妻',
  children: '子女',
  wealth: '财帛',
  health: '疾厄',
  travel: '迁移',
  friends: '仆役',
  career: '官禄',
  property: '田宅',
  mental: '福德',
  parents: '父母',
};
const MUTAGEN_CN = { lu: '禄', quan: '权', ke: '科', ji: '忌' };

describe('紫微 vs iztro：命身宫、五行局、宫名宫干、主星辅星煞星落宫、四化、大限', () => {
  for (const c of fixture.ziwei) {
    it(`${c.birth} ${c.gender}：命宫${c.ming} 身宫${c.shen} ${c.bureau}`, () => {
      const [date, time] = c.birth.split('T');
      const [y, m, d] = date.split('-').map(Number);
      const chart = calculateZiweiChart({
        birthYear: y,
        birthMonth: m,
        birthDay: d,
        birthHour: Number(time.split(':')[0]),
        gender: c.gender,
      });
      assert.equal(chart.mingPalace.branch.key, c.ming, '命宫');
      assert.equal(chart.shenPalace.branch.key, c.shen, '身宫');
      assert.equal(chart.fiveElementBureau.cn, c.bureau, '五行局');
      for (const palace of chart.palaces) {
        const branch = palace.branch.key;
        const expected = c.palaces[branch];
        assert.equal(PALACE_CN[palace.palace.key], expected.name, `${branch}宫名`);
        assert.equal(palace.stem, expected.stem, `${branch}宫干`);
        const ours = [];
        for (const group of ['major', 'minor', 'malefic']) {
          for (const star of palace.stars[group]) {
            const mutagen = (star.transforms || []).map((t) => MUTAGEN_CN[t]).join('');
            ours.push(star.cn + (mutagen ? `(${mutagen})` : ''));
          }
        }
        assert.deepEqual(
          ours.sort(),
          [...expected.major, ...expected.minor].sort(),
          `${branch}宫星曜与四化`
        );
        const period = chart.majorPeriods.find((p) => p.branch === branch);
        assert.deepEqual([period.startAge, period.endAge], expected.decadal, `${branch}宫大限`);
      }
    });
  }
});

// ---------------------------------------------------------------- 六壬 vs kinliuren

const GENERAL_TRAD = {
  guiren: '貴',
  tengshe: '蛇',
  zhuque: '雀',
  liuhe: '合',
  gouchen: '勾',
  qinglong: '龍',
  tiankong: '空',
  baihu: '虎',
  taichang: '常',
  xuanwu: '玄',
  taiyin: '陰',
  tianhou: '后',
};

describe('六壬 vs kinliuren：两实现一致的课，按课体分层钉住三传、天将、贵人', () => {
  for (const c of fixture.liuren) {
    it(`${c.day}日 ${c.hour}时 ${c.general}将 → ${c.courseType} ${c.tri.join('')}`, () => {
      const chart = castLiurenChart(c.input);
      const tt = chart.threeTransmissions;
      assert.equal(chart.dayGanzhi, c.day);
      assert.equal(chart.hourBranch, c.hour);
      assert.equal(chart.monthGeneral.branch, c.general, '月将');
      assert.equal(tt.courseType.key, c.courseType, '课体');
      assert.deepEqual([tt.initial.branch, tt.middle.branch, tt.last.branch], c.tri, '三传');
      assert.deepEqual(
        [tt.initial, tt.middle, tt.last].map((t) => GENERAL_TRAD[t.general.key]),
        c.triGenerals,
        '三传天将'
      );
      assert.equal(chart.twelveGenerals.nobleBranch, c.noble, '贵人所乘');
      assert.equal(chart.twelveGenerals.forward, c.forward, '天将顺逆');
    });
  }
});

/**
 * 300 课里 66 课三传与 kinliuren 不同。逐类按《六壬大全》《大六壬指南》通行规则手核，
 * 下面每条都写明推法；结论全部是本仓库正确。之所以钉住，是为了让这些课体的取传规则
 * 不会在日后「向第三方库对齐」时被改错。
 */
describe('六壬手核：与 kinliuren 分歧处按古法逐条复核', () => {
  const cases = [
    {
      input: { year: 1955, month: 9, day: 26, hour: 19 },
      day: '庚寅',
      cn: '返吟课',
      tri: ['寅', '申', '寅'],
      why: '辰将加戌时为返吟。一课寅/庚，庚金克寅木为下贼上，有克依贼克取寅；中传取冲申，末传复归寅。庚寅不在无依六日（丁丑己丑丁未己未戊辰戊戌）之列，kinliuren 报无依误',
    },
    {
      input: { year: 2009, month: 1, day: 18, hour: 11 },
      day: '癸亥',
      cn: '知一课',
      tri: ['卯', '戌', '巳'],
      why: '丑将加午时，四课 申/癸 卯/申 午/亥 丑/午。卯受申克、午受亥克两处下贼上，癸阴日取阴支卯为初传；中传卯上戌，末传戌上巳。kinliuren 取申，申与癸无克',
    },
    {
      input: { year: 1981, month: 7, day: 7, hour: 2 },
      day: '丙戌',
      cn: '返吟课',
      tri: ['巳', '亥', '巳'],
      why: '未将加丑时返吟。二课巳/亥，亥水克巳火为下贼上，初传巳，中末以冲往返。丙戌不在无依六日',
    },
    {
      input: { year: 1959, month: 11, day: 17, hour: 14 },
      day: '癸卯',
      cn: '涉害课',
      tri: ['未', '卯', '亥'],
      why: '卯将加未时，巳克酉、未克亥两处上克下皆阴，癸阴日比用不能决。巳临酉归家数所克得三（酉戌丑），未临亥归家数所克得四（亥子丑辰），未深取未',
    },
    {
      input: { year: 2024, month: 3, day: 14, hour: 9 },
      day: '丁丑',
      cn: '无亲课',
      tri: ['亥', '未', '丑'],
      why: '亥将加巳时返吟，丁丑为无依日：四课丑/未 未/丑无克，取驿马亥为初传，支上神未为中传，干上神丑为末传。kinliuren 报别责误（别责要三课不备且无返吟）',
    },
    {
      input: { year: 1997, month: 1, day: 25, hour: 16 },
      day: '丁卯',
      cn: '涉害课',
      tri: ['亥', '卯', '未'],
      why: '子将加申时，未受卯克、亥受未克两处下贼上皆阴，丁阴日比用不能决。未临卯归家数受克得二，亥临未归家数受克得三（未申戌），亥深取亥',
    },
    {
      input: { year: 1954, month: 12, day: 9, hour: 3 },
      day: '己亥',
      cn: '自信课',
      tri: ['亥', '未', '丑'],
      why: '伏吟无克，己阴日自信：初传支上神亥；亥自刑，中传改取干上神未；末传取未之刑丑（丑戌未三刑：未刑丑）。kinliuren 末传取戌是把刑向反了',
    },
    {
      input: { year: 1957, month: 5, day: 10, hour: 18 },
      day: '壬午',
      cn: '自任课',
      tri: ['亥', '午', '子'],
      why: '伏吟无克，壬阳日自任：初传干上神亥；亥自刑，中传改取支上神午；午亦自刑，末传取午之冲子',
    },
    {
      input: { year: 2029, month: 10, day: 1, hour: 10 },
      day: '甲子',
      cn: '知一课',
      tri: ['子', '亥', '戌'],
      why: '辰将加巳时，丑受甲克、子受丑克两处下贼上；甲阳日取阳支子。中传子上亥，末传亥上戌（天盘逆退一位）',
    },
    {
      input: { year: 1961, month: 9, day: 5, hour: 3 },
      day: '辛丑',
      cn: '别责课',
      tri: ['巳', '丑', '丑'],
      why: '巳将加寅时，四课丑/戌 辰/丑 辰/丑 未/辰无克、无遥克，二三课重复为三课不备。辛阴日取支三合前一位（丑合巳酉，取巳）为初传，中末皆干上神丑。kinliuren 报返吟误（巳寅不冲）',
    },
    {
      input: { year: 1988, month: 10, day: 19, hour: 12 },
      day: '丁未',
      cn: '八专课',
      tri: ['丑', '巳', '巳'],
      why: '丁未为八专日（丁寄未，与日支同位），四课只余两课且无克。八专排在遥克之前：丁阴日自第四课上神卯逆数三位（卯寅丑）得丑为初传，中末皆干上神巳。kinliuren 先取遥克蒿矢误',
    },
    {
      input: { year: 2012, month: 10, day: 26, hour: 8 },
      day: '庚申',
      cn: '八专课',
      tri: ['酉', '未', '未'],
      why: '庚申为八专日，庚阳日自干上神未顺数三位得酉为初传，中末皆干上神未。kinliuren 逆数取巳误',
    },
  ];
  for (const c of cases) {
    it(`${c.day}日：${c.cn} ${c.tri.join('')}`, () => {
      const chart = castLiurenChart(c.input);
      assert.equal(chart.dayGanzhi, c.day);
      const tt = chart.threeTransmissions;
      assert.equal(tt.courseType.cn, c.cn, c.why);
      assert.deepEqual([tt.initial.branch, tt.middle.branch, tt.last.branch], c.tri, c.why);
    });
  }
});

// ------------------------------------------------------------------ 奇门 vs kinqimen

describe('奇门 vs kinqimen 拆补法：阴阳十八局各取两盘，钉定局、值符值使、地盘天盘、八门九星', () => {
  for (const c of fixture.qimen) {
    it(`${c.dayGanzhi}日 ${c.hourGanzhi}时 ${c.dun}遁${c.ju}局${c.yuan}`, () => {
      const chart = castQimenChart(c.input);
      assert.equal(chart.dayGanzhi, c.dayGanzhi);
      assert.equal(chart.hourGanzhi, c.hourGanzhi);
      assert.equal(chart.ju.yang, c.dun === '陽', '阴阳遁');
      assert.equal(chart.ju.ju, c.ju, '局数');
      assert.equal(chart.ju.yuanCn, c.yuan, '三元');
      assert.equal(chart.zhifu.star.cn, c.zhifu[0], '值符星');
      assert.equal(chart.zhifu.landedPalace, c.zhifu[1], '值符落宫');
      assert.equal(chart.zhishi.gate.cn, c.zhishi[0], '值使门');
      assert.equal(chart.zhishi.palace, c.zhishi[1], '值使落宫');
      for (const palace of chart.palaces) {
        const key = String(palace.index);
        assert.equal(palace.earthStem, c.earth[key], `${palace.cn}地盘`);
        if (palace.index === 5) continue;
        assert.equal(palace.heavenStem, c.heaven[key], `${palace.cn}天盘`);
        assert.equal(palace.gate.cn, c.gate[key], `${palace.cn}八门`);
        // kinqimen 把禽芮同宫只显示天禽；本仓库主星天芮、lodgedStar 天禽
        const stars = [palace.star.cn, palace.lodgedStar?.cn].filter(Boolean);
        assert.ok(stars.includes(c.star[key]), `${palace.cn}九星 ours=${stars} ref=${c.star[key]}`);
      }
    });
  }
});

/**
 * 200 张随机盘里与 kinqimen 不一致的只有两张，都是**时干落中五宫**：时干寄坤二，而旬首遁仪
 * 恰在坤二，值符加临自己，天盘不转（伏吟）。kinqimen 把值符标在「中」却又把天盘转了一格，
 * 前后矛盾。通行口径（《奇门遁甲秘笈大全》「中五寄坤」）与本仓库一致。
 */
describe('奇门：时干落中五宫寄坤二，遁仪在坤二则值符加临自己、天盘伏吟', () => {
  const cases = [
    { input: { year: 1967, month: 11, day: 28, hour: 20, minute: 0 }, ju: 5, hourGanzhi: '戊戌' },
    { input: { year: 1988, month: 11, day: 8, hour: 18, minute: 56 }, ju: 6, hourGanzhi: '己酉' },
  ];
  for (const c of cases) {
    it(`阴遁${c.ju}局 ${c.hourGanzhi}时：时干在中五，值符天芮落坤二，天盘与地盘全同`, () => {
      const chart = castQimenChart(c.input);
      assert.equal(chart.hourGanzhi, c.hourGanzhi);
      assert.equal(chart.ju.yang, false);
      assert.equal(chart.ju.ju, c.ju);
      assert.equal(chart.palaces.find((p) => p.index === 5).earthStem, c.hourGanzhi[0]);
      assert.equal(chart.zhifu.star.cn, '天芮');
      assert.equal(chart.zhifu.landedPalace, 2);
      for (const palace of chart.palaces) {
        assert.equal(palace.heavenStem, palace.earthStem, `${palace.cn}应伏吟`);
      }
    });
  }
});

// ------------------------------------------------------- 上升星座 vs astronomy-engine

/**
 * 参考值：astronomy-engine 2.1.19 的视恒星时（GAST）+ 真黄赤交角（含章动）代入标准上升点公式。
 * 本仓库用简化 GMST 与平黄赤交角，差异应只在秒级 / 百分之一度级。
 */
describe('上升星座 vs astronomy-engine：十点地面站、跨世纪、南北半球、高纬', () => {
  const cases = [
    [2000, 1, 1, 0, 0, 0, 0, 0, 190.84, 6.664],
    [1990, 1, 1, 6, 30, 40.7128, -74.006, -300, 267.68, 13.29],
    [1985, 7, 15, 14, 45, 39.9042, 116.4074, 480, 228.15, 10.048],
    [2024, 3, 20, 3, 6, -33.8688, 151.2093, 660, 310.29, 14.027],
    [1970, 11, 5, 21, 10, 51.5074, -0.1278, 0, 118.08, 0.137],
    [2010, 6, 21, 12, 0, 64.1466, -21.9426, 0, 167.16, 4.509],
    [1999, 12, 31, 23, 59, 35.6762, 139.6503, 540, 191.62, 6.933],
    [2030, 2, 14, 9, 20, -22.9068, -43.1729, -180, 15.07, 19.093],
    [1960, 4, 1, 4, 44, 55.7558, 37.6173, 180, 315.15, 16.869],
    [2005, 9, 9, 18, 18, 19.4326, -99.1332, -300, 321.98, 15.964],
  ];
  for (const [y, m, d, hh, mm, lat, lon, tz, asc, lst] of cases) {
    it(`${y}-${m}-${d} ${hh}:${mm} (${lat}, ${lon}) → ${asc}°`, () => {
      const result = calculateRisingSign({
        birthYear: y,
        birthMonth: m,
        birthDay: d,
        birthHour: hh,
        birthMinute: mm,
        latitude: lat,
        longitude: lon,
        timezoneOffsetMinutes: tz,
      });
      const dAsc = Math.abs(((result.ascendant.longitude - asc + 540) % 360) - 180);
      assert.ok(dAsc <= 0.05, `上升点黄经 ours=${result.ascendant.longitude} ref=${asc}`);
      const dLst = Math.abs(result.ascendant.localSiderealTime - lst);
      assert.ok(dLst <= 0.012, `地方恒星时 ours=${result.ascendant.localSiderealTime} ref=${lst}`);
    });
  }
});

// ------------------------------------------------------------------ 塔罗：牌库与 PRNG

describe('塔罗：78 张逐张核对', () => {
  it('id 0..77 连续唯一，牌名唯一', () => {
    assert.equal(tarotDeck.length, 78);
    assert.deepEqual(
      tarotDeck.map((c) => c.id),
      Array.from({ length: 78 }, (_, i) => i)
    );
    assert.equal(new Set(tarotDeck.map((c) => c.name)).size, 78);
    assert.equal(new Set(tarotDeck.map((c) => c.nameCN)).size, 78);
  });

  it('大阿卡纳 22 张序号 0..21；小阿卡纳 56 张 = 四花色 × 十四序位', () => {
    const majors = tarotDeck.filter((c) => c.arcana === 'Major');
    const minors = tarotDeck.filter((c) => c.arcana === 'Minor');
    assert.equal(majors.length, 22);
    assert.equal(minors.length, 56);
    assert.deepEqual(
      majors.map((c) => c.number),
      Array.from({ length: 22 }, (_, i) => i)
    );
    const bySuit = new Map();
    for (const card of minors) {
      assert.ok(card.suit, `${card.name} 缺花色`);
      assert.ok(card.rank, `${card.name} 缺序位`);
      bySuit.set(card.suit, (bySuit.get(card.suit) || []).concat(card.rank));
    }
    assert.equal(bySuit.size, 4);
    for (const [suit, ranks] of bySuit) {
      assert.equal(ranks.length, 14, `${suit} 应 14 张`);
      assert.equal(new Set(ranks).size, 14, `${suit} 序位重复`);
    }
    assert.equal(minors.filter((c) => c.isCourt).length, 16, '宫廷牌 4 花色 × 4');
  });
});

describe('塔罗 seed PRNG 无偏性', () => {
  it('15600 个连续 seed 的首张牌卡方检验通过（78 格，自由度 77）', () => {
    const rounds = 200;
    const counts = new Array(78).fill(0);
    let reversed = 0;
    for (let seed = 0; seed < 78 * rounds; seed++) {
      const result = drawTarot({ spreadType: 'SingleCard', seed });
      counts[result.cards[0].id] += 1;
      if (result.cards[0].isReversed) reversed += 1;
    }
    const chi2 = counts.reduce((sum, n) => sum + (n - rounds) ** 2 / rounds, 0);
    // 自由度 77 的 χ² 在 p=0.001 处约 118.6；超过就说明分布明显偏斜
    assert.ok(chi2 < 118.6, `χ²=${chi2.toFixed(1)}，分布 ${JSON.stringify(counts)}`);
    assert.ok(
      counts.every((n) => n > 0),
      '有牌从未被抽到'
    );
    const rate = reversed / (78 * rounds);
    assert.ok(Math.abs(rate - 0.5) < 0.02, `逆位率 ${rate.toFixed(3)} 偏离 0.5`);
  });

  it('凯尔特十字十张互不重复，且各位置的牌分布不偏向牌库前段', () => {
    const rounds = 40;
    const firstHalfAtLast = { yes: 0, total: 0 };
    for (let seed = 1000; seed < 1000 + 78 * rounds; seed++) {
      const result = drawTarot({ spreadType: 'CelticCross', seed });
      const ids = result.cards.map((c) => c.id);
      assert.equal(new Set(ids).size, 10, `seed ${seed} 抽到重复牌`);
      firstHalfAtLast.total += 1;
      if (ids[9] < 39) firstHalfAtLast.yes += 1;
    }
    const share = firstHalfAtLast.yes / firstHalfAtLast.total;
    assert.ok(Math.abs(share - 0.5) < 0.03, `第十张来自前半牌库的比例 ${share.toFixed(3)}`);
  });
});
