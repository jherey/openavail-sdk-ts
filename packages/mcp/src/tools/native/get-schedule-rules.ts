import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { OpenavailClient } from '@openavail/sdk';
import { OpenavailError } from '@openavail/sdk';
import { z } from 'zod';
import { missingOwnerEmail, ok, toolError } from '../error.js';

export function registerGetScheduleRules(
  server: McpServer,
  client: OpenavailClient,
  defaultOwnerEmail?: string,
): void {
  server.tool(
    'get-schedule-rules',
    [
      'Fetch the working hours, slot interval, and daily meeting limit for a calendar owner.',
      'Call this before building time-picker UIs or before attempting bookings in an unfamiliar time window — it lets you reason about valid booking times without trial-and-error rejections.',
      'working_hours: array of recurring weekly windows (days 0=Sun…6=Sat, HH:MM start/end, IANA timezone).',
      'slot_interval_minutes: granularity for slot snapping (e.g. 15 → slots at :00, :15, :30, :45).',
      'max_daily_meeting_hours: null means no daily cap.',
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
    },
    async ({ owner_email }) => {
      const email = owner_email ?? defaultOwnerEmail;
      if (!email) return missingOwnerEmail();
      try {
        return ok(await client.getScheduleRules({ ownerEmail: email }));
      } catch (err) {
        if (err instanceof OpenavailError) return toolError(err);
        throw err;
      }
    },
  );
}
