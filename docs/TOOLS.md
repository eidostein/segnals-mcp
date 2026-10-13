# Tools Reference

The server has 33 tools. All are prefixed `segnals_` to avoid name collisions in multi-MCP setups.

## Confirmation Pattern

Tools marked with ✋ use **two-step confirmation**:
1. Call without `confirm` (or `confirm: false`) → returns a **preview** of what will happen (no mutation)
2. Call with `confirm: true` → **executes** the action

This prevents accidental mutations and ensures the AI agent presents consequences before acting.

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

