/**
 * 钉在外部例证上的回归：每条断言的期望值都不是从本仓库实现里读出来的，
 * 而是来自公开的例课 / 通行教材的逐时辰对照 / 时区数据库的既定事实。
 *
 * 此前六壬与奇门的测试全是自洽式（结构完整、前后一致、同一规则不矛盾），
 * 于是「第一课以寄宫判克」「值使门在八宫环上转」这两个静默错误跑了几百条绿测试都没露头。
 * 这里每一条都是那类测试抓不到的。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildHeavenPlate,
  buildFourCourses,
  deriveThreeTransmissions,
  castLiurenChart,
} from '../services/liuren.service.js';
import { castQimenChart } from '../services/qimen.service.js';
import { buildBirthTimeMeta, resolveZoneOffsetForWallClock } from '../utils/timezone.js';
import { performCalculation } from '../services/calculations.service.js';
import {
  LIUREN_RULINGS,
  QIMEN_RULINGS,
  ALMANAC_RULINGS,
  schoolPayload,
} from '../constants/rulings.js';
import { determineMonthlyStructure } from '../services/bazi.service.js';
import { LUSHEN, YANGREN } from '../constants/shensha.js';
import { buildAlmanac } from '../services/fengshui.service.js';
import { calculateZiweiChart } from '../services/ziwei.service.js';
import { resolveChartTime } from '../services/calculations.service.js';

const transmissionsOf = (general, hour, dayStem, dayBranch) => {
  const plate = buildHeavenPlate(general, hour);
  const courses = buildFourCourses(plate, dayStem, dayBranch);
  const tri = deriveThreeTransmissions(courses, plate, dayStem, {
    isFuyin: general === hour,
    isFanyin: false,
    dayBranch,
  });
  return { plate, courses, tri };
};

describe('六壬：公开例课（第一课以日干判克）', () => {
  // 三例出自同一篇公开的《大六壬三传法详解》，作者逐课写明了克应与取用理由。
  it('丁丑日 子时 申将：元首课，三传 巳 丑 酉', () => {
    // 原文：「第一课，丁和卯，卯生丁，二者不克……第四课，酉和巳，巳火克酉金，取巳为初传」
    const { courses, tri } = transmissionsOf('申', '子', '丁', '丑');
    assert.equal(courses[0].upper, '卯');
    assert.equal(courses[0].lowerStem, '丁', '第一课下神是日干');
    assert.equal(courses[0].lowerElement, 'Fire', '第一课以丁火论克，不以寄宫未土论');
    assert.equal(tri.courseType.key, 'yuanshou');
    assert.deepEqual([tri.initial.branch, tri.middle.branch, tri.last.branch], ['巳', '丑', '酉']);
  });

  it('丙戌日 巳时 申将：重审课，三传 申 亥 寅', () => {
    const { tri } = transmissionsOf('申', '巳', '丙', '戌');
    assert.equal(tri.courseType.key, 'zhongshen');
    assert.deepEqual([tri.initial.branch, tri.middle.branch, tri.last.branch], ['申', '亥', '寅']);
  });

  it('壬辰日 巳时 辰将：知一课（比用），三传 戌 酉 申', () => {
    const { tri } = transmissionsOf('辰', '巳', '壬', '辰');
    assert.equal(tri.courseType.key, 'zhiyi');
    assert.deepEqual([tri.initial.branch, tri.middle.branch, tri.last.branch], ['戌', '酉', '申']);
  });

  it('端到端：2018-06-14 子时（丁丑日、小满后申将）与例课一致', () => {
    const chart = castLiurenChart({ year: 2018, month: 6, day: 14, hour: 0 });
    assert.equal(chart.dayGanzhi, '丁丑');
    assert.equal(chart.monthGeneral.branch, '申');
    assert.equal(chart.threeTransmissions.courseType.key, 'yuanshou');
    assert.equal(chart.threeTransmissions.initial.branch, '巳');
  });

  it('寄宫五行与本干不同的五干：第一课 lowerElement 恒取日干五行', () => {
    const plate = buildHeavenPlate('亥', '寅');
    const expected = { 乙: 'Wood', 丁: 'Fire', 戊: 'Earth', 辛: 'Metal', 癸: 'Water' };
    Object.entries(expected).forEach(([stem, element]) => {
      const courses = buildFourCourses(plate, stem, '子');
      assert.equal(courses[0].lowerElement, element, `${stem}日第一课应以${element}论`);
    });
    assert.equal(LIUREN_RULINGS.firstCourse.key, 'first-course-day-stem');
  });
});

describe('奇门：值使门按九宫数序飞（通行教材逐时辰对照）', () => {
  // 教材例：「值使休门在坎一宫，此时旬别为甲子……丑时则到坤二宫，寅时到震三宫，卯时到巽四宫；
  // 若值使落入中宫则寄居坤二宫」。2024-01-01 为甲子日、冬至上元阳遁一局，旬首甲子戊在坎一。
  it('2024-01-01 甲子日 阳遁一局：子1 丑2 寅3 卯4 辰(5→2) 巳6 午7 未8 申9 酉1 戌2 亥3', () => {
    const expected = {
      0: 1,
      2: 2,
      4: 3,
      6: 4,
      8: 2,
      10: 6,
      12: 7,
      14: 8,
      16: 9,
      18: 1,
      20: 2,
      22: 3,
    };
    Object.entries(expected).forEach(([hour, palace]) => {
      const chart = castQimenChart({ year: 2024, month: 1, day: 1, hour: Number(hour) });
      assert.equal(chart.dayGanzhi, '甲子');
      assert.equal(chart.ju.yang, true);
      assert.equal(chart.ju.ju, 1);
      assert.equal(chart.zhishi.palace, palace, `${hour} 时值使应在 ${palace} 宫`);
    });
    // 甲子旬值使为休门；甲戌旬（20、22 时）旬首遁己在坤二，值使换成死门
    assert.equal(castQimenChart({ year: 2024, month: 1, day: 1, hour: 4 }).zhishi.gate.key, 'xiu');
    assert.equal(castQimenChart({ year: 2024, month: 1, day: 1, hour: 20 }).zhishi.gate.key, 'si');
  });

  it('2024-06-29 甲子日 阴遁九局：子9 丑8 寅7 卯6 辰(5→2) 巳4 午3 未2 申1 酉9 戌8 亥7', () => {
    const expected = {
      0: 9,
      2: 8,
      4: 7,
      6: 6,
      8: 2,
      10: 4,
      12: 3,
      14: 2,
      16: 1,
      18: 9,
      20: 8,
      22: 7,
    };
    Object.entries(expected).forEach(([hour, palace]) => {
      const chart = castQimenChart({ year: 2024, month: 6, day: 29, hour: Number(hour) });
      assert.equal(chart.dayGanzhi, '甲子');
      assert.equal(chart.ju.yang, false);
      assert.equal(chart.ju.ju, 9);
      assert.equal(chart.zhishi.palace, palace, `${hour} 时值使应在 ${palace} 宫`);
    });
  });

  it('值使宫恒不为中五，八门仍布满八宫', () => {
    for (let month = 1; month <= 12; month += 1) {
      for (let hour = 0; hour < 24; hour += 3) {
        const chart = castQimenChart({ year: 2024, month, day: 11, hour });
        assert.notEqual(chart.zhishi.palace, 5);
        const gates = chart.palaces.filter((p) => p.gate).map((p) => p.gate.key);
        assert.equal(new Set(gates).size, 8);
        assert.ok(chart.palaces.find((p) => p.index === chart.zhishi.palace).isZhishi);
      }
    }
    assert.equal(QIMEN_RULINGS.zhishiFlight.key, 'zhishi-luoshu-order');
  });
});

describe('时区：DST 转换窗口内的偏移取自正确的瞬时', () => {
  const offsetOf = (timezone, y, m, d, h, mi) =>
    buildBirthTimeMeta({
      birthYear: y,
      birthMonth: m,
      birthDay: d,
      birthHour: h,
      birthMinute: mi,
      timezone,
    }).timezoneOffsetMinutes;

  it('纽约 2024-03-10：02:00 进入 EDT，03:30 应为 −240 而非 −300', () => {
    assert.equal(offsetOf('America/New_York', 2024, 3, 10, 1, 30), -300);
    assert.equal(offsetOf('America/New_York', 2024, 3, 10, 3, 30), -240);
    assert.equal(offsetOf('America/New_York', 2024, 3, 10, 12, 0), -240);
  });

  it('纽约 2024-11-03：02:00 退回 EST，03:00 应为 −300', () => {
    assert.equal(offsetOf('America/New_York', 2024, 11, 3, 3, 0), -300);
    assert.equal(offsetOf('America/New_York', 2024, 11, 3, 0, 30), -240);
  });

  it('上海 1988-04-17 夏令时开始（IANA：4 月 11 日起首个周日 02:00）：03:30 应为 +540', () => {
    assert.equal(offsetOf('Asia/Shanghai', 1988, 4, 17, 1, 30), 480);
    assert.equal(offsetOf('Asia/Shanghai', 1988, 4, 17, 3, 30), 540);
    assert.equal(offsetOf('Asia/Shanghai', 1988, 7, 1, 14, 0), 540);
    assert.equal(offsetOf('Asia/Shanghai', 1988, 1, 10, 3, 30), 480);
  });

  it('不存在与重复的时刻都给出有限偏移，不抛错', () => {
    const skipped = resolveZoneOffsetForWallClock(
      'America/New_York',
      Date.UTC(2024, 2, 10, 2, 30, 0)
    );
    assert.ok([-300, -240].includes(skipped));
    const repeated = resolveZoneOffsetForWallClock(
      'America/New_York',
      Date.UTC(2024, 10, 3, 1, 30, 0)
    );
    assert.ok([-300, -240].includes(repeated));
    assert.equal(resolveZoneOffsetForWallClock('Not/AZone', Date.UTC(2024, 0, 1)), null);
  });

  it('DST 后一小时内的海外出生：时柱不再错一个时辰', () => {
    // 纽约 2024-03-10 03:30 EDT = 07:30Z；此前偏移取成 −5 会把 termReference 推后一小时。
    const chart = performCalculation({
      birthYear: 2024,
      birthMonth: 3,
      birthDay: 10,
      birthHour: 3,
      birthMinute: 30,
      gender: 'female',
      timezone: 'America/New_York',
      trueSolarTime: false,
    });
    assert.equal(chart.chartTime.termReference.hour, 15, '北京墙钟应为 15:30');
    assert.equal(chart.chartTime.termReference.minute, 30);
  });
});

describe('中国夏令时（1986–1991）：墙钟归一到北京标准时再排盘', () => {
  // 1988 立秋 08-07 15:20:15（北京标准时）。当年 4/10–9/11 行夏令时，墙钟快一小时。
  it('1988-08-07 15:40 夏令时墙钟 = 标准时 14:40，仍在立秋前：己未月、未时', () => {
    const chart = performCalculation({
      birthYear: 1988,
      birthMonth: 8,
      birthDay: 7,
      birthHour: 15,
      birthMinute: 40,
      gender: 'male',
      timezone: 'Asia/Shanghai',
      trueSolarTime: false,
    });
    assert.equal(chart.pillars.month.charStem + chart.pillars.month.charBranch, '己未');
    assert.equal(chart.pillars.hour.charBranch, '未');
    assert.deepEqual(chart.chartTime.used, { year: 1988, month: 8, day: 7, hour: 14, minute: 40 });
    assert.equal(chart.chartTime.dstNormalized.shiftMinutes, -60);
    assert.equal(chart.chartTime.dstNormalized.offsetMinutes, 540);
  });

  it('同一时刻 16:40 夏令时墙钟 = 标准时 15:40，已过立秋：庚申月', () => {
    const chart = performCalculation({
      birthYear: 1988,
      birthMonth: 8,
      birthDay: 7,
      birthHour: 16,
      birthMinute: 40,
      gender: 'male',
      timezone: 'Asia/Shanghai',
      trueSolarTime: false,
    });
    assert.equal(chart.pillars.month.charStem + chart.pillars.month.charBranch, '庚申');
  });

  it('给了出生地：总校正 = 夏令时一小时 + 经度差 + 均时差，与此前按 +9/135° 的结果一致', () => {
    const chart = performCalculation({
      birthYear: 1988,
      birthMonth: 8,
      birthDay: 7,
      birthHour: 15,
      birthMinute: 40,
      gender: 'male',
      timezone: 'Asia/Shanghai',
      birthLocation: '北京',
    });
    const tst = chart.chartTime.trueSolarTime;
    assert.equal(tst.dstCorrection, -60);
    assert.ok(
      tst.correctionMinutes < -75 && tst.correctionMinutes > -85,
      `实得 ${tst.correctionMinutes}`
    );
    assert.deepEqual(
      tst.clockTime,
      { year: 1988, month: 8, day: 7, hour: 15, minute: 40 },
      '保留输入墙钟'
    );
    assert.equal(chart.chartTime.used.hour, 14, '15:40 回拨约 80 分钟落在 14 时');
    assert.equal(chart.pillars.hour.charBranch, '未');
  });

  it('非夏令时年份不归一，dstNormalized 为 null', () => {
    const chart = performCalculation({
      birthYear: 1990,
      birthMonth: 12,
      birthDay: 1,
      birthHour: 10,
      gender: 'female',
      timezone: 'Asia/Shanghai',
    });
    assert.equal(chart.chartTime.dstNormalized, null);
    assert.equal(chart.chartTime.used.hour, 10);
  });
});

describe('八字：建禄羊刃按禄刃表（十干建禄月各家一致）', () => {
  // 年时干取壬：壬只藏于申亥，而申亥月的格在透干规则之前已由禄刃表定下，不会被它干扰
  const pillarsOf = (dayStem, monthBranch, monthStem = '甲') => ({
    year: { charStem: '壬', charBranch: '子' },
    month: { charStem: monthStem, charBranch: monthBranch },
    day: { charStem: dayStem, charBranch: '子' },
    hour: { charStem: '壬', charBranch: '子' },
  });

  it('甲寅 乙卯 丙巳 丁午 戊巳 己午 庚申 辛酉 壬亥 癸子 月皆为建禄格', () => {
    Object.entries(LUSHEN).forEach(([stem, branch]) => {
      const s = determineMonthlyStructure(pillarsOf(stem, branch));
      assert.equal(s.suggested.key, 'jianlu', `${stem}日${branch}月应为建禄`);
      assert.equal(s.suggested.basis, 'jianlu');
    });
  });

  it('五阳干刃月（甲卯 丙午 戊午 庚酉 壬子）为羊刃格', () => {
    Object.entries(YANGREN).forEach(([stem, branch]) => {
      const s = determineMonthlyStructure(pillarsOf(stem, branch));
      assert.equal(s.suggested.key, 'yangren', `${stem}日${branch}月应为羊刃`);
    });
  });

  it('戊己在四季月不是建禄：本气比劫不透归月劫，中气财官透干则以透干论（杂气）', () => {
    // 戊日辰月：辰藏戊乙癸。皆不透 → 月劫；乙透 → 正官格；癸透 → 正财格
    assert.equal(determineMonthlyStructure(pillarsOf('戊', '辰', '庚')).suggested.key, 'yuejie');
    assert.equal(determineMonthlyStructure(pillarsOf('戊', '辰', '乙')).suggested.key, 'zhengguan');
    assert.equal(determineMonthlyStructure(pillarsOf('戊', '辰', '癸')).suggested.key, 'zhengcai');
    // 戊日戌月 戊透（年干庚不透，月干戊）→ 本气比肩透 → 月劫，不得报建禄
    assert.equal(determineMonthlyStructure(pillarsOf('戊', '戌', '戊')).suggested.key, 'yuejie');
    assert.equal(determineMonthlyStructure(pillarsOf('己', '未', '庚')).suggested.key, 'yuejie');
  });

  it('戊日巳月不再报印格，己日巳月仍是正印（己禄在午不在巳）', () => {
    assert.equal(determineMonthlyStructure(pillarsOf('戊', '巳')).suggested.key, 'jianlu');
    // 己日巳月：巳藏丙庚戊皆不透 → 以本气丙论，丙生己且异阴阳为正印
    assert.equal(determineMonthlyStructure(pillarsOf('己', '巳', '甲')).suggested.key, 'zhengyin');
  });

  it('阴干月劫：乙寅 丁巳 辛申 癸亥', () => {
    [
      ['乙', '寅'],
      ['丁', '巳'],
      ['辛', '申'],
      ['癸', '亥'],
    ].forEach(([stem, branch]) => {
      const s = determineMonthlyStructure(pillarsOf(stem, branch, '庚'));
      assert.equal(s.suggested.key, 'yuejie', `${stem}日${branch}月应为月劫`);
      assert.equal(s.suggested.basis, 'yuejie');
    });
  });
});

describe('择吉：立春当日年柱与方位煞同一个年', () => {
  it('2024-02-04（立春 16:27）整日按新年：年柱甲辰、太岁辰、紫白三碧入中', () => {
    const a = buildAlmanac({ year: 2024, month: 2, day: 4 });
    assert.equal(a.ganzhi.year, '甲辰');
    assert.equal(a.directions.lichunYear, 2024);
    assert.equal(a.directions.taiSui.branch, '辰');
    assert.equal(a.directions.nineStar.center, 3, '2024 三碧入中');
    const before = buildAlmanac({ year: 2024, month: 2, day: 3 });
    assert.equal(before.ganzhi.year, '癸卯');
    assert.equal(before.directions.lichunYear, 2023);
    assert.equal(before.directions.nineStar.center, 4, '2023 四绿入中');
  });

  it('全年逐日：directions.lichunYear 与年柱永远同源', () => {
    const ganzhiOf = (y) => buildAlmanac({ year: y, month: 7, day: 1 }).ganzhi.year;
    for (let month = 1; month <= 12; month += 1) {
      for (let day = 1; day <= 28; day += 9) {
        const a = buildAlmanac({ year: 2025, month, day });
        const expectYear = a.ganzhi.year === ganzhiOf(2025) ? 2025 : 2024;
        assert.equal(a.directions.lichunYear, expectYear, `2025-${month}-${day}`);
      }
    }
    assert.equal(ALMANAC_RULINGS.dayGranularity.key, 'lichun-day-inclusive');
    assert.equal(schoolPayload('almanac').shared, undefined, '择吉不再宣称交节到分');
  });
});

describe('紫微：真太阳时经路由参与排盘', () => {
  it('乌鲁木齐 10:00 按北京时间回拨逾两小时，紫微时支应随之改变', () => {
    const payload = {
      birthYear: 1990,
      birthMonth: 5,
      birthDay: 12,
      birthHour: 10,
      birthMinute: 0,
      gender: 'male',
      birthLocation: '43.8,87.6',
      timezone: 'Asia/Shanghai',
    };
    const chartTime = resolveChartTime(payload);
    assert.ok(chartTime.trueSolarTime?.applied);
    assert.ok(chartTime.hour < 9, `应回拨到辰时之前，实得 ${chartTime.hour}`);
    const clock = calculateZiweiChart(payload);
    const solar = calculateZiweiChart({ ...payload, birthHour: chartTime.hour });
    assert.notEqual(solar.mingPalace.index, clock.mingPalace.index, '跨时辰后命宫必变');
  });
});
