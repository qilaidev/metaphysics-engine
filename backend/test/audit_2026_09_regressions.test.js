/**
 * 2026-09 算法审计的回归。每条都对应一处「排得出盘、结构完整、测试全绿，但盘是另一张」
 * 或「接口宣称了、实际没做」的缺陷；期望值来自典籍定则、公开例课或可独立手算的结果。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import { app } from '../server.js';
import { castLiurenChart } from '../services/liuren.service.js';
import { castQimenChart } from '../services/qimen.service.js';
import { buildNameGrids } from '../services/fengshui.service.js';
import { performCalculation } from '../services/calculations.service.js';
import { detectShensha } from '../services/bazi.service.js';
import { BAZHUAN_DAYS } from '../constants/liuren.js';
import { schoolPayload, ICHING_RULINGS, BAZI_RULINGS } from '../constants/rulings.js';
import { ZHOUYI_TEXT } from '../data/zhouyiText.js';

const tri = (chart) => {
  const t = chart.threeTransmissions;
  return `${t.initial.branch}${t.middle.branch}${t.last.branch}`;
};

describe('六壬：九宗门经典课例（第一课以日干判克之后才取得对）', () => {
  it('2020-01-23 卯时 乙丑日子将：乙木克丑土独一下贼上 → 重审课 丑戌未', () => {
    const c = castLiurenChart({ year: 2020, month: 1, day: 23, hour: 6 });
    assert.equal(c.dayGanzhi, '乙丑');
    assert.equal(c.threeTransmissions.courseType.key, 'zhongshen');
    assert.equal(tri(c), '丑戌未');
  });

  it('2020-03-11 巳时 癸丑日亥将返吟：未土克癸水为上克下 → 返吟有克 未丑未（非无亲课）', () => {
    const c = castLiurenChart({ year: 2020, month: 3, day: 11, hour: 10 });
    assert.equal(c.dayGanzhi, '癸丑');
    assert.equal(c.isFanyin, true);
    assert.equal(c.threeTransmissions.courseType.key, 'fanyinKe');
    assert.equal(tri(c), '未丑未');
  });

  it('2023-03-18 亥时 乙亥日伏吟：乙克辰为初传，辰自刑颠倒取支上神亥，亥自刑末传取冲 → 辰亥巳', () => {
    const c = castLiurenChart({ year: 2023, month: 3, day: 18, hour: 22 });
    assert.equal(c.dayGanzhi, '乙亥');
    assert.equal(c.isFuyin, true);
    assert.equal(c.threeTransmissions.courseType.key, 'fuyinKe');
    assert.equal(tri(c), '辰亥巳');
  });

  it('2023-03-16 亥时 癸酉日伏吟：丑克癸为初传，递取其刑 → 丑戌未', () => {
    const c = castLiurenChart({ year: 2023, month: 3, day: 16, hour: 22 });
    assert.equal(c.dayGanzhi, '癸酉');
    assert.equal(c.threeTransmissions.courseType.key, 'fuyinKe');
    assert.equal(tri(c), '丑戌未');
  });

  it('2025-02-14 丑时 甲寅日子将：一三课同上神视为一课，比用取与甲同阳之子 → 知一课 子亥戌', () => {
    const c = castLiurenChart({ year: 2025, month: 2, day: 14, hour: 2 });
    assert.equal(c.dayGanzhi, '甲寅');
    assert.equal(c.threeTransmissions.courseType.key, 'zhiyi');
    assert.equal(tri(c), '子亥戌');
  });

  it('涉害相等看所临地盘位：察微与复等两课在一年样本里都出现过', () => {
    const seen = new Set();
    for (let month = 1; month <= 12; month += 1) {
      for (let day = 1; day <= 28; day += 1) {
        for (let hour = 0; hour < 24; hour += 2) {
          seen.add(
            castLiurenChart({ year: 2024, month, day, hour }).threeTransmissions.courseType.key
          );
        }
      }
    }
    ['jianji', 'chawei', 'fudeng', 'fuyinKe', 'fanyinKe'].forEach((key) =>
      assert.ok(seen.has(key), `课体 ${key} 应可达`)
    );
  });

  it('八专日只有甲寅、丁未、己未、庚申、癸丑五日', () => {
    assert.deepEqual([...BAZHUAN_DAYS].sort(), ['丁未', '己未', '庚申', '癸丑', '甲寅'].sort());
  });
});

describe('奇门：月令随定局所用的节气走', () => {
  it('2024-02-04 17:00 已过立春 16:27：局属立春，月令寅（此前按 0 点取仍是丑）', () => {
    const c = castQimenChart({ year: 2024, month: 2, day: 4, hour: 17 });
    assert.equal(c.ju.jieqi, '立春');
    assert.equal(c.monthCommand.branch, '寅');
  });

  it('2023-01-05 23:00 小寒 23:04 未到：子初换日进位到 1/6，但局与月令仍属冬至子月', () => {
    const c = castQimenChart({ year: 2023, month: 1, day: 5, hour: 23 });
    assert.equal(c.ju.jieqi, '冬至');
    assert.equal(c.monthCommand.branch, '子');
  });
});

describe('八字：神煞补齐与起运小时', () => {
  it('天德月德按月支查，劫煞亡神按三合局查', () => {
    // 寅月：天德丁（干）、月德丙；年支子：劫煞巳、亡神亥
    const pillars = {
      year: { charStem: '丙', charBranch: '子' },
      month: { charStem: '丁', charBranch: '寅' },
      day: { charStem: '甲', charBranch: '巳' },
      hour: { charStem: '乙', charBranch: '亥' },
    };
    const found = detectShensha(pillars);
    const has = (key, where) => found.some((s) => s.key === key && s.position === where);
    assert.ok(has('tiande', 'month'), '天德丁透于月干');
    assert.ok(has('yuede', 'year'), '月德丙透于年干');
    assert.ok(has('jiesha', 'day'), '子年劫煞在巳（日支）');
    assert.ok(has('wangshen', 'hour'), '子年亡神在亥（时支）');
  });

  it('luckStart 带 hours，且 solarDate 已含小时进位', () => {
    const chart = performCalculation({
      birthYear: 1990,
      birthMonth: 5,
      birthDay: 20,
      birthHour: 14,
      birthMinute: 30,
      gender: 'female',
    });
    assert.ok(Number.isInteger(chart.luckStart.hours));
    assert.ok(chart.luckStart.hours >= 0 && chart.luckStart.hours < 24);
    assert.equal(BAZI_RULINGS.mingGongMonth.key, 'jieqi-month');
  });
});

describe('周易经文：底本讹字与扩展区字已归一', () => {
  it('第 33 卦名为遁，卦辞不带卦名前缀；无扩展区字与行内空格', () => {
    assert.equal(ZHOUYI_TEXT[33].name, '遁');
    assert.equal(ZHOUYI_TEXT[33].gua, '亨。小利贞。');
    assert.equal(ZHOUYI_TEXT[24].yao[0].text, '不复远，无祗悔，元吉。');
    const all = Object.values(ZHOUYI_TEXT)
      .flatMap((g) => [g.gua, g.daXiang, ...g.yao.map((y) => y.text)])
      .join('');
    assert.equal(/[\u{10000}-\u{10FFFF}]|[㐀-䶿]/u.test(all), false, '不得含扩展区字');
    assert.equal(/\s/.test(all), false, '不得含行内空白');
    Object.values(ZHOUYI_TEXT).forEach((g) => {
      assert.equal(g.gua.startsWith(`${g.name}：`), false, `${g.name} 卦辞不应以卦名前缀起头`);
    });
  });

  it('易经口径：三数起卦与换年界已声明', () => {
    assert.equal(ICHING_RULINGS.numberCast.key, 'first-upper-second-lower-sum-mod6');
    assert.ok(ICHING_RULINGS.timeCast.note.includes('正月初一'));
  });
});

describe('路由：不存在的日期与非法参数一律 400，不再静默顺延', () => {
  it('六爻：2 月 30 日与非整数 hour 拒绝；hour 参与月建与换日', async () => {
    const base = { lines: [1, 1, 1, 1, 1, 1] };
    assert.equal(
      (
        await request(app)
          .post('/api/liuyao/chart')
          .send({ ...base, year: 2024, month: 2, day: 30 })
      ).status,
      400
    );
    assert.equal(
      (
        await request(app)
          .post('/api/liuyao/chart')
          .send({ ...base, year: 2024, month: 5, day: 20, hour: 23.5 })
      ).status,
      400
    );
    const evening = await request(app)
      .post('/api/liuyao/chart')
      .send({ ...base, year: 2024, month: 2, day: 4, hour: 18 });
    assert.equal(evening.status, 200);
    assert.equal(evening.body.monthBranch, '寅', '立春 16:27 后月建已入寅');
    assert.equal(evening.body.school.shared.ziChu, 'zi-chu-day-change');
    const lateNight = await request(app)
      .post('/api/liuyao/chart')
      .send({ ...base, year: 2024, month: 5, day: 20, hour: 23 });
    assert.equal(lateNight.body.dayGanzhi, '乙酉', '23 点按子初换日');
  });

  it('紫微 / 六壬 / 奇门：2 月 30 日拒绝', async () => {
    const ziwei = await request(app).post('/api/ziwei/calculate').send({
      birthYear: 2023,
      birthMonth: 2,
      birthDay: 30,
      birthHour: 10,
      gender: 'male',
    });
    assert.equal(ziwei.status, 400);
    const liuren = await request(app)
      .post('/api/liuren/chart')
      .send({ year: 2024, month: 2, day: 30, hour: 10 });
    assert.equal(liuren.status, 400);
    const qimen = await request(app)
      .post('/api/qimen/chart')
      .send({ year: 2024, month: 4, day: 31, hour: 10 });
    assert.equal(qimen.status, 400);
  });

  it('择吉 / 八宅：假日期拒绝，真日期照常', async () => {
    assert.equal(
      (await request(app).get('/api/fengshui/almanac?year=2024&month=2&day=30')).status,
      400
    );
    assert.equal(
      (await request(app).get('/api/fengshui/almanac?year=2024&month=2&day=29')).status,
      200
    );
    const bazhai = await request(app)
      .post('/api/fengshui/bazhai')
      .send({ birthYear: 2024, birthMonth: 13, birthDay: 40, gender: 'male' });
    assert.equal(bazhai.status, 400);
    const onlyMonth = await request(app)
      .post('/api/fengshui/bazhai')
      .send({ birthYear: 2024, birthMonth: 2, gender: 'male' });
    assert.equal(onlyMonth.status, 400, '月日必须同时给');
  });

  it('紫微：给了出生地与时区，响应带 chartTime 且时辰按真太阳时', async () => {
    const res = await request(app).post('/api/ziwei/calculate').send({
      birthYear: 1990,
      birthMonth: 5,
      birthDay: 12,
      birthHour: 10,
      gender: 'male',
      birthLocation: '43.8,87.6',
      timezone: 'Asia/Shanghai',
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.chartTime.trueSolarTime.applied, true);
    assert.ok(res.body.chartTime.used.hour < 9);
  });

  it('易经：未知 method 与非正整数拒绝', async () => {
    assert.equal(
      (
        await request(app)
          .post('/api/iching/divine')
          .send({ method: 'coin', numbers: [1, 2, 3] })
      ).status,
      400
    );
    assert.equal(
      (
        await request(app)
          .post('/api/iching/divine')
          .send({ numbers: [-7, 1, 1] })
      ).status,
      400
    );
    assert.equal(
      (
        await request(app)
          .post('/api/iching/divine')
          .send({ numbers: [7, 8, 9] })
      ).status,
      200
    );
  });

  it('姓名五格：服务层拒绝 0 与负数笔画', () => {
    assert.equal(buildNameGrids([0], [8]), null);
    assert.equal(buildNameGrids([-4], [8]), null);
    assert.ok(buildNameGrids([7], [8]));
  });

  it('择吉 school 不再宣称交节到分；六爻 school 挂子初换日', () => {
    assert.equal(schoolPayload('almanac').shared, undefined);
    assert.equal(schoolPayload('liuyao').shared.ziChu, 'zi-chu-day-change');
    assert.equal(schoolPayload('liuyao').shared.lateZi, undefined);
  });
});
