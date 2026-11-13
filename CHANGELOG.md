# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

#### 算法审计（2026-09-08）

多 agent 分维度审计（每条发现经典籍 / 复现 / 影响三个视角核实），加上主会话按公开例课逐条复核。
下面前四条都是**排得出盘、结构完整、测试全绿，但盘是另一张**的静默错；每条都配了钉在外部例证上的
回归（`algorithm_external_examples.test.js`、`audit_2026_09_regressions.test.js`）。

- **BREAKING：六壬第一课以寄宫地支五行判克，应以日干五行。** 干阳课是「日干与干上神」：
  乙日干上神未，乙木克未土为下贼上；寄宫辰只是乙在地盘上的落脚处。乙（辰土）丁（未土）戊（巳火）
  辛（戌土）癸（丑土）五干寄宫五行与本干不同，这五种日干 —— 一半的日子 —— 一课克应整层错，
  课体与三传随之错。公开例课：丁丑日子时申将，正解元首课初传巳，旧算法排成涉害课初传卯；
  同源另两例（丙戌日、壬辰日）新旧一致。连带：伏吟有克（乙癸日）此前永远走不到，一律误报自任/自信；
  返吟有克（癸丑日）误报无亲。`fourCourses[0]` 新增 `lowerStem`。rulings 键 `first-course-day-stem`。
- **BREAKING：奇门值使门落宫在八宫环上转，应按九宫数序飞。** 通行口径：甲子时值使在值符宫，
  之后按一二三四五六七八九（阳遁）/ 九八七六五四三二一（阴遁）逐时辰一宫，遇中五寄坤二；
  旬首遁仪落中五时自五起数。此前在坎→艮→震→巽→离→坤→兑→乾环上转，阳遁一局乙丑时落艮八而非坤二，
  一旬十个时辰只有甲子、丙寅两个巧合相同。八门整体随值使门转这一步不变。rulings 键 `zhishi-luoshu-order`。
- **六壬涉害「孟深仲浅」看的是候选所临的地盘位**，不是候选支本身属孟属仲。此前按候选支自身判，
  见机取错，察微与复等两课在全部日/将/时组合里一次都走不到。另：两课同一上神视为一课，
  先去重再论独一与比用 —— 此前八专有克日会报出「只有一个候选的涉害课」；伏吟自刑改取按
  「颠倒日辰」（初传来自干上改取支上，反之亦然），不按阴阳日。
- **八字建禄羊刃改按禄刃表**（戊禄巳刃午、己禄午，土寄火乡）。此前按「月令本气同五行」推：
  戊日巳月报偏印格、戊日午月报正印格、戊日辰戌月反而报建禄 —— 与同一引擎 `shensha.js` 的
  LUSHEN / YANGREN 表自相矛盾。四季月戊己不作建禄：比劫透干或皆不透归月劫，财官透干以透干论（杂气）。
- **IANA 时区偏移在错误的瞬时上查表。** 把墙钟当 UTC 去查，DST 转换后 |偏移| 小时内取到转换前的值：
  纽约 2024-03-10 03:30 取成 −5 而非 −4，上海 1988-04-17 03:30 取成 +8 而非 +9，真太阳时与时柱随之错一小时。
  改为迭代到稳定。
- **中国夏令时（1986–1991）墙钟未归一到北京标准时。** 传 `Asia/Shanghai` 时 IANA 给 +9，
  夏令时墙钟被原样拿去比东八区节气表、排时辰：1988-08-07 15:40（标准时 14:40，立秋 15:20 之前）
  排成庚申月申时，正解己未月未时。现在先减去多出的一小时（`chartTime.dstNormalized` 回显），
  再按 +8 / 120°E 走；已给出生地的盘真太阳时结果不变（`trueSolarTime.correctionMinutes` 仍含那一小时，
  新增 `dstCorrection`）。节气参照系同时改为**固定 UTC+8**，不再查 IANA `Asia/Shanghai`：
  裸 +9 偏移的输入（东京）在那六个夏季此前也没被换算。
- **交节那一分钟各模块判法不一。** 八字（lunar-javascript 到秒）判 16:27 未到 16:27:07 的立春，
  `jieqi.service` 截到分判已交节，同一出生分钟八字与奇门/六壬/八宅落在两个节气里。
  现在节气基座带秒比较，与八字同边。奇门月令（旺相休囚死）改由定局所用的节气直接推出，
  不再用子初换日后那天 0 点去查 —— 交节日交节后的时辰此前月令仍是上月。
- **紫微声明并回显真太阳时口径，路由却从未校正。** 现在与八字同一套时刻解析（`resolveChartTime`），
  给了出生地与时区的盘时辰按真太阳时排，响应带 `chartTime`。乌鲁木齐 10:00 回拨逾两小时，命宫随之变。
- **择吉立春当天一半新年一半旧年。** 年柱按日判（lunar-javascript ByLiChun）而方位煞按 0 点比交节时刻：
  2024-02-04 太岁岁破三煞按甲辰，紫白入中与五黄二黑却按 2023。历注按日给出，现在两者同源，
  立春当日整日归新年；rulings 新增 `lichun-day-inclusive`，`almanac` 不再挂「交节精确到分」。
- **六爻 CLI `--hour` 校验通过后被静默丢弃**：交节日傍晚起的卦月建仍算上月、23 点起的卦日辰仍算当日。
  现随请求发出；OpenAPI 补 `hour`；rulings 里六爻的共用键由「晚子不换日」改为路由一直在用的「子初换日」。
- **路由日期校验补齐**：六爻 / 六壬 / 奇门 / 紫微 / 择吉 / 八宅对 2 月 30 日这类不存在的日期返回 400，
  此前被 lunar-javascript 静默顺延且回显原日期；六爻非整数 `hour`、易经未知 `method` 与非正整数一律 400；
  八宅月日必须同给。姓名五格服务层拒绝 0 与负数笔画。
- **《周易》经文**：第 33 卦名留繁体「遯」且卦辞带「遁：」前缀；复初九「袛」为底本讹字（应作「祗」）；
  㧑/𬙊/𫗧/𦈡 四处扩展区类推字换回撝/纆/餗/繻；同人卦辞、睽上九行内空格去掉。
  替换表进抓取脚本（`KNOWN_FIXES`），重跑可复现；文件头的手写段落并入模板。
- 六壬 `BAZHUAN_DAYS` 推导时过滤阴阳相配，只余甲寅丁未己未庚申癸丑五日（乙辰之类干支不存在）。

### Added

- **外部交叉验证回归**（`algorithm_cross_validation.test.js` + `fixtures/cross_validation.json`）：
  紫微对 iztro 2.6.1 逐盘 400 张零差异，抽 20 张钉住命身宫、五行局、宫名宫干、星曜四化与大限；
  六壬对 kinliuren 0.1.2.9 逐课 300 课，天盘四课天将盘全同，三传一致者按课体分层抽 47 课钉住，
  66 课分歧按古法逐条手核（返吟无依日、比用取克、涉害数向、伏吟自刑三刑方向、八专先于遥克、别责）
  全部是对方出错，12 课手核用例连同推法写进测试；奇门对 kinqimen 0.0.6.6 拆补法逐盘 200 张，
  换算八神古今法与中宫寄坤表示后 198 张一致，阴阳十八局各抽两张钉住定局、值符值使、地盘天盘、
  八门九星，2 张分歧（时干落中五宫，kinqimen 自相矛盾）按「寄坤二、值符加临自己则伏吟」钉住；
  上升星座对 astronomy-engine 2.1.19 十点比对，恒星时最大差 16 秒、黄经最大差 0.006°，
  以容差钉住；塔罗 78 张逐张核对（id / 牌名唯一、大小阿卡纳与花色序位齐全）与 seed PRNG
  卡方无偏检验（15600 连续 seed，χ² < 118.6，逆位率 0.5 ± 0.02，十张牌阵不重复）。
- `scripts/check-docs.mjs` 新增第五项检查：`constants/rulings.js` 里每个口径 key 都必须出现在
  `SKILL.md`，漏了 CI 红。SKILL.md 补全 74 条 key 的完整清单与「外部交叉验证」一节
  （对过哪些库、哪里是流派表示差异、哪里是对方实现错误，再遇到「某库排得不一样」先查它）。
- 八字神煞补天德、月德（按月支查）与劫煞、亡神（按三合局，年支日支两起）；`luckStart.hours`。
- rulings 新增：`first-course-day-stem`（六壬一课）、`zhishi-luoshu-order`（奇门值使）、
  `lichun-day-inclusive`（择吉按日）、`jieqi-month`（八字命宫月支取节气月）、
  `first-upper-second-lower-sum-mod6`（三数起卦动爻）；时间起卦年支换年界写进 `timeCast`。
- 紫微流年与小限接进接口：`POST /api/ziwei/calculate` 可选 `flowYear`，CLI `calc ziwei --year`。
  此前 `calculateFlowYear` 只在服务层有，README 却当成已交付能力。响应 `lunar.monthBranchUsed`
  回显排盘实际用的月支（`lunar.monthBranch` 是节气月柱，春节～立春窗口两者不同）。
