/**
 * 从维基文库抓取《周易》经文（卦辞、爻辞、大象），生成 data/zhouyiText.js。
 *
 * **这个脚本存在的理由是可追溯性**：经文是原始文献，凭记忆录入 384 条爻辞
 * 一定会有错，而错了不会报错。本仓库对神煞表的态度是「宁可少列，也不要给出一个
 * 说不清出处的判语」（constants/shensha.js），经文同理 —— 要么有底本，要么不给。
 *
 * 底本：维基文库 zh.wikisource.org 的《周易》分卦页面，取 MediaWiki 的
 * zh-hans 转换结果（简体），与本仓库其余中文输出一致。
 *
 * 用法：node scripts/fetch-zhouyi.mjs
 * 产物：data/zhouyiText.js（提交进仓库，运行时不联网）
 *
 * 抽取规则全部锚在结构标记上，不靠字数或位置猜：
 * - 卦辞：「易经：」之后到第一条爻题之前
 * - 爻辞：「易经：」与「彖曰：」之间、以爻题（初九/六二/上六/用九…）起头的行
 * - 大象：「象曰：」之后的第一行（其后各行是小象）
 * 抽取完逐卦校验：六爻齐备、乾有用九、坤有用六，缺一即报错退出。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));

/**
 * 已知底本字形的替换表（照录不等于照抄错字与生僻编码）：
 * - 袛→祗：复初九「无祗悔」，底本作衣旁「袛」，是形近讹字；坎九五同字作「祗」。
 * - 㧑/𬙊/𫗧/𦈡 → 撝/纆/餗/繻：MediaWiki 类推简化落到扩展 A/B/C/E 区，常见字体缺字、JSON 里是代理对；
 *   通行简体印本（中华书局等）这几处保留原字。
 * 行内残留的 ASCII 空格（同人卦辞、睽上九）一并去掉 —— 那是底本排版，不是经文。
 */
const KNOWN_FIXES = [
  ['袛', '祗'],
  ['㧑', '撝'],
  ['𬙊', '纆'],
  ['𫗧', '餗'],
  ['𦈡', '繻'],
];
const normalizeText = (text) =>
  text == null
    ? text
    : KNOWN_FIXES.reduce((acc, [from, to]) => acc.split(from).join(to), text).replace(/\s+/g, '');

/**
 * 六十四卦：[维基文库页名（繁体标题）, 简体卦名]，下标即《周易》序卦次序减一。
 *
 * 页名必须用繁体 —— 维基文库的条目标题就是繁体，传简体过去会 404（「讼」查无此页）。
 * 简体卦名用来剥掉卦辞行首的「卦名：」前缀，因为正文取的是 zh-hans 转换结果。
 */
const HEXAGRAMS = [
  ['乾', '乾'],
  ['坤', '坤'],
  ['屯', '屯'],
  ['蒙', '蒙'],
  ['需', '需'],
  ['訟', '讼'],
  ['師', '师'],
  ['比', '比'],
  ['小畜', '小畜'],
  ['履', '履'],
  ['泰', '泰'],
  ['否', '否'],
  ['同人', '同人'],
  ['大有', '大有'],
  ['謙', '谦'],
  ['豫', '豫'],
  ['隨', '随'],
  ['蠱', '蛊'],
  ['臨', '临'],
  ['觀', '观'],
  ['噬嗑', '噬嗑'],
  ['賁', '贲'],
  ['剝', '剥'],
  ['復', '复'],
  ['无妄', '无妄'],
  ['大畜', '大畜'],
  ['頤', '颐'],
  ['大過', '大过'],
  ['坎', '坎'],
  ['離', '离'],
  ['咸', '咸'],
  ['恒', '恒'],
  ['遯', '遁'],
  ['大壯', '大壮'],
  ['晉', '晋'],
  ['明夷', '明夷'],
  ['家人', '家人'],
  ['睽', '睽'],
  ['蹇', '蹇'],
  ['解', '解'],
  ['損', '损'],
  ['益', '益'],
  ['夬', '夬'],
  ['姤', '姤'],
  ['萃', '萃'],
  ['升', '升'],
  ['困', '困'],
  ['井', '井'],
  ['革', '革'],
  ['鼎', '鼎'],
  ['震', '震'],
  ['艮', '艮'],
  ['漸', '渐'],
  ['歸妹', '归妹'],
  ['豐', '丰'],
  ['旅', '旅'],
  ['巽', '巽'],
  ['兌', '兑'],
  ['渙', '涣'],
  ['節', '节'],
  ['中孚', '中孚'],
  ['小過', '小过'],
  ['既濟', '既济'],
  ['未濟', '未济'],
];

/**
 * 爻题。分隔符**不能只认冒号** —— 维基文库各卦体例不一，
 * 乾坤用「初九：」，否卦等用「初六，」，只认冒号会让整卦一条爻辞都抽不到。
 */
const YAO_TITLE = /^(初[九六]|[九六][二三四五]|上[九六]|用[九六])[：:，,]\s*/;

const stripHtml = (html) =>
  html
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<sup[\s\S]*?<\/sup>/g, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 429 退避重试：维基对匿名请求限速，一次跑 64 页必然撞上。 */
const fetchPage = async (name, attempt = 0) => {
  const url =
    'https://zh.wikisource.org/w/api.php?action=parse&format=json&formatversion=2' +
    `&prop=text&variant=zh-hans&page=${encodeURIComponent(`周易/${name}`)}`;
  const res = await fetch(url, { headers: { 'user-agent': 'metaphysics-engine/zhouyi-fetch' } });
  if (res.status === 429 && attempt < 6) {
    await sleep(2000 * 2 ** attempt);
    return fetchPage(name, attempt + 1);
  }
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  const body = await res.json();
  if (body.error) throw new Error(`${name}: ${body.error.info}`);
  return stripHtml(body.parse.text)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
};

