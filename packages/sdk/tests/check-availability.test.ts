import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenavailClient } from '../src/client.js';
import { CalendarNotFoundError, NoSlotsError } from '../src/errors.js';

const client = new OpenavailClient({ apiKey: 'ak_test' });

const OK_RESPONSE = {
  hold_id: 'hld-uuid',
  expires_at: '2026-07-01T09:05:00Z',
  slots: [{ start: '2026-07-01T10:00:00Z', end: '2026-07-01T11:00:00Z' }],
  pending_notifications: [],
  resolved_calendar_type: 'work',
  warnings: [],
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
  durationMinutes: 60,
  window: { start: '2026-07-01T09:00:00Z', end: '2026-07-01T17:00:00Z' },
  meetingClass: 'internal_sync',
};

describe('checkAvailability', () => {
  it('returns holdId, slots, and pendingNotifications on success', async () => {
    mockFetch(200, OK_RESPONSE);

    const result = await client.checkAvailability(BASE_OPTS);

    expect(result.holdId).toBe('hld-uuid');
    expect(result.slots).toHaveLength(1);
    expect(result.resolvedCalendarType).toBe('work');
    expect(result.pendingNotifications).toEqual([]);
  });

  it('sends request body with correct field names', async () => {
    const spy = vi.fn().mockResolvedValue({ ok: true, json: async () => OK_RESPONSE });
    vi.stubGlobal('fetch', spy);

    await client.checkAvailability(BASE_OPTS);

    const body = JSON.parse(spy.mock.calls[0]?.[1]?.body as string) as Record<string, unknown>;
    expect(body.owner_email).toBe('alex@acme.com');
    expect(body.duration_minutes).toBe(60);
    expect(body.meeting_class).toBe('internal_sync');
    expect(body.window).toEqual({ start: '2026-07-01T09:00:00Z', end: '2026-07-01T17:00:00Z' });
  });

  it('auto-injects Idempotency-Key header when not provided', async () => {
    const spy = vi.fn().mockResolvedValue({ ok: true, json: async () => OK_RESPONSE });
    vi.stubGlobal('fetch', spy);

    await client.checkAvailability(BASE_OPTS);

    const headers = spy.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers['idempotency-key']).toBeTruthy();
    expect(typeof headers['idempotency-key']).toBe('string');
  });

  it('uses caller-provided idempotencyKey when given', async () => {
    const spy = vi.fn().mockResolvedValue({ ok: true, json: async () => OK_RESPONSE });
    vi.stubGlobal('fetch', spy);

    await client.checkAvailability({ ...BASE_OPTS, idempotencyKey: 'my-key-123' });

    const headers = spy.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers['idempotency-key']).toBe('my-key-123');
  });

  it('throws NoSlotsError on NO_SLOTS_AVAILABLE', async () => {
    mockFetch(409, {
      error: { code: 'NO_SLOTS_AVAILABLE', message: 'No slots' },
      pending_notifications: [],
      resolved_calendar_type: null,
      warnings: [],
    });

    await expect(client.checkAvailability(BASE_OPTS)).rejects.toBeInstanceOf(NoSlotsError);
  });

  it('NoSlotsError carries nextAvailable when present', async () => {
    mockFetch(409, {
      error: { code: 'NO_SLOTS_AVAILABLE', message: 'No slots' },
      pending_notifications: [],
      resolved_calendar_type: 'work',
      warnings: [],
      next_available: { start: '2026-07-02T09:00:00Z', end: '2026-07-02T10:00:00Z' },
    });

    const err = (await client.checkAvailability(BASE_OPTS).catch((e) => e)) as NoSlotsError;
    expect(err).toBeInstanceOf(NoSlotsError);
    expect(err.nextAvailable).toEqual({
      start: '2026-07-02T09:00:00Z',
      end: '2026-07-02T10:00:00Z',
    });
  });

  it('NoSlotsError carries reasonCode from API reason_code', async () => {
    mockFetch(409, {
      error: { code: 'NO_SLOTS_AVAILABLE', message: 'No slots' },
      pending_notifications: [],
      resolved_calendar_type: null,
      warnings: [],
      reason_code: 'OFF_DAY',
    });

    const err = (await client.checkAvailability(BASE_OPTS).catch((e) => e)) as NoSlotsError;
    expect(err).toBeInstanceOf(NoSlotsError);
    expect(err.reasonCode).toBe('OFF_DAY');
  });

  it('NoSlotsError.reasonCode defaults to NO_FREE_SLOTS when reason_code absent', async () => {
    mockFetch(409, {
      error: { code: 'NO_SLOTS_AVAILABLE', message: 'No slots' },
      pending_notifications: [],
      resolved_calendar_type: null,
      warnings: [],
    });

    const err = (await client.checkAvailability(BASE_OPTS).catch((e) => e)) as NoSlotsError;
    expect(err).toBeInstanceOf(NoSlotsError);
    expect(err.reasonCode).toBe('NO_FREE_SLOTS');
  });

  it('NoSlotsError carries nextAvailableExceedsLookahead when API sets the flag', async () => {
    mockFetch(409, {
      error: { code: 'NO_SLOTS_AVAILABLE', message: 'No slots' },
      pending_notifications: [],
      resolved_calendar_type: null,
      warnings: [],
      next_available_exceeds_lookahead: true,
    });

    const err = (await client.checkAvailability(BASE_OPTS).catch((e) => e)) as NoSlotsError;
    expect(err).toBeInstanceOf(NoSlotsError);
    expect(err.nextAvailableExceedsLookahead).toBe(true);
  });

  it('NoSlotsError.nextAvailableExceedsLookahead defaults to false when flag absent', async () => {
    mockFetch(409, {
      error: { code: 'NO_SLOTS_AVAILABLE', message: 'No slots' },
      pending_notifications: [],
      resolved_calendar_type: null,
      warnings: [],
    });

    const err = (await client.checkAvailability(BASE_OPTS).catch((e) => e)) as NoSlotsError;
    expect(err).toBeInstanceOf(NoSlotsError);
    expect(err.nextAvailableExceedsLookahead).toBe(false);
  });

  it('throws CalendarNotFoundError on CALENDAR_NOT_FOUND', async () => {
    mockFetch(404, {
      error: { code: 'CALENDAR_NOT_FOUND', message: 'Not found' },
      pending_notifications: [],
    });

    await expect(client.checkAvailability(BASE_OPTS)).rejects.toBeInstanceOf(CalendarNotFoundError);
  });
});