- CLI：`calc bazhai --birth` 接受 `YYYY-MM-DDTHH:mm`（立春当天命卦才确定）；起课类命令新增 `--minute`。
- 1582-10-05～14（儒略历改历删掉的十天）在校验层拒绝，此前进 lunar-javascript 抛异常成引擎内部错。
- 易经 `applyChangingLines` 对越界爻位改为忽略，不再钳到初爻/上爻翻转。
- rulings_lock 补锁：各模块 `sharedKeys` 与本轮新增的全部 key；新增紫微逐宫金标准命例与起运三例回归。
- 回归：外部例课与逐时辰对照（六壬三例课 + 五则经典课、奇门阳一局/阴九局全旬值使、DST 转换窗口、
  中国夏令时、禄刃表十干、择吉全年同源、紫微真太阳时、周易经文归一、路由日期校验）。

#### 口径审计（2026-08-31）

逐模块对照传统主流口径核了一遍算法层与静态表。下面前三条都是**排得出盘、结构完整、
测试全绿，但盘是另一张**的静默错 —— 此前 703 条测试一条都没挡住，因为那些测试验的是
「表抄全了没、结构完不完整、同一规则前后一致吗」，没有一条把结果钉在外部口径上。
本轮每条修正都配了钉在口径陈述上的回归（`algorithm_mainstream_regression.test.js`）。

- **BREAKING：紫微十二宫排布方向反了**。`ZIWEI_PALACES` 此前顺着地支下标布，
  除命宫、迁移宫外十宫两两互换（兄弟↔父母、夫妻↔福德、子女↔田宅、财帛↔官禄、疾厄↔仆役）。
  星曜落宫一直是对的，错的只有宫名那一层 —— 于是「夫妻宫怎么样」「宫干四化飞入哪一宫」
  整层读反，而盘面看着完全正常。判据不依赖盘面画法：通行口径是
  「阳男阴女大限顺行，第二大限走**父母宫**；阴男阳女逆行，第二大限走**兄弟宫**」，
  而大限顺行就是地支下标递增（`getMajorPeriodDirection` 返回 +1），
  故 `mingIndex + 1` 必须是父母宫 —— 顺布与大限那条规则不可能同时成立。
  改为自命宫逆布（`mingIndex - offset`），新增 rulings 键 `counter-clockwise-from-ming`。
  **缓存与已落库的紫微盘中宫名会变**（星曜、四化星、大限宫位不变）。
- **BREAKING：紫微壬干四化两格是硬错**，不是流派选择。此前化科作天机、化忌作破军；
  口诀「壬梁紫左武」（《全书》一系作「壬梁紫府武」）—— 化科取左辅或天府，
  化忌**恒为武曲**，没有任何一派取破军，天机化科属丁干。改为 `ke: 左辅 / ji: 武曲`。
  壬年生人（1982/1992/2002/2012/2022…）的本命四化，以及凡壬干之宫的宫干四化全部受影响。
  同时把戊/庚/壬三处真正的流派选择写进 rulings（`sihuaVariants`）——
  戊右弼与壬左辅是同一套表的一对，不可一半一派。
- **奇门门迫方向取反了**。门迫是**门克宫**（八门之五行克它所落之宫），逐门核对的清单是：
  伤门/杜门（木）落艮八、坤二（土）；开门/惊门（金）落震三、巽四（木）；休门（水）落离九（火）；
  景门（火）落乾六、兑七（金）；生门/死门（土）落坎一（水）。此前取的是反向（宫克门），
  还把「开门落离九宫」写成经典例证 —— 开门属金、离九属火，那是宫克门，是**门制**不是门迫。
  `isGatePo` 改为门克宫，反向新增 `isGateZhi`（门制），移除含义已重复的 `gateControlsPalace`。
  rulings 键 `palace-controls-gate` → `gate-controls-palace`。
  新增回归：全年抽样 108 张盘逐宫比对上面那份逐门清单，零偏差。
- **八字阴干不再判羊刃格**。《子平真诠》「禄前一位，惟五阳有之，故为阳刃」。
  此前格局层对阴干也判羊刃（乙日寅月即报羊刃格），与 `shensha.js` 的 `YANGREN`
  只列五阳干、以及 rulings 的 `shenshaYangren`「羊刃只对阳干判定」直接冲突 ——
  同一个概念在同一个引擎里两套判据。阴干月令本气见劫财改判**月劫格**（新增 `yuejie`）。
  顺带收紧建禄：建禄与羊刃的成立条件是「月令**本气**即我」，中气余气之比劫透干够不上 ——
  此前戊日寅月（寅之余气戊透）会被报成建禄格，而戊之禄在巳不在寅，这类一律归月劫。
- **奇门旬首遁仪落中五宫时值符星报成了天芮**。值符星取的是遁仪**本宫**之星，
  遁仪落中宫时值符为天禽（寄坤二行事），寄宫只影响它在哪一格行事。九分之一的盘会遇到。
- **六壬涉害不能决时的课体名报错**。孟仲皆不能决而回退取干上/支上神时，此前仍挂
  见机/察微之名 —— 而那两个课体的成立条件正是「取到了孟/仲」。新增**复等课**（`fudeng`）。
  课体是后面全部断语的依据，报错了不会有任何症状。
- 修 CI 上既有的 `format:check` 漂移（`apiSchema.service.js` / `cast.mjs` / `TODO.md` /
  `docs/modules.md` 四个文件此前就没过 prettier，`format:check` 在 main 上是红的）。

### Fixed

- **八字从格 / 专旺格取用方向错误**。扶抑法有一个没写出来的前提：日主还扶得起来。
  日主全无通根时扶不起来，正解是弃命相从，用神与扶抑**恰好相反** —— 此前偏枯到极处的盘
  被判 `weak` 后建议「宜以印比生扶」，而日主根本无根可扶；专旺格同理被判 `strong` 后
  建议「宜以官杀食伤财耗其气」，一行得气宜顺不宜逆，也是反的。这不是深度不足，是方向错。
  新增 `analysis.specialPattern`，`usefulGod` 在两格成立时改从其格并给出 `pattern` 字段。
  判据取硬条件不取近似：从格要四支全无同党通根**且**同党占比 <20%（等价于天干也不见印比，
  即只认真从、不认假从），专旺格要得令（月令本气即日主）**且**同党占比 ≥80%。
  沿用 `facts` / `suggested` 两截的模式，换派照 `facts` 自行重推。
  不传第二个参数时 `determineUsefulGod` 行为逐字节不变，既有调用方不受影响。
- **旧缓存会把上一版的结论继续发出去**。`enrichCachedBaziResult` 只判「有没有 analysis」，
  而升级前写入的缓存**是有** analysis 的，只是缺新增字段 —— 于是从格盘的旧缓存里那份
  方向相反的 `usefulGod` 会一直发到 TTL 过期，且响应看着完全正常。改为按字段清单
  （`ANALYSIS_FIELDS`）判定陈旧并就地重算，不整条重排四柱、也不作废整个缓存
  （那会在升级瞬间造成一次全量重算）。往 `analyzeChart` 加顶层字段必须同步加进那张清单，
  忘了会被 `baziCache.test.js` 里逐键比对的断言拦下。
- **`bazi test engine` 的可复现性声明只验 `examples[0]`**。一条 conditional 命令只要把
  不带条件的示例排在前面，它的声明就永远验不到 —— 而整条用例仍然是绿的。改成在全部示例里
  找那条给全了条件的。塔罗与六爻两条声明因此才真正被连调验证（11 → 13 项）。

#### 一条自我更正：奇门三元定局的改法被撤回

本轮审计一度判定「奇门三元定局错，全年逾九成日子的局数不对」，理由是 2024 小满排出了
「中元→下元→上元→中元」这种非「上→中→下」的次序，并据此把定元改成按距交节的日数算。
**那个判断是错的，改动已全部撤回，恢复原来的符头定元。**

拆补法的定义就是「以节气为主，以符头定元，不另外置闰」：往前取最近的甲己符头，
子午卯酉为上元、寅申巳亥为中元、辰戌丑未为下元，再查当前节气的三元局数表。
一个节气内三元次序错开正是这个方法的**正常形态** —— 「拆」指交节后头一段那个元不足五日，
「补」指节气末尾余下的两三日补回被拆掉的那一元，实际排出「残中—下—上—补中」一类形态。
古籍例证：夏至节内先用三天多中元阴三局、再五天下元阴六局、再五天上元阴九局、
最后补用中元阴三局两天多 —— 与本仓库夏至三元表 [9, 3, 6] 逐条吻合。

按日数定元既不是拆补法也不是置闰法。置闰法同样以符头定元，区别在于它把符头配到
**符头所领起的那个节气**（超神时是下一个），并在超神满九日时置一个闰局。

新增的回归钉的是拆补法本身：2024 小满逐日的符头、元、局数（残中2局→下元8局→上元5局→补中2局），
以及全年任一天「局数恒等于本节气三元表里所取那一元的值」。**这一条就是为了不让那个错改法再回来。**

### Added

- **《周易》经文**：六十四卦的卦辞、爻辞与大象传（`data/zhouyiText.js`）。
  此前 `data/ichingHexagrams.js` 只有卦名与序号，调用方拿到「火水未济」之后还得去别处找经文 ——
  而经文是**原始文献**，与择吉照录通书条目同一性质，属于「结构归引擎」这条线里引擎该给的原料。
  **不凭记忆录入**：384 条爻辞靠印象写，错了不会报错，那正违反本仓库对神煞表的那条原则
  （「宁可少列，也不要给出一个说不清出处的判语」）。改为由 `scripts/fetch-zhouyi.mjs`
  从维基文库《周易》分卦页面抓取（取 MediaWiki 的 zh-hans 简体转换），脚本提交进仓库、
  可重跑复现，`npm -C backend run fetch:zhouyi`。断句一律从底本（剥卦辞作「不利。有攸往。」，
  另有作「不利有攸往」的点法 —— 那是底本之别，不是抓取出错）。
  乾有用九、坤有用六，故爻辞共 386 条；抓取时逐卦校验，缺一即失败退出。
  接线：易经端点的卦上带 `text.gua` / `text.daXiang`、`detailedLines` 逐爻带 `yaoText`；
  六爻装卦的 `name.text` 带卦辞大象、每爻带 `yaoText`。CLI 同步显示卦辞与动爻爻辞。
