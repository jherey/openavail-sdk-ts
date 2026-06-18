import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { OpenavailClient } from '@openavail/sdk';
import { OpenavailError } from '@openavail/sdk';
import { z } from 'zod';
import { ok, toolError } from '../error.js';

export function registerCheckAvailability(
  server: McpServer,
  client: OpenavailClient,
  defaultOwnerEmail?: string,
): void {
  server.tool(
    'check-availability',
    [
      'Find available time slots for a calendar owner and reserve a short-lived hold, then call confirm-hold to commit the booking.',
      "SETUP: call get-agent-context first if you haven't this session — it returns the owner's timezone, working hours, and valid meeting_class names in one call. Skipping it risks timezone errors and invalid meeting class names.",
      'NO SLOTS: if no slots are available, throws NoSlotsError with reasonCode (NO_FREE_SLOTS | DAILY_HOURS_LIMIT | OFF_DAY | WORKING_HOURS | HARD_BLOCK). When nextAvailable is present, retry there. When nextAvailableExceedsLookahead is true, slots exist beyond the lookahead window — retry with a larger next_available_lookahead_hours. WINDOW_TOO_NARROW (422) is thrown when the window is shorter than the requested duration — widen the window.',
      'latest_end IS A DEADLINE, NOT A START BOUNDARY: latest_end is the latest time the meeting may END. For a 60-min meeting you want to start at 2pm, set latest_end to 3pm (not 2pm).',
      'Returns: holdId, expiresInSeconds (use this for TTL checks — it is relative and timezone-safe), slots (start/end pairs), resolvedCalendarType, and pendingNotifications. Ignore expiresAt — it is a UTC ISO string that will appear incorrect in non-UTC timezones.',
      'PREFER THIS PATH over create-event when: you need to show options to a user, the slot is not known in advance, or you want conflict-safe arbitration with preemption preview.',
      'TIMEZONE: all times must be ISO 8601 UTC. Use the timezone from get-agent-context to convert user-supplied local times to UTC before passing them here.',
      "Slots are a sliding window stepped by the owner's slot interval (default 15 min) — e.g. 10:00–11:00, 10:15–11:15, 10:30–11:30. They overlap intentionally; pick one slot and pass it to confirm-hold, do not treat the list as discrete non-overlapping blocks.",
      'Preemptable slots: some slots may include a preemptable: { occupying_class, occupying_priority } field. This means the slot is currently occupied by a lower-priority booking that your meeting class will automatically displace when you confirm. Pass preemptable slots to confirm-hold exactly like free slots — preemption is handled automatically.',
      'pendingNotifications inline includes only notifications created in the last 60 minutes. Older unacked notifications are available via get-pending-notifications.',
      'PAST_TIME: if earliest_start is in the past, the API returns 422 with code PAST_TIME. Always pass a future earliest_start. Do not retry with a past time — always advance it.',
      'calendar_type fallback: if the requested type (e.g. "work") has no connected calendar, the request silently falls back to the primary calendar. Check resolvedCalendarType in the response — if it differs from what you requested, a fallback occurred.',
      'FRIDAY-EVENING QUERIES: a 24h or 48h lookahead starting Friday evening lands on the weekend and returns no nextAvailable hint. Use 72h to ensure Monday business hours are within the window (this is now the default). If nextAvailableExceedsLookahead is true, increase next_available_lookahead_hours and retry.',
      'RATE LIMIT: 300 calls/min per API key. If you receive a 429 response, wait for the number of seconds in the Retry-After header before calling again.',
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
      earliest_start: z.string().describe('Earliest time the meeting may start (ISO 8601 UTC).'),
      latest_end: z
        .string()
        .describe(
          'Latest time the meeting may END — not start (ISO 8601 UTC). Example: for a 60-min meeting starting at 2pm Berlin (12:00 UTC), set earliest_start: "12:00:00Z" and latest_end: "13:00:00Z" — the full meeting must fit within this boundary, not just the start time.',
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
          'How many hours beyond latest_end to search for the next available slot when no slots are found. Default: 72h, max: 72h. Pass this to receive a nextAvailable hint in NoSlotsError.',
        ),
    },
    async ({
      owner_email,
      duration_minutes,
      earliest_start,
      latest_end,
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
            earliestStart: earliest_start,
            latestEnd: latest_end,
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
