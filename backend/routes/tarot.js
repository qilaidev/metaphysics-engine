import { logger } from '../config/logger.js';
import express from 'express';
import { drawTarot, getTarotSpreadConfig } from '../services/tarot.service.js';
import tarotDeck from '../data/tarotData.js';
import { generateAIContent } from '../services/ai.service.js';
import { resolveAiProvider } from '../services/ai.service.js';
import { createAiGuard, resolveClientKey } from '../lib/concurrency.js';

const router = express.Router();
const aiGuard = createAiGuard();

const AI_CONCURRENCY_ERROR = 'AI request already in progress. Please wait.';

router.get('/cards', (req, res) => {
  res.json({ cards: tarotDeck });
});

/**
 * seed 上限 200 字符。它只被哈希成一个 32 位整数，再长也不会更"随机"，
 * 却会让公开接口白收任意长度的字符串。超长直接 400，不静默截断 ——
 * 截断会让两个不同的 seed 悄悄给出同一副牌。
 */
const MAX_SEED_LENGTH = 200;

router.post('/draw', async (req, res) => {
  const { spreadType = 'SingleCard', seed = null } = req.body || {};
  const normalizedSpread = spreadType || 'SingleCard';

  if (seed !== null && seed !== undefined && seed !== '') {
    if (typeof seed !== 'string' && !Number.isFinite(seed)) {
      return res.status(400).json({ error: 'seed must be a string or a finite number' });
    }
    if (String(seed).length > MAX_SEED_LENGTH) {
      return res.status(400).json({ error: `seed must be at most ${MAX_SEED_LENGTH} characters` });
    }
  }

  res.json(drawTarot({ spreadType: normalizedSpread, seed }));
});

router.post('/ai-interpret', async (req, res) => {
  const { spreadType, cards, userQuestion } = req.body;
  if (!cards || cards.length === 0) return res.status(400).json({ error: 'No cards provided' });

  let provider = null;
  try {
    provider = resolveAiProvider(req.body?.provider);
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Invalid AI provider.' });
  }

  const normalizedSpread = spreadType || 'SingleCard';
  const spreadConfig = getTarotSpreadConfig(normalizedSpread);
  const positions = spreadConfig.positions || [];
  const cardList = cards
    .map((card, index) => {
      const positionLabel = card.positionLabel || positions[index]?.label;
      const positionMeaning = card.positionMeaning || positions[index]?.meaning;
      const positionText = [
        positionLabel ? `${positionLabel}` : null,
        positionMeaning ? `${positionMeaning}` : null,
      ]
        .filter(Boolean)
        .join(' — ');
      return `${card.position}. ${positionText ? `${positionText} - ` : ''}${card.name} (${card.isReversed ? 'Reversed' : 'Upright'}) - ${card.isReversed ? card.meaningRev : card.meaningUp}`;
    })
    .join('\n');

  const system =
    'You are a tarot reader. Provide a concise reading in Markdown with sections: Interpretation and Advice. Use the position meanings for context. Keep under 220 words. Reference key cards by name.';
  const userPrompt = `
Spread: ${normalizedSpread || 'Unknown'}
Question: ${userQuestion || 'General Reading'}
Cards:
${cardList}
  `.trim();

  const fallback = () => {
    const interpretation =
      'The spread points to momentum building around your question, with key lessons emerging from the central cards.';
    const advice =
      'Reflect on the card themes and take one grounded action aligned with the most constructive card.';
    return `
## 🔮 Tarot Reading: ${normalizedSpread || 'Unknown'}
**Interpretation:** ${interpretation}

**Advice:** ${advice}
    `.trim();
  };

  const release = await aiGuard.acquire(resolveClientKey(req));
  if (!release) {
    return res.status(429).json({ error: AI_CONCURRENCY_ERROR });
  }

  try {
    const content = await generateAIContent({ system, user: userPrompt, fallback, provider });
    res.json({ content });
  } catch (error) {
    logger.error({ err: error, requestId: req.id, provider }, 'Tarot AI interpretation failed');
    res.status(503).json({ error: 'AI interpretation is currently unavailable' });
  } finally {
    release();
  }
});

export default router;
