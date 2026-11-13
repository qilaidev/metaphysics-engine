import { logger } from '../config/logger.js';
import express from 'express';

import { buildBirthTimeMeta } from '../utils/timezone.js';
import { normalizeGender, isValidCalendarDate } from '../utils/validation.js';
import { calculateZiweiChart, calculateFlowYear } from '../services/ziwei.service.js';
import { resolveChartTime } from '../services/calculations.service.js';

const router = express.Router();

const parseZiweiPayload = (body) => {
  const { birthYear, birthMonth, birthDay, birthHour, gender } = body || {};
  if (!birthYear || !birthMonth || !birthDay || birthHour === undefined || !gender) {
    return { ok: false, error: 'Missing required fields' };
  }

  const year = Number(birthYear);
  const month = Number(birthMonth);
  const day = Number(birthDay);
  const hour = Number(birthHour);
  const normalizedGender = normalizeGender(gender);

  if (
    !Number.isInteger(year) ||
    year < 1 ||
    year > 9999 ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12 ||
    !Number.isInteger(day) ||
    day < 1 ||
    day > 31 ||
    !Number.isInteger(hour) ||
    hour < 0 ||
    hour > 23 ||
    !normalizedGender
  ) {
    return {
      ok: false,
      error: !normalizedGender ? 'gender must be male or female' : 'Missing required fields',
    };
  }
  // 2 月 30 日这类不存在的日期此前会被 lunar-javascript 顺延成下月的盘且不报错
  if (!isValidCalendarDate(year, month, day)) {
    return { ok: false, error: 'Birth date does not exist' };
  }

  // 可选 flowYear：给了就附上该年的流年盘（流年命宫、流年四化、小限、所值大限）
  let flowYear = null;
  if (body.flowYear !== undefined && body.flowYear !== null && body.flowYear !== '') {
    const fy = Number(body.flowYear);
    if (!Number.isInteger(fy) || fy < year || fy > 9999) {
      return { ok: false, error: 'flowYear must be an integer year not earlier than birthYear' };
    }
    flowYear = fy;
  }

  return {
    ok: true,
    payload: {
      ...body,
      birthYear: year,
      birthMonth: month,
      birthDay: day,
      birthHour: hour,
      gender: normalizedGender,
    },
    flowYear,
  };
};

router.post('/calculate', (req, res) => {
  const parsed = parseZiweiPayload(req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });

  try {
    /**
     * 与八字同一套时刻解析：给了出生地与时区就按真太阳时排，中国地点缺时区默认北京时间，
     * 1986–1991 夏令时墙钟先归一。紫微不看节气，年月日时一律取**当地（已校正）时刻**，
     * 即 chartTime.used —— 此前 rulings 给紫微挂着 trueSolarTimeDefault 却从未校正，
     * 传了出生地的盘时辰照旧，与八字那边同一生辰两个时柱。
     */
    const chartTime = resolveChartTime(parsed.payload);
    const result = calculateZiweiChart({
      ...parsed.payload,
      birthYear: chartTime.year,
      birthMonth: chartTime.month,
      birthDay: chartTime.day,
      birthHour: chartTime.hour,
    });
    const timeMeta = buildBirthTimeMeta(parsed.payload);
    // 流年小限此前只在服务层有、没有任何入口；文档却当成已交付能力
    const flowYear = parsed.flowYear === null ? null : calculateFlowYear(result, parsed.flowYear);
    return res.json({
      ...result,
      flowYear,
      chartTime: {
        used: {
          year: chartTime.year,
          month: chartTime.month,
          day: chartTime.day,
          hour: chartTime.hour,
          minute: chartTime.minute,
        },
        dstNormalized: chartTime.dstNormalized || null,
        trueSolarTime: chartTime.trueSolarTime,
        locationResolution: chartTime.locationResolution,
      },
      ...timeMeta,
    });
  } catch (error) {
    logger.error({ err: error, requestId: req.id }, 'Ziwei calculation failed');
    return res.status(500).json({ error: 'Calculation error' });
  }
});

export default router;