const extract = (name, cn, lines) => {
  const jingIdx = lines.findIndex((l) => /^易经[：:]$/.test(l));
  const tuanIdx = lines.findIndex((l) => /^彖曰[：:]$/.test(l));
  const xiangIdx = lines.findIndex((l) => /^象曰[：:]$/.test(l));
  if (jingIdx === -1) throw new Error(`${name}: 找不到「易经：」`);

  const end = tuanIdx === -1 ? lines.length : tuanIdx;
  const body = lines.slice(jingIdx + 1, end);

  const firstYao = body.findIndex((l) => YAO_TITLE.test(l));
  const guaLines = (firstYao === -1 ? body : body.slice(0, firstYao)).filter(
    (l) => !/^姊妹计划/.test(l)
  );
  /**
   * 卦辞。跨行的合成一条（坤、否等卦辞本就多句分行）。
   *
   * 只在卦名后**带分隔符**时才剥掉卦名：「乾：元亨。利贞。」剥成「元亨。利贞。」；
   * 而否卦作「否之匪人，不利君子贞，大往小来。」，那个「否」是卦辞本身的字，
   * 无分隔符，不能剥 —— 一律剥会把经文吃掉一个字。
   */
  const gua = normalizeText(
    guaLines
      .join('')
      .replace(new RegExp(`^${cn}[：:，,]\\s*`), '')
      .trim()
  );

  const yao = [];
  body.forEach((line) => {
    if (!YAO_TITLE.test(line)) return;
    const matched = YAO_TITLE.exec(line);
    yao.push({ title: matched[1], text: normalizeText(line.slice(matched[0].length).trim()) });
  });

  const daXiang = xiangIdx === -1 ? null : normalizeText(lines[xiangIdx + 1] || null);

  return { gua, yao, daXiang };
};

const validate = (name, seq, data) => {
  const err = (msg) => {
    throw new Error(`第${seq}卦 ${name}: ${msg}`);
  };
  if (!data.gua) err('缺卦辞');
  if (!data.daXiang) err('缺大象');
  const six = data.yao.filter((y) => !/^用/.test(y.title));
  if (six.length !== 6) err(`爻辞应有六条，实得 ${six.length}`);
  if (data.yao.some((y) => !y.text)) err('有爻题无爻辞');
  const yong = data.yao.filter((y) => /^用/.test(y.title));
  if (name === '乾' && !yong.some((y) => y.title === '用九')) err('乾缺用九');
  if (name === '坤' && !yong.some((y) => y.title === '用六')) err('坤缺用六');
  if (name !== '乾' && name !== '坤' && yong.length) err('只有乾坤有用爻');
};

const main = async () => {
  const out = [];
  for (let i = 0; i < HEXAGRAMS.length; i += 1) {
    const [page, cn] = HEXAGRAMS[i];
    const data = extract(page, cn, await fetchPage(page));
    validate(cn, i + 1, data);
    out.push({ sequence: i + 1, name: cn, ...data });
    process.stderr.write(`${String(i + 1).padStart(2)} ${cn} ✓\n`);
    await sleep(1200);
  }

  const totalYao = out.reduce((n, h) => n + h.yao.length, 0);
  if (out.length !== 64) throw new Error(`应有 64 卦，实得 ${out.length}`);
  if (totalYao !== 386) throw new Error(`应有 386 条爻辞（384 + 用九用六），实得 ${totalYao}`);

  const body = out
    .map(
      (h) =>
        `  ${h.sequence}: {\n` +
        `    name: '${h.name}',\n` +
        `    gua: '${h.gua}',\n` +
        `    daXiang: '${h.daXiang}',\n` +
        `    yao: [\n` +
        h.yao.map((y) => `      { title: '${y.title}', text: '${y.text}' },`).join('\n') +
        `\n    ],\n  },`
    )
    .join('\n');

  const file = `/**
 * 《周易》经文：六十四卦的卦辞、爻辞与大象传。键为《周易》序卦次序（1–64）。
 *
 * **本文件由脚本生成，不要手改** —— 改了下次重跑就没了，也失去可追溯性。
 * 生成：node scripts/fetch-zhouyi.mjs
 * 底本：维基文库 zh.wikisource.org《周易》分卦页面，取 MediaWiki 的 zh-hans
 *       转换结果（简体），与本仓库其余中文输出一致。
 *
 * 经文是**原始文献**，不是本引擎的断语 —— 与择吉历注照录通书条目同一性质，
 * 属于「结构归引擎」这条线里引擎该给的原料。至于「这一爻对你这件事意味着什么」，
 * 那一句仍然不给。
 *
 * 乾有用九、坤有用六，故爻辞共 386 条而非 384 条。
 *
 * **断句一律照录底本**，不按别家重新点断。例：剥卦辞作「不利。有攸往。」，
 * 另有作「不利有攸往」的点法 —— 那是底本之别，不是抓取出错。换底本改抓取脚本。
 * 字形替换只限脚本里 KNOWN_FIXES 那几处（底本讹字与扩展区类推字），逐条有注。
 */

export const ZHOUYI_TEXT = {
${body}
};

export default ZHOUYI_TEXT;
`;
  fs.writeFileSync(path.join(DIR, '..', 'data', 'zhouyiText.js'), file, 'utf8');
  process.stderr.write(`\n写入 data/zhouyiText.js：64 卦，${totalYao} 条爻辞\n`);
};

main().catch((e) => {
  process.stderr.write(`失败：${e.message}\n`);
  process.exit(1);
});
