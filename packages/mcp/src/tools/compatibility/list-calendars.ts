import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { OpenavailClient } from '@openavail/sdk';
import { OpenavailError } from '@openavail/sdk';
import { z } from 'zod';
import { missingOwnerEmail, ok, toolError } from '../error.js';

export function registerListCalendars(
  server: McpServer,
  client: OpenavailClient,
  defaultOwnerEmail?: string,
): void {
  server.tool(
    'list-calendars',
    [
      'List the calendars connected to a calendar owner and show which types (work, personal, other) are unavailable.',
      'Returns: calendars (connected entries with calendar_type, is_primary, timezone) and unavailable_calendar_types (types with no connected calendar).',
      'Check unavailable_calendar_types before passing calendar_type to check-availability or create-event — requesting an unavailable type silently falls back to the primary calendar.',
      'If the primary calendar is also missing or disabled, the fallback fails with CALENDAR_NOT_FOUND — there is no further fallback to other connected calendars.',
      'Use owner_email to identify the owner — there is no calendarId concept in Openavail.',
    ].join('\n'),
    {
      owner_email: z
        .string()
        .email()
        .optional()
        .describe(
          defaultOwnerEmail
            ? `Email address of the calendar owner. Defaults to ${defaultOwnerEmail}.`
            : 'Email address of the calendar owner.',
        ),
    },
    async ({ owner_email }) => {
      const email = owner_email ?? defaultOwnerEmail;
      if (!email) return missingOwnerEmail();
      try {
        const calendars = await client.listCalendars(email);
        const connectedTypes = new Set(calendars.map((c) => c.calendar_type).filter(Boolean));
        const unavailable_calendar_types = (['work', 'personal', 'other'] as const).filter(
          (t) => !connectedTypes.has(t),
        );
        return ok({ calendars, unavailable_calendar_types });
      } catch (err) {
        if (err instanceof OpenavailError) return toolError(err);
        throw err;
      }
    },
  );
}
