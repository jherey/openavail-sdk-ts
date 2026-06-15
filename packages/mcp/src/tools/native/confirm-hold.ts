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
      'Confirm a hold created by check-availability, promoting it to a committed booking.',
      'The chosen start/end slot must fall within the hold window. The hold expires after a short TTL (currently 5 minutes) — call this promptly after check-availability. Configurable TTL is coming soon.',
      'Returns: bookingId, correlationId, displacedCount (bookings preempted by higher priority), pendingNotifications (last 60 minutes only — call get-pending-notifications for the full backlog).',
      'If arbitration rejects the slot, ArbitrationRejectedError is returned. alternatives[] contains contextually close slots (same day or same hour-of-day on the next business day). If no comparable slot exists (e.g. 22:00 request when working hours end at 17:00), alternatives[] is empty — use next_available from the error for the absolute nearest opening instead.',
      'PAST_TIME: the chosen start must be in the future at the time of this call. If the hold was created for a future slot that has since passed (e.g. a long user pause), the API returns 422 with code PAST_TIME. Re-run check-availability with a fresh window.',
    ].join('\n'),
    {
      hold_id: z.string().uuid().describe('The holdId from a check-availability response.'),
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