- **易经端点补出之卦与逐爻明细**。`applyChangingLines` 与 `getDetailedLines` 早就写好了却没接进路由，
  于是起卦只回本卦 —— 而梅花易数论事以本卦为体、之卦为用，少了之卦这一卦只断得出一半。
  响应新增 `changedHexagram` 与 `detailedLines`。
- **塔罗牌的结构性字段**（`arcana` / `arcanaCn` / `suit` / `suitCn` / `element` / `elementCn` /
  `number` / `rank` / `isCourt`）。此前每张牌只有名字与正逆位含义，
  「大阿卡纳占比」「宫廷牌几张」「这个牌阵偏哪个花色」这类最常规的读法一概问不出来。
  不逐张手写 —— 78 条手抄的 arcana/suit 迟早有一条抄错，改由 id 与牌名推出：
  大小之别以 **id** 为准（0–21 为大阿卡纳，靠 `X of Y` 正则会把命运之轮判成小牌），
  花色与序位再从小阿卡纳牌名解析，解析不出直接抛错，不会静默发出一张没有花色的牌。
  花色元素按韦特系：权杖火、圣杯水、宝剑风、星币土。
  牌阵位置补中文名（`positionLabelCn` / `positionMeaningCn`，`label` 仍是英文机器契约）。
  rulings 新增 `cardMetadata`。
- **六壬昴星与天乙贵人的流派选择写进 rulings**：昴星取**阳仰阴俯**
  （阳日取地盘酉上之天盘神、阴日取天盘酉所压之地盘支，两向取反初传完全不同）；
  天乙贵人口诀里「庚」在首末两句都出现，是那张表唯一的分歧处，本模块归入甲戊庚一组，
  与紫微魁钺表同派 —— 新增测试钉住两处一致。
- **旺相休囚死**（`ganzhi.service.js` 的 `getSeasonalState`，六爻与奇门共用）。
  六爻此前只给月建日辰的生克关系，缺「这爻旺不旺」这一档 —— 而那是断卦的第一问；
  奇门同理缺八门九星当不当令，同一个开门秋令与夏令差着两档。
  六爻按**月建**判（日辰只论生克冲合，不另立旺衰档，两者都折成旺衰会让同一爻出现两个
  互相矛盾的档），奇门按**节气月支**判（四时按节气分，与农历月建差着半个月，
  响应新增 `monthCommand` 回显）。放在基座层是因为两边吃同一张表 —— 各抄一份，
  迟早有一边把「休」（生月令）与「囚」（克月令）写反，两者都是与月令相克，只差方向。
- **紫微·宫干四化（自化与飞化）**。此前只有本命四化（年干）与流年四化（流年干），
  缺了整个「宫与宫之间怎么牵连」的层，「夫妻宫化忌入财帛」这类最常用的断法一句也说不了。
  十二宫各以本宫天干起一组四化，落到该星所在之宫：落回本宫为**自化**、落他宫为**飞化**。
  每宫新增 `palaceTransformations`（发出）/ `selfTransformations`（其中的自化）/
  `incomingTransformations`（收到），大限条目新增 `stem` 与 `transformations`
  （即该大限所在宫的宫干四化，同一份数据换个入口给出，两处不会不一致）。
  守恒有测试钉着：十二宫共 48 条化 = 自化 + 飞化 + 星未上盘。
- **塔罗 `seed`**。此前抽牌恒不可复现，于是这条能力永远进不了回归基准，调用方也没法
  复演一次牌局。给 `seed`（字符串或有限数字）即走确定性随机流：同一 seed 配同一牌阵
  必得同一副牌与同一组正逆。响应新增 `seed` 与 `reproducible` 两个字段，
  CLI 加 `--seed` 且声明改成 `conditional`（requires: seed）。
  算法（FNV-1a 哈希 + mulberry32）**钉死在实现里**，不借用任何随平台变化的东西 ——
  「可复现」若只在一台机器上成立，那不叫可复现；测试写死了一个具体牌面，换 PRNG 就会红。
  seed 超过 200 字符或类型不对返回 400，**不静默截断**（截断会让两个不同的 seed
  悄悄给出同一副牌）。
- 上述四项的口径全部进 `constants/rulings.js` 真源（`BAZI.specialPattern` /
  `LIUYAO.seasonalState` / `QIMEN.seasonalState` / `ZIWEI.palaceSihua` / `TAROT.seed`），
  并由 `rulings_lock.test.js` 锁定 key；行为由 `backend/test/algorithm_depth_v2.test.js`
  的 25 条用例守着，其中旺相休囚死钉在「春木旺火相水休金囚土死」四句口诀的全部 25 组上。

对标六个公开术数项目后补齐的算法深度。补的都是**确定性可算、无流派分歧、
此前逼调用方自己重算**的结构量；有流派分歧的命名（奇门格局、紫微庙旺、姓名数理吉凶）
一律仍不做。全部改动由 `backend/test/algorithm_depth.test.js` 的 53 条用例守着，
新增口径**全部**同步进 `constants/rulings.js` 真源：tiaohou / monthlyStructure /
奇门八神与入墓 / 门迫方向（宫克门）/ 紫微年解 / 八宅宅卦（坐山归卦）/
择吉方位立春界与紫白公式 / 六壬三传六亲（日干为我）/ 六爻进退神八组与伏吟动爻闸，
并由 `rulings_lock.test.js` 锁定 —— 其中紫白公式与门迫方向两条是行为级断言，
不只锁 key 名。

- **八字·月令取格**。此前从四柱直接跳到身强身弱，等于跳过了子平法的整个格局层。
  新增 `analysis.monthlyStructure`：`facts` 是无流派分歧的结构事实（月令藏干各是什么、
  透在哪一柱、什么十神），`suggested` 是按《子平真诠》一派推出的格。「透」只算年月时
  三干 —— 日干是我，我不能同时是我的格。
- **八字·调候用神**。`determineUsefulGod` 遇中和局本来就写着「宜改用调候」然后没有下文；
  现在补上《穷通宝鉴》十干十二月共 120 格的表（`constants/geju.js`），与扶抑并列给出，
  并标出该用神是否已透于四柱或藏于四支。
- **八字·胎元 / 胎息 / 命宫 / 身宫**。四者判据各不相同（胎元由月柱、胎息由日柱、
  命宫身宫由月支与时支且宫干起五虎遁），故自己算而不透传库函数 —— 海外出生时年月柱与
  日时柱分属两个坐标系，透传会串。测试逐项与 lunar-javascript 比对。
- **紫微·三方四正**。本宫 + 对宫(+6) + 三合(±4)，每宫展开成星曜清单并标出所属角色。
  纯几何、零分歧，此前不给等于每个调用方各写一遍各错一遍。
- **紫微·命主身主与二十颗乙级星**。命主按命宫地支、身主按生年支。乙级星含红鸾天喜、
  天刑天姚、天哭天虚、三台八座、恩光天贵、台辅封诰、龙池凤阁、天巫、阴煞、破碎、
  解神（年解）、孤辰寡宿，每颗附安星规则 `basis`。另加长生、博士、岁前、将前四组十二神。
- **奇门·盘面关系量**。此前每宫只给六个孤立的值，断奇门断的却是它们之间的关系。
  现在每宫附 `relations`：天地盘干生克、星宫与门宫生克、门迫（宫克门）、宫内伏吟、
  旬空、驿马、天盘干入墓、六仪击刑。顶层另给时旬空亡与驿马的落宫。
- **六壬·三传的遁干、天将与六亲**。三传此前只有支，断课无从下手。遁干按日干支所属之旬
  取（落旬空的支取不到，与 `isXunkong` 互为印证），天将按该支在天盘上所压的地盘位取，
  六亲以**日干**为我（六爻以本宫为我，两者判据不同）。四课上神同样带这三项。
- **六爻·爻与爻之间**。此前只算月建日辰这两个外力，不算盘内的力。现在给出动爻对他爻的
  生克、六爻之间的冲合、六冲卦与六合卦标记（本卦与之卦分别判）、动爻的进神/退神/
  爻伏吟/爻反吟，以及内外卦的伏吟返吟。
- **八宅·宅卦**。此前只有命卦这一半，「这房子对我合不合」答不了。新增 `--sitting`
  收卦名 / 二十四山 / 方位 /「子山午向」四种写法，排出宅卦、向、东西四宅与宅的八方游年，
  并论命宅相配。认不出不报错，`houseResolution` 标 `unresolved`。
- **择吉·宜忌与三层结构**。黄历此前缺了最该有的一层：宜忌。现在按论日 / 论时 / 论方
  三层给全 —— 宜忌、日冲日煞、黄道黑道十二神、日吉神方位、十二时辰各自的吉凶与宜忌
  （**十三条不是十二条**，子时跨两日分早晚子且时干不同），以及流年方位煞：太岁、岁破、
  三煞、入中紫白星与九宫飞星盘、五黄二黑落宫。入中星按公式算不查表。
