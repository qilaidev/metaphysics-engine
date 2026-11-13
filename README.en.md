# Metaphysics Engine (`metaphysics-engine`) — Divination Calculation Capability Layer

[![CI](https://github.com/qilaidev/metaphysics-engine/actions/workflows/ci.yml/badge.svg)](https://github.com/qilaidev/metaphysics-engine/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![OpenAPI 3.0.3](https://img.shields.io/badge/OpenAPI-3.0.3_31_paths-009688.svg)](docs/openapi.json)
[![MCP Server](https://img.shields.io/badge/MCP-14_Read--Only_Tools-6E56CF.svg)](#usage-examples)
[![Stateless](https://img.shields.io/badge/Architecture-Stateless_Pure_Calc-10B981.svg)](docs/architecture.md)

[简体中文](README.md) · **English** · [API Docs](docs/api.md) · [OpenAPI](docs/openapi.json) · [Architecture](docs/architecture.md) · [llms.txt](llms.txt) · [CodeMeta](codemeta.json) · [Conventions](CONTRIBUTING.md) · [Security](SECURITY.md) · [Changelog](CHANGELOG.md) · [License](LICENSE)

> This is the open-source capability layer (MIT). It and the frozen `v0.2.0` Web full-stack
> community UI starter are two fully isolated, mutually out-of-sync codebases. This repository
> shares, reuses or depends on no code, data or assets from that line, and its algorithm rulings,
> CLI surface and MCP integration do not track it.

**Metaphysics Engine (`metaphysics-engine`) is an open-source (MIT), self-hostable, stateless Chinese metaphysics and astrology calculation capability layer built on Node.js 20+ and Express 4.** It consolidates 14 calculation and divination modules — BaZi (with True Solar Time), Zi Wei Dou Shu, King Fang Liu Yao, Da Liu Ren, Qi Men Dun Jia, Ba Zhai feng shui, three-layer Almanac, Name Grids, Tarot, I Ching, Zodiac/Ascendant, Synastry, and optional AI interpretation — into **31 OpenAPI 3.0.3 HTTP endpoints**, a `--json` programmatic CLI (`./bazi`), and a **14-tool stdio MCP server**, with zero database state and machine-readable school rulings in [`backend/constants/rulings.js`](backend/constants/rulings.js).

> This is the English edition alongside the authoritative [Simplified Chinese README](README.md).

**Contents**: [Entity Snapshot](#entity-snapshot) · [What It Is / Not](#what-it-is--what-it-is-not) · [Core Capabilities](#core-capabilities) · [Quick Start](#quick-start) · [Usage Examples](#usage-examples) · [API Endpoints](#api-endpoints) · [Use Cases & Alternatives](#use-cases--alternatives-comparison) · [Configuration](#configuration) · [FAQ](#faq) · [Testing](#testing) · [Production Notes](#production-notes) · [Development](#development) · [Limitations](#limitations) · [Documentation](#documentation)

## Entity snapshot

| Field               | Answer                                                                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Canonical entity    | `metaphysics-engine` (`v0.3.0`, root CLI `./bazi`)                                                                                            |
| Project type        | Open-source divination / astrology **stateless calculation capability layer** (MIT), delivered as HTTP API + CLI + MCP                        |
| Problem solved      | Turns silent-failure edge cases (solar-term minutes, True Solar Time, leap-month rules, nine gates) into tested, contract-backed capabilities |
| Who it is for       | Backend developers adding metaphysics calculation to products; AI agent teams replacing LLM hallucinations with real tools                    |
| Runtime shape       | **Stateless pure calculation** — no database, no accounts, no sessions, no disk writes                                                        |
| Optional dependency | Redis (`REDIS_URL`), strictly an **optional pure cache** (cross-instance BaZi hit rate only, never correctness)                               |
| Tech stack          | Node.js 20+, Express 4, `@modelcontextprotocol/sdk`, `lunar-javascript`, Node.js test runner                                                  |
| Local prerequisites | Node.js 20+ and npm 9+. No Docker, no database required                                                                                       |
| AI capability       | `mock` / `openai` / `anthropic` text interpretation, overridable per request; deterministic charting needs zero API keys                      |
| How you consume it  | Call the OpenAPI HTTP API, run `./bazi calc` / `./bazi cast` (`--json`), or mount `./bazi mcp` (14 read-only tools)                           |
| Rulings source      | [`backend/constants/rulings.js`](backend/constants/rulings.js) — echoed in every response `school` field and pinned by `rulings_lock.test.js` |
| API contract        | OpenAPI `3.0.3` across 31 paths in [docs/openapi.json](docs/openapi.json), served at `/api-docs`, snapshot-guarded in CI                      |
| License             | MIT. See [LICENSE](LICENSE)                                                                                                                   |
| Key limitation      | Output is for entertainment, cultural research, or product prototyping only — never medical, legal, financial, or life advice                 |

### What it is / What it is not

| Dimension              | What It Is                                                                      | What It Is Not                                                                   |
| ---------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **Product surface**    | Backend HTTP API + programmatic `./bazi` CLI + stdio MCP Server                 | **Not** a web application (no frontend code, no hosted demo UI)                  |
| **Delivery model**     | Self-hostable Node.js service and Docker image (`backend/Dockerfile`)           | **Not** a standalone published npm library or hosted SaaS fortune-telling site   |
| **Auth & persistence** | Zero database, zero user sessions, zero disk writes; callers own UX and storage | **Not** a backend starter with accounts, OAuth, history, or favorites (removed)  |
| **Algorithm boundary** | **Casting belongs to the engine; interpretation belongs to the caller**         | **Not** a scientific endorsement or hard-coded provider of contested verdicts    |
| **Compliance**         | MIT-licensed open-source reference implementation                               | **Not** a turnkey commercial compliance package (store, payment, or legal rules) |

## Core capabilities

- **BaZi charting** — four pillars, hidden-stem weighted elements, ten gods, strength,
  **month-branch structure** (格局, per the Zi Ping Zhen Quan school), **two parallel useful-god
  readings** (支撑/抑制 strength-based and 调候 climate-based, the latter from Qiong Tong Bao Jian),
  shensha, nayin, twelve life stages, **conception palace, fetal breath, life and body palaces**,
  inter-pillar clashes/combinations, void branches; luck cycles carry their start instant and a
  year-by-year breakdown. True solar time participates in charting; results are cached behind an
  `x-bazi-cache` response header.
- **Zi Wei Dou Shu** — lunar conversion, the five-element bureau, twelve palaces, fourteen major
  stars, auspicious/inauspicious stars, twenty B-grade stars, **the trine-and-opposition set
  (三方四正)**, life and body lords, four transformations, four twelve-god cycles (life stage,
  scholar, year-front, general-front), decade periods, plus annual and minor periods via `flowYear`. Star placement follows the
  orthodox chain: bureau from the life-palace nayin → Zi Wei → Tian Fu → the rest. Leap months
  follow the "fold into the base month" school.
- **Liu Yao (六爻纳甲)** — King Fang stem-branch attachment: palace membership, world/response
  lines, stem-branch pairs, six relatives, six gods, hidden spirits, void branches, month/day
  influence on each line, **moving-line action on the other lines**, line-to-line clashes and
  combinations, six-clash / six-combination hexagram flags, advancing and retreating branches,
  inner/outer trigram 伏吟 and 返吟, moving lines and the resulting hexagram. Palace membership is
  derived from the seven world-hexagram transformation rules, not a hard-coded 64-row table.
- **Da Liu Ren (大六壬)** — month general over hour to build the heaven/earth plates, stem
  lodging, the four courses, all nine gates of three-transmission derivation, twelve generals.
  Each transmission and each upper course carries its **decade stem, the general riding it, and
  its relative** (reckoned from the day stem), plus a void flag. The month general is the
  six-combination of the month branch, switching on the mid-qi.
- **Qi Men Dun Jia (奇门遁甲)** — bureau by the 拆补 (chai-bu) method, earth plate of three marvels and
  six instruments, duty-chief and duty-envoy, rotating-plate placement of the nine stars,
  eight gates and eight gods; every palace carries its **relational readings** — heaven/earth stem
  production and control, star-to-palace and gate-to-palace relations, gate oppression (門迫),
  in-palace 伏吟, void branches, the travelling horse, stem entombment and the six-instrument
  punishment.
- **Ba Zhai feng shui (八宅)** — life trigram (bounded by 立春) and the eight directional
  wandering stars, derived by line transformation rather than table lookup. Supply a sitting
  mountain and the **house trigram** is cast alongside it — east/west group, the house's own
  eight directions, and how the two match.
- **Almanac (择吉)** — three layers. **By day**: the recommended and avoided activities (宜/忌),
  the twelve day-officers, the twenty-eight mansions and their luck, the twelve yellow/black-path
  spirits, the day's clash and kill, auspicious/inauspicious spirits, Peng Zu taboos. **By hour**:
  each double-hour's own spirit, luck and activities. **By direction**: Tai Sui, its opposition,
  the three kills, and the annual nine-star chart with the fifth-yellow and second-black palaces.
  Annual directions are bounded by 立春; the centre star is computed, never looked up in a table.
- **Name grids (姓名五格)** — heaven/human/earth/outer/total grids and the three-talent
  configuration. Stroke counts are supplied by the caller.
- **Tarot** — full deck, SingleCard / ThreeCard / CelticCross spreads.
- **I Ching** — all 64 hexagrams with their Chinese names, King Wen numbers and the **canonical
  text** (judgment, line statements, Great Image), number-based (deterministic) and time-based
  divination, plus the resulting, nuclear, inverse and reversed hexagrams and per-line statements.
  The text is transcribed from the Chinese Wikisource edition of the Zhou Yi by a committed,
  re-runnable fetch script — never typed from memory.
- **Zodiac** — sign profiles, horoscopes, ascendant calculation, compatibility.
- **Synastry** — chart-pair analysis for two sets of birth data; each side takes its own birth
  place and timezone, so both charts use the same conventions as standalone BaZi charting.
- **AI interpretation** — for BaZi, Tarot, and I Ching, via mock / OpenAI / Anthropic, with a
  concurrency gate and a stream idle timeout.
- **Operations** — `/live`, `/health`, `/api/ready`, `/metrics` (Prometheus), Pino JSON logs,
  OpenAPI / Swagger UI, graceful shutdown with a drain window.
- **Programmatic CLI** — `./bazi` wraps both the algorithms and repo operations; every command
  supports `--json` and a documented exit-code contract, which makes it directly agent-callable.
  `./bazi mcp` mounts it as an MCP server over stdio, and `./bazi schema` exports the command tree
  as tool definitions (Anthropic / OpenAI / MCP) — both generated from that same tree, so there is
  no second list to drift.
  Every exported tool carries a declared side-effect level (`read-only` / `local-write` /
  `destructive`, surfaced as MCP's `readOnlyHint` / `destructiveHint`) and a reproducibility
  class — the first is what a permission check reads, the second decides whether a result can be
  cached or used as a regression baseline.

### One boundary running through every capability: casting belongs to the engine, interpretation to the caller

How a chart is _cast_ — three transmissions, star placement, bureau layout, wandering stars —
has exactly one correct answer, and the engine must get it right. How a chart is _read_ —
Zi Wei's temple/fall gradings, Qi Men pattern names, the relative weight of a given shensha —
varies sharply between schools; embedding one school's take would hand callers a judgement
with no traceable provenance.

So the engine emits every ingredient an interpretation needs, down to the relations between them:
not just each palace's star, gate, god and stem but how they produce and control one another; not
just each line's relatives and gods but what the moving lines do to the rest. The dividing line is
not "anything that sounds like a verdict is withheld" — it is **who is speaking**. Objective
relations (gate oppression _is_ the palace controlling the gate) and quoted almanac entries (the
day's 宜/忌) are given; evaluations and contested names (Qi Men pattern names, Zi Wei temple/fall
gradings) are not.

Where a _casting_ rule genuinely varies (hidden-stem weights, leap-month handling, the chai-bu
bureau method, rotating-plate placement, the white-tiger/dark-warrior reading of the eight gods,
entombment by elemental tomb), the choice is registered in one machine-readable source of truth,
[`backend/constants/rulings.js`](backend/constants/rulings.js): services read their thresholds from
it, every charting response carries a `school` field naming the school it used, and a lock test pins
the keys and values. Switching schools touches that one entry plus the line that reads it.

## Quick start

Prerequisites: **Node.js 20+ and npm**. No Docker, no database, no Redis.

```bash
git clone https://github.com/qilaidev/metaphysics-engine.git
cd metaphysics-engine

./bazi setup     # install dependencies, generate .env
./bazi doctor    # environment check; every failure prints an executable fix
./bazi stack up  # start the engine
./bazi test      # cli + lint + backend + engine
```

`./bazi help --json` is the single source of truth for the command list — this document
deliberately does not duplicate it.

Manual path:

```bash
npm install && npm -C backend install
NODE_ENV=development npm -C backend run dev   # http://127.0.0.1:4000
```

The backend does not bundle dotenv: `node server.js` reads real environment variables only. The
`./bazi` CLI parses the repo-root `.env` and injects it into child processes, with real
`process.env` taking precedence.

## Usage examples

```bash
curl -X POST http://127.0.0.1:4000/api/bazi/calculate \
  -H "Content-Type: application/json" \
  -d '{"birthYear":1990,"birthMonth":5,"birthDay":20,"birthHour":14,"gender":"male",
       "birthLocation":"Beijing","timezone":"Asia/Shanghai"}'

curl -X POST http://127.0.0.1:4000/api/tarot/draw \
  -H "Content-Type: application/json" -d '{"spreadType":"ThreeCard"}'
```

The same capabilities through the CLI:

```bash
./bazi calc bazi --birth 1990-05-20T14:30 --gender male --json
./bazi cast tarot --spread ThreeCard --json
```

Full endpoint list: [docs/api.md](docs/api.md). Swagger UI at `/api-docs`, OpenAPI JSON at
`/api-docs.json`. Every business endpoint is public — there is no authentication to wire up.

There are two ways to hand the engine to an agent. Both derive their tool definitions from the same
command tree, so there is no second list to drift.

**A ready-to-mount MCP server** — `./bazi mcp`, over stdio:

```json
{ "command": "./bazi", "args": ["mcp"] }
```

It exposes the 14 calculation tools by default, all read-only; operational commands require an
explicit `--scope ops|all`. Every tool call spawns a real CLI run, so argument validation, the
guard on destructive operations, and the exit-code contract all carry over unchanged; exit codes
become `isError`, and the CLI's `hint` / `next` fields go straight to the model. The engine has to
be running.

**A definition you register yourself** — `./bazi schema`, which needs no running engine:

```bash
./bazi schema --format openai > tools.json
```

Each exported tool carries a side-effect level (`read-only` / `local-write` / `destructive`) and a
reproducibility class — the former for permission decisions, the latter to decide whether a result
can be cached or used as a regression baseline.

## API endpoints

Every business endpoint is public and unauthenticated — the project has no account system. Only the
operations surface is protected.

| Capability                    | HTTP endpoint                                                                                   | CLI                    |
| ----------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------- |
| BaZi chart                    | `POST /api/bazi/calculate`                                                                      | `./bazi calc bazi`     |
| BaZi AI interpretation        | `POST /api/bazi/ai-interpret` · `POST /api/bazi/full-analysis`                                  | —                      |
| Zi Wei Dou Shu                | `POST /api/ziwei/calculate`                                                                     | `./bazi calc ziwei`    |
| Liu Yao (King Fang)           | `POST /api/liuyao/chart`                                                                        | `./bazi calc liuyao`   |
| Da Liu Ren                    | `POST /api/liuren/chart`                                                                        | `./bazi calc liuren`   |
| Qi Men Dun Jia                | `POST /api/qimen/chart`                                                                         | `./bazi calc qimen`    |
| Ba Zhai feng shui             | `POST /api/fengshui/bazhai`                                                                     | `./bazi calc bazhai`   |
| Almanac / day selection       | `GET /api/fengshui/almanac`                                                                     | `./bazi calc almanac`  |
| Name grids                    | `POST /api/fengshui/name`                                                                       | `./bazi calc name`     |
| Synastry                      | `POST /api/synastry/analyze`                                                                    | `./bazi calc synastry` |
| Tarot                         | `POST /api/tarot/draw` · `GET /api/tarot/cards` · `POST /api/tarot/ai-interpret`                | `./bazi cast tarot`    |
| I Ching                       | `POST /api/iching/divine` · `GET /api/iching/hexagrams` · `POST /api/iching/ai-interpret`       | `./bazi cast iching`   |
| Zodiac                        | `GET /api/zodiac/{sign}` · `GET /api/zodiac/{sign}/horoscope` · `GET /api/zodiac/compatibility` | `./bazi calc zodiac`   |
| Ascendant                     | `POST /api/zodiac/rising`                                                                       | `./bazi calc rising`   |
| Daily pillar                  | `GET /api/calendar/daily`                                                                       | `./bazi calc daily`    |
| True-solar-time locations     | `GET /api/locations`                                                                            | —                      |
| AI provider status            | `GET /api/ai/providers`                                                                         | —                      |
| Health / readiness            | `GET /live` · `GET /health` · `GET /api/ready` · `GET /api/system/cache-status`                 | `./bazi stack status`  |
| API docs (Basic Auth in prod) | `GET /api-docs` · `GET /api-docs.json`                                                          | —                      |
| Metrics (bearer token)        | `GET /metrics`                                                                                  | —                      |

## Use cases & alternatives comparison

### Where this fits

- **AI Agent Tool & MCP Backends**: Give Claude, OpenAI, or custom LangGraph/MCP agents deterministic Chinese metaphysics calculation tools via `./bazi mcp` or `./bazi schema --format openai` instead of letting an LLM guess GanZhi pillars.
- **Commercial Astrology & Cultural Research Apps**: Embed a fast, stateless Express HTTP microservice (`docs/openapi.json`, 31 documented routes) behind any React, iOS, WeChat Mini Program, or Go/Python backend without bundling Node calculation logic into clients.
- **Quantitative & Batch Chart Pipelines**: Run reproducible BaZi, Zi Wei Dou Shu, Qi Men Dun Jia, and synastry computations locally in CI or data pipelines with pure JSON stdout and explicit exit codes.

### Alternatives comparison

| Capability                        | `metaphysics-engine`                                                                | Raw `lunar-javascript`                             | Third-party SaaS Fortune APIs            | Direct LLM Prompting              | Full-stack UI Starters        |
| --------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------- | ---------------------------------------- | --------------------------------- | ----------------------------- |
| **Architecture & State**          | Pure in-memory stateless HTTP API + CLI + MCP                                       | Low-level JS calendar library only                 | Closed vendor SaaS                       | Stochastic text generation        | Monolithic DB + Auth + UI     |
| **GanZhi & Solar-Term Precision** | Deterministic astronomical boundaries + True Solar Time                             | Calendar conversion only; caller must build charts | Black-box implementation                 | Hallucinates pillars and mansions | Coupled to demo UI flows      |
| **Eight Systems Unified**         | BaZi, Zi Wei, Liu Yao, Da Liu Ren, Qi Men, Ba Zhai, Almanac, Name + Tarot & I Ching | Requires stitching separate libs                   | Usually BaZi-only or pricey per endpoint | High cross-system confusion       | Limited to showcase screens   |
| **Agent Native (`MCP` / Schema)** | Built-in `./bazi mcp`, `./bazi schema`, JSON stdout                                 | None                                               | Manual HTTP wrappers                     | N/A                               | None                          |
| **Data Privacy & Rate Control**   | Self-hosted, zero DB, optional Redis cache                                          | Local lib                                          | Sends birth data to third-party servers  | Sends PII to LLM provider         | Requires managing user PII DB |

## Configuration

See [.env.example](.env.example) for development and
[env.production.template](env.production.template) for production.

**Development needs no configuration at all** — every variable has a default. In production:

- `DOCS_PASSWORD` — the **only hard requirement**. Without it the process exits at startup.
- `CORS_ALLOWED_ORIGINS` — browser client origins. Server-to-server and agent callers send no
  Origin header and are unaffected.
- `BACKEND_BASE_URL` — base URL advertised in the OpenAPI document.
- `TRUST_PROXY` — set to the **hop count** (`1` for a single nginx). Setting it to `true` trusts any
  `X-Forwarded-For`, which makes rate limiting bypassable with a forged header.
- `REDIS_URL` — optional; cross-instance chart cache only.
- `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` — optional; without them `AI_PROVIDER` falls back to `mock`.
- `METRICS_TOKEN` — bearer token for `/metrics`; left empty the endpoint returns 404 in production.
- `SHUTDOWN_DRAIN_MS` — drain window; size it against your load balancer's probe cadence (the
  template has a lookup table).

## FAQ

### Is the engine truly stateless? How does horizontal scaling work?

Yes. There is no database, no user account system, no session store, and no disk writes. Every chart calculation runs purely in memory. To scale out, run more instances behind your reverse proxy. `REDIS_URL` is strictly optional and only shares BaZi chart cache across instances; without Redis, each instance uses an in-process cache with identical calculation results.

### How accurate is True Solar Time correction?

Whenever a birth location (or longitude/timezone) resolves, BaZi and Synastry charting automatically applies true solar time correction (longitude offset + equation of time) so hour-pillar and solar-term boundaries remain accurate. Pass `trueSolarTime: false` to fall back to local clock time.

### How do I wire this into an AI Agent via MCP or CLI?

The root `./bazi` CLI is built for programmatic agent use: every command supports `--json` (clean JSON on stdout, diagnostics on stderr) and a documented exit-code contract. Run `./bazi mcp` to expose the 14 read-only capability tools as a stdio MCP server, or `./bazi schema` to export Anthropic / OpenAI / MCP tool definitions.

### How is the OpenAPI contract kept in sync?

The full HTTP specification lives in [docs/openapi.json](docs/openapi.json) and is served at runtime on `/api-docs` (protected by `DOCS_PASSWORD` Basic Auth in production). CI enforces an OpenAPI snapshot check and `scripts/check-docs.sh` to prevent contract drift.

### Can it run without an LLM API key?

Yes. All deterministic charting, casting, and almanac calculations require zero LLM keys. If `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` are unset, interpretation endpoints fall back to the `mock` provider.

### What are the commercial and compliance boundaries?

The codebase is MIT-licensed — commercial use, modification, and redistribution are permitted. Output is intended for entertainment, cultural research, education, and prototyping. Deployers remain responsible for user-facing disclaimers, privacy/data-protection compliance, app-store review, and local regulations.

### Why use `./bazi` instead of calling `npm` scripts directly?

`./bazi` tracks the managed engine process PID and state; a manually started `node server.js` cannot be stopped or inspected by `./bazi stack`. The CLI also generates `.env`, checks port/dependency readiness, and prints executable remediation commands on failure (`./bazi help --json`).

### Does the engine require PostgreSQL, MySQL, or Redis in production?

No database is required or supported — there are zero user tables, sessions, or disk persistence. `REDIS_URL` is strictly optional for sharing BaZi chart cache across multiple horizontally scaled instances; without Redis, each instance uses an identical in-process cache.

### Which metaphysics and casting capabilities are exposed to AI agents?

`./bazi schema --format mcp` and `./bazi mcp` expose 14 read-only capability tools covering BaZi (`bazi_calc_bazi`), Zi Wei Dou Shu (`bazi_calc_ziwei`), Liu Yao (`bazi_calc_liuyao`), Da Liu Ren (`bazi_calc_liuren`), Qi Men Dun Jia (`bazi_calc_qimen`), Ba Zhai (`bazi_calc_bazhai`), Almanac (`bazi_calc_almanac`), Name analysis (`bazi_calc_name`), Synastry (`bazi_calc_synastry`), Zodiac (`bazi_calc_zodiac`), Rising sign (`bazi_calc_rising`), Daily fortune (`bazi_calc_daily`), I Ching casting (`bazi_cast_iching`), and Tarot casting (`bazi_cast_tarot`).

## Testing

```bash
./bazi test                        # cli + lint + backend + engine
./bazi test --fail-on-skip --json  # for CI: a skipped target becomes a hard failure
```

**The first three targets need no external services** — no database to provision, no containers to
start. That is a direct consequence of the stateless design. `engine` is the one exception: it runs
the capability commands against a live engine to verify that the reproducibility declared in the
exported tool schema actually holds (anything declared `deterministic` must return byte-identical
output twice in a row). It is recorded as `skipped` when no engine is running.

## Production notes

- Stateless: scaling out is just more processes. No sticky sessions, no coordination.
- The container stack publishes the port to `127.0.0.1:4000` on the host by default
  (`BACKEND_BIND_ADDR`); TLS termination belongs to your reverse proxy. That is a different knob
  from `BIND_HOST`, the address the Node process listens on inside the container (`0.0.0.0` in
  production) — get either one wrong and the engine ends up on the public internet.
- Startup validates production config: a missing `DOCS_PASSWORD` blocks boot; everything else warns.
- Graceful shutdown drains before closing the listener — `SHUTDOWN_DRAIN_MS` must stay below the
  orchestrator's stop grace period.
- Read [PRODUCTION.md](PRODUCTION.md) before deploying.

## Development

The hardest part of this project is not writing code, it is that **a wrong answer raises no
error**: three-transmission derivation, the star-placement chain, bureau determination, the
instant a solar term turns. Get one wrong and nothing throws — you simply get a wrong chart.
So classify the problem before changing an algorithm, because the two cases are handled very
differently: **a bug** (a missing derivation gate, a wrong stem-branch pair) gets fixed and
covered by a test; **a school difference** (leap-month handling, late-Zi day rollover) does
not — the chosen ruling is documented in place and may be exposed as a parameter, but the
default is not silently changed.

Where a new capability has to land, the local quality gates, the commit convention
and the changes that are out of bounds are all in [CONTRIBUTING.md](CONTRIBUTING.md). The
rulings already chosen are listed one by one in
[.claude/skills/bazi-cli/SKILL.md](.claude/skills/bazi-cli/SKILL.md) — read that before
touching an algorithm.

## Limitations

- A reference implementation. No hosted service, no accuracy guarantee.
- Output suits entertainment, cultural research, prototyping, and code study — not professional advice.
- The algorithms make school-specific choices (late-Zi hour does not roll the day pillar, leap
  months fold into the base month, hidden-stem weights and strength thresholds, and true solar time
  participates in charting by default whenever the birth location resolves to a longitude — pass
  `trueSolarTime: false` to fall back to clock time). These are documented one by one in
  [.claude/skills/bazi-cli/SKILL.md](.claude/skills/bazi-cli/SKILL.md) and annotated in the code.
- AI interpretation depends on provider model quality, keys, rate limits, and prompts.
- Reverse proxy, domains, certificates, and jurisdictional compliance are the deployer's responsibility.

## Search & discoverability

**Keywords**: `metaphysics-engine` · `chinese-metaphysics` · `bazi-api` · `ziwei-doushu` · `liuyao` · `daliuren` · `qimendunjia` · `bazhai` · `iching` · `tarot-api` · `synastry` · `true-solar-time` · `mcp-server` · `openapi-3.0` · `stateless-microservice` · `node-cli`

<details>
<summary>Search Intent & Query Mapping (for developers & answer engines)</summary>

| Search / Prompt Intent                                                  | Target Capability / Module                                | Entry Point / Artifact                                                            |
| ----------------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Open-source stateless BaZi / Four Pillars HTTP API in Node.js           | BaZi, True Solar Time, luck cycles & synastry engine      | [docs/openapi.json](docs/openapi.json) · [docs/api.md](docs/api.md)               |
| Deterministic MCP server & tool schemas for Chinese metaphysics         | 14 read-only MCP / OpenAI / Anthropic tool definitions    | `./bazi mcp` · `./bazi schema --format mcp`                                       |
| Self-hosted Zi Wei Dou Shu, Liu Yao, Da Liu Ren & Qi Men Dun Jia engine | Multi-system calculation & hexagram/chart charting layer  | [docs/modules.md](docs/modules.md) · [docs/architecture.md](docs/architecture.md) |
| Production deployment without PostgreSQL or required Redis              | In-memory cache, `DOCS_PASSWORD` auth & nginx proxy guide | [docs/deployment.md](docs/deployment.md) · [PRODUCTION.md](PRODUCTION.md)         |
| Algorithmic rules and CLI stdout/exit-code contract for agents          | Strict JSON stdout / stderr separation & skill contract   | [.claude/skills/bazi-cli/SKILL.md](.claude/skills/bazi-cli/SKILL.md)              |
| Machine-readable project & ontology metadata for crawlers               | `llmstxt.org` summary & `CodeMeta v2.0` descriptor        | [llms.txt](llms.txt) · [codemeta.json](codemeta.json)                             |

</details>

Suggested GitHub About: `Stateless Chinese metaphysics calculation engine — BaZi, Zi Wei Dou Shu, Liu Yao, Da Liu Ren, Qi Men Dun Jia, Ba Zhai, Tarot & I Ching — HTTP OpenAPI, Agent CLI & MCP.`

## Documentation

Index and sync rules: [docs/README.md](docs/README.md). The Chinese README ([README.md](README.md)) is authoritative.

- [docs/architecture.md](docs/architecture.md) — architecture
- [docs/modules.md](docs/modules.md) — key modules and core logic
- [docs/deployment.md](docs/deployment.md) — local, container, and server deploy
- [docs/configuration.md](docs/configuration.md) — configuration
- [docs/operations.md](docs/operations.md) — operations and troubleshooting
- [docs/development.md](docs/development.md) — local development
- [docs/api.md](docs/api.md) — HTTP API guide
- [docs/faq.md](docs/faq.md) — FAQ
- [llms.txt](llms.txt) — AI / answer-engine summary
- [codemeta.json](codemeta.json) — CodeMeta v2.0 machine-readable software metadata
- [.claude/skills/bazi-cli/SKILL.md](.claude/skills/bazi-cli/SKILL.md) — algorithmic semantics and the CLI contract
- [CONTRIBUTING.md](CONTRIBUTING.md) — development conventions, quality gates, algorithm-change criteria
- [PRODUCTION.md](PRODUCTION.md) — production deployment details

## License

MIT. See [LICENSE](LICENSE). Fork, modify, redistribute and commercial use are all permitted.

Disclaimers for divination/astrology content, privacy and data protection, app-store and platform review, and local regulatory compliance remain the deployer's responsibility. This repository shares no code with the frozen `v0.2.0` community Web UI starter — do not move changes between the two.

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=qilaidev/metaphysics-engine&type=Date)](https://www.star-history.com/#qilaidev/metaphysics-engine&Date)

---

## Architecture & Ecosystem · qilai (`qilaidav.com`)

This open-source project is engineered and maintained by **[qilai · qilaidav](https://qilaidav.com)** — an independent systems engineering studio focused on **Deterministic Systems Engineering & High-Signal Technical Diagnostics**.

- **Pillar Alignment**: [05 · Developer Workspace & Agent Toolchains](https://qilaidav.com/workspace/) · [English Hub](https://qilaidav.com/en/workspace/)
- **Studio Website**: [https://qilaidav.com](https://qilaidav.com) ([EN](https://qilaidav.com/en/))
- **Technical Notes & Field Reports**: [https://qilaidav.com/notes/](https://qilaidav.com/notes/)
- **Direct Engineering Contact**: [Telegram @BD8888](https://t.me/BD8888) · [Public Channel @AIKB8](https://t.me/AIKB8) · `hello@qilaidav.com`
