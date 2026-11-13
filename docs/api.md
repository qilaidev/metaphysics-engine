# HTTP API 导览

> 机器契约是 [openapi.json](openapi.json)。两边不一致时以它为准。

引擎是**无状态的纯计算服务**：不存数据、不认用户、没有数据库。
所有业务接口都是公开的 —— 没有注册、登录、会话、token，也没有历史记录、收藏、用户设置这些概念。
调用方（你的后端、你的客户端、或者一个 AI Agent）自己决定要不要保存结果。

唯一带鉴权的是 `/api-docs`（Basic Auth）和 `/metrics`（Bearer token），它们是运维面，不是业务面。

**机器可读的契约是 [openapi.json](openapi.json)**，运行时挂在 `/api-docs`。
这份文档是给人读的导览；两边不一致时以 `openapi.json` 为准 —— 它由
`backend/services/apiSchema.service.js` 生成，CI 会比对快照，不会腐化。

**流派口径真源是 `backend/constants/rulings.js`**。每个计算能力独立 module（八宅/
择吉/姓名分开，不混装），响应带 `school`：`module`、`boundary`、本能力相关
`shared`（无关则省略）、`rulings`。锁测试 `rulings_lock.test.js` 钉死 key 与数值。

闭环：`rulings.js` → service 实现 → 响应 `school` → 锁测试。

- Base URL（本地）：`http://127.0.0.1:4000`
- Swagger UI：`/api-docs`
- OpenAPI JSON：`/api-docs.json`
- 所有响应都是 JSON；时间戳用 ISO 8601

## 目录