- **易经·互卦 / 错卦 / 综卦**。六位二进制的位运算，却是断卦的基础参照。

### Changed

- **合盘补上出生地与时区**（`--a-location` / `--a-timezone` / `--b-location` /
  `--b-timezone`）。此前合盘吃不到真太阳时，而 `calc bazi` 给了地点会吃 ——
  同一个人在两条路径下可能得到不同的时柱，且不报错。西部地区回拨能超过两小时。
- 各命令的文本输出同步展开新字段（八字的格局与调候、紫微的三方四正与命主身主、
  奇门的关系标记、六壬三传的遁干天将六亲、六爻的动爻作用与卦变方向、黄历的三层）。
- `SKILL.md` 的流派口径表补 14 条（奇门八神取白虎玄武、奇门入墓按五行墓库、
  门迫是宫克门、八字取格与调候的所宗版本、紫微解神只取年解、择吉方位以立春为界等），
  并把「结构归引擎、断语归调用方」这条线拆成「给什么 / 不给什么」两张表 ——
  分界不是「凡带吉凶字样一律不给」，而是看那句话是谁说的：客观关系与通书条目照给，
  吉凶评价与分歧命名不给。

- 文档体系按当前代码重铺：新增 `docs/README.md`（地图与同步约定）、
  `docs/modules.md`、`docs/configuration.md`、`docs/deployment.md`、
  `docs/operations.md`；清掉已删除的 `stack --only api` 写法、历史旧
  仓库地址，以及 README 里与现行 `LICENSE`（MIT）不符的
  历史授权表述。CI 增加 `scripts/check-docs.sh`。
- `scripts/check-docs.sh` 从固定字符串黑名单扩成解析式核对（`scripts/check-docs.mjs`）：
  文档里每一条相对链接、`npm run` 脚本、`./bazi` 命令都要能在仓库里解析到真东西。
  只用 node 内置模块，在 CI 里跑在 `npm ci` 之前。它当场抓到的第一个真问题就是下面
  那条 `generate:openapi`。
- `scripts/check-env-template.sh` 多守一侧：变量不仅要写进 `env.production.template`，
  还必须出现在 `docker-compose.prod.yml` 的 backend `environment` 段。只写模板不透传的
  变量，操作者设了也不会进容器（`--env-file` 只喂 compose 自己的变量替换）。
  同时清掉 IGNORED 里随存储层删掉的 `DATABASE_URL` / `PGUSER` / `PG_TEST_*` / `BAZI_PG_*`
  ——现在后端读的 42 个变量一个不漏地被覆盖。
- `docs/configuration.md` 补上只给 CLI 用的变量（`BAZI_CLI_TRACE`、
  `BAZI_CLI_STREAM_CHILD`、`NO_COLOR`），并写明 `BAZI_API_URL` 缺省会退到
  `BACKEND_BASE_URL` —— `.env` 里留着线上域名时 `./bazi calc` 会静默打到线上。
- 更名与改协议时漏掉的字：`CLAUDE.md` 与 `docs/faq.md` 还写着「私有」（现行 LICENSE 是
  MIT）；`backend/package.json` 的 `license` 还是 `UNLICENSED`；`README.en.md` 的 License
  段还留着「all rights reserved」和一句已不存在的授权边界说明；
  `.claude/skills/bazi-cli/SKILL.md` 的标题与 description 还叫 `bazi-master`。

### Fixed

- **`apiSchema` 里六壬的能力描述是错的**：写着「涉害、昴星、别责、八专、伏吟、返吟
  六门未实现，遇到时 `supported` 为 false」，而九宗门其实早已全备。照着这份 schema
  接入的调用方会为一个不存在的降级路径写兜底。
- 奇门中五宫恒被报成伏吟。中宫的天盘干本就取自己的地盘干（中宫不参与转盘），
  不设闸的话每一局中宫都是「天地盘同干」—— 那不是伏吟，那是它不转。
- 六爻里未动的内卦或外卦恒被报成伏吟。静卦的三支必然与自己相同，判伏吟的前提是
  这一卦里有爻在动。
- 八宅的宅卦此前会被称作「东四命」。`GROUP_NAMES` 补 `houseCn`，人说命、房子说宅。

- **`npm -C backend run generate:openapi` 此前并不存在**。`docs/README.md`、
  `docs/development.md`、`CONTRIBUTING.md` 和 PR 模板都让人跑它，跑出来是
  `npm error Missing script`。补上该脚本，CI 那步也改成跑同一条命令，
  三处指向同一个真源。
- README 把 `BACKEND_BIND_ADDR`（compose 发布到宿主的网卡）写成了「服务默认只绑定
  127.0.0.1」。Node 进程听哪儿是 `BIND_HOST`（生产默认 `0.0.0.0`），两个都改错才会
  把引擎晾到公网上，说清楚区别。
- `docs/configuration.md` / `docs/development.md` 只写了开发放行 `localhost:3000`，
  实际还放行 `127.0.0.1:3000`。
- `TODO.md` 的「已完成」有一整块条目重复了两遍；覆盖率数字按实测更新
  （lines 93.03 / branches 83.42 / functions 92.23）。

- **姓名外格**改为 `天格 + 地格 − 人格`（单姓单名恒为 2）。旧式 `总格 − 人格 + 1`
  在单姓单名得 1、复姓双名多 1，个位五行会静默偏一档。
- **紫微年干支**改为农历年（正月初一换年），不再用立春派 `eightChar.getYearGan()`。
  立春后～春节前窗口原先年干已翻、农历月日未翻，整盘四化/禄存/五行局会静默全偏。
- **奇门 / 六壬子时**：23 点按子初换日，与次日 0 点同盘（日干支、符头一致）。
- **六壬遥克**多课俱比时只在比用集合上涉害（与贼克路径同构）；涉害候选上神去重；
  伏吟/返吟有克走完整贼克→比用→涉害链。
- **六壬八专日**：`BAZHUAN_DAYS` 改为由 `STEM_LODGING` 推导；旧表误收乙卯/戊戌/辛酉、
  漏乙辰等，无克时会强制错课体。
- **性别**：全站 `normalizeGender`（male/female/男/女）；`Male` 不再静默按女排大运。
  合盘控制器同步拦截，非法性别返回 400 而不是让 `performCalculation` 抛成 500。
- **时区以中国为主**：默认输入为北京时间墙钟；中国地点缺 timezone 时默认
  `Asia/Shanghai` 做真太阳时；海外须显式 timezone；仅中国 IANA/裸 +8 跳过二次换算。
- **海外出生分两个时刻**：年柱月柱与起运换算到东八区再比节气（节气是绝对时刻），
  日柱时柱仍按**当地**时辰。只换一个会把纽约上午排成北京次日子丑时。
  换算结果回显在 `chartTime.termReference`，与 `chartTime.used` 可对照；国内两者相同。
- **八字**：显式 `setSect(2)` 钉死晚子；`getYun(gender, 2)` 按分钟起运；天乙贵人兼查年干。
- **择吉年柱**改立春界；**六爻伏神**一亲一条；奇门/六壬 HTTP 接通 `minute`；
  梅花时间起卦可指定年月日时（可复现）。
- 补充主流口径金标准回归测试 `algorithm_mainstream_regression.test.js`。

## [0.3.0] - 2026-07-29

### Added

- **`/metrics` now reports request volume, error rate, latency and rate-limit rejections.**
  Everything it exposed before described the _process_ — it is up, it has this much memory,
  its dependency answered a ping — and nothing described the work. That left one failure
  mode entirely unobservable: an instance that is alive, whose only dependency is a healthy
  optional cache, and which answers 500 to every request looks perfectly healthy through
  every signal in the stack. `/live` and `/health` both return 200, `bazi_up` is 1,
  `bazi_dependency_up` is 1, so the container healthcheck stays green, autoheal leaves it
  alone and the load balancer keeps sending traffic. No alert could fire, because nothing
  was measuring requests — while `PRODUCTION.md` already told operators to alert on error
  rate and p95, neither of which the engine emitted. Four new families close that:
  `bazi_http_requests_total{status_class}`, `bazi_http_request_duration_seconds` (a
  histogram, for `histogram_quantile`), `bazi_http_rate_limited_total` and
  `bazi_http_requests_in_flight`, with ready-made alert rules in `PRODUCTION.md`.
  Deliberately **not** labelled by route: the API is public and unauthenticated, so the
  standing background of scanners probing invented paths would mint a time series each and
  kill Prometheus on cardinality long before volume — "which endpoint" is a question for the
  logs, which carry the full URL and a request id. Probe paths are excluded for the same
  reason the access log skips them: in a quiet hour they are most of the traffic, and
  counting them would pull the latency histogram toward "trivially fast" and dilute the
  error rate with requests no caller made. All four status classes are emitted even at
  zero, so `rate(...{status_class="5xx"})` returns 0 rather than no-data — an absent series
  makes an error-rate alert unable to fire until after the first error.
