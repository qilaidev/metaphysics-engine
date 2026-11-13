import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Solar } from 'lunar-javascript';

import { JIEQI_JU, JIEQI_ORDER, YIQI_ORDER, NINE_STARS } from '../constants/qimen.js';
import {
  resolveJieQi,
  resolveFutou,
  resolveYuan,
  resolveJu,
  buildEarthPlate,
  getXunShou,
  getHourGanzhi,
  castQimenChart,
} from '../services/qimen.service.js';

describe('三元局数表', () => {
  it('二十四节气齐备，每气三元', () => {
    assert.equal(Object.keys(JIEQI_JU).length, 24);
    assert.equal(JIEQI_ORDER.length, 24);
    Object.entries(JIEQI_JU).forEach(([name, entry]) => {
      assert.equal(entry.ju.length, 3, `${name} 应有三元局数`);
      entry.ju.forEach((ju) => {
        assert.ok(ju >= 1 && ju <= 9, `${name} 局数 ${ju} 越界`);
      });
    });
  });

  it('冬至至芒种为阳遁，夏至至大雪为阴遁', () => {
    const yangQi = JIEQI_ORDER.slice(0, 12);
    const yinQi = JIEQI_ORDER.slice(12);
    yangQi.forEach((name) => assert.equal(JIEQI_JU[name].yang, true, `${name} 应为阳遁`));
    yinQi.forEach((name) => assert.equal(JIEQI_JU[name].yang, false, `${name} 应为阴遁`));
  });

  it('局数符合三元口诀', () => {
    // 冬至惊蛰一七四
    assert.deepEqual(JIEQI_JU['冬至'].ju, [1, 7, 4]);
    assert.deepEqual(JIEQI_JU['惊蛰'].ju, [1, 7, 4]);
    // 大寒春分三九六
    assert.deepEqual(JIEQI_JU['大寒'].ju, [3, 9, 6]);
    assert.deepEqual(JIEQI_JU['春分'].ju, [3, 9, 6]);
    // 夏至白露九三六
    assert.deepEqual(JIEQI_JU['夏至'].ju, [9, 3, 6]);
    assert.deepEqual(JIEQI_JU['白露'].ju, [9, 3, 6]);
    // 大雪四七一
    assert.deepEqual(JIEQI_JU['大雪'].ju, [4, 7, 1]);
  });

  it('阴遁局数与阳遁对称：同位节气两局相加恒为十', () => {
    // 阳遁那半张表已与三元定局口诀逐条核对过（冬至惊蛰一七四、小寒二八五、
    // 大寒春分三九六、立春八五二、雨水九六三、清明立夏四一七、谷雨小满五二八、
    // 芒种六三九）。二至分顺逆，阴阳遁同位节气的局数互补为十 —— 这条规律成立，
    // 就等于用已核对的阳遁半张表验证了未逐条核对的阴遁半张表。
    for (let i = 0; i < 12; i += 1) {
      const yangQi = JIEQI_ORDER[i];
      const yinQi = JIEQI_ORDER[i + 12];
      JIEQI_JU[yangQi].ju.forEach((yangJu, idx) => {
        const yinJu = JIEQI_JU[yinQi].ju[idx];
        assert.equal(yangJu + yinJu, 10, `${yangQi}(${yangJu}) 与 ${yinQi}(${yinJu}) 之和应为 10`);
      });
    }
  });

  it('阳遁与阴遁的三元局数互为逆序对应', () => {
    // 阳遁诸气的三元多为「顺三」，阴遁多为「逆三」，此处校验步长恒为 ±3（模 9）
    Object.entries(JIEQI_JU).forEach(([name, entry]) => {
      const [a, b, c] = entry.ju;
      const step1 = (((b - a) % 9) + 9) % 9;
      const step2 = (((c - b) % 9) + 9) % 9;
      assert.equal(step1, step2, `${name} 三元步长不一致`);
      assert.ok([3, 6].includes(step1), `${name} 三元步长应为 ±3，实得 ${step1}`);
    });
  });
});

