import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenavailClient } from '../src/client.js';
import { ArbitrationRejectedError } from '../src/errors.js';

const client = new OpenavailClient({ apiKey: 'ak_test' });

const OK_RESPONSE = {
  booking_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
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

const BASE_OPTS = {
  ownerEmail: 'alex@acme.com',
  start: '2026-07-01T09:00:00Z',
  end: '2026-07-01T10:00:00Z',
  meetingClass: 'internal_sync',
  title: 'Deep work',
};

describe('createBooking', () => {
  it('returns bookingId and correlationId on success', async () => {
    mockFetch(200, OK_RESPONSE);

    const result = await client.createBooking(BASE_OPTS);
    expect(result.bookingId).toBe('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
    expect(result.correlationId).toBe('b1ffcd88-8d0c-4fg9-cc7e-7ccace491b22');
  });

  it('sends correct field names in request body', async () => {
    const spy = vi.fn().mockResolvedValue({ ok: true, json: async () => OK_RESPONSE });
    vi.stubGlobal('fetch', spy);

    await client.createBooking(BASE_OPTS);

    const body = JSON.parse(spy.mock.calls[0]?.[1]?.body as string) as Record<string, unknown>;
    expect(body.owner_email).toBe('alex@acme.com');
    expect(body.meeting_class).toBe('internal_sync');
    expect(body.title).toBe('Deep work');
  });

  it('round-trips description in request and response', async () => {
    const spy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ...OK_RESPONSE, description: 'Agenda: discuss roadmap' }),
    });
    vi.stubGlobal('fetch', spy);

    const result = await client.createBooking({
      ...BASE_OPTS,
      description: 'Agenda: discuss roadmap',
    });

    const body = JSON.parse(spy.mock.calls[0]?.[1]?.body as string) as Record<string, unknown>;
    expect(body.description).toBe('Agenda: discuss roadmap');
    expect(result.description).toBe('Agenda: discuss roadmap');
  });

  it('throws ArbitrationRejectedError on 409 with alternatives', async () => {
    const alternatives = [
      { start: '2026-07-02T09:00:00Z', end: '2026-07-02T10:00:00Z', reason_code: 'NEXT' },
    ];
    mockFetch(409, {
      error: { code: 'ARBITRATION_REJECTED', message: 'Rejected', reason: 'NO_CAPACITY' },
      pending_notifications: [],
      alternatives,
    });

    const err = (await client.createBooking(BASE_OPTS).catch((e) => e)) as ArbitrationRejectedError;
    expect(err).toBeInstanceOf(ArbitrationRejectedError);
    expect(err.alternatives).toEqual(alternatives);
  });
});
