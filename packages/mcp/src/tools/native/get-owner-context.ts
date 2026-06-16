import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { OpenavailClient } from '@openavail/sdk';
import { OpenavailError } from '@openavail/sdk';
import { z } from 'zod';
import { ok, toolError } from '../error.js';

export function registerGetOwnerContext(
  server: McpServer,
  client: OpenavailClient,
  defaultOwnerEmail?: string,
): void {
  server.tool(
    'get-owner-context',
    [
      'Fetch calendars, schedule rules, and meeting classes for a calendar owner in a single call.',
      'Call this FIRST at session start before any booking. It gives you everything needed to make a valid booking:',
      '  - calendars: list of connected calendars with their type (work/personal/other) and IANA timezone',
      '  - schedule_rules: working hours, slot interval, and daily meeting limit',
      '  - meeting_classes: valid meeting class names with descriptions and priorities',
      'Use the timezone from the primary calendar to convert user-supplied local times to UTC for all subsequent calls.',
      'Use a meeting_class name from meeting_classes — passing an unlisted name to check-availability or create-event will return INVALID_MEETING_CLASS.',
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
    },
    async ({ owner_email }) => {
      // Pass email if provided; omit to let the server resolve from the key's owner scope.
      const email = owner_email ?? defaultOwnerEmail;
      try {
        return ok(await client.getOwnerContext(email));
      } catch (err) {
        if (err instanceof OpenavailError) return toolError(err);
        throw err;
      }
    },
  );
}
