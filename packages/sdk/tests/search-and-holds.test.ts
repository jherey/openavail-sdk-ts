import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenavailClient } from '../src/client.js';

const client = new OpenavailClient({ apiKey: 'ak_test' });

beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
afterEach(() => vi.unstubAllGlobals());

const SEARCH_OPTS = {
  ownerEmail: 'alex@acme.com',
  durationMinutes: 60,
  earliestStart: '2026-07-01T09:00:00Z',
  latestEnd: '2026-07-01T17:00:00Z',
  meetingClass: 'internal_sync',
};

describe('searchAvailability', () => {
  it('calls /availability/search and maps candidates', async () => {
    const spy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        requested_window: {
          start: '2026-07-01T09:00:00Z',
          end: '2026-07-01T17:00:00Z',
        },
        candidates: [{ start: '2026-07-01T10:00:00Z', end: '2026-07-01T11:00:00Z', risk: 'free' }],
        pending_notifications: [],
        resolved_calendar_type: 'work',
        warnings: [],
      }),
    });
    vi.stubGlobal('fetch', spy);

    const result = await client.searchAvailability(SEARCH_OPTS);

    expect(result.candidates[0]?.risk).toBe('free');
    expect(result.requestedWindow.start).toBe('2026-07-01T09:00:00Z');
    expect(spy.mock.calls[0]?.[0]).toBe('https://api.openavail.com/v1/availability/search');
  });
});

describe('createHold', () => {
  it('calls /holds with a candidate hold payload', async () => {
    const spy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        hold_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        hold_scope: 'candidate',
        held_window: {
          start: '2026-07-01T10:00:00Z',
          end: '2026-07-01T11:00:00Z',
        },
        expires_at: '2026-07-01T09:05:00Z',
        expires_in_seconds: 300,
        resolved_calendar_type: 'work',
      }),
    });
    vi.stubGlobal('fetch', spy);

    const result = await client.createHold({
      ownerEmail: 'alex@acme.com',
      meetingClass: 'internal_sync',
      holdScope: 'candidate',
      candidate: { start: '2026-07-01T10:00:00Z', end: '2026-07-01T11:00:00Z' },
    });

    const body = JSON.parse(spy.mock.calls[0]?.[1]?.body as string) as Record<string, unknown>;
    expect(spy.mock.calls[0]?.[0]).toBe('https://api.openavail.com/v1/holds');
    expect(body.hold_scope).toBe('candidate');
    expect(result.holdId).toBe('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
    expect(result.holdScope).toBe('candidate');
  });
});
