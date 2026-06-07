# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
- npm distribution (`npx @segnals/mcp`)
- Docker support (`ghcr.io/segnals/mcp`)
- CI/CD pipeline: lint → typecheck → test → build → audit → smoke test
- Boot smoke test verifying all 36 tools register
- `llms.txt` index for AI crawlers
- Compatibility matrix and supported clients table

\* = Coming soon
