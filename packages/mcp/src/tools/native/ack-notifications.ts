import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { OpenavailClient } from '@openavail/sdk';
import { OpenavailError } from '@openavail/sdk';
import { z } from 'zod';
import { ok, toolError } from '../error.js';

export function registerAckNotifications(server: McpServer, client: OpenavailClient): void {
  server.tool(
    'ack-notifications',
    [
      'Acknowledge a batch of notifications, removing them from the pending queue.',
      'Call this after processing notifications returned by get-pending-notifications.',
      'Accepts up to 100 notification IDs in a single call — pass all IDs from a get-pending-notifications response to dismiss them in one round-trip.',
      'Notifications expire automatically after 7 days regardless of ack status, but acking promptly is good practice.',
      'Returns acked_count: the number of notifications successfully acknowledged.',
    ].join('\n'),
    {
      ids: z
        .array(z.string().uuid())
        .min(1)
        .max(100)
        .describe('Array of notification IDs to acknowledge (from get-pending-notifications).'),
    },
    async ({ ids }) => {
      try {
        return ok(await client.ackNotifications(ids));
      } catch (err) {
        if (err instanceof OpenavailError) return toolError(err);
        throw err;
      }
    },
  );
}
