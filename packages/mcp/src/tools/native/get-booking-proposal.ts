import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { OpenavailClient } from '@openavail/sdk';
import { OpenavailError } from '@openavail/sdk';
import { z } from 'zod';
import { ok, toolError } from '../error.js';

export function registerGetBookingProposal(server: McpServer, client: OpenavailClient): void {
  server.tool(
    'get-booking-proposal',
    [
      'Requires create_booking_proposals. Fetch a private owner-scoped booking proposal by proposal_id.',
      'Use this after create-booking-proposal to check owner decision, candidates, approval status, and final booking_id.',
      'This is not a public requester status tool; public requesters should use get-public-booking-proposal-status with the public proposal access token.',
    ].join('\n'),
    {
      proposal_id: z.string().uuid(),
    },
    async ({ proposal_id }) => {
      try {
        return ok(await client.getBookingProposal(proposal_id));
      } catch (err) {
        if (err instanceof OpenavailError) return toolError(err);
        throw err;
      }
    },
  );
}
