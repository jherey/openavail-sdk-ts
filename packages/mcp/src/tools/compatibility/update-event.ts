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
      'At least one of title, description, or attendees must be provided.',
      'NOT supported: start/end changes, location, timeZone, recurrence. To change the time, follow the reschedule flow below.',
      'RESCHEDULE FLOW (changing start/end time):',
      '  1. check-availability — find slots in the new window and secure a hold.',
      '  2. delete-event — cancel the old booking.',
      '  3. confirm-hold — commit the new slot.',
      'Order matters: always check-availability FIRST, delete SECOND. If you delete first and confirm-hold then fails (slot taken by another booking between steps), the user ends up with no booking. Holding the new slot before deleting minimises that window to near-zero.',
      'ROLLBACK WARNING: there is no atomic guarantee. If confirm-hold fails after delete-event has already run, the old booking is gone. Inform the user and retry with a fresh check-availability.',
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
