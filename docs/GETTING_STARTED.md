# Getting Started with Segnals MCP

## Prerequisites

- A [Segnals](https://segnals.com) account (free tier works for read-only)
- Node.js 18 or later
- An MCP-compatible client (Claude Desktop, Claude Code, Cursor, Windsurf, etc.)

---

## Step 1: Create Your Account

Sign up at [segnals.com](https://segnals.com) if you haven't already. You can explore
with a free account — read-only MCP tools work on all tiers.

---

## Step 2: Generate an API Key

1. Sign in and navigate to **Settings → API Keys**
2. Click **Create New Key**
3. Give it a descriptive name (e.g., "Claude MCP", "Cursor Agent")
4. Select the scopes you need (see table below)
5. Click **Generate** — **copy the key immediately** (it's shown only once!)

### Scope Reference

| Scope | What It Unlocks | Recommended For |
|-------|-----------------|-----------------|
| `read:account` | Account details, subscription, connections | Everyone |
| `read:stats` | Dashboard, PnL, performance, trades | Everyone |
| `read:bots` | Bot list, config, logs, strategy schema | Everyone |
| `write:bots` | Create, update, delete bots | Bot management |
| `control:bots` | Start, stop, restart bots; copy trading | Active trading |
| `write:strategies` | Create strategies with full config | Strategy building |
| `read:marketplace` | Browse marketplace listings | Exploring |
| `write:marketplace` | Copy and publish strategies | Marketplace users |
| `read:news` | News, sentiment, market prices | Market awareness |
| `read:knowledge` | Knowledge base search | Self-service |
| `manage:notifications` | Notification preferences | All users |

**Starting out?** Select `read:account`, `read:stats`, and `read:bots` for a safe,
read-only experience. You can always create a new key with more scopes later.

---

## Step 3: Set Your API Key

Set the key as an environment variable — **never commit it to git or paste it in chat:**

```bash
export SEGNALS_API_KEY=sk_live_your_key_here
```

Or add it to your shell profile for persistence:

```bash
echo 'export SEGNALS_API_KEY=sk_live_your_key_here' >> ~/.zshrc
source ~/.zshrc
```

> ⚠️ **Security:** Treat your API key like a password. If it leaks, revoke it
> immediately at Settings → API Keys and generate a new one.

---

## Step 4: Install and Configure

### Option A: npx (recommended — zero install)

```bash
npx @segnals/mcp
```

### Option B: Docker

```bash
docker run --rm -e SEGNALS_API_KEY=sk_live_... ghcr.io/segnals/mcp
```

### Option C: Clone and build

```bash
git clone https://github.com/segnals/segnals-mcp.git
cd segnals-mcp
npm install && npm run build
SEGNALS_API_KEY=sk_live_... node dist/index.js
```

Then configure your MCP client — see [CONFIGURATION.md](CONFIGURATION.md) for
Claude Desktop, Claude Code, Cursor, and Docker setup snippets.

---

## Step 5: Verify the Connection

Ask your AI agent:

> "Use the segnals_whoami tool to verify the connection."

If it returns your username, tier, and subscription status — **you're connected!** 🎉

---

## Step 6: Your First Session

Try these prompts to explore:

| Prompt | What happens |
|--------|-------------|
| "What can you do with Segnals?" | Agent calls `segnals_get_capabilities` |
| "Show me my dashboard" | Agent calls `segnals_get_dashboard` |
| "List my bots" | Agent calls `segnals_list_bots` |
| "How is bot 1 performing?" | Agent calls `segnals_get_bot_performance` |
| "Show my recent trades" | Agent calls `segnals_get_trades` |

---

## Test Mode

API keys starting with `sk_test_` connect to the test environment. Use these for
development and experimentation without affecting your live account.

When using test mode, set the base URL:

```bash
export SEGNALS_API_KEY=sk_test_your_test_key
export SEGNALS_API_BASE=https://staging.segnals.com/api
```

---

## Next Steps

- [Authentication](AUTHENTICATION.md) — scopes, rotation, security
- [Tools Reference](TOOLS.md) — all 36 tools with examples
- [Safety](SAFETY.md) — what the MCP can and cannot do
- [Troubleshooting](TROUBLESHOOTING.md) — common errors and fixes
