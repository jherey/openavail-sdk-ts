import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenavailClient } from '../src/client.js';
import { ArbitrationRejectedError, HoldExpiredError } from '../src/errors.js';

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
  holdId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  start: '2026-07-01T09:00:00Z',
  end: '2026-07-01T10:00:00Z',
  title: 'Sprint planning',
};

describe('confirmHold', () => {
  it('returns bookingId, correlationId, displacedCount on success', async () => {
    mockFetch(200, OK_RESPONSE);

    const result = await client.confirmHold(BASE_OPTS);

    expect(result.bookingId).toBe('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
    expect(result.correlationId).toBe('b1ffcd88-8d0c-4fg9-cc7e-7ccace491b22');
    expect(result.displacedCount).toBe(0);
  });

  it('defaults displacedCount to 0 when absent from response', async () => {
    mockFetch(200, { ...OK_RESPONSE, displaced_count: undefined });
    const result = await client.confirmHold(BASE_OPTS);
    expect(result.displacedCount).toBe(0);
  });

  it('throws ArbitrationRejectedError with alternatives on 409', async () => {
    const alternatives = [
      { start: '2026-07-02T09:00:00Z', end: '2026-07-02T10:00:00Z', reason_code: 'NEXT' },
    ];
    mockFetch(409, {
      error: { code: 'ARBITRATION_REJECTED', message: 'Rejected', reason: 'NO_CAPACITY' },
      pending_notifications: [],
      alternatives,
    });

    const err = (await client.confirmHold(BASE_OPTS).catch((e) => e)) as ArbitrationRejectedError;
    expect(err).toBeInstanceOf(ArbitrationRejectedError);
    expect(err.reason).toBe('NO_CAPACITY');
    expect(err.alternatives).toEqual(alternatives);
  });

  it('throws HoldExpiredError on 410', async () => {
    mockFetch(410, {
      error: { code: 'HOLD_EXPIRED', message: 'Expired' },
      pending_notifications: [],
    });

    await expect(client.confirmHold(BASE_OPTS)).rejects.toBeInstanceOf(HoldExpiredError);
  });

  it('auto-injects Idempotency-Key header', async () => {
    const spy = vi.fn().mockResolvedValue({ ok: true, json: async () => OK_RESPONSE });
    vi.stubGlobal('fetch', spy);

    await client.confirmHold(BASE_OPTS);

    const headers = spy.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers['idempotency-key']).toBeTruthy();
  });
});
