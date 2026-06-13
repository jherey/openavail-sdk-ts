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
      'Update booking metadata (title, description, and/or attendees). Equivalent to Google Calendar update-event.',
      'IMPORTANT: Only metadata updates are supported. To change the meeting time, cancel and rebook instead.',
      'At least one of title, description, or attendees must be provided.',
      'NOT supported in v1: location, timeZone, recurrence.',
    ].join('\n'),
    {
      eventId: z.string().uuid().describe('The booking ID to update.'),
      title: z.string().min(1).optional().describe('New event title.'),
      description: z
        .string()
        .optional()
        .describe('Event body/notes — agenda, dial-in link, prep instructions, etc.'),
      attendees: z.array(AttendeeSchema).optional().describe('Replacement attendee list.'),
    },
    async ({ eventId, title, description, attendees }) => {
      try {
        return ok(
          await client.updateBooking(eventId, {
            ...(title !== undefined && { title }),
            ...(description !== undefined && { description }),
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
