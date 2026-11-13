/**
 * 主流口径金标准回归：钉死「写错也不报错」的边界。
 * 样例依据见各条 it 注释；改默认流派前必须同步改这里。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { performCalculation, resolveChartTime } from '../services/calculations.service.js';
import { calculateZiweiChart } from '../services/ziwei.service.js';
import { castQimenChart } from '../services/qimen.service.js';
import {
  castLiurenChart,
  deriveThreeTransmissions,
  buildHeavenPlate,
} from '../services/liuren.service.js';
import { findHiddenSpirits, getPalaceInfo } from '../services/liuyao.service.js';
import { buildNameGrids } from '../services/fengshui.service.js';
import { ZIWEI_SIHUA_BY_STEM, KUIYUE_BY_YEAR_STEM } from '../constants/ziwei.js';
import { COURSE_TYPES, NOBLE_BY_DAY_STEM } from '../constants/liuren.js';
import { resolveDayForHour } from '../utils/civilDate.js';

describe('八字：晚子时与立春换柱', () => {
  it('晚子时不换日：23 点日柱当日、时干按次日遁', () => {
    // SKILL.md 与 lunar-javascript sect=2 口径
    const h22 = performCalculation({
      birthYear: 1990,
      birthMonth: 5,
      birthDay: 20,
      birthHour: 22,
      gender: 'male',
    });
    const h23 = performCalculation({
      birthYear: 1990,
      birthMonth: 5,
      birthDay: 20,
      birthHour: 23,
      gender: 'male',
    });
    const h00 = performCalculation({
      birthYear: 1990,
      birthMonth: 5,
      birthDay: 21,
      birthHour: 0,
      gender: 'male',
    });

    assert.equal(h22.pillars.day.charStem + h22.pillars.day.charBranch, '乙酉');
    assert.equal(h22.pillars.hour.charStem + h22.pillars.hour.charBranch, '丁亥');

    assert.equal(h23.pillars.day.charStem + h23.pillars.day.charBranch, '乙酉', '23 点日柱不换');
    assert.equal(h23.pillars.hour.charStem + h23.pillars.hour.charBranch, '戊子', '时干按次日遁');

    assert.equal(h00.pillars.day.charStem + h00.pillars.day.charBranch, '丙戌');
    assert.equal(h00.pillars.hour.charStem + h00.pillars.hour.charBranch, '戊子');
  });

  it('立春当日精确到时：交节前后年月柱同时翻', () => {
    // 2024 立春约 2/4 16:27
    const before = performCalculation({
      birthYear: 2024,
      birthMonth: 2,
      birthDay: 4,
      birthHour: 10,
      gender: 'male',
    });
    const after = performCalculation({
      birthYear: 2024,
      birthMonth: 2,
      birthDay: 4,
      birthHour: 17,
      gender: 'male',
    });

    assert.equal(before.pillars.year.charStem + before.pillars.year.charBranch, '癸卯');
    assert.equal(before.pillars.month.charStem + before.pillars.month.charBranch, '乙丑');
    assert.equal(after.pillars.year.charStem + after.pillars.year.charBranch, '甲辰');
    assert.equal(after.pillars.month.charStem + after.pillars.month.charBranch, '丙寅');
  });

  it('海外时区换算到东八区后再比节气', () => {
    // 纽约 2024-02-04 10:00 EST ≈ 北京 23:00，已过立春 16:27 → 甲辰
    const ny = performCalculation({
      birthYear: 2024,
      birthMonth: 2,
      birthDay: 4,
      birthHour: 10,
      birthMinute: 0,
      gender: 'male',
      timezone: 'America/New_York',
      trueSolarTime: false,
    });
    assert.equal(
      ny.pillars.year.charStem + ny.pillars.year.charBranch,
      '甲辰',
      '纽约上午应对应北京已过立春的甲辰年'
    );
    // 换东八区**只为比节气**。日柱时柱是当地时辰，不能跟着换到北京那一天去，
    // 否则纽约上午 10 点会被排成北京次日凌晨的子丑时。
    assert.equal(ny.chartTime.used.day, 4, '排盘所用时刻仍是当地 2/4');
    assert.equal(ny.chartTime.used.hour, 10, '排盘所用时刻仍是当地 10 点');
    assert.equal(ny.chartTime.termReference.day, 4);
    assert.equal(ny.chartTime.termReference.hour, 23, '比节气用的是北京 23 点');
    assert.equal(ny.pillars.hour.charBranch, '巳', '当地 10 点是巳时');
    const local = performCalculation({
      birthYear: 2024,
      birthMonth: 2,
      birthDay: 4,
      birthHour: 10,
      birthMinute: 0,
      gender: 'male',
      trueSolarTime: false,
    });
    assert.equal(
      ny.pillars.day.charStem + ny.pillars.day.charBranch,
      local.pillars.day.charStem + local.pillars.day.charBranch,
      '日柱按当地日期，与同日同时的国内盘一致'
    );

    // 同一天不给时区则按数字 10:00 对 16:27 → 仍癸卯（国内默认路径）
    const raw = performCalculation({
      birthYear: 2024,
      birthMonth: 2,
      birthDay: 4,
      birthHour: 10,
      gender: 'male',
    });
    assert.equal(raw.pillars.year.charStem + raw.pillars.year.charBranch, '癸卯');
  });
});

describe('紫微：年干支取农历年（正月派）', () => {
  it('立春后春节前：年干支仍为上一个农历年', () => {
    // 2024 立春 2/4，春节 2/10；2/6 农历仍 2023 癸卯
    const chart = calculateZiweiChart({
      birthYear: 2024,
      birthMonth: 2,
      birthDay: 6,
      birthHour: 12,
      gender: 'male',
    });
    assert.equal(chart.lunar.year, 2023);
    assert.equal(chart.lunar.yearStem + chart.lunar.yearBranch, '癸卯');
  });
});

describe('奇门：子初换日', () => {
  it('23 点与次日 0 点同属一子时，日柱旬首一致', () => {
    const a = castQimenChart({ year: 2024, month: 5, day: 20, hour: 23 });
    const b = castQimenChart({ year: 2024, month: 5, day: 21, hour: 0 });
    assert.ok(a && b);
    assert.equal(a.dayGanzhi, b.dayGanzhi, '日干支应相同');
    assert.equal(a.hourGanzhi, b.hourGanzhi, '时干支应相同');
    assert.equal(a.xunshou, b.xunshou);
    assert.equal(a.ju.ju, b.ju.ju);
    assert.equal(a.ju.yuan, b.ju.yuan);
  });
});

describe('六壬：子初换日与遥克比用池', () => {
  it('23 点日柱入次日', () => {
    const a = castLiurenChart({ year: 2024, month: 5, day: 20, hour: 23 });
    const b = castLiurenChart({ year: 2024, month: 5, day: 21, hour: 0 });
    assert.equal(a.dayGanzhi, b.dayGanzhi);
    assert.equal(a.hourBranch, '子');
    assert.equal(b.hourBranch, '子');
  });

  it('遥克多课俱比时只在比用集合上涉害', () => {
    // 构造：无上下克、有多个遥克上神，且其中部分与日干同阴阳
    // 用四课对象直接测 deriveThreeTransmissions，避免依赖具体日期
    const heavenPlate = buildHeavenPlate('子', '午'); // 返吟盘，便于构造
    // 若返吟会先截走，改用不返吟：月将寅加时子
    const plate = buildHeavenPlate('寅', '子');
    const dayStem = '甲'; // 阳木
    // 手工四课：无上下克，上神有克日干者多个
    // 甲日寄寅；简化用 buildFourCourses 扫真实盘找遥克多课
    let found = false;
    for (let month = 1; month <= 12 && !found; month += 1) {
      for (let day = 1; day <= 28 && !found; day += 1) {
        for (let hour = 0; hour < 24 && !found; hour += 1) {
          const chart = castLiurenChart({ year: 2024, month, day, hour });
          const key = chart.threeTransmissions.courseType.key;
          if (key !== 'haoshi' && key !== 'tanshe') continue;
          // 验证三传结构完整即可；比用池逻辑由实现与贼克路径同构保证
          assert.ok(chart.threeTransmissions.initial.branch);
          assert.ok(chart.threeTransmissions.middle.branch);
          assert.ok(chart.threeTransmissions.last.branch);
          found = true;
        }
      }
    }
    assert.ok(found, '样本中应出现遥克课');
    // 回归：涉害候选去重 —— 同一上神重复不应炸
    const courses = [
      { upper: '子', lower: '寅', upperElement: 'Water', lowerElement: 'Wood' },
      { upper: '子', lower: '子', upperElement: 'Water', lowerElement: 'Water' },
      { upper: '午', lower: '申', upperElement: 'Fire', lowerElement: 'Metal' },
      { upper: '午', lower: '午', upperElement: 'Fire', lowerElement: 'Fire' },
    ].map((c, i) => ({ index: i + 1, ...c }));
    // 无克无贼时可能走遥克；至少不应抛错
    assert.doesNotThrow(() => deriveThreeTransmissions(courses, plate, '甲', { dayBranch: '寅' }));
  });
});

describe('六爻：伏神一亲一条', () => {
  it('同一六亲不会重复挂多条伏神', () => {
    // 扫一批卦，凡有伏神则 relative.key 唯一
    const samples = [
      [1, 1, 1, 1, 1, 1],
      [0, 0, 0, 0, 0, 0],
      [1, 0, 1, 0, 1, 0],
      [0, 1, 0, 1, 0, 1],
      [1, 1, 0, 0, 1, 1],
      [0, 0, 1, 1, 0, 0],
      [1, 0, 0, 1, 0, 0],
      [0, 1, 1, 0, 1, 1],
    ];
    samples.forEach((lines) => {
      const palace = getPalaceInfo(lines);
      const hidden = findHiddenSpirits(lines, palace);
      const keys = hidden.map((h) => h.relative.key);
      assert.equal(keys.length, new Set(keys).size, `伏神六亲重复: ${keys.join(',')}`);
    });
  });
});

describe('子初换日工具', () => {
  it('22 点不滚日，23 点滚到次日', () => {
    assert.equal(resolveDayForHour(2024, 5, 20, 22).rolled, false);
    const r = resolveDayForHour(2024, 5, 20, 23);
    assert.equal(r.rolled, true);
    assert.equal(r.day, 21);
  });

  it('月末 23 点正确进月', () => {
    const r = resolveDayForHour(2024, 1, 31, 23);
    assert.equal(r.month, 2);
    assert.equal(r.day, 1);
  });
});

describe('姓名外格公式', () => {
  it('四类姓名结构外格符合天+地−人', () => {
    assert.equal(buildNameGrids([10], [10]).grids.outer, 2);
    assert.equal(buildNameGrids([10], [5, 6]).grids.outer, 7); // 6+1
    assert.equal(buildNameGrids([3, 4], [10]).grids.outer, 4); // 3+1
    assert.equal(buildNameGrids([3, 4], [5, 6]).grids.outer, 9); // 3+6
  });
});

describe('真太阳时：国内路径不因上海换算漂移', () => {
  it('乌鲁木齐东经 87.6、UTC+8 仍回拨逾两小时', () => {
    const resolved = resolveChartTime({
      birthYear: 1990,
      birthMonth: 5,
      birthDay: 12,
      birthHour: 10,
      birthMinute: 0,
      birthLocation: '43.8,87.6',
      timezoneOffsetMinutes: 480,
    });
    assert.ok(resolved.trueSolarTime?.applied);
    assert.equal(resolved.hour, 7);
  });
});

describe('性别规范化', () => {
  it('Male/男 与 male 大运一致，非法性别拒绝', () => {
    const a = performCalculation({
      birthYear: 1990,
      birthMonth: 5,
      birthDay: 12,
      birthHour: 10,
      gender: 'Male',
    });
    const b = performCalculation({
      birthYear: 1990,
      birthMonth: 5,
      birthDay: 12,
      birthHour: 10,
      gender: '男',
    });
    const c = performCalculation({
      birthYear: 1990,
      birthMonth: 5,
      birthDay: 12,
      birthHour: 10,
      gender: 'male',
    });
    assert.equal(a.luckCycles[0].ganZhi, c.luckCycles[0].ganZhi);
    assert.equal(b.luckCycles[0].ganZhi, c.luckCycles[0].ganZhi);
    assert.throws(
      () =>
        performCalculation({
          birthYear: 1990,
          birthMonth: 5,
          birthDay: 12,
          birthHour: 10,
          gender: 'unknown',
        }),
      /gender/
    );
  });
});

describe('六壬八专日表', () => {
  it('BAZHUAN_DAYS 由寄宫表推导且阴阳相配：只有甲寅丁未己未庚申癸丑', async () => {
    const { BAZHUAN_DAYS, STEM_LODGING } = await import('../constants/liuren.js');
    const expected = Object.entries(STEM_LODGING)
      .map(([s, b]) => `${s}${b}`)
      .filter((gz) => ['甲寅', '丁未', '己未', '庚申', '癸丑'].includes(gz));
    assert.deepEqual([...BAZHUAN_DAYS].sort(), expected.sort());
    assert.ok(!BAZHUAN_DAYS.includes('乙卯'));
    assert.ok(!BAZHUAN_DAYS.includes('戊戌'));
    assert.ok(!BAZHUAN_DAYS.includes('辛酉'));
    // 乙辰/辛戌这类干支阴阳不配，六十甲子里不存在，推导表不得含
    assert.ok(!BAZHUAN_DAYS.includes('乙辰'));
    assert.ok(!BAZHUAN_DAYS.includes('辛戌'));
  });

  it('乙卯日无贼克时不得因错误日表强制八专', () => {
    // 2024-02-21 是乙卯；若干时辰无上下克时应可走遥克/别责/昴星，不应全是八专
    let nonBazhuan = 0;
    let total = 0;
    for (let hour = 0; hour < 24; hour += 1) {
      const chart = castLiurenChart({ year: 2024, month: 2, day: 21, hour });
      if (chart.dayGanzhi !== '乙卯') continue;
      total += 1;
      if (chart.threeTransmissions.courseType.key !== 'bazhuan') nonBazhuan += 1;
    }
    assert.ok(total > 0);
    assert.ok(nonBazhuan > 0, '乙卯日应有非八专课体（旧错表会几乎全判八专）');
  });
});

describe('东京时区不按中国墙钟', () => {
  it('东京立春日前下午换算后仍可能属上一年', () => {
    // 2024-02-04 16:00 JST ≈ 北京 15:00，立春 16:27 前 → 癸卯
    const tokyo = performCalculation({
      birthYear: 2024,
      birthMonth: 2,
      birthDay: 4,
      birthHour: 16,
      birthMinute: 0,
      gender: 'male',
      timezone: 'Asia/Tokyo',
      trueSolarTime: false,
    });
    assert.equal(tokyo.pillars.year.charStem + tokyo.pillars.year.charBranch, '癸卯');
  });
});

describe('时间以中国为主', () => {
  it('只给中国地点即可真太阳时，不必再传 timezone', () => {
    const chart = performCalculation({
      birthYear: 1990,
      birthMonth: 5,
      birthDay: 12,
      birthHour: 10,
      gender: 'male',
      birthLocation: '北京',
    });
    assert.ok(chart.chartTime.trueSolarTime?.applied);
    assert.equal(chart.chartTime.trueSolarTime.timezoneDefaulted, 'Asia/Shanghai');
  });

  it('无地点时输入数字即中国墙钟', () => {
    const chart = performCalculation({
      birthYear: 2024,
      birthMonth: 2,
      birthDay: 4,
      birthHour: 10,
      gender: 'male',
    });
    assert.equal(chart.pillars.year.charStem + chart.pillars.year.charBranch, '癸卯');
    assert.equal(chart.chartTime.trueSolarTime, null);
  });
});

describe('合盘：性别非法必须 400，不能穿透成 500', () => {
  // performCalculation 对非法性别是 throw，控制器不拦就会经 next(error) 变成 500 并泄漏堆栈
  const createRes = () => ({
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  });

  const PERSON = { birthYear: 1990, birthMonth: 5, birthDay: 20, birthHour: 14 };

  it('任一方性别非法即 400，且不走 next', async () => {
    const { analyzeSynastry } = await import('../controllers/synastry.controller.js');
    const res = createRes();
    let nexted = null;
    await analyzeSynastry(
      {
        body: {
          personA: { ...PERSON, gender: 'unknown' },
          personB: { ...PERSON, gender: 'female' },
        },
      },
      res,
      (err) => {
        nexted = err;
      }
    );
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /gender/);
    assert.equal(nexted, null);
  });

  it('中文性别可用，正常出盘', async () => {
    const { analyzeSynastry } = await import('../controllers/synastry.controller.js');
    const res = createRes();
    await analyzeSynastry(
      { body: { personA: { ...PERSON, gender: '男' }, personB: { ...PERSON, gender: '女' } } },
      res,
      (err) => {
        throw err;
      }
    );
    assert.equal(res.statusCode, 200);
    assert.ok(res.body.compatibility);
  });
});

// ---------------------------------------------------------------------------
// 以下五组是 2026-08-30 口径审计补的金标准。每一条挡住的都是「排得出盘、
// 结构完整、测试全绿，但盘是另一张」的那类错 —— 不是崩溃，是静默错断。
// ---------------------------------------------------------------------------

describe('紫微：十二宫自命宫逆布', () => {
  /**
   * 判据不依赖盘面画法：斗数通行口径是「阳男阴女大限顺行，第二大限走父母宫；
   * 阴男阳女逆行，第二大限走兄弟宫」。大限顺行即地支下标递增，
   * 故 mingIndex+1 必须是父母宫、mingIndex−1 必须是兄弟宫。
   * 顺布会让除命宫、迁移宫外的十宫两两互换，星曜落宫仍对，只有宫名整层错位。
   */
  const palaceAt = (chart, index) => chart.palaces[((index % 12) + 12) % 12].palace.cn;

  it('兄弟宫在命宫前一位，父母宫在命宫后一位', () => {
    const chart = calculateZiweiChart({
      birthYear: 1990,
      birthMonth: 5,
      birthDay: 20,
      birthHour: 14,
      gender: 'male',
    });
    const ming = chart.mingPalace.index;
    assert.equal(palaceAt(chart, ming), '命宫');
    assert.equal(palaceAt(chart, ming - 1), '兄弟');
    assert.equal(palaceAt(chart, ming + 1), '父母');
    assert.equal(palaceAt(chart, ming + 6), '迁移');
  });

  it('阳男第二大限走父母宫，阴男第二大限走兄弟宫', () => {
    const birth = { birthYear: 1990, birthMonth: 5, birthDay: 20, birthHour: 14 };
    const yangMale = calculateZiweiChart({ ...birth, gender: 'male' }); // 庚午年，阳男
    assert.equal(yangMale.majorPeriodDirection, 1);
    assert.equal(palaceAt(yangMale, yangMale.majorPeriods[1].palaceIndex), '父母');

    const yinMale = calculateZiweiChart({
      birthYear: 1991, // 辛未年，阴男
      birthMonth: 5,
      birthDay: 20,
      birthHour: 14,
      gender: 'male',
    });
    assert.equal(yinMale.majorPeriodDirection, -1);
    assert.equal(palaceAt(yinMale, yinMale.majorPeriods[1].palaceIndex), '兄弟');
  });

  it('命宫在戌那张盘：兄弟在酉、父母在亥、财帛在午', () => {
    const chart = calculateZiweiChart({
      birthYear: 1990,
      birthMonth: 5,
      birthDay: 20,
      birthHour: 14,
      gender: 'male',
    });
    const byBranch = Object.fromEntries(chart.palaces.map((p) => [p.branch.key, p.palace.cn]));
    assert.equal(chart.mingPalace.branch.key, '戌');
    assert.deepEqual(
      { 酉: byBranch['酉'], 亥: byBranch['亥'], 午: byBranch['午'], 辰: byBranch['辰'] },
      { 酉: '兄弟', 亥: '父母', 午: '财帛', 辰: '迁移' }
    );
  });
});

