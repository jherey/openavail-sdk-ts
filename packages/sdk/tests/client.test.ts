import { describe, expect, it } from 'vitest';
import { OpenavailClient } from '../src/client.js';

describe('OpenavailClient constructor', () => {
  it('throws when apiKey is empty string', () => {
    expect(() => new OpenavailClient({ apiKey: '' })).toThrow('apiKey is required');
  });

  it('accepts a valid apiKey', () => {
    expect(() => new OpenavailClient({ apiKey: 'ak_test' })).not.toThrow();
  });

  it('strips trailing slash from baseUrl', async () => {
    // The internal baseUrl should not have a trailing slash.
    // Verify by observing the URL in a fetch call.
    const _fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    const { vi } = await import('vitest');
    const spy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ notifications: [], pending_notifications: [] }),
    });
    vi.stubGlobal('fetch', spy);

    const client = new OpenavailClient({ apiKey: 'ak_test', baseUrl: 'https://api.example.com/' });
    await client.getPendingNotifications();

    const url = spy.mock.calls[0]?.[0] as string;
    expect(url).toBe('https://api.example.com/v1/notifications/pending');

    vi.unstubAllGlobals();
  });
});
