import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { OpenavailClient } from '@openavail/sdk';
import { OpenavailError } from '@openavail/sdk';
import { z } from 'zod';
import { ok, toolError } from '../error.js';

export function registerDeleteEvent(server: McpServer, client: OpenavailClient): void {
  server.tool(
    'delete-event',
    [
      'Cancel a booking (calendar event). Equivalent to Google Calendar delete-event.',
      'Cancellation is owner-scoped: any agent with create_bookings permission and access to the calendar owner can cancel, not only the agent that created the booking.',
      'The original booking agent receives a booking.cancelled notification in its next pending_notifications response.',
      'Returns BOOKING_NOT_CANCELLABLE (409) if the booking is in a non-cancellable status.',
      'RESCHEDULE ORDER: when rescheduling (moving a booking to a new time), call search-availability and create-hold to secure the new slot BEFORE calling delete-event. Deleting first leaves the user with no booking if the new confirm-hold later fails.',
    ].join('\n'),
    { eventId: z.string().uuid().describe('The booking ID to cancel.') },
    async ({ eventId }) => {
      try {
        return ok(await client.cancelBooking(eventId));
      } catch (err) {
        if (err instanceof OpenavailError) return toolError(err);
        throw err;
      }
    },
  );
}
