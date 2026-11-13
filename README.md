# Metaphysics Engine (`metaphysics-engine`) · 无状态传统术数与排盘算法能力层

[![CI](https://github.com/qilaidev/metaphysics-engine/actions/workflows/ci.yml/badge.svg)](https://github.com/qilaidev/metaphysics-engine/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![OpenAPI 3.0.3](https://img.shields.io/badge/OpenAPI-3.0.3_31_paths-009688.svg)](docs/openapi.json)
[![MCP Server](https://img.shields.io/badge/MCP-14_Read--Only_Tools-6E56CF.svg)](#调用示例--usage-examples)
[![Stateless](https://img.shields.io/badge/Architecture-Stateless_Pure_Calc-10B981.svg)](docs/architecture.md)

**简体中文** · [English](README.en.md) · [API Docs](docs/api.md) · [OpenAPI](docs/openapi.json) · [Architecture](docs/architecture.md) · [llms.txt](llms.txt) · [CodeMeta](codemeta.json) · [开发约定](CONTRIBUTING.md) · [Security](SECURITY.md) · [Changelog](CHANGELOG.md) · [LICENSE](LICENSE)

> 本仓库为开源的术数算法能力层（MIT）。它与带 React 前端的社区 Web UI 全栈模板（冻结在 `v0.2.0`）是两个完全隔离、
> 互不同步的独立仓库：算法口径、CLI 能力与 MCP 接入均不共享，也不沿用那条线的任何代码或资产。

**Metaphysics Engine（`metaphysics-engine`）** 是一个开源（MIT）、可自部署的无状态传统术数与占星计算能力层，基于 Node.js 20+ 与 Express 4 构建。它将八字排盘（BaZi）、紫微斗数（Zi Wei Dou Shu）、六爻纳甲（Liu Yao）、大六壬（Da Liu Ren）、奇门遁甲（Qi Men Dun Jia）、八宅风水（Ba Zhai）、三层择吉黄历（Almanac）、姓名五格、塔罗、周易起卦、西洋星座与上升星座、合盘分析及可选 AI 解读收敛为 **31 个公开 OpenAPI 3.0.3 接口**、面向 Agent 的 **`./bazi --json` CLI** 与 **14 工具只读 stdio MCP Server**——零数据库、零账号系统、全部流派口径在 [`backend/constants/rulings.js`](backend/constants/rulings.js) 显式声明。

**English definition**: **Metaphysics Engine** is an open-source (MIT), self-hostable, stateless Chinese metaphysics and astrology calculation capability layer built on Node.js and Express. It exposes 14 traditional and divination modules — BaZi (with True Solar Time), Zi Wei Dou Shu, King Fang Liu Yao, Da Liu Ren, Qi Men Dun Jia, Ba Zhai feng shui, almanac, name grids, Tarot, I Ching, Zodiac/Ascendant, and Synastry — through 31 OpenAPI 3.0.3 HTTP routes, a `--json` programmatic CLI (`./bazi`), and a 14-tool stdio MCP server, with zero database state and machine-readable school rulings.

**目录**：[项目定位](#项目定位--project-snapshot) · [核心能力](#核心能力--core-capabilities) · [快速开始](#快速开始--quick-start) · [调用示例](#调用示例--usage-examples) · [接口速查](#接口速查--api-endpoints) · [适用场景与方案对比](#适用场景与方案对比--use-cases--alternatives) · [技术栈](#技术栈--tech-stack) · [环境变量](#环境变量--configuration) · [FAQ](#faq--常见问题) · [项目结构](#项目结构--repository-structure) · [测试](#测试--testing) · [生产部署](#部署与生产注意事项--production-notes) · [开发约定](#开发约定--development) · [限制](#限制与免责声明--limitations) · [文档](#文档--documentation)

## 项目定位 / Project Snapshot

| 维度         | 说明                                                                                                |
| ------------ | --------------------------------------------------------------------------------------------------- |
| 规范实体名   | `metaphysics-engine`（当前版本 `0.3.0`，CLI 入口 `./bazi`）                                         |
| 项目类型     | 玄学 / 占星 / 命理**无状态算法能力层**（开源 MIT），以自部署 HTTP API + 程序化 CLI + MCP 交付       |
| 解决什么问题 | 把命理算法里那些「写错也不会报错」的节气、子时、真太阳时与流派边界做成可测试、有契约的可调用能力    |
| 适合谁       | 要给产品接命理计算的后端开发者，以及要给 AI Agent 接真实排盘工具的工程团队                          |
| 消费方式     | 直接调 HTTP API；运行 `./bazi calc` / `./bazi cast`；挂载 `./bazi mcp`；或 `./bazi schema` 导出     |
| 运行形态     | **无状态纯计算**：没有数据库、没有账号、没有会话、不写业务文件                                      |
| 唯一外部依赖 | Redis，且是**可选的纯缓存**（仅用于多实例共享八字排盘缓存命中率，不影响结果正确性）                 |
| 技术栈       | Node.js 20+, Express 4, `@modelcontextprotocol/sdk`, `lunar-javascript`, Node.js test runner        |
| 本地前置     | Node.js 20+ 和 npm。不需要 Docker，不需要数据库                                                     |
| AI 能力      | `mock` / `openai` / `anthropic` 文本解读，可按请求覆盖；不配任何 API Key 时确定性排盘照常工作       |
| 接口契约     | OpenAPI `3.0.3` 共 31 条路径（[docs/openapi.json](docs/openapi.json)），挂于 `/api-docs`，CI 守快照 |
| 口径真源     | [`backend/constants/rulings.js`](backend/constants/rulings.js)，响应回带 `school` 字段且受测试锁死  |
| 许可证       | MIT。见 [LICENSE](LICENSE)                                                                          |
| 重要限制     | 输出仅适合娱乐、文化研究、算法研究或产品原型；不可作为医疗、法律、投资或人生重大决策建议            |

### 定位边界：是什么 / 不是什么（What It Is / What It Is Not）

| 维度           | 它是（What It Is）                                                               | 它不是（What It Is Not）                                                     |
| -------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **产品形态**   | 纯后端无状态 HTTP 服务 + 程序化 `./bazi` CLI + stdio MCP Server                  | **不是**带界面的网页应用（仓库不含任何前端代码），也不提供托管线上实例       |
| **分发方式**   | 自部署开源源码与 Docker 镜像（`backend/Dockerfile`），通过 HTTP / CLI / MCP 消费 | **不是**独立发布的 npm 纯函数算法库，也不提供公共 SaaS 在线算命服务          |
| **账号与存储** | 零数据库、零会话、零持久化；界面、用户体系与历史收藏完全交给调用方               | **不是**带注册、登录、OAuth 或数据库迁移的后端脚手架（相关存储层已彻底移除） |
| **能力边界**   | **结构归引擎，断语归调用方**：精确输出干支星门生克与客观关系量                   | **不是**对命理/占星准确性的科学背书，也不硬编码各派争议断语                  |
| **合规边界**   | MIT 开源代码授权与可复现参考实现                                                 | **不是**开箱即用的商业合规方案（应用商店、微信、支付与地区法规需部署者自负） |

## 核心能力 / Core Capabilities

- **八字排盘 BaZi charting**：四柱、藏干加权五行、十神（含中气余气）、身强身弱、
  **月令格局**（子平真诠一派）、**扶抑与调候两套用神**（穷通宝鉴表）、神煞、纳音、十二长生、
  **胎元胎息命宫身宫**、四柱刑冲合会害破、空亡；大运带起运时刻与逐年流年。
  真太阳时参与排盘，带排盘缓存。
- **紫微斗数 Zi Wei Dou Shu**：农历换算、五行局、十二宫、十四主星、六吉六煞、二十颗乙级星、
  **三方四正**、命主身主、四化、长生 / 博士 / 岁前 / 将前四组十二神、大限、流年与小限（`flowYear`）。
  安星依「命宫干支纳音定五行局 → 紫微 → 天府 → 诸星」的正统链条。年干支按农历年（正月初一），
  闰月按「归本月」流派。
- **六爻纳甲 Liu Yao**：京房筮法装卦。八宫归属、世应、纳甲干支、六亲、六神、伏神、旬空、
  月建日辰生克、**动爻对他爻的生克**、爻间冲合、六冲卦 / 六合卦、进神退神、
  内外卦伏吟返吟、动爻变卦，卦上带《周易》卦辞与大象、每爻带爻辞。八宫由世卦推衍规则算出，非硬编表。
- **大六壬 Da Liu Ren**：月将加时得天地盘、日干寄宫、四课、三传（九宗门全备）、十二天将。
  三传与四课上神各带**遁干、所乘天将、六亲**（以日干为我）与旬空。月将取月建六合、以中气换将。
- **奇门遁甲 Qi Men**：拆补法定局、地盘三奇六仪、值符值使、转盘法排九星八门八神；
  每宫附**盘面关系量**（天地盘干生克、星宫门宫生克、门迫、伏吟、旬空、驿马、入墓、六仪击刑）。
- **八宅风水 Ba Zhai**：本命卦（立春为界）与八方游年星，由变爻法排出；
  给了坐山则同排**宅卦**（东西四宅、宅的八方游年）并论命宅相配。
- **择吉 Almanac**：分论日 / 论时 / 论方三层 —— 宜忌、建除十二神、二十八宿、黄道黑道十二神、
  日冲日煞、吉神凶煞、彭祖百忌；十二时辰各自的吉凶与宜忌；太岁、岁破、三煞与流年紫白九宫盘
  （五黄二黑落宫）。年方位以立春为界，入中星按公式算不查表。
- **姓名五格 Name Grids**：天人地外总五格与三才配置（笔画数由调用方提供）。
- **塔罗 Tarot**：完整牌库，单张 / 三张 / 凯尔特十字牌阵。
- **周易 I Ching**：六十四卦全表（含真卦名、《周易》序号与**经文**——卦辞、爻辞、大象传），
  数字起卦（确定性）与时间起卦，附本卦 / 之卦 / 互卦 / 错卦 / 综卦与逐爻爻辞。
  经文照录维基文库《周易》底本，由 `npm -C backend run fetch:zhouyi` 抓取生成，可重跑复现。
- **星座 Zodiac**：星座信息、运势、上升星座计算、配对。
- **合盘 Synastry**：两组出生信息的相性分析，两边各自可给出生地与时区（与八字排盘同口径）。
- **AI 解读 AI interpretation**：八字 / 塔罗 / 周易的解读接口，支持 mock / OpenAI / Anthropic，带并发闸与流式空闲超时。
- **运维基础 Operations**：`/live`、`/health`、`/api/ready`、`/metrics`（Prometheus）、Pino JSON 日志、OpenAPI / Swagger UI、优雅停机与排水。
- **程序化 CLI**：`./bazi` 把算法调用与仓库运维收敛成一套命令，全部支持 `--json` 和约定退出码，方便脚本与 AI Agent 调用。

### 一条贯穿全部能力的边界：结构归引擎，断语归调用方

盘**怎么排**由引擎负责，且必须精准：三传、安星、排局、游年，这些有唯一正确答案，
错了就是错了。盘**怎么解**不由引擎负责：紫微的庙旺利陷、奇门的格局名目（青龙返首、
飞鸟跌穴）、神煞的吉凶轻重，各家取法与成立条件出入极大，塞进能力层只会让调用方
继承一套说不清出处的判断。

所以引擎把断语所需的原料给全，且给到关系一级：不只是每宫的星门神干，还有它们之间的
生克与门迫；不只是每爻的六亲六神，还有动爻对他爻的作用。分界不是「凡带吉凶字样一律不给」，
而是看那句话**是谁说的** —— 客观关系（门迫＝宫克门）与通书条目（黄历的宜忌）照给，
吉凶评价与分歧命名（格局名目、庙旺利陷）不给。

有流派分歧的排盘口径（藏干权重、闰月归属、定局用拆补法、天盘用转盘法、八神取白虎玄武、
入墓按五行墓库）一律登记在 [`backend/constants/rulings.js`](backend/constants/rulings.js) —— 那是机器可读的
唯一真源：service 从那里读数值，每个排盘响应回带一个 `school` 字段说明本次用的是哪一派，
`rulings_lock` 测试把 key 与数值钉死。换派只改那一处（外加实现里读它的那一行）。

## 快速开始 / Quick Start

前置要求只有 **Node.js 20+ 和 npm**。不需要 Docker，不需要数据库，不需要 Redis。

关于环境变量：后端进程本身不引入 dotenv，`node server.js` 只读取真实环境变量。用 `./bazi` 启动时，CLI 会读取仓库根的 `.env` 并注入子进程（真实 `process.env` 优先级更高）。手动启动或生产部署时，需要由 shell、进程管理器或部署平台注入。

### 用 `./bazi`（推荐）

```bash
git clone https://github.com/qilaidev/metaphysics-engine.git
cd metaphysics-engine

./bazi setup     # 装依赖 + 生成 .env
./bazi doctor    # 体检环境，每项失败都带可执行的修复命令
./bazi stack up  # 起引擎
./bazi test      # 跑测试（cli + lint + backend + engine）
```

所有命令都支持 `--json`，退出码有明确约定，方便脚本和 agent 调用。
完整能力清单：`./bazi help --json`——这是唯一真源，本文档刻意不重复命令列表。

### 手动步骤

```bash
git clone https://github.com/qilaidev/metaphysics-engine.git
cd metaphysics-engine

npm install
npm -C backend install

NODE_ENV=development npm -C backend run dev   # http://127.0.0.1:4000
```

常用检查：

```bash
curl http://127.0.0.1:4000/live
curl http://127.0.0.1:4000/health
curl http://127.0.0.1:4000/api/ready
curl http://127.0.0.1:4000/api/ai/providers
```

## 调用示例 / Usage Examples

八字排盘：

```bash
curl -X POST http://127.0.0.1:4000/api/bazi/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "birthYear": 1990,
    "birthMonth": 5,
    "birthDay": 20,
    "birthHour": 14,
    "gender": "male",
    "birthLocation": "Beijing",
    "timezone": "Asia/Shanghai"
  }'
```

塔罗抽牌：

```bash
curl -X POST http://127.0.0.1:4000/api/tarot/draw \
  -H "Content-Type: application/json" \
  -d '{ "spreadType": "ThreeCard" }'
```

用 CLI 调同样的能力（引擎要先起着）：

```bash
./bazi calc bazi --birth 1990-05-20T14:30 --gender male --json
./bazi calc liuyao --lines 111111 --changing 1 --date 2024-05-20 --json
./bazi calc liuren --date 2024-05-20 --hour 14 --json
./bazi calc qimen --date 2024-05-20 --hour 14 --json
./bazi calc bazhai --birth 1990 --gender male --json
./bazi calc daily --birth 1990-05-20T14:30 --gender male --json
./bazi cast tarot --spread ThreeCard --json
```

起课类命令（`liuren` / `qimen` / `liuyao` / `almanac`）不给 `--date` 就取引擎当日，
那一次调用**不可复现**，文本输出会标注出来。要可复现就把日期时辰给全。
每条命令的可复现性都是声明出来的，`./bazi help <命令> --json` 的 `reproducibility`
字段可查（`daily` 没有日期参数，恒不可复现；`cast iching --numbers` 反而是确定性的）。

更多接口见 [docs/api.md](docs/api.md)。启动后也可以访问：

- Swagger UI: `http://127.0.0.1:4000/api-docs`
- OpenAPI JSON: `http://127.0.0.1:4000/api-docs.json`

给智能体接入有两条路，工具定义同源，不存在第二份手写清单。

**要一个能直接挂上去的 MCP server**，用 `./bazi mcp`（stdio）：

```json
{ "command": "./bazi", "args": ["mcp"] }
```

默认暴露 14 个算法能力工具，全部只读；运维命令要 `--scope ops|all` 显式放进来。
每次工具调用都真的去跑一次 CLI，所以参数校验、破坏性操作的安全闸、退出码语义全部
原样继承，退出码则翻译成 `isError` 并把 `hint` / `next` 交给模型。引擎要先起着。

**要一份定义自己装载**，用 `./bazi schema`（纯本地生成，不需要引擎在跑）：

```bash
./bazi schema --format openai > tools.json
```

`--json` 模式还会附一份 catalog，说明每个参数拼成 argv 的哪一部分，并给出每条工具的
副作用等级（`read-only` / `local-write` / `destructive`，MCP 格式下同时是
`readOnlyHint` / `destructiveHint`）与可复现性 —— 前者是做权限判断的依据，
后者决定这条工具的结果能不能拿去做缓存或回归基准。要走 HTTP 而不是 CLI，
用 `docs/openapi.json`；所有业务接口都无需鉴权。

## 接口速查 / API Endpoints

所有业务接口都是**公开的，无需鉴权**——项目没有账号系统。唯一带鉴权的是运维面。
完整参数与响应见 [docs/api.md](docs/api.md)，机器可读契约见 [docs/openapi.json](docs/openapi.json)。

| 能力                          | HTTP 接口                                                                                       | 对应 CLI               |
| ----------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------- |
| 八字排盘 BaZi                 | `POST /api/bazi/calculate`                                                                      | `./bazi calc bazi`     |
| 八字 AI 解读                  | `POST /api/bazi/ai-interpret` · `POST /api/bazi/full-analysis`                                  | —                      |
| 紫微斗数 Zi Wei               | `POST /api/ziwei/calculate`                                                                     | `./bazi calc ziwei`    |
| 六爻纳甲 Liu Yao              | `POST /api/liuyao/chart`                                                                        | `./bazi calc liuyao`   |
| 大六壬 Da Liu Ren             | `POST /api/liuren/chart`                                                                        | `./bazi calc liuren`   |
| 奇门遁甲 Qi Men               | `POST /api/qimen/chart`                                                                         | `./bazi calc qimen`    |
| 八宅风水 Ba Zhai              | `POST /api/fengshui/bazhai`                                                                     | `./bazi calc bazhai`   |
| 择吉黄历 Almanac              | `GET /api/fengshui/almanac`                                                                     | `./bazi calc almanac`  |
| 姓名五格 Name grids           | `POST /api/fengshui/name`                                                                       | `./bazi calc name`     |
| 合盘 Synastry                 | `POST /api/synastry/analyze`                                                                    | `./bazi calc synastry` |
| 塔罗 Tarot                    | `POST /api/tarot/draw` · `GET /api/tarot/cards` · `POST /api/tarot/ai-interpret`                | `./bazi cast tarot`    |
| 周易起卦 I Ching              | `POST /api/iching/divine` · `GET /api/iching/hexagrams` · `POST /api/iching/ai-interpret`       | `./bazi cast iching`   |
| 星座 Zodiac                   | `GET /api/zodiac/{sign}` · `GET /api/zodiac/{sign}/horoscope` · `GET /api/zodiac/compatibility` | `./bazi calc zodiac`   |
| 上升星座 Ascendant            | `POST /api/zodiac/rising`                                                                       | `./bazi calc rising`   |
| 流日 Daily                    | `GET /api/calendar/daily`                                                                       | `./bazi calc daily`    |
| 真太阳时地点表                | `GET /api/locations`                                                                            | —                      |
| AI Provider 状态              | `GET /api/ai/providers`                                                                         | —                      |
| 健康 / 就绪 / 缓存            | `GET /live` · `GET /health` · `GET /api/ready` · `GET /api/system/cache-status`                 | `./bazi stack status`  |
| 接口文档（生产带 Basic Auth） | `GET /api-docs` · `GET /api-docs.json`                                                          | —                      |
| 指标（Bearer token）          | `GET /metrics`                                                                                  | —                      |

## 适用场景与方案对比 / Use Cases & Alternatives

- 给已有产品（Web、小程序、App）接一套命理/占星计算后端，界面与账号体系完全自己实现。
- 作为智能体的专业计算工具：通过 `./bazi mcp` 或 `./bazi schema` 让大模型调用真实排盘算法，而不是让模型凭记忆编造四柱、星曜与局数。
- 参考一个无状态计算服务如何组织 OpenAPI 契约、探针、优雅停机和 Prometheus 可观测性。
- 研究各家术数算法里的流派选择与边界条件（节气交接、晚子时、闰月、真太阳时、中气换将、拆补定局）。

### 同类方案对比（架构适配速览）

| 对比维度                  |                            **Metaphysics Engine**                             |         仅用基础历法库（如 `lunar-javascript`）         |   商业算命 / 占星 SaaS API   |        直接让 LLM 裸算排盘        |    全栈社区 Web UI 模板    |
| ------------------------- | :---------------------------------------------------------------------------: | :-----------------------------------------------------: | :--------------------------: | :-------------------------------: | :------------------------: |
| **自部署 & 开源**         |                             ✅ MIT 全源码可自托管                             |                    ✅ 开源基础历法库                    |       ❌ 闭源托管 SaaS       |          ❌ 依赖模型推理          |   ✅ 通常含前端与数据库    |
| **覆盖术数广度**          | ✅ 14 能力模块（八字/紫微/六爻/六壬/奇门/八宅/择吉/姓名/塔罗/周易/星座/合盘） | ❌ 仅干支/农历/基础黄历，无紫微/奇门/六壬/六爻/八宅装配 | 视服务商而定（通常按项付费） |       不稳定（易混淆流派）        | 视模板而定（往往只含单门） |
| **排盘确定性与契约**      |        ✅ 31 条 OpenAPI `3.0.3` 路径 + `./bazi` `--json` + CI 快照校验        |                  需自行封装接口与校验                   |     ✅ 有接口但规则黑盒      | ❌ 节气交接/真太阳时/排盘极易幻觉 |   耦合前端页面与业务模型   |
| **流派口径透明度**        |        ✅ `backend/constants/rulings.js` 唯一真源 + 响应 `school` 字段        |                   无内置多派口径清单                    |     ❌ 黑盒规则不可审阅      |        ❌ 每次回答流派混用        |  往往硬编码在页面或服务里  |
| **AI Agent / MCP 就绪**   |             ✅ 原生 `./bazi mcp`（14 只读工具）+ `./bazi schema`              |                      ❌ 需自行包裹                      |     需手写 Tool Wrapper      |                 —                 |    ❌ 面向人类 UI 点击     |
| **零数据库 / 无状态扩容** |                       ✅ 纯内存计算（Redis 仅可选缓存）                       |                       ✅ 纯计算库                       |      依赖云端配额与网络      |                 —                 |  ❌ 需维护 DB、账号与迁移  |

## 技术栈 / Tech Stack

- **Runtime**: Node.js 20+, Express 4
- **State**: 无。引擎是纯计算，不持有任何跨请求状态
- **Cache**: Redis 可选，仅用于多实例共享八字排盘缓存
- **AI Providers**: mock, OpenAI, Anthropic
- **Interfaces**: REST + OpenAPI / Swagger UI，以及 `./bazi` 程序化 CLI
- **Testing**: Node.js test runner，不依赖任何外部服务
- **Observability**: JSON request logs (Pino), request ID, health/readiness endpoints, Prometheus `/metrics`, optional Sentry

## 环境变量 / Configuration

本地开发参考 [.env.example](.env.example)，生产部署参考 [env.production.template](env.production.template)。`./bazi setup` 会基于模板生成 `.env`，`./bazi env` 可以查看、校验和改键。

**开发环境一个变量都不必填**，全部有默认值。生产环境的关键配置：

- `DOCS_PASSWORD`: **唯一的硬性必填项**。缺了它进程在生产模式下启动即退出（`/api-docs` 没法保护）
- `CORS_ALLOWED_ORIGINS`: 允许跨域的调用方来源。服务端到服务端、Agent 调用不带 Origin 头，不受影响
- `BACKEND_BASE_URL`: OpenAPI 文档里的 base URL
- `TRUST_PROXY`: 有反向代理时设置成**跳数**（一层 nginx 就填 `1`）。填 `true` 表示信任所有代理，此时 `X-Forwarded-For` 完全由客户端控制，限流可被一个请求头绕过
- `REDIS_URL`: 可选。只影响多实例之间的排盘缓存共享，不影响结果正确性
- `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`: 可选；未配置时 `AI_PROVIDER=mock`
- `METRICS_TOKEN`: `/metrics` 的 Bearer token；留空时该端点在生产环境返回 404
- `SHUTDOWN_DRAIN_MS`: 排水窗口，要按你的负载均衡探测节奏设置（模板里有对照表）
- `SENTRY_DSN`: 可选错误与性能监控

## FAQ / 常见问题

### 这是八字算法库还是完整应用？

都不是。它是一个自部署的计算服务：算法逻辑在 `backend/services/`，HTTP 入口是 `POST /api/bazi/calculate`，也可以用 `./bazi calc bazi` 调用。它不作为 npm 包发布，也不含界面。

### 为什么没有前端？

前端不是这个项目的卖点。它的价值在能力层——算法正确性、语义边界、接口契约和可运维性。界面形态因产品而异（Web、小程序、App、纯 agent 调用），塞一套参考实现进来只会模糊边界。要做界面，直接照 [docs/api.md](docs/api.md) 和 `docs/openapi.json` 调即可。

### 为什么连账号系统也删掉了？

同一个理由。注册、登录、OAuth、密码重置、历史记录、收藏这些能力和命理算法没有任何关系，任何一个真实产品都会用自己那一套。留着它们意味着这个项目要为一堆自己不擅长、调用方也不会用的能力承担安全和维护责任。删掉之后，整个存储层、会话层和它们带来的备份/迁移/一致性问题一起消失了。

### 没有 AI API Key 能运行吗？

可以。排盘、抽牌、起卦这些确定性计算完全不依赖 AI。未配置 `OPENAI_API_KEY` 或 `ANTHROPIC_API_KEY` 时，解读接口落到 `mock` provider。

### 需要数据库吗？

不需要。引擎不存任何数据。Redis 也是可选的，且只是缓存。

### 可以直接生产上线吗？

可以。无状态意味着扩容就是多起几个进程，部署可以随时整体销毁重建。生产需要配置的是 HTTPS 反向代理、`DOCS_PASSWORD`、`CORS_ALLOWED_ORIGINS`、`TRUST_PROXY`，以及可选的 Redis、AI 密钥、Sentry 和 `METRICS_TOKEN`。上线前请读 [PRODUCTION.md](PRODUCTION.md)。

### 哪些接口需要登录？

一个都不需要——项目没有账号系统。唯一带鉴权的是 `/api-docs`（Basic Auth）和 `/metrics`（Bearer token），它们是运维面。

### 为什么要用 `./bazi` 而不是直接 npm script？

`./bazi` 会记录引擎进程的状态，手动 `node server.js` 起的进程它管不到、之后也停不掉。CLI 还负责生成 `.env`、检查端口与依赖就绪状态，并在失败时给出可直接执行的修复命令。全部命令见 `./bazi help --json`。

### 引擎真的是无状态的吗？多实例扩容怎么处理？

是的。引擎不存数据库、不写本地状态文件、没有会话或账号系统，所有排盘计算都是纯内存无状态运算。水平扩容只需起多个实例；`REDIS_URL` 仅用于跨实例共享八字排盘缓存，不配 Redis 时每个实例使用进程内缓存，排盘结果完全一致。

### 真太阳时（True Solar Time）是如何处理的？精确度如何？

只要传入出生地点（或经纬度与时区），八字与合盘排盘默认启用真太阳时修正（按出生地经度与平太阳时差、均时差修正），确保子时与节气交接边界准确；如需强制使用钟表平太阳时，可传 `trueSolarTime: false` 退回钟表时间。

### 如何通过 MCP 或 Agent CLI 接入 AI Agent？

仓库根的 `./bazi` CLI 天生面向 Agent 设计：所有命令支持 `--json`（纯 JSON 输出至 stdout，诊断日志走 stderr）与契约化退出码。运行 `./bazi mcp` 可直接挂载为标准 stdio MCP Server（暴露 14 个只读能力工具），运行 `./bazi schema` 可导出 Anthropic / OpenAI / MCP 格式的 Tool Schema。

### OpenAPI 接口契约如何保证不漂移？

完整 HTTP 契约维护在 [docs/openapi.json](docs/openapi.json)，运行时通过 `/api-docs` 提供 Swagger UI（生产环境需 `DOCS_PASSWORD` Basic Auth）。CI 内置 OpenAPI 快照校验与 `scripts/check-docs.sh` 文档一致性检查，任何接口变更都必须同步更新快照。

### 商业使用与合规边界是什么？

项目采用 MIT License，允许商业使用、修改与二次分发。与社区 Web UI 全栈模板（冻结在 `v0.2.0`）互不同步，请勿跨仓搬运代码。部署时的内容免责声明、隐私合规、应用商店审核及当地法规责任由部署方自行承担，详见[限制与免责声明](#限制与免责声明--limitations)。

## 项目结构 / Repository Structure

```text
metaphysics-engine/
├── backend/                 # Express API
│   ├── routes/              # /api/bazi, /api/ziwei, /api/tarot, /api/iching, ...
│   ├── services/            # 算法与业务逻辑：calculation, ziwei, tarot, iching, ai, ...
│   ├── middleware/          # CORS, rate limit, validation, docs auth, error handling
│   ├── constants/ data/     # 干支、星曜、塔罗牌库、六十四卦
│   ├── scripts/             # start.mjs（容器入口）、generate-openapi.js
│   └── test/                # backend Node.js tests
├── tools/cli/               # ./bazi 程序化 CLI（calc/cast + setup/doctor/env/stack/test）
├── docs/                    # 文档体系入口见 docs/README.md
├── scripts/                 # CI 守卫与部署验证脚本
├── bazi                     # CLI entry point
├── docker-compose.yml       # 本地可选 Redis（引擎本身不需要）
├── docker-compose.prod.yml  # 生产参考栈：引擎 + 可选 Redis + autoheal
└── PRODUCTION.md            # 生产部署细节（总览见 docs/deployment.md）
```

## 测试 / Testing

```bash
./bazi test              # 全部目标：cli + lint + backend + engine
./bazi test backend      # 只跑后端
./bazi test --fail-on-skip --json   # CI 用：有目标被跳过就退 3

npm -C backend test      # 后端测试
npm run test:cli         # CLI 自身的契约测试
npm run test:engine      # 能力契约验证（要引擎在跑）
```

**前三个目标不需要任何外部服务**——没有数据库要准备，没有容器要起。这是无状态设计换来的直接好处。
`engine` 是唯一的例外：它拿真实引擎验证导出的工具 schema 里声明的可复现性确实成立
（声明 `deterministic` 的命令连调两次必须一字不差），引擎没起时记 `skipped`。

> `bazi test` 的目标未就绪时会记 `skipped` 并照样返回 0。读 `summary.skipped`，别只看退出码。

## 部署与生产注意事项 / Production Notes

- 引擎无状态：多实例部署不需要粘性会话，也不需要任何协调。
- 容器栈默认只把端口发布到宿主的 `127.0.0.1:4000`（`BACKEND_BIND_ADDR`），TLS 终结和公网入口交给你自己的反向代理。注意它和 `BIND_HOST`（Node 进程在容器内 listen 的地址，生产默认 `0.0.0.0`）不是一回事，改错哪个都会把引擎直接晾到公网上。
- 生产启动前会校验配置：`DOCS_PASSWORD` 缺失会阻止启动，其余缺失只打 warning。
- `/metrics` 需要 `METRICS_TOKEN`，且不要经公网反代暴露。
- 优雅停机带排水窗口：`SHUTDOWN_DRAIN_MS` 必须按你的负载均衡探测节奏设置，并小于编排层的 stop grace period。
- 发布前请阅读 [PRODUCTION.md](PRODUCTION.md)。

## 开发约定 / Development

这个项目最难的部分不是写代码，是**「写错了也不会报错」**：三传取法、安星链条、拆补定局、
节气交接的时刻精度——错了不抛异常，只会安静地给出一张错盘。所以改算法之前先分清两种情况，
处理方式完全不同：**算错了**（三传漏宗门、纳甲干支排错）是 bug，直接修并补测试；
**流派不同**（闰月归本月 vs 折半、晚子时换不换日）不是 bug，就地注明口径、必要时做成参数，
但不改默认。

加一个新能力要动哪几处、本地质量门槛、提交信息规范、以及哪些改动因为边界原因不做，
全部写在 [CONTRIBUTING.md](CONTRIBUTING.md)。已选定的流派口径逐条写在
[.claude/skills/bazi-cli/SKILL.md](.claude/skills/bazi-cli/SKILL.md)，改算法前先读那一份。

## 限制与免责声明 / Limitations

- 本项目是参考实现，不提供托管服务、不保证占卜或命理准确性。
- 八字、紫微、塔罗、周易和星座输出适合娱乐、文化研究、产品原型与代码学习，不应作为专业建议。
- 算法涉及流派选择（晚子时不换日、闰月归本月、藏干权重与旺衰阈值、真太阳时默认参与排盘），与你预期的流派可能不同——这些边界在 [.claude/skills/bazi-cli/SKILL.md](.claude/skills/bazi-cli/SKILL.md) 里逐条写明，代码里也就地标注了选定口径。
- AI 解读依赖外部模型质量、密钥、速率限制和提示词；mock provider 仅用于开发和演示。
- 反向代理、域名、证书和平台合规需要部署者自行配置与验证。

## 搜索意图与检索映射 / Search Intent & SEO / AEO / GEO

<details>
<summary><b>常见搜索问题与本仓库的对应解答（点击展开）</b></summary>

| 常见搜索意图 / Query                                    | 本仓库的解答与直达入口                                                                                                                                   |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 开源八字排盘 API / Chinese BaZi calculation API Node.js | `POST /api/bazi/calculate` 与 `./bazi calc bazi`，含真太阳时、加权五行、格局、双用神与大运流年 → [接口速查](#接口速查--api-endpoints)                    |
| 紫微斗数开源排盘引擎 / Zi Wei Dou Shu JSON API          | `POST /api/ziwei/calculate` 与 `./bazi calc ziwei`，输出十二宫、十四主星、二十颗乙级星、三方四正与 `flowYear` → [核心能力](#核心能力--core-capabilities) |
| 奇门遁甲 API 拆补法转盘 / Qi Men Dun Jia API            | `POST /api/qimen/chart` 与 `./bazi calc qimen`，拆补定局 + 转盘九星八门八神 + 门迫/入墓/击刑关系量 → [docs/api.md](docs/api.md)                          |
| 六爻纳甲装卦算法 / 大六壬九宗门起课引擎                 | `./bazi calc liuyao`（七规则推八宫 + 动爻生克 + 周易爻辞）与 `./bazi calc liuren`（九宗门全备）→ [docs/api.md](docs/api.md)                              |
| 八宅风水 / 三层择吉黄历 / 姓名五格 API                  | `POST /api/fengshui/bazhai` · `GET /api/fengshui/almanac` · `POST /api/fengshui/name` → [接口速查](#接口速查--api-endpoints)                             |
| 给 AI Agent 接真实算命/排盘工具 / Astrology MCP Server  | 运行 `./bazi mcp`（14 个只读能力工具）或 `./bazi schema --format openai` → [调用示例](#调用示例--usage-examples)                                         |
| 无状态真太阳时计算 / 海外出生节气交接怎么处理           | 88 城地点表 + `"纬度,经度"` 坐标，分离 `chartTime.used` 与 `chartTime.termReference` → [FAQ](#faq--常见问题)                                             |
| 自部署周易起卦 & 带种子的塔罗抽牌 API                   | `./bazi cast iching`（维基文库《周易》底本）与 `./bazi cast tarot`（FNV-1a + mulberry32 可复现 `seed`）→ [docs/api.md](docs/api.md)                      |

</details>

<sub>**Keywords / 关键词**：Metaphysics Engine · 无状态术数算法能力层 · 八字排盘 API · 紫微斗数开源引擎 · 六爻纳甲 · 大六壬 · 奇门遁甲 API · 八宅风水 · 择吉黄历 · 姓名五格 · 塔罗 API · 周易起卦 · 真太阳时排盘 · AI Agent 排盘工具 · MCP Server · OpenAPI 3.0.3 · Node.js Express · Chinese metaphysics API · BaZi calculation API · Zi Wei Dou Shu API · Qi Men Dun Jia API · Liu Yao CLI · Da Liu Ren calculator · agent-callable divination CLI · stateless fortune-telling backend.</sub>

## 文档 / Documentation

地图与同步约定：[docs/README.md](docs/README.md)。

- [docs/architecture.md](docs/architecture.md): 架构
- [docs/modules.md](docs/modules.md): 关键模块与核心逻辑
- [docs/deployment.md](docs/deployment.md): 本地 / 容器 / 服务器部署
- [docs/configuration.md](docs/configuration.md): 配置
- [docs/operations.md](docs/operations.md): 运维与排错
- [docs/development.md](docs/development.md): 本地开发
- [docs/api.md](docs/api.md): HTTP API 导览
- [docs/openapi.json](docs/openapi.json): OpenAPI 3.0.3 机器契约
- [docs/faq.md](docs/faq.md): 常见问题
- [llms.txt](llms.txt): AI / 答案引擎可读项目摘要（`llmstxt.org`）
- [codemeta.json](codemeta.json): CodeMeta 2.0 开源软件结构化元数据
- [.claude/skills/bazi-cli/SKILL.md](.claude/skills/bazi-cli/SKILL.md): 算法语义边界与 CLI 用法
- [CONTRIBUTING.md](CONTRIBUTING.md): 开发约定、质量门槛与算法改动判据
- [PRODUCTION.md](PRODUCTION.md): 生产部署细节
- [CHANGELOG.md](CHANGELOG.md): 版本变更记录

## License

MIT License。见 [LICENSE](LICENSE)。与社区 Web UI 全栈模板互不同步，不要搬代码。

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=qilaidev/metaphysics-engine&type=Date)](https://www.star-history.com/#qilaidev/metaphysics-engine&Date)

---

## Architecture & Ecosystem · qilai (`qilaidav.com`)

This open-source repository is engineered and maintained by **[qilai · qilaidav](https://qilaidav.com)** — an independent systems engineering studio focused on **Deterministic Systems Engineering & High-Signal Technical Diagnostics**.

- **Studio Website**: [https://qilaidav.com](https://qilaidav.com) ([English](https://qilaidav.com/en/))
- **Engineering Pillar Alignment**: [05 · Enterprise Requirement Ops & AI Foundation (Deterministic CLI / MCP)](https://qilaidav.com/workspace/) · [English Hub](https://qilaidav.com/en/workspace/)
- **Technical Notes & Production Field Reports**: [https://qilaidav.com/notes/](https://qilaidav.com/notes/)
- **Direct Engineering Contact**: [Telegram @BD8888](https://t.me/BD8888) · [Public Channel @AIKB8](https://t.me/AIKB8) · `hello@qilaidav.com`
