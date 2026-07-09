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
      '  1. search-availability — find candidate slots in the new window.',
      '  2. create-hold — secure the selected candidate.',
      '  3. delete-event — cancel the old booking.',
      '  4. confirm-hold — commit the new slot.',
      'Order matters: always search and hold FIRST, delete SECOND. If you delete first and confirm-hold then fails (slot taken by another booking between steps), the user ends up with no booking. Holding the new slot before deleting minimises that window to near-zero.',
      'ROLLBACK WARNING: there is no atomic guarantee. If confirm-hold fails after delete-event has already run, the old booking is gone. Inform the user and retry with a fresh search-availability + create-hold flow.',
    ].join('\n'),
    {
      id: z.string().uuid().describe('The booking ID to update.'),
      title: z.string().min(1).optional().describe('New event title.'),
      description: z
        .string()
        .optional()
        .describe('Event body/notes — agenda, dial-in link, prep instructions, etc.'),
      attendees: z.array(AttendeeSchema).optional().describe('Replacement attendee list.'),
    },
    async ({ id, title, description, attendees }) => {
      try {
        return ok(
          await client.updateBooking(id, {
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