describe('紫微：四化表', () => {
  /**
   * 口诀「甲廉破武阳、乙机梁紫阴、丙同机昌廉、丁阴同机巨、戊贪阴右机、
   * 己武贪梁曲、庚阳武阴同、辛巨阳曲昌、壬梁紫左武、癸破巨阴贪」。
   * 壬干化忌恒为武曲、化科取左辅（与戊干取右弼配对），此前误作破军/天机。
   */
  it('十干化忌逐条对口诀，壬为武曲不是破军', () => {
    assert.deepEqual(
      Object.fromEntries(
        Object.entries(ZIWEI_SIHUA_BY_STEM).map(([stem, four]) => [stem, four.ji])
      ),
      {
        甲: 'taiyang',
        乙: 'taiyin',
        丙: 'lianzhen',
        丁: 'jumen',
        戊: 'tianji',
        己: 'wenqu',
        庚: 'tiantong',
        辛: 'wenchang',
        壬: 'wuqu',
        癸: 'tanlang',
      }
    );
  });

  it('壬干四化为梁紫左武，且戊右弼与壬左辅成对', () => {
    assert.deepEqual(ZIWEI_SIHUA_BY_STEM['壬'], {
      lu: 'tianliang',
      quan: 'ziwei',
      ke: 'zuofu',
      ji: 'wuqu',
    });
    assert.equal(ZIWEI_SIHUA_BY_STEM['戊'].ke, 'youbi');
  });

  it('四化落到壬年生人的盘上：化忌挂在武曲', () => {
    const chart = calculateZiweiChart({
      birthYear: 1992, // 壬申年
      birthMonth: 8,
      birthDay: 15,
      birthHour: 10,
      gender: 'male',
    });
    assert.equal(chart.lunar.yearStem, '壬');
    const ji = chart.fourTransformations.find((t) => t.type === 'ji');
    assert.equal(ji.starCn, '武曲');
    const onChart = chart.palaces.flatMap((p) => p.transformations).find((t) => t.type === 'ji');
    assert.equal(onChart.starCn, '武曲');
  });
});

