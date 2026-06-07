# @segnals/mcp

Manage your Segnals trading bots, strategies, PnL, and the strategy marketplace from any AI agent (Claude, Cursor, Claude Code, Windsurf, Copilot, etc.) — securely, by just talking.

[![npm version](https://img.shields.io/npm/v/@segnals/mcp)](https://www.npmjs.com/package/@segnals/mcp)
[![CI Build Status](https://github.com/eidostein/segnals-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/eidostein/segnals-mcp/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-orange)](https://modelcontextprotocol.io)
[![Docker Pulls](https://img.shields.io/docker/pulls/segnals/mcp.svg?logo=docker&logoColor=white)](https://hub.docker.com/r/segnals/mcp)

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
> **User**: *How are my bots performing this month?*
>
> **Agent**: *(Calls `segnals_get_pnl_summary`)*
>
> **Agent**: You have 3 active bots running. For the current calendar month:
> *   **Total Net PnL**: +$245.50 (+3.4% account gain)
> *   **Win Rate**: 68% (17 winning trades, 8 losing trades)
> *   **Drawdown**: 1.2% maximum
> *   **Top Performer**: *Trend Scalper Gold* (+$180.20 PnL)

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
>     *   Modify notification preferences and query market prices/sentiment.
> *   **WHAT IT CANNOT DO (Strict Hard Exclusions)**:
>     *   ❌ **No Fund Movement**: Cannot deposit, withdraw, or transfer funds.
>     *   ❌ **No Secret Retrieval**: Cannot read, export, or enter API secrets for Bybit/MetaTrader 5. All exchange secrets are configured exclusively in the web dashboard.
>     *   ❌ **No Administrative Overrides**: Cannot modify user profile settings, credentials, passwords, or emails.

---

## Features & Capability Overview

The server exposes **36 distinct tools** structured across the following trading features:

*   **Account & Meta**: Retrieve subscription tiers, feature flags, active limitations, and system statuses.
*   **Stats & Drawdowns**: Access current balance, historical performance analytics, and trade-by-trade logs.
*   **Life Cycle Control**: Create, update, start, stop, restart, and delete bots.
*   **Forex & MT5**: Inspect broker connectivity and Metatrader 5 account status.
*   **Indicators & Filters**: Bind custom filters (e.g. Bias Engine, Bollinger, EMA cross) to strategy pipelines.
*   **Copy Trading & Marketplace**: Browse listings, copy paid or free strategies, and manage public offerings.
*   **Market Feed & Knowledge**: Query real-time prices, fetch sentiment rankings, and search onboarding guides.

*For inputs, outputs, and JSON examples for each tool, see the [Tool Reference Guide](docs/TOOLS.md).*

---

## Quickstart (60 Seconds)

### 1. Get an API Key
Log in to your dashboard at [segnals.com](https://segnals.com), navigate to **Settings → API Keys**, generate a key, and select the desired scopes (e.g., `read:account`, `read:bots`). Copy the token (`sk_live_...` or `sk_test_...`).

### 2. Configure Claude Desktop
Open your Claude Desktop configuration file (see location directories below) and add the server:

```json
{
  "mcpServers": {
    "segnals-mcp": {
      "command": "npx",
      "args": ["-y", "@segnals/mcp"],
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

You can run the Segnals MCP server using three methods:

### Method A: npx (Recommended)
This is the simplest way to run the server. It will download and run the latest version automatically:
```bash
export SEGNALS_API_KEY=sk_live_your_key_here
npx -y @segnals/mcp
```

### Method B: From Source (For Developers)
Requires Node.js >= 18.
```bash
git clone https://github.com/eidostein/segnals-mcp.git
cd segnals-mcp
npm ci
npm run build
export SEGNALS_API_KEY=sk_live_your_key_here
node dist/index.js
```

### Method C: Docker
We maintain a public Docker image on GHCR:
```bash
docker run --rm -it -e SEGNALS_API_KEY=sk_live_your_key_here ghcr.io/eidostein/segnals-mcp:latest
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
      "command": "npx",
      "args": ["-y", "@segnals/mcp"],
      "env": {
        "SEGNALS_API_KEY": "${env:SEGNALS_API_KEY}"
      }
    }
  }
}
```
*(Note: Replace `${env:SEGNALS_API_KEY}` with your actual key or define it in your shell profile).*

### 2. Cursor
Navigate to **Settings → Features → MCP**:
1.  Click **+ Add New MCP Server**.
2.  **Name**: `segnals`
3.  **Type**: `command`
4.  **Command**: `npx -y @segnals/mcp`
5.  **Environment Variables**: Key = `SEGNALS_API_KEY`, Value = `sk_live_...`

### 3. Claude Code (CLI)
Install and connect directly from the command line:
```bash
claude mcp add segnals-mcp -- npx -y @segnals/mcp
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
| `write:bots` | Bots | Create, configure, and modify trading bots. |
| `control:bots` | Bots | Start, stop, restart, and delete trading bots. |
| `write:strategies` | Strategies | Save and update trading strategy configurations. |
| `read:marketplace` | Marketplace | Search public listings and view pricing details. |
| `write:marketplace` | Marketplace | Publish strategies and manage personal marketplace offerings. |
| `read:news` | Market Feed | Retrieve news tickers, sentiment ratings, and market indicators. |
| `read:knowledge` | Support | Query internal support knowledge base documents. |
| `manage:notifications` | Notifications | Fetch and save bot alerts and channel preferences. |

For detailed information, see the [Authentication Documentation](docs/AUTHENTICATION.md).

---

## Tool Reference

The following table summarizes the **36 tools** exposed by the Segnals MCP server:

| Tool Name | Operation | Description | Required Scope | Confirmation |
|---|---|---|---|---|
| `segnals_whoami` | Read | Fetch current user details and verification status. | `read:account` | No |
| `segnals_get_capabilities` | Read | List active features and system constraints. | `read:account` | No |
| `segnals_get_subscription` | Read | Fetch active subscription end dates and details. | `read:account` | No |
| `segnals_get_account` | Read | Retrieve active trading account summaries and configurations. | `read:stats` | No |
| `segnals_get_dashboard` | Read | Access overview dashboard counters. | `read:stats` | No |
| `segnals_get_pnl_summary` | Read | Retrieve PnL summaries, drawdown, and win rates. | `read:stats` | No |
| `segnals_get_bot_performance` | Read | Analyze a specific bot's performance metrics. | `read:stats` | No |
| `segnals_get_trades` | Read | Retrieve historical trade executions. | `read:stats` | No |
| `segnals_list_connections` | Read | List saved broker and exchange connection status. | `read:bots` | No |
| `segnals_list_bots` | Read | List all user bots. | `read:bots` | No |
| `segnals_get_bot` | Read | Retrieve config parameters for a specific bot. | `read:bots` | No |
| `segnals_get_bot_logs` | Read | Read output log files for a specific bot. | `read:bots` | No |
| `segnals_get_strategy_schema` | Read | Fetch parameters schema validation rules. | `read:bots` | No |
| `segnals_create_bot` | Write | Spawn a new trading bot. | `write:bots` | ✋ **Yes** |
| `segnals_update_bot` | Write | Modify configurations for an existing bot. | `write:bots` | ✋ **Yes** |
| `segnals_delete_bot` | Control | Remove a bot from the workspace. | `control:bots` | ✋ **Yes** |
| `segnals_start_bot` | Control | Resume a paused bot. | `control:bots` | ✋ **Yes** |
| `segnals_stop_bot` | Control | Pause an active bot. | `control:bots` | ✋ **Yes** |
| `segnals_restart_bot` | Control | Reboot a bot container instance. | `control:bots` | ✋ **Yes** |
| `segnals_create_strategy` | Write | Save a new custom strategy. | `write:strategies` | ✋ **Yes** |
| `segnals_set_indicator_filter` | Write | Add indicator filters (RSI, Bollinger) to a bot. | `write:strategies` | ✋ **Yes** |
| `segnals_explain_config` | Read | Request explanation of a strategy's parameters. | `read:marketplace` | No |
| `segnals_browse_marketplace` | Read | Search marketplace strategy listings. | `read:marketplace` | No |
| `segnals_get_listing` | Read | Retrieve pricing details for a marketplace item. | `read:marketplace` | No |
| `segnals_my_listings` | Read | List strategies published by you. | `read:marketplace` | No |
| `segnals_publish_listing` | Write | Sell a custom strategy in the marketplace. | `write:marketplace` | ✋ **Yes** |
| `segnals_copy_strategy` | Write | Copy/purchase a marketplace strategy. | `write:marketplace` | ✋ **Yes** |
| `segnals_get_copy_trading` | Read | View linked follower accounts. | `read:marketplace` | No |
| `segnals_control_copy_trading` | Write | Toggle copy trading states. | `read:marketplace` | ✋ **Yes** |
| `segnals_get_news` | Read | Retrieve news tickers. | `read:news` | No |
| `segnals_get_sentiment` | Read | Fetch coin and stock sentiment metrics. | `read:news` | No |
| `segnals_get_market_price` | Read | Fetch live assets tickers. | `read:news` | No |
| `segnals_search_knowledge` | Read | Search help documentation. | `read:knowledge` | No |
| `segnals_get_notifications` | Read | Retrieve alert configurations. | `manage:notifications` | No |
| `segnals_set_notifications` | Write | Update alert delivery target. | `manage:notifications` | No |
| `segnals_get_safety_disclaimer` | Read | Fetch the legal platform disclaimer. | None | No |

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
*   **Fix**: Verify your Node.js installation by running `node -v`. Check that the command is configured as `"command": "npx"` and the `args` include `"-y", "@segnals/mcp"`. Check the Claude Desktop log files at `%APPDATA%\Claude\logs\mcp.log` or `~/Library/Logs/Claude/mcp.log`.

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
