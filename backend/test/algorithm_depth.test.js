/**
 * 本轮补齐的算法深度：胎元命宫身宫、月令格局、调候、紫微三方四正与乙级星、
 * 奇门盘面关系量、六壬三传遁干天将、六爻爻间生克、八宅宅卦、择吉方位煞、易经卦变。
 *
 * 这些新增项有一个共同特点：**错了不会报错**，只会给出一张看着正常的盘。
 * 所以这里的断言尽量钉在能独立核对的经典例证上（乾变无妄为伏吟、坤变升为返吟、
 * 2024 三碧入中五黄在西），而不是钉在「函数返回了个非空值」上。
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Solar } from 'lunar-javascript';

import {
  buildKeyPoints,
  determineMonthlyStructure,
  determineTiaohou,
} from '../services/bazi.service.js';
import { performCalculation } from '../services/calculations.service.js';
import {
  buildAlmanac,
  buildBazhaiChart,
  buildHouseChart,
  buildNineStarChart,
  resolveSittingTrigram,
  resolveYearNineStar,
} from '../services/fengshui.service.js';
import { TIAOHOU } from '../constants/geju.js';
import { deriveHexagramVariants } from '../services/iching.service.js';
import { hexagramByLines } from '../data/ichingHexagrams.js';
import { buildLiuyaoChart } from '../services/liuyao.service.js';
import { castLiurenChart, getDunGan } from '../services/liuren.service.js';
import { castQimenChart } from '../services/qimen.service.js';
import { calculateZiweiChart } from '../services/ziwei.service.js';

const chartOf = (y, m, d, h, gender = 'male') =>
  performCalculation({ birthYear: y, birthMonth: m, birthDay: d, birthHour: h, gender });

// ---------------------------------------------------------------- 八字

describe('胎元 / 胎息 / 命宫 / 身宫', () => {
  /**
   * 这四项自己算而不直接透传 lunar-javascript，是为了让海外出生时年月柱与日时柱
   * 两个坐标系不串（见 buildKeyPoints 的注释）。既然自己算，就必须证明算得一样。
   */
  it('与 lunar-javascript 逐项一致', () => {
    const cases = [
      [1990, 5, 20, 14],
      [2024, 2, 4, 17],
      [1985, 11, 3, 23],
      [2001, 7, 15, 3],
      [1968, 1, 20, 8],
      [1999, 12, 31, 0],
      [2010, 6, 6, 11],
    ];
    for (const [y, m, d, h] of cases) {
      const ec = Solar.fromYmdHms(y, m, d, h, 0, 0).getLunar().getEightChar();
      ec.setSect(2);
      const pillars = {
        year: { charStem: ec.getYearGan(), charBranch: ec.getYearZhi() },
        month: { charStem: ec.getMonthGan(), charBranch: ec.getMonthZhi() },
        day: { charStem: ec.getDayGan(), charBranch: ec.getDayZhi() },
        hour: { charStem: ec.getTimeGan(), charBranch: ec.getTimeZhi() },
      };
      const kp = buildKeyPoints(pillars);
      const label = `${y}-${m}-${d} ${h}时`;
      assert.equal(kp.taiYuan.ganzhi, ec.getTaiYuan(), `${label} 胎元`);
      assert.equal(kp.taiXi.ganzhi, ec.getTaiXi(), `${label} 胎息`);
      assert.equal(kp.mingGong.ganzhi, ec.getMingGong(), `${label} 命宫`);
      assert.equal(kp.shenGong.ganzhi, ec.getShenGong(), `${label} 身宫`);
    }
  });

  it('胎元是月干进一、月支进三', () => {
    const kp = buildKeyPoints({
      year: { charStem: '庚', charBranch: '午' },
      month: { charStem: '辛', charBranch: '巳' },
      day: { charStem: '乙', charBranch: '酉' },
      hour: { charStem: '癸', charBranch: '未' },
    });
    assert.equal(kp.taiYuan.ganzhi, '壬申');
  });
});

