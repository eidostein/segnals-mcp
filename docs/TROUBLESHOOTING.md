# Troubleshooting

## Common Errors

### "No SEGNALS_API_KEY found"

The server can't find your API key in the environment.

**Fix:**
```bash
export SEGNALS_API_KEY=sk_live_your_key_here
```

Make sure the key is set in the same shell session where you launch the MCP client, or
passed via the client config's `env` block.

---

### 401 — "Your Segnals API key is invalid or expired"

The API key was rejected by the server.

**Causes:**
- Key was revoked or rotated
- Key has expired (if an expiry was set)
- Key was copied incorrectly (missing characters)
- Using a `sk_test_` key against production (or vice versa)

**Fix:**
1. Go to [segnals.com](https://segnals.com) → Settings → API Keys
2. Check if your key is still active
3. If not, generate a new one
4. Update your `SEGNALS_API_KEY` environment variable
5. Restart your MCP client

---

### 403 — "This key lacks the required scope"

Your API key doesn't have the permission needed for this action.

**Fix:**
1. Note which scope the error message mentions (e.g., `write:bots`)
2. Go to Settings → API Keys
3. Create a new key that includes the missing scope, or rotate your existing key with
   additional scopes

**Common scope mismatches:**
| Action | Required Scope |
|--------|---------------|
| Start/stop bots | `control:bots` |
| Create/delete bots | `write:bots` |
| Copy marketplace strategies | `write:marketplace` |
| Update notifications | `manage:notifications` |

---

### 429 — "Rate limit reached"

You've exceeded the rate limit (default: 120 requests/minute per key).

**Fix:**
- Wait for the duration specified in the `Retry-After` header
- If you consistently hit the limit, reduce request frequency
- Avoid polling in tight loops — use event-driven patterns

---

### "Could not reach the Segnals API"

Network connectivity issue.

**Fix:**
- Check your internet connection
- If using a custom `SEGNALS_API_BASE`, verify the URL is correct
- Check if segnals.com is accessible from your network
- If behind a corporate proxy, ensure HTTPS traffic is allowed

---

### "SEGNALS_API_KEY has an invalid format"

The key doesn't match the expected format.

**Fix:**
- Keys must start with `sk_live_` (production) or `sk_test_` (testing)
- Ensure you copied the full key (minimum 20 characters)
- Generate a new key if needed

---

## Server Not Showing Up in Client

If the MCP server doesn't appear in your AI client's tool list:

### Claude Desktop
1. Ensure `claude_desktop_config.json` has valid JSON (no trailing commas)
2. Restart Claude Desktop completely (quit + relaunch)
3. Check that `npx` is available in your PATH
4. Try running `npx @segnals/mcp` in a terminal to verify it works standalone

### Claude Code
1. Verify with `claude mcp list` — the server should appear
2. If not, re-add: `claude mcp add segnals -- npx -y @segnals/mcp`
3. Ensure `SEGNALS_API_KEY` is exported in the same shell

### Cursor
1. Check `.cursor/mcp.json` exists in your project root
2. Reload the window (Cmd/Ctrl+Shift+P → "Reload Window")
3. Check the MCP panel in settings

---

## Cold-Start Statuses

When you start a bot, it goes through a cold-start cycle:

| Status | Meaning | Duration |
|--------|---------|----------|
| `starting` | Container is being provisioned | 5-15 seconds |
| `warming_up` | Loading config, connecting to exchange | 10-30 seconds |
| `running` | Bot is actively trading | Ongoing |

If a bot stays in `starting` or `warming_up` for more than 2 minutes:
1. Check the bot logs: `segnals_get_bot_logs({ bot_id: X })`
2. Try stopping and restarting: `segnals_stop_bot` → `segnals_start_bot`
3. Verify your exchange connection at Settings → Connections

---

## Test Mode / Staging

If you're developing or testing, use test keys:

```bash
export SEGNALS_API_KEY=sk_test_your_test_key
export SEGNALS_API_BASE=https://staging.segnals.com/api
```

Common test mode issues:
- **Test data doesn't match production** — test environment has separate data
- **Some features may be limited** — test environment may not have marketplace listings
- **Performance may differ** — staging has fewer resources than production

---

## Key Rotation Without Downtime

1. Generate a new key with the same scopes (don't revoke the old one yet)
2. Update `SEGNALS_API_KEY` with the new key
3. Restart your MCP client
4. Verify with `segnals_whoami`
5. Once confirmed working, revoke the old key

---

## Getting Help

- **Documentation:** [segnals.com/docs](https://segnals.com/docs)
- **Support:** [support@segnals.com](mailto:support@segnals.com)
- **GitHub Issues:** [github.com/segnals/segnals-mcp/issues](https://github.com/segnals/segnals-mcp/issues)
