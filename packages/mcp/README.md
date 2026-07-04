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
        "OPENAVAIL_REQUESTER_CREDENTIAL": "rc_12345678_…",
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
| `OPENAVAIL_API_KEY` | Required for private owner-scoped tools | Owner-agent API key from the Openavail dashboard. Go to **Agents → Register agent**, create an agent, then click **Create API key**. Keys are prefixed `ak_`. |
| `OPENAVAIL_REQUESTER_CREDENTIAL` | Optional | Requester credential for public scheduling tools. Keys are prefixed `rc_`. It proves external requester identity when asking another owner for time; it does not grant calendar access. |
| `OPENAVAIL_OWNER_EMAIL` | No | Default calendar owner email for private owner-scoped tools. When set, those tools omit the `owner_email` parameter. Override per-call by passing `owner_email` explicitly. |

No credential is required for anonymous public scheduling tools. If neither `OPENAVAIL_API_KEY` nor `OPENAVAIL_REQUESTER_CREDENTIAL` is set, the server registers public scheduling tools only and calls public scheduling anonymously. If only `OPENAVAIL_REQUESTER_CREDENTIAL` is set, the server registers public scheduling tools only with verified requester identity. If `OPENAVAIL_API_KEY` is set, private owner-scoped tools are also registered, and public scheduling tools still use anonymous or requester-credential identity rather than owner authority.

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

## Requester credentials

Requester credentials are different from owner-agent API keys:

- `OPENAVAIL_API_KEY` acts inside the configured owner's account. Use it for private tools such as `search-availability`, `create-hold`, `confirm-hold`, `create-booking-proposal`, and calendar-event compatibility tools.
- `OPENAVAIL_REQUESTER_CREDENTIAL` proves external requester identity for public scheduling tools. It is used when asking another owner for time through their public scheduling boundary. The target owner's policy still decides visibility, review, and auto-book behavior.

Anonymous public scheduling does not need a requester credential. Set `OPENAVAIL_REQUESTER_CREDENTIAL` when a verified requester should see meeting types or behavior that the target owner has allowed for that requester identity, verified domain, or audience.

## Available tools

### Start here

For private owner-scoped tools, start by reading the owner context. Public scheduling tools can run
without owner-agent credentials and do not expose this tool unless `OPENAVAIL_API_KEY` is set.

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

### Public scheduling tools

Use these when the agent is an external requester asking another owner for time. These tools never expose internal proposal IDs, private conflicts, hidden meeting types, raw owner availability, or owner audit history.

| Tool | Description |
|---|---|
| `list-public-meeting-types` | List public-safe meeting types visible on a public scheduling boundary. Uses anonymous identity or `OPENAVAIL_REQUESTER_CREDENTIAL` when set. Returns suggested times when the owner enabled them. |
| `create-public-booking-proposal` | Submit a structured or free-text public booking proposal. `requester_contact` is the submitter; `attendees` should include the requester. Returns a safe status and status URL. |
| `confirm-public-requester-contact` | Confirm the requester-contact email for an anonymous public proposal using the token from the contact verification URL. |
| `get-public-booking-proposal-status` | Poll safe public status by public proposal access token. |
| `withdraw-public-booking-proposal` | Withdraw a pending public proposal by public proposal access token. It does not cancel or reschedule booked meetings. |

`list-public-meeting-types` returns the display name, optional description,
duration, `public_meeting_type` identifier, and `suggestedTimes` when configured.
Suggested times are not holds. Use the identifier when calling
`create-public-booking-proposal`, and use the duration when choosing the request
window. If you choose a suggested time, submit it as the `requested_window`; Openavail
rechecks the window before the request continues. Owner/admin setup derives the
identifier from the meeting type name by default.

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