describe('月令取格', () => {
  it('本气不透而中气余气透，以透者论格', () => {
    // 乙日主生巳月：巳藏丙(本气)庚(中气)戊(余气)，庚透年干 → 乙见庚为正官
    const s = determineMonthlyStructure(chartOf(1990, 5, 20, 14).pillars);
    assert.equal(s.suggested.key, 'zhengguan');
    assert.equal(s.suggested.basis, 'secondaryRevealed');
    assert.equal(s.suggested.fromStem, '庚');
  });

  it('月支即日主之禄为建禄，不看透干；土在四季月不是建禄', () => {
    // 甲寅日寅月：甲禄在寅 → 建禄，不看透干
    const jianlu = determineMonthlyStructure({
      year: { charStem: '壬', charBranch: '子' },
      month: { charStem: '丙', charBranch: '寅' },
      day: { charStem: '甲', charBranch: '寅' },
      hour: { charStem: '壬', charBranch: '子' },
    });
    assert.equal(jianlu.suggested.key, 'jianlu');
    assert.equal(jianlu.suggested.basis, 'jianlu');
    // 己日主生未月：己禄在午不在未，未是四季月，未藏己丁乙、乙透 → 以透干论为七杀格（杂气）
    const s = determineMonthlyStructure(chartOf(2001, 7, 15, 3).pillars);
    assert.equal(s.suggested.key, 'qisha');
    assert.equal(s.suggested.basis, 'secondaryRevealed');
  });

  it('藏干皆不透则以本气论格', () => {
    const s = determineMonthlyStructure(chartOf(1984, 11, 3, 9).pillars);
    assert.equal(s.suggested.basis, 'primaryUnrevealed');
    assert.equal(s.suggested.fromRole, 'primary');
  });

  it('「透」不算日干 —— 日干是我，我不能同时是我的格', () => {
    const s = determineMonthlyStructure(chartOf(1990, 5, 20, 14).pillars);
    assert.deepEqual(s.facts.revealedStems.map((r) => r.position).sort(), [
      'hour',
      'month',
      'year',
    ]);
  });

  it('结构事实逐条可核：月令藏干数与权重来自同一张藏干表', () => {
    const s = determineMonthlyStructure(chartOf(1990, 5, 20, 14).pillars);
    assert.equal(s.monthBranch, '巳');
    // 巳是金之长生，故中气是庚不是戊 —— 这个次序错了，取格会取到另一个十神上去
    assert.deepEqual(
      s.facts.hiddenStems.map((h) => h.stem),
      ['丙', '庚', '戊']
    );
    assert.equal(s.facts.hiddenStems[0].role, 'primary');
    // 每一支的藏干权重之和恒为 1，与 calculateWeightedElements 的口径一致
    const sum = s.facts.hiddenStems.reduce((acc, h) => acc + h.weight, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9);
  });
});

