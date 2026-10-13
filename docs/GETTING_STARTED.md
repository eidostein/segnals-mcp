# Getting Started with Segnals MCP

## Prerequisites

- A [Segnals](https://segnals.com) account (free tier works for read-only)
- Docker, to run the published image; or Node.js 18 or later, to build from source
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
| `read:news` | Market newsfeed | Market awareness |
| `read:knowledge` | Nothing yet: no tool uses this scope | — |
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

The server is not published to npm. There are two ways to run it.

### Option A: Docker image (GHCR)

```bash
docker run --rm -i -e SEGNALS_API_KEY ghcr.io/eidostein/segnals-mcp:latest
```

`-i` keeps stdin open for the MCP stdio transport, and `-e SEGNALS_API_KEY` passes the
key you exported in Step 3 into the container. The image is rebuilt on each release tag,
so `latest` is the last release.

### Option B: Build from source

```bash
git clone https://github.com/eidostein/segnals-mcp.git
cd segnals-mcp
npm ci
npm run build
node dist/index.js
```

Then configure your MCP client — see [CONFIGURATION.md](CONFIGURATION.md) for
Claude Desktop, Claude Code, and Cursor setup snippets.

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

## Staging

`SEGNALS_API_BASE` chooses the server; the key's prefix does not. To point the MCP
server at Segnals' staging environment instead of production:

```bash
export SEGNALS_API_KEY=sk_live_your_staging_key
export SEGNALS_API_BASE=https://test.segnals.com/api
```

Staging needs its own API key, created on test.segnals.com, and it is not all demo: some
accounts there trade real money. Treat a staging key like a production key.

---

## Next Steps

- [Authentication](AUTHENTICATION.md) — scopes, rotation, security
- [Tools Reference](TOOLS.md) — all 33 tools with examples
- [Safety](SAFETY.md) — what the MCP can and cannot do
- [Troubleshooting](TROUBLESHOOTING.md) — common errors and fixes
