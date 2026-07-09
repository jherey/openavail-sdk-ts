import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { OpenavailClient } from '@openavail/sdk';
import { OpenavailError } from '@openavail/sdk';
import { z } from 'zod';
import { ok, toolError } from '../error.js';

const AttendeeSchema = z.object({
  email: z.string().email(),
  displayName: z.string().optional(),
});

export function registerConfirmHold(server: McpServer, client: OpenavailClient): void {
  server.tool(
    'confirm-hold',
    [
      'Confirm a hold created by create-hold, promoting it to a committed booking.',
      'Requires permission: create_bookings.',
      'REJECTION: if arbitration rejects the slot, ArbitrationRejectedError is thrown. Possible reasons: NO_CAPACITY (slot taken), WORKING_HOURS (outside working hours), OFF_DAY (non-working day), SACRED_MEETING (immovable protected booking), MAX_DAILY_HOURS (daily limit reached), PERMISSION_DENIED_PREEMPT (no preemption permission). alternatives[] contains contextually close slots; next_available points to the absolute nearest free slot.',
      'Returns: bookingId, correlationId, displacedCount (bookings preempted by higher priority), pendingNotifications (last 60 minutes only — call get-pending-notifications for the full backlog).',
      'For candidate holds, the chosen start/end must match the held candidate exactly. For window holds, the chosen start/end must fall within the held window.',
      'PAST_TIME: the chosen start must be in the future at the time of this call. If the hold was created for a future slot that has since passed (e.g. a long user pause), the API returns 422 with code PAST_TIME. Re-run search-availability and create-hold with a fresh window.',
      'RATE LIMIT: 120 calls/min per API key. If you receive a 429 response, wait for the number of seconds in the Retry-After header before calling again.',
    ].join('\n'),
    {
      hold_id: z.string().uuid().describe('The holdId from a create-hold response.'),
      start: z
        .string()
        .describe('Chosen slot start time (ISO 8601 UTC). Must be within the hold window.'),
      end: z
        .string()
        .describe('Chosen slot end time (ISO 8601 UTC). Must be within the hold window.'),
      title: z.string().min(1).describe('Meeting title.'),
      description: z
        .string()
        .optional()
        .describe('Event body/notes — agenda, dial-in link, prep instructions, etc.'),
      attendees: z.array(AttendeeSchema).optional().describe('Optional list of attendees.'),
    },
    async ({ hold_id, start, end, title, description, attendees }) => {
      try {
        return ok(
          await client.confirmHold({
            holdId: hold_id,
            start,
            end,
            title,
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
