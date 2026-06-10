import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { OpenavailClient } from '@openavail/sdk';
import { OpenavailError } from '@openavail/sdk';
import { ok, toolError } from '../error.js';

export function registerGetPendingNotifications(server: McpServer, client: OpenavailClient): void {
  server.tool(
    'get-pending-notifications',
    [
      'Fetch and acknowledge all pending notifications for this agent.',
      'Notifications are generated when another agent cancels one of your bookings (booking.cancelled), or when a booking is displaced by a higher-priority one.',
      'Calling this tool marks the notifications as delivered — they will not reappear on the next call.',
      'Most booking/cancellation responses also include pendingNotifications inline, so you only need this tool when polling explicitly.',
    ].join('\n'),
    {},
    async () => {
      try {
        return ok(await client.getPendingNotifications());
      } catch (err) {
        if (err instanceof OpenavailError) return toolError(err);
        throw err;
      }
    },
  );
}
