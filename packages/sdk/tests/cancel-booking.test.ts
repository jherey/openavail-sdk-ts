import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenavailClient } from '../src/client.js';
import { BookingNotCancellableError, BookingNotFoundError } from '../src/errors.js';

const client = new OpenavailClient({ apiKey: 'ak_test' });

const BOOKING_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

const OK_RESPONSE = {
  booking_id: BOOKING_ID,
  correlation_id: 'b1ffcd88-8d0c-4fg9-cc7e-7ccace491b22',
  pending_notifications: [],
};

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: status < 400, status, json: async () => body }),
  );
}

beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
afterEach(() => vi.unstubAllGlobals());

describe('cancelBooking', () => {
  it('returns bookingId and correlationId on success', async () => {
    mockFetch(200, OK_RESPONSE);

    const result = await client.cancelBooking(BOOKING_ID);
    expect(result.bookingId).toBe(BOOKING_ID);
    expect(result.correlationId).toBeDefined();
  });

  it('sends DELETE to /v1/bookings/:id', async () => {
    const spy = vi.fn().mockResolvedValue({ ok: true, json: async () => OK_RESPONSE });
    vi.stubGlobal('fetch', spy);

    await client.cancelBooking(BOOKING_ID);

    expect(spy.mock.calls[0]?.[0]).toContain(`/v1/bookings/${BOOKING_ID}`);
    expect(spy.mock.calls[0]?.[1]?.method).toBe('DELETE');
  });

  it('auto-injects Idempotency-Key header', async () => {
    const spy = vi.fn().mockResolvedValue({ ok: true, json: async () => OK_RESPONSE });
    vi.stubGlobal('fetch', spy);

    await client.cancelBooking(BOOKING_ID);

    const headers = spy.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers['idempotency-key']).toBeTruthy();
  });

  it('uses caller-provided idempotencyKey', async () => {
    const spy = vi.fn().mockResolvedValue({ ok: true, json: async () => OK_RESPONSE });
    vi.stubGlobal('fetch', spy);

    await client.cancelBooking(BOOKING_ID, { idempotencyKey: 'cancel-key-1' });

    const headers = spy.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers['idempotency-key']).toBe('cancel-key-1');
  });

  it('does not send Content-Type header on DELETE requests', async () => {
    const spy = vi.fn().mockResolvedValue({ ok: true, json: async () => OK_RESPONSE });
    vi.stubGlobal('fetch', spy);

    await client.cancelBooking(BOOKING_ID);

    const headers = spy.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers['content-type']).toBeUndefined();
  });

  it('returns bookingId, correlationId, and pendingNotifications on success', async () => {
    mockFetch(200, OK_RESPONSE);

    const result = await client.cancelBooking(BOOKING_ID);
    expect(result.bookingId).toBe(BOOKING_ID);
    expect(result.correlationId).toBeDefined();
    expect(Array.isArray(result.pendingNotifications)).toBe(true);
  });

  it('throws BookingNotFoundError on BOOKING_NOT_FOUND', async () => {
    mockFetch(404, {
      error: { code: 'BOOKING_NOT_FOUND', message: 'Not found' },
      pending_notifications: [],
    });
    await expect(client.cancelBooking(BOOKING_ID)).rejects.toBeInstanceOf(BookingNotFoundError);
  });

  it('throws BookingNotCancellableError on BOOKING_NOT_CANCELLABLE', async () => {
    mockFetch(409, {
      error: { code: 'BOOKING_NOT_CANCELLABLE', message: 'Not cancellable' },
      pending_notifications: [],
    });
    await expect(client.cancelBooking(BOOKING_ID)).rejects.toBeInstanceOf(
      BookingNotCancellableError,
    );
  });
});
