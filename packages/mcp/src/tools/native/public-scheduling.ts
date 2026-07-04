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
    "List public meeting types visible on another owner's public scheduling boundary. This uses anonymous or requester-credential identity, not OPENAVAIL_API_KEY owner authority.",
    { public_scheduling_boundary_id: z.string().min(1) },
    async ({ public_scheduling_boundary_id }) => {
      return ok(await client.listMeetingTypes(public_scheduling_boundary_id));
    },
  );

  server.tool(
    'create-public-booking-proposal',
    'Ask another owner for time through their public scheduling boundary. Use this when you are an external requester; requester credentials prove identity but do not grant calendar access.',
    {
      public_scheduling_boundary_id: z.string().min(1),
      public_meeting_type: z.string().optional(),
      duration_minutes: z.number().int().min(5).max(480).optional(),
      requested_window: z.object({ start: z.string(), end: z.string() }).optional(),
      requester_contact: z.object({
        email: z.string().email(),
        name: z.string().optional(),
      }),
      attendees: z
        .array(z.object({ email: z.string().email(), name: z.string().optional() }))
        .min(1),
      reason: z.string().optional(),
      message: z.string().optional(),
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
    'Confirm the requester-contact email for an anonymous public booking proposal using the contact verification token delivered by the public scheduling flow.',
    { contact_verification_token: z.string().min(1) },
    async ({ contact_verification_token }) => {
      return ok(await client.confirmRequesterContact(contact_verification_token));
    },
  );

  server.tool(
    'get-public-booking-proposal-status',
    'Poll the safe public status for a public booking proposal access token. This never returns internal proposal IDs, audit history, conflicts, or owner availability.',
    { public_proposal_access_token: z.string().min(1) },
    async ({ public_proposal_access_token }) => {
      return ok(await client.getBookingProposalStatus(public_proposal_access_token));
    },
  );

  server.tool(
    'withdraw-public-booking-proposal',
    'Withdraw a pending public booking proposal using its public access token. V1 does not allow public edit, cancel, or reschedule of booked meetings.',
    { public_proposal_access_token: z.string().min(1) },
    async ({ public_proposal_access_token }) => {
      return ok(await client.withdrawBookingProposal(public_proposal_access_token));
    },
  );
}
