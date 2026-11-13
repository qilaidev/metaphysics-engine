import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import { app } from '../server.js';

describe('HTTP routes and controllers coverage', () => {
  it('GET /api/system/cache-status reports redis and baziCache status', async () => {
    const res = await request(app).get('/api/system/cache-status').expect(200);
    assert.ok(res.body.redis);
    assert.equal(typeof res.body.baziCache?.mirror, 'boolean');
  });

  it('GET /api/calendar/daily handles default, valid birth params, and invalid birth params', async () => {
    const plain = await request(app).get('/api/calendar/daily').expect(200);
    assert.ok(plain.body.dailyPillar);
    assert.ok(plain.body.fortune?.message);

    const withBirth = await request(app)
      .get('/api/calendar/daily?birthYear=1993&birthMonth=6&birthDay=18&birthHour=12&gender=male')
      .expect(200);
    assert.ok(withBirth.body.dailyPillar);
    assert.ok(withBirth.body.fortune);

    await request(app)
      .get('/api/calendar/daily?birthYear=1993&birthMonth=2&birthDay=30&birthHour=12&gender=male')
      .expect(400);
    await request(app)
      .get('/api/calendar/daily?birthYear=1993&birthMonth=6&birthDay=18&birthHour=25&gender=other')
      .expect(400);
  });

  it('POST /api/qimen/chart validates date/time bounds and returns chart', async () => {
    const def = await request(app).post('/api/qimen/chart').send({}).expect(200);
    assert.ok(def.body);

    const explicit = await request(app)
      .post('/api/qimen/chart')
      .send({ year: 2024, month: 6, day: 18, hour: 10, minute: 30 })
      .expect(200);
    assert.ok(explicit.body);

    await request(app)
      .post('/api/qimen/chart')
      .send({ year: 2024, month: 2, day: 30, hour: 10, minute: 0 })
      .expect(400);
    await request(app)
      .post('/api/qimen/chart')
      .send({ year: 0, month: 1, day: 1, hour: 24, minute: 60 })
      .expect(400);
  });

  it('POST /api/liuren/chart validates date/time bounds and returns chart', async () => {
    const def = await request(app).post('/api/liuren/chart').send({}).expect(200);
    assert.ok(def.body);

    const explicit = await request(app)
      .post('/api/liuren/chart')
      .send({ year: 2024, month: 6, day: 18, hour: 10, minute: 30 })
      .expect(200);
    assert.ok(explicit.body);

    await request(app)
      .post('/api/liuren/chart')
      .send({ year: 2024, month: 13, day: 1, hour: 10, minute: 0 })
      .expect(400);
    await request(app)
      .post('/api/liuren/chart')
      .send({ year: 2024, month: 6, day: 18, hour: -1, minute: -5 })
      .expect(400);
  });

  it('fengshui routes (/bazhai, /almanac, /name) validate inputs and compute results', async () => {
    await request(app).post('/api/fengshui/bazhai').send({}).expect(400);
    await request(app)
      .post('/api/fengshui/bazhai')
      .send({ birthYear: 1990, gender: 'invalid' })
      .expect(400);
    await request(app)
      .post('/api/fengshui/bazhai')
      .send({ birthYear: 1990, birthMonth: 5, gender: 'male' })
      .expect(400);
    await request(app)
      .post('/api/fengshui/bazhai')
      .send({ birthYear: 2024, birthMonth: 2, birthDay: 30, gender: 'male' })
      .expect(400);
    await request(app)
      .post('/api/fengshui/bazhai')
      .send({ birthYear: 1990, birthMonth: 5, birthDay: 15, birthHour: 25, gender: 'male' })
      .expect(400);
    await request(app)
      .post('/api/fengshui/bazhai')
      .send({
        birthYear: 1990,
        birthMonth: 5,
        birthDay: 15,
        birthHour: 8,
        birthMinute: 70,
        gender: 'male',
      })
      .expect(400);

    await request(app)
      .post('/api/fengshui/bazhai')
      .send({ birthYear: 1990, gender: 'female' })
      .expect(200);
    await request(app)
      .post('/api/fengshui/bazhai')
      .send({
        birthYear: 1990,
        birthMonth: 5,
        birthDay: 15,
        birthHour: 8,
        birthMinute: 30,
        gender: 'male',
        sitting: '北',
      })
      .expect(200);

    await request(app).get('/api/fengshui/almanac').expect(200);
    await request(app).get('/api/fengshui/almanac?year=2024&month=6&day=18').expect(200);
    await request(app).get('/api/fengshui/almanac?year=2024&month=2&day=30').expect(400);

    await request(app).post('/api/fengshui/name').send({}).expect(400);
    await request(app)
      .post('/api/fengshui/name')
      .send({ surnameStrokes: [0], givenNameStrokes: [8] })
      .expect(400);
    await request(app)
      .post('/api/fengshui/name')
      .send({ surnameStrokes: [], givenNameStrokes: [8] })
      .expect(400);
    await request(app)
      .post('/api/fengshui/name')
      .send({ surnameStrokes: [7], givenNameStrokes: [8, 10] })
      .expect(200);
  });

  it('tarot routes (/cards, /draw, /ai-interpret) cover validation and mock provider', async () => {
    const cardsRes = await request(app).get('/api/tarot/cards').expect(200);
    assert.ok(Array.isArray(cardsRes.body.cards));

    await request(app).post('/api/tarot/draw').send({}).expect(200);
    await request(app)
      .post('/api/tarot/draw')
      .send({ spreadType: 'ThreeCard', seed: 'fixed-seed' })
      .expect(200);
    await request(app).post('/api/tarot/draw').send({ seed: {} }).expect(400);
    await request(app)
      .post('/api/tarot/draw')
      .send({ seed: 'x'.repeat(201) })
      .expect(400);

    await request(app).post('/api/tarot/ai-interpret').send({ cards: [] }).expect(400);
    await request(app)
      .post('/api/tarot/ai-interpret')
      .send({
        provider: 'unknown-provider',
        cards: [
          {
            position: 1,
            name: 'The Fool',
            isReversed: false,
            meaningUp: 'beginnings',
            meaningRev: 'reckless',
          },
        ],
      })
      .expect(400);
    const aiRes = await request(app)
      .post('/api/tarot/ai-interpret')
      .send({
        provider: 'mock',
        spreadType: 'SingleCard',
        userQuestion: 'What next?',
        cards: [
          {
            position: 1,
            name: 'The Fool',
            isReversed: true,
            meaningUp: 'beginnings',
            meaningRev: 'reckless',
          },
        ],
      })
      .expect(200);
    assert.equal(typeof aiRes.body.content, 'string');
  });

  it('bazi routes (/calculate, /ai-interpret, /full-analysis) cover validation, cache, solar time, and mock AI', async () => {
    const emptyCalc = await request(app).post('/api/bazi/calculate').send({}).expect(400);
    assert.equal(emptyCalc.body.error, 'Invalid input');

    const wsGenderCalc = await request(app)
      .post('/api/bazi/calculate')
      .send({ birthYear: 1993, birthMonth: 6, birthDay: 18, birthHour: 12, gender: '   ' })
      .expect(400);
    assert.equal(wsGenderCalc.body.error, 'Invalid input');

    const wsLocCalc = await request(app)
      .post('/api/bazi/calculate')
      .send({
        birthYear: 1993,
        birthMonth: 6,
        birthDay: 18,
        birthHour: 12,
        gender: 'male',
        birthLocation: '   ',
      })
      .expect(400);
    assert.equal(wsLocCalc.body.error, 'Whitespace-only input');

    const validPayload = {
      birthYear: 1993,
      birthMonth: 6,
      birthDay: 18,
      birthHour: 12,
      birthMinute: 30,
      gender: 'male',
      timezone: 'Asia/Shanghai',
      birthLocation: 'Beijing',
    };
    const missRes = await request(app).post('/api/bazi/calculate').send(validPayload).expect(200);
    assert.ok(missRes.body.pillars);
    assert.equal(missRes.body.trueSolarTime?.applied, true);

    const hitRes = await request(app).post('/api/bazi/calculate').send(validPayload).expect(200);
    assert.equal(hitRes.headers['x-bazi-cache'], 'hit');

    await request(app)
      .post('/api/bazi/calculate')
      .send({
        birthYear: 1993,
        birthMonth: 6,
        birthDay: 18,
        birthHour: 12,
        gender: 'female',
        birthLocation: 'UnknownAtlantisCity',
      })
      .expect(200);

    await request(app).post('/api/bazi/ai-interpret').send({}).expect(400);
    await request(app)
      .post('/api/bazi/ai-interpret')
      .send({ pillars: missRes.body.pillars, provider: 'unknown-provider' })
      .expect(400);
    const baziAiRes = await request(app)
      .post('/api/bazi/ai-interpret')
      .send({
        provider: 'mock',
        pillars: missRes.body.pillars,
        fiveElements: missRes.body.fiveElements,
        tenGods: missRes.body.tenGods,
        luckCycles: missRes.body.luckCycles,
        strength: missRes.body.analysis?.strength,
      })
      .expect(200);
    assert.equal(typeof baziAiRes.body.content, 'string');

    await request(app).post('/api/bazi/full-analysis').send({}).expect(400);
    await request(app)
      .post('/api/bazi/full-analysis')
      .send({ birthYear: 1993, birthMonth: 6, birthDay: 18, birthHour: 12, gender: '   ' })
      .expect(400);
    await request(app)
      .post('/api/bazi/full-analysis')
      .send({
        birthYear: 1993,
        birthMonth: 6,
        birthDay: 18,
        birthHour: 12,
        gender: 'male',
        provider: 'unknown-provider',
      })
      .expect(400);
    const fullRes = await request(app)
      .post('/api/bazi/full-analysis')
      .send({
        birthYear: 1993,
        birthMonth: 6,
        birthDay: 18,
        birthHour: 12,
        gender: 'male',
        provider: 'mock',
      })
      .expect(200);
    assert.equal(typeof fullRes.body.interpretation, 'string');
    assert.ok(fullRes.body.calculation?.pillars);
  });

  it('iching routes (/hexagrams, /divine, /ai-interpret) cover number/time methods, validation, and mock AI', async () => {
    const hexRes = await request(app).get('/api/iching/hexagrams').expect(200);
    assert.ok(Array.isArray(hexRes.body.hexagrams));

    await request(app).post('/api/iching/divine').send({ method: 'bogus' }).expect(400);
    await request(app)
      .post('/api/iching/divine')
      .send({ method: 'number', numbers: [1, 2] })
      .expect(400);
    await request(app)
      .post('/api/iching/divine')
      .send({ method: 'number', numbers: [0, -1, 3] })
      .expect(400);

    const numRes = await request(app)
      .post('/api/iching/divine')
      .send({ method: 'number', numbers: [12, 25, 38] })
      .expect(200);
    assert.ok(numRes.body.hexagram);
    assert.ok(Array.isArray(numRes.body.detailedLines));

    const timeDefaultRes = await request(app)
      .post('/api/iching/divine')
      .send({ method: 'time' })
      .expect(200);
    assert.equal(timeDefaultRes.body.timeContext.provided, false);

    const timeExplicitRes = await request(app)
      .post('/api/iching/divine')
      .send({ method: 'time', year: 2024, month: 6, day: 18, hour: 10 })
      .expect(200);
    assert.equal(timeExplicitRes.body.timeContext.provided, true);

    await request(app)
      .post('/api/iching/divine')
      .send({ method: 'time', year: 2024, month: 2, day: 30, hour: 10 })
      .expect(400);

    await request(app).post('/api/iching/ai-interpret').send({}).expect(400);
    await request(app)
      .post('/api/iching/ai-interpret')
      .send({ hexagram: 'Qian', provider: 'mock' })
      .expect(200);
    await request(app)
      .post('/api/iching/ai-interpret')
      .send({
        hexagram: { name: 'Kun' },
        userQuestion: 'What next?',
        method: 'number',
        provider: 'mock',
      })
      .expect(200);
  });

  it('liuyao, synastry, and ziwei routes cover validation, edge hours, DST, and flowYear', async () => {
    await request(app).post('/api/liuyao/chart').send({}).expect(400);
    await request(app)
      .post('/api/liuyao/chart')
      .send({ lines: [1, 0, 1, 0, 1, 2] })
      .expect(400);
    await request(app)
      .post('/api/liuyao/chart')
      .send({ lines: [1, 0, 1, 0, 1, 0], changingLines: 'bad' })
      .expect(400);
    await request(app)
      .post('/api/liuyao/chart')
      .send({ lines: [1, 0, 1, 0, 1, 0], changingLines: [0, 7] })
      .expect(400);
    await request(app)
      .post('/api/liuyao/chart')
      .send({ lines: [1, 0, 1, 0, 1, 0], hour: 12.5 })
      .expect(400);
    await request(app)
      .post('/api/liuyao/chart')
      .send({ lines: [1, 0, 1, 0, 1, 0], year: 2024, month: 13, day: 1 })
      .expect(400);
    await request(app)
      .post('/api/liuyao/chart')
      .send({ lines: [1, 0, 1, 0, 1, 0], year: 2024, month: 2, day: 30 })
      .expect(400);
    await request(app)
      .post('/api/liuyao/chart')
      .send({ lines: [1, 0, 1, 0, 1, 0], year: 2024, month: 6, day: 18, hour: 25 })
      .expect(400);
    await request(app)
      .post('/api/liuyao/chart')
      .send({ lines: [1, 0, 1, 0, 1, 0] })
      .expect(200);
    await request(app)
      .post('/api/liuyao/chart')
      .send({
        lines: ['1', '0', '1', '0', '1', '0'],
        changingLines: [1, 6],
        year: 2024,
        month: 6,
        day: 18,
        hour: 23,
      })
      .expect(200);

    await request(app).post('/api/synastry/analyze').send({}).expect(400);
    await request(app)
      .post('/api/synastry/analyze')
      .send({
        personA: { birthYear: 1990, birthMonth: 5, birthDay: 15, birthHour: 8, gender: 'bad' },
        personB: {
          birthYear: 1992,
          birthMonth: 8,
          birthDay: 20,
          birthHour: 14,
          gender: 'female',
        },
      })
      .expect(400);
    const synRes = await request(app)
      .post('/api/synastry/analyze')
      .send({
        personA: {
          name: 'Alice',
          birthYear: 1990,
          birthMonth: 5,
          birthDay: 15,
          birthHour: 8,
          gender: 'female',
        },
        personB: { birthYear: 1992, birthMonth: 8, birthDay: 20, birthHour: 14, gender: 'male' },
      })
      .expect(200);
    assert.equal(synRes.body.personA.name, 'Alice');
    assert.equal(synRes.body.personB.name, 'Person B');

    await request(app).post('/api/ziwei/calculate').send({}).expect(400);
    await request(app)
      .post('/api/ziwei/calculate')
      .send({ birthYear: 1993, birthMonth: 6, birthDay: 18, birthHour: 12, gender: 'bad' })
      .expect(400);
    await request(app)
      .post('/api/ziwei/calculate')
      .send({ birthYear: 1993, birthMonth: 13, birthDay: 18, birthHour: 12, gender: 'male' })
      .expect(400);
    await request(app)
      .post('/api/ziwei/calculate')
      .send({ birthYear: 2024, birthMonth: 2, birthDay: 30, birthHour: 12, gender: 'male' })
      .expect(400);
    await request(app)
      .post('/api/ziwei/calculate')
      .send({
        birthYear: 1993,
        birthMonth: 6,
        birthDay: 18,
        birthHour: 12,
        gender: 'male',
        flowYear: 1990,
      })
      .expect(400);
    const zwRes = await request(app)
      .post('/api/ziwei/calculate')
      .send({
        birthYear: 1990,
        birthMonth: 6,
        birthDay: 18,
        birthHour: 12,
        gender: 'male',
        birthLocation: 'Beijing',
        flowYear: 2026,
      })
      .expect(200);
    assert.ok(zwRes.body.flowYear);
  });
});