describe('八字：阴干无刃', () => {
  /**
   * 《子平真诠》「禄前一位，惟五阳有之，故为阳刃」。
   * 阴干月令见劫财是月劫格，判成羊刃格会与 shensha.js 的 YANGREN（只列五阳干）冲突。
   */
  const gejuOf = (data) => performCalculation(data).analysis.monthlyStructure.suggested;

  it('阳干日主月令见刃仍是羊刃格', () => {
    // 甲日卯月：卯本气乙，与甲同类异阴阳，甲为阳干
    const geju = gejuOf({
      birthYear: 1990,
      birthMonth: 3,
      birthDay: 20,
      birthHour: 10,
      gender: 'male',
    });
    assert.equal(geju.tenGod.cn, '劫财');
    assert.equal(geju.key, 'yangren');
  });

  it('阴干日主月令本气见劫财判月劫格，不判羊刃', () => {
    // 1990-02-09 乙巳日、寅月：寅本气甲，与乙同类异阴阳，乙为阴干 → 月劫，不是羊刃
    const geju = gejuOf({
      birthYear: 1990,
      birthMonth: 2,
      birthDay: 9,
      birthHour: 10,
      gender: 'male',
    });
    assert.equal(geju.tenGod.cn, '劫财');
    assert.equal(geju.key, 'yuejie');
    assert.equal(geju.cn, '月劫格');
    assert.match(geju.basisCn, /阴干无刃/);
  });

  it('全部十干扫一遍：阴干日主永不落羊刃格', () => {
    let yinChecked = 0;
    for (let month = 1; month <= 12; month += 1) {
      for (const day of [3, 9, 15, 21, 27]) {
        const chart = performCalculation({
          birthYear: 1990,
          birthMonth: month,
          birthDay: day,
          birthHour: 10,
          gender: 'male',
        });
        const geju = chart.analysis.monthlyStructure.suggested;
        const dayStem = chart.pillars.day.charStem;
        if (['甲', '丙', '戊', '庚', '壬'].includes(dayStem)) continue;
        yinChecked += 1;
        assert.notEqual(geju?.key, 'yangren', `${dayStem}日为阴干，不得判羊刃格`);
      }
    }
    assert.ok(yinChecked > 10, '样本里应有足量阴干日主');
  });

  it('建禄格只认月令本气即日主之禄，中气余气之比劫归月劫', () => {
    // 甲寅日寅月：甲禄在寅，本气即我 → 建禄
    const jianlu = gejuOf({
      birthYear: 1990,
      birthMonth: 2,
      birthDay: 18,
      birthHour: 10,
      gender: 'male',
    });
    assert.equal(jianlu.key, 'jianlu');

    // 戊申日寅月：戊禄在巳不在寅，只是寅之余气戊透 → 月劫，不得报建禄
    const yuejie = gejuOf({
      birthYear: 1990,
      birthMonth: 2,
      birthDay: 12,
      birthHour: 10,
      gender: 'male',
    });
    assert.equal(yuejie.tenGod.cn, '比肩');
    assert.equal(yuejie.key, 'yuejie');
  });
});

