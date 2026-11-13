/**
 * 逐宫 / 逐项写死的金标准命例。期望值都能独立手算（安星口诀、三天折一年），
 * 与引擎无关；引擎哪一步改错，这里就红在那一项上。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import { app } from '../server.js';
import { calculateZiweiChart, calculateFlowYear } from '../services/ziwei.service.js';
import { performCalculation } from '../services/calculations.service.js';
import { isValidCalendarDate } from '../utils/validation.js';

describe('紫微金标准：甲子年正月初一子时男命（1984-02-02 00:00）', () => {
  const chart = calculateZiweiChart({
    birthYear: 1984,
    birthMonth: 2,
    birthDay: 2,
    birthHour: 0,
    gender: 'male',
  });
  const branchOf = (key) => {
    for (const palace of chart.palaces) {
      for (const group of ['major', 'minor', 'malefic', 'minorB']) {
        if (palace.stars[group].some((star) => star.key === key)) return palace.branch.key;
      }
    }
    return null;
  };

  it('农历、五行局、命身宫', () => {
    assert.deepEqual(
      [
        chart.lunar.year,
        chart.lunar.month,
        chart.lunar.day,
        chart.lunar.yearStem + chart.lunar.yearBranch,
      ],
      [1984, 1, 1, '甲子']
    );
    assert.equal(chart.lunar.monthBranchUsed, '寅');
    assert.equal(chart.fiveElementBureau.cn, '火六局', '甲年寅宫丙寅，炉中火');
    assert.equal(chart.mingPalace.branch.key, '寅');
    assert.equal(chart.shenPalace.branch.key, '寅');
  });

  it('十四主星与六吉六煞逐颗落宫', () => {
    const expected = {
      ziwei: '酉', // 火六局初一：寅逆五位
      tianfu: '未', // 寅申轴镜像
      wenchang: '戌',
      wenqu: '辰',
      zuofu: '辰',
      youbi: '戌',
      tiankui: '丑',
      tianyue: '未',
      lucun: '寅',
      qingyang: '卯',
      tuoluo: '丑',
      tianma: '寅',
      huoxing: '寅',
      lingxing: '戌',
      dikong: '亥',
      dijie: '亥',
    };
    Object.entries(expected).forEach(([key, branch]) => {
      assert.equal(branchOf(key), branch, `${key} 应在 ${branch}`);
    });
  });

  it('二十颗乙级星逐颗落宫', () => {
    const expected = {
      hongluan: '卯',
      tianxi: '酉',
      tianxing: '酉',
      tianyao: '丑',
      tianku: '午',
      tianxu: '午',
      taifu: '午',
      fenggao: '寅',
      longchi: '辰',
      fengge: '戌',
      jieshen: '戌',
      santai: '辰',
      bazuo: '戌',
      enguang: '酉',
      tiangui: '卯',
      tianwu: '巳',
      yinsha: '寅',
      posui: '巳',
      guchen: '寅',
      guasu: '戌',
    };
    Object.entries(expected).forEach(([key, branch]) => {
      assert.equal(branchOf(key), branch, `${key} 应在 ${branch}`);
    });
  });

  it('大限阳男顺行自 6 岁起；2026 流年丙午落午宫、小限辰、所值大限巳', () => {
    assert.deepEqual(
      chart.majorPeriods.slice(0, 3).map((p) => `${p.branch}${p.startAge}`),
      ['寅6', '卯16', '辰26']
    );
    const flow = calculateFlowYear(chart, 2026);
    assert.equal(flow.age, 43);
    assert.equal(flow.ganzhi, '丙午');
    assert.equal(flow.branch, '午');
    assert.equal(flow.minorPeriodBranch, '辰', '子年男自戌顺行 42 步');
    assert.equal(flow.majorPeriod.branch, '巳');
  });

  it('路由：给 flowYear 即附流年盘，非法 flowYear 拒绝', async () => {
    const base = { birthYear: 1984, birthMonth: 2, birthDay: 2, birthHour: 0, gender: 'male' };
    const ok = await request(app)
      .post('/api/ziwei/calculate')
      .send({ ...base, flowYear: 2026 });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.flowYear.branch, '午');
    const none = await request(app).post('/api/ziwei/calculate').send(base);
    assert.equal(none.body.flowYear, null);
    const bad = await request(app)
      .post('/api/ziwei/calculate')
      .send({ ...base, flowYear: 1900 });
    assert.equal(bad.status, 400);
  });
});

describe('八字起运金标准（三天折一年，按分钟折算）', () => {
  const cases = [
    {
      label: '1990-05-20T14:30 男：庚午阳年顺行至芒种 06-06 06:46',
      input: {
        birthYear: 1990,
        birthMonth: 5,
        birthDay: 20,
        birthHour: 14,
        birthMinute: 30,
        gender: 'male',
      },
      start: { years: 5, months: 6, days: 21 },
      first: '壬午',
    },
    {
      label: '1990-05-20T14:30 女：阳年逆行至立夏 05-06 02:35',
      input: {
        birthYear: 1990,
        birthMonth: 5,
        birthDay: 20,
        birthHour: 14,
        birthMinute: 30,
        gender: 'female',
      },
      start: { years: 4, months: 9, days: 29 },
      first: '庚辰',
    },
    {
      label: '2000-01-01T12:00 男：己卯阴年逆行至大雪',
      input: {
        birthYear: 2000,
        birthMonth: 1,
        birthDay: 1,
        birthHour: 12,
        birthMinute: 0,
        gender: 'male',
      },
      start: { years: 8, months: 2, days: 11 },
      first: '乙亥',
    },
  ];
  cases.forEach(({ label, input, start, first }) => {
    it(label, () => {
      const chart = performCalculation(input);
      assert.equal(chart.luckStart.years, start.years);
      assert.equal(chart.luckStart.months, start.months);
      assert.equal(chart.luckStart.days, start.days);
      assert.equal(chart.luckCycles[0].ganZhi, first);
    });
  });
});

describe('日期校验：儒略历缺口', () => {
  it('1582-10-05～14 不存在，路由 400 而不是引擎内部错', async () => {
    assert.equal(isValidCalendarDate(1582, 10, 10), false);
    assert.equal(isValidCalendarDate(1582, 10, 4), true);
    assert.equal(isValidCalendarDate(1582, 10, 15), true);
    const res = await request(app).post('/api/bazi/calculate').send({
      birthYear: 1582,
      birthMonth: 10,
      birthDay: 10,
      birthHour: 12,
      gender: 'male',
    });
    assert.equal(res.status, 400);
  });
});