describe('调候用神', () => {
  it('十干十二月共 120 格，无缺、无非法天干', () => {
    const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
    const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
    let cells = 0;
    for (const stem of STEMS) {
      for (const branch of BRANCHES) {
        const list = TIAOHOU[stem]?.[branch];
        assert.ok(Array.isArray(list) && list.length > 0, `${stem}日${branch}月缺调候`);
        list.forEach((s) => assert.ok(STEMS.includes(s), `${stem}日${branch}月有非法天干 ${s}`));
        cells += 1;
      }
    }
    assert.equal(cells, 120);
  });

  /**
   * 调候论的是寒暖燥湿。这条断言拦的是**整列错位** —— 抄表最容易出的事故，
   * 而错位之后每一格看着都像模像样，不会有任何报错。
   *
   * 冬月一条是全称的：非火性日主无一例外都要见丙丁暖之。
   * 夏月一条有两格例外，两格都有出处，故不放宽断言而是把例外集合**钉死**：
   * 改表时只要例外多一格少一格就会红，逼人回去核对原文。
   *
   * - 丁巳用甲庚：丁是灯烛之火，「取甲引丁，甲多则取庚为佐」，靠木引不靠水降温。
   * - 庚未用丁甲：三伏生寒且土旺埋金，要丁火煅炼、甲木引丁，同样不是降温的路数。
   */
  it('冬月见火无例外；夏月见水只两格例外，且例外集合钉死', () => {
    const fire = ['丙', '丁'];
    const water = ['壬', '癸'];
    const noFire = [];
    const noWater = [];
    for (const branch of ['亥', '子', '丑']) {
      for (const stem of Object.keys(TIAOHOU)) {
        if (fire.includes(stem)) continue;
        if (!TIAOHOU[stem][branch].some((s) => fire.includes(s))) noFire.push(`${stem}${branch}`);
      }
    }
    for (const branch of ['巳', '午', '未']) {
      for (const stem of Object.keys(TIAOHOU)) {
        if (water.includes(stem)) continue;
        if (!TIAOHOU[stem][branch].some((s) => water.includes(s))) noWater.push(`${stem}${branch}`);
      }
    }
    assert.deepEqual(noFire, []);
    assert.deepEqual(noWater.sort(), ['丁巳', '庚未']);
    assert.deepEqual(TIAOHOU['丁']['巳'], ['甲', '庚']);
    assert.deepEqual(TIAOHOU['庚']['未'], ['丁', '甲']);
  });

  it('中和局扶抑给不出用神时，调候仍然给得出', () => {
    const analysis = chartOf(2001, 7, 15, 3).analysis;
    assert.equal(analysis.strength.level, 'balanced');
    assert.deepEqual(analysis.usefulGod.favorable, []);
    assert.ok(analysis.tiaohou.stems.length > 0);
    assert.equal(analysis.tiaohou.stems[0].role, 'primary');
  });

  it('标出用神是否已现于四柱', () => {
    const t = determineTiaohou(chartOf(1990, 5, 20, 14).pillars);
    const gui = t.stems.find((s) => s.stem === '癸');
    // 癸未时柱，癸已透
    assert.equal(gui.revealed, true);
  });
});

// ---------------------------------------------------------------- 紫微

