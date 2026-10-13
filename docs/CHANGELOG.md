# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Not in the `latest` image yet: the image is rebuilt when a release tag is cut.

### Fixed
- `segnals_get_news` calls `/newsfeed/newsfeed`, the route the API serves (it called `/newsfeed`, which the API does not serve)
- `segnals_set_indicator_filter` writes `INDICATOR_FILTER.<NAME>.ENABLED` and the gate's own settings, the keys the engine reads (it wrote flat keys nothing read). Enabling a gate also sets the master switch `INDICATOR_FILTER.ENABLED`. A param the gate does not have, or a value of the wrong type, is refused and nothing is written
- Risk warnings read `MARTINGALE.ENABLED`, `TRADING_PARAMS.LEVERAGE` and `STOP_LOSS.VALUE_PCT` (they read flat keys that do not exist, so no bot was ever flagged). `segnals_explain_config` and the previews of `segnals_update_bot` and `segnals_create_strategy` share one helper. The high-leverage warning starts above 10x
- The `segnals_update_bot` preview judges the config the bot would hold after the update, not the update on its own, and says which in `warnings_basis`

### Added
- `segnals_get_dashboard` and `segnals_get_pnl_summary` take `timeframe` ("24h", "7d", "30d", "all") or `start_date` with `end_date`, and return the `period` the answer covers. With no period they report the last 7 days, as before, and now say so

### Removed
- `segnals_get_sentiment`, `segnals_get_market_price` and `segnals_search_knowledge`: placeholders that returned no data. The server has 33 tools. The `read:knowledge` scope has no tool yet

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

\* = Placeholder that returned no data; removed after 0.1.0 (see Unreleased)
