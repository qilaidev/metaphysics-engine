import test from 'node:test';
import assert from 'node:assert/strict';
import tarotDeck from '../data/tarotData.js';
import {
  drawTarot,
  getTarotSpreadConfig,
  resolveTarotSpread,
  TAROT_SPREADS,
} from '../services/tarot.service.js';

const makeRng = (values, fallback = 0.99) => {
  let index = 0;
  return () => (index < values.length ? values[index++] : fallback);
};

test('getTarotSpreadConfig falls back to SingleCard', () => {
  assert.strictEqual(getTarotSpreadConfig(), TAROT_SPREADS.SingleCard);
  assert.strictEqual(getTarotSpreadConfig('NotARealSpread'), TAROT_SPREADS.SingleCard);
  assert.strictEqual(getTarotSpreadConfig('ThreeCard'), TAROT_SPREADS.ThreeCard);
});

test('resolveTarotSpread 识别别名且未知阵标 fallback', () => {
  assert.equal(resolveTarotSpread('three').key, 'ThreeCard');
  assert.equal(resolveTarotSpread('three').alias, true);
  assert.equal(resolveTarotSpread('ThreeCard').fallback, false);
  assert.equal(resolveTarotSpread('celtic').key, 'CelticCross');
  const unknown = resolveTarotSpread('NotARealSpread');
  assert.equal(unknown.key, 'SingleCard');
  assert.equal(unknown.fallback, true);
});

test('drawTarot 别名 three 抽三张，且 school 标明 tarot', () => {
  const result = drawTarot({ spreadType: 'three', rng: () => 0.99 });
  assert.equal(result.spreadType, 'ThreeCard');
  assert.equal(result.spreadRequested, 'three');
  assert.equal(result.cards.length, 3);
  assert.equal(result.school?.module, 'tarot');
  assert.equal(result.spreadFallback, false);
});

test('drawTarot returns three cards with correct position metadata', () => {
  const result = drawTarot({ spreadType: 'ThreeCard', rng: () => 0.99 });

  assert.equal(result.spreadType, 'ThreeCard');
  assert.equal(result.cards.length, 3);

  result.cards.forEach((card, index) => {
    const config = TAROT_SPREADS.ThreeCard.positions[index];
    assert.equal(card.position, index + 1);
    assert.equal(card.positionLabel, config.label);
    assert.equal(card.positionLabelCn, config.labelCn);
    assert.equal(card.positionMeaning, config.meaning);
    assert.equal(card.positionMeaningCn, config.meaningCn);
    assert.equal(card.isReversed, false);
  });

  assert.deepEqual(
    result.spreadMeta.positions,
    TAROT_SPREADS.ThreeCard.positions.map((position, index) => ({
      position: index + 1,
      label: position.label,
      labelCn: position.labelCn,
      meaning: position.meaning,
      meaningCn: position.meaningCn,
    }))
  );
});

test('每张牌都带大小阿卡纳、花色、序位；78 张的结构性字段自洽', () => {
  const bySuit = { Wands: 0, Cups: 0, Swords: 0, Pentacles: 0 };
  let major = 0;
  let court = 0;
  tarotDeck.forEach((card) => {
    if (card.arcana === 'Major') {
      major += 1;
      assert.equal(card.number, card.id, '大阿卡纳的序号即 id');
      assert.equal(card.suit, null);
      assert.equal(card.isCourt, false);
      return;
    }
    assert.equal(card.arcana, 'Minor');
    assert.ok(bySuit[card.suit] !== undefined, `未知花色 ${card.suit}`);
    bySuit[card.suit] += 1;
    assert.ok(card.number >= 1 && card.number <= 14, `${card.name} 序位越界`);
    assert.ok(card.element, `${card.name} 缺花色元素`);
    if (card.isCourt) court += 1;
  });
  assert.equal(major, 22, '大阿卡纳应为 22 张');
  assert.deepEqual(bySuit, { Wands: 14, Cups: 14, Swords: 14, Pentacles: 14 });
  assert.equal(court, 16, '宫廷牌应为 16 张');
});

test('命运之轮是大阿卡纳，不因牌名形似「X of Y」被判成小牌', () => {
  const wheel = tarotDeck.find((card) => card.name === 'Wheel of Fortune');
  assert.equal(wheel.arcana, 'Major');
  assert.equal(wheel.suit, null);
});

test('花色元素按韦特系对应火水风土', () => {
  const elementOf = (name) => tarotDeck.find((card) => card.name === name).element;
  assert.equal(elementOf('Ace of Wands'), 'Fire');
  assert.equal(elementOf('Ace of Cups'), 'Water');
  assert.equal(elementOf('Ace of Swords'), 'Air');
  assert.equal(elementOf('Ace of Pentacles'), 'Earth');
});

test('drawTarot does not repeat cards in Celtic Cross', () => {
  const result = drawTarot({ spreadType: 'CelticCross', rng: () => 0.99 });

  assert.equal(result.cards.length, 10);

  const ids = new Set(result.cards.map((card) => card.id));
  assert.equal(ids.size, result.cards.length);
});

test('drawTarot uses reversal threshold', () => {
  const shuffleCalls = Math.max(0, tarotDeck.length - 1);
  const values = new Array(shuffleCalls).fill(0.99).concat([0.0]);
  const rng = makeRng(values, 0.99);

  const result = drawTarot({ spreadType: 'SingleCard', rng });

  assert.equal(result.cards.length, 1);
  assert.equal(result.cards[0].isReversed, true);
});