- [约定](#约定)
- [八字 BaZi](#八字-bazi)
- [紫微斗数 Zi Wei](#紫微斗数-zi-wei)
- [六爻 Liu Yao](#六爻-liu-yao)
- [大六壬 Da Liu Ren](#大六壬-da-liu-ren)
- [奇门遁甲 Qi Men](#奇门遁甲-qi-men)
- [风水与择吉](#风水与择吉)
- [塔罗 Tarot](#塔罗-tarot)
- [周易 I Ching](#周易-i-ching)
- [星座 Zodiac](#星座-zodiac)
- [合盘 Synastry](#合盘-synastry)
- [日历 Calendar](#日历-calendar)
- [地点 Locations](#地点-locations)
- [AI 供应商](#ai-供应商)
- [健康检查与运维](#健康检查与运维)
- [错误格式](#错误格式)

## 约定

出生信息在所有排盘类接口里是同一组字段：

| 字段                    | 必填 | 说明                                                                    |
| ----------------------- | ---- | ----------------------------------------------------------------------- |
| `birthYear`             | ✓    | 1–9999                                                                  |
| `birthMonth`            | ✓    | 1–12                                                                    |
| `birthDay`              | ✓    | 1–31                                                                    |
| `birthHour`             | ✓    | 0–23                                                                    |
| `birthMinute`           |      | 0–59，默认 0                                                            |
| `gender`                | ✓    | `male` / `female`                                                       |
| `birthLocation`         |      | 地名或 `"纬度,经度"`。只用于真太阳时，认得的地名见 `GET /api/locations` |
| `timezone`              |      | IANA 时区名，如 `Asia/Shanghai`                                         |
| `timezoneOffsetMinutes` |      | 给了就优先于 `timezone`，供无法解析 IANA 名的调用方使用                 |

关于时刻，有两点要清楚（都不会报错，只会给出另一张盘）：

- **真太阳时参与排盘。** 只要 `birthLocation` 能解析出经度、且时区已知，四柱就按校正后的
  时刻排。经度每偏离标准经线 1 度差 4 分钟，中国西部足以把时柱推到隔壁一柱。
  响应的 `chartTime.used` 是实际用于排盘的时刻，`chartTime.trueSolarTime.clockTime`
  保留原始钟表时间，两者可直接对照。传 `trueSolarTime: false` 可关掉，退回按钟表时间排。
- **`birthMinute` 参与真太阳时，进而影响四柱。** 校正量按分钟计算，落在时辰交界上时，
  分钟会决定落在哪一柱。不给则按 0 分处理。

更多这类边界见 [.claude/skills/bazi-cli/SKILL.md](../.claude/skills/bazi-cli/SKILL.md)。

AI 解读类接口（`*/ai-interpret`、`full-analysis`）都接受一个可选的 `provider` 字段
（`openai` / `anthropic` / `mock`），覆盖服务端默认值；填了不可用的供应商返回 400。

## 八字 BaZi

### POST /api/bazi/calculate

排盘。请求体见[约定](#约定)。响应分两层：

- 顶层的 `pillars` / `fiveElements` / `fiveElementsPercent` / `tenGods` / `luckCycles` 是原有字段，
  语义未变（`fiveElements` 仍是天干与地支本气的**个数**统计，`fiveElementsPercent` 是它的百分比）。
- `analysis` 是断命层，也是该拿去做判断的那一份：
  - `weightedElements` — 藏干加权五行。天干各 1 分，地支按本气/中气/余气权重分配，
    月支当令 ×2。与 `fiveElements` 的个数统计不是一回事。
  - `strength` — 身强/身弱/中和，含同党占比、是否得令、在哪几柱有根。
  - `usefulGod` — 扶抑法用神喜忌。中和局不硬凑，`favorable` 给空数组，此时看 `tiaohou`。
  - `tiaohou` — 调候用神（《穷通宝鉴》表），与扶抑**并列**而非替代：扶抑论强弱、
    调候论寒暖燥湿。`stems[0]` 为主用，其余辅用；每条标 `revealed`（已透于四柱天干）
    与 `hidden`（藏于四支）。病药、通关法仍未实现。
  - `monthlyStructure` — 月令格局。`facts` 是无流派分歧的结构事实（月令藏干各是什么、
    透在哪一柱、什么十神），`suggested` 是按《子平真诠》一派推出的格。换派照 `facts`
    自行重推即可。「透」只算年月时三干 —— 日干是我，不算。
  - `keyPoints` — 胎元（月柱推）、胎息（日柱推）、命宫与身宫（月支时支推、宫干起五虎遁）。
  - `pillarDetails` — 逐柱的藏干全展开（含中气余气）、各自十神、纳音、日主在该支的十二长生。
  - `shensha` — 神煞，标注 `basis` 说明是按日干还是年支/日支起的。
  - `relations` — 四柱之间的刑冲合会害破，三合区分全合与半合。
  - `xunkong` — 日柱所在旬的空亡。
- `luckStart` 给出起运还需几年几月几天几小时与交运公历日期（`solarDate` 已把小时进位在内，
  只按年月日往出生日上加会差一天）；`luckCycles` 每步带 `liuNian` 逐年流年。
- `shensha` 现含天乙、文昌、禄神、羊刃（只阳干）、天德、月德、驿马、桃花、华盖、将星、劫煞、亡神、
  孤辰寡宿、魁罡；天德月德按月支查（所得或干或支），劫煞亡神与驿马同法年支日支两起。
- `chartTime` 是**这张盘用的时刻**：`used`（实际排盘时刻）、`termReference`（换算成固定东八区、
  年月柱与起运据以比节气的那个时刻）、`dstNormalized`（1986–1991 中国夏令时墙钟归一记录，
  非夏令时为 `null`）、`trueSolarTime`、`locationResolution`。
  后两项在响应顶层还各有一份同值镜像，是给既有调用方留的；新代码读 `chartTime.*` 一处即可。
- `school` 是本次采用的流派口径，取自 `backend/constants/rulings.js`，见本页开头。

```bash
curl -X POST http://127.0.0.1:4000/api/bazi/calculate \
  -H "Content-Type: application/json" \
  -d '{"birthYear":1990,"birthMonth":5,"birthDay":20,"birthHour":14,"gender":"male",
       "birthLocation":"Beijing","timezone":"Asia/Shanghai"}'
```

响应头 `x-bazi-cache: hit|miss` 告诉你这次是否命中缓存。缓存键以
`年-月-日-时-性别` 为基础；因为真太阳时会改写时柱，出生地、分钟、时区与
`trueSolarTime: false` 也会进键（以后缀形式追加），否则不同出生地会互相命中对方的盘。

### POST /api/bazi/ai-interpret

对一张已经排好的盘做 AI 解读。必填 `pillars`，可选 `fiveElements` / `tenGods` /
`luckCycles` / `strength` / `provider`。

### POST /api/bazi/full-analysis

排盘 + 解读一次完成。请求体 = 排盘字段 + 可选 `provider`。

## 紫微斗数 Zi Wei

### POST /api/ziwei/calculate

排盘，返回十二宫、十四主星、六吉六煞、四化、大限。十二宫自命宫**逆布**（兄弟宫在命宫
前一位、父母宫在后一位），与「阳男阴女大限顺行、第二大限走父母宫」同一条判据。
必填 `birthYear` / `birthMonth` /
`birthDay` / `birthHour` / `gender`，可选 `birthMinute`、`birthLocation`、`timezone` /
`timezoneOffsetMinutes`、`trueSolarTime`。时刻解析与八字**同一套**：给了出生地与时区就按真太阳时排，
中国地点缺时区默认北京时间，夏令时墙钟先归一；实际所用时刻回显在 `chartTime.used`。
紫微不看节气，年月日时一律取当地（已校正）时刻。不存在的日期（2 月 30 日）返回 400。
可选 `flowYear`（公历年份）：给了就在响应 `flowYear` 附上该年的流年命宫、流年四化、小限与所值大限；
CLI 对应 `--year`。

安星链条是「命宫 → 命宫干支 → 纳音 → 五行局 → 紫微 → 天府 → 十四主星 → 六吉六煞」，
五行局是整条链的根。响应里 `fiveElementBureau` 给出局别、局数与所据纳音，
`starPositions` 给出紫微天府落宫，出错时可以顺着这两个字段回溯。

各宫的 `stars` 分四组：`major`（十四主星）、`minor`（文昌文曲左辅右弼天魁天钺禄存天马）、
`malefic`（擎羊陀罗火星铃星地空地劫）、`minorB`（二十颗乙级星：红鸾天喜、天刑天姚、天哭天虚、
三台八座、恩光天贵、台辅封诰、龙池凤阁、天巫、阴煞、破碎、解神、孤辰寡宿）。
乙级星每颗带 `basis` 写明安星规则（如天刑「酉宫起正月顺行」），便于自行核对或换派重排。

各宫另有 `gods`，是四组十二神各自落在本宫的那一位：`changsheng`（长生十二神，起点由五行局定）、
`boshi`（博士十二神，从禄存起）、`suiqian`（岁前十二神，从年支起）、`jiangqian`（将前十二神，
从将星起）。前两组随大限方向顺逆，后两组恒顺行。

`palace.trine` 是这一宫的**三方四正**：`indexes` 给出本宫 / 对宫（+6）/ 三合（±4）的宫位号，
`branches` 是四宫地支，`stars` 把四宫的星曜摊平成一张清单，每颗标 `role`（`self` / `opposite` /
`trine`）、所属 `group` 与该星本次的 `transforms`（四化）。纯几何、无流派分歧 —— 引擎给出来是为了
让调用方不必各写一遍。

`mingZhu` / `shenZhu` 是命主与身主：命主按命宫地支取，身主按**生年支**取，两者判据不同。

`majorPeriods` 是十二步大限，起限岁数即局数；`majorPeriodDirection` 为 `1` / `-1`，
按阳男阴女顺行、阴男阳女逆行 —— 所以 `gender` 会影响大限方向，也会影响上面两组随向的十二神。

闰月按「归本月」处理：闰二月与二月落同一个月支。响应里 `lunar.month` 给的是正数，
是否闰月看 `lunar.isLeap` —— 两个字段要合起来读。

星曜庙旺利陷**不由引擎提供**，这是架构边界不是缺口：它属于断语层，各家对「得地」
「利」的划分出入极大。引擎给出的是盘的结构（安星、宫位、四化、大限），庙旺由调用方
按所宗流派叠加。详见 [README 的能力边界](../README.md#一条贯穿全部能力的边界结构归引擎断语归调用方)。

## 六爻 Liu Yao

### POST /api/liuyao/chart

京房纳甲装卦。必填 `lines`（六个 0/1，自初爻起），可选 `changingLines`（动爻位 1..6）
与起卦日期 `year`/`month`/`day`/`hour`（不给日期则取当日，此时结果不可复现，`castDate` 会回显实际所用日期）。
`hour` 参与两件事：23 点按**子初换日**取次日日干支（与六壬奇门同属时家口径，`school.shared.ziChu`），
月建按交节时刻定；不给 `hour` 则按正午取。不存在的日期与非整数 `hour` 返回 400。

返回卦名与《周易》序号、八宫归属与世卦名目、世应、逐爻的纳甲干支/六亲/六神、伏神、
旬空、动爻与之卦。

爻的受力分两处，别混：

- `yaos[].influence` 是**外力** —— 月建、日辰对该爻的冲合生克。
- `interactions` 是**盘内的力** —— 动爻对他爻的生克（静爻之间不相互作用，所以每条都自动爻发出）。
- `pairRelations` 是六爻两两之间的冲与合，不分动静。

卦一级另有两个标记：

- `hexagramType` —— 六冲卦 / 六合卦，本卦与之卦**分别判**（`changed` 一支，无变卦时为 `null`）。
  六冲变六合与六合变六冲断法迥异，所以两边都要给。
- `trigramShift` —— 内外卦各自的伏吟 / 返吟，判据是该卦三爻纳甲支**整体**与之卦对应三爻的关系
  （三支全同为伏吟，三支全冲为返吟）。静卦恒为 `null`：没有爻在动时三支必然与自己相同，
  那不是伏吟，那是它没动。

动爻自身的变化在 `yaos[].changedTo.shift`：进神 / 退神 / 爻伏吟 / 爻反吟。

**之爻的六亲仍以本卦之宫为我**，不按之卦的宫重排——这是纳甲筮法定例。

## 大六壬 Da Liu Ren

### POST /api/liuren/chart

月将加时起课。全部参数可选（`year`/`month`/`day`/`hour`），不给则取服务器当下。

返回月将（含所值中气）、天地盘、日干寄宫、四课、三传、十二天将、旬空。
三传九宗门全备：贼克（元首/重审）、比用（知一）、涉害（含见机/察微/复等）、遥克（蒿矢/弹射）、
昴星（虎视/冬蛇掩目）、别责、八专、伏吟（自任/自信/伏吟有克）、返吟（无亲/返吟有克）。

四课里第一课的下神是**日干本身**（`fourCourses[0].lowerStem`），寄宫（`lower`）只用于取上神；
判克以日干五行论 —— 乙日干上神未，是乙木克未土。涉害深浅相等时看候选**所临地盘位**是四孟还是四仲。
`courseType` 给出课体名目，`shehaiDepths` 在用到涉害法时给出各候选的涉害深浅。

三传与四课上神各带三项：`dunGan`（遁干，按日干支所属之旬取；落旬空的支取不到，与 `isXunkong`
互为印证）、`general`（该支在天盘上所压地盘位对应的天将）、`relative`（六亲，**以日干为我**
—— 六爻以本宫为我，两者判据不同，不要互相套用）。

口径：月将取月建六合、**中气**换将；涉害深浅按「自所乘地盘位顺行归本家；
下贼上数受克、上克下数所克」。

## 奇门遁甲 Qi Men

### POST /api/qimen/chart

排局。参数同六壬。返回节气三元、阴阳遁与局数、地盘三奇六仪、旬首遁仪、值符值使、
九宫（每宫带地盘干、天盘干、九星、八门、八神），以及顶层的时旬空亡与驿马落宫。

每宫另带 `relations`：天地盘干生克、星宫与门宫生克、门迫（**门克宫**，如开门属金落
震三、巽四木宫）、门制（反向的宫克门，`isGateZhi`）、宫内伏吟、旬空、驿马、
天盘干入墓、六仪击刑。这些是客观关系不是断语。

口径：定局用**拆补法** —— 自占日向前取最近的甲己符头，按符头地支定元
（子午卯酉上元、寅申巳亥中元、辰戌丑未下元），不置闰。**一个节气之内三元出现非
「上→中→下」的次序是拆补法的正常形态**：符头十五日一周而交节日逐年漂移，交节后头一段
那个元不足五日即「拆」，节气末尾余下的两三日补回被拆掉的那一元即「补」。
`yuanBasis` 标明定元依据、`juByYuan` 给出本节气三元各自的局数、
`futou` 与 `daysSinceFutou` 回显符头，三者合起来可直接核对。
天盘用**转盘法**；八神第五第六位取白虎、
玄武（现代通行简化派，古法阳遁用勾陈朱雀）；入墓按五行墓库。
中五宫无门无神（寄坤二），天禽星寄坤二随天芮，其所临之宫在 `lodgedStar` 里标出；
旬首遁仪落中五宫时值符星为**天禽**（寄坤二行事），不是坤二的天芮；
中宫恒不报伏吟 —— 它本就不参与转盘。
格局**命名**不实现，理由同庙旺；格局所依据的关系量则一律给出。

## 风水与择吉

### POST /api/fengshui/bazhai

八宅命卦与八方吉凶。必填 `birthYear` 与 `gender`，可选 `birthMonth`/`birthDay`
——给了就以**立春**为界定年（正月初出生可能算上一年）。

返回本命卦（卦数、方位、东四命/西四命）与八方游年星（生气、五鬼、延年、六煞、
祸害、天医、绝命、伏位），由变爻法排出而非查表。

可选 `sitting`（坐山）**才排宅卦那一半**：收卦名（`坎`）、二十四山（`子`/`壬`/`乾`）、
方位（`正北`）、`子山午向` 四种写法。给了就返回 `house`（坐、向、东西四宅、宅的八方游年）
与 `match`（命宅是否同组，以及宅之坐山方在本人命卦游年里所值之星）。
认不出不报错，`houseResolution` 标 `unresolved`，命卦那一半照常给出。
八宅论的是命卦配宅卦，只给出生信息时只有人那一半。

**交节精确到分**，所以结果带 `lifeTrigram.precision` 标明可信度：`minute`（年月日时给全）、
`day`（没给时刻，交节当天只能按零点算，**存疑**）、`year`（只给年份，完全没过立春这道关）。
`lifeTrigram.lichunAt` 给出该年立春的确切时刻，便于自行核对。

### GET /api/fengshui/almanac

当日历注，分**论日 / 论时 / 论方**三层。可选 `year`/`month`/`day` 查询参数（不存在的日期返回 400）。
条目数据（宜忌、神煞、彭祖百忌）来自 lunar-javascript，照录不改写。
历注**按日**给出：立春当日整日归新年，年柱与方位煞同一判法（`school.rulings.dayGranularity`）；
要到分的立春判定用八宅（给 `birthHour`）或八字。

| 层   | 字段                                                                              | 说明                                                                           |
| ---- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 论日 | `yi` / `ji`                                                                       | 通书宜忌，照录                                                                 |
|      | `ganzhi`（年柱以**立春**为界，不是春节）、`lunarDate`、`xunkong`                  | 日的坐标                                                                       |
|      | `zhiXing`、`xiu`、`tianShen`                                                      | 建除十二神、二十八宿及其吉凶、黄道黑道十二神（`type` 黄道/黑道、`luck` 吉/凶） |
|      | `chongSha`、`auspiciousGods` / `inauspiciousGods`、`pengzu`、`dayLu`、`festivals` | 日冲之支与生肖、日煞之方；吉神凶煞；彭祖百忌；日禄；节日                       |
|      | `dayPositions`                                                                    | 当日喜神、财神、福神、阳贵阴贵、日太岁所在之方                                 |
| 论时 | `hours[]`                                                                         | 每条带 `ganzhi`、`range`（时段）、`tianShen`、`chongSha`、`yi` / `ji`          |
| 论方 | `directions`                                                                      | 流年方位煞，见下                                                               |

`hours` 是**十三条不是十二条**：子时跨两日，早子与晚子的时干不同，合成一条就必然有一半是错的。

`directions` 是流年方位煞：`taiSui`（精确到山，另给所在宫）、`suiPo`（岁破）、
`sanSha`（三煞，含劫煞/灾煞/岁煞三支）、`nineStar`（入中紫白星与九宫飞星盘，`chart` 逐宫给出
星曜与五行），以及 `wuHuang` / `erHei` 两颗凶星的落宫。**入中星按公式算，不查表** —— 手抄的流年紫白表极易整体错位一年。
年方位同样以**立春**为界，与 `ganzhi` 的年柱同一道关 —— 同一天里两者永远同年，
`directions.lichunYear` 即年柱所属之年。

### POST /api/fengshui/name

姓名五格与三才。必填 `surnameStrokes` 与 `givenNameStrokes`，都是逐字笔画数的数组。

**笔画数由你提供，引擎不内置字典**：康熙笔画与简体笔画差异很大，部首另有独立算法
（「氵」按「水」计四画），内置一份来路不明的笔画表只会让结果看着精确、实则不可追溯。
五格算法本身是确定的：单姓天格加一虚位、单名地格加一虚位、外格 = 天格 + 地格 − 人格。

## 塔罗 Tarot

### GET /api/tarot/cards

完整牌库。

### POST /api/tarot/draw

抽牌。可选 `spreadType`：`SingleCard` / `ThreeCard` / `CelticCross`；可选 `seed`。

**不给 `seed` 时同样输入不保证同样输出** —— 每次重新随机，不要拿它做幂等重试或断言。

给了 `seed`（任意字符串或有限数字，≤200 字符）这次抽牌就是确定性的：同一 seed 配同一牌阵
必得同一副牌与同一组正逆，可以拿去做幂等重试与回归基准。响应里 `seed` 回显实际生效的种子、
`reproducible` 直接给出能不能拿它做基准这个判断，不必自己推。

seed 超过 200 字符或不是字符串/有限数字时返回 400，**不静默截断** —— 截断会让两个不同的
seed 悄悄给出同一副牌。

### POST /api/tarot/ai-interpret

必填 `cards`（至少一张），可选 `spreadType` / `userQuestion` / `provider`。

## 周易 I Ching

### GET /api/iching/hexagrams

六十四卦全表。

### POST /api/iching/divine

起卦。给 `numbers` 时是确定性的；`method: time` 由调用时刻决定卦象，不可复现。

### POST /api/iching/ai-interpret

必填 `hexagram`（卦名字符串或完整卦象对象都接受），可选 `userQuestion` / `method` / `provider`。

## 星座 Zodiac

| 方法 | 路径                           | 参数                                  |
| ---- | ------------------------------ | ------------------------------------- |
| GET  | `/api/zodiac/{sign}`           | `sign` 路径参数                       |
| GET  | `/api/zodiac/{sign}/horoscope` | `sign` 路径参数，`period` 查询参数    |
| GET  | `/api/zodiac/compatibility`    | `primary`、`secondary` 查询参数，必填 |
| POST | `/api/zodiac/rising`           | 见下                                  |

`POST /api/zodiac/rising` 计算上升星座，必填 `birthDate`、`birthTime`、
`timezoneOffsetMinutes`、`latitude`、`longitude`。

## 合盘 Synastry

### POST /api/synastry/analyze

两组出生信息的相性分析。必填 `personA` 和 `personB`，各自是一组[约定](#约定)里的出生字段。

## 日历 Calendar

### GET /api/calendar/daily

当日日柱与流日运势。全部查询参数可选：`birthYear`、`birthMonth`、`birthDay`、
`birthHour`、`gender` —— 给了就结合本命盘，不给就只返回当日信息。

## 地点 Locations

### GET /api/locations

真太阳时校正认得的地点表（88 个城市，每条带中文名与常见别名）。
可选 `search` 查询参数做过滤，中英文都能搜。

表里没有的地名**不报错**，只是不做校正：响应里 `chartTime.trueSolarTime` 为 `null`，
`chartTime.used` 就是原始钟表时间。排查「盘和预期差一柱」时先看这两个字段。

`chartTime.locationResolution.status` 报的是**校正的最终下场**，不是「地名查得到吗」：

| status        | 含义                                    | 谁该动手               |
| ------------- | --------------------------------------- | ---------------------- |
| `applied`     | 已校正，`chartTime.used` 是校正后的时刻 | —                      |
| `unresolved`  | 填了但认不出，本次按钟表时间排盘        | 调用方：换写法或传坐标 |
| `no-timezone` | 地名认得，但缺时区偏移，标准经线算不出  | 调用方：补 `timezone`  |
| `absent`      | 没填 `birthLocation`                    | —                      |
| `disabled`    | 显式传了 `trueSolarTime: false`         | —                      |

只有 `applied` 意味着这张盘用了校正后的时刻。`unresolved` 与 `no-timezone` 会在服务端
记一条 warn，`hint` 字段直接给出下一步。判断校正是否生效的判据仍然是 `trueSolarTime`。

要绕开这张表，直接给坐标串 `"30.27,120.15"`，这条路径永远可靠。

## AI 供应商

### GET /api/ai/providers

当前生效的供应商和可用列表。未配置任何密钥时是 `mock`。

## 健康检查与运维

| 方法 | 路径                       | 说明                                                  |
| ---- | -------------------------- | ----------------------------------------------------- |
| GET  | `/live`                    | 存活探针，只看进程，不查依赖                          |
| GET  | `/health`                  | 深度健康检查（含 Redis），排水期间返回 503            |
| GET  | `/api/live`                | `/live` 的 `/api` 前缀别名                            |
| GET  | `/api/health`              | `/health` 的 `/api` 前缀别名                          |
| GET  | `/api/ready`               | 就绪探针，给负载均衡用；排水期间立即 503              |
| GET  | `/api/system/cache-status` | Redis 连通性与八字缓存镜像状态                        |
| GET  | `/metrics`                 | Prometheus 文本格式；需要 `METRICS_TOKEN` Bearer 鉴权 |

`/metrics` 在没配 `METRICS_TOKEN` 时，生产环境返回 404 —— 视为未暴露，这是刻意的默认值。

健康检查结果带缓存（`HEALTH_CACHE_TTL_MS`，默认 1000ms）：`/health` 注册在限流之前，
探针永远不会被限流，这也意味着没有缓存的话一个无鉴权请求循环会变成无上限的检查负载。

## 错误格式

所有错误都是同一个形状：

```json
{ "error": "错误信息" }
```

| 状态码 | 含义                                   |
| ------ | -------------------------------------- |
| 400    | 参数校验失败（含不可用的 AI provider） |
| 404    | 路径不存在                             |
| 429    | 命中限流                               |
| 500    | 引擎内部错误                           |
| 503    | 依赖不可用，或进程正在排水             |

用 `./bazi` CLI 调用时，这些状态码已经被翻译成退出码（3 = 没就绪 / 4 = 请求被拒 /
5 = 可重试 / 1 = 引擎内部错），不需要自己判断。
见 [.claude/skills/bazi-cli/SKILL.md](../.claude/skills/bazi-cli/SKILL.md)。
