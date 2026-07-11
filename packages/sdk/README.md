# @openavail/sdk

TypeScript client for the [Openavail](https://openavail.com) API. Zero runtime dependencies, Node 18+, native `fetch`.

## Install

```bash
npm i @openavail/sdk
```

## Quick start

```typescript
import { OpenavailClient } from '@openavail/sdk';

const client = new OpenavailClient({ apiKey: process.env.OPENAVAIL_API_KEY });

// 1. Call getOwnerContext first — timezone, setup warnings, unavailable features, and valid classes
const ctx = await client.getOwnerContext('alex@acme.com');
const tz  = ctx.calendars.find(c => c.is_primary)?.timezone ?? 'UTC';
const missingHours = ctx.setupWarnings.some(w => w.code === 'WORKING_HOURS_NOT_CONFIGURED');

// 2. Approval mode: propose a booking without reserving or writing time
const proposal = await client.createBookingProposal({
  ownerEmail:    'alex@acme.com',
  title:         'Strategy call',
  durationMinutes: 60,
  meetingClass:  'Critical',
  requestedWindow: {
    start: '2026-07-01T09:00:00Z',
    end:   '2026-07-01T17:00:00Z',
  },
  attendees: [{ email: 'alex@acme.com' }],
});

console.log('Awaiting owner approval:', proposal.proposalId);
```

**`latestEnd` is a deadline, not a start boundary.** For a 60-min meeting starting at 2 pm, set `latestEnd` to at least 3 pm — the meeting must fully end within it.

## Getting an API key

1. Log in to the Openavail dashboard as the calendar owner or org admin.
2. Go to **Agents → Register agent** and create an agent with the permissions and owner scope it needs.
3. Click **Create API key** under the agent.
4. Copy the key immediately — it is not shown again. Keys are prefixed `ak_`.

For a new approval-mode agent, grant `read_freebusy` and `create_booking_proposals`.
For a trusted auto-booking agent, grant `read_freebusy`, `create_holds`, and `create_bookings`.
Grant `read_events` only when the agent should see booking titles, descriptions, and attendees in
Openavail responses. Grant `preempt` only to trusted agents that may displace lower-priority
bookings when rules allow it.

> **Using the SDK alongside the MCP server?** The MCP server reads `OPENAVAIL_API_KEY` from its own process environment (configured via your MCP client, e.g. `~/.claude.json`). That key is not automatically available in your shell session. Set `OPENAVAIL_API_KEY` in your shell profile separately if you also want to use the SDK directly.

## Client

```typescript
const client = new OpenavailClient({
  apiKey: string,    // required
  baseUrl?: string,  // defaults to https://api.openavail.com
})
```

## Public scheduling auth

Openavail has two separate credential types:

- `OpenavailClient({ apiKey })` uses an owner-agent API key (`ak_...`). It acts inside the key owner's Openavail account and is for private owner-scoped APIs such as availability, holds, bookings, and private booking proposals.
- `OpenavailPublicSchedulingClient({ requesterCredential })` uses an optional requester credential (`rc_...`). It proves who an external requester is when asking another owner for time through `/public`. It does not grant calendar access.

Anonymous public scheduling does not need a credential. Verified requester flows use a requester credential only to identify the requester; the target owner's public scheduling policy still decides visibility, review, and auto-book behavior.

```typescript
import {
  OpenavailPublicSchedulingAdminClient,
  OpenavailPublicSchedulingClient,
} from '@openavail/sdk';

// Owner/admin setup: uses an owner-agent API key.
const admin = new OpenavailPublicSchedulingAdminClient({
  apiKey: process.env.OPENAVAIL_API_KEY!,
});

const [boundary] = await admin.listBoundaries();
const meetingTypes = boundary ? await admin.listMeetingTypes(boundary.id) : [];

// External requester flow: anonymous or requester credential.
const publicScheduling = new OpenavailPublicSchedulingClient({
  requesterCredential: process.env.OPENAVAIL_REQUESTER_CREDENTIAL,
});

const visibleTypes = await publicScheduling.listMeetingTypes('psch_abc123');

for (const type of visibleTypes) {
  console.log(type.name, type.durationMinutes, type.suggestedTimes);
}
```

## Methods

### Public scheduling

#### Anonymous free-text proposal

```typescript
const publicScheduling = new OpenavailPublicSchedulingClient();

const proposal = await publicScheduling.createBookingProposal({
  boundaryId: 'psch_abc123',
  message: 'I need 30 minutes next week to discuss a potential partnership.',
  requesterContact: { email: 'person@example.com' },
  attendees: [{ email: 'person@example.com' }],
});

console.log(proposal.statusUrl);
console.log(proposal.contactVerificationUrl); // anonymous requests confirm one contact email
```

`requesterContact` is the person submitting the request. `attendees` is the proposed attendee list
and should include the requester. If a public meeting type has an attendee cap of `1`, send only the
requester.

#### Verified requester structured proposal

```typescript
const publicScheduling = new OpenavailPublicSchedulingClient({
  requesterCredential: process.env.OPENAVAIL_REQUESTER_CREDENTIAL!,
});

const proposal = await publicScheduling.createBookingProposal({
  boundaryId: 'psch_abc123',
  publicMeetingType: 'customer_escalation',
  durationMinutes: 30,
  requestedWindow: {
    start: '2026-07-01T09:00:00Z',
    end: '2026-07-08T17:00:00Z',
  },
  requesterContact: { email: 'coordinator@acme.com', name: 'Acme Coordinator' },
  attendees: [{ email: 'person@acme.com', name: 'Person Name' }],
  reason: 'Production incident follow-up',
});
```

Use `listMeetingTypes()` first. It returns requester-visible options with `publicMeetingType`,
display `name`, optional `description`, `durationMinutes`, and `suggestedTimes`. Suggested times
are not holds; if you submit one as `requestedWindow`, Openavail rechecks that window before the
request continues.

#### Polling and withdrawal

```typescript
const status = await publicScheduling.getBookingProposalStatus('pat_public_access_token');

if (status.status === 'pending_review') {
  await publicScheduling.withdrawBookingProposal('pat_public_access_token');
}
```

When `contactVerificationUrl` is present, extract the contact verification token from that URL and
call `confirmRequesterContact(token)` after the requester confirms ownership of the email address.
The status token is public-safe: it never returns internal proposal IDs, private conflicts, audit
rows, or raw owner availability.

#### Owner/admin public scheduling setup

```typescript
const admin = new OpenavailPublicSchedulingAdminClient({
  apiKey: process.env.OPENAVAIL_API_KEY!,
});

const domain = await admin.createVerifiedDomain('acme.com');
console.log(domain.txtName, domain.txtValue);

const checked = await admin.checkVerifiedDomain(domain.id);
if (checked.status !== 'verified') {
  throw new Error('Add the DNS TXT record before creating a domain-bound identity');
}

const identity = await admin.createRequesterIdentity({
  displayName: 'Acme scheduling agent',
  verifiedDomainId: checked.id,
});

const meetingType = await admin.createMeetingType({
  boundaryId: 'public-boundary-id',
  name: 'Customer escalation',
  description: 'Urgent customer incidents that need the support lead.',
  meetingClassId: 'meeting-class-id',
  durationMinutes: 30,
  candidatePreview: true, // dashboard copy: "Show suggested times"
  status: 'published',
});
console.log(meetingType.publicMeetingType); // "customer-escalation"; derived from name

const issued = await admin.issueRequesterCredential({
  requesterIdentityId: identity.id,
  displayName: 'production',
});
console.log(issued.requesterCredential); // shown once; store it as OPENAVAIL_REQUESTER_CREDENTIAL

const credentials = await admin.listRequesterCredentials(identity.id);
await admin.revokeRequesterCredential(credentials[0]!.id);
```

`createMeetingType` accepts an optional `publicMeetingType` override, but most
owner/admin flows should pass only `name`; the SDK derives the URL/API-safe
identifier automatically.

Admin meeting type fields mirror the API, so the SDK still uses `candidatePreview`. In the
dashboard this is labeled **Show suggested times**. Suggested times are cached for requester UX and
are always rechecked before booking or approval.

### Booking proposals

#### `createBookingProposal(options)`

Create an approval-first proposal. This discovers candidates without creating a hold or calendar
event. The owner approves or rejects in the dashboard. Broad requested windows produce a curated
review set, not exhaustive availability; in beta, Openavail persists up to 20 valid proposal
candidates and returns curation metadata.

```typescript
const proposal = await client.createBookingProposal({
  ownerEmail?: string,
  calendarType?: 'work' | 'personal' | 'other',
  title: string,
  description?: string,
  meetingClass: string,
  durationMinutes: number,
  attendees?: { email: string; displayName?: string }[],
  requestedWindow: { start: string; end: string },
  preferredTimes?: { start: string; end: string }[], // max 3
});
// → BookingProposal
```

#### `getBookingProposal(proposalId)`

Fetch proposal status, candidates, owner decision, and final booking id when booked.

### Availability

#### `searchAvailability(options)`

Find candidate slots without reserving time. All times are ISO 8601 UTC.

```typescript
const result = await client.searchAvailability({
  ownerEmail?:                string,   // required unless user-scoped key
  durationMinutes:            number,
  meetingClass:               string,
  earliestStart:              string,   // earliest the meeting may begin
  latestEnd:                  string,   // latest the meeting may END (not start)
  calendarType?:              'work' | 'personal' | 'other',
  nextAvailableLookaheadHours?: number, // default 72h, max 72h
  maxResults?:                number,   // default 50, max 100
  idempotencyKey?:            string,   // auto-generated if omitted
});
// → { requestedWindow, candidates, resolvedCalendarType, warnings, pendingNotifications, candidatesTruncated }
```

#### `createHold(options)`

Reserve Openavail capacity for one exact candidate or a short negotiation window.

```typescript
const hold = await client.createHold({
  ownerEmail?: string,
  meetingClass: string,
  holdScope: 'candidate',
  candidate: { start: string, end: string },
  idempotencyKey?: string,
});
// → { holdId, holdScope, heldWindow, expiresAt, expiresInSeconds, resolvedCalendarType }
```

Use `expiresInSeconds` for hold freshness and retry decisions. `expiresAt` is an absolute UTC timestamp for logging, display, and correlation.

#### `confirmHold(options)`

Commit a hold to the calendar.

```typescript
const result = await client.confirmHold({
  holdId:          string,
  start:           string,   // must fall within the hold window
  end:             string,
  title:           string,
  description?:    string,
  attendees?:      { email: string; displayName?: string }[],
  idempotencyKey?: string,
});
// → { bookingId, correlationId, start, end, title, description, calendarType, attendees,
//     displacedCount, displacedBookings, status, pendingNotifications }
```

#### `simulate(options)`

Preview the arbitration decision without creating a hold. Pro plan only.

```typescript
const result = await client.simulate({
  ownerEmail?:  string,
  start:        string,
  end:          string,
  meetingClass: string,
  calendarType?: 'work' | 'personal' | 'other',
});
// → { decision, reason, alternatives, engineTrace, pendingNotifications }
```

### Direct booking

#### `createBooking(options)`

Skip the hold when you already know the exact slot.

```typescript
const result = await client.createBooking({
  ownerEmail?:   string,
  start:         string,
  end:           string,
  meetingClass:  string,
  title:         string,
  description?:  string,
  calendarType?: 'work' | 'personal' | 'other',
  attendees?:    { email: string; displayName?: string }[],
  idempotencyKey?: string,
});
// → BookingResult (same shape as confirmHold)
```

### Booking management

#### `listBookings(options)`

List committed bookings with cursor pagination.

```typescript
const result = await client.listBookings({
  ownerEmail?:    string,
  start?:         string,  // default: now
  end?:           string,  // default: now + 3 days
  calendarType?:  string,
  query?:         string,  // title text search
  attendeeEmail?: string,
  limit?:         number,  // max 100, default 50
  cursor?:        string,
});
// → { bookings, nextCursor, pendingNotifications }
```

#### `getBooking(bookingId)`

Fetch a single booking by ID.

#### `cancelBooking(bookingId, options?)`

Cancel a booking. Any agent with `create_bookings` permission and owner scope can cancel — not only the agent that created it.

```typescript
await client.cancelBooking(bookingId, { idempotencyKey?: string });
// → { bookingId, correlationId, pendingNotifications }
```

#### `updateBooking(bookingId, options)`

Update a booking's metadata. To change the time, cancel and rebook.

```typescript
await client.updateBooking(bookingId, {
  title?:       string,
  description?: string,
  attendees?:   { email: string; displayName?: string }[],
});
```

### Calendar & configuration

#### `getOwnerContext(ownerEmail?)`

Calendars, working hours, and meeting classes in one call. **Call this first** — it gives you the owner's timezone for UTC conversion, valid meeting class names, and working hours.

#### `listCalendars(ownerEmail)`

List connected calendars for an owner, primary first.

#### `listMeetingClasses()`

List valid meeting class names and their priority tier and preempt policy. At least one active
meeting class must exist at all times — agents cannot book without one, and the API rejects
attempts to delete the last class.

#### `getScheduleRules(options)`

Get working hours and slot interval for an owner.

### Notifications

#### `getPendingNotifications()`

Fetch all unacknowledged notifications (up to 7 days old).

#### `ackNotifications(ids)`

Acknowledge notifications by ID. Up to 100 IDs per call.

## Error handling

The SDK throws typed errors — catch by class, not status code.

```typescript
import { ArbitrationRejectedError, NoSlotsError } from '@openavail/sdk';

try {
  await client.confirmHold({ holdId, start, end, title });
} catch (err) {
  if (err instanceof ArbitrationRejectedError) {
    // err.reason      — why it was rejected
    // err.alternatives — counter-proposed slots (confirm with the same holdId)
    // err.nextAvailable — nearest free slot (use when alternatives is empty)
  }
}

try {
  await client.searchAvailability({ ... });
} catch (err) {
  if (err instanceof NoSlotsError) {
    // err.reasonCode — 'NO_FREE_SLOTS' | 'DAILY_HOURS_LIMIT' | 'OFF_DAY' | 'WORKING_HOURS' | 'HARD_BLOCK'
    // err.nextAvailable — nearest free slot within the lookahead window (undefined if none found)
    // err.nextAvailableExceedsLookahead — true when slots exist but fall beyond the lookahead window;
    //   retry with a larger nextAvailableLookaheadHours (max 72h)
  }
}
```

All errors extend `OpenavailError` and carry:
- `code` — machine-readable string (e.g. `ARBITRATION_REJECTED`)
- `httpStatus` — HTTP status code
- `pendingNotifications` — any notifications that arrived with the error response

### Error classes

| Class | When thrown |
|---|---|
| `NoSlotsError` | No available slots in the window. `.reasonCode` names why; `.nextAvailable` points to the nearest opening; `.nextAvailableExceedsLookahead` signals slots exist beyond the search window. |
| `WindowTooNarrowError` | Window is shorter than the meeting duration. `.windowDurationMinutes` and `.requiredDurationMinutes` show the gap. |
| `WorkingHoursNotConfiguredError` | Legacy compatibility for older APIs. Current availability responses return a `WORKING_HOURS_NOT_CONFIGURED` warning with slots instead of throwing this error. |
| `CalendarNotFoundError` | No calendar found for the owner |
| `LookaheadExceedsMaximumError` | `nextAvailableLookaheadHours` > 72 |
| `ArbitrationRejectedError` | Booking rejected by arbitration engine. Carries `alternatives`, `reason`, and `nextAvailable`. |
| `HoldExpiredError` | Hold TTL elapsed before confirm |
| `HoldNotFoundError` | Hold ID not found |
| `HoldAlreadyPromotedError` | Hold was already confirmed |
| `SlotOutsideHoldError` | Confirmed slot is outside the hold window |
| `BookingNotFoundError` | Booking ID not found |
| `BookingNotCancellableError` | Booking status does not allow cancellation |
| `PermissionDeniedError` | API key lacks the required permission scope |
| `OwnerScopeDeniedError` | Owner is outside the agent's allowed scope |
| `UnknownApiKeyError` | API key not recognised |
| `IdempotencyConflictError` | Idempotency key reused with different parameters |
| `IdempotencyInFlightError` | Request with this key is already in flight |

## MCP server

Prefer the MCP interface? Use [`@openavail/mcp`](https://www.npmjs.com/package/@openavail/mcp) — an stdio MCP server that wraps this SDK and exposes all tools under Google Calendar MCP-compatible names.
