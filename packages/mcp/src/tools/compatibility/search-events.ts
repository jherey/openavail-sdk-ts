import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { OpenavailClient } from '@openavail/sdk';
import { OpenavailError } from '@openavail/sdk';
import { z } from 'zod';
import { missingOwnerEmail, ok, toolError } from '../error.js';

export function registerSearchEvents(
  server: McpServer,
  client: OpenavailClient,
  defaultOwnerEmail?: string,
): void {
  server.tool(
    'search-events',
    'Search committed bookings by title text. Equivalent to Google Calendar search-events. Uses case-insensitive substring match on the event title.',
    {
      owner_email: z.string().email().optional().describe(
        defaultOwnerEmail
          ? `Email of the calendar owner. Defaults to ${defaultOwnerEmail}.`
          : 'Email of the calendar owner.',
      ),
      q: z
        .string()
        .min(1)
        .describe('Search query — matched case-insensitively against the event title.'),
      timeMin: z.string().optional().describe('Lower bound for event start time (ISO 8601 UTC).'),
      timeMax: z.string().optional().describe('Upper bound for event start time (ISO 8601 UTC).'),
      maxResults: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe('Maximum results to return.'),
    },
    async ({ owner_email, q, timeMin, timeMax, maxResults }) => {
      const email = owner_email ?? defaultOwnerEmail;
      if (!email) return missingOwnerEmail();
      try {
        return ok(
          await client.listBookings({
            ownerEmail: email,
            query: q,
            ...(timeMin !== undefined && { start: timeMin }),
            ...(timeMax !== undefined && { end: timeMax }),
            ...(maxResults !== undefined && { limit: maxResults }),
          }),
        );
      } catch (err) {
        if (err instanceof OpenavailError) return toolError(err);
        throw err;
      }
    },
  );
}
