import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { OpenavailClient } from '@openavail/sdk';
import { OpenavailError } from '@openavail/sdk';
import { ok, toolError } from '../error.js';

export function registerListMeetingClasses(server: McpServer, client: OpenavailClient): void {
  server.tool(
    'list-meeting-classes',
    [
      'List all active meeting classes configured for this account.',
      'Returns: name, priority, and preempt_policy for each class.',
      'Call this first to discover valid meeting_class values before calling check-availability, create-event, or simulate.',
      'meeting_class is a required parameter on those tools — passing an unknown name returns INVALID_MEETING_CLASS.',
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
