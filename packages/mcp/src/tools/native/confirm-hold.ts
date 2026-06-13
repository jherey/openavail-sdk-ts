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
      'Returns: bookingId, correlationId, displacedCount (bookings preempted by higher priority), pendingNotifications.',
      'If arbitration rejects the slot, ArbitrationRejectedError is returned with alternative slots when available.',
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
      attendees: z.array(AttendeeSchema).optional().describe('Optional list of attendees.'),
    },
    async ({ hold_id, start, end, title, attendees }) => {
      try {
        return ok(
          await client.confirmHold({
            holdId: hold_id,
            start,
            end,
            title,
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