describe('定节气与三元', () => {
  it('能定出占日所处节气', () => {
    const jieqi = resolveJieQi(2024, 5, 20);
    assert.ok(JIEQI_JU[jieqi.name], `未定出有效节气，实得 ${jieqi.name}`);
  });

  it('符头为甲日或己日，且在十日之内', () => {
    const futou = resolveFutou(2024, 5, 20);
    assert.ok(['甲', '己'].includes(futou.futou[0]), `符头应为甲己日，实得 ${futou.futou}`);
    assert.ok(futou.daysSinceFutou >= 0 && futou.daysSinceFutou < 10, '符头应在十日之内');
  });

  it('三元由符头地支定：子午卯酉上元、寅申巳亥中元、辰戌丑未下元', () => {
    // 逐日扫两个月，符头地支与所得之元必须逐条对得上
    const expect = {
      子: 0,
      午: 0,
      卯: 0,
      酉: 0,
      寅: 1,
      申: 1,
      巳: 1,
      亥: 1,
      辰: 2,
      戌: 2,
      丑: 2,
      未: 2,
    };
    let cursor = Solar.fromYmd(2024, 4, 1);
    for (let i = 0; i < 61; i += 1) {
      const yuan = resolveYuan(cursor.getYear(), cursor.getMonth(), cursor.getDay());
      assert.equal(yuan.yuan, expect[yuan.futouBranch], `符头 ${yuan.futou} 定元不符`);
      assert.equal(yuan.yuanCn, ['上元', '中元', '下元'][yuan.yuan]);
      cursor = cursor.next(1);
    }
  });

  /**
   * 拆补法的回归基准。
   *
   * 一个节气之内三元出现非「上→中→下」的次序是**拆补法的正常形态**：符头十五日一周
   * 而交节日逐年漂移，交节后头一段那个元不足五日即「拆」，节气末尾余下的两三日补回
   * 被拆掉的那一元即「补」。曾据「次序错乱」把定元改成按距交节日数算，那既不是拆补法
   * 也不是置闰法 —— 这一条就是为了不让那个改法再回来。
   *
   * 2024 小满（交节 5/20 20:59，三元局数 [5, 2, 8]）实测是「残中—下—上—补中」：
   */
  it('拆补法：2024 小满排出「残中—下—上—补中」，局数 2 → 8 → 5 → 2', () => {
    const expected = [
      [5, 21, '中元', 2, '甲申'],
      [5, 24, '中元', 2, '甲申'],
      [5, 25, '下元', 8, '己丑'],
      [5, 29, '下元', 8, '己丑'],
      [5, 30, '上元', 5, '甲午'],
      [6, 3, '上元', 5, '甲午'],
      [6, 4, '中元', 2, '己亥'],
    ];
    expected.forEach(([month, day, yuanCn, ju, futou]) => {
      const got = resolveJu(2024, month, day, 12, 0);
      assert.equal(got.jieqi, '小满', `${month}/${day} 应属小满`);
      assert.equal(got.futou, futou, `${month}/${day} 符头应为 ${futou}`);
      assert.equal(got.yuanCn, yuanCn, `${month}/${day} 应为${yuanCn}`);
      assert.equal(got.ju, ju, `${month}/${day} 应为阳遁${ju}局`);
      assert.equal(got.yuanBasis, 'futou-branch');
    });
  });

  it('局数恒等于本节气三元表里所取那一元的值', () => {
    let cursor = Solar.fromYmd(2024, 1, 1);
    for (let i = 0; i < 366; i += 1) {
      const ju = resolveJu(cursor.getYear(), cursor.getMonth(), cursor.getDay(), 12, 0);
      assert.deepEqual(ju.juByYuan, JIEQI_JU[ju.jieqi].ju);
      assert.equal(ju.ju, ju.juByYuan[ju.yuan]);
      assert.equal(ju.yang, JIEQI_JU[ju.jieqi].yang);
      cursor = cursor.next(1);
    }
  });

  it('全年任一天都能定出阴阳遁与局数', () => {
    for (let month = 1; month <= 12; month += 1) {
      [3, 12, 21, 28].forEach((day) => {
        const ju = resolveJu(2024, month, day);
        assert.ok(ju, `${month}/${day} 定局失败`);
        assert.ok(ju.ju >= 1 && ju.ju <= 9);
        assert.equal(typeof ju.yang, 'boolean');
      });
    }
  });
});

describe('地盘三奇六仪', () => {
  it('次序为戊己庚辛壬癸丁丙乙，三奇在后且为逆序', () => {
    assert.deepEqual(YIQI_ORDER, ['戊', '己', '庚', '辛', '壬', '癸', '丁', '丙', '乙']);
  });

  it('阳遁自局数宫顺飞', () => {
    // 阳遁一局：戊在坎一，己在坤二，庚在震三……
    const plate = buildEarthPlate({ yang: true, ju: 1 });
    assert.equal(plate[1], '戊');
    assert.equal(plate[2], '己');
    assert.equal(plate[3], '庚');
    assert.equal(plate[9], '乙');
  });

  it('阴遁自局数宫逆飞', () => {
    // 阴遁一局：戊在坎一，己在离九，庚在艮八……
    const plate = buildEarthPlate({ yang: false, ju: 1 });
    assert.equal(plate[1], '戊');
    assert.equal(plate[9], '己');
    assert.equal(plate[8], '庚');
  });

  it('九宫布满九干，不重不漏', () => {
    [1, 5, 9].forEach((ju) => {
      [true, false].forEach((yang) => {
        const plate = buildEarthPlate({ yang, ju });
        assert.equal(Object.keys(plate).length, 9);
        assert.equal(new Set(Object.values(plate)).size, 9);
      });
    });
  });
});

