import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { OpenavailClient } from '@openavail/sdk';
import { OpenavailError } from '@openavail/sdk';
import { z } from 'zod';
import { ok, toolError } from '../error.js';

export function registerListEvents(server: McpServer, client: OpenavailClient): void {
  server.tool(
    'list-events',
    'List committed bookings (calendar events) for a calendar owner. Equivalent to Google Calendar list-events. timeMin/timeMax filter by meeting start time (ISO 8601 UTC). Omitting timeMin/timeMax returns bookings in the next 3 days.',
    {
      owner_email: z.string().email().describe('Email of the calendar owner.'),
      timeMin: z
        .string()
        .optional()
        .describe('Lower bound for event start time (ISO 8601 UTC). Defaults to now.'),
      timeMax: z
        .string()
        .optional()
        .describe('Upper bound for event start time (ISO 8601 UTC). Defaults to now + 3 days.'),
      maxResults: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe('Maximum number of events to return (1–100). Default 50.'),
      cursor: z.string().optional().describe('Pagination cursor from a previous response.'),
    },
    async ({ owner_email, timeMin, timeMax, maxResults, cursor }) => {
      try {
        return ok(
          await client.listBookings({
            ownerEmail: owner_email,
            ...(timeMin !== undefined && { start: timeMin }),
            ...(timeMax !== undefined && { end: timeMax }),
            ...(maxResults !== undefined && { limit: maxResults }),
            ...(cursor !== undefined && { cursor }),
          }),
        );
      } catch (err) {
        if (err instanceof OpenavailError) return toolError(err);
        throw err;
      }
    },
  );
}
