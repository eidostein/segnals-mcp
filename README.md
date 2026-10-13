# Segnals MCP Server

Manage your Segnals trading bots, strategies, PnL, and the strategy marketplace from any AI agent (Claude, Cursor, Claude Code, Windsurf, Copilot, etc.) — securely, by just talking.

[![CI Build Status](https://github.com/eidostein/segnals-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/eidostein/segnals-mcp/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-orange)](https://modelcontextprotocol.io)

*Built by [Segnals](https://segnals.com) · Secure Algorithmic Trading Ecosystem*

---

## Table of Contents
- [See It in Action](#see-it-in-action)
- [What Is This? / What Is Segnals?](#what-is-this--what-is-segnals)
- [Features & Capability Overview](#features--capability-overview)
- [Quickstart (60 Seconds)](#quickstart-60-seconds)
- [Getting Your API Key (Onboarding)](#getting-your-api-key-onboarding)
- [Installation](#installation)
- [Client Configuration](#client-configuration)
- [Authentication & Scopes](#authentication--scopes)
- [Tool Reference](#tool-reference)
- [Security Model](#security-model)
- [Safety & Disclaimer](#safety--disclaimer)
- [Example Use-Cases & Prompt Library](#example-use-cases--prompt-library)
- [Architecture](#architecture)
- [Compatibility Matrix](#compatibility-matrix)
- [Troubleshooting](#troubleshooting)
- [For AI Agents](#for-ai-agents)
- [Roadmap](#roadmap)
- [Contributing & Support](#contributing--support)
- [License](#license)

---

## See It in Action

Here is how a conversation with an MCP-enabled agent flows:

### Use Case 1: Checking Portfolio Performance
> **User**: *How did my bots perform in October?*
>
> **Agent**: *(Calls `segnals_get_pnl_summary({ start_date: "2026-10-01", end_date: "2026-11-01" })`)*
>
> **Agent**: You have 3 active bots out of 5. From 1 October to 1 November:
> *   **Total PnL**: +$245.50
> *   **Win Rate**: 68%
> *   **Trades**: 25

### Use Case 2: Strategy Creation with Two-Step Confirmation Gate
> **User**: *Set up a new Conservative EURUSD Forex bot with 2:1 Reward ratio.*
>
> **Agent**: *(Calls `segnals_create_strategy` with `confirm: false`)*
>
> **Agent**: ✋ **Preview Strategy Configuration**:
> *   **Name**: Conservative EURUSD Trend
> *   **Symbol**: EURUSD
> *   **Asset Class**: Forex (MetaTrader 5)
> *   **Leverage**: 1:30
> *   **Risk Parameters**: Stop Loss = 20 pips, Take Profit = 40 pips (2:1 Ratio)
> *   **Estimated Drawdown Warning**: 1.5%
>
> To proceed and save this bot to your dashboard, please reply with **"confirm"**.
>
> **User**: *Confirm*
>
> **Agent**: *(Calls `segnals_create_strategy` with `confirm: true`)*
>
> **Agent**: ✅ Strategy has been created successfully. You can find it on your dashboard or manage it here by asking me to list your bots.

---

## What Is This? / What Is Segnals?

**Segnals** is an institutional-grade, multi-tenant algorithmic trading and AI ecosystem. It enables retail traders and quants to write, backtest, and deploy high-frequency trading (HFT) bots across cryptocurrency exchanges (via CCXT) and Forex brokers (via a custom MetaTrader 5 Redis bridge).

The **Segnals MCP Server** is a thin, secure gateway designed for the Model Context Protocol (MCP). It exposes a set of strictly typed developer APIs as tools to large language models (LLMs). This allows AI agents to read trading statistics, create strategies, modify parameters, and manage marketplace listings on behalf of the user, using secure, cryptographically hashed user keys.

> ### 🔒 Security Boundaries (Can / Can't Do)
>
> *   **WHAT IT CAN DO**:
>     *   Fetch account balance, statistics, and historical PnL logs.
>     *   List, query, and monitor active trading bot statuses.
>     *   Create, modify, start, stop, restart, or delete trading bots.
>     *   Browse the Strategy Marketplace and copy/purchase strategies.
>     *   Modify notification preferences and read the market newsfeed.
> *   **WHAT IT CANNOT DO (Strict Hard Exclusions)**:
>     *   ❌ **No Fund Movement**: Cannot deposit, withdraw, or transfer funds.
>     *   ❌ **No Secret Retrieval**: Cannot read, export, or enter API secrets for Bybit/MetaTrader 5. All exchange secrets are configured exclusively in the web dashboard.
>     *   ❌ **No Administrative Overrides**: Cannot modify user profile settings, credentials, passwords, or emails.

---

## Features & Capability Overview

The server exposes **33 distinct tools** structured across the following trading features:

*   **Account & Meta**: Verify the key and read the account tier, subscription, and which exchanges are connected.
*   **Stats**: Read the dashboard and profit/loss for a period (24h, 7d, 30d, all, or a date range), per-bot performance, and trades.
*   **Life Cycle Control**: Create, update, start, stop, restart, and delete bots.
*   **Indicator Filter**: Switch the ADX, RSI, EMA, and ATR gates of a bot's indicator filter on or off and set their parameters.
*   **Copy Trading & Marketplace**: Browse listings, copy paid or free strategies, and manage public offerings.
*   **Market Feed**: Read the market newsfeed.

*For inputs, outputs, and JSON examples for each tool, see the [Tool Reference Guide](docs/TOOLS.md).*

---

## Quickstart (60 Seconds)

### 1. Get an API Key
Log in to your dashboard at [segnals.com](https://segnals.com), navigate to **Settings → API Keys**, generate a key, and select the desired scopes (e.g., `read:account`, `read:bots`). Copy the token (`sk_live_...` or `sk_test_...`).

### 2. Configure Claude Desktop
Open your Claude Desktop configuration file (see location directories below) and add the server. This runs the published Docker image, so Docker must be installed (to run from source instead, see [Installation](#installation)):

```json
{
  "mcpServers": {
    "segnals-mcp": {
      "command": "docker",
      "args": ["run", "--rm", "-i", "-e", "SEGNALS_API_KEY", "ghcr.io/eidostein/segnals-mcp:latest"],
      "env": {
        "SEGNALS_API_KEY": "sk_live_your_actual_key_here"
      }
    }
  }
}
```

### 3. Verify Connection
Restart Claude Desktop and ask the agent:
> *"Use segnals_whoami to verify who I am connected as on Segnals."*

---

## Getting Your API Key (Onboarding)

To integrate your agent with your account, you must mint a Developer API Key:

1.  Navigate to **Settings → API Keys** on your dashboard.
2.  Click **Generate Key** and assign a descriptive label.
3.  **Select Scopes**: It is recommended to choose only read-only scopes (`read:account`, `read:stats`, `read:bots`) for your first setup. Add write permissions as needed.
4.  Specify an optional IP allowlist or expiration date if desired.
5.  Click **Generate**.
6.  **Copy Token**: Copy the displayed token (`sk_live_...`) immediately. It will only be shown once.

> [!WARNING]
> **API Key Safety**: NEVER paste your raw API key in a chat prompt. Agents might accidentally save it or leak it in subsequent sessions. Always inject keys securely through environment variables (`SEGNALS_API_KEY`) as shown in the configurations.

For more details, see the [Onboarding Guide](docs/GETTING_STARTED.md).

---

## Installation

There are two ways to run the Segnals MCP server. The package is not published to npm, so there is no `npm install` for it.

### Method A: Docker image (GHCR)
The public image is `ghcr.io/eidostein/segnals-mcp`. `-i` keeps stdin open, which the MCP stdio transport needs; `-e SEGNALS_API_KEY` passes the key from your environment into the container:
```bash
export SEGNALS_API_KEY=sk_live_your_key_here
docker run --rm -i -e SEGNALS_API_KEY ghcr.io/eidostein/segnals-mcp:latest
```
The image is rebuilt on each release tag, so `latest` is the last release. To run what is on `main` today, build from source.

### Method B: Build from source
Requires Node.js >= 18.
```bash
git clone https://github.com/eidostein/segnals-mcp.git
cd segnals-mcp
npm ci
npm run build
export SEGNALS_API_KEY=sk_live_your_key_here
node dist/index.js
```

---

## Client Configuration

The server runs on standard input/output (`stdio`) streams. Depending on your editor or chat interface, add the following configuration:

### 1. Claude Desktop
File locations:
*   **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
*   **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Add this entry to your `mcpServers` object:
```json
{
  "mcpServers": {
    "segnals-mcp": {
      "command": "docker",
      "args": ["run", "--rm", "-i", "-e", "SEGNALS_API_KEY", "ghcr.io/eidostein/segnals-mcp:latest"],
      "env": {
        "SEGNALS_API_KEY": "${env:SEGNALS_API_KEY}"
      }
    }
  }
}
```
*(Note: Replace `${env:SEGNALS_API_KEY}` with your actual key or define it in your shell profile).*

If you built from source, use `"command": "node"` and `"args": ["/absolute/path/to/segnals-mcp/dist/index.js"]` instead.

### 2. Cursor
Navigate to **Settings → Features → MCP**:
1.  Click **+ Add New MCP Server**.
2.  **Name**: `segnals`
3.  **Type**: `command`
4.  **Command**: `docker run --rm -i -e SEGNALS_API_KEY ghcr.io/eidostein/segnals-mcp:latest` (or `node /absolute/path/to/segnals-mcp/dist/index.js` for a build from source)
5.  **Environment Variables**: Key = `SEGNALS_API_KEY`, Value = `sk_live_...`

### 3. Claude Code (CLI)
Connect directly from the command line, with `SEGNALS_API_KEY` exported in the same shell:
```bash
claude mcp add segnals-mcp -- docker run --rm -i -e SEGNALS_API_KEY ghcr.io/eidostein/segnals-mcp:latest
```
For a build from source:
```bash
claude mcp add segnals-mcp -- node /absolute/path/to/segnals-mcp/dist/index.js
```

For more details, see the [Configuration Guide](docs/CONFIGURATION.md).

---

## Authentication & Scopes

The server utilizes scoped access tokens to restrict API permissions. The following scopes can be bound to your API key:

| Scope | Category | Description / Enforced Permissions |
|---|---|---|
| `read:account` | Account | Access account profiles, billing details, and subscription tiers. |
| `read:stats` | Performance | View PnL statistics, drawdown ratios, and trade logs. |
| `read:bots` | Bots | View current active/inactive trading bots and their configs. |
| `write:bots` | Bots | Create, update, and delete trading bots; set indicator filters. |
| `control:bots` | Bots | Start, stop, and restart trading bots; start or stop copy trading. |
| `write:strategies` | Strategies | Create a bot with a full strategy configuration in one call. |
| `read:marketplace` | Marketplace | Search public listings and view pricing details. |
| `write:marketplace` | Marketplace | Publish strategies and manage personal marketplace offerings. |
| `read:news` | Market Feed | Retrieve the market newsfeed. |
| `read:knowledge` | Support | Reserved. No tool uses it yet. |
| `manage:notifications` | Notifications | Fetch and save bot alerts and channel preferences. |

The `read:knowledge` scope has no tool yet: it can be ticked on a key, but nothing in this server needs it. Sentiment, live prices and help search are not offered until the API has routes for them.

For detailed information, see the [Authentication Documentation](docs/AUTHENTICATION.md).

---

## Tool Reference

The following table summarizes the **33 tools** exposed by the Segnals MCP server:

| Tool Name | Operation | Description | Required Scope | Confirmation |
|---|---|---|---|---|
| `segnals_whoami` | Read | Verify the API key and show the username and tier. | any valid key | No |
| `segnals_get_capabilities` | Read | List all tools and the scope each one needs. | any valid key | No |
| `segnals_get_safety_disclaimer` | Read | Return the risk and safety disclaimer. | any valid key | No |
| `segnals_get_account` | Read | Account tier, subscription, and bot limits. | `read:account` | No |
| `segnals_get_subscription` | Read | Subscription plan and billing status. | `read:account` | No |
| `segnals_list_connections` | Read | Which exchanges are connected (yes/no only). | `read:account` | No |
| `segnals_get_dashboard` | Read | Dashboard overview for a period (timeframe or date range). | `read:stats` | No |
| `segnals_get_pnl_summary` | Read | Total PnL, win rate, and trade count for a period. | `read:stats` | No |
| `segnals_get_bot_performance` | Read | One bot's performance metrics. | `read:stats` | No |
| `segnals_get_trades` | Read | Trade history. | `read:stats` | No |
| `segnals_list_bots` | Read | List all bots with their status. | `read:bots` | No |
| `segnals_get_bot` | Read | One bot's full config and status. | `read:bots` | No |
| `segnals_get_bot_logs` | Read | One bot's execution logs. | `read:bots` | No |
| `segnals_get_strategy_schema` | Read | One bot's current config: the settings that can be changed. | `read:bots` | No |
| `segnals_explain_config` | Read | A bot's config with risk warnings (martingale, leverage above 10x, stop-loss). | `read:bots` | No |
| `segnals_create_bot` | Write | Create a new bot (starts stopped). | `write:bots` | ✋ **Yes** |
| `segnals_update_bot` | Write | Change a bot's config or name. | `write:bots` | ✋ **Yes** |
| `segnals_delete_bot` | Write | Permanently delete a bot. | `write:bots` | ✋ **Yes** |
| `segnals_start_bot` | Control | Start a bot. | `control:bots` | ✋ **Yes** |
| `segnals_stop_bot` | Control | Stop a bot. | `control:bots` | No |
| `segnals_restart_bot` | Control | Restart a bot. | `control:bots` | ✋ **Yes** |
| `segnals_create_strategy` | Write | Create a bot and apply a full config in one call. | `write:strategies` | ✋ **Yes** |
| `segnals_set_indicator_filter` | Write | Switch an indicator gate (ADX, RSI, EMA, ATR) on or off and set its parameters. | `write:bots` | No |
| `segnals_browse_marketplace` | Read | Browse marketplace strategy listings. | `read:marketplace` | No |
| `segnals_get_listing` | Read | One listing's details and performance. | `read:marketplace` | No |
| `segnals_my_listings` | Read | Your own marketplace listings. | `read:marketplace` | No |
| `segnals_copy_strategy` | Write | Copy a marketplace strategy (free or paid). | `write:marketplace` | ✋ **Yes** |
| `segnals_publish_listing` | Write | Publish a bot as a marketplace listing (VIP). | `write:marketplace` | ✋ **Yes** |
| `segnals_get_news` | Read | Market newsfeed. | `read:news` | No |
| `segnals_get_copy_trading` | Read | Copy trading config and status. | `read:account` | No |
| `segnals_control_copy_trading` | Control | Start or stop copy trading (VIP). | `control:bots` | ✋ **Yes** |
| `segnals_get_notifications` | Read | Notification preferences. | `manage:notifications` | No |
| `segnals_set_notifications` | Write | Update notification preferences. | `manage:notifications` | No |

*For complete usage specifications, see [docs/TOOLS.md](docs/TOOLS.md).*

---

## Security Model

The Segnals MCP integration enforces safety guidelines:

1.  **Hashed Key Storage**: API keys are hashed with SHA-256 at rest. Plaintext keys are never stored in the database.
2.  **Explicit Scope Restrictions**: Keys are restricted to their defined scopes. If a key is leaked, it can be revoked or rotated instantly without affecting main account passwords.
3.  **Two-Step Confirmation Gating**: Destructive or financially significant tools (e.g., `create_bot`, `start_bot`, `copy_strategy`) require a `confirm: true` parameter. Calling them without `confirm: true` returns a safe JSON preview.
4.  **Exchange Credentials Isolation**: Exchange API secrets and MT5 passwords never leave the primary Segnals servers. AI agents can configure *where* a bot executes, but can never see or export credentials.
5.  **Per-Key Rate Limiting**: The backend limits keys to a default of 120 requests/minute to prevent loop bugs from overloading the API.
6.  **Immutable Exclusions**: Admin functions, billing details, and withdrawal routes are hard-excluded from the API Key pathway.

For further information, see the [Safety & Limitations Guide](docs/SAFETY.md).

---

## Safety & Disclaimer

> [!CAUTION]
> **Financial & Trading Risk**:
> Segnals is a software-as-a-service platform that provides algorithmic trading tools. All trades executed using this platform are at your own risk. Past performance does not guarantee future results. This software is not financial advice, and the authors of the Segnals MCP server do not take responsibility for financial losses incurred due to trading bot executions, configuration mistakes, or AI agent interactions. Configure stop losses carefully and evaluate your strategies in a test environment first.

---

## Example Use-Cases & Prompt Library

You can copy and paste the following prompts to guide your agent:

### Strategy Design & Deployment
> *"Check my active connection status. If connected, list all strategy schemas and help me design a low-risk Grid bot for BTCUSDT on Bybit."*
> Requires: `read:bots`, `write:bots`

### Performance Review
> *"Retrieve a summary of my bot performances. Identify which bot has the highest drawdown this week, pull its execution logs, and suggest parameter updates."*
> Requires: `read:stats`, `read:bots`

### Marketplace Discovery
> *"Browse the Strategy Marketplace for low-risk, high-rating Forex strategies. Explain the parameters of the top-performing item and copy it to my workspace."*
> Requires: `read:marketplace`, `write:marketplace`

---

## Architecture

The Segnals MCP Server acts as an intermediate translator between your local agent and the remote Segnals platform:

```
┌─────────────────────────────────┐
│        AI Agent / IDE           │ (Claude Desktop, Cursor, etc.)
└────────────────┬────────────────┘
                 │
                 │ stdio (std_in / std_out)
                 ▼
┌─────────────────────────────────┐
│    Segnals MCP Server (Local)   │
└────────────────┬────────────────┘
                 │
                 │ HTTPS (REST API) + Bearer API Key
                 ▼
┌─────────────────────────────────┐
│     Segnals REST API (Remote)   │ (Enforces Rate-Limits, Scopes, and Auditing)
└─────────────────────────────────┘
```

---

## Compatibility Matrix

| Server Version | Segnals API | MCP SDK | Node.js | Supported Clients | Status |
|---|---|---|---|---|---|
| `v0.1.x` | `v1` | `^1.12.1` | `>=18` | Claude Desktop, Claude Code, Cursor, Windsurf, Copilot | Current |

---

## Troubleshooting

### 1. The Server Does Not Appear in Claude Desktop
*   **Cause**: Invalid path configuration or Node.js missing from system path.
*   **Fix**: Check that the configured command starts the server from a terminal: `docker run --rm -i -e SEGNALS_API_KEY ghcr.io/eidostein/segnals-mcp:latest` needs Docker running, and a build from source needs Node.js (`node -v`) and an absolute path to `dist/index.js`. Check the Claude Desktop log files at `%APPDATA%\Claude\logs\mcp.log` or `~/Library/Logs/Claude/mcp.log`.

### 2. Error Code: 401 Unauthorized
*   **Cause**: Malformed, expired, or incorrect API key format.
*   **Fix**: Ensure your environment key is correctly configured as `export SEGNALS_API_KEY=sk_live_...` and that the prefix is correct. Make sure the key has not been revoked on the dashboard.

### 3. Error Code: 403 Forbidden
*   **Cause**: The API key lacks the required scopes for the executed tool.
*   **Fix**: Verify the scope required by the tool (see [Tool Reference](#tool-reference)) and generate a new key on the dashboard with the appropriate scope.

### 4. Error Code: 429 Too Many Requests
*   **Cause**: Request rate limit exceeded.
*   **Fix**: Reduce the frequency of commands. AI loops can occasionally flood the API. Check that your client logic is not stuck in an execution loop.

For more details, see the [Troubleshooting Guide](docs/TROUBLESHOOTING.md).

---

## For AI Agents

🤖 **If you are an AI Agent**:
Read [AGENTS.md](AGENTS.md) and [llms.txt](llms.txt) first. These files contain specific context on tool naming rules, safety disclaimers, the mandatory confirmation workflow, and advice on choosing the correct API endpoint.

---

## Roadmap

*   [ ] **Phase 4b: Remote OAuth Integration**: Connect your account via OAuth 2.1 protocol for zero-install clients. *(Planned)*
*   [ ] **Advanced Backtesting**: Run backtest jobs directly from the command line. *(Planned)*
*   [ ] **Dynamic Telemetry WebSocket Stream**: Fetch sub-millisecond price changes. *(Planned)*

---

## Contributing & Support

We welcome contributions to the Segnals MCP server:
*   Report bugs and request features in [GitHub Issues](https://github.com/eidostein/segnals-mcp/issues).
*   Read [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
*   For security reports, please refer to [SECURITY.md](SECURITY.md) to report vulnerabilities privately.
*   Contact support at `support@segnals.com`.

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
