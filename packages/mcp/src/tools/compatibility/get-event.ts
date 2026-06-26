import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { OpenavailClient } from '@openavail/sdk';
import { OpenavailError } from '@openavail/sdk';
import { z } from 'zod';
import { ok, toolError } from '../error.js';

export function registerGetEvent(server: McpServer, client: OpenavailClient): void {
  server.tool(
    'get-event',
    "Fetch a single booking by its ID. Equivalent to Google Calendar get-event. The response includes a status field: 'committed' means the booking is active; 'needs_reschedule' means it was displaced by a higher-priority event — do not retry the same slot, find a new one via search-availability.",
    { eventId: z.string().uuid().describe('The booking ID (UUID).') },
    async ({ eventId }) => {
      try {
        return ok(await client.getBooking(eventId));
      } catch (err) {
        if (err instanceof OpenavailError) return toolError(err);
        throw err;
      }
    },
  );
}
