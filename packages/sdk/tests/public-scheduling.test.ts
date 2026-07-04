import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  OpenavailPublicSchedulingAdminClient,
  OpenavailPublicSchedulingClient,
} from '../src/client.js';

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: status < 400, status, json: async () => body }),
  );
}

beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
afterEach(() => vi.unstubAllGlobals());

describe('OpenavailPublicSchedulingClient', () => {
  it('lists public meeting types without owner-agent auth', async () => {
    const spy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        meeting_types: [
          {
            public_meeting_type: 'customer_escalation',
            name: 'Customer escalation',
            description: null,
            duration_minutes: 30,
            suggested_times: [
              {
                start: '2027-01-01T10:00:00.000Z',
                end: '2027-01-01T10:30:00.000Z',
                rank: 1,
                source: 'allocation',
              },
            ],
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', spy);

    const client = new OpenavailPublicSchedulingClient({ baseUrl: 'https://api.test' });
    const result = await client.listMeetingTypes('psch_123');

    expect(spy.mock.calls[0]?.[0]).toBe('https://api.test/public/schedules/psch_123/meeting-types');
    expect(spy.mock.calls[0]?.[1]?.headers).toEqual({});
    expect(result[0]?.publicMeetingType).toBe('customer_escalation');
    expect(result[0]?.suggestedTimes[0]).toMatchObject({
      start: '2027-01-01T10:00:00.000Z',
      source: 'allocation',
    });
  });

  it('encodes slash aliases as one public schedule path parameter', async () => {
    const spy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ meeting_types: [] }),
    });
    vi.stubGlobal('fetch', spy);

    const client = new OpenavailPublicSchedulingClient({ baseUrl: 'https://api.test' });
    await client.listMeetingTypes('/jane/founder-office-hours');

    expect(spy.mock.calls[0]?.[0]).toBe(
      'https://api.test/public/schedules/%2Fjane%2Ffounder-office-hours/meeting-types',
    );
  });

  it('creates anonymous free-text public proposals', async () => {
    const spy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'pending_requester_verification',
        status_url: 'https://api.test/public/booking-proposals/pat_test',
        contact_verification_url:
          'https://api.test/public/contact-verifications/pat_contact/confirm',
      }),
    });
    vi.stubGlobal('fetch', spy);

    const client = new OpenavailPublicSchedulingClient({ baseUrl: 'https://api.test' });
    const result = await client.createBookingProposal({
      boundaryId: 'psch_123',
      message: 'Can we talk next week?',
      requesterContact: { email: 'person@example.com' },
      attendees: [{ email: 'person@example.com' }],
    });

    const body = JSON.parse(spy.mock.calls[0]?.[1]?.body as string) as Record<string, unknown>;
    expect(spy.mock.calls[0]?.[0]).toBe(
      'https://api.test/public/schedules/psch_123/booking-proposals',
    );
    expect(
      (spy.mock.calls[0]?.[1]?.headers as Record<string, string>).authorization,
    ).toBeUndefined();
    expect(body.message).toBe('Can we talk next week?');
    expect(result.statusUrl).toBe('https://api.test/public/booking-proposals/pat_test');
    expect(result.contactVerificationUrl).toBe(
      'https://api.test/public/contact-verifications/pat_contact/confirm',
    );
  });

  it('uses requester credential auth separately from owner-agent API keys', async () => {
    const spy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'pending_review',
        status_url: 'https://api.test/public/booking-proposals/pat_test',
      }),
    });
    vi.stubGlobal('fetch', spy);

    const client = new OpenavailPublicSchedulingClient({
      baseUrl: 'https://api.test',
      requesterCredential: 'rc_deadbeef_secret',
    });
    await client.createBookingProposal({
      boundaryId: 'psch_123',
      publicMeetingType: 'customer_escalation',
      durationMinutes: 30,
      requestedWindow: { start: '2026-07-01T09:00:00Z', end: '2026-07-08T17:00:00Z' },
      requesterContact: { email: 'coordinator@acme.com', name: 'Acme Coordinator' },
      attendees: [{ email: 'person@acme.com', name: 'Person Name' }],
      reason: 'Production incident follow-up',
    });

    const headers = spy.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer rc_deadbeef_secret');
  });

  it('creates public proposals through slash aliases', async () => {
    const spy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'pending_requester_verification',
        status_url: 'https://api.test/public/booking-proposals/pat_test',
      }),
    });
    vi.stubGlobal('fetch', spy);

    const client = new OpenavailPublicSchedulingClient({ baseUrl: 'https://api.test' });
    await client.createBookingProposal({
      boundaryId: '/jane/founder-office-hours',
      message: 'Could we talk next week?',
      requesterContact: { email: 'person@example.com' },
      attendees: [{ email: 'person@example.com' }],
    });

    expect(spy.mock.calls[0]?.[0]).toBe(
      'https://api.test/public/schedules/%2Fjane%2Ffounder-office-hours/booking-proposals',
    );
  });

  it('polls and withdraws with public proposal access token URLs', async () => {
    mockFetch(200, { status: 'withdrawn', updated_at: '2026-07-01T00:00:00Z' });

    const client = new OpenavailPublicSchedulingClient({ baseUrl: 'https://api.test' });
    await client.confirmRequesterContact('pat_contact');
    const status = await client.getBookingProposalStatus('pat_test');
    const withdrawn = await client.withdrawBookingProposal('pat_test');

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://api.test/public/contact-verifications/pat_contact/confirm',
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://api.test/public/booking-proposals/pat_test');
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      'https://api.test/public/booking-proposals/pat_test/withdraw',
    );
    expect(status.updatedAt).toBe('2026-07-01T00:00:00Z');
    expect(withdrawn.status).toBe('withdrawn');
  });
});

