# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Several accounts in one server. `SEGNALS_ACCOUNTS_FILE` names a local JSON file of labelled keys, one per account, used instead of `SEGNALS_API_KEY`. The server refuses to start when the group or others have any permission on the file (`chmod 600`), when a label repeats or looks like a key, when a key is malformed, when two labels hold one key, and when `SEGNALS_API_KEY` is set as well. `SEGNALS_API_KEY` alone works as before, as the account `default`
- Every tool takes `account`. It is optional with one account and required with several (`segnals_list_accounts` excepted, where it only narrows the list): a call without it, or with a label the server does not hold, is refused with the list of labels and sends nothing. Each account has its own API client, so a call sends only the key of the account it names. Every answer starts with the label it acted on
- `segnals_list_accounts`: the labels, each key's mode (`live` or `test`, from its prefix; never the key) and what `GET /fleet` answers per account, or why it cannot. The server has 34 tools

### Security
- zod 4.6.7 (was 3.25), because the memory-exhaustion advisory GHSA-mrhx-c7xc-m3w5 has no fix in zod 3. The lockfile takes the body-parser, hono, @hono/node-server, fast-uri and qs releases that close the advisories published since 0.1.1. The production dependency audit passes again. The two record arguments, `preferences` of `segnals_set_notifications` and `config` of `segnals_update_bot`, now name their string keys, which zod 4 requires

## [0.1.1] — 2026-10-13

### Fixed
- A 403 is reported as a missing scope only when the API names the scope. Any other 403 (a protected bot, a tier limit, a frozen account) shows the API's own message; every 403 used to be reported as a missing scope. When a route accepts one of several scopes, the message names each
- `segnals_get_news` calls `/newsfeed/newsfeed`, the route the API serves (it called `/newsfeed`, which the API does not serve)
- `segnals_set_indicator_filter` writes `INDICATOR_FILTER.<NAME>.ENABLED` and the gate's own settings, the keys the engine reads (it wrote flat keys nothing read). Enabling a gate also sets the master switch `INDICATOR_FILTER.ENABLED`. A param the gate does not have, or a value of the wrong type, is refused and nothing is written
- Risk warnings read `MARTINGALE.ENABLED`, `TRADING_PARAMS.LEVERAGE` and `STOP_LOSS.VALUE_PCT` (they read flat keys that do not exist, so no bot was ever flagged). `segnals_explain_config` and the previews of `segnals_update_bot` and `segnals_create_strategy` share one helper. The high-leverage warning starts above 10x
- The `segnals_update_bot` preview judges the config the bot would hold after the update, not the update on its own, and says which in `warnings_basis`

### Added
- `segnals_get_dashboard` and `segnals_get_pnl_summary` take `timeframe` ("24h", "7d", "30d", "all") or `start_date` with `end_date`, and return the `period` the answer covers. With no period they report the last 7 days, as before, and now say so

### Removed
- `segnals_get_sentiment`, `segnals_get_market_price` and `segnals_search_knowledge`: placeholders that returned no data. The server has 33 tools. The `read:knowledge` scope has no tool yet

### Security
- Lockfile updated so the production dependency audit passes: `@modelcontextprotocol/sdk` 1.32.1 and the hono, ip-address, proxy-addr and qs releases that close the advisories published since 0.1.0. `package.json` ranges are unchanged

### Changed
- A release tag publishes the Docker image only. The npm publish job also needs the repository variable `NPM_PUBLISH_ENABLED` set to `true`, and it is not set

### Docs
- Install instructions name the two ways that exist: the GHCR image `ghcr.io/eidostein/segnals-mcp` and a build from source. The package is not on npm
- The staging address is `https://test.segnals.com/api`. Staging needs its own API key and is not all demo

## [0.1.0] — 2026-06-07

### Added

**Phase 1 — API Keys & Backend Auth**
- API key model with SHA-256 hashing, scoped permissions, and rate limiting
- `@auth_required(scope=...)` decorator supporting both API key and JWT auth
- Key format: `sk_live_*` (production), `sk_test_*` (testing)
- 11 granular scopes covering all platform domains

**Phase 2 — MCP Server Core (24 read-only tools)**
- Meta: `segnals_whoami`, `segnals_get_capabilities`, `segnals_get_safety_disclaimer`
- Account: `segnals_get_account`, `segnals_get_subscription`, `segnals_list_connections`
- Stats: `segnals_get_dashboard`, `segnals_get_pnl_summary`, `segnals_get_bot_performance`, `segnals_get_trades`
- Bots: `segnals_list_bots`, `segnals_get_bot`, `segnals_get_bot_logs`, `segnals_get_strategy_schema`, `segnals_explain_config`
- Marketplace: `segnals_browse_marketplace`, `segnals_get_listing`, `segnals_my_listings`
- News: `segnals_get_news`, `segnals_get_sentiment`*, `segnals_get_market_price`*, `segnals_search_knowledge`*
- Copy Trading: `segnals_get_copy_trading`
- Notifications: `segnals_get_notifications`

**Phase 3 — Write/Control Tools (12 new tools, 36 total)**
- Bot management: `segnals_create_bot` ✋, `segnals_update_bot` ✋, `segnals_start_bot` ✋, `segnals_stop_bot`, `segnals_restart_bot` ✋, `segnals_delete_bot` ✋
- Strategies: `segnals_create_strategy` ✋, `segnals_set_indicator_filter`
- Marketplace: `segnals_copy_strategy` ✋, `segnals_publish_listing` ✋
- Copy Trading: `segnals_control_copy_trading` ✋
- Notifications: `segnals_set_notifications`
- Two-step confirmation pattern for all destructive operations
- Risk detection: Martingale + leverage, missing stop-loss
- Credential rejection: API keys/secrets blocked in config payloads
- Audit trail: `client: "mcp"` marker on all mutations

**Phase 4 — Docs, Distribution & CI**
- Complete agent-facing documentation suite
- `AGENTS.md` playbook with onboarding script and decision guide
- npm package metadata for `@segnals/mcp` (the package was not published to the registry)
- Docker image (`ghcr.io/eidostein/segnals-mcp`)
- CI/CD pipeline: lint → typecheck → test → build → audit → smoke test
- Boot smoke test verifying all 36 tools register
- `llms.txt` index for AI crawlers
- Compatibility matrix and supported clients table

\* = Placeholder that returned no data; removed in 0.1.1