describe('紫微：三方四正、命主身主、乙级星', () => {
  const chart = calculateZiweiChart({
    birthYear: 1990,
    birthMonth: 5,
    birthDay: 20,
    birthHour: 14,
    gender: 'male',
  });

  it('三方四正 = 本宫 + 对宫(+6) + 三合(±4)，且三合宫恒与本宫成三合局', () => {
    const TRIPLES = [
      ['申', '子', '辰'],
      ['寅', '午', '戌'],
      ['亥', '卯', '未'],
      ['巳', '酉', '丑'],
    ];
    chart.palaces.forEach((palace) => {
      const t = palace.trine;
      assert.equal(t.indexes.self, palace.index);
      assert.equal(t.indexes.opposite, (palace.index + 6) % 12);
      const own = palace.branch.key;
      const opposite = t.branches[1];
      const trine = [t.branches[2], t.branches[3]];
      // 对宫相冲：地支相隔六位
      const group = TRIPLES.find((g) => g.includes(own));
      assert.notEqual(own, opposite);
      trine.forEach((b) => assert.ok(group.includes(b), `${own} 的三合宫不该有 ${b}`));
    });
  });

  it('三方四正的星曜清单只收四宫之星，且逐星标出所属角色', () => {
    const ming = chart.palaces[chart.mingPalace.index];
    const members = new Set([
      ming.trine.indexes.self,
      ming.trine.indexes.opposite,
      ...ming.trine.indexes.trine,
    ]);
    ming.trine.stars.forEach((star) => {
      assert.ok(members.has(star.palaceIndex));
      assert.ok(['self', 'opposite', 'trine'].includes(star.role));
    });
  });

  it('命主按命宫地支、身主按生年支，两者判据不同', () => {
    // 1990 庚午年，命宫在戌
    assert.equal(chart.palaces[chart.mingPalace.index].branch.key, '戌');
    assert.equal(chart.mingZhu, '禄存');
    assert.equal(chart.lunar.yearBranch, '午');
    assert.equal(chart.shenZhu, '火星');
  });

  it('乙级星二十颗全落盘，且每颗只落一宫', () => {
    const all = chart.palaces.flatMap((p) => p.stars.minorB.map((s) => s.key));
    assert.equal(all.length, 20);
    assert.equal(new Set(all).size, 20);
    // 每颗都带安星规则，换流派时改哪一条一目了然
    chart.palaces.forEach((p) => p.stars.minorB.forEach((s) => assert.ok(s.basis)));
  });

  it('红鸾天喜恒为对宫', () => {
    const find = (key) => chart.palaces.findIndex((p) => p.stars.minorB.some((s) => s.key === key));
    assert.equal((find('hongluan') + 6) % 12, find('tianxi'));
  });

  it('四组十二神各布满十二宫，无重无漏', () => {
    for (const key of ['changsheng', 'boshi', 'suiqian', 'jiangqian']) {
      const names = chart.palaces.map((p) => p.gods[key]);
      assert.equal(new Set(names).size, 12, `${key} 应恰好十二位不重复`);
    }
  });

  /**
   * 「布满十二宫」这条断言证明不了**方向**：顺排逆排都是十二位不重复。
   * 而顺逆恰恰是最容易写反且不会报错的地方 —— 曾经就把 `getMajorPeriodDirection`
   * 的返回值（1 / -1）拿去比字符串 'forward'，结果阳男阴女那一半整体排成了逆行。
   */
  it('长生与博士分男女阴阳顺逆，岁前与将前一律顺行', () => {
    const of = (gender) =>
      calculateZiweiChart({
        birthYear: 1990,
        birthMonth: 5,
        birthDay: 20,
        birthHour: 14,
        gender,
      });
    const male = of('male');
    const female = of('female');
    const at = (c, branch, key) => c.palaces.find((p) => p.branch.key === branch).gods[key];

    // 1990 庚午：阳年。男为阳男顺行，女为阳女逆行
    assert.equal(male.majorPeriodDirection, 1);
    assert.equal(female.majorPeriodDirection, -1);

    // 土五局长生在申，两性别的起宫相同、方向相反
    assert.equal(at(male, '申', 'changsheng'), '长生');
    assert.equal(at(female, '申', 'changsheng'), '长生');
    assert.equal(at(male, '戌', 'changsheng'), '冠带'); // 申→酉→戌 顺数第三位
    assert.equal(at(female, '戌', 'changsheng'), '胎'); // 逆数第三位

    // 博士自禄存宫起，庚年禄存在申，顺逆同长生
    assert.equal(at(male, '申', 'boshi'), '博士');
    assert.equal(at(male, '戌', 'boshi'), '青龙');
    assert.equal(at(female, '戌', 'boshi'), '伏兵');

    // 岁前与将前不分男女，两张盘必须逐宫相同
    for (const key of ['suiqian', 'jiangqian']) {
      chart.palaces.forEach((_, i) => {
        assert.equal(male.palaces[i].gods[key], female.palaces[i].gods[key], `${key} 不该分男女`);
      });
    }
    // 岁建落年支之宫，将星落年支三合局的中神之宫
    assert.equal(at(male, '午', 'suiqian'), '岁建');
    assert.equal(at(male, '午', 'jiangqian'), '将星');
  });

  it('身宫在盘上标出来，与顶层 shenPalace 指同一宫', () => {
    const marked = chart.palaces.findIndex((p) => p.isShenPalace);
    assert.equal(marked, chart.shenPalace.index);
  });
});

// ---------------------------------------------------------------- 奇门

