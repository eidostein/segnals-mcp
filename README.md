# @segnals/mcp

[![npm version](https://img.shields.io/npm/v/@segnals/mcp)](https://www.npmjs.com/package/@segnals/mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![MCP SDK](https://img.shields.io/badge/MCP_SDK-1.12-purple)](https://modelcontextprotocol.io)

**Segnals MCP Server** — manage your algorithmic trading bots, strategies, and portfolio
via AI agents (Claude, Cursor, Copilot, Windsurf, and any MCP-compatible client).

> 🔒 **Security-first design:** No fund movement. No exchange secrets. Scoped API keys.
> Two-step confirmation on all destructive operations.

---

## 60-Second Quickstart

```bash
# 1. Get an API key at segnals.com → Settings → API Keys
# 2. Set it in your environment
export SEGNALS_API_KEY=sk_live_your_key_here

# 3. Run the server
npx @segnals/mcp
```

Then ask your AI agent: *"Use segnals_whoami to verify the connection."*

---

## What It Does

**36 tools** across 10 domains — read your portfolio, manage bots, copy marketplace
strategies, and configure your trading setup:

| Domain | Read | Write/Control | Tools |
|--------|------|---------------|-------|
| Account & Subscription | ✅ | — | 3 |
| Stats & PnL | ✅ | — | 4 |
| Bots | ✅ | ✅ Create, update, start, stop, restart, delete | 11 |
| Strategies | — | ✅ Create strategy, set indicator filters | 2 |
| Marketplace | ✅ | ✅ Copy, publish | 5 |
| News & Knowledge | ✅ | — | 4 |
| Copy Trading | ✅ | ✅ Start/stop | 2 |
| Notifications | ✅ | ✅ Update preferences | 2 |
| Meta | ✅ | — | 3 |

All write/control tools use a **two-step confirmation pattern** — preview first, execute
only after explicit user consent.

→ Full tool reference: [docs/TOOLS.md](docs/TOOLS.md)

---

## Client Configuration

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "segnals": {
      "command": "npx",
      "args": ["-y", "@segnals/mcp"],
      "env": {
        "SEGNALS_API_KEY": "${env:SEGNALS_API_KEY}"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add segnals -- npx -y @segnals/mcp
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "segnals": {
      "command": "npx",
      "args": ["-y", "@segnals/mcp"],
      "env": {
        "SEGNALS_API_KEY": "${env:SEGNALS_API_KEY}"
      }
    }
  }
}
```

### Docker

```bash
docker run --rm -e SEGNALS_API_KEY=sk_live_... ghcr.io/segnals/mcp
```

### From Source

```bash
git clone https://github.com/segnals/segnals-mcp.git
cd segnals-mcp
npm install && npm run build
SEGNALS_API_KEY=sk_live_... node dist/index.js
```

→ Full configuration guide: [docs/CONFIGURATION.md](docs/CONFIGURATION.md)

---

## Security

- **API key via environment only** — never from args, files, or chat
- **Scoped permissions** — grant only what you need (11 granular scopes)
- **Keys shown once** — SHA-256 hashed server-side; revocable and rotatable
- **Two-step confirmation** — write tools preview before executing
- **No exchange credentials** — API keys/secrets never leave the dashboard
- **No SSRF / RCE surface** — no tool accepts URLs or executes commands
- **Credential rejection** — config updates reject API keys/secrets in payloads
- **Risk warnings** — risky combos (Martingale + leverage, no stop-loss) are flagged

→ Security details: [docs/SAFETY.md](docs/SAFETY.md)  
→ Authentication: [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md)

---

## Supported Clients

| Client | Transport | Status |
|--------|-----------|--------|
| Claude Desktop | stdio | ✅ Supported |
| Claude Code (CLI) | stdio | ✅ Supported |
| Cursor | stdio | ✅ Supported |
| Windsurf | stdio | ✅ Supported |
| Copilot (VS Code) | stdio | ✅ Supported |
| Docker | stdio | ✅ Supported |
| Any MCP client | stdio | ✅ Supported |

---

## Compatibility Matrix

| Server Version | Segnals API | MCP SDK | Node.js | Status |
|---------------|-------------|---------|---------|--------|
| 0.1.x | v1 | 1.12.x | ≥18 | ✅ Current |

---

## Documentation

| Document | Description |
|----------|-------------|
| [AGENTS.md](AGENTS.md) | 🤖 Agent playbook — the complete guide for AI agents |
| [Getting Started](docs/GETTING_STARTED.md) | Step-by-step onboarding |
| [Authentication](docs/AUTHENTICATION.md) | API keys, scopes, rotation, security |
| [Tools Reference](docs/TOOLS.md) | All 36 tools with examples |
| [Safety & Limitations](docs/SAFETY.md) | What MCP can/cannot do |
| [Configuration](docs/CONFIGURATION.md) | Per-client setup guides |
| [Troubleshooting](docs/TROUBLESHOOTING.md) | Common errors and fixes |
| [Changelog](docs/CHANGELOG.md) | Version history |

---

## For AI Agents

If you're an AI agent reading this repo, start with **[AGENTS.md](AGENTS.md)** — it
contains your complete playbook for onboarding users and operating their trading account.

---

## License

[MIT](LICENSE)
