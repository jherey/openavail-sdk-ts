import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { OpenavailPublicSchedulingClient } from '@openavail/sdk';
import { z } from 'zod';
import { ok } from '../error.js';

export function registerPublicSchedulingTools(
  server: McpServer,
  client: OpenavailPublicSchedulingClient,
): void {
  server.tool(
    'list-public-meeting-types',
    "List public meeting types visible on another owner's public scheduling boundary. This uses anonymous or requester-credential identity, not OPENAVAIL_API_KEY owner authority. Results may include suggestedTimes; they are suggestions, not holds.",
    {
      public_scheduling_boundary_id: z
        .string()
        .min(1)
        .describe('Public scheduling id or alias path, for example psch_123 or /jane/demo.'),
    },
    async ({ public_scheduling_boundary_id }) => {
      return ok(await client.listMeetingTypes(public_scheduling_boundary_id));
    },
  );

  server.tool(
    'create-public-booking-proposal',
    'Ask another owner for time through their public scheduling boundary. Use this when you are an external requester; requester credentials prove identity but do not grant calendar access. requester_contact is the submitter, attendees should include the requester, and suggested requested windows are rechecked before the request continues.',
    {
      public_scheduling_boundary_id: z
        .string()
        .min(1)
        .describe('Public scheduling id or alias path, for example psch_123 or /jane/demo.'),
      public_meeting_type: z
        .string()
        .optional()
        .describe('Identifier returned by list-public-meeting-types. Omit for free-text requests.'),
      duration_minutes: z
        .number()
        .int()
        .min(5)
        .max(480)
        .optional()
        .describe('Meeting length from the selected public meeting type.'),
      requested_window: z
        .object({ start: z.string(), end: z.string() })
        .optional()
        .describe('UTC window to request. For suggested times, pass the suggested start/end.'),
      requester_contact: z.object({
        email: z.string().email().describe('Email of the person submitting the request.'),
        name: z.string().optional().describe('Optional submitter display name.'),
      }),
      attendees: z
        .array(
          z.object({
            email: z.string().email(),
            name: z.string().optional(),
          }),
        )
        .min(1)
        .describe('Proposed attendees. Include requester_contact.email in this list.'),
      reason: z.string().optional().describe('Context for a structured public meeting type.'),
      message: z.string().optional().describe('Required context for free-text requests.'),
    },
    async ({
      public_scheduling_boundary_id,
      public_meeting_type,
      duration_minutes,
      requested_window,
      requester_contact,
      attendees,
      reason,
      message,
    }) => {
      return ok(
        await client.createBookingProposal({
          boundaryId: public_scheduling_boundary_id,
          ...(public_meeting_type !== undefined && { publicMeetingType: public_meeting_type }),
          ...(duration_minutes !== undefined && { durationMinutes: duration_minutes }),
          ...(requested_window !== undefined && { requestedWindow: requested_window }),
          requesterContact:
            requester_contact.name !== undefined
              ? { email: requester_contact.email, name: requester_contact.name }
              : { email: requester_contact.email },
          attendees: attendees.map((attendee) =>
            attendee.name !== undefined
              ? { email: attendee.email, name: attendee.name }
              : { email: attendee.email },
          ),
          ...(reason !== undefined && { reason }),
          ...(message !== undefined && { message }),
        }),
      );
    },
  );

  server.tool(
    'confirm-public-requester-contact',
    'Confirm the requester-contact email for an anonymous public booking proposal using the token from the contact verification URL.',
    {
      contact_verification_token: z
        .string()
        .min(1)
        .describe('Token from /public/contact-verifications/{token}/confirm.'),
    },
    async ({ contact_verification_token }) => {
      return ok(await client.confirmRequesterContact(contact_verification_token));
    },
  );

  server.tool(
    'get-public-booking-proposal-status',
    'Poll the safe public status for a public booking proposal access token. This never returns internal proposal IDs, audit history, conflicts, or owner availability.',
    {
      public_proposal_access_token: z
        .string()
        .min(1)
        .describe('Token from /public/booking-proposals/{token}.'),
    },
    async ({ public_proposal_access_token }) => {
      return ok(await client.getBookingProposalStatus(public_proposal_access_token));
    },
  );

  server.tool(
    'withdraw-public-booking-proposal',
    'Withdraw a pending public booking proposal using its public access token. V1 does not allow public edit, cancel, or reschedule of booked meetings.',
    {
      public_proposal_access_token: z
        .string()
        .min(1)
        .describe('Token from /public/booking-proposals/{token}.'),
    },
    async ({ public_proposal_access_token }) => {
      return ok(await client.withdrawBookingProposal(public_proposal_access_token));
    },
  );
}
