# 关键模块与核心逻辑

> 改算法前先读 [SKILL.md](../.claude/skills/bazi-cli/SKILL.md)。那份写的是「错了不报错」的口径；本篇写代码落在哪、谁调用谁。

边界一句话：**结构归引擎，断语归调用方。** 三传、安星、定局、游年必须算准；庙旺、格局名目、神煞吉凶轻重不进引擎。

## 分层

| 层              | 目录                                       | 允许做什么                         | 禁止做什么                     |
| --------------- | ------------------------------------------ | ---------------------------------- | ------------------------------ |
| HTTP            | `backend/routes/`                          | 读 body/query、调 service、写 JSON | 算法、缓存键、流派规则         |
| 少量 controller | `backend/controllers/`                     | 与 route 同类，历史拆分            | 新增能力不必再加这一层         |
| 算法            | `backend/services/*.service.js`            | 纯函数排盘/起课                    | 碰 `req`/`res`、读未声明的 env |
| 静态表 / 口径   | `backend/constants/`、`backend/data/`      | 干支、星曜、牌库、卦象；口径真源   | 把断语写成「吉/凶」默认值      |
| 配置 / 基础设施 | `backend/config/`、`middleware/`、`utils/` | 校验、时区、缓存、限流             | 术数规则                       |
| CLI             | `tools/cli/`                               | 参数 → HTTP → 退出码               | 再实现一遍算法                 |

加一门新术数要动哪几处见 [CONTRIBUTING.md](../CONTRIBUTING.md)。漏 OpenAPI 快照 CI 会红。

## 口径真源：`constants/rulings.js`

命理几乎每一步都有流派分歧，**选错不会抛异常，只会安静给出另一门派的盘**。所以选定口径不写在
注释里，写成机器可读的常量：

```
constants/rulings.js   ← 唯一真源：每条口径带 key / cn / 选定值 / 另一派会怎样
        │
        ├─ service 从这里读阈值与权重（禁止魔法数分叉）
        ├─ 响应挂 school 字段（withSchool(moduleKey, result)）
        └─ backend/test/rulings_lock.test.js 钉死 key 与数值
```

- `SHARED_RULINGS` 是跨术数共用的时间口径（子初换日 / 晚子不换日 / 交节精确到分 /
  给齐地点时区时默认真太阳时）。八字保留晚子不换日、时家六壬奇门按子初换日，两条**并存不矛盾**：
  它们是不同术数的既定口径，别为了「统一」把任一边改掉。
- 每个能力一个 module，互不混装。当前 14 个：
  `bazi` `ziwei` `liuyao` `liuren` `qimen` `bazhai` `almanac` `name` `iching` `synastry`
  `tarot` `zodiac` `rising` `daily`。
- 断语层（庙旺、奇门格局命名等）在这里显式标 `implemented: false` —— 是刻意不做，不是漏做。
- 响应里的 `school` 只带本能力相关的 `shared` + `rulings`，不把无关口径塞给塔罗、姓名。

**换派的正确改法**：改 `rulings.js` 里那一条 + service 中读它的那一处 + 锁测试，三处一起。
只改 service 会让响应的 `school` 说谎；只改 rulings 则测试当场红。SKILL.md 里的口径表是给人读的
摘要，与本文件冲突时以 `rulings.js` + 实现为准。

## 共享基座

这三层被多门术数共用。改这里等于同时改八字、六壬、奇门、八宅的交节行为。

### `jieqi.service.js`

给精确到分的墙钟，定它落在哪个节气或中气。比较用 `YYYYMMDDHHmm` 整数，不经 `Date`，避免服务器时区把东八区节气表漂走。

必须走这一层的原因：以前各体系自己比「日」，同一张生辰会落进不同节气。另外 `getJieQiTable()` 混有拼音键，只扫中文键会把每年冬至到年末判成大雪，奇门阴阳遁整盘颠倒。

入口：`resolveSolarTerm`、`resolveLiChun`、`resolveLiChunYear`。

### `ganzhi.service.js` + `constants/ganzhi.js`

纳音、藏干（本气/中气/余气）、十二长生、合冲刑害破会、五行局、旬空、旺相休囚死。纳音 60 条与 `lunar-javascript` 逐条比对。八字断命与紫微五行局都从这里取。

`getSeasonalState(月令五行, 目标五行)` 给四时旺衰五档。放在基座层是因为六爻论爻之旺衰与奇门论门星旺相吃的是同一张表 —— 各抄一份迟早有一边把「休」（生月令）和「囚」（克月令）写反，两者都是与月令相克，只差方向。这里不 import `bazi.service` 的 `getElementRelation`，那会让基座反向依赖上层。

