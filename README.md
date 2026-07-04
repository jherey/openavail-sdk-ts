# openavail-sdk-ts

TypeScript packages for the [Openavail](https://openavail.com) API.

| Package | Description | npm |
|---|---|---|
| [`@openavail/sdk`](./packages/sdk) | TypeScript client — zero dependencies, Node 18+ | [![npm](https://img.shields.io/npm/v/@openavail/sdk)](https://www.npmjs.com/package/@openavail/sdk) |
| [`@openavail/mcp`](./packages/mcp) | MCP stdio server — works with Claude, Cursor, Windsurf, and any MCP-compatible client | [![npm](https://img.shields.io/npm/v/@openavail/mcp)](https://www.npmjs.com/package/@openavail/mcp) |

## Quick start

### SDK

```bash
npm i @openavail/sdk
```

```typescript
import { OpenavailClient } from '@openavail/sdk';

const client = new OpenavailClient({ apiKey: process.env.OPENAVAIL_API_KEY });

const { candidates } = await client.searchAvailability({
  ownerEmail:    'alex@acme.com',
  durationMinutes: 60,
  meetingClass:  'external_customer_call',
  earliestStart: '2026-07-01T09:00:00Z',
  latestEnd:     '2026-07-01T17:00:00Z',
});

const hold = await client.createHold({
  ownerEmail: 'alex@acme.com',
  meetingClass: 'external_customer_call',
  holdScope: 'candidate',
  candidate: candidates[0],
});

await client.confirmHold({
  holdId: hold.holdId,
  start: hold.heldWindow.start,
  end:   hold.heldWindow.end,
  title: 'Strategy call',
});
```

### MCP

```bash
npx @openavail/mcp
```

Add to your MCP client config (Claude Desktop, Claude Code, Cursor, etc.):

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

Public scheduling tools can also run without an owner-agent API key. Set
`OPENAVAIL_REQUESTER_CREDENTIAL=rc_...` when the agent is a verified external requester, or omit all
credentials for anonymous public scheduling.

## Development

```bash
pnpm install
pnpm -r build      # build all packages
pnpm -r test       # run all test suites
pnpm -r typecheck  # type-check all packages
```

Each package has its own README with full API documentation.
