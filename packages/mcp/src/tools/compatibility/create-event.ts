import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { OpenavailClient } from '@openavail/sdk';
import { OpenavailError } from '@openavail/sdk';
import { z } from 'zod';
import { ok, toolError } from '../error.js';

const AttendeeSchema = z.object({
  email: z.string().email(),
  displayName: z.string().optional(),
});

export function registerCreateEvent(
  server: McpServer,
  client: OpenavailClient,
  defaultOwnerEmail?: string,
): void {
  server.tool(
    'create-event',
    [
      'Create a booking (calendar event) directly. Equivalent to Google Calendar create-event.',
      'REJECTION: if the slot is unavailable, ArbitrationRejectedError is thrown. Possible reasons: NO_CAPACITY (slot taken), WORKING_HOURS (outside working hours), OFF_DAY (non-working day), SACRED_MEETING (immovable protected booking), MAX_DAILY_HOURS (daily limit reached), PERMISSION_DENIED_PREEMPT (no preemption permission). alternatives[] contains contextually close slots (same day or same hour-of-day on next business day); if no comparable slot exists, alternatives[] is empty — use next_available for the absolute nearest opening.',
      'PREFER check-availability + confirm-hold when: you need to show slot options to a user, you want a preemption preview, or you are not certain the slot is free. Use create-event only for direct writes where the slot is already known and confirmed by the user.',
      'owner_email replaces calendarId — Openavail identifies owners by email, not calendar ID.',
      'meeting_class is required — call list-meeting-classes first to see valid names, priorities, and descriptions.',
      'TIMEZONE: start/end must be ISO 8601 UTC. Call list-calendars first to get the owner\'s IANA timezone (e.g. "Europe/Berlin"), convert the user\'s local times to UTC, then pass them here. All timestamps in responses are also UTC.',
      'Preemption: if this booking displaces a lower-priority existing booking, the response includes displaced_bookings with title/start/end/meeting_class, and the calendar owner is automatically notified by email.',
      'calendar_type fallback: if the requested type (e.g. "work") has no connected calendar, the booking silently lands on the primary calendar. The response always includes calendar_type showing which type was actually used.',
      'PAST_TIME: start must be in the future. If start is in the past, the API returns 422 with code PAST_TIME — do not retry with the same past time.',
      'RATE LIMIT: 120 calls/min per API key. If you receive a 429 response, wait for the number of seconds in the Retry-After header before calling again.',
    ].join('\n'),
    {
      owner_email: z
        .string()
        .email()
        .optional()
        .describe(
          defaultOwnerEmail
            ? `Email of the calendar owner who will host the event. Defaults to ${defaultOwnerEmail}.`
            : 'Email of the calendar owner who will host the event.',
        ),
      meeting_class: z
        .string()
        .describe('Meeting class name (e.g. "internal_sync"). Must be configured in Openavail.'),
      start: z.string().describe('Event start time — ISO 8601 UTC (e.g. 2026-07-01T09:00:00Z).'),
      end: z.string().describe('Event end time — ISO 8601 UTC.'),
      title: z.string().min(1).describe('Event title.'),
      description: z
        .string()
        .optional()
        .describe('Event body/notes — agenda, dial-in link, prep instructions, etc.'),
      calendar_type: z
        .enum(['work', 'personal', 'other'])
        .optional()
        .describe('Target calendar type hint. Omit to use the primary calendar.'),
      attendees: z
        .array(AttendeeSchema)
        .optional()
        .describe('List of attendees. Each must have an email; displayName is optional.'),
    },
    async ({
      owner_email,
      meeting_class,
      start,
      end,
      title,
      description,
      calendar_type,
      attendees,
    }) => {
      const email = owner_email ?? defaultOwnerEmail;
      try {
        return ok(
          await client.createBooking({
            ...(email !== undefined && { ownerEmail: email }),
            meetingClass: meeting_class,
            start,
            end,
            title,
            ...(description !== undefined && { description }),
            ...(calendar_type !== undefined && { calendarType: calendar_type }),
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
