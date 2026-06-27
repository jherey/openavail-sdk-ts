import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { OpenavailClient } from '@openavail/sdk';
import { OpenavailError } from '@openavail/sdk';
import { z } from 'zod';
import { ok, toolError } from '../error.js';

export function registerSearchAvailability(
  server: McpServer,
  client: OpenavailClient,
  defaultOwnerEmail?: string,
): void {
  server.tool(
    'search-availability',
    [
      'Find candidate time slots without creating a hold.',
      'Use this when you are exploring options or preparing a user approval flow. Call create-hold only after you are ready to reserve capacity.',
      'Returns: requestedWindow, candidates with risk (free | preemptable), resolvedCalendarType, warnings, and pendingNotifications.',
      'latest_end is the latest time the meeting may END, not the latest start time.',
      'TIMEZONE: all times must be ISO 8601 UTC. Use get-agent-context for owner timezone and setup guidance.',
      defaultOwnerEmail
        ? `Default owner: ${defaultOwnerEmail} (override by passing owner_email explicitly).`
        : 'owner_email is required unless the API key is user-scoped.',
    ].join('\n'),
    {
      owner_email: z.string().email().optional(),
      duration_minutes: z.number().int().min(5).max(480),
      earliest_start: z.string(),
      latest_end: z.string(),
      meeting_class: z.string(),
      calendar_type: z.enum(['work', 'personal', 'other']).optional(),
      next_available_lookahead_hours: z.number().int().min(1).max(72).optional(),
    },
    async ({
      owner_email,
      duration_minutes,
      earliest_start,
      latest_end,
      meeting_class,
      calendar_type,
      next_available_lookahead_hours,
    }) => {
      const email = owner_email ?? defaultOwnerEmail;
      try {
        return ok(
          await client.searchAvailability({
            ...(email !== undefined && { ownerEmail: email }),
            durationMinutes: duration_minutes,
            earliestStart: earliest_start,
            latestEnd: latest_end,
            meetingClass: meeting_class,
            ...(calendar_type !== undefined && { calendarType: calendar_type }),
            ...(next_available_lookahead_hours !== undefined && {
              nextAvailableLookaheadHours: next_available_lookahead_hours,
            }),
          }),
        );
      } catch (err) {
        if (err instanceof OpenavailError) return toolError(err);
        throw err;
      }
    },
  );
}
