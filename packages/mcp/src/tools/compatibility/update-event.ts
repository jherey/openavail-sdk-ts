import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { OpenavailClient } from '@openavail/sdk';
import { OpenavailError } from '@openavail/sdk';
import { z } from 'zod';
import { ok, toolError } from '../error.js';

const AttendeeSchema = z.object({
  email: z.string().email(),
  displayName: z.string().optional(),
});

export function registerUpdateEvent(server: McpServer, client: OpenavailClient): void {
  server.tool(
    'update-event',
    [
      'Update booking metadata (title and/or attendees). Equivalent to Google Calendar update-event.',
      'IMPORTANT: Only metadata updates are supported. To change the meeting time, cancel and rebook instead.',
      'At least one of summary or attendees must be provided.',
      'summary maps to title. description, location, timeZone, and recurrence are not supported in v1.',
    ].join('\n'),
    {
      eventId: z.string().uuid().describe('The booking ID to update.'),
      summary: z
        .string()
        .min(1)
        .optional()
        .describe('New event title (mapped from Google Calendar summary).'),
      attendees: z.array(AttendeeSchema).optional().describe('Replacement attendee list.'),
    },
    async ({ eventId, summary, attendees }) => {
      try {
        return ok(
          await client.updateBooking(eventId, {
            ...(summary !== undefined && { title: summary }),
            ...(attendees !== undefined && { attendees }),
          }),
        );
      } catch (err) {
        if (err instanceof OpenavailError) return toolError(err);
        throw err;
      }
    },
  );
}
