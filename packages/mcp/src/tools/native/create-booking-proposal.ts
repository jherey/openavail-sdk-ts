import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { OpenavailClient } from '@openavail/sdk';
import { OpenavailError } from '@openavail/sdk';
import { z } from 'zod';
import { ok, toolError } from '../error.js';

export function registerCreateBookingProposal(
  server: McpServer,
  client: OpenavailClient,
  defaultOwnerEmail?: string,
): void {
  server.tool(
    'create-booking-proposal',
    [
      'Create a durable booking proposal for calendar-owner approval without creating a hold.',
      'Requires permission: create_booking_proposals.',
      'Use this for approval-mode agents. The owner approves or rejects in Openavail; if approved, Openavail books automatically when a valid candidate is still available.',
      'Broad requested_window values produce a curated review set, not exhaustive availability. Narrow the window or create a new proposal if you need a different owner review set.',
      'preferred_times may contain up to 3 exact candidate windows. Use them when you want specific owner choices preserved first.',
      'Call search-availability first when you need to explore availability before creating the owner-facing proposal.',
      'Returns proposal status, curation metadata, and candidate history. It does not return an owner review URL.',
      defaultOwnerEmail
        ? `Default owner: ${defaultOwnerEmail} (override by passing owner_email explicitly).`
        : 'owner_email is required unless the API key is user-scoped.',
    ].join('\n'),
    {
      owner_email: z.string().email().optional(),
      calendar_type: z.enum(['work', 'personal', 'other']).optional(),
      title: z.string().min(1),
      description: z.string().optional(),
      meeting_class: z.string(),
      duration_minutes: z.number().int().min(5).max(480),
      attendees: z
        .array(z.object({ email: z.string().email(), displayName: z.string().optional() }))
        .optional(),
      requested_window: z.object({ start: z.string(), end: z.string() }),
      preferred_times: z
        .array(z.object({ start: z.string(), end: z.string() }))
        .max(3)
        .optional(),
    },
    async ({
      owner_email,
      calendar_type,
      title,
      description,
      meeting_class,
      duration_minutes,
      attendees,
      requested_window,
      preferred_times,
    }) => {
      const email = owner_email ?? defaultOwnerEmail;
      try {
        return ok(
          await client.createBookingProposal({
            ...(email !== undefined && { ownerEmail: email }),
            ...(calendar_type !== undefined && { calendarType: calendar_type }),
            title,
            ...(description !== undefined && { description }),
            meetingClass: meeting_class,
            durationMinutes: duration_minutes,
            ...(attendees !== undefined && { attendees }),
            requestedWindow: requested_window,
            ...(preferred_times !== undefined && { preferredTimes: preferred_times }),
          }),
        );
      } catch (err) {
        if (err instanceof OpenavailError) return toolError(err);
        throw err;
      }
    },
  );
}
