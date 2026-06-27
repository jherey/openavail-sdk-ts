import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { OpenavailClient } from '@openavail/sdk';
import { OpenavailError } from '@openavail/sdk';
import { z } from 'zod';
import { ok, toolError } from '../error.js';

const CandidateHoldSchema = z.object({
  owner_email: z.string().email().optional(),
  calendar_type: z.enum(['work', 'personal', 'other']).optional(),
  meeting_class: z.string(),
  hold_scope: z.literal('candidate'),
  candidate: z.object({ start: z.string(), end: z.string() }),
});

const WindowHoldSchema = z.object({
  owner_email: z.string().email().optional(),
  calendar_type: z.enum(['work', 'personal', 'other']).optional(),
  meeting_class: z.string(),
  hold_scope: z.literal('window'),
  duration_minutes: z.number().int().min(5).max(480),
  window: z.object({ start: z.string(), end: z.string() }),
});

const InputSchema = z.discriminatedUnion('hold_scope', [CandidateHoldSchema, WindowHoldSchema]);
const ToolShape = {
  owner_email: z.string().email().optional(),
  calendar_type: z.enum(['work', 'personal', 'other']).optional(),
  meeting_class: z.string(),
  hold_scope: z.enum(['candidate', 'window']),
  candidate: z.object({ start: z.string(), end: z.string() }).optional(),
  duration_minutes: z.number().int().min(5).max(480).optional(),
  window: z.object({ start: z.string(), end: z.string() }).optional(),
};

export function registerCreateHold(
  server: McpServer,
  client: OpenavailClient,
  defaultOwnerEmail?: string,
): void {
  server.tool(
    'create-hold',
    [
      'Reserve Openavail capacity with an explicit candidate or window hold.',
      'Use candidate holds when you have selected one exact slot. Use window holds for short active negotiations where options inside the window must stay stable.',
      'Candidate holds must be confirmed with the exact same start/end. Window holds may be confirmed with any valid slot inside the held window.',
      'Returns: holdId, holdScope, heldWindow, expiresAt, expiresInSeconds, and resolvedCalendarType.',
      defaultOwnerEmail
        ? `Default owner: ${defaultOwnerEmail} (override by passing owner_email explicitly).`
        : 'owner_email is required unless the API key is user-scoped.',
    ].join('\n'),
    ToolShape,
    async (rawInput) => {
      const input = InputSchema.parse(rawInput);
      const email = input.owner_email ?? defaultOwnerEmail;
      try {
        return ok(
          await client.createHold(
            input.hold_scope === 'candidate'
              ? {
                  ...(email !== undefined && { ownerEmail: email }),
                  ...(input.calendar_type !== undefined && { calendarType: input.calendar_type }),
                  meetingClass: input.meeting_class,
                  holdScope: 'candidate',
                  candidate: input.candidate,
                }
              : {
                  ...(email !== undefined && { ownerEmail: email }),
                  ...(input.calendar_type !== undefined && { calendarType: input.calendar_type }),
                  meetingClass: input.meeting_class,
                  holdScope: 'window',
                  durationMinutes: input.duration_minutes,
                  window: input.window,
                },
          ),
        );
      } catch (err) {
        if (err instanceof OpenavailError) return toolError(err);
        throw err;
      }
    },
  );
}