describe('OpenavailPublicSchedulingAdminClient', () => {
  it('manages boundaries, meeting types, and verified domains with owner API-key auth', async () => {
    const spy = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          boundaries: [
            {
              id: 'boundary-internal',
              public_id: 'psch_123',
              calendar_owner_id: 'owner-1',
              alias_path: '/jane/office-hours',
              status: 'active',
              allow_free_text: true,
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'boundary-internal',
          public_id: 'psch_456',
          calendar_owner_id: 'owner-1',
          alias_path: null,
          status: 'active',
          allow_free_text: true,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'meeting-type-1',
          boundary_id: 'boundary-internal',
          public_meeting_type: 'customer_escalation',
          name: 'Customer escalation',
          description: null,
          duration_minutes: 30,
          visibility: 'selected_audiences',
          preempt_policy: 'protected',
          status: 'published',
          attendee_limit: 4,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          meeting_types: [
            {
              id: 'meeting-type-1',
              boundary_id: 'boundary-internal',
              public_meeting_type: 'customer_escalation',
              name: 'Customer escalation',
              description: null,
              duration_minutes: 30,
              visibility: 'selected_audiences',
              preempt_policy: 'protected',
              status: 'published',
              attendee_limit: 4,
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'domain-1',
          domain: 'acme.com',
          status: 'pending',
          txt_name: '_openavail.acme.com',
          txt_value: 'openavail-domain-verification=abc',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          verified_domains: [
            {
              id: 'domain-1',
              domain: 'acme.com',
              status: 'verified',
              txt_name: '_openavail.acme.com',
              txt_value: 'openavail-domain-verification=abc',
              verified_at: '2026-07-01T00:00:00.000Z',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'domain-1',
          domain: 'acme.com',
          status: 'verified',
          txt_name: '_openavail.acme.com',
          txt_value: 'openavail-domain-verification=abc',
          verified_at: '2026-07-01T00:00:00.000Z',
        }),
      });
    vi.stubGlobal('fetch', spy);

    const client = new OpenavailPublicSchedulingAdminClient({
      apiKey: 'oa_owner_key',
      baseUrl: 'https://api.test',
    });
    const boundaries = await client.listBoundaries();
    const boundary = await client.createBoundary({ calendarOwnerId: 'owner-1' });
    const meetingType = await client.createMeetingType({
      boundaryId: 'boundary-internal',
      name: 'Customer escalation!',
      meetingClassId: 'meeting-class-1',
      durationMinutes: 30,
      visibility: 'selected_audiences',
      audienceIds: ['audience-1'],
      attendeeLimit: 4,
      preemptPolicy: 'protected',
      status: 'published',
    });
    const meetingTypes = await client.listMeetingTypes('boundary-internal');
    const domain = await client.createVerifiedDomain('acme.com');
    const listedDomains = await client.listVerifiedDomains();
    const checkedDomain = await client.checkVerifiedDomain('domain-1');

    expect(spy.mock.calls[0]?.[0]).toBe('https://api.test/v1/public-scheduling/boundaries');
    expect(spy.mock.calls[0]?.[1]?.headers).toMatchObject({
      authorization: 'Bearer oa_owner_key',
    });
    expect(spy.mock.calls[2]?.[0]).toBe(
      'https://api.test/v1/public-scheduling/boundaries/boundary-internal/meeting-types',
    );
    expect(spy.mock.calls[3]?.[0]).toBe(
      'https://api.test/v1/public-scheduling/boundaries/boundary-internal/meeting-types',
    );
    expect(JSON.parse(spy.mock.calls[2]?.[1]?.body as string)).toMatchObject({
      public_meeting_type: 'customer-escalation',
      name: 'Customer escalation!',
      meeting_class_id: 'meeting-class-1',
      audience_ids: ['audience-1'],
      preempt_policy: 'protected',
    });
    expect(boundaries[0]?.publicId).toBe('psch_123');
    expect(boundary.publicId).toBe('psch_456');
    expect(meetingType.attendeeLimit).toBe(4);
    expect(meetingType.preemptPolicy).toBe('protected');
    expect(meetingTypes[0]?.publicMeetingType).toBe('customer_escalation');
    expect(domain.txtName).toBe('_openavail.acme.com');
    expect(listedDomains[0]?.verifiedAt).toBe('2026-07-01T00:00:00.000Z');
    expect(checkedDomain.status).toBe('verified');
  });

  it('manages requester audiences, identities, credentials, and allocations', async () => {
    const spy = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          audiences: [
            {
              id: 'audience-1',
              name: 'Customers',
              behavior: 'allow',
              members: [
                {
                  id: 'member-1',
                  verified_domain_id: 'domain-1',
                  requester_identity_id: null,
                  pending_domain: null,
                },
              ],
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'audience-2',
          name: 'Blocked',
          behavior: 'block',
          members: [],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'member-2',
          verified_domain_id: null,
          requester_identity_id: null,
          pending_domain: 'vendor.example',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'identity-1',
          display_name: 'Acme coordinator',
          verified_domain_id: 'domain-1',
          status: 'active',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          requester_identities: [
            {
              id: 'identity-1',
              display_name: 'Acme coordinator',
              verified_domain_id: 'domain-1',
              status: 'active',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'credential-1',
          credential_ref: 'rc_live_ref',
          requester_credential: 'rc_live_secret',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          requester_credentials: [
            {
              id: 'credential-1',
              requester_identity_id: 'identity-1',
              credential_ref: 'rc_live_ref',
              display_name: 'production',
              created_at: '2026-07-01T00:00:00.000Z',
              revoked_at: null,
              last_used_at: null,
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'credential-1',
          requester_identity_id: 'identity-1',
          credential_ref: 'rc_live_ref',
          display_name: 'production',
          created_at: '2026-07-01T00:00:00.000Z',
          revoked_at: '2026-07-02T00:00:00.000Z',
          last_used_at: null,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'allocation-1',
          public_meeting_type_id: 'meeting-type-1',
          label: 'Friday office hours',
          window: { start: '2026-07-03T10:00:00Z', end: '2026-07-03T11:00:00Z' },
          booking_limit: { max_per_domain: 1, window_days: 30 },
          status: 'active',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          allocations: [
            {
              id: 'allocation-1',
              public_meeting_type_id: 'meeting-type-1',
              label: 'Friday office hours',
              window: { start: '2026-07-03T10:00:00Z', end: '2026-07-03T11:00:00Z' },
              booking_limit: { max_per_domain: 1, window_days: 30 },
              status: 'active',
            },
          ],
        }),
      });
    vi.stubGlobal('fetch', spy);

    const client = new OpenavailPublicSchedulingAdminClient({
      apiKey: 'oa_owner_key',
      baseUrl: 'https://api.test',
    });
    const audiences = await client.listRequesterAudiences();
    const blocked = await client.createRequesterAudience({ name: 'Blocked', behavior: 'block' });
    const member = await client.addRequesterAudienceMember({
      audienceId: 'audience-2',
      pendingDomain: 'vendor.example',
    });
    const identity = await client.createRequesterIdentity({
      displayName: 'Acme coordinator',
      verifiedDomainId: 'domain-1',
    });
    const identities = await client.listRequesterIdentities();
    const credential = await client.issueRequesterCredential({
      requesterIdentityId: 'identity-1',
      displayName: 'production',
    });
    const credentials = await client.listRequesterCredentials('identity-1');
    const revokedCredential = await client.revokeRequesterCredential('credential-1');
    const allocation = await client.createBookableAllocation({
      publicMeetingTypeId: 'meeting-type-1',
      label: 'Friday office hours',
      window: { start: '2026-07-03T10:00:00Z', end: '2026-07-03T11:00:00Z' },
      bookingLimit: { max_per_domain: 1, window_days: 30 },
    });
    const allocations = await client.listBookableAllocations('meeting-type-1');

    expect(audiences[0]?.members[0]?.verifiedDomainId).toBe('domain-1');
    expect(blocked.behavior).toBe('block');
    expect(member.pendingDomain).toBe('vendor.example');
    expect(identity.displayName).toBe('Acme coordinator');
    expect(identities[0]?.id).toBe('identity-1');
    expect(credential.requesterCredential).toBe('rc_live_secret');
    expect(credentials[0]?.displayName).toBe('production');
    expect(revokedCredential.revokedAt).toBe('2026-07-02T00:00:00.000Z');
    expect(allocation.bookingLimit).toEqual({ max_per_domain: 1, window_days: 30 });
    expect(allocations[0]?.label).toBe('Friday office hours');
    expect(spy.mock.calls[5]?.[0]).toBe(
      'https://api.test/v1/public-scheduling/requester-identities/identity-1/credentials',
    );
    expect(spy.mock.calls[6]?.[0]).toBe(
      'https://api.test/v1/public-scheduling/requester-identities/identity-1/credentials',
    );
    expect(spy.mock.calls[7]?.[0]).toBe(
      'https://api.test/v1/public-scheduling/requester-credentials/credential-1/revoke',
    );
    expect(JSON.parse(spy.mock.calls[8]?.[1]?.body as string)).toMatchObject({
      booking_limit: { max_per_domain: 1, window_days: 30 },
    });
    expect(spy.mock.calls[9]?.[0]).toBe(
      'https://api.test/v1/public-scheduling/meeting-types/meeting-type-1/allocations',
    );
  });

  it('updates lifecycle state for boundaries, meeting types, domains, and allocations', async () => {
    const spy = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'boundary-internal',
          public_id: 'psch_123',
          calendar_owner_id: 'owner-1',
          alias_path: '/jane/office-hours',
          status: 'disabled',
          allow_free_text: false,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'meeting-type-1',
          boundary_id: 'boundary-internal',
          public_meeting_type: 'customer_escalation',
          name: 'Customer escalation',
          description: null,
          duration_minutes: 30,
          visibility: 'selected_audiences',
          preempt_policy: null,
          status: 'disabled',
          attendee_limit: 4,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => undefined,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'allocation-1',
          public_meeting_type_id: 'meeting-type-1',
          label: 'Friday office hours',
          window: { start: '2026-07-03T10:00:00Z', end: '2026-07-03T11:00:00Z' },
          booking_limit: { max_per_domain: 1, window_days: 30 },
          status: 'disabled',
        }),
      });
    vi.stubGlobal('fetch', spy);

    const client = new OpenavailPublicSchedulingAdminClient({
      apiKey: 'oa_owner_key',
      baseUrl: 'https://api.test',
    });

    const boundary = await client.updateBoundary({
      boundaryId: 'boundary-internal',
      allowFreeText: false,
      status: 'disabled',
    });
    const meetingType = await client.updateMeetingType({
      meetingTypeId: 'meeting-type-1',
      status: 'disabled',
      preemptPolicy: null,
    });
    await client.deleteVerifiedDomain('domain-1');
    const allocation = await client.updateBookableAllocation({
      allocationId: 'allocation-1',
      status: 'disabled',
      bookingLimit: { max_per_domain: 1, window_days: 30 },
    });

    expect(boundary.status).toBe('disabled');
    expect(meetingType.status).toBe('disabled');
    expect(allocation.bookingLimit).toEqual({ max_per_domain: 1, window_days: 30 });
    expect(spy.mock.calls[0]?.[0]).toBe(
      'https://api.test/v1/public-scheduling/boundaries/boundary-internal',
    );
    expect(spy.mock.calls[0]?.[1]?.method).toBe('PATCH');
    expect(JSON.parse(spy.mock.calls[0]?.[1]?.body as string)).toMatchObject({
      allow_free_text: false,
      status: 'disabled',
    });
    expect(spy.mock.calls[1]?.[0]).toBe(
      'https://api.test/v1/public-scheduling/meeting-types/meeting-type-1',
    );
    expect(JSON.parse(spy.mock.calls[1]?.[1]?.body as string)).toMatchObject({
      status: 'disabled',
      preempt_policy: null,
    });
    expect(spy.mock.calls[2]?.[0]).toBe(
      'https://api.test/v1/public-scheduling/verified-domains/domain-1',
    );
    expect(spy.mock.calls[2]?.[1]?.method).toBe('DELETE');
    expect(spy.mock.calls[3]?.[0]).toBe(
      'https://api.test/v1/public-scheduling/allocations/allocation-1',
    );
  });
});
