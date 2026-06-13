import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { OpenavailClient } from '@openavail/sdk';
import { OpenavailError } from '@openavail/sdk';
import { z } from 'zod';
import { missingOwnerEmail, ok, toolError } from '../error.js';

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
      'Create a booking (calendar event) for a calendar owner. Equivalent to Google Calendar create-event.',
      'Parameter mapping from Google Calendar:',
      '  summary → title (required)',
      '  owner_email replaces calendarId — Openavail identifies owners by email, not calendar ID',
      '  meeting_class is required (e.g. "internal_sync", "customer_call") — no Google Calendar equivalent',
      "  start/end must be ISO 8601 UTC; Openavail stores all times in UTC — call list-calendars first to get the owner's timezone (returned as the timezone field), then convert before calling",
      'NOT supported in v1: location, timeZone, recurrence, calendarId',
      'calendar_type hint: if the requested type has no connected calendar, the booking silently lands on the primary calendar — check list-calendars first to confirm the type exists.',
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
      summary: z.string().min(1).describe('Event title (mapped from Google Calendar summary).'),
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
      summary,
      description,
      calendar_type,
      attendees,
    }) => {
      const email = owner_email ?? defaultOwnerEmail;
      if (!email) return missingOwnerEmail();
      try {
        return ok(
          await client.createBooking({
            ownerEmail: email,
            meetingClass: meeting_class,
            start,
            end,
            title: summary,
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
