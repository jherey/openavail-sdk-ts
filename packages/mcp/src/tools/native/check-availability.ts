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
      'Find available time slots for a calendar owner and reserve a short-lived hold, then call confirm-hold to commit the booking.',
      'PREFER THIS PATH over create-event when: you need to show options to a user, the slot is not known in advance, or you want conflict-safe arbitration with preemption preview.',
      "SETUP: call get-owner-context first — it returns the owner's timezone, working hours, and valid meeting_class names in one call.",
      'TIMEZONE: all times must be ISO 8601 UTC. Use the timezone from get-owner-context to convert user-supplied local times to UTC before passing them here.',
      'Coming soon: user-configurable hold TTL — the 5-minute default suits fully autonomous agents; longer TTLs for human-in-the-loop slot selection are on the roadmap.',
      'Returns: holdId, expiresAt (UTC ISO string), expiresInSeconds (use this for TTL checks — avoids timezone comparison errors), slots (start/end pairs), resolvedCalendarType, and pendingNotifications.',
      'IMPORTANT: use expiresInSeconds to check if the hold is still live. Do NOT compare expiresAt against local date strings — timezone-naive comparisons will produce wrong results.',
      'pendingNotifications inline includes only notifications created in the last 60 minutes. Older unacked notifications are available via get-pending-notifications.',
      "Slots are a sliding window stepped by the owner's slot interval (default 15 min) — e.g. 10:00–11:00, 10:15–11:15, 10:30–11:30. They overlap intentionally; pick one slot and pass it to confirm-hold, do not treat the list as discrete non-overlapping blocks.",
      'Preemptable slots: some slots may include a preemptable: { occupying_class, occupying_priority } field. This means the slot is currently occupied by a lower-priority booking that your meeting class will automatically displace when you confirm. Pass preemptable slots to confirm-hold exactly like free slots — preemption is handled automatically.',
      'If no slots are available, throws NoSlotsError. The error carries reason_code (DAILY_HOURS_LIMIT or NO_FREE_SLOTS) and an optional nextAvailable: {start, end} hint pointing at the nearest free slot — use it to suggest an alternative window without a new search.',
      'calendar_type fallback: if the requested type (e.g. "work") has no connected calendar, the request silently falls back to the primary calendar. Check resolvedCalendarType in the response — if it differs from what you requested, a fallback occurred. Call list-calendars first to avoid surprises.',
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
            : "Email of the calendar owner. Optional for user-scoped API keys — omit to use the key's built-in owner.",
        ),
      duration_minutes: z.number().int().min(5).max(480).describe('Meeting duration in minutes.'),
      window_start: z.string().describe('Start of the search window (ISO 8601 UTC).'),
      window_end: z
        .string()
        .describe(
          'End of the search window (ISO 8601 UTC). This is the latest a meeting may END (not start). Example: for a 60-min meeting starting at 2pm Berlin (12:00 UTC), set window_start: "12:00:00Z" and window_end: "13:00:00Z" — the full meeting must fit within the window, not just the start time.',
        ),
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
      try {
        return ok(
          await client.checkAvailability({
            ...(email !== undefined && { ownerEmail: email }),
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