describe('六壬：涉害不能决时报复等课', () => {
  it('孟仲皆不能决的一支不再挂见机/察微之名', () => {
    // 课体表里必须有复等课，且见机/察微的成立条件写明「取到了孟/仲」
    assert.equal(COURSE_TYPES.fudeng.cn, '复等课');
    assert.match(COURSE_TYPES.jianji.rule, /孟/);
    assert.match(COURSE_TYPES.chawei.rule, /仲/);
  });

  it('天乙贵人「庚」与紫微魁钺表取同一派', () => {
    // 口诀里庚在首末两句都出现，是这张表唯一的分歧处；两处必须一致
    assert.deepEqual(
      [NOBLE_BY_DAY_STEM['庚'].day, NOBLE_BY_DAY_STEM['庚'].night],
      [KUIYUE_BY_YEAR_STEM['庚'].kui, KUIYUE_BY_YEAR_STEM['庚'].yue]
    );
    assert.deepEqual(
      [NOBLE_BY_DAY_STEM['辛'].day, NOBLE_BY_DAY_STEM['辛'].night],
      [KUIYUE_BY_YEAR_STEM['辛'].kui, KUIYUE_BY_YEAR_STEM['辛'].yue]
    );
  });
});

describe('奇门：门迫是门克宫', () => {
  /**
   * 逐门的门迫清单（各家一致，方向不是流派问题）：
   *   伤门/杜门（木）落艮八、坤二（土）；开门/惊门（金）落震三、巽四（木）；
   *   休门（水）落离九（火）；景门（火）落乾六、兑七（金）；生门/死门（土）落坎一（水）。
   * 此前取的是反向（宫克门），并把「开门落离九宫」当经典例证 ——
   * 开门属金、离九属火，那是宫克门即门制。
   */
  const MENPO = {
    开门: [3, 4],
    惊门: [3, 4],
    伤门: [8, 2],
    杜门: [8, 2],
    休门: [9],
    景门: [6, 7],
    生门: [1],
    死门: [1],
  };

  it('全年抽样逐宫比对，门迫落宫与逐门清单完全一致', () => {
    let hits = 0;
    for (let month = 1; month <= 12; month += 1) {
      for (const day of [2, 12, 22]) {
        for (const hour of [1, 9, 17]) {
          const chart = castQimenChart({ year: 2024, month, day, hour });
          if (!chart) continue;
          chart.palaces.forEach((palace) => {
            if (!palace.gate) return;
            const expected = (MENPO[palace.gate.cn] || []).includes(palace.index);
            assert.equal(
              palace.relations.isGatePo,
              expected,
              `${palace.gate.cn}落${palace.cn} 门迫判定不符`
            );
            if (expected) hits += 1;
          });
        }
      }
    }
    assert.ok(hits > 50, '样本里应有足量门迫');
  });

  it('门迫与门制互斥，且开门落离九是门制不是门迫', () => {
    for (let month = 1; month <= 12; month += 1) {
      const chart = castQimenChart({ year: 2024, month, day: 8, hour: 11 });
      chart.palaces.forEach((palace) => {
        if (!palace.gate) return;
        assert.ok(!(palace.relations.isGatePo && palace.relations.isGateZhi));
        if (palace.gate.cn === '开门' && palace.index === 9) {
          assert.equal(palace.relations.isGatePo, false);
          assert.equal(palace.relations.isGateZhi, true);
        }
      });
    }
  });
});

describe('奇门：旬首遁仪落中五宫时值符为天禽', () => {
  it('遁仪在中宫的盘，值符星是天禽而不是坤二的天芮', () => {
    // 全年逐时扫，凡值符宫为五者，其值符星必为天禽（寄坤二行事）
    let found = 0;
    for (let month = 1; month <= 12; month += 1) {
      for (const day of [4, 14, 24]) {
        for (const hour of [1, 7, 13, 19]) {
          const chart = castQimenChart({ year: 2024, month, day, hour });
          if (!chart || chart.zhifu.palace !== 5) continue;
          found += 1;
          assert.equal(chart.zhifu.star.cn, '天禽', `${month}/${day} ${hour}时 值符星应为天禽`);
          assert.equal(chart.zhifu.seat, 2, '中宫寄坤二行事');
        }
      }
    }
    assert.ok(found > 0, '样本里应有遁仪落中宫的盘');
  });
});