- **CI builds the production image and smoke-tests it in production mode.** Everything else
  in the pipeline runs the engine from a source checkout in development or test mode, but
  operators deploy an image and run it with `NODE_ENV=production`, which reaches code paths
  nothing else does. Two shipped defects lived in exactly that blind spot — an unbuildable
  Dockerfile and a production boot whose probes all returned 500 — and both survived a fully
  green suite. The new `image` job builds `backend/Dockerfile`, starts the container
  **without Redis on purpose** (the configuration the docs call optional and the one that was
  broken), and asserts the probes, the `/metrics` and `/api-docs` auth defaults, a real chart
  calculation, and a clean exit code after `docker stop` — which also covers the SIGTERM
  forwarding that `scripts/start.mjs` exists to provide. The container does not inherit the
  runner's `CI=true`, so it sees production exactly as a deployed instance does.
- **`bazi schema` exports the command tree as agent tool definitions** (Anthropic, OpenAI or
  MCP shape), so an agent runtime's tool registry can load this project's capabilities without
  reading `help --json` and translating it itself. Generated from the same tree the help
  command serves — there is no second, hand-written list to drift. Purely local; the engine
  does not need to be running. Capability commands only by default: the ops commands mutate
  this repository and one of them is destructive, so they take an explicit `--scope ops`.
  The `--json` envelope carries a `catalog` alongside the paste-ready `tools`, mapping each
  property back to a flag or positional so a tool call can be turned into an argv without
  guesswork. Reproducibility is stated in each tool's own description, because the runtime
  loading the schema may never see the project's docs, and treating a result that changes
  between calls as a regression baseline is the most common way to misuse this engine.
- **Every executable command declares a side effect; every capability declares its
  reproducibility.** `effect` is one of `read-only`, `local-write` or `destructive`, and it is
  the single source for MCP's `readOnlyHint` / `destructiveHint`, for the `[破坏性]` marker in
  `--help`, and for the `destructive` boolean, which is now derived rather than written a
  second time by hand. It is graded pessimistically: `doctor` is `local-write` because
  `--fix` writes, even though the bare command only reads. Non-read-only commands also say so
  in their description, since the Anthropic and OpenAI shapes have nowhere to put an
  annotation. Both fields are inherited down the command tree, so a homogeneous subtree
  declares once, and a contract test fails the build if any executable command leaves `effect`
  unset — a permission check that reads "unknown" is a permission check that has stopped
  working.
- **`bazi test engine`** — a fourth test target that runs the capability commands against a
  live engine and asserts that everything declared reproducible really is (two consecutive
  calls, byte-identical output). This is the one piece of the exported metadata that can be
  wrong without producing a symptom: a caller adopts a "deterministic" capability as a
  regression baseline and finds out the next day. It is the only target that needs a running
  engine, so it is recorded as `skipped` (not `failed`) when there is none — `--fail-on-skip`
  turns that into a hard failure. CI starts an engine and runs it.
- **Required parameters are now declared, not just enforced.** Commands used to check for
  missing arguments inside their `run` body, which made the requirement invisible to anything
  reading the command tree — an exported schema would have claimed every parameter was
  optional. `required` (plus `choices` and `variadic`) now lives on the flag and argument
  specs, `parseArgs` enforces it centrally, and `--help`, `help --json` and `bazi schema` all
  read the same declaration. Contract tests assert both directions: every parameter the schema
  calls required really does fail with exit 2 when omitted, and none is required that the
  command's own first example does not supply.

- **Solar-term boundaries are now resolved to the minute, in one shared place.** Anything that
  splits on a solar term — BaZi year/month pillars, the Da Liu Ren month general, the Qi Men
  bureau, the Ba Zhai life trigram — used to compare _dates_, so the day a term falls on could
  not be told apart from the day before it. 立春 2024 lands at 16:27; a birth at 10:00 and one at
  17:00 that day belong to different years. `services/jieqi.service.js` now owns term resolution
  and the four call sites share it.
- Ba Zhai answers carry `lifeTrigram.precision` — `minute` (full birth time given), `day` (no
  time, so the term day is assumed to start at midnight) or `year` (only a year given, the
  立春 boundary was never applied) — plus `lifeTrigram.lichunAt`, the exact instant, so a caller
  can tell a solid result from one that needs the birth time pinned down. Reporting the
  precision beats silently picking a side.

- **Six new divination engines, and the shared 干支 foundation they sit on.** The engine
  previously covered BaZi and Zi Wei only; the traditional Chinese canon is now largely
  complete. A new `constants/ganzhi.js` + `services/ganzhi.service.js` layer holds what
  all of them share — 纳音 (sexagenary sound-elements), 藏干 (hidden stems with
  primary/middle/residual weights), 十二长生, the full set of stem/branch combinations,
  clashes, punishments, harms and destructions, 五行局 and 旬空. The 60 纳音 entries are
  verified entry-by-entry against `lunar-javascript`'s independent table, so a
  transcription slip cannot survive the test suite.
  - **六爻纳甲 (Liu Yao)** — King Fang stem-branch attachment: hexagram name, palace,
    world/response lines, 六亲, 六神, hidden spirits, 旬空, month/day influence on each
    line, moving lines and the resulting hexagram. Palace membership is _derived_ from the
    seven world-hexagram transformation rules rather than hard-coded as a 64-row table.
  - **大六壬 (Da Liu Ren)** — month-general-over-hour plate construction, stem lodging,
    the four courses, all nine gates of 三传 derivation, and the twelve generals.
  - **奇门遁甲 (Qi Men Dun Jia)** — 拆补法 bureau determination, the earth plate of three
    marvels and six instruments, 值符/值使, and 转盘法 rotation of the nine stars, eight
    gates and eight gods.
  - **八宅 (Ba Zhai)**, **择吉 (almanac)** and **姓名五格 (name grids)**.
- Endpoints: `POST /api/liuyao/chart`, `POST /api/liuren/chart`, `POST /api/qimen/chart`,
  `POST /api/fengshui/bazhai`, `GET /api/fengshui/almanac`, `POST /api/fengshui/name`.
  All are in the OpenAPI contract with their school-of-thought caveats spelled out.
- CLI: `calc liuyao|liuren|qimen|bazhai|almanac|name`, each with `--dry-run` and the
  established exit-code contract.
- BaZi gained an `analysis` layer — hidden-stem-weighted elements, day-master strength,
  favourable/unfavourable elements by the 扶抑 method, 神煞, 纳音, 十二长生, inter-pillar
  relations and 旬空 — plus exact luck-cycle start timing and per-year 流年.

### Changed

- **The project split in two.** The Web full-stack
  edition — the React frontend, the account system, Prisma and Postgres — was
  frozen at the `v0.2.0` line as a separate community Web UI starter.
  Everything built after that point lives here: Liu Yao stem-branch attachment, Da Liu Ren with all nine derivation gates, Qi
  Men Dun Jia, Ba Zhai, almanac day-selection and name grids; the Zi Wei star-placement
  rewrite and the BaZi strength, solar-term and true-solar-time corrections; and the
  capability CLI with its tool schema and MCP server. The split is one-way — the frozen Web UI starter does
  not track this repository's algorithm rulings, and its Zi Wei placement, BaZi strength and
  time-based I Ching casting still carry the defects fixed here.
- **Established the boundary the whole capability layer follows: structure belongs to the
  engine, interpretation belongs to the caller.** How a chart is _cast_ — 三传, star
  placement, bureau layout, 游年 — has one correct answer and must be exact. How a chart is
  _read_ — 庙旺利陷, Qi Men pattern names, the relative weight of 神煞 — differs sharply
  between schools, and embedding one school's take would hand callers a judgement with no
  traceable provenance. The engine therefore emits every ingredient an interpretation
  needs and stops there. This reframes the long-standing "庙旺 pending a source text" item:
  it is a deliberate boundary, not an outstanding gap. Where a _casting_ rule genuinely
  varies (hidden-stem weights, leap-month handling, 拆补法, 转盘法), the choice is annotated
  in place so switching schools touches one location.

- **The CLI safety boundary now guards `.env` instead of the database.** `exit 7` was
  attached to `db reset` / `db restore`; with those gone the contract would have become
  vestigial. It is re-anchored on `bazi env init --force`, which overwrites the one file
  in the repo holding real API keys. Both gates behave as before — `NODE_ENV=production`
  is a hard refusal, `--dry-run` previews without executing, `--yes` confirms — and
  `tools/cli/test/safety.test.mjs` covers the new target.
- `env.production.template` and `docker-compose.prod.yml` rewritten against what the code
  actually reads. Dropped the postgres service, its volume, the backup cron variables,
  Prisma pool tuning, and every session / OAuth / SMTP / cookie key. `DOCS_PASSWORD` is
  now `${DOCS_PASSWORD:?...}` in compose, matching the server's own startup validation —
  it is the single hard requirement in production. Redis persistence is off (`--save ''`)
  because the only thing in it is a recomputable chart cache.
- `bazi env check` validates per `NODE_ENV` rather than against a fixed list: nothing is
  required in development, and only `DOCS_PASSWORD` in production. Same rule as
  `server.js`, so the two can no longer disagree.
- README, README.en, `llms.txt`, `docs/api.md`, `docs/architecture.md`,
  `docs/development.md`, `docs/faq.md` and `PRODUCTION.md` rewritten around the stateless
  capability layer. The endpoint list is regenerated from the actual routes — the old
  `docs/api.md` documented 60-plus endpoints, more than half of which (auth, records,
  favorites, user settings, media, admin) no longer exist.

- `./bazi stack` manages `db` and `api` only; the `web` component and its vite process
  management are gone. `./bazi setup` drops `--with-frontend`, `./bazi doctor` drops the
  `deps:frontend` / `port:frontend` / `e2e:browsers` checks, and `./bazi test` narrows to
  `cli` / `lint` / `backend` — with `--all` removed, since it no longer selects anything
  the default run does not already cover.
