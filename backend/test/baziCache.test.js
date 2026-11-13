import test from 'node:test';
import assert from 'node:assert/strict';
import * as cache from '../services/cache.service.js';

const withEnv = async (envOverrides = {}, run) => {
  const priorEnv = {};
  for (const [key, next] of Object.entries(envOverrides)) {
    priorEnv[key] = Object.prototype.hasOwnProperty.call(process.env, key)
      ? process.env[key]
      : undefined;
    if (next === null || next === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = String(next);
    }
  }

  try {
    return await run();
  } finally {
    for (const [key, prior] of Object.entries(priorEnv)) {
      if (prior === undefined) delete process.env[key];
      else process.env[key] = prior;
    }
  }
};

const buildPayload = (overrides = {}) => ({
  birthYear: 1984,
  birthMonth: 5,
  birthDay: 20,
  birthHour: 14,
  gender: 'female',
  ...overrides,
});

const buildResult = (overrides = {}) => ({
  pillars: { year: 'a', month: 'b', day: 'c', hour: 'd' },
  fiveElements: { Wood: 1, Fire: 1, Earth: 2, Metal: 0, Water: 0 },
  ...overrides,
});

test('buildBaziCacheKey normalizes and rejects invalid input', async () => {
  assert.equal(
    cache.buildBaziCacheKey(buildPayload({ birthYear: '2001.9', gender: '  Male ' })),
    '2001-5-20-14-male'
  );

  assert.equal(cache.buildBaziCacheKey(buildPayload({ gender: '   ' })), null);
  assert.equal(cache.buildBaziCacheKey(buildPayload({ birthDay: null })), null);
  assert.equal(cache.buildBaziCacheKey(null), null);
});

test('set/get returns normalized fiveElementsPercent', async () => {
  await withEnv({ BAZI_CACHE_TTL_MS: '1000', BAZI_CACHE_MAX_ENTRIES: '10' }, async () => {
    cache.setBaziCacheMirror(null);
    cache.clearBaziCalculationCache();

    const key = cache.buildBaziCacheKey(buildPayload());
    cache.setBaziCacheEntry(key, buildResult());

    const cached = cache.getCachedBaziCalculation(key);
    assert.ok(cached);
    assert.deepEqual(cached.fiveElementsPercent, {
      Wood: 25,
      Fire: 25,
      Earth: 50,
      Metal: 0,
      Water: 0,
    });
  });
});

test('entries expire based on TTL', async () => {
  await withEnv({ BAZI_CACHE_TTL_MS: '10', BAZI_CACHE_MAX_ENTRIES: '10' }, async () => {
    cache.setBaziCacheMirror(null);
    cache.clearBaziCalculationCache();
    const key = cache.buildBaziCacheKey(buildPayload());

    const originalNow = Date.now;
    try {
      Date.now = () => 1000;
      cache.setBaziCacheEntry(key, buildResult());

      Date.now = () => 1011;
      assert.equal(cache.getCachedBaziCalculation(key), null);
    } finally {
      Date.now = originalNow;
    }
  });
});

test('LRU eviction removes oldest entry', async () => {
  await withEnv({ BAZI_CACHE_TTL_MS: '1000', BAZI_CACHE_MAX_ENTRIES: '2' }, async () => {
    cache.setBaziCacheMirror(null);
    cache.clearBaziCalculationCache();

    const keyA = cache.buildBaziCacheKey(buildPayload({ birthDay: 1 }));
    const keyB = cache.buildBaziCacheKey(buildPayload({ birthDay: 2 }));
    const keyC = cache.buildBaziCacheKey(buildPayload({ birthDay: 3 }));

    cache.setBaziCacheEntry(keyA, buildResult({ pillars: { year: 'A' } }));
    cache.setBaziCacheEntry(keyB, buildResult({ pillars: { year: 'B' } }));

    assert.ok(cache.getCachedBaziCalculation(keyA));

    cache.setBaziCacheEntry(keyC, buildResult({ pillars: { year: 'C' } }));

    assert.equal(cache.getCachedBaziCalculation(keyB), null);
    assert.ok(cache.getCachedBaziCalculation(keyA));
    assert.ok(cache.getCachedBaziCalculation(keyC));
  });
});

test('invalidateBaziCalculationCache clears entries by key or payload', async () => {
  await withEnv({ BAZI_CACHE_TTL_MS: '1000', BAZI_CACHE_MAX_ENTRIES: '10' }, async () => {
    cache.setBaziCacheMirror(null);
    cache.clearBaziCalculationCache();

    const payload = buildPayload();
    const key = cache.buildBaziCacheKey(payload);
    cache.setBaziCacheEntry(key, buildResult());

    cache.invalidateBaziCalculationCache(payload);
    assert.equal(cache.getCachedBaziCalculation(key), null);

    cache.setBaziCacheEntry(key, buildResult());
    cache.invalidateBaziCalculationCache(key);
    assert.equal(cache.getCachedBaziCalculation(key), null);
  });
});

/**
 * 缓存陈旧检测。
 *
 * 这两条守的是升级路径，不是当下的正确性：旧缓存里那份 analysis 出自上一版引擎，
 * 字段比现在少。只判「有没有 analysis」时它会被原样发出去 —— 从格盘的旧缓存里
 * 存着的正是方向相反的那份 usefulGod，不重算就一直发到 TTL 过期。
 */
test('ANALYSIS_FIELDS 必须与 analyzeChart 的真实返回逐键一致', async () => {
  const { ANALYSIS_FIELDS } = await import('../services/calculations.service.js');
  const { analyzeChart } = await import('../services/bazi.service.js');

  const analysis = analyzeChart({
    year: { charStem: '庚', charBranch: '午' },
    month: { charStem: '辛', charBranch: '巳' },
    day: { charStem: '乙', charBranch: '酉' },
    hour: { charStem: '癸', charBranch: '未' },
  });

  assert.deepEqual(
    [...ANALYSIS_FIELDS].sort(),
    Object.keys(analysis).sort(),
    'analyzeChart 加了字段却没同步到 ANALYSIS_FIELDS —— 旧缓存会继续发上一版的结论'
  );
});

test('缺字段的旧缓存会被重算，而不是原样发出', async () => {
  const { getBaziCalculation } = await import('../services/calculations.service.js');

  await withEnv({ BAZI_CACHE_TTL_MS: '60000', BAZI_CACHE_MAX_ENTRIES: '10' }, async () => {
    cache.setBaziCacheMirror(null);
    cache.clearBaziCalculationCache();

    // 先算一张真盘，再把它退化成「上一版引擎」的样子塞回缓存
    const payload = { birthYear: 1978, birthMonth: 7, birthDay: 20, birthHour: 4, gender: 'male' };
    const fresh = await getBaziCalculation(payload, { bypassCache: true });
    assert.ok(fresh.analysis.specialPattern, '这张盘本来应当判出从格');

    const legacy = JSON.parse(JSON.stringify(fresh));
    delete legacy.analysis.specialPattern;
    legacy.analysis.usefulGod = { method: 'support', methodCn: '上一版的错误结论' };
    cache.setBaziCacheEntry(cache.buildBaziCacheKey(payload), legacy);

    const served = await getBaziCalculation(payload);
    assert.ok(served.analysis.specialPattern, '缺字段的缓存应被重算');
    assert.equal(served.analysis.usefulGod.method, 'follow', '不得把上一版的错误结论发出去');
  });
});
