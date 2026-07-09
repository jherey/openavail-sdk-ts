import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { OpenavailClient } from '@openavail/sdk';
import { OpenavailError } from '@openavail/sdk';
import { ok, toolError } from '../error.js';

export function registerListMeetingClasses(server: McpServer, client: OpenavailClient): void {
  server.tool(
    'list-meeting-classes',
    [
      'List all active meeting classes configured for this account.',
      'Requires permission: read_freebusy.',
      'Returns: name, description, priorityTier, and preemptPolicy for each class.',
      'Call this first to discover valid meeting_class values before calling search-availability, create-hold, create-event, or simulate.',
      'meeting_class is a required parameter on those tools — passing an unknown name returns INVALID_MEETING_CLASS.',
      'Field meanings:',
      "  description — human-readable explanation of the class purpose. Use this to infer which class fits the user's intent.",
      '  priorityTier — importance level: critical > high > normal > low. When two bookings compete for the same slot, the higher tier wins.',
      '    critical — highest importance; wins all conflicts.',
      '    high     — wins over normal and low.',
      '    normal   — standard meeting; wins over low only.',
      '    low      — lowest importance; loses to everything else.',
      '  preemptPolicy — what happens to THIS booking when something higher-priority needs its slot:',
      '    protected    — cannot be displaced regardless of incoming priority; acts as an immovable block.',
      '    reschedulable — displaced; the displaced agent receives a booking.displaced notification to reschedule.',
      '    replaceable  — displaced silently; no notification is sent to the displaced agent.',
      "To pick a class: match the user's intent against the name and description. Do not ask the user to choose. If ambiguous, use the lowest tier that fits the situation.",
      'IMPORTANT: at least one active meeting class must always exist. Agents cannot book without one. If this list is empty, no bookings are possible until the owner creates a class in the dashboard.',
    ].join('\n'),
    {},
    async () => {
      try {
        return ok({ meeting_classes: await client.listMeetingClasses() });
      } catch (err) {
        if (err instanceof OpenavailError) return toolError(err);
        throw err;
      }
    },
  );
}