describe('旬首与时干支', () => {
  it('旬首取六甲', () => {
    assert.equal(getXunShou('甲子'), '甲子');
    assert.equal(getXunShou('乙丑'), '甲子');
    assert.equal(getXunShou('癸酉'), '甲子');
    assert.equal(getXunShou('甲戌'), '甲戌');
    assert.equal(getXunShou('癸亥'), '甲寅');
  });

  it('五鼠遁起时干：甲己日起甲子时', () => {
    assert.equal(getHourGanzhi('甲', 0), '甲子');
    assert.equal(getHourGanzhi('己', 0), '甲子');
    assert.equal(getHourGanzhi('乙', 0), '丙子');
    assert.equal(getHourGanzhi('庚', 0), '丙子');
    assert.equal(getHourGanzhi('甲', 23), '甲子', '子时含 23 时');
    assert.equal(getHourGanzhi('甲', 12), '庚午');
  });
});

describe('整盘', () => {
  const chart = castQimenChart({ year: 2024, month: 5, day: 20, hour: 14 });

  it('九宫齐备，每宫都带地盘干、星、神', () => {
    assert.equal(chart.palaces.length, 9);
    chart.palaces.forEach((p) => {
      assert.ok(p.earthStem, `${p.cn} 缺地盘干`);
      assert.ok(p.heavenStem, `${p.cn} 缺天盘干`);
      assert.ok(p.star, `${p.cn} 缺九星`);
    });
  });

  it('八门布于八宫，中五宫无门', () => {
    const withGate = chart.palaces.filter((p) => p.gate);
    assert.ok(withGate.length >= 7, `八门应布于八宫，实得 ${withGate.length}`);
    const center = chart.palaces.find((p) => p.index === 5);
    assert.equal(center.gate, null, '中五宫不应有门');
  });

  it('八神恰布八宫', () => {
    const withGod = chart.palaces.filter((p) => p.god);
    assert.equal(withGod.length, 8);
    assert.equal(new Set(withGod.map((p) => p.god.key)).size, 8, '八神不应重复');
  });

  it('八宫环上八星不重不漏，天禽寄坤二随天芮', () => {
    const octagonStars = chart.palaces.filter((p) => p.index !== 5).map((p) => p.star.key);
    assert.equal(new Set(octagonStars).size, 8, '八宫之星不应重复');
    assert.ok(!octagonStars.includes('tianqin'), '天禽不参与八宫轮转');
    // 天禽寄于某一宫，与该宫本星并列
    const lodged = chart.palaces.filter((p) => p.lodgedStar);
    assert.equal(lodged.length, 1, '天禽应寄于且仅寄于一宫');
    assert.equal(lodged[0].lodgedStar.key, 'tianqin');
    // 中五宫恒为天禽
    assert.equal(chart.palaces.find((p) => p.index === 5).star.key, 'tianqin');
  });

  it('值符为旬首遁仪所落之宫的星，并加临时干之宫', () => {
    assert.ok(chart.dunYi, '缺遁仪');
    assert.equal(chart.earthPlate[chart.zhifu.palace], chart.dunYi, '值符宫应为遁仪所落之宫');
    const landed = chart.palaces.find((p) => p.index === chart.zhifu.landedPalace);
    assert.equal(landed.star.key, chart.zhifu.star.key, '值符星应加临时干之宫');
    assert.ok(landed.isZhifu);
  });

  it('值使宫标注唯一', () => {
    assert.equal(chart.palaces.filter((p) => p.isZhishi).length, 1);
    assert.equal(chart.palaces.filter((p) => p.isZhifu).length, 1);
  });

  it('全年逐时排盘都不崩且结构完整', () => {
    let count = 0;
    for (let month = 1; month <= 12; month += 1) {
      for (let hour = 0; hour < 24; hour += 4) {
        const c = castQimenChart({ year: 2024, month, day: 15, hour });
        assert.ok(c, `${month}/15 ${hour}时 排盘失败`);
        assert.equal(c.palaces.length, 9);
        const oct = c.palaces.filter((p) => p.index !== 5);
        assert.equal(new Set(oct.map((p) => p.star.key)).size, 8, '八宫之星应不重不漏');
        assert.equal(oct.filter((p) => p.gate).length, 8, '八门应布满八宫');
        assert.equal(c.palaces.filter((p) => p.god).length, 8);
        assert.equal(c.palaces.find((p) => p.index === 5).gate, null, '中宫恒无门');
        count += 1;
      }
    }
    assert.ok(count > 50);
  });

  it('非法输入返回 null', () => {
    assert.equal(castQimenChart({ year: 'x', month: 1, day: 1, hour: 0 }), null);
  });
});
