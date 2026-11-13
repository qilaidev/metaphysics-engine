/**
 * 口径锁：保证 constants/rulings.js 是真源，且与实现常量、排盘输出一致。
 *
 * 这些断言失败意味着「文档说一套、代码跑另一套」——比算法算错更危险，
 * 因为调用方会按声明的流派去解读盘。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  ENGINE_BOUNDARY,
  SHARED_RULINGS,
  BAZI_RULINGS,
  ZIWEI_RULINGS,
  LIUREN_RULINGS,
  QIMEN_RULINGS,
  BAZHAI_RULINGS,
  ALMANAC_RULINGS,
  TAROT_RULINGS,
  ALL_MODULE_RULINGS,
  CAPABILITY_SCHOOL_MODULES,
  schoolPayload,
  withSchool,
} from '../constants/rulings.js';
import { HIDDEN_STEMS, BRANCHES } from '../constants/ganzhi.js';
import { resolveDayForHour } from '../utils/civilDate.js';
import { YOUNIAN_SEQUENCE } from '../constants/bazhai.js';
import { performCalculation } from '../services/calculations.service.js';
import { calculateZiweiChart } from '../services/ziwei.service.js';
import { buildLiuyaoChart } from '../services/liuyao.service.js';
import { castLiurenChart } from '../services/liuren.service.js';
import { castQimenChart } from '../services/qimen.service.js';
import {
  buildBazhaiChart,
  buildAlmanac,
  buildNameGrids,
  resolveYearNineStar,
} from '../services/fengshui.service.js';
import { calculateCompatibility } from '../services/synastry.service.js';
import { calculateWeightedElements, determineStrength } from '../services/bazi.service.js';
import { drawTarot } from '../services/tarot.service.js';
import { calculateRisingSign } from '../services/zodiac.service.js';
import { buildHexagram, pickTrigram } from '../services/iching.service.js';

describe('口径注册表完备', () => {
  it('引擎边界与共享口径齐备', () => {
    assert.equal(ENGINE_BOUNDARY.key, 'structure-only');
    assert.ok(SHARED_RULINGS.lateZiDayRollover.key);
    assert.ok(SHARED_RULINGS.solarTermPrecision.key);
    assert.ok(SHARED_RULINGS.trueSolarTimeDefault.key);
  });

  it('全部能力模块各有一份口径，且每条有 key 与 cn', () => {
    const expected = [
      'bazi',
      'ziwei',
      'liuyao',
      'liuren',
      'qimen',
      'bazhai',
      'almanac',
      'name',
      'iching',
      'synastry',
      'tarot',
      'zodiac',
      'rising',
      'daily',
    ];
    assert.deepEqual(Object.keys(ALL_MODULE_RULINGS).sort(), expected.sort());
    assert.deepEqual([...CAPABILITY_SCHOOL_MODULES].sort(), expected.sort());

    Object.entries(ALL_MODULE_RULINGS).forEach(([mod, pack]) => {
      assert.equal(pack.module, mod);
      assert.ok(pack.cn, `${mod} 缺中文名`);
      assert.ok(Array.isArray(pack.sharedKeys), `${mod} 应声明 sharedKeys（可为空数组）`);
      const entries = Object.entries(pack).filter(
        ([k, v]) =>
          k !== 'module' && k !== 'cn' && k !== 'sharedKeys' && v && typeof v === 'object' && v.key
      );
      assert.ok(entries.length >= 1, `${mod} 口径条目过少`);
      entries.forEach(([name, entry]) => {
        assert.ok(entry.key, `${mod}.${name} 缺 key`);
        assert.ok(entry.cn, `${mod}.${name} 缺 cn`);
      });
    });
  });

  it('无关能力不塞共用时间口径（去噪）', () => {
    assert.equal(schoolPayload('tarot').shared, undefined);
    assert.equal(schoolPayload('name').shared, undefined);
    assert.equal(schoolPayload('zodiac').shared, undefined);
    assert.ok(schoolPayload('bazi').shared?.lateZi);
    assert.ok(schoolPayload('bazhai').shared?.solarTerm);
    assert.equal(schoolPayload('bazhai').shared?.lateZi, undefined);
  });

  it('未实现项必须显式标 implemented:false（不是静默缺席）', () => {
    assert.equal(ZIWEI_RULINGS.brightness.implemented, false);
    assert.equal(QIMEN_RULINGS.patterns.implemented, false);
    assert.ok(BAZI_RULINGS.usefulGod.notImplemented.includes('bingyao'));
    assert.ok(BAZI_RULINGS.usefulGod.notImplemented.includes('tongguan'));
    // 调候自本轮起已实现（穷通宝鉴表），不得再出现在未实现清单里
    assert.ok(!BAZI_RULINGS.usefulGod.notImplemented.includes('tiaohou'));
    assert.equal(BAZI_RULINGS.tiaohou.implemented, true);
    assert.equal(BAZI_RULINGS.monthlyStructure.implemented, true);
  });
});

describe('口径数值与代码常量一致', () => {
  it('藏干权重与 HIDDEN_STEMS 对齐', () => {
    const { primary, middle, residual, dualPrimary, dualMiddle, singlePrimary } =
      BAZI_RULINGS.hiddenStemWeights;

    // 三藏：寅
    const yin = HIDDEN_STEMS['寅'];
    assert.equal(yin.length, 3);
    assert.equal(yin[0].weight, primary);
    assert.equal(yin[1].weight, middle);
    assert.equal(yin[2].weight, residual);

    // 两藏：午
    const wu = HIDDEN_STEMS['午'];
    assert.equal(wu.length, 2);
    assert.equal(wu[0].weight, dualPrimary);
    assert.equal(wu[1].weight, dualMiddle);

    // 独藏：子
    assert.equal(HIDDEN_STEMS['子'][0].weight, singlePrimary);

    // 十二支权重各自归一
    BRANCHES.forEach((branch) => {
      const sum = HIDDEN_STEMS[branch].reduce((s, h) => s + h.weight, 0);
      assert.ok(Math.abs(sum - 1) < 1e-9, `${branch} 权重未归一：${sum}`);
    });
  });

  it('月令倍数与旺衰阈值被 bazi.service 实际使用', () => {
    const chart = performCalculation({
      birthYear: 1990,
      birthMonth: 5,
      birthDay: 12,
      birthHour: 10,
      gender: 'male',
    });
    const weighted = calculateWeightedElements(chart.pillars);
    // 月令 ×2 → 总分恒 9
    assert.ok(
      Math.abs(weighted.total - 7 - BAZI_RULINGS.monthBranchMultiplier.value) < 0.01 ||
        Math.abs(weighted.total - 9) < 0.01,
      `总分应体现月令倍数，实得 ${weighted.total}`
    );
    assert.equal(BAZI_RULINGS.monthBranchMultiplier.value, 2);
    assert.equal(BAZI_RULINGS.strengthThresholds.strongAbove, 0.55);
    assert.equal(BAZI_RULINGS.strengthThresholds.weakBelow, 0.45);

    const dm = chart.pillars.day.charStem;
    const strength = determineStrength(chart.pillars, dm);
    assert.ok(strength, '应能判定旺衰');
    if (strength.ratio > BAZI_RULINGS.strengthThresholds.strongAbove) {
      assert.equal(strength.level, 'strong');
    } else if (strength.ratio < BAZI_RULINGS.strengthThresholds.weakBelow) {
      assert.equal(strength.level, 'weak');
    } else {
      assert.equal(strength.level, 'balanced');
    }
  });

  it('八宅游年变爻序列与注册表一致', () => {
    assert.deepEqual(
      YOUNIAN_SEQUENCE.map((s) => s.flip),
      BAZHAI_RULINGS.younian.sequence
    );
  });

  it('六壬涉害方向声明为顺行（clockwise）', () => {
    assert.equal(LIUREN_RULINGS.shehai.direction, 'clockwise');
    assert.ok(LIUREN_RULINGS.shehai.key.includes('clockwise'));
  });

  it('奇门定局/天盘 key 锁定拆补与转盘', () => {
    assert.equal(QIMEN_RULINGS.bureau.key, 'chaibu');
    assert.equal(QIMEN_RULINGS.plate.key, 'zhuanpan');
  });

  it('紫微闰月 key 锁定归本月', () => {
    assert.equal(ZIWEI_RULINGS.leapMonth.key, 'leap-to-base-month');
  });
});

describe('子初换日只锁在时家，不渗进八字', () => {
  it('六壬 / 奇门声明子初换日，八字不声明', () => {
    assert.ok(LIUREN_RULINGS.sharedKeys.includes('ziChuDayRollover'));
    assert.ok(QIMEN_RULINGS.sharedKeys.includes('ziChuDayRollover'));
    assert.ok(!BAZI_RULINGS.sharedKeys.includes('ziChuDayRollover'));
    assert.ok(BAZI_RULINGS.sharedKeys.includes('lateZiDayRollover'));
  });

  it('实现确实在 23 点进位，22 点不进位', () => {
    assert.equal(resolveDayForHour(2024, 5, 20, 22).rolled, false);
    const rolled = resolveDayForHour(2024, 5, 20, 23);
    assert.equal(rolled.rolled, true);
    assert.equal(rolled.day, 21);
  });

  it('六壬 23 点起的课与次日 0 点同日干支', () => {
    const late = castLiurenChart({ year: 2024, month: 5, day: 20, hour: 23, minute: 10 });
    const next = castLiurenChart({ year: 2024, month: 5, day: 21, hour: 0, minute: 10 });
    assert.equal(late.dayGanzhi, next.dayGanzhi);
  });
});

describe('排盘响应携带 school 字段', () => {
  const assertSchool = (result, moduleKey) => {
    assert.ok(result?.school, `${moduleKey} 响应缺 school`);
    assert.equal(result.school.module, moduleKey);
    assert.equal(result.school.boundary, ENGINE_BOUNDARY.key);
    assert.ok(Object.keys(result.school.rulings).length >= 1, `${moduleKey} rulings 过少`);
    const pack = ALL_MODULE_RULINGS[moduleKey];
    if (pack.sharedKeys?.length) {
      assert.ok(result.school.shared, `${moduleKey} 应有 shared`);
    } else {
      assert.equal(result.school.shared, undefined, `${moduleKey} 不应夹带 shared`);
    }
  };

  it('八字', () => {
    assertSchool(
      performCalculation({
        birthYear: 1990,
        birthMonth: 5,
        birthDay: 20,
        birthHour: 14,
        gender: 'male',
      }),
      'bazi'
    );
  });

  it('紫微', () => {
    assertSchool(
      calculateZiweiChart({
        birthYear: 1990,
        birthMonth: 5,
        birthDay: 12,
        birthHour: 10,
        gender: 'female',
      }),
      'ziwei'
    );
  });

  it('六爻', () => {
    assertSchool(buildLiuyaoChart([1, 1, 1, 1, 1, 1], { dayGanzhi: '甲子' }), 'liuyao');
  });

  it('六壬', () => {
    assertSchool(castLiurenChart({ year: 2024, month: 5, day: 20, hour: 14 }), 'liuren');
  });

  it('奇门', () => {
    assertSchool(castQimenChart({ year: 2024, month: 5, day: 20, hour: 14 }), 'qimen');
  });

  it('八宅', () => {
    assertSchool(buildBazhaiChart({ birthYear: 2000, gender: 'male' }), 'bazhai');
  });

  it('择吉', () => {
    assertSchool(buildAlmanac({ year: 2024, month: 5, day: 20 }), 'almanac');
  });

  it('姓名五格', () => {
    assertSchool(buildNameGrids([7], [8, 9]), 'name');
  });

  it('合盘', () => {
    const a = performCalculation({
      birthYear: 1990,
      birthMonth: 5,
      birthDay: 20,
      birthHour: 14,
      gender: 'male',
    });
    const b = performCalculation({
      birthYear: 1992,
      birthMonth: 8,
      birthDay: 8,
      birthHour: 10,
      gender: 'female',
    });
    assertSchool(calculateCompatibility(a, b), 'synastry');
  });

  it('塔罗', () => {
    assertSchool(drawTarot({ spreadType: 'ThreeCard', rng: () => 0.99 }), 'tarot');
  });

  it('上升星座', () => {
    assertSchool(
      calculateRisingSign({
        birthYear: 1990,
        birthMonth: 5,
        birthDay: 20,
        birthHour: 14,
        birthMinute: 30,
        latitude: 39.9,
        longitude: 116.4,
        timezoneOffsetMinutes: 480,
      }),
      'rising'
    );
  });

  it('周易起卦结果可挂 school', () => {
    const hex = buildHexagram(pickTrigram(1), pickTrigram(1));
    assertSchool(withSchool('iching', { hexagram: hex, method: 'number' }), 'iching');
  });

  it('withSchool 对 null 原样返回', () => {
    assert.equal(withSchool('bazi', null), null);
    assert.equal(schoolPayload('nope'), null);
  });
});

describe('关键口径 key 不得静默改名', () => {
  // 这些 key 是调用方可能拿来做断言/路由的契约；改名必须同步改测试。
  const LOCKED = {
    bazi: {
      hiddenStemWeights: 'normalized-0.6-0.3-0.1',
      monthBranchMultiplier: 'month-branch-x2',
      strengthThresholds: 'ally-ratio-55-45',
      usefulGod: 'fuyi-only',
      specialPattern: 'rootless-follow-and-commanded-dominant',
      shenshaYangren: 'yangren-yang-stems-only',
      mingGongMonth: 'jieqi-month',
    },
    ziwei: {
      leapMonth: 'leap-to-base-month',
      brightness: 'not-implemented',
      palaceSihua: 'palace-stem-sihua-fly',
      palaceOrder: 'counter-clockwise-from-ming',
      sihuaVariants: 'quanji-line-geng-yang-wu-yin-tong',
      godsDirection: 'changsheng-boshi-by-yin-yang',
      jieshen: 'year-jieshen-only',
      majorPeriod: 'yang-male-forward',
    },
    liuren: {
      monthGeneral: 'mid-qi-change',
      shehai: 'clockwise-home-tally-by-type',
      transmissionOrder: 'nine-gates-order',
      transmissionRelative: 'day-stem-as-self',
      firstCourse: 'first-course-day-stem',
      fuyin: 'fuyin-ziren-zixin',
      maoxing: 'yang-looks-up-yin-looks-down',
      noble: 'geng-with-jia-wu',
    },
    qimen: {
      bureau: 'chaibu',
      plate: 'zhuanpan',
      patterns: 'not-implemented',
      gatePo: 'gate-controls-palace',
      seasonalState: 'month-branch-wang-xiang',
      zhishiFlight: 'zhishi-luoshu-order',
      centerPalace: 'center-lodge-kun',
      stemTomb: 'wuxing-tomb-treasury',
    },
    liuyao: {
      changedLineSixRelative: 'ben-gong-as-self',
      role: 'assemble-not-cast',
      advanceRetreat: 'eight-fixed-pairs',
      seasonalState: 'month-branch-wang-xiang',
    },
    bazhai: {
      lifeTrigramYear: 'lichun-year',
      houseTrigram: 'sitting-mountain-trigram',
    },
    almanac: {
      almanacSource: 'lunar-javascript-almanac',
      directionsYear: 'lichun-year-directions',
      nineStar: 'computed-center-star',
      dayGranularity: 'lichun-day-inclusive',
    },
    name: {
      nameStrokes: 'caller-provides-strokes',
    },
    iching: {
      method: 'meihua',
      timeCast: 'year-zhi-lunar-month-day-hour-zhi',
    },
    synastry: {
      focus: 'spouse-palace-ganzhi',
    },
    tarot: {
      randomness: 'not-reproducible',
      reversalRate: 'reversal-0.5',
      spreads: 'named-spreads-with-aliases',
      seed: 'fnv1a-mulberry32',
    },
    rising: {
      model: 'simplified-gmst-obliquity',
    },
    daily: {
      dateSource: 'engine-today-only',
    },
    zodiac: {
      content: 'static-sign-content',
    },
  };

  it('塔罗默认逆位率与注册表一致', () => {
    assert.equal(TAROT_RULINGS.reversalRate.value, 0.5);
  });

  it('择吉口径声明历注来源', () => {
    assert.equal(ALMANAC_RULINGS.almanacSource.key, 'lunar-javascript-almanac');
  });

  it('紫白入中星声明的公式与实现一致', () => {
    // 声明说的是「算不查表」——那实现就必须真按公式来，锚点 1984 甲子七赤入中
    assert.equal(resolveYearNineStar(1984), 7);
    assert.equal(resolveYearNineStar(2024), 3);
    for (let year = 1985; year <= 2010; year += 1) {
      const prev = resolveYearNineStar(year - 1);
      const expected = prev === 1 ? 9 : prev - 1;
      assert.equal(resolveYearNineStar(year), expected, `${year} 年应比上年退一`);
    }
  });

  it('门迫声明的方向（门克宫）与排盘输出一致', () => {
    const chart = castQimenChart({ year: 2026, month: 3, day: 7, hour: 14 });
    chart.palaces.forEach((palace) => {
      if (!palace.gate) return;
      // gatePalace 以宫为「我」：ControlledBy 即宫被门克 = 门克宫 = 门迫
      assert.equal(palace.relations.isGatePo, palace.relations.gatePalace === 'ControlledBy');
      assert.equal(palace.relations.isGateZhi, palace.relations.gatePalace === 'Controls');
    });
  });

  Object.entries(LOCKED).forEach(([mod, keys]) => {
    it(`${mod} 的锁定 key 未变`, () => {
      const pack = ALL_MODULE_RULINGS[mod];
      Object.entries(keys).forEach(([field, expectedKey]) => {
        assert.equal(
          pack[field]?.key,
          expectedKey,
          `${mod}.${field} 的 key 从 ${expectedKey} 变成了 ${pack[field]?.key}`
        );
      });
    });
  });
});

describe('各模块 sharedKeys 不得静默漂移', () => {
  // 六爻曾挂着八字的「晚子不换日」而路由按子初换日，择吉曾宣称交节到分而历注按日 ——
  // 这两处漂移 rulings_lock 此前都抓不到，因为只锁了 rulings 键没锁 sharedKeys。
  const EXPECTED_SHARED = {
    bazi: ['lateZiDayRollover', 'solarTermPrecision', 'trueSolarTimeDefault'],
    ziwei: ['lateZiDayRollover', 'solarTermPrecision', 'trueSolarTimeDefault'],
    liuyao: ['ziChuDayRollover', 'solarTermPrecision'],
    liuren: ['solarTermPrecision', 'ziChuDayRollover'],
    qimen: ['solarTermPrecision', 'ziChuDayRollover'],
    bazhai: ['solarTermPrecision'],
    almanac: [],
    name: [],
    iching: ['lateZiDayRollover'],
    synastry: ['lateZiDayRollover', 'solarTermPrecision', 'trueSolarTimeDefault'],
    tarot: [],
    zodiac: [],
    rising: [],
    daily: ['lateZiDayRollover'],
  };
  Object.entries(EXPECTED_SHARED).forEach(([mod, keys]) => {
    it(`${mod} 的 sharedKeys 与声明一致`, () => {
      assert.deepEqual([...ALL_MODULE_RULINGS[mod].sharedKeys].sort(), [...keys].sort());
    });
  });
});
