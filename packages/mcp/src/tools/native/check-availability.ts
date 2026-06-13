import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { OpenavailClient } from '@openavail/sdk';
import { OpenavailError } from '@openavail/sdk';
import { z } from 'zod';
import { missingOwnerEmail, ok, toolError } from '../error.js';

export function registerCheckAvailability(
  server: McpServer,
  client: OpenavailClient,
  defaultOwnerEmail?: string,
): void {
  server.tool(
    'check-availability',
    [
      'Find available time slots for a calendar owner and create a hold. The hold reserves the slot for a short TTL (currently 5 minutes) while you confirm the booking.',
      'Coming soon: user-configurable hold TTL — the 5-minute default suits fully autonomous agents; longer TTLs for human-in-the-loop slot selection are on the roadmap.',
      'Returns: holdId, expiresAt, available slots (start/end pairs), and pendingNotifications.',
      "Slots are a sliding window stepped by the owner's slot interval (default 15 min) — e.g. 10:00–11:00, 10:15–11:15, 10:30–11:30. They overlap intentionally; pick one slot and pass it to confirm-hold, do not treat the list as discrete non-overlapping blocks.",
      'After calling this tool, call confirm-hold with the holdId and a chosen slot to commit the booking.',
      'If no slots are available, throws NoSlotsError. The error carries reason_code (DAILY_HOURS_LIMIT or NO_FREE_SLOTS) and an optional nextAvailable: {start, end} hint pointing at the nearest free slot — use it to suggest an alternative window without a new search.',
      'calendar_type hint: if the requested type (e.g. "work") has no connected calendar, the request silently falls back to the primary calendar — resolvedCalendarType in the response tells you which type was actually used. Call list-calendars first to see which types are available.',
      defaultOwnerEmail
        ? `Default owner: ${defaultOwnerEmail} (set via OPENAVAIL_OWNER_EMAIL — override by passing owner_email explicitly).`
        : 'owner_email is required.',
    ].join('\n'),
    {
      owner_email: z
        .string()
        .email()
        .optional()
        .describe(
          defaultOwnerEmail
            ? `Email of the calendar owner. Defaults to ${defaultOwnerEmail}.`
            : 'Email of the calendar owner.',
        ),
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
      const email = owner_email ?? defaultOwnerEmail;
      if (!email) return missingOwnerEmail();
      try {
        return ok(
          await client.checkAvailability({
            ownerEmail: email,
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
