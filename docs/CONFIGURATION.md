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
`latest`, use its tag, e.g. `ghcr.io/eidostein/segnals-mcp:0.1.1`.

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

## Several accounts

One server can hold keys for several Segnals accounts, one key per account, each under a
label you choose. Put them in a local JSON file, for example
`~/.config/segnals/accounts.json`:

```json
{
  "accounts": [
    { "label": "vip-a", "key": "sk_test_your_first_key" },
    { "label": "vip-b", "key": "sk_test_your_second_key" }
  ]
}
```

Only you may be able to read it, as with an ssh private key. The server refuses to start
when the group or others have any permission on the file:

```bash
chmod 600 ~/.config/segnals/accounts.json
```

Then set `SEGNALS_ACCOUNTS_FILE` to its absolute path instead of `SEGNALS_API_KEY`. Setting
both is refused, so it is never unclear which key acts. For Claude Desktop with a local build:

```json
{
  "mcpServers": {
    "segnals": {
      "command": "node",
      "args": ["/absolute/path/to/segnals-mcp/dist/index.js"],
      "env": {
        "SEGNALS_ACCOUNTS_FILE": "/absolute/path/to/.config/segnals/accounts.json"
      }
    }
  }
}
```

For Claude Code: `claude mcp add segnals -e SEGNALS_ACCOUNTS_FILE=$HOME/.config/segnals/accounts.json -- node /absolute/path/to/segnals-mcp/dist/index.js`

With the Docker image, mount the file read-only with `-v` and pass `SEGNALS_ACCOUNTS_FILE`
with its path inside the container. The image runs as root, so it can read a file that only
you can read on the host.

The file is also refused when a label repeats (ignoring case), is not 1 to 64 letters,
digits, `.`, `_` or `-`, or looks like a key; when a key is not `sk_live_…` or
`sk_test_…`; and when two labels hold the same key. The refusal names the file, the entry
and the rule, never a key.

What changes for the agent:
- Every tool takes `account`, the label. With several accounts it is required: a call
  without it, or with a label the file does not hold, is refused with the list of labels.
  Only `segnals_list_accounts` needs none: it lists every account.
- Every answer starts with the label it acted on, for example `account: vip-a`.
- `segnals_list_accounts` lists the labels, each key's mode (`live` or `test`, read from
  the prefix; never the key) and each account's fleet.
- Nothing crosses accounts. Each call uses one account's key, and each key keeps its own
  scopes, limits and rate limit on the server.

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SEGNALS_API_KEY` | **Yes**, unless `SEGNALS_ACCOUNTS_FILE` is set | — | Your Segnals API key (`sk_live_*` or `sk_test_*`); one account, labelled `default` |
| `SEGNALS_ACCOUNTS_FILE` | No | — | Instead of `SEGNALS_API_KEY`: the path of a JSON file of labelled keys, one per account, readable by you only ([Several accounts](#several-accounts)) |
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
