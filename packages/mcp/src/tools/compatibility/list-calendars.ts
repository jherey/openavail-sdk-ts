import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { OpenavailClient } from '@openavail/sdk';
import { OpenavailError } from '@openavail/sdk';
import { z } from 'zod';
import { ok, toolError } from '../error.js';

export function registerListCalendars(server: McpServer, client: OpenavailClient): void {
  server.tool(
    'list-calendars',
    'List the calendars (work, personal, other) connected to a calendar owner. Use owner_email to identify the owner — there is no calendarId concept in Openavail.',
    { owner_email: z.string().email().describe('Email address of the calendar owner.') },
    async ({ owner_email }) => {
      try {
        return ok(await client.listCalendars(owner_email));
      } catch (err) {
        if (err instanceof OpenavailError) return toolError(err);
        throw err;
      }
    },
  );
}
