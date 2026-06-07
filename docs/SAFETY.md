# Safety & Limitations

## What the MCP Server CAN Do

### Read Operations
- ✅ Read your account details, subscription status, and connection status
- ✅ View your trading dashboard, PnL, performance metrics, and trade history
- ✅ List, inspect, and explain your bot configurations
- ✅ Browse the strategy marketplace and view listings
- ✅ Read news, market data, and sentiment
- ✅ View your notification preferences and copy trading status

### Write Operations (with confirmation)
- ✅ Create, update, and delete trading bots
- ✅ Start, stop, and restart bots
- ✅ Create full strategies (bot + config in one call)
- ✅ Configure indicator filters (ADX, RSI, EMA, ATR)
- ✅ Copy strategies from the marketplace
- ✅ Publish your strategies to the marketplace
- ✅ Control copy trading (start/stop per exchange)
- ✅ Update notification preferences

---

## What the MCP Server CANNOT Do

- ❌ **Move or withdraw funds** — the agent has no access to fund transfers
- ❌ **Access exchange API keys/secrets or MT5 passwords** — credentials are entered
  only in the Segnals dashboard and are never exposed via the API
- ❌ **Perform admin actions** — admin endpoints are blocked for API keys
- ❌ **Change your password or email** — these endpoints are blocked
- ❌ **Execute shell commands or access URLs** — zero SSRF or RCE surface
- ❌ **Process affiliate payouts** — blocked by design
- ❌ **Bypass tier limits** — if your plan limits you to N bots, the API enforces it
- ❌ **Access other users' data** — strict tenant isolation

---

## Confirmation Gates ✋

All destructive or high-impact operations use a **two-step confirmation pattern**:

1. **Preview** (default): Call the tool without `confirm` → get a human-readable
   preview of what will happen. **No mutation occurs.**
2. **Execute**: Call the tool with `confirm: true` → the action is performed.

### Tools Requiring Confirmation

| Tool | Risk | Why |
|------|------|-----|
| `segnals_create_bot` ✋ | Medium | Creates infrastructure on exchange |
| `segnals_update_bot` ✋ | Medium | Changes trading parameters |
| `segnals_start_bot` ✋ | High | Begins live trading with real money |
| `segnals_restart_bot` ✋ | Medium | Resets loss streaks, cold-start cycle |
| `segnals_delete_bot` ✋ | High | Permanent, irreversible deletion |
| `segnals_create_strategy` ✋ | Medium | Creates bot + applies full config |
| `segnals_copy_strategy` ✋ | Medium | Creates bot from marketplace listing |
| `segnals_publish_listing` ✋ | Low | Submits for admin review |
| `segnals_control_copy_trading` ✋ | High | Starts/stops trade mirroring |

### Tools WITHOUT Confirmation (safe by nature)

| Tool | Why safe |
|------|---------|
| `segnals_stop_bot` | Stopping is always safe — no open positions affected |
| `segnals_set_indicator_filter` | Non-destructive config tweak |
| `segnals_set_notifications` | Preferences only |

---

## Risk Detection

The MCP server automatically flags risky configurations in previews:

| Risk | Warning |
|------|---------|
| Martingale + leverage > 10x | ⚠️ HIGH RISK: amplified losses |
| Martingale enabled | ⚠️ Position sizes increase after losses |
| Leverage > 20x | ⚠️ Very high leverage |
| No stop-loss | ⚠️ No downside protection |

Agents are required to present these warnings to the user before proceeding.

---

## Credential Safety

The MCP server **actively rejects** exchange credentials in config updates:

```
// This will be REJECTED:
segnals_update_bot({ bot_id: 1, config: { API_KEY: "secret123" } })
→ "REJECTED: Config contains exchange credentials."
```

Blocked fields: `API_KEY`, `API_SECRET`, `api_key`, `api_secret`, `MT5_PASSWORD`

Users must enter exchange credentials at **segnals.com → Settings → Connections**.

---

## Risk Disclaimer

> Segnals is a **software tool** for managing algorithmic trading configurations.
> It is **NOT financial advice**, an investment advisor, or a portfolio manager.
>
> - Trading cryptocurrencies and forex carries **significant risk of loss**
> - Past performance (including backtest results) **does not guarantee future results**
> - You are **solely responsible** for your trading decisions and capital
> - Segnals does not have custody of your funds — your exchange holds your capital
> - The MCP server is an **automation interface**, not a trading recommendation engine

---

## Data Privacy

- **Data in transit:** All API communication uses HTTPS/TLS
- **Data at rest:** API key hashes stored server-side; no plaintext keys
- **Data exposure:** The agent sees only data permitted by the key's scopes
- **No logging of secrets:** API keys are never included in logs or error output
- **Tenant isolation:** Each key is bound to one user; cross-tenant access is impossible

---

## Responsible Use

- Use the MCP server to **manage and monitor** your trading, not to blindly automate it
- **Review bot configurations** before starting — understand what each parameter does
- **Start with small position sizes** and low leverage until you're confident
- **Monitor your bots regularly** — automated trading still requires oversight
- **Use read-only keys** when you only need to check status
