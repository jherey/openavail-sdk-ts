import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { OpenavailClient } from '@openavail/sdk';
import { OpenavailError } from '@openavail/sdk';
import { z } from 'zod';
import { ok, toolError } from '../error.js';

export function registerCheckAvailability(server: McpServer, client: OpenavailClient): void {
  server.tool(
    'check-availability',
    [
      'Find available time slots for a calendar owner and create a hold. The hold reserves the slot for a short TTL (default 5 minutes) while you confirm the booking.',
      'Returns: holdId, expiresAt, available slots (start/end pairs), and pendingNotifications.',
      'After calling this tool, call confirm-hold with the holdId and a chosen slot to commit the booking.',
      'If no slots are available, returns NoSlotsError with an optional nextAvailable hint.',
    ].join('\n'),
    {
      owner_email: z.string().email().describe('Email of the calendar owner.'),
      duration_minutes: z.number().int().min(5).max(480).describe('Meeting duration in minutes.'),
      window_start: z.string().describe('Start of the search window (ISO 8601 UTC).'),
      window_end: z.string().describe('End of the search window (ISO 8601 UTC).'),
      meeting_class: z.string().describe('Meeting class name (e.g. "internal_sync").'),
      calendar_type: z
        .enum(['work', 'personal', 'other'])
        .optional()
        .describe('Target calendar type. Omit to use primary.'),
      next_available_lookahead_hours: z
        .number()
        .int()
        .min(1)
        .max(72)
        .optional()
        .describe(
          'If no slots, how many hours beyond window_end to look for the next available slot (max 72).',
        ),
    },
    async ({
      owner_email,
      duration_minutes,
      window_start,
      window_end,
      meeting_class,
      calendar_type,
      next_available_lookahead_hours,
    }) => {
      try {
        return ok(
          await client.checkAvailability({
            ownerEmail: owner_email,
            durationMinutes: duration_minutes,
            window: { start: window_start, end: window_end },
            meetingClass: meeting_class,
            ...(calendar_type !== undefined && { calendarType: calendar_type }),
            ...(next_available_lookahead_hours !== undefined && {
              nextAvailableLookaheadHours: next_available_lookahead_hours,
            }),
          }),
        );
      } catch (err) {
        if (err instanceof OpenavailError) return toolError(err);
        throw err;
      }
    },
  );
}
