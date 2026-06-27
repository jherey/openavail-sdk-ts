# @openavail/mcp

MCP server for [Openavail](https://openavail.com) — gives AI agents the ability to check availability, create bookings, and manage calendar events on behalf of calendar owners. Works with any MCP-compatible client: Claude Desktop, Claude Code, Cursor, Windsurf, and others.

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
        "OPENAVAIL_API_KEY": "ak_01HX7QQM…",
        "OPENAVAIL_OWNER_EMAIL": "owner@example.com"
      }
    }
  }
}
```

Restart Claude Desktop after saving.

### Claude Code (CLI)

```bash
claude mcp add --transport stdio openavail \
  --env OPENAVAIL_API_KEY=ak_01HX7QQM… \
  --env OPENAVAIL_OWNER_EMAIL=owner@example.com \
  -- npx -y @openavail/mcp
```

### Cursor / Windsurf / other clients

Add the same JSON block to your client's MCP config file. Config file locations:

| Client | Config file |
|---|---|
| Cursor | `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global) |
| Windsurf | `.codeium/windsurf/mcp_config.json` |

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `OPENAVAIL_API_KEY` | Yes | API key from the Openavail dashboard. Go to **Agents → Register agent**, create an agent, then click **Create API key**. Keys are prefixed `ak_`. |
| `OPENAVAIL_OWNER_EMAIL` | No | Default calendar owner email. When set, all tools omit the `owner_email` parameter. Override per-call by passing `owner_email` explicitly. |

## Getting an API key

1. Log in to the Openavail dashboard.
2. Go to **Agents → Register agent** and create an agent.
3. Click **Create API key** under the agent.
4. Copy the key immediately — it is not shown again.

For a new approval-mode agent using this MCP server, grant `read_freebusy` and
`create_booking_proposals`. For trusted auto-booking agents, grant `read_freebusy`,
`create_holds`, and `create_bookings`. Grant `read_events` only when the agent should see booking titles,
descriptions, and attendees in Openavail responses. Grant `preempt` only to trusted agents that may
displace lower-priority bookings when rules allow it.

## Available tools

### Start here

| Tool | Description |
|---|---|
| `get-agent-context` | **Call this first.** Returns the owner's timezone, working hours, slot interval, and all valid meeting class names in one call. Everything you need to make a valid booking request. |

### Native tools (Openavail-specific)

| Tool | Description |
|---|---|
| `create-booking-proposal` | Create an approval-first booking proposal without creating a hold or calendar event. |
| `search-availability` | Find candidate slots without creating a hold. Pass `earliest_start` and `latest_end` — `latest_end` is when the meeting must **end**, not start. |
| `create-hold` | Reserve a selected candidate or short negotiation window. |
| `confirm-hold` | Confirm a hold, committing the booking to the calendar. |
| `simulate` | Preview the arbitration decision without creating anything (Pro plan). |
| `get-schedule-rules` | Get working hours and slot interval for an owner. |
| `list-meeting-classes` | List valid meeting class names and their priority/preempt policy. |
| `get-pending-notifications` | Fetch unread agent notifications (last 7 days). |
| `ack-notifications` | Acknowledge notifications by ID to mark them as read. |

### Compatibility tools (Google Calendar MCP-compatible names)

These use the same tool names as `google-calendar-mcp` so agents targeting that server work without prompt changes.

| Tool | Description |
|---|---|
| `list-calendars` | List connected calendars for an owner. |
| `list-events` | List committed bookings in a time window. |
| `get-event` | Fetch a single booking by ID. |
| `create-event` | Create a booking directly (no prior hold). |
| `update-event` | Update a booking's title, description, or attendees. |
| `delete-event` | Cancel a booking. |
| `search-events` | Search bookings by title keyword. |

## Notes

**Always call `get-agent-context` first.** It returns the owner's IANA timezone, working hours, setup warnings, unavailable features, and all valid meeting class names in one call. Use the timezone to convert local times to UTC before any booking call.

**`latest_end` is a deadline, not a start boundary.** `latest_end` is the latest a meeting may **end**, not start. For a 60-min meeting at 2 pm, set `latest_end` to at least 3 pm.

**Use `expiresInSeconds` for TTL checks.** The `create-hold` response includes both `expiresAt` (absolute UTC timestamp) and `expiresInSeconds` (relative). Use `expiresInSeconds` for hold freshness and retry decisions; use `expiresAt` for logging, display, and correlation.

**Calendar types**: Openavail supports `work`, `personal`, and `other` calendar types per owner. If a user has only connected a personal calendar and you pass `calendar_type: "work"`, the request silently falls back to the primary calendar. Call `list-calendars` first to know which types are connected.

**Hold TTL**: `create-hold` creates a 5-minute hold. Confirm promptly for human-in-the-loop flows, or the hold will expire.

**All times are UTC**: Pass `start`/`end` in ISO 8601 UTC format (`2026-07-01T14:00:00Z`). The timezone from `get-agent-context` tells you the owner's local timezone for conversion.

**Rate limits**: Per API key, independent of other keys. On a 429 response, read the `Retry-After` header and wait that many seconds.

| Tool | Limit |
|---|---|
| `search-availability` | 300 req/min |
| `create-hold`, `confirm-hold`, `create-event` | 120 req/min each |
| All other tools | 600 req/min (shared per server IP) |
