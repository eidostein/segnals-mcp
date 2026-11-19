# Tools Reference

The server has 41 tools and one resource template, `segnals://settings/{engine}`. All tools are prefixed `segnals_` to avoid name collisions in multi-MCP setups.

## The `account` argument

Every tool takes `account`, the label of the account to act on (see
[Several accounts](CONFIGURATION.md#several-accounts)). With one account it is optional.
With several it is required, and a call without it, or with a label the program does not
hold, is refused with the list of labels. The exception is `segnals_list_accounts`, which
lists every account and where `account` only narrows the list. Every answer starts with a
line naming the account it acted on, for example `account: vip-a`. No call acts on two
accounts.

## Confirmation Pattern

Tools marked with ✋ use **two-step confirmation**:
1. Call without `confirm` (or `confirm: false`) → returns a **preview** of what will happen (no mutation)
2. Call with `confirm: true` → **executes** the action

This prevents accidental mutations and ensures the AI agent presents consequences before acting.

## Accounts

### `segnals_list_accounts`
- **Scope:** none, local
- **Purpose:** List the accounts this program holds keys for. Use it first when you do not know the labels
- **Returns:** per account its `label`, its key's `mode` (`live` or `test`, read from the key's prefix; the key itself is never shown), and what `GET /fleet` answers for it, or `fleet: null` with `fleet_unavailable` saying why (a key without a fleet, or a server whose fleet manager is off)
- **Takes:** `account` (optional): list only that account
- **Example:** `segnals_list_accounts()`

## Meta / Connection

### `segnals_whoami`
- **Scope:** any valid key
- **Purpose:** Verify your API key works and check your identity
- **Returns:** username, tier, language, subscription status
- **Example:** `segnals_whoami()`

### `segnals_get_capabilities`
- **Scope:** any valid key
- **Purpose:** List all available tools and their required scopes
- **Returns:** tool catalog with scope requirements and confirmation flags
- **Example:** `segnals_get_capabilities()`

### `segnals_get_safety_disclaimer`
- **Scope:** any valid key
- **Purpose:** Get the risk/safety disclaimer text
- **Returns:** disclaimer text
- **Example:** `segnals_get_safety_disclaimer()`

## Account & Subscription

### `segnals_get_account`
- **Scope:** `read:account`
- **Purpose:** Get account details (tier, subscription, bot limits)
- **Example:** `segnals_get_account()`

### `segnals_get_subscription`
- **Scope:** `read:account`
- **Purpose:** Get subscription plan and billing status
- **Example:** `segnals_get_subscription()`

### `segnals_list_connections`
- **Scope:** `read:account`
- **Purpose:** Check which exchanges are connected (booleans only — no secrets)
- **Example:** `segnals_list_connections()`

## Stats / PnL / Performance

### `segnals_get_dashboard`
- **Scope:** `read:stats`
- **Params:** `timeframe` (optional: "24h" | "7d" | "30d" | "all", default "7d"), `start_date` and `end_date` (optional, ISO 8601, given together)
- **Purpose:** Get the trading dashboard overview for a period
- **Returns:** the `period` the answer covers; total PnL, win rate and trade count of that period; the equity curve; the current bot counts and the 10 latest trades (those two are not limited to the period)
- **Example:** `segnals_get_dashboard({ timeframe: "30d" })`

### `segnals_get_pnl_summary`
- **Scope:** `read:stats`
- **Params:** `timeframe` (optional: "24h" | "7d" | "30d" | "all", default "7d"), `start_date` and `end_date` (optional, ISO 8601, given together)
- **Purpose:** Get the PnL summary for a period
- **Returns:** the `period` the answer covers; total PnL, win rate and trade count of that period; the current bot counts
- **Example:** `segnals_get_pnl_summary({ start_date: "2026-10-01", end_date: "2026-11-01" })`

**Periods.** With no period the two tools above report the last 7 days and say so in
`period`. A date range takes precedence over `timeframe`. A bare date means 00:00 of that
day, so an `end_date` of `2026-10-31` leaves the 31st out: pass `2026-11-01` to include it.
One bound without the other, or a value that is not a date, is refused before the API is
called.

### `segnals_get_bot_performance`
- **Scope:** `read:stats`
- **Params:** `bot_id` (required, integer)
- **Purpose:** Get a specific bot's performance metrics
- **Example:** `segnals_get_bot_performance({ bot_id: 42 })`

### `segnals_get_trades`
- **Scope:** `read:stats`
- **Params:** `bot_id` (optional), `limit` (optional, max 100), `offset` (optional)
- **Purpose:** Get recent trade history
- **Example:** `segnals_get_trades({ limit: 20 })`

## Bots (Read)

### `segnals_list_bots`
- **Scope:** `read:bots`
- **Purpose:** List all trading bots
- **Returns:** id, name, exchange, status, symbol for each bot
- **Example:** `segnals_list_bots()`

### `segnals_get_bot`
- **Scope:** `read:bots`
- **Params:** `bot_id` (required, integer)
- **Purpose:** Get a single bot's full configuration and status
- **Example:** `segnals_get_bot({ bot_id: 42 })`

### `segnals_get_bot_logs`
- **Scope:** `read:bots`
- **Params:** `bot_id` (required), `limit` (optional, max 200)
- **Purpose:** Get bot execution logs
- **Example:** `segnals_get_bot_logs({ bot_id: 42 })`

### `segnals_get_strategy_schema`
- **Scope:** `read:bots`
- **Params:** `bot_id` (required, integer)
- **Purpose:** Get the configuration schema for a bot
- **Example:** `segnals_get_strategy_schema({ bot_id: 42 })`

### `segnals_explain_config`
- **Scope:** `read:bots`
- **Params:** `bot_id` (required, integer)
- **Purpose:** Review a bot's config for risk. Returns the config with warnings for three settings: martingale enabled (`MARTINGALE.ENABLED`), leverage above 10x (`TRADING_PARAMS.LEVERAGE`), and a stop-loss that is missing or 0 (`STOP_LOSS.VALUE_PCT`)
- **Example:** `segnals_explain_config({ bot_id: 42 })`

## Bots (Write/Control) ✋

### `segnals_create_bot` ✋
- **Scope:** `write:bots`
- **Params:** `exchange` (required: "bybit" | "phemex" | "mt5"), `confirm` (boolean)
- **Purpose:** Create a new trading bot (starts in 'stopped' state)
- **Disclaimer:** Risk disclaimer included in response
- **Example:** `segnals_create_bot({ exchange: "bybit", confirm: true })`

### `segnals_update_bot` ✋
- **Scope:** `write:bots`
- **Params:** `bot_id` (required), `name` (optional), `config` (optional), `confirm` (boolean)
- **Purpose:** Update bot config. The config is merged into the stored one, so send only the keys you change, nested as `segnals_get_bot` shows them
- **Preview:** Reads the bot (scope `read:bots`) and warns about the config it would hold after the update: martingale enabled, leverage above 10x, stop-loss missing or 0. `warnings_basis` says what the warnings were judged on; if the bot cannot be read, that is only the keys in the update
- **Safety:** Rejects exchange API keys/MT5 passwords in config
- **Example:** `segnals_update_bot({ bot_id: 42, config: { TRADING_PARAMS: { LEVERAGE: 5 } }, confirm: true })`

### `segnals_start_bot` ✋
- **Scope:** `control:bots`
- **Params:** `bot_id` (required), `confirm` (boolean)
- **Purpose:** Start a stopped bot. Cold-start cycle: starting → warming_up → running
- **Disclaimer:** Risk disclaimer included in response
- **Example:** `segnals_start_bot({ bot_id: 42, confirm: true })`

### `segnals_stop_bot`
- **Scope:** `control:bots`
- **Params:** `bot_id` (required)
- **Purpose:** Stop a running bot (safe action — no confirmation needed)
- **Example:** `segnals_stop_bot({ bot_id: 42 })`

### `segnals_restart_bot` ✋
- **Scope:** `control:bots`
- **Params:** `bot_id` (required), `confirm` (boolean)
- **Purpose:** Restart a bot (resets loss streaks, goes through cold-start)
- **Example:** `segnals_restart_bot({ bot_id: 42, confirm: true })`

### `segnals_delete_bot` ✋
- **Scope:** `write:bots`
- **Params:** `bot_id` (required), `confirm` (boolean)
- **Purpose:** Permanently delete a bot (irreversible)
- **Example:** `segnals_delete_bot({ bot_id: 42, confirm: true })`

## Strategies (Write)

### `segnals_create_strategy` ✋
- **Scope:** `write:strategies`
- **Params:** `exchange` (required), `name` (required), `config` (required), `confirm` (boolean)
- **Purpose:** Create a fully configured strategy (bot + config in one call). The config is nested as `segnals_get_bot` shows it; settings it does not name keep the platform default
- **Safety:** Flags martingale, leverage above 10x and a stop-loss of 0 in the config it is given; rejects credentials
- **Disclaimer:** Risk disclaimer included in response
- **Example:** `segnals_create_strategy({ exchange: "bybit", name: "Scalper", config: { TRADING_PARAMS: { LEVERAGE: 3 }, STOP_LOSS: { VALUE_PCT: 2 } }, confirm: true })`

### `segnals_set_indicator_filter`
- **Scope:** `write:bots`
- **Params:** `bot_id` (required), `filter_type` (required: "adx" | "rsi" | "ema" | "atr"), `enabled` (required), `params` (optional)
- **Purpose:** Switch one gate of a bot's indicator filter on or off and set its parameters (no confirmation)
- **Writes:** `INDICATOR_FILTER.<NAME>.ENABLED` and the given params. Enabling a gate also sets the master switch `INDICATOR_FILTER.ENABLED`, which the engine needs before it runs any gate, so a gate already stored as enabled becomes active too. Disabling leaves the master switch alone
- **Params per gate:** `adx`: `period`, `min`, `max`. `rsi`: `period`, `mode` ("filter_extremes" | "require_band"), `overbought`, `oversold`. `ema`: `fast`, `slow`. `atr`: `period`, `min_pct`, `max_pct`. Any other key, or a value of the wrong type, is refused and nothing is written
- **Note:** All gates share `INDICATOR_FILTER.TIMEFRAME` (default "D"); change it with `segnals_update_bot`. If the bot is running, restart it to be sure the change is applied
- **Example:** `segnals_set_indicator_filter({ bot_id: 42, filter_type: "adx", enabled: true, params: { period: 14, min: 25 } })`

## Marketplace (Read)

### `segnals_browse_marketplace`
- **Scope:** `read:marketplace`
- **Params:** `page` (optional), `per_page` (optional, max 50), `exchange` (optional)
- **Purpose:** Browse strategy listings
- **Example:** `segnals_browse_marketplace({ exchange: "bybit" })`

### `segnals_get_listing`
- **Scope:** `read:marketplace`
- **Params:** `listing_id` (required, string or number)
- **Purpose:** Get listing details and performance report
- **Example:** `segnals_get_listing({ listing_id: "abc123" })`

### `segnals_my_listings`
- **Scope:** `read:marketplace`
- **Purpose:** View your own marketplace listings and sales
- **Example:** `segnals_my_listings()`

## Marketplace (Write) ✋

### `segnals_copy_strategy` ✋
- **Scope:** `write:marketplace`
- **Params:** `listing_id` (required), `confirm` (boolean)
- **Purpose:** Copy a marketplace strategy to your bots
- **Flow:** Free = immediate copy. Paid = returns invoice URL for crypto payment
- **Disclaimer:** Risk disclaimer and buyer consent included
- **Example:** `segnals_copy_strategy({ listing_id: "abc123", confirm: true })`

### `segnals_publish_listing` ✋
- **Scope:** `write:marketplace`
- **Params:** `source_bot_id` (required), `title` (required), `description` (required), `price_usd` (required), `confirm` (boolean)
- **Purpose:** Publish a bot as a marketplace listing (goes to admin review)
- **Requires:** VIP tier
- **Example:** `segnals_publish_listing({ source_bot_id: 42, title: "My Strategy", description: "...", price_usd: 29.99, confirm: true })`

## News

### `segnals_get_news`
- **Scope:** `read:news`
- **Purpose:** Get the market newsfeed
- **Example:** `segnals_get_news()`

Market sentiment, live prices and help search have no tool, and the `read:knowledge`
scope has no tool yet.

## Copy Trading

### `segnals_get_copy_trading`
- **Scope:** `read:account`
- **Purpose:** Get copy trading configuration and status
- **Example:** `segnals_get_copy_trading()`

### `segnals_control_copy_trading` ✋
- **Scope:** `control:bots`
- **Params:** `action` (required: "start" | "stop"), `exchange` (required: "bybit" | "phemex"), `confirm` (boolean)
- **Purpose:** Start or stop copy trading for an exchange
- **Requires:** VIP tier
- **Example:** `segnals_control_copy_trading({ action: "start", exchange: "bybit", confirm: true })`

## Notifications

### `segnals_get_notifications`
- **Scope:** `manage:notifications`
- **Purpose:** Get notification preferences
- **Example:** `segnals_get_notifications()`

### `segnals_set_notifications`
- **Scope:** `manage:notifications`
- **Params:** `preferences` (required, object with valid keys)
- **Purpose:** Update notification preferences (deep-merged, non-destructive)
- **Valid keys:** `system_reminders`, `daily_report`, `performance_alerts`, `weekly_summary`, `custom_alerts`
- **Example:** `segnals_set_notifications({ preferences: { daily_report: { enabled: true, hour_utc: 8 } } })`

## Settings catalog and fleet (SPEC 453)

The three tools read and change nothing. Each carries `readOnlyHint`, and each of their errors ends with "What to do next".

### `segnals_get_settings_catalog`
- **Scope:** any valid key
- **Params:** `engine` (required: `mt5`, `bybit`, `phemex` or `grid`), `paths` (optional: full paths such as `TRADING_PARAMS.LEVERAGE`, or blocks such as `MARTINGALE`)
- **Purpose:** Every setting of one engine, from `GET /settings/catalog`. Read it before planning or changing any bot setting
- **Returns:** `engine`, `version` (a hash of the catalog: unchanged means nothing changed), `generated_from` (the API's commit), `count` (settings in the catalog), and `settings`, each with `path`, `type`, `default`, `source`, `unit`, `range`, `depends_on`, `money`, `key_may_change`, `meaning_en`, `meaning_de` (and `venues` for bybit and phemex). With `paths`, also `returned` and `not_found`
- **Example:** `segnals_get_settings_catalog({ engine: "bybit", paths: ["TRADING_PARAMS", "MARTINGALE.ENABLED"] })`

### Resource `segnals://settings/{engine}`
- **Scope:** any valid key
- **Lists:** `segnals://settings/mt5`, `segnals://settings/bybit`, `segnals://settings/phemex`, `segnals://settings/grid`
- **Reads:** the API's catalog for the engine, as JSON, with the first account the server holds. The catalog is the same for every key; to read it with another account, use `segnals_get_settings_catalog` with `account`

### `segnals_get_fleet`
- **Scope:** `manage:fleet` (a master key, created by the account holder in Settings → Bot manager)
- **Purpose:** The fleet this master key manages, from `GET /fleet`. Read it before planning anything for the account
- **Returns:** `account` (`tier`, `bot_limit`, `bot_count`) and `fleets`: the key's fleet with `id`, `status` (`active`, `stopped_all`, `disabled`), `policy` (the caps every change must fit), `bot_ids`, `counts`, and per allowed connection its `exchange`, `demo`, `currency` and `equity`. No email, username or billing
- **Errors:** `fleet_manager_off` (the server's bot manager is off), `master_key_only` and `insufficient_scope` (not a master key), `fleet_disabled` and `key_not_accepted` each say what to do next. A 404 means the server predates the fleet routes
- **Example:** `segnals_get_fleet()`

### `segnals_fleet_report`
- **Scope:** `read:stats`, on a master key
- **Params:** `period` (optional: `24h`, `7d` default, `30d`)
- **Purpose:** How the fleet is doing, from `GET /fleet/report`
- **Returns:** `period`, `period_start`, `previous_start`, `fleets` (per fleet `account_currency`, `policy`, `kpis`, `previous`, and per bot `exchange`, `symbols`, `demo`, `status`, `kpis`, `previous`, `health`), and `totals` in USD. A KPI is null when it is not measured, never 0
- **Errors:** as `segnals_get_fleet`, except a 404: a key from Settings → API Keys holding `read:stats` gets it while the bot manager is off, so it means switched off or an older server
- **Example:** `segnals_fleet_report({ period: "30d" })`

## Fleet plans (SPEC 453)

A master key changes its fleet only through plans: check a plan, show the person the diff, apply the plan the person approved, by its id. The server judges every item and enforces every rule; the tools decide none. Every other write tool answers a master key 403 `use_fleet_plans`, and its answer names these tools. Each error ends with "What to do next", and each answer has a `next_step` for the plan's status.

### `segnals_plan_fleet`
- **Scope:** `manage:fleet` (a master key)
- **Params:** `items` (required, 1 to 500, in the order they apply), each one of:
  - `{ action: "create", exchange: "mt5" | "bybit" | "phemex", connection_id, name?, from?: "default" | { bot_id }, config?, start? }`
  - `{ action: "update", bot_id, config }`
  - `{ action: "start" | "stop" | "delete", bot_id }`

  `config` is nested by catalog path (`{ TRADING_PARAMS: { LEVERAGE: 3 } }`). A field an action does not take is refused by name, `risk_acknowledged` among them, and so is a credential field (`API_KEY`, `MT5_PASSWORD`, a passphrase, …) at any depth; neither is sent
- **Purpose:** Check a plan with `POST /fleet/plans`. It changes no bot; the server stores the plan for 24 hours. Carries `readOnlyHint`
- **Returns:** `plan_id`, `status` (`checked` or `refused`), `plan_sha`, `expires_at`, `counts` per action and `new_running`, `items` (each with its `diff` before → after, `risk`, `real_money`, `needs_confirmation`, `status`), `accounts` (totals against the caps), `caps`, `needs_confirmation`, `refusals` (each with `item`, `path`, `code`, `message`) and `warnings`
- **Errors:** `rate_limited` (30 checks per fleet an hour), the fleet errors of `segnals_get_fleet`, and a 404 when the server has no plan routes
- **Example:** `segnals_plan_fleet({ items: [{ action: "create", exchange: "bybit", connection_id: "<id>", name: "BTC grid 1", config: { TRADING_PARAMS: { LEVERAGE: 3 } }, start: true }] })`

### `segnals_get_fleet_plan`
- **Scope:** `manage:fleet`
- **Params:** `plan_id` (required)
- **Purpose:** One plan, from `GET /fleet/plans/<id>`: to show it again, and to follow an apply until it says `applied`
- **Returns:** the plan as `segnals_plan_fleet` answers it, with each item's present status. A plan of another fleet or account answers 404
- **Example:** `segnals_get_fleet_plan({ plan_id: "<plan_id>" })`

### `segnals_apply_fleet_plan` ✋
- **Scope:** `manage:fleet`
- **Params:** `plan_id` (required), `confirm` (default false)
- **Purpose:** Without `confirm`, a preview: it reads the stored plan with a GET and sends nothing that writes. With `confirm: true`, one `POST /fleet/plans/<id>/apply` with the header `Idempotency-Key: segnals-mcp-apply-<plan_id>`, so applying the same plan again answers the first result and does nothing more. The client never resends it and waits 50 s for it; after a 5xx or a timeout, read the plan: follow it if it is `applying` or later, and apply again only if it is still `checked` after a minute. Carries `destructiveHint`
- **Returns:** the preview (`preview`, `can_apply`, `instruction`, `plan`), or the applied plan with its status: `applying` (starts are released in batches, 25 a minute by default), `applied`, `applied_with_errors` or `awaiting_confirmation` (the account holder confirms in Settings → Bot manager)
- **Errors:** `plan_stale` (a bot changed since the check; nothing applied), a 409 or 410 for a plan that is not `checked`, `rate_limited` (10 applies an hour), `fleet_stopped_all`, and a 404 when the server has no apply route
- **Example:** `segnals_apply_fleet_plan({ plan_id: "<plan_id>", confirm: true })`

### `segnals_stop_all_fleet`
- **Scope:** `manage:fleet`
- **Purpose:** `POST /fleet/stop-all`: stops every running bot of the fleet through the dashboard's stop, cancels plans not yet applied, and leaves the fleet `stopped_all` until the account holder resumes it. No preview: it only reduces risk. Carries `destructiveHint`
- **Returns:** the bots stopped and those skipped (a protected bot, and for a test key a real-money bot), which still run
- **Errors:** `rate_limited` (3 stop-alls an hour). Sent once, with 50 s to answer: after a 5xx or a timeout, read `segnals_get_fleet` and send it again only if the fleet is not `stopped_all`. On any error, assume the fleet still runs and tell the person: the account holder can stop each bot from the dashboard
- **Example:** `segnals_stop_all_fleet()`
