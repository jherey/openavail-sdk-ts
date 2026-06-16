# @openavail/mcp

MCP server for Openavail — gives AI agents the ability to check availability, create bookings, and manage calendar events on behalf of calendar owners. Works with any MCP-compatible client: Claude Desktop, Claude Code, Codex, Cursor, and others.

## Quickstart

### Claude Desktop

Add to your Claude Desktop config file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "openavail": {
      "command": "npx",
      "args": ["-y", "@openavail/mcp"],
      "env": {
        "OPENAVAIL_API_KEY": "sk_live_...",
        "OPENAVAIL_OWNER_EMAIL": "owner@example.com"
      }
    }
  }
}
```

Restart Claude Desktop after saving.

### Claude Code (CLI)

Add to `~/.claude.json` under the top-level `mcpServers` key (create the file if it doesn't exist):

```json
{
  "mcpServers": {
    "openavail": {
      "command": "npx",
      "args": ["-y", "@openavail/mcp"],
      "env": {
        "OPENAVAIL_API_KEY": "sk_live_...",
        "OPENAVAIL_OWNER_EMAIL": "owner@example.com"
      }
    }
  }
}
```

Or register it from the terminal:

```bash
claude mcp add openavail npx -- -y @openavail/mcp
```

Then set env vars in `~/.claude.json` under the `openavail` entry as shown above.

### Codex CLI

Add to `~/.codex/config.toml`:

```toml
[mcp_servers.openavail]
command = "npx"
args = ["-y", "@openavail/mcp"]
env = { OPENAVAIL_API_KEY = "sk_live_...", OPENAVAIL_OWNER_EMAIL = "owner@example.com" }
```

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `OPENAVAIL_API_KEY` | Yes | API key from the Openavail dashboard (Settings → API Keys) |
| `OPENAVAIL_OWNER_EMAIL` | No | Default calendar owner email. When set, all tools omit the `owner_email` parameter. Override per-call by passing `owner_email` explicitly. |

## Getting an API key

1. Log in to the Openavail dashboard.
2. Go to **Settings → API Keys → Create key**.
3. Copy the key immediately — it is not shown again.

## Available tools

| Tool | Description |
|---|---|
| `list-calendars` | List connected calendars and which types (work/personal/other) are unavailable. |
| `list-events` | List committed bookings for a calendar owner. |
| `get-event` | Fetch a single booking by ID. |
| `create-event` | Create a booking directly (no prior hold). |
| `update-event` | Update a booking's title, description, or attendees. |
| `delete-event` | Cancel a booking. |
| `search-events` | Search bookings by title keyword. |
| `check-availability` | Find available slots and create a hold. |
| `confirm-hold` | Confirm a hold, committing the booking. |
| `simulate` | Preview arbitration without creating anything (Pro plan). |
| `list-meeting-classes` | List valid meeting class names and their priority/preempt policy. |
| `get-pending-notifications` | Flush and return pending agent notifications. |

## Notes

**Calendar types**: Openavail supports `work`, `personal`, and `other` calendar types per owner. If a user has only connected a personal calendar and you pass `calendar_type: "work"`, the request silently falls back to the primary calendar. Always call `list-calendars` first — it returns both connected calendars and an `unavailable_calendar_types` array so you know which types to avoid. If the primary calendar is also missing or disabled, the fallback fails with `CALENDAR_NOT_FOUND` — there is no further fallback to other connected calendars.

**Hold TTL**: `check-availability` creates a 5-minute hold. For human-in-the-loop flows where a user picks a slot, confirm promptly or the hold will expire. Configurable TTL is on the roadmap.

**All times are UTC**: Pass `start`/`end` in ISO 8601 UTC format. The `timezone` field returned by `list-calendars` tells you the owner's local timezone — use it to convert before calling.

**Rate limits**: Limits are per API key, independent of other keys. On a 429 response, read the `Retry-After` header and wait that many seconds before retrying.

| Tool | Limit |
|---|---|
| `check-availability` | 300 req/min |
| `confirm-hold` | 120 req/min |
| `create-event` | 120 req/min |
| All other tools | 600 req/min (shared per server IP) |
