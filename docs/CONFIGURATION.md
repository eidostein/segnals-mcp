# Configuration

Copy-paste configs for each MCP client. Always use environment variables for your API
key — **never embed secrets directly in config files.**

The server is not published to npm. Every config below runs the Docker image published on
GHCR, `ghcr.io/eidostein/segnals-mcp`; to run a build from source instead, see
[From Source](#from-source). The image is rebuilt on each release tag, so `latest` is the
last release.

---

## Claude Desktop

Add to `claude_desktop_config.json` (Settings → Developer → Edit Config):

```json
{
  "mcpServers": {
    "segnals": {
      "command": "docker",
      "args": ["run", "--rm", "-i", "-e", "SEGNALS_API_KEY", "ghcr.io/eidostein/segnals-mcp:latest"],
      "env": {
        "SEGNALS_API_KEY": "${env:SEGNALS_API_KEY}"
      }
    }
  }
}
```

`-i` keeps stdin open, which the MCP stdio transport needs. `-e SEGNALS_API_KEY` (a name
with no value) passes the key from the environment into the container, so the key itself
never appears in the config.

Then set in your terminal before launching Claude Desktop:
```bash
export SEGNALS_API_KEY=sk_live_your_key_here
```

---

## Claude Code (CLI)

```bash
# Add the MCP server
claude mcp add segnals -- docker run --rm -i -e SEGNALS_API_KEY ghcr.io/eidostein/segnals-mcp:latest

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
      "command": "docker",
      "args": ["run", "--rm", "-i", "-e", "SEGNALS_API_KEY", "ghcr.io/eidostein/segnals-mcp:latest"],
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
      "command": "docker",
      "args": ["run", "--rm", "-i", "-e", "SEGNALS_API_KEY", "ghcr.io/eidostein/segnals-mcp:latest"],
      "env": {
        "SEGNALS_API_KEY": "${env:SEGNALS_API_KEY}"
      }
    }
  }
}
```

---

## Docker

To run the image by hand, with the key exported in the same shell:

```bash
export SEGNALS_API_KEY=sk_live_your_key_here
docker run --rm -i -e SEGNALS_API_KEY ghcr.io/eidostein/segnals-mcp:latest
```

The server speaks MCP over stdin/stdout and waits for a client, so a healthy start prints
nothing; a missing or malformed key prints an error and exits. To pin a release instead of
`latest`, use its tag, e.g. `ghcr.io/eidostein/segnals-mcp:0.1.0`.

---

## From Source

```bash
git clone https://github.com/eidostein/segnals-mcp.git
cd segnals-mcp
npm ci
npm run build

# Run directly, with SEGNALS_API_KEY exported in this shell
node dist/index.js
```

For Claude Desktop with a local build:
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

For Claude Code: `claude mcp add segnals -- node /absolute/path/to/segnals-mcp/dist/index.js`

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SEGNALS_API_KEY` | **Yes** | — | Your Segnals API key (`sk_live_*` or `sk_test_*`) |
| `SEGNALS_API_BASE` | No | `https://segnals.com/api` | API base URL (override to use staging) |
| `SEGNALS_TIMEOUT_MS` | No | `30000` | HTTP request timeout in milliseconds |
| `SEGNALS_MAX_RETRIES` | No | `3` | Max retry attempts on 5xx server errors |

With Docker, each variable you set needs its own `-e NAME` in the `docker run` arguments,
or the container does not see it.

---

## Staging

`SEGNALS_API_BASE` chooses the server; the key's prefix does not. To use Segnals' staging
environment instead of production:

```bash
export SEGNALS_API_KEY=sk_live_your_staging_key
export SEGNALS_API_BASE=https://test.segnals.com/api
```

With Docker, add `-e SEGNALS_API_BASE` next to `-e SEGNALS_API_KEY`.

Staging needs its own API key, created on test.segnals.com, and it is not all demo: some
accounts there trade real money. Treat a staging key like a production key.

---

## Security Best Practices

1. **Never commit API keys** to version control
2. **Use `${env:SEGNALS_API_KEY}`** in config files, not the actual key
3. **Add `.env` to `.gitignore`** if you use dotenv files locally
4. **Rotate keys regularly** — especially for shared team environments
5. **Use read-only scopes** when you only need monitoring
6. **Revoke unused keys** from the dashboard promptly
