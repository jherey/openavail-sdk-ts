import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenavailClient } from '../src/client.js';

const client = new OpenavailClient({ apiKey: 'ak_test' });

const BOOKING_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: status < 400, status, json: async () => body }),
  );
}

beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
afterEach(() => vi.unstubAllGlobals());

const RAW_BOOKING_BASE = {
  booking_id: BOOKING_ID,
  correlation_id: 'b1ffcd88-8d0c-4fg9-cc7e-7ccace491b22',
  start: '2026-07-01T09:00:00Z',
  end: '2026-07-01T10:00:00Z',
  meeting_class: 'internal_sync',
  calendar_type: 'work',
  created_at: '2026-06-01T12:00:00Z',
  pending_notifications: [],
};

describe('getBooking', () => {
  it('maps description from raw response', async () => {
    mockFetch(200, {
      booking: { ...RAW_BOOKING_BASE, description: 'Dial-in: +1 555 0100' },
      pending_notifications: [],
    });

    const booking = await client.getBooking(BOOKING_ID);
    expect(booking.description).toBe('Dial-in: +1 555 0100');
  });

  it('maps null description from raw response', async () => {
    mockFetch(200, {
      booking: { ...RAW_BOOKING_BASE, description: null },
      pending_notifications: [],
    });

    const booking = await client.getBooking(BOOKING_ID);
    expect(booking.description).toBeNull();
  });

  it('leaves description undefined when not present in response', async () => {
    mockFetch(200, {
      booking: { ...RAW_BOOKING_BASE },
      pending_notifications: [],
    });

    const booking = await client.getBooking(BOOKING_ID);
    expect(booking.description).toBeUndefined();
  });

  it('maps bookingId, correlationId, start, end', async () => {
    mockFetch(200, {
      booking: RAW_BOOKING_BASE,
      pending_notifications: [],
    });

    const booking = await client.getBooking(BOOKING_ID);
    expect(booking.bookingId).toBe(BOOKING_ID);
    expect(booking.correlationId).toBe('b1ffcd88-8d0c-4fg9-cc7e-7ccace491b22');
    expect(booking.start).toBe('2026-07-01T09:00:00Z');
    expect(booking.end).toBe('2026-07-01T10:00:00Z');
  });
});
