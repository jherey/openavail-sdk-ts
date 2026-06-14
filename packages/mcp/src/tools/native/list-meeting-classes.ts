import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { OpenavailClient } from '@openavail/sdk';
import { OpenavailError } from '@openavail/sdk';
import { ok, toolError } from '../error.js';

export function registerListMeetingClasses(server: McpServer, client: OpenavailClient): void {
  server.tool(
    'list-meeting-classes',
    [
      'List all active meeting classes configured for this account.',
      'Returns: name, description, priority, and preemptPolicy for each class.',
      'Call this first to discover valid meeting_class values before calling check-availability, create-event, or simulate.',
      'meeting_class is a required parameter on those tools — passing an unknown name returns INVALID_MEETING_CLASS.',
      'Field meanings:',
      '  description — human-readable explanation of the class purpose (e.g. "External call with a customer. Cannot be displaced."). Use this to advise the user which class fits their booking.',
      '  priority — integer; higher value wins when two bookings compete for the same slot (e.g. 100 beats 10).',
      '  preemptPolicy — what happens when a higher-priority booking displaces this one:',
      '    soft   — displaced silently; the displaced agent receives a booking.displaced notification to reschedule.',
      '    hard   — displaced and the displaced agent is notified, but no reschedule is attempted automatically.',
      '    strict — cannot be displaced regardless of incoming priority; acts as an immovable block.',
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
