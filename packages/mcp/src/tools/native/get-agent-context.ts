import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { OpenavailClient } from '@openavail/sdk';
import { OpenavailError } from '@openavail/sdk';
import { z } from 'zod';
import { ok, toolError } from '../error.js';

export function registerGetAgentContext(
  server: McpServer,
  client: OpenavailClient,
  defaultOwnerEmail?: string,
): void {
  server.tool(
    'get-agent-context',
    [
      '# START HERE — call this before any other tool.',
      'Requires permission: read_freebusy.',
      'Returns everything you need to make a valid booking in a single call:',
      '  - calendars: connected calendars with their type (work/personal/other) and IANA timezone',
      '  - schedule_rules: working hours, slot interval, and daily meeting limit',
      '  - meeting_classes: valid meeting class names with descriptions, priorityTier (critical|high|normal|low), and preemptPolicy',
      '  - setup_warnings: non-blocking setup issues such as WORKING_HOURS_NOT_CONFIGURED',
      '  - unavailable_features: plan-gated features this account should not call, such as simulation on free accounts',
      'Use the timezone from the primary calendar to convert user-supplied local times to UTC for all subsequent calls.',
      'If setup_warnings includes WORKING_HOURS_NOT_CONFIGURED, bookings are still allowed but Openavail is not enforcing preferred working windows. Confirm before booking evenings, weekends, or unusual local times.',
      'Use a meeting_class name from meeting_classes — passing an unlisted name to search-availability, create-hold, or create-event will return INVALID_MEETING_CLASS.',
      "To pick a meeting class: match the user's intent against the name and description. Do not ask the user to choose. If ambiguous, use the lowest priorityTier that fits the situation.",
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
