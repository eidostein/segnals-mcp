# Authentication

## API Keys

Segnals MCP uses API keys for authentication. Keys are:

- **Format:** `sk_live_<random>` (production) or `sk_test_<random>` (testing)
- **Shown once:** Copy immediately when created — you can't retrieve it later
- **Stored securely:** Only the SHA-256 hash is stored server-side
- **Revocable:** Revoke any key instantly from the dashboard
- **Rotatable:** Rotate to a new key while preserving scope configuration

---

## Scopes

Each API key is granted specific scopes that control which tools it can access. A tool
will return `403 Forbidden` if the key lacks the required scope.

| Scope | Read/Write | Access |
|-------|-----------|--------|
| `read:account` | Read | Account details, subscription, connections |
| `read:stats` | Read | Dashboard, PnL, performance, trades |
| `read:bots` | Read | Bot list, config, logs, strategy schema |
| `write:bots` | Write | Create, update, delete bots |
| `control:bots` | Control | Start, stop, restart bots; copy trading |
| `write:strategies` | Write | Create strategies with full config |
| `read:marketplace` | Read | Browse marketplace, view listings |
| `write:marketplace` | Write | Copy and publish strategies |
| `read:news` | Read | Newsfeed, sentiment, market prices |
| `read:knowledge` | Read | Knowledge base search |
| `manage:notifications` | Read/Write | Notification preferences |

### Scope Recommendations

| Use Case | Recommended Scopes |
|----------|-------------------|
| Read-only monitoring | `read:account`, `read:stats`, `read:bots` |
| Full bot management | All `read:*` + `write:bots` + `control:bots` |
| Strategy building | Add `write:strategies` |
| Marketplace access | Add `read:marketplace` + `write:marketplace` |
| Everything | All scopes |

---

## Environment Variable

Set your key **exclusively** via environment variable:

```bash
export SEGNALS_API_KEY=sk_live_your_key_here
```

**Never** pass the key via:
- ❌ Command-line arguments
- ❌ Committed files (`.env` in git, config files)
- ❌ Chat messages to an AI agent
- ❌ URL parameters

### Per-Client Configuration

Use the `${env:SEGNALS_API_KEY}` pattern in client configs to reference the env var
without embedding the actual key:

```json
{
  "env": {
    "SEGNALS_API_KEY": "${env:SEGNALS_API_KEY}"
  }
}
```

---

## Rate Limiting

- Default: **120 requests per minute** per key
- When exceeded: `429 Too Many Requests` with a `Retry-After` header
- The MCP server surfaces a clear message to the agent automatically

---

## Key Rotation

To rotate a key without downtime:

1. Go to **Settings → API Keys**
2. Click **Rotate** on your active key
3. A new key is generated with the same name and scopes
4. Copy the new key immediately
5. Update your `SEGNALS_API_KEY` environment variable
6. Restart your MCP client

The old key is **immediately revoked** upon rotation.

---

## Key Expiry

API keys can optionally have an expiry date set during creation. After expiry:
- The key returns `401 Unauthorized` on all requests
- The agent will instruct the user to generate a new key
- Expired keys can be cleaned up from the dashboard

---

## IP Allowlist

For enhanced security, you can restrict API key usage to specific IP addresses:

1. Go to **Settings → API Keys**
2. Click the key you want to restrict
3. Add allowed IP addresses or CIDR ranges
4. Requests from other IPs will be rejected with `403 Forbidden`

---

## What To Do If a Key Leaks

If your API key is accidentally exposed (committed to git, shared in chat, etc.):

1. **Immediately revoke** the key at Settings → API Keys
2. **Generate a new key** with the same scopes
3. **Update** your `SEGNALS_API_KEY` environment variable
4. **Check audit logs** in your dashboard to review any unauthorized activity
5. **Rotate exchange credentials** if you suspect broader compromise

> ⚠️ API keys can read your account data and manage your bots. Treat a leak as a
> security incident and act immediately.

---

## Test Mode

Keys starting with `sk_test_` connect to the test/staging environment:

```bash
export SEGNALS_API_KEY=sk_test_your_test_key
export SEGNALS_API_BASE=https://staging.segnals.com/api
```

Test keys have the same scope model but operate on test data. Use them for development
and CI/CD without affecting your live account.
