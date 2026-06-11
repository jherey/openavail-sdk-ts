import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { OpenavailClient } from '@openavail/sdk';
import { OpenavailError } from '@openavail/sdk';
import { z } from 'zod';
import { ok, toolError } from '../error.js';

export function registerSimulate(server: McpServer, client: OpenavailClient): void {
  server.tool(
    'simulate',
    [
      'Simulate the arbitration decision for a hypothetical booking without creating any holds or commits.',
      'Returns: decision (Accept/Reject/Preempt/CounterPropose), optional reason, optional alternative slots, and an engineTrace for debugging.',
      'Use this to preview whether a booking would succeed before presenting options to a user.',
    ].join('\n'),
    {
      owner_email: z.string().email().describe('Email of the calendar owner.'),
      start: z.string().describe('Hypothetical meeting start (ISO 8601 UTC).'),
      end: z.string().describe('Hypothetical meeting end (ISO 8601 UTC).'),
      meeting_class: z.string().describe('Meeting class name.'),
      calendar_type: z
        .enum(['work', 'personal', 'other'])
        .optional()
        .describe('Target calendar type hint.'),
    },
    async ({ owner_email, start, end, meeting_class, calendar_type }) => {
      try {
        return ok(
          await client.simulate({
            ownerEmail: owner_email,
            start,
            end,
            meetingClass: meeting_class,
            ...(calendar_type !== undefined && { calendarType: calendar_type }),
          }),
        );
      } catch (err) {
        if (err instanceof OpenavailError) return toolError(err);
        throw err;
      }
    },
  );
}
