import { logger } from '../config/logger.js';
import express from 'express';
import { hexagrams } from '../data/ichingHexagrams.js';
import { withSchool } from '../constants/rulings.js';
import { isValidCalendarDate } from '../utils/validation.js';
import { generateAIContent } from '../services/ai.service.js';
import { createAiGuard, resolveClientKey } from '../lib/concurrency.js';
import {
  pickTrigram,
  buildHexagram,
  buildTimeDivinationNumbers,
  deriveChangingLinesFromNumbers,
  deriveChangingLinesFromTimeContext,
  deriveHexagramVariants,
  applyChangingLines,
  getDetailedLines,
} from '../services/iching.service.js';

const router = express.Router();
const aiGuard = createAiGuard();

const AI_CONCURRENCY_ERROR = 'AI request already in progress. Please wait.';

router.get('/hexagrams', (req, res) => {
  res.json({ hexagrams });
});

const METHODS = new Set(['number', 'time']);

router.post('/divine', (req, res) => {
  const { method = 'number', numbers } = req.body || {};
  // 只认两种起法：此前任意字符串都走数字分支并原样回显，调用方会以为引擎支持了那种起法
  if (!METHODS.has(method)) {
    return res.status(400).json({ error: 'method must be "number" or "time".' });
  }
  let inputNumbers = numbers;
  let timeContext = null;

  if (method === 'time') {
    const body = req.body || {};
    const now = new Date();
    // 可指定 year/month/day/hour 以复现；缺省才取服务器此刻
    const hasExplicit =
      body.year !== undefined ||
      body.month !== undefined ||
      body.day !== undefined ||
      body.hour !== undefined;
    const year = Number.isInteger(Number(body.year)) ? Number(body.year) : now.getFullYear();
    const month = Number.isInteger(Number(body.month)) ? Number(body.month) : now.getMonth() + 1;
    const day = Number.isInteger(Number(body.day)) ? Number(body.day) : now.getDate();
    const hour = Number.isInteger(Number(body.hour)) ? Number(body.hour) : now.getHours();
    if (
      year < 1 ||
      year > 9999 ||
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31 ||
      hour < 0 ||
      hour > 23 ||
      !isValidCalendarDate(year, month, day)
    ) {
      return res.status(400).json({ error: 'Invalid year/month/day/hour for time divination.' });
    }
    timeContext = {
      year,
      month,
      day,
      hour,
      minute: 0,
      provided: hasExplicit,
      iso: hasExplicit ? null : now.toISOString(),
    };

    // 梅花易数年月日时起例：年支数 + 农历月 + 农历日 定上卦，再加时支数定下卦。
    // 公历年份整数与分钟都不入卦 —— 那不是这个起法的输入。
    const timeNumbers = buildTimeDivinationNumbers(timeContext);
    if (!timeNumbers) {
      return res.status(400).json({ error: 'Unable to resolve lunar date for time divination.' });
    }
    inputNumbers = [timeNumbers.upperSum, timeNumbers.lowerSum, timeNumbers.lowerSum];
    timeContext.lunar = timeNumbers.lunar;
  } else if (!Array.isArray(numbers) || numbers.length !== 3) {
    return res.status(400).json({ error: 'Provide three numbers for number divination.' });
  }

  const parsedNumbers = inputNumbers.map((value) => Number(value));
  // 梅花起卦的数是正整数：负数与小数此前被各自猜（上下卦取绝对值、动爻按带符号之和），互相矛盾
  if (parsedNumbers.some((value) => !Number.isInteger(value) || value < 1)) {
    return res.status(400).json({ error: 'Numbers must be positive integers.' });
  }

  const upperTrigram = pickTrigram(parsedNumbers[0]);
  const lowerTrigram = pickTrigram(parsedNumbers[1]);
  let changingLines = [];
  if (method === 'time' && timeContext) {
    changingLines = deriveChangingLinesFromTimeContext(timeContext);
  } else {
    changingLines = deriveChangingLinesFromNumbers(parsedNumbers);
  }

  if (!upperTrigram || !lowerTrigram) {
    return res
      .status(400)
      .json({ error: 'Unable to compute a hexagram from the provided numbers.' });
  }

  const hexagram = buildHexagram(upperTrigram, lowerTrigram);
  /**
   * 之卦：动爻阴阳反转后的卦。梅花易数论事以本卦为体、之卦为用，
   * 少了它这一卦只断得出一半 —— 此前 applyChangingLines 写好了却没接上来。
   * 无动爻时为 null（梅花起卦恒有一个动爻，这一支只在动爻越界时才走到）。
   */
  const changedHexagram = changingLines.length ? applyChangingLines(hexagram, changingLines) : null;
  res.json(
    withSchool('iching', {
      hexagram,
      /** 逐爻的老少阴阳与该爻的《周易》爻辞。动爻那一句就是这一卦的主断。 */
      detailedLines: getDetailedLines(hexagram, changingLines),
      changedHexagram: changedHexagram && changedHexagram !== hexagram ? changedHexagram : null,
      // 互卦（中段）、错卦（反面）、综卦（对方所见）。纯位运算，断卦的基础参照
      variants: deriveHexagramVariants(hexagram),
      changingLines,
      timeContext,
      method,
    })
  );
});

router.post('/ai-interpret', async (req, res) => {
  const { hexagram, userQuestion, method, provider } = req.body;
  if (!hexagram) return res.status(400).json({ error: 'Hexagram data required' });

  const hexagramName = typeof hexagram === 'string' ? hexagram : hexagram?.name || 'Unknown';
  const system =
    'You are an I Ching interpreter. Provide a concise interpretation in Markdown with sections: Interpretation and Advice. Keep under 200 words.';
  const userPrompt = `
Question: ${userQuestion || 'General Guidance'}
Method: ${method || 'Unknown'}
Hexagram: ${hexagramName}
  `.trim();

  const fallback = () => {
    return 'The hexagram points to steady progress through mindful adaptation.';
  };

  const release = await aiGuard.acquire(resolveClientKey(req));
  if (!release) {
    return res.status(429).json({ error: AI_CONCURRENCY_ERROR });
  }

  try {
    const content = await generateAIContent({ system, user: userPrompt, fallback, provider });
    res.json({ content });
  } catch (error) {
    logger.error({ err: error, requestId: req.id }, 'I Ching AI interpretation failed');
    res.status(503).json({ error: 'AI interpretation is currently unavailable' });
  } finally {
    release();
  }
});

export default router;
