# Configuration

Copy-paste configs for each MCP client. Always use environment variables for your API
key — **never embed secrets directly in config files.**

---

## Claude Desktop

Add to `claude_desktop_config.json` (Settings → Developer → Edit Config):

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

Then set in your terminal before launching Claude Desktop:
```bash
export SEGNALS_API_KEY=sk_live_your_key_here
```

---

## Claude Code (CLI)

```bash
# Add the MCP server
claude mcp add segnals -- npx -y @segnals/mcp

# Set your API key in your shell
export SEGNALS_API_KEY=sk_live_your_key_here
```

---

## Cursor

Add to `.cursor/mcp.json` in your project root:

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

---

## Windsurf / Copilot / Other MCP Clients

Most MCP clients follow the same pattern. Use the generic config:

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

---

## Docker

Run the server as a Docker container:

```bash
docker run --rm \
  -e SEGNALS_API_KEY=sk_live_your_key_here \
  ghcr.io/segnals/mcp
```

For Claude Desktop with Docker:

```json
{
  "mcpServers": {
    "segnals": {
      "command": "docker",
      "args": ["run", "--rm", "-i", "ghcr.io/segnals/mcp"],
      "env": {
        "SEGNALS_API_KEY": "${env:SEGNALS_API_KEY}"
      }
    }
  }
}
```

---

## From Clone (Development)

```bash
git clone https://github.com/segnals/segnals-mcp.git
cd segnals-mcp
npm install
npm run build

# Run directly
SEGNALS_API_KEY=sk_live_... node dist/index.js
```

For Claude Desktop with a local clone:
```json
{
  "mcpServers": {
    "segnals": {
      "command": "node",
      "args": ["/absolute/path/to/segnals-mcp/dist/index.js"],
      "env": {
        "SEGNALS_API_KEY": "${env:SEGNALS_API_KEY}"
      }
    }
  }
}
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SEGNALS_API_KEY` | **Yes** | — | Your Segnals API key (`sk_live_*` or `sk_test_*`) |
| `SEGNALS_API_BASE` | No | `https://segnals.com/api` | API base URL (override for staging/test) |
| `SEGNALS_TIMEOUT_MS` | No | `30000` | HTTP request timeout in milliseconds |
| `SEGNALS_MAX_RETRIES` | No | `3` | Max retry attempts on 5xx server errors |

---

## Test Mode

For development and testing, use a test key with the staging API:

```bash
export SEGNALS_API_KEY=sk_test_your_test_key
export SEGNALS_API_BASE=https://staging.segnals.com/api
```

Test keys operate on a sandboxed environment — no real trades or funds are affected.

---

## Security Best Practices

1. **Never commit API keys** to version control
2. **Use `${env:SEGNALS_API_KEY}`** in config files, not the actual key
3. **Add `.env` to `.gitignore`** if you use dotenv files locally
4. **Rotate keys regularly** — especially for shared team environments
5. **Use read-only scopes** when you only need monitoring
6. **Revoke unused keys** from the dashboard promptly