describe('奇门盘面关系量', () => {
  const chart = castQimenChart({ year: 2026, month: 8, day: 25, hour: 14 });

  it('旬空由时干支之旬定，落宫与地支表一致', () => {
    // 乙未时属甲午旬，空亡辰巳，辰巳同在巽四宫
    assert.equal(chart.hourGanzhi, '乙未');
    assert.deepEqual(chart.xunkong.branches, ['辰', '巳']);
    assert.deepEqual(
      chart.xunkong.palaces.map((p) => p.palace),
      [4, 4]
    );
    assert.equal(chart.palaces.find((p) => p.index === 4).relations.isXunkong, true);
  });

  it('驿马由日支定，非时支', () => {
    // 辛未日，亥卯未马在巳，巳在巽四
    assert.equal(chart.yima.branch, '巳');
    assert.equal(chart.yima.palace, 4);
  });

  it('门迫是宫克门 —— 开门落离九宫即经典例证', () => {
    for (const palace of chart.palaces) {
      if (!palace.gate) {
        assert.equal(palace.relations.isGatePo, false);
        continue;
      }
      // 门迫（门克宫）与门制（宫克门）互斥，且两者都由 gatePalace 这一个关系推出
      assert.equal(palace.relations.isGatePo, palace.relations.gatePalace === 'ControlledBy');
      assert.equal(palace.relations.isGateZhi, palace.relations.gatePalace === 'Controls');
      assert.ok(!(palace.relations.isGatePo && palace.relations.isGateZhi));
    }
  });

  it('中五宫恒不报伏吟 —— 它本就不转', () => {
    const center = chart.palaces.find((p) => p.index === 5);
    assert.equal(center.heavenStem, center.earthStem);
    assert.equal(center.relations.isFuyin, false);
  });

  it('六仪击刑只论六仪，三奇恒不成立', () => {
    chart.palaces.forEach((palace) => {
      if (['乙', '丙', '丁'].includes(palace.earthStem)) {
        assert.equal(palace.relations.isJixing, false);
      }
    });
  });

  it('每宫的星门宫生克都算得出来（中宫无门除外）', () => {
    chart.palaces.forEach((palace) => {
      assert.ok(palace.relations.starPalace, `${palace.cn} 缺星宫关系`);
      if (palace.index !== 5) assert.ok(palace.relations.gatePalace, `${palace.cn} 缺门宫关系`);
    });
  });
});

// ---------------------------------------------------------------- 六壬

describe('六壬三传的遁干、天将与六亲', () => {
  const chart = castLiurenChart({ year: 2026, month: 8, day: 25, hour: 14 });

  it('遁干取日干支所属之旬', () => {
    // 辛未属甲子旬：午配庚、辰配戊、寅配丙
    assert.equal(chart.dayGanzhi, '辛未');
    assert.equal(getDunGan('辛未', '午'), '庚');
    assert.equal(getDunGan('辛未', '辰'), '戊');
    assert.equal(getDunGan('辛未', '寅'), '丙');
  });

  it('旬空两支取不到遁干 —— 那一旬里根本没有它们', () => {
    assert.deepEqual(chart.xunkong.branches, ['戌', '亥']);
    assert.equal(getDunGan('辛未', '戌'), null);
    assert.equal(getDunGan('辛未', '亥'), null);
  });

  it('六亲以日干为我，不是以宫为我', () => {
    // 日干辛属金：午火克金为官鬼、辰土生金为父母、寅木被金克为妻财
    assert.equal(chart.threeTransmissions.initial.relative.cn, '官鬼');
    assert.equal(chart.threeTransmissions.middle.relative.cn, '父母');
    assert.equal(chart.threeTransmissions.last.relative.cn, '妻财');
  });

  it('天将乘的是天盘之支，故取将要先反查它压住哪个地盘位', () => {
    for (const key of ['initial', 'middle', 'last']) {
      const t = chart.threeTransmissions[key];
      const earthIndex = chart.heavenPlate.indexOf(t.branch);
      assert.equal(t.general, chart.twelveGenerals.plate[earthIndex]);
      assert.equal(t.earthBranch, chart.earthPlate[earthIndex]);
    }
  });

  it('四课上神同样带遁干天将六亲', () => {
    chart.fourCourses.forEach((course) => {
      assert.equal(course.upperDetail.branch, course.upper);
      assert.ok(course.upperDetail.general);
    });
  });
});

