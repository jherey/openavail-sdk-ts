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

// 1. Find available slots and reserve a hold
const { holdId, slots } = await client.checkAvailability({
  ownerEmail: 'alex@acme.com',
  durationMinutes: 60,
  meetingClass: 'external_customer_call',
  window: {
    start: '2026-07-01T09:00:00Z',
    end: '2026-07-01T17:00:00Z',
  },
});

// 2. Confirm the hold → committed booking
const booking = await client.confirmHold({
  holdId,
  start: slots[0].start,
  end: slots[0].end,
  title: 'Strategy call',
  attendees: [{ email: 'alex@acme.com' }],
});

console.log('Booked:', booking.bookingId);
```

## Getting an API key

1. Log in to the Openavail dashboard.
2. Go to **Agents → Register agent** and create an agent.
3. Click **Create API key** under the agent.
4. Copy the key immediately — it is not shown again.

## Client

```typescript
const client = new OpenavailClient({
  apiKey: string,    // required
  baseUrl?: string,  // defaults to https://api.openavail.com
})
```

## Methods

### Availability

#### `checkAvailability(options)`

Find available slots and reserve a hold. All times are ISO 8601 UTC.

```typescript
const result = await client.checkAvailability({
  ownerEmail: 'alex@acme.com',       // required unless user-scoped key
  durationMinutes: 60,
  meetingClass: 'external_customer_call',
  window: { start: '...', end: '...' },
  calendarType?: 'work' | 'personal' | 'other',
  nextAvailableLookaheadHours?: number,  // up to 72; enables nextAvailable hint on NoSlotsError
  idempotencyKey?: string,               // auto-generated if omitted
});
// → { holdId, expiresAt, expiresInSeconds, slots, resolvedCalendarType, warnings, pendingNotifications }
```

#### `confirmHold(options)`

Commit a hold to the calendar.

```typescript
const result = await client.confirmHold({
  holdId: '...',
  start: '2026-07-01T14:00:00Z',
  end: '2026-07-01T15:00:00Z',
  title: 'Strategy call',
  description?: string,
  attendees?: [{ email: string, displayName?: string }],
  idempotencyKey?: string,
});
// → { bookingId, correlationId, displacedCount, displacedBookings, pendingNotifications, start, end, title, calendarType, status }
```

#### `simulate(options)`

Preview the arbitration decision without creating a hold. Pro plan only.

```typescript
const result = await client.simulate({
  ownerEmail?: string,
  start: '...',
  end: '...',
  meetingClass: '...',
  calendarType?: 'work' | 'personal' | 'other',
});
// → { decision, reason, alternatives, engineTrace, pendingNotifications }
```

### Direct booking

#### `createBooking(options)`

Skip the hold when you already know the exact slot.

```typescript
const result = await client.createBooking({
  ownerEmail?: string,
  start: '...',
  end: '...',
  meetingClass: '...',
  title: '...',
  description?: string,
  calendarType?: 'work' | 'personal' | 'other',
  attendees?: [{ email: string, displayName?: string }],
  idempotencyKey?: string,
});
// → BookingResult (same shape as confirmHold)
```

### Booking management

#### `listBookings(options)`

List committed bookings with cursor pagination.

```typescript
const result = await client.listBookings({
  ownerEmail?: string,
  start?: string,          // default: now
  end?: string,            // default: now + 3 days
  calendarType?: string,
  query?: string,          // title text search
  attendeeEmail?: string,
  limit?: number,          // max 100, default 50
  cursor?: string,
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

Update a booking's metadata. Metadata only — to change the time, cancel and rebook.

```typescript
await client.updateBooking(bookingId, {
  title?: string,
  description?: string,
  attendees?: [{ email: string, displayName?: string }],
});
```

### Calendar & configuration

#### `listCalendars(ownerEmail)`

List connected calendars for an owner, primary first.

#### `getOwnerContext(ownerEmail?)`

Calendars, working hours, and meeting classes in one call. Use this at session start.

#### `listMeetingClasses()`

List valid meeting class names and their priority/preempt policy.

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
import {
  ArbitrationRejectedError,
  NoSlotsError,
  BookingNotFoundError,
} from '@openavail/sdk';

try {
  await client.confirmHold({ holdId, start, end, title });
} catch (err) {
  if (err instanceof ArbitrationRejectedError) {
    // err.alternatives — counter-proposed slots (may be empty)
    // err.reason — human-readable reason
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
| `NoSlotsError` | No available slots in the requested window |
| `WorkingHoursNotConfiguredError` | Owner has no working hours set |
| `CalendarNotFoundError` | No calendar found for the owner |
| `LookaheadExceedsMaximumError` | `nextAvailableLookaheadHours` > 72 |
| `ArbitrationRejectedError` | Booking rejected by arbitration engine (carries `alternatives`) |
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