- `./bazi verify` discovers `backend/scripts/verify-*.mjs` only.
- CI drops the frontend install/unit/E2E steps and gains the CLI contract tests, which
  previously ran nowhere.
- `FRONTEND_URL`, `WECHAT_FRONTEND_URL` and `CORS_ALLOWED_ORIGINS` are **kept** and keep
  their behaviour — they are the OAuth callback target, the CORS allow-list, and the
  origin used in outbound email links. Their meaning is now "the origin of the client
  application calling this API" rather than "the UI we ship"; documentation reworded
  accordingly.

### Fixed

- **A production instance without `REDIS_URL` failed every deep health probe.**
  `config/redis.js` threw `REDIS_URL is required for production sessions.` whenever
  `NODE_ENV=production` and no URL was set — a rule inherited from the session layer, when
  Redis held state the service could not be correct without. Redis is now a pure cache, and
  `PRODUCTION.md`, `validateProductionConfig` and `docker-compose.prod.yml` all describe it
  as optional, but the throw outlived the sessions. `checkRedis` calls `initRedis` with no
  arguments, so the rejection propagated out through `getHealthSnapshot` into the handlers:
  `/health`, `/api/ready` and `/metrics` all answered 500 while `/live` and every business
  endpoint worked. A load balancer reading `/api/ready` never puts such an instance into
  service, so the deployment mode the docs call optional could not serve a single request,
  and `/metrics` being 500 meant the monitoring that would have shown it was dark too.
  Only an explicit `require: true` throws now. Two things hid this: the guard exempted
  `CI`, and the reference compose stack pins `REDIS_URL`, so neither the suite nor the
  reference deployment ever took the path. A test asserted the throwing behaviour, so the
  bug was green.
- **The production image could not be built at all.** `backend/Dockerfile` still ran
  `apk add openssl`, `COPY prisma ./prisma/` and `RUN npm run prisma:generate`, all three
  left behind when the storage layer was deleted. There is no `prisma/` directory and no
  `prisma:generate` script, so `docker build` failed on the COPY — meaning the documented
  deploy command, `docker compose -f docker-compose.prod.yml up -d --build`, produced
  nothing. No CI job built this file, which is why it went unnoticed. Dependencies now
  install with `--omit=dev` as well: the only devDependency is the test runner's supertest,
  and shipping test tooling in a production image is dead weight and extra attack surface.
- **`bazi_rate_limit_degraded` was pinned at 1 on any deployment without Redis**, and the
  limiter logged `[rate-limit] Redis unavailable` at error level every 60 seconds about a
  Redis that was never configured. The `BaziRateLimitDegraded` alert recommended in
  `PRODUCTION.md` therefore fired on day one and never cleared. Degradation now means what
  it says — Redis was configured and did not answer. Running without it is a supported
  single-instance mode, and its one real consequence (the quota is enforced per instance,
  so N instances allow N × `RATE_LIMIT_MAX`) is now stated in the startup warning instead,
  once, where it belongs. The limit itself is unchanged and still enforced from the
  in-memory store.
- **The safety-gate tests silently required a `.env` to already exist**, which made them pass
  on any developer machine and fail in a clean checkout. `env init --force` is only
  destructive when there is a file to overwrite — with no `.env` it is equivalent to a plain
  init and exits 0 — so every case that used it as "the command that exits 7" was asserting
  against a precondition it never established. The first such case then created a `.env` as a
  side effect, which is why only one of them failed rather than all of them. The precondition
  is now set up explicitly (`ensureEnvFile`, idempotent, touches nothing if the file exists).
  This never surfaced because the CLI contract tests had never actually run in CI: the
  backend step ahead of them failed first.
- **The backend suite never ran on Node 20 in CI.** The test scripts passed a quoted glob
  (`node --test "test/**/*.test.js"`); expanding that pattern is a Node 21+ feature, so on
  Node 20 it is taken literally, the runner prints `Could not find …` and exits 1. The 20.x
  leg of the CI matrix therefore reported a failure that looked like a broken suite and was
  in fact a suite that had never started — and since `engines` declares `node >= 20`, the
  oldest supported version was the one going unverified. All three scripts now pass a shell
  glob instead, which every version expands identically; verified against a real Node 20.19
  runtime (512 backend, 114 CLI, 11 engine tests all pass).
- **The exported tool schema classified reproducibility by subtree, and was wrong in both
  directions.** Everything under `calc` was labelled deterministic and everything under `cast`
  not reproducible, which is a property of where a command sits in the tree rather than of what
  it does. `calc daily` has no date parameter at all — its day pillar is always the engine's
  today, so it can never be reproduced — yet it was advertised as a valid regression baseline.
  In the other direction `cast iching --numbers` is pure calculation, and it is the only way to
  get a repeatable hexagram, but the schema said the opposite. Reproducibility is now declared
  per command in three grades (`deterministic`, `conditional`, `not-reproducible`), with
  `conditional` required to state its condition and, where applicable, list the parameters that
  make the result stable. `calc zodiac` is `conditional` too: `--horoscope` responses embed a
  date range computed from the engine's clock.
- **MCP's `readOnlyHint` was inferred from a command's category rather than read from a
  declaration.** "It is a capability command, therefore it is read-only" happens to hold today
  because the capability commands are pure calculation — but it is an inference, and the first
  capability command that writes anything would have made the field lie, silently, to the
  permission check that reads it. It is now derived from the declared `effect`, and the ops
  commands that genuinely are read-only (`stack status`, `stack logs`, `env show`, `env check`,
  `schema`, `help`) are finally labelled as such instead of being lumped in with the ones that
  start processes and rewrite `.env`.
- `bazi schema` had two tables of command names hard-coded in it, directly contradicting the
  note in its own header that the file contains no command names. The practical cost was
  silent: a newly added capability command would have defaulted to the ops category and simply
  never appeared in the default export. Both are gone; the command tree is the only input.

- **Da Liu Ren's 涉害 depth was computed along the wrong path and with the wrong tally.**
  Source material specifies walking _clockwise_ from the position the heaven-plate branch
  rides back to its home palace, and — the part most easily missed — the tally depends on
  the course type: for 下贼上 count how often the upper god is _controlled by_ the earth-plate
  branches en route, for 上克下 count how many it _controls_. The implementation walked
  counter-clockwise and always counted "controlled by", which inverts the depth ordering for
  the 上克下 case and therefore picks the wrong initial transmission. Both are corrected, and
  the two tallies are exposed as an explicit `mode` so the alternative "直取孟仲季" school —
  which does not walk home at all — can be layered on without touching this one.
- Stale comments in `liuren.service.js` still described the six later gates as unimplemented
  and claimed the module "covers only 贼克/比用/遥克", long after all nine were in place. One
  of them was an orphaned JSDoc block left sitting above an unrelated function.

- **Two Da Liu Ren three-transmission gates were ordered and gated wrongly**, found by
  verifying the implementation against source material rather than by any failing test.
  八专 (eight-specialists) is defined as "stem and branch share a position, no controlling
  relation among the four courses, **and remote control is not consulted**" — it must be
  decided _before_ 遥克, or an eight-specialists day gets intercepted by the remote-control
  gate and the course type comes out wrong. Separately, 别责 requires "one course short, only
  three remain", which is a duplicate _pair_ of upper and lower gods; testing only for a
  repeated upper god misclassifies charts where two courses share an upper god but differ
  below. Both are corrected and covered by tests.

- **The I Ching endpoint still served placeholder hexagram names.** Adding real names in the
  Liu Yao work left the repository holding two versions of the same data: the Liu Yao module
  knew 乾为天 while `GET /api/iching/hexagrams` answered `"Heaven over Heaven"` with a
  templated `summary`. The names now live in `data/ichingHexagrams.js` as the single source
  both read; each hexagram carries its Chinese name, King Wen number, and the old directional
  phrasing preserved under `nameEn` for callers that were matching on it.
- **Synastry compared only the _elements_ of the day pillars.** Its own comment admitted it —
  "for now we'll do a basic element check". But element relations cannot express what matters
  most in a compatibility reading: 子 and 丑 are "water generates earth" _and_ a six-combination;
  子 and 午 are "water controls fire" _and_ a clash. The element view sees no difference.
  Rewritten on the ganzhi foundation: day-master ten-gods in both directions (they are not
  symmetric), the spouse palace's six-combination / triple / half / clash / punishment / harm,
  cross-pillar relations labelled by which two pillars, and elemental complement computed from
  hidden-stem weights rather than the coarse count-based percentages. `score` remains, but it is
  now folded from those relations with the weights returned alongside it.
- **The daily-fortune helper kept a second, romanised clash table.** It duplicated the one in
  `constants/ganzhi.js`, and being clash-only it could not see combinations, punishments or
  harms. It now goes through `detectBranchRelations`, and the response carries the objective
  relations next to the score.
- `docs/architecture.md` still listed `birthTime.service`, a file that had been deleted, and had
  not been told about any of the new modules. Its service table, directory tree and
  `llms.txt`'s feature list are back in sync with the code.
- The OpenAPI spec had drifted from what the engine actually returns: `BaziCalculation` was
  missing `analysis`, `chartTime` and `luckStart`; `Hexagram` was missing the real name and
  sequence; synastry and calendar responses were described by a bare `score`.