// ---------------------------------------------------------------- 六爻

describe('六爻：卦冲合、爻间生克、进退神、内外卦伏吟返吟', () => {
  const cast = (lines, changingLines) =>
    buildLiuyaoChart(lines, { changingLines, dayGanzhi: '甲子', monthBranch: '寅' });

  it('八纯卦为六冲卦，天雷无妄亦是', () => {
    assert.equal(cast([1, 1, 1, 1, 1, 1], []).hexagramType.isSixClash, true);
    assert.equal(cast([0, 0, 0, 0, 0, 0], []).hexagramType.isSixClash, true);
    // 乾动二三爻成天雷无妄
    assert.equal(cast([1, 1, 1, 1, 1, 1], [2, 3]).hexagramType.changed.isSixClash, true);
  });

  it('乾内卦变震为伏吟 —— 两者内卦纳甲同为子寅辰', () => {
    const chart = cast([1, 1, 1, 1, 1, 1], [2, 3]);
    assert.equal(chart.changedHexagram.name.cn, '天雷无妄');
    assert.equal(chart.trigramShift.inner.key, 'fuyin');
  });

  it('坤内卦变巽为返吟 —— 未巳卯与丑亥酉三支全冲', () => {
    const chart = cast([0, 0, 0, 0, 0, 0], [2, 3]);
    assert.equal(chart.trigramShift.inner.key, 'fanyin');
  });

  it('没有动爻的那一卦不判伏吟 —— 静卦必然与自己相同', () => {
    const chart = cast([1, 1, 1, 1, 1, 1], [2, 3]);
    assert.equal(chart.trigramShift.outer, null);
    assert.equal(cast([1, 1, 1, 1, 1, 1], []).trigramShift, null);
  });

  it('进神退神只在同五行且序数递进时成立', () => {
    // 地雷复二爻寅→卯为进神；地泽临二爻卯→寅为退神
    const advance = cast([1, 0, 0, 0, 0, 0], [2]);
    assert.equal(advance.yaos[1].changedTo.shift.key, 'advance');
    const retreat = cast([1, 1, 0, 0, 0, 0], [2]);
    assert.equal(retreat.yaos[1].changedTo.shift.key, 'retreat');
  });

  it('生克一律自动爻发出，静爻之间不相互作用', () => {
    const chart = cast([1, 1, 1, 1, 1, 1], [1, 3]);
    const movers = new Set(chart.yaos.filter((y) => y.isChanging).map((y) => y.position));
    chart.interactions.forEach((i) => {
      assert.ok(movers.has(i.from));
      assert.notEqual(i.from, i.to);
      assert.ok(['Generates', 'Controls'].includes(i.relation));
    });
  });

  it('爻间冲合不分动静，且同一对只记一次', () => {
    const chart = cast([1, 1, 1, 1, 1, 1], []);
    // 乾卦子寅辰午申戌，三对相冲：子午、寅申、辰戌
    const clashes = chart.pairRelations.filter((r) => r.kind === 'clash');
    assert.equal(clashes.length, 3);
    clashes.forEach((r) => assert.ok(r.positions[0] < r.positions[1]));
  });
});

// ---------------------------------------------------------------- 八宅