### `solarTime.service.js`

真太阳时 = 经度差 + 均时差。地名表 `KNOWN_LOCATIONS`（88 城，含中文/别名）。认不出不报错，只跳过校正。坐标串 `"纬度,经度"` 永远可靠。

`chartTime.locationResolution.status` 取值：`applied` / `unresolved` / `no-timezone` / `absent` / `disabled`。只有 `applied` 表示这张盘用了校正后的时刻。

## 八字：两段式

```
resolveChartTime          calculations.service.js
        │
        ├─ 当地墙钟 ± 真太阳时  →  日柱、时柱
        └─ 换算东八区           →  年柱、月柱、起运（termReference）
        │
performCalculation        lunar-javascript + setSect(2)
        │
analyzeBaziChart          bazi.service.js
        │
        ├ weightedElements   藏干加权，月支 ×2（只加月支，不加月干）
        ├ strength           同党 >55% 身强 / <45% 身弱
        ├ specialPattern     从格 / 专旺格：facts 无分歧 / suggested 按选定判据
        ├ usefulGod          扶抑法；从格专旺时改从其格（方向与扶抑相反）
        ├ tiaohou            调候用神（穷通宝鉴表，在 constants/geju.js）
        ├ monthlyStructure   月令取格：facts 无分歧 / suggested 子平真诠一派
        ├ keyPoints          胎元（月柱推）/ 胎息（日柱推）/ 命宫身宫（月支时支推）
        ├ pillarDetails / shensha / relations / xunkong
        └ luckCycles         起运时刻 + 逐年流年
```

`calculations.service` 负责排出四柱；`bazi.service` 负责拿四柱断命。两边不互相 import 断命逻辑，避免循环依赖。换藏干权重、旺衰阈值、用神法，只改 `bazi.service.js` 顶部的口径声明。

断命层给两套用神：扶抑（强弱）与调候（寒暖燥湿），并列不互斥 —— 中和局扶抑给不出主次，那正是调候当令之时。

扶抑之上还有一道闸：`specialPattern`。扶抑法有个没写出来的前提 —— 日主还扶得起来。日主全无通根时扶不起来，正解是弃命相从，用神与扶抑**恰好相反**；专旺格同理宜顺不宜逆。这是断命层唯一一处「不补就会给出反向结论」的地方，故判据取硬条件：从格要四支全无同党通根且同党占比 <20%（等价于天干也不见印比，即只认真从不认假从），专旺格要得令且同党占比 ≥80%。两格都不成立时 `suggested` 为 null —— 那是常态。月令格局在 `monthlyStructure`：`facts` 无流派分歧、`suggested` 按《子平真诠》一派。格局表与调候表都在 `constants/geju.js`，换所宗版本只改那一处。

`getBaziCalculation` 包一层缓存。路由走它，不要直接 `performCalculation` 除非测试要绕过缓存。

性别必须经 `normalizeGender`。非法值不得静默当女命——会反转大运顺逆。

## 其他术数

下表「选定口径」一列是摘要，机器可读的那一份在 `constants/rulings.js` 的同名 module 里（见上面「口径真源」一节）；换派按上一节说的三处一起改。

