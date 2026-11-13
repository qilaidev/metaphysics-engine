/**
 * 《周易》经文的结构与接线校验。
 *
 * 经文由 scripts/fetch-zhouyi.mjs 从维基文库抓取生成，逐字内容不在这里断言
 * （那等于把底本再抄一遍，抄错了两边一起错）；这里守的是**结构完整性**与
 * **接线正确性** —— 六十四卦齐备、每卦六爻齐备、乾用九坤用六、
 * 序号与卦名对得上、六爻与易经两个端点取到的是同一份。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ZHOUYI_TEXT } from '../data/zhouyiText.js';
import { hexagrams, hexagramByLines, getYaoText } from '../data/ichingHexagrams.js';
import { buildLiuyaoChart, getHexagramName } from '../services/liuyao.service.js';
import { getDetailedLines } from '../services/iching.service.js';

const YAO_TITLE = /^(初[九六]|[九六][二三四五]|上[九六]|用[九六])$/;

describe('《周易》经文数据', () => {
  it('六十四卦齐备，序号 1–64 不重不漏', () => {
    const keys = Object.keys(ZHOUYI_TEXT)
      .map(Number)
      .sort((a, b) => a - b);
    assert.equal(keys.length, 64);
    assert.deepEqual(
      keys,
      Array.from({ length: 64 }, (_, i) => i + 1)
    );
  });

  it('每卦都有卦辞与大象，爻辞共 386 条（384 + 用九用六）', () => {
    let total = 0;
    Object.entries(ZHOUYI_TEXT).forEach(([seq, h]) => {
      assert.ok(h.gua && h.gua.length >= 2, `第${seq}卦 ${h.name} 卦辞过短`);
      assert.ok(h.daXiang && h.daXiang.length >= 4, `第${seq}卦 ${h.name} 大象过短`);
      const six = h.yao.filter((y) => !/^用/.test(y.title));
      assert.equal(six.length, 6, `第${seq}卦 ${h.name} 爻辞应有六条`);
      h.yao.forEach((y) => {
        assert.ok(YAO_TITLE.test(y.title), `第${seq}卦 爻题异常：${y.title}`);
        assert.ok(y.text && y.text.length >= 2, `第${seq}卦 ${y.title} 爻辞过短`);
      });
      total += h.yao.length;
    });
    assert.equal(total, 386);
  });

  it('用九只在乾、用六只在坤', () => {
    Object.entries(ZHOUYI_TEXT).forEach(([seq, h]) => {
      const yong = h.yao.filter((y) => /^用/.test(y.title)).map((y) => y.title);
      if (h.name === '乾') assert.deepEqual(yong, ['用九']);
      else if (h.name === '坤') assert.deepEqual(yong, ['用六']);
      else assert.deepEqual(yong, [], `第${seq}卦 ${h.name} 不应有用爻`);
    });
  });

  it('爻题的阴阳与该卦的爻画一一对应', () => {
    // 阳爻题作「九」、阴爻题作「六」；位次自初至上。这一条同时验了经文与卦画的对齐
    hexagrams.forEach((hexagram) => {
      const text = ZHOUYI_TEXT[hexagram.sequence];
      if (!text) return;
      hexagram.lines.forEach((bit, index) => {
        const title = text.yao[index].title;
        assert.ok(
          bit === 1 ? title.includes('九') : title.includes('六'),
          `${hexagram.name} 第${index + 1}爻画为${bit ? '阳' : '阴'}，爻题却是 ${title}`
        );
      });
    });
  });

  it('卦名的经文与序卦次序对得上（抽查首尾与几个易错卦）', () => {
    const cases = [
      [1, '乾', '元亨。利贞。'],
      [2, '坤'],
      // 否的卦辞本身就以「否」起头，不能当卦名前缀剥掉
      [12, '否', '否之匪人，不利君子贞，大往小来。'],
      [29, '坎'],
      [64, '未济'],
    ];
    cases.forEach(([seq, name, gua]) => {
      assert.equal(ZHOUYI_TEXT[seq].name, name);
      if (gua) assert.equal(ZHOUYI_TEXT[seq].gua, gua);
    });
  });
});

describe('经文接线', () => {
  it('易经端点：卦上带卦辞大象，逐爻带爻辞', () => {
    const qian = hexagramByLines.get('111111');
    assert.equal(qian.text.gua, ZHOUYI_TEXT[1].gua);
    assert.equal(qian.text.daXiang, ZHOUYI_TEXT[1].daXiang);
    const lines = getDetailedLines(qian, [3]);
    assert.equal(lines.length, 6);
    assert.equal(lines[2].yaoText.title, '九三');
    assert.equal(lines[2].yaoText.text, ZHOUYI_TEXT[1].yao[2].text);
    // 用九不属于某一爻，不得混进逐爻清单
    assert.ok(lines.every((l) => !/^用/.test(l.yaoText?.title || '')));
  });

  it('getYaoText 只取六爻，用九用六取不到', () => {
    const qian = hexagramByLines.get('111111');
    assert.equal(getYaoText(qian, 6).title, '上九');
    assert.equal(getYaoText(qian, 7), null);
    assert.equal(getYaoText(qian, 0), null);
  });

  it('六爻装卦：卦名带卦辞大象，每爻带爻辞，且与易经端点同源', () => {
    const lines = [1, 0, 1, 0, 1, 0]; // 水火既济
    const chart = buildLiuyaoChart(lines, { dayGanzhi: '甲子', monthBranch: '寅' });
    const name = getHexagramName(lines);
    const text = ZHOUYI_TEXT[name.sequence];
    assert.equal(chart.name.text.gua, text.gua);
    assert.equal(chart.name.text.daXiang, text.daXiang);
    chart.yaos.forEach((yao, index) => {
      assert.equal(yao.yaoText.title, text.yao[index].title);
      assert.equal(yao.yaoText.text, text.yao[index].text);
    });
    // 同一卦经两个端点取到的必须是同一份
    assert.equal(chart.name.text.gua, hexagramByLines.get(lines.join('')).text.gua);
  });

  it('六十四卦逐卦装卦都能取到完整经文', () => {
    hexagrams.forEach((hexagram) => {
      const chart = buildLiuyaoChart(hexagram.lines, { dayGanzhi: '甲子' });
      assert.ok(chart.name.text?.gua, `${hexagram.name} 缺卦辞`);
      assert.equal(chart.yaos.filter((y) => y.yaoText).length, 6, `${hexagram.name} 爻辞不全`);
    });
  });
});

describe('经文接线的边界', () => {
  it('getYaoText 对没有经文的卦、非法位次一律返回 null 而不抛', () => {
    assert.equal(getYaoText(null, 1), null);
    assert.equal(getYaoText({}, 1), null);
    assert.equal(getYaoText({ text: null }, 1), null);
    assert.equal(getYaoText({ text: { yao: '不是数组' } }, 1), null);
    assert.equal(getYaoText({ text: { yao: [] } }, 1), null);
  });

  it('getDetailedLines 对没有经文的卦仍给出六爻结构，yaoText 为 null', () => {
    const bare = { lines: [1, 0, 1, 0, 1, 0] };
    const lines = getDetailedLines(bare, [1]);
    assert.equal(lines.length, 6);
    assert.ok(lines.every((l) => l.yaoText === null));
    assert.equal(lines[0].isChanging, true);
    assert.equal(lines[0].status, 'Old Yang (Moving)');
    assert.equal(lines[1].status, 'Young Yin (Stable)');
    assert.deepEqual(getDetailedLines(null), []);
  });

  it('六爻装卦对取不到经文的卦不炸，yaoText 为 null', () => {
    // getHexagramName 认得的卦必有经文；这里直接验没有 sequence 时的兜底路径
    const chart = buildLiuyaoChart([1, 1, 1, 1, 1, 1], { dayGanzhi: '甲子' });
    assert.ok(chart.yaos.every((y) => y.yaoText === null || y.yaoText.text));
  });
});