describe('八宅：宅卦与命宅相配', () => {
  it('坐山三种写法都归到同一卦', () => {
    for (const input of ['坎', '子', '正北', '子山午向']) {
      assert.equal(resolveSittingTrigram(input).cn, '坎', input);
    }
    assert.equal(resolveSittingTrigram('壬').cn, '坎');
    assert.equal(resolveSittingTrigram('乾').cn, '乾');
  });

  it('认不出的坐山返回 null，不猜一个卦出来', () => {
    assert.equal(resolveSittingTrigram('火星'), null);
    assert.equal(resolveSittingTrigram(''), null);
    assert.equal(buildHouseChart('火星'), null);
  });

  it('坐与向恒为对宫', () => {
    const pairs = [
      ['坎', '离'],
      ['震', '兑'],
      ['巽', '乾'],
      ['艮', '坤'],
    ];
    for (const [sit, face] of pairs) {
      const house = buildHouseChart(sit);
      assert.equal(house.facing.cn, face);
      assert.equal(buildHouseChart(face).facing.cn, sit);
    }
  });

  it('宅的八方游年自宅卦起，与命卦那一半互相独立', () => {
    const chart = buildBazhaiChart({ birthYear: 1990, gender: 'male', sitting: '子山午向' });
    assert.equal(chart.lifeTrigram.cn, '坎');
    assert.equal(chart.house.sitting.cn, '坎');
    // 同为坎，两半的游年自然一致；换个坐山就该分开
    const other = buildBazhaiChart({ birthYear: 1990, gender: 'male', sitting: '兑' });
    assert.equal(other.lifeTrigram.cn, '坎');
    assert.equal(other.house.sitting.cn, '兑');
    assert.notDeepEqual(other.house.auspiciousDirections, other.auspiciousDirections);
  });

  it('命宅相配看东西四是否同组，并另给坐山方对本人所值之星', () => {
    const matched = buildBazhaiChart({ birthYear: 1990, gender: 'male', sitting: '坎' });
    assert.equal(matched.match.matched, true);
    assert.equal(matched.match.sittingStarForLife.cn, '伏位');
    const mismatched = buildBazhaiChart({ birthYear: 1990, gender: 'male', sitting: '坤' });
    assert.equal(mismatched.match.matched, false);
    assert.equal(mismatched.match.sittingStarForLife.cn, '绝命');
  });

  it('没给坐山时只排命卦，houseResolution 如实标出', () => {
    const none = buildBazhaiChart({ birthYear: 1990, gender: 'male' });
    assert.equal(none.house, null);
    assert.equal(none.houseResolution, 'absent');
    const bad = buildBazhaiChart({ birthYear: 1990, gender: 'male', sitting: '火星' });
    assert.equal(bad.houseResolution, 'unresolved');
    // 认不出不影响命卦那一半
    assert.equal(bad.lifeTrigram.cn, '坎');
  });
});

// ---------------------------------------------------------------- 择吉