| 模块               | 入口职责                                                                                    | 选定口径（摘要，真源在 rulings.js）                                                                          | 明确不做 |
| ------------------ | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------- |
| `ziwei.service`    | 农历 → 命宫干支纳音 → 五行局 → 紫微 → 天府 → 诸星 → 四化（本命/宫干/流年）/ 大限 / 三方四正 | 年干支按正月初一；闰月归本月；十二宫自命宫逆布；解神只取年解；四化戊右弼壬左辅                               | 庙旺利陷 |
| `liuyao.service`   | 装卦不是起卦：吃 `lines`，排八宫世应纳甲六亲六神伏神、爻间生克、爻之旺衰                    | 变爻六亲仍以本卦之宫为我；八宫由七条规则算，无 64 行表；旺衰只按月建不按日辰；卦带卦辞大象、爻带爻辞         | 摇卦     |
| `liuren.service`   | 月将加时 → 天地盘 → 四课 → 九宗门三传（带遁干天将六亲）→ 十二天将                           | 中气换将；一课以日干为下判克；涉害孟仲看所临地盘位；八专在遥克之前；子初换日；三传六亲以日干为我             | 断课吉凶 |
| `qimen.service`    | 拆补定局 → 地盘三奇六仪 → 值符值使 → 转盘星门神 → 盘面关系量                                | 拆补法（符头地支定元，不置闰）+ 转盘法；值使按九宫数序飞、中五寄坤二；子初换日；中五无门无神；八神取白虎玄武 | 格局名目 |
| `fengshui.service` | 八宅命卦与宅卦；黄历三层（论日/论时/论方）；姓名五格                                        | 立春定年（方位煞同界）；外格 = 天格+地格−人格；笔画由调用方给                                                | 吉凶断语 |
| `iching.service`   | 数字起卦（确定）或时间起卦；本卦之卦、互卦错卦综卦、逐爻爻辞                                | 卦名、序号与《周易》经文（卦辞/爻辞/大象）在 `data/`，与六爻共用；经文照录维基文库底本                       | —        |
| `tarot.service`    | 牌库 + 牌阵随机；给 `seed` 则确定                                                           | 不给 seed 每次重新抽、不可复现；给了 seed 必得同一副牌；大小阿卡纳/花色/序位由牌名推出                       | —        |
| `zodiac.service`   | 星座、运势、上升、配对                                                                      | 描述性英文关键词保留原文                                                                                     | —        |
| `synastry.service` | 两组出生信息交叉：日主十神、夫妻宫、柱关系、五行互补                                        | 复用八字排盘                                                                                                 | —        |

六壬取传次第不可调换：`贼克 → 比用 → 涉害 → [八专] → 遥克 → 别责 / 昴星`。伏吟、返吟由将时关系先于其余七门判定。

奇门三套次序不能混：地盘三奇六仪按九宫数序飞（中五占一位）；**值使门落宫**也按九宫数序飞（中五寄坤二）；
九星、八门整体与八神则在洛书八宫环上转（中五寄坤二）。

紫微四化分三层，各起各的，不要互相代入：本命四化取**年干**，宫干四化取**本宫之干**（落回本宫为自化、落他宫为飞化），流年四化取**流年干**。大限四化即该大限所在宫的宫干四化，同一份数据换个入口给出。

旺相休囚死在六爻与奇门共用 `getSeasonalState`：六爻按**月建**（日辰只论生克冲合，不另立旺衰档），奇门按**节气月支**（四时按节气分，与农历月建差着半个月）。

## 基础设施模块

| 文件                             | 职责                                                 |
| -------------------------------- | ---------------------------------------------------- |
| `cache.service`                  | `buildBaziCacheKey`、进程内 LRU、可选 Redis 镜像     |
| `health.service`                 | 深度检查快照；未配 Redis 记 `disabled` 且 `ok: true` |
| `httpMetrics.service`            | 请求量 / 延迟 / 429 / 在途；跳过探针路径             |
| `metrics.service`                | Prometheus 文本；鉴权                                |
| `lifecycle.service`              | 排水开关；探针读它                                   |
| `ai.service` / `prompts.service` | mock / OpenAI / Anthropic，并发闸 + 流式空闲超时     |
| `apiSchema.service`              | OpenAPI 唯一来源                                     |
| `lib/concurrency.js`             | AI 并发槽                                            |

## CLI 模块

```
bin/bazi.mjs
  → main.mjs          解析命令树
  → commands/*        每条命令声明 kind / effect / reproducibility
  → core/apiClient    HTTP → 退出码（能力命令必须走这里）
  → core/registry     flag 声明、required/choices/variadic
  → core/toolSchema   schema 与 mcp 共用
  → core/stackState   .tmp/cli/ 里的 pid 与日志
```

约束（测试会拦）：

- 失败抛 `CliError`，带可执行的 `next`
- `--json` 时 stdout 只有一个 JSON 文档
- 必填写在声明上，不写在 `run` 里（否则导出的 schema 会说参数可选）
- 能力命令走 `callApi`，请求带 `connection: close`
- `kind` 缺省是 `ops`，新的能力组必须显式 `kind: 'capability'`

`stack` 只托管一个 `api` 进程。没有 `--only`。看到 `managedBy: foreign` 时不要按端口杀进程。

## 请求在引擎里的位置

`backend/routes/api.js` 挂载：

`/ai` `/bazi` `/ziwei` `/tarot` `/iching` `/liuyao` `/liuren` `/qimen` `/fengshui` `/zodiac` `/locations` `/synastry` `/calendar`

另在 `server.js` 根上挂 `/live`、`/health`、`/metrics`、`/api-docs`。`/api/live`、`/api/health`、`/api/ready` 是别名。

人读字段说明在 [api.md](api.md)。机器契约在 [openapi.json](openapi.json)。
