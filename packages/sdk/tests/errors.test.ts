import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenavailClient } from '../src/client.js';
import {
  ArbitrationRejectedError,
  BookingNotCancellableError,
  BookingNotFoundError,
  CalendarNotFoundError,
  HoldExpiredError,
  IdempotencyConflictError,
  NoSlotsError,
  type OpenavailError,
  OpenavailUnexpectedError,
  OwnerScopeDeniedError,
  PermissionDeniedError,
} from '../src/errors.js';
import type { PendingNotification } from '../src/types.js';

const NOTIFICATIONS: PendingNotification[] = [
  { id: 'n1', kind: 'booking.cancelled', payload: {}, createdAt: '2026-01-01T00:00:00Z' },
];

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    }),
  );
}

const client = new OpenavailClient({ apiKey: 'ak_test' });

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('pending_notifications surfaced on thrown errors', () => {
  it('NoSlotsError carries pendingNotifications from error response', async () => {
    mockFetch(409, {
      error: { code: 'NO_SLOTS_AVAILABLE', message: 'No slots' },
      pending_notifications: NOTIFICATIONS,
      resolved_calendar_type: 'work',
      warnings: [],
    });

    const err = await client
      .checkAvailability({
        ownerEmail: 'alex@acme.com',
        durationMinutes: 30,
        window: { start: '2026-07-01T09:00:00Z', end: '2026-07-01T17:00:00Z' },
        meetingClass: 'internal_sync',
      })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(NoSlotsError);
    expect((err as NoSlotsError).pendingNotifications).toEqual(NOTIFICATIONS);
  });

  it('ArbitrationRejectedError carries pendingNotifications and alternatives', async () => {
    const alternatives = [
      { start: '2026-07-02T09:00:00Z', end: '2026-07-02T10:00:00Z', reason_code: 'NEXT_AVAILABLE' },
    ];
    mockFetch(409, {
      error: { code: 'ARBITRATION_REJECTED', message: 'Rejected', reason: 'NO_CAPACITY' },
      pending_notifications: NOTIFICATIONS,
      alternatives,
    });

    const err = await client
      .confirmHold({
        holdId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        start: '2026-07-01T09:00:00Z',
        end: '2026-07-01T10:00:00Z',
        title: 'Test',
      })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ArbitrationRejectedError);
    expect((err as ArbitrationRejectedError).pendingNotifications).toEqual(NOTIFICATIONS);
    expect((err as ArbitrationRejectedError).alternatives).toEqual(alternatives);
  });

  it('CalendarNotFoundError carries pendingNotifications', async () => {
    mockFetch(404, {
      error: { code: 'CALENDAR_NOT_FOUND', message: 'Not found' },
      pending_notifications: NOTIFICATIONS,
    });

    const err = await client
      .checkAvailability({
        ownerEmail: 'nobody@acme.com',
        durationMinutes: 30,
        window: { start: '2026-07-01T09:00:00Z', end: '2026-07-01T17:00:00Z' },
        meetingClass: 'internal_sync',
      })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(CalendarNotFoundError);
    expect((err as OpenavailError).pendingNotifications).toEqual(NOTIFICATIONS);
  });

  it('BookingNotFoundError carries pendingNotifications', async () => {
    mockFetch(404, {
      error: { code: 'BOOKING_NOT_FOUND', message: 'Not found' },
      pending_notifications: NOTIFICATIONS,
    });
    const err = await client.cancelBooking('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11').catch((e) => e);
    expect(err).toBeInstanceOf(BookingNotFoundError);
    expect((err as OpenavailError).pendingNotifications).toEqual(NOTIFICATIONS);
  });

  it('BookingNotCancellableError carries pendingNotifications', async () => {
    mockFetch(409, {
      error: { code: 'BOOKING_NOT_CANCELLABLE', message: 'Not cancellable' },
      pending_notifications: NOTIFICATIONS,
    });
    const err = await client.cancelBooking('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11').catch((e) => e);
    expect(err).toBeInstanceOf(BookingNotCancellableError);
    expect((err as OpenavailError).pendingNotifications).toEqual(NOTIFICATIONS);
  });

  it('HoldExpiredError carries pendingNotifications', async () => {
    mockFetch(410, {
      error: { code: 'HOLD_EXPIRED', message: 'Expired' },
      pending_notifications: NOTIFICATIONS,
    });
    const err = await client
      .confirmHold({
        holdId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        start: '2026-07-01T09:00:00Z',
        end: '2026-07-01T10:00:00Z',
        title: 'Test',
      })
      .catch((e) => e);
    expect(err).toBeInstanceOf(HoldExpiredError);
    expect((err as OpenavailError).pendingNotifications).toEqual(NOTIFICATIONS);
  });

  it('OwnerScopeDeniedError is thrown on owner_scope_denied', async () => {
    mockFetch(403, {
      error: { code: 'owner_scope_denied', message: 'Denied' },
      pending_notifications: [],
    });
    const err = await client.listBookings({ ownerEmail: 'other@example.com' }).catch((e) => e);
    expect(err).toBeInstanceOf(OwnerScopeDeniedError);
  });

  it('PermissionDeniedError is thrown on permission_denied:* codes', async () => {
    mockFetch(403, {
      error: { code: 'permission_denied:create_bookings', message: 'Denied' },
      pending_notifications: [],
    });
    const err = await client
      .createBooking({
        ownerEmail: 'alex@acme.com',
        start: '2026-07-01T09:00:00Z',
        end: '2026-07-01T10:00:00Z',
        meetingClass: 'internal_sync',
        title: 'Test',
      })
      .catch((e) => e);
    expect(err).toBeInstanceOf(PermissionDeniedError);
  });

  it('IdempotencyConflictError is thrown on IDEMPOTENCY_CONFLICT', async () => {
    mockFetch(422, {
      error: { code: 'IDEMPOTENCY_CONFLICT', message: 'Conflict' },
      pending_notifications: [],
    });
    const err = await client
      .createBooking({
        ownerEmail: 'alex@acme.com',
        start: '2026-07-01T09:00:00Z',
        end: '2026-07-01T10:00:00Z',
        meetingClass: 'internal_sync',
        title: 'Test',
        idempotencyKey: 'my-key',
      })
      .catch((e) => e);
    expect(err).toBeInstanceOf(IdempotencyConflictError);
  });

  it('OpenavailUnexpectedError is thrown for unknown error codes', async () => {
    mockFetch(500, {
      error: { code: 'UNKNOWN_INTERNAL', message: 'Something broke' },
      pending_notifications: NOTIFICATIONS,
    });
    const err = await client.getPendingNotifications().catch((e) => e);
    expect(err).toBeInstanceOf(OpenavailUnexpectedError);
    expect((err as OpenavailError).pendingNotifications).toEqual(NOTIFICATIONS);
  });
});