describe('择吉：流年紫白与方位煞', () => {
  it('入中星按公式算，与 lunar-javascript 的年紫白逐年一致', () => {
    const CN = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
    for (let year = 1985; year <= 2045; year += 1) {
      // 取七月一日，稳稳落在立春之后，两边同属一个干支年
      const expected = CN[Solar.fromYmd(year, 7, 1).getLunar().getYearNineStar().getNumber()];
      assert.equal(resolveYearNineStar(year), expected, `${year} 年入中星`);
    }
  });

  it('2024 甲辰三碧入中、五黄在正西 —— 手抄表最常错位一年的那一格', () => {
    assert.equal(resolveYearNineStar(2024), 3);
    const almanac = buildAlmanac({ year: 2024, month: 6, day: 1 });
    assert.equal(almanac.directions.nineStar.center, 3);
    assert.equal(almanac.directions.wuHuang.direction, '正西');
    // 二黑同年在东南
    assert.equal(almanac.directions.erHei.direction, '东南');
  });

  it('九宫飞星盘九宫九星各一，无重无漏', () => {
    for (let center = 1; center <= 9; center += 1) {
      const chart = buildNineStarChart(center);
      assert.equal(chart.length, 9);
      assert.equal(new Set(chart.map((c) => c.palace)).size, 9);
      assert.equal(new Set(chart.map((c) => c.star)).size, 9);
      assert.equal(chart.find((c) => c.palace === 5).star, center);
    }
  });

  it('三煞在年支三合局的对方，岁破冲太岁', () => {
    // 2026 丙午，寅午戌火局会南，三煞在北
    const almanac = buildAlmanac({ year: 2026, month: 8, day: 25 });
    assert.equal(almanac.ganzhi.year, '丙午');
    assert.equal(almanac.directions.taiSui.branch, '午');
    assert.equal(almanac.directions.suiPo.branch, '子');
    assert.equal(almanac.directions.sanSha.direction, '正北');
    assert.deepEqual(almanac.directions.sanSha.branches, ['亥', '子', '丑']);
    assert.deepEqual(
      almanac.directions.sanSha.detail.map((d) => d.cn),
      ['劫煞', '灾煞', '岁煞']
    );
  });

  it('年方位以立春为界，与年柱同界', () => {
    const before = buildAlmanac({ year: 2024, month: 2, day: 3 });
    const after = buildAlmanac({ year: 2024, month: 2, day: 5 });
    assert.equal(before.ganzhi.year, '癸卯');
    assert.equal(after.ganzhi.year, '甲辰');
    assert.equal(before.directions.nineStar.center, 4);
    assert.equal(after.directions.nineStar.center, 3);
  });

  it('宜忌、冲煞、黄道黑道、十二时辰吉凶都给了出来', () => {
    const almanac = buildAlmanac({ year: 2026, month: 8, day: 25 });
    assert.ok(Array.isArray(almanac.yi) && almanac.yi.length > 0);
    assert.ok(Array.isArray(almanac.ji) && almanac.ji.length > 0);
    assert.ok(almanac.chongSha.branch);
    assert.ok(['黄道', '黑道'].includes(almanac.tianShen.type));
    // 十三条不是十二条：子时跨两日，早子与晚子各占一段，且时干不同
    assert.equal(almanac.hours.length, 13);
    assert.equal(almanac.hours[0].range.from, '00:00');
    assert.equal(almanac.hours[12].range.from, '23:00');
    assert.notEqual(almanac.hours[0].ganzhi, almanac.hours[12].ganzhi);
    assert.equal(almanac.hours[0].ganzhi[1], '子');
    assert.equal(almanac.hours[12].ganzhi[1], '子');
    almanac.hours.forEach((hour) => {
      assert.ok(hour.ganzhi);
      assert.ok(['吉', '凶'].includes(hour.tianShen.luck));
    });
  });
});

// ---------------------------------------------------------------- 易经

describe('易经卦变：互、错、综', () => {
  const variantsOf = (key) => deriveHexagramVariants(hexagramByLines.get(key));

  it('水雷屯：互山地剥、错火风鼎、综山水蒙', () => {
    const v = variantsOf('100010');
    assert.equal(v.mutual.hexagram.name, '山地剥');
    assert.equal(v.opposite.hexagram.name, '火风鼎');
    assert.equal(v.reversed.hexagram.name, '山水蒙');
  });

  it('乾：互乾、错坤、综乾', () => {
    const v = variantsOf('111111');
    assert.equal(v.mutual.hexagram.name, '乾为天');
    assert.equal(v.opposite.hexagram.name, '坤为地');
    assert.equal(v.reversed.hexagram.name, '乾为天');
  });

  it('错卦与综卦都是对合运算：施两次回到本卦', () => {
    for (let n = 0; n < 64; n += 1) {
      const key = Array.from({ length: 6 }, (_, i) => (n >> i) & 1).join('');
      const v = deriveHexagramVariants(hexagramByLines.get(key));
      assert.equal(deriveHexagramVariants(v.opposite.hexagram).opposite.lines.join(''), key);
      assert.equal(deriveHexagramVariants(v.reversed.hexagram).reversed.lines.join(''), key);
    }
  });

  it('六十四卦每一卦的互错综都查得到，不留空', () => {
    for (let n = 0; n < 64; n += 1) {
      const key = Array.from({ length: 6 }, (_, i) => (n >> i) & 1).join('');
      const v = deriveHexagramVariants(hexagramByLines.get(key));
      ['mutual', 'opposite', 'reversed'].forEach((k) => assert.ok(v[k].hexagram, `${key} ${k}`));
    }
  });
});