- **Zi Wei Dou Shu was placing every star incorrectly.** This was not a precision gap; the
  chart was wrong. 紫微 was located by `month branch + (lunar day − 1)`, a formula with no
  basis — the orthodox method derives the 五行局 from the 纳音 of the life-palace's
  stem-branch and positions 紫微 from the bureau number. With the anchor star wrong, all
  fourteen majors followed. Also corrected: 天府 mirrors 紫微 across the 寅–申 axis rather
  than sitting at `+6`; the 紫微 group runs _counter_-clockwise (天机 −1, 太阳 −3, 武曲 −4,
  天同 −5, 廉贞 −8); 破军 is `天府 + 10`, not `+7`; and the eight auxiliary stars follow four
  _different_ rules (昌曲 by hour branch, 辅弼 by lunar month, 魁钺 by year stem) where the
  old code applied a single shared offset. Added 五行局, the six malefics, 大限, 小限 and 流年.
- **True solar time was computed and then ignored.** `trueSolarTime.applied: true` meant
  "the correction was calculated", not "this chart used it" — the pillars were still built
  from wall-clock time. Documentation said as much, which made it a known-but-unfixed
  defect rather than a surprise. The correction now feeds the chart; `chartTime.used`
  reports the instant actually used and `chartTime.trueSolarTime.clockTime` preserves the
  original. In western China the shift exceeds two hours, which moves the hour pillar.
- **The BaZi cache key did not cover every input to the chart.** Once true solar time
  participates, birthplace, minute and timezone are chart inputs; without them in the key,
  two people born at the same clock time in different cities collide on one cached chart.
  The key now appends them, and `SKILL.md` — which had predicted exactly this failure —
  documents the new contract.
- **The sixty-four hexagrams had no real names.** `data/ichingHexagrams.js` generated
  `name: "Heaven over Fire"` and a template `summary` for each of the 64 combinations.
  Chinese names and King Wen sequence numbers are now present, verified by an automated
  check: every non-doubled hexagram's name begins with its upper and lower trigram images
  (坎 over 震 = 水雷屯), which catches any mis-pairing without manual review.
- **`HEAD` could not run `npm test` from a clean checkout.** The earlier
  front-end/account-system removal committed the code deletions but not `backend/package.json`:
  its `test` script still pointed at the deleted `scripts/run-tests-with-db.mjs`, and
  `@prisma/client`, `cookie-parser`, `nodemailer` and `ws` were still listed as
  dependencies. A local run masked this because the old packages were still installed in
  `node_modules`; a fresh worktree surfaced it immediately. CI would have failed on its
  first step.
- CLI output claimed "the correction is advisory, the pillars above use wall-clock time"
  long after that stopped being true. Stale output is worse than no output, because it
  reads as authoritative.

- `scripts/verify-deployment.sh` had three defects that made it structurally incapable of
  passing, on a healthy deployment: its log helpers wrote to stdout, so every
  `$(http_request ...)` capture came back with `[INFO] Attempting GET ...` glued to the
  front of the JSON and **every** `validate_json` call reported "key not found";
  `validate_json` declared `local expected_value=$3` under `set -u`, so any two-argument
  call aborted the entire run; and `"${auth_args[@]}"` on an empty array is an unbound
  variable under bash 3.2 (macOS), killing the OpenAPI check. Logging now goes to stderr,
  the third parameter defaults, and the array expansion is guarded. The script's own
  content was also brought up to date — it no longer asserts that `/api/tarot/cards`
  requires authentication, no longer probes `/api/auth/*`, no longer reads
  `checks.db.ok`, and no longer reports an unconfigured Redis as "connected and
  operational". Six checks, all passing against a live engine.

### Removed

- **The open-source infrastructure, which stopped meaning anything once the repository went
  private.** `llms.txt` existed so search engines and external agents could index a public
  project; there is no discovery surface any more. `SECURITY.md` described how an outside
  reporter should disclose a vulnerability, and there are no outside reporters — its other
  two sections were checked before deleting rather than assumed disposable: the deployer
  checklist was already covered, in more detail, by `PRODUCTION.md` §7 (particularly the
  `TRUST_PROXY` hop-count reasoning), and its one genuinely new line, running
  `npm audit --omit=dev` in the release pipeline as well as in CI, was moved there. The four
  `.github/ISSUE_TEMPLATE/` forms went with them. `.github/PULL_REQUEST_TEMPLATE.md` stayed:
  it is a real self-check list — algorithm changes need a canonical source, interface changes
  need `docs/openapi.json` regenerated, school rulings need syncing into `SKILL.md` — and
  that applies no matter who is writing the change. The SEO keyword blocks in both READMEs
  and in `docs/faq.md`, and the 37 npm keywords, went the same way.
- **Every artifact that documented or operated the deleted storage layer.** Removing the
  database left a trail of files that still described a system that no longer exists —
  the most expensive kind of documentation, because it reads as authoritative. Deleted:
  - `scripts/backup-db.sh`, `restore-db.sh`, `cron-backup.sh`, `install-cron.sh` and
    `failure-simulation.sh` — all of them drove `pg_dump`/`psql` against a database that
    is gone.
  - `docker/postgres-init/`.
  - `docs/production-ready.md`, `docs/production-runbook.md`,
    `docs/backend-reliability.md` and `docs/monitoring-guide.md` — roughly a thousand
    lines whose substance was PostgreSQL backup, restore, migration, connection-pool
    sizing and capacity planning. What survived (health-probe wiring, drain timing,
    `/metrics` alerting) is folded into `PRODUCTION.md`.
  - `./bazi db` and `./bazi verify` command trees, plus `core/prisma.mjs` and
    `helpers/local-pg.mjs`. `bazi doctor` no longer checks for a Prisma Client or a
    reachable PostgreSQL, `bazi setup` no longer generates a client, `bazi stack` manages
    a single `api` component (so `--only` is gone), and `bazi test` drops `--use-dev-db`
    — there is no dev database to protect any more.
  - `OAUTH_FETCH_TIMEOUT_MS` in `backend/utils/http.js`, exported but imported nowhere
    since the OAuth service was deleted.

> earlier in this cycle

- **BREAKING — the bundled React frontend is gone.** The project is a professional
  calculation engine, delivered as a documented HTTP API for applications and AI agents;
  the UI was never the value, and shipping one blurred the boundary of the capability
  layer while costing a full browser toolchain to maintain. Deleted `frontend/` in its
  entirety — the React app, 91 Playwright specs, 19 `verify-*.mjs` browser checks, its
  Dockerfile and `nginx.conf` — 232 files in all. Anyone who was running the bundled UI
  should pin the previous tag or build their own client against `docs/api.md` and
  `docs/openapi.json`; the API itself is unchanged.
- The `frontend` service in `docker-compose.prod.yml`, along with `FRONTEND_BIND_ADDR`
  and the `VITE_*` build args. TLS termination and the public edge now belong entirely
  to a reverse proxy you run yourself.
- Per-source-IP WebSocket limiting went with `frontend/nginx.conf`. `WS_MAX_CONNECTIONS`
  still bounds the process as a whole, but nothing now stops one client from holding
  every slot — configure `limit_conn` at your own edge if that matters to you.
- `docs/performance-audit.md`, which measured frontend bundles and Playwright runs.

## [0.2.0] - 2026-07-28

Production-readiness pass. No API changes — every item below closes a gap that would
have surfaced during a deploy or under real traffic. Two entries do change runtime
behaviour under load rather than merely fixing something: connections beyond
`WS_MAX_CONNECTIONS` globally, or beyond 10 per source IP, are now refused with a 503.
Both were previously unbounded.

### Added

- Per-source-IP ceiling on WebSocket connections (`limit_conn ws_per_ip 10` in
  `frontend/nginx.conf`). The backend's `WS_MAX_CONNECTIONS` bounds the process as a
  whole but does nothing to stop one client from holding every slot — and since the
  `/ws/ai` handshake is unauthenticated (path and Origin only, and a client that sends
  no Origin is let through), doing so requires nothing at all. Verified end to end
  against a real nginx: the 11th connection gets a 503 and closing one hands the slot
  straight back. Where the container sits behind another proxy this needs
  `set_real_ip_from` first, or every user shares one counter; the commented lines are
  in place for that.
- Explicit `ulimits.nofile` (65536) on both application containers, rather than
  inheriting whatever the daemon happens to default to. Each WebSocket connection costs
  one descriptor in the backend and two in the nginx container, and measurement puts an
  idle connection at ~9KB RSS — 500 of them is ~4.4MB against a 1g limit, so the
  descriptor table is what runs out first. It fails as `EMFILE` with every `accept()`
  failing at once, which is considerably harder to read than an OOM.
- Indexes on `userId` for `BaziRecord`, `TarotRecord`, `IchingRecord` and `ZiweiRecord`,
  and on `Favorite.recordId`. PostgreSQL does not index foreign keys automatically, so
  every history listing was a sequential scan plus a sort over the whole table.
  Migration `20260728022702_add_user_id_indexes` is purely additive.
- Connection draining on SIGTERM (`SHUTDOWN_DRAIN_MS`, default 5000 in production).
  `/health` and `/api/ready` report 503 with `status: "shutting_down"` immediately, while
  the process keeps serving, so a load balancer can drain the instance before its socket
  closes. `/live` deliberately keeps returning 200.
- An idle deadline on streamed AI responses. The existing timeout only covered the
  response headers; a provider that stalled mid-stream held the connection — and the
  caller's single-in-flight AI slot on `/ws/ai` — until the process restarted.
