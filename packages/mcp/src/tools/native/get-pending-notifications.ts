import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { OpenavailClient } from '@openavail/sdk';
import { OpenavailError } from '@openavail/sdk';
import { ok, toolError } from '../error.js';

export function registerGetPendingNotifications(server: McpServer, client: OpenavailClient): void {
  server.tool(
    'get-pending-notifications',
    [
      'Fetch all unacknowledged notifications for this agent.',
      'Notifications are generated when a booking is displaced (booking.displaced) or cancelled by another agent (booking.cancelled).',
      'Notifications persist for 7 days. Calling this tool does NOT consume them — they will reappear until you call ack-notifications with their IDs.',
      'Booking responses include pendingNotifications inline, but ONLY for notifications created in the last 60 minutes. Call this tool at session start to retrieve any older unacked notifications from previous sessions.',
      'Workflow: call this tool at session start → process each notification → call ack-notifications with the IDs you have handled.',
    ].join('\n'),
    {},
    async () => {
      try {
        return ok({ notifications: await client.getPendingNotifications() });
      } catch (err) {
        if (err instanceof OpenavailError) return toolError(err);
        throw err;
      }
    },
  );
}
