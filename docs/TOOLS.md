# Tools Reference

All tools are prefixed `segnals_` to avoid name collisions in multi-MCP setups.

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
- **Purpose:** Get the trading dashboard overview
- **Returns:** total PnL, win rate, active bots, equity curve
- **Example:** `segnals_get_dashboard()`

### `segnals_get_pnl_summary`
- **Scope:** `read:stats`
- **Purpose:** Get aggregated PnL breakdown
- **Example:** `segnals_get_pnl_summary()`

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
- **Purpose:** Analyze and explain a bot's config; flags risky settings
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
- **Purpose:** Update bot config. Preview flags risky combos (Martingale + high leverage)
- **Safety:** Rejects exchange API keys/MT5 passwords in config
- **Example:** `segnals_update_bot({ bot_id: 42, config: { LEVERAGE: 5 }, confirm: true })`

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
- **Purpose:** Create a fully configured strategy (bot + config in one call)
- **Safety:** Validates config, flags risky combos, rejects credentials
- **Disclaimer:** Risk disclaimer included in response
- **Example:** `segnals_create_strategy({ exchange: "bybit", name: "Scalper", config: { LEVERAGE: 3 }, confirm: true })`

### `segnals_set_indicator_filter`
- **Scope:** `write:bots`
- **Params:** `bot_id` (required), `filter_type` (required: "adx" | "rsi" | "ema" | "atr"), `enabled` (required), `params` (optional)
- **Purpose:** Configure an indicator filter on a bot (non-destructive, no confirmation)
- **Example:** `segnals_set_indicator_filter({ bot_id: 42, filter_type: "adx", enabled: true, params: { period: 14 } })`

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

## News / Knowledge

### `segnals_get_news`
- **Scope:** `read:news`
- **Purpose:** Get market news and events
- **Example:** `segnals_get_news()`

### `segnals_get_sentiment` *(coming soon)*
- **Scope:** `read:news`
- **Params:** `symbol` (required, string)
- **Purpose:** Get market sentiment for a symbol

### `segnals_get_market_price` *(coming soon)*
- **Scope:** `read:news`
- **Params:** `symbol` (required, string)
- **Purpose:** Get live market price

### `segnals_search_knowledge` *(coming soon)*
- **Scope:** `read:knowledge`
- **Params:** `query` (required, string)
- **Purpose:** Search the platform knowledge base

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