- `WS_MAX_CONNECTIONS` (default 500). The `/ws/ai` upgrade handshake is served before
  Express and never passes through the HTTP rate limiter, so nothing previously bounded
  socket memory. Over the limit the handshake gets a 503 rather than a bare reset.

### Fixed

- The backend container's healthcheck used `/api/ready`, a deep check, and that
  healthcheck drives autoheal. A brief database outage therefore restarted the backend,
  which then exits at startup when it cannot reach the database — turning a self-healing
  blip into a `restart: always` crash loop. It now uses `/live`.
- The backend image started via `npm run start`, putting npm and a shell between PID 1
  and `scripts/start.mjs`. Neither reliably forwards SIGTERM, so the graceful shutdown
  that script exists to enable never ran and Docker SIGKILLed the tree instead.
- `index.html`, `sw.js`, `registerSW.js` and `manifest.webmanifest` are served
  `no-cache`, and `/assets/` (content-hashed) `immutable`. Without this a cached
  `index.html` outlives a deploy and requests chunks that no longer exist — a blank page
  until the user hard-refreshes.
- The session cookie's `maxAge` was pinned at 30 minutes while the server expired
  sessions at `SESSION_IDLE_MS`. Raising that value silently did nothing: the browser
  still dropped the cookie on the old schedule.
- `client_max_body_size` in the frontend nginx config was 50m against a 1mb backend
  limit, so oversized bodies were buffered in full before being rejected. Now matched.

### Tooling — `./bazi` CLI

Developer/agent tooling only; the deployed application is untouched.

- A contract test suite for the CLI itself (`tools/cli/test/`, `./bazi test cli`, ~2s).
  It pins the three things every caller depends on and nothing previously guarded:
  exit-code semantics, "`--json` writes exactly one JSON document to stdout", and the
  destructive-command safety gate. It also checks the capability listing is
  self-consistent — every example command and flag in `bazi help --json` must actually
  resolve, and no command-local flag may shadow a global one.
- `bazi help --json` now includes `tree.globalFlags`. It was documented as the single
  source of truth for what the CLI can do, but omitted `--json`, `--quiet`, `--dry-run`,
  `--yes` and `--help` entirely — so a caller reading only the JSON could not discover
  `--yes`, the one flag that resolves an exit 7.
- `--dry-run` no longer requires `--yes` on `db reset` / `db restore`, and no longer
  requires a reachable database. The blocked-command hint told the caller to add
  `--dry-run` to preview, but the confirmation gate rejected that too and returned the
  same hint — a loop whose only exit was the `--yes` the gate exists to withhold.
  The other two gates are unchanged: `NODE_ENV=production` is still refused outright and
  a non-local `DATABASE_URL` still requires `--allow-remote`, dry run or not.
- `bazi <group>` and `bazi <group> --json` returned different exit codes (2 and 0) for
  the same input, and the `--json` form emitted a bare command tree instead of the
  `{ok, command, data}` envelope every other command uses. Both forms now exit 2 and
  share one envelope with `bazi help --json`.
- `bazi test` reports a target whose npm script is missing as `skipped` rather than
  `failed`. Those mean different things to the caller — one is "go install something",
  the other is "go read the code" — and `--fail-on-skip` now covers both.
- `bazi test` gained a `cli` target, first in the default set: if the tool itself is
  broken, every later result is suspect.
- `bazi stack up` no longer fails outright on a clean checkout. Starting the web
  component ran `npm run asbuild` whenever `public/wasm/optimized.wasm` was absent, but
  that script — along with the whole AssemblyScript chain — was deleted as dead code
  earlier; only this call site was missed. It had become exactly what that cleanup set
  out to remove: a mandatory build step that could only fail. Worse, it exited 3 and
  advised reinstalling frontend dependencies, which were never the problem.
- The CLI contract suite now also checks that what the CLI _invokes_ exists, not just
  that its command tree is self-consistent: every `bazi test` target must map to a real
  npm script, each target's declared script must match the args it actually runs, and
  any hardcoded `npm run` in the source is verified too. The `asbuild` breakage was
  invisible to the existing tests — the command tree was fine, what it reached for at
  runtime was not.

## [0.1.0] - 2026-05-19

First tagged release of BaZi Master — codifies the v0.1 reference implementation surface.

### Included

- **Five divination modalities**: BaZi (八字), Tarot (塔罗), I Ching (周易), Western astrology (星座), Zi Wei Dou Shu (紫微斗数)
- **Cross-modality**: Synastry (合盘) chart-pair analysis, daily fortune calendar (personalized when birth-date is supplied)
- **AI features**: AI interpretation for each modality, Soul Portrait (灵魂画像) AI image generation
- **WebSocket AI streaming** at `/ws/ai` (token-by-token)
- **Auth surface**: email signup/login, session tokens, logout, self-serve account deletion, password reset, Google + WeChat OAuth
- **User settings**: language + preference persistence (i18n via react-i18next)
- **History**: per-user record management with client-side search/filter, batch operations, favorites, snapshot saves; duplicate BaZi record detection on save
- **Operational endpoints**: `/live` (liveness), `/health` and `/api/ready` (deep checks), admin `/api/admin/health`
- **Tech stack**: React 18 + Vite + Tailwind frontend, Node 20+ + Express 4 + Prisma ORM + Pino backend
- **Storage**: PostgreSQL (the Prisma provider is `postgresql`; SQLite is not supported)
- **Redis**: sessions, BaZi cache, OAuth state, password-reset tokens. Falls back to in-memory in development; **required in production** — the server refuses to start without `REDIS_URL`
- **Testing**: Node native `test` for backend, Playwright for frontend E2E
- **Discovery**: bilingual SEO keyword block + `llms.txt`

### Notes

This is a **reference / sample project**. Output is generated by language models and astrology libraries — treat as cultural / entertainment, not life advice. Before publishing on any platform (Apple App Store, WeChat Mini Program, etc.) verify the platform's divination-content policy yourself.

## Pre-0.1.0 开发记录（2025-12）

下面这些改动都已经包含在上面的 [0.1.0] 里 —— 0.1.0 是首个打了 tag 的版本，把 v0.1 的
完整实现面一次性固化了下来。保留这一段只是为了追溯当时的 commit，**不是待发布内容**。

同理，下面的 `0.1.1` 和 `0.1.0-alpha` 是当时用过的编号，仓库里从未打过对应的 tag
（`git tag` 里只有 `v0.1.0` 和 `v0.2.0`），所以它们没有可跳转的比较链接。

### Added

- **八字重复检测**: 保存记录时自动检测重复，避免冗余数据 (`dc2cb8d`)
- **历史搜索过滤**: 客户端搜索过滤功能，提升历史记录查找效率 (`b2408b9`)
- **根级 ESLint/Prettier**: 统一代码风格配置 (`86ff089`)
- **React Router v7 兼容**: 测试工具添加 future flags 支持 (`1e3aa5f`)

### Changed

- **认证优化**: 移除冗余的 profileName 加载效果 (`bd4eea3`)
- **WebSocket 日志**: 降级 WS 错误为警告级别，减少日志噪音 (`cd78787`)
- **TypeScript 类型**: 前端工具函数替换 `any` 为正确类型 (`b030e1c`)
- **文档完善**: API/架构/开发/生产文档全面更新，添加目录导航和详细端点说明
- Lighthouse CI 配置改为静态 dist 服务并补充 headless flags（性能阈值暂降至 0.65）

### Fixed

- E2E 测试过滤 WebSocket 错误，提升测试稳定性 (`5595440`)
- 修正过时的文件和 API 引用
- 修复 OpenAPI 生成脚本的重复导入问题
- 消除前端单测的 `act(...)` 警告（AuthContext / useBaziCalculation）
- 为 Lighthouse 提供首屏占位（避免 NO_FCP）
- 生产环境禁用 Dev OAuth 直登（同时在回调中强制拦截）
- 日历日运接口校验出生参数完整性，避免 NaN 计算
- 灵魂画像在未配置 OpenAI 时自动降级到 mock provider
- OAuth state 与密码重置 token 镜像到 Redis，支持多实例一致性
- 生产校验新增 SMTP/Trust Proxy 要求，避免上线后密码重置与限流失效
- 密码重置邮件发送与会话 Cookie SameSite 可配置

## [0.1.1] - 2025-12-27

### Added

- **Production Readiness**: Added `/live` (liveness, process-only), `/health` (deep check) and `/api/ready` (readiness) endpoints.
- **Reliability**: Implemented Redis-based session storage and cache mirroring for multi-instance deployments.
- **Testing**: Configured Playwright retries and `data-testid` selectors for robust E2E testing.
- **Tooling**: Added `npm run analyze` for frontend bundle visualization.

## [0.1.0-alpha] - 2025-12-26

### Added

- Core domain modules: BaZi calculation & records, Tarot draw & history, I Ching divination, Zodiac info/horoscope/compatibility/rising, Zi Wei charting, Favorites.
- Authentication: register, login, logout, session token storage, self-delete.
- Health/readiness endpoints and basic rate limiting & CORS controls.
- Frontend React SPA with i18n, routing, and Playwright E2E specs.
- Prisma schema with initial migration targeting PostgreSQL.

[0.3.0]: https://github.com/qilaidev/metaphysics-engine/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/qilaidev/metaphysics-engine/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/qilaidev/metaphysics-engine/releases/tag/v0.1.0
