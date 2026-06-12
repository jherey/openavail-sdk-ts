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
    'List the calendars (work, personal, other) connected to a calendar owner. Use owner_email to identify the owner — there is no calendarId concept in Openavail.',
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
        return ok(await client.listCalendars(email));
      } catch (err) {
        if (err instanceof OpenavailError) return toolError(err);
        throw err;
      }
    },
  );
}
