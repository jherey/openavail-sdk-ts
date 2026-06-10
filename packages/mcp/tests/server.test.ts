import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { OpenavailClient } from '@openavail/sdk';
import {
  ArbitrationRejectedError,
  type Booking,
  type BookingResult,
  type CancelBookingResult,
  type CheckAvailabilityResult,
  type ListBookingsResult,
  type OwnerCalendar,
  type PendingNotification,
} from '@openavail/sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildServer } from '../src/server.js';

function mockClient(overrides: Partial<OpenavailClient> = {}): OpenavailClient {
  return {
    checkAvailability: vi.fn(),
    confirmHold: vi.fn(),
    createBooking: vi.fn(),
    simulate: vi.fn(),
    getPendingNotifications: vi.fn(),
    listCalendars: vi.fn(),
    listBookings: vi.fn(),
    getBooking: vi.fn(),
    cancelBooking: vi.fn(),
    updateBooking: vi.fn(),
    ...overrides,
  } as unknown as OpenavailClient;
}

const NO_NOTIFICATIONS: PendingNotification[] = [];

const BOOKING_RESULT: BookingResult = {
  bookingId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  correlationId: 'b1ffcd88-8d0c-5fg9-cc7e-7ccace491b22',
  displacedCount: 0,
  pendingNotifications: NO_NOTIFICATIONS,
};

const BOOKING: Booking = {
  bookingId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  correlationId: 'b1ffcd88-8d0c-5fg9-cc7e-7ccace491b22',
  start: '2026-07-01T09:00:00.000Z',
  end: '2026-07-01T10:00:00.000Z',
  meetingClass: 'internal_sync',
  calendarType: 'work',
  createdAt: '2026-06-01T12:00:00.000Z',
};

const CANCEL_RESULT: CancelBookingResult = {
  bookingId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  correlationId: 'b1ffcd88-8d0c-5fg9-cc7e-7ccace491b22',
  pendingNotifications: NO_NOTIFICATIONS,
};

const LIST_RESULT: ListBookingsResult = {
  bookings: [BOOKING],
  nextCursor: null,
  pendingNotifications: NO_NOTIFICATIONS,
};

const CALENDARS: OwnerCalendar[] = [{ calendar_type: 'work', is_primary: true }];

const AVAILABILITY_RESULT: CheckAvailabilityResult = {
  holdId: 'c2ffde77-7e1d-4eh8-dd8f-8ddbdf582c33',
  expiresAt: '2026-07-01T09:05:00.000Z',
  slots: [{ start: '2026-07-01T09:00:00.000Z', end: '2026-07-01T10:00:00.000Z' }],
  pendingNotifications: NO_NOTIFICATIONS,
  resolvedCalendarType: 'work',
  warnings: [],
};

async function setupServer(client: OpenavailClient) {
  const mcpServer = buildServer(client);
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
  const mcpClient = new Client({ name: 'test', version: '0.0.0' });
  await mcpServer.connect(serverTransport);
  await mcpClient.connect(clientTransport);
  return { mcpClient, mcpServer };
}

describe('MCP server tools', () => {
  let client: OpenavailClient;
  let mcpClient: Client;

  beforeEach(async () => {
    client = mockClient({
      createBooking: vi.fn().mockResolvedValue(BOOKING_RESULT),
      cancelBooking: vi.fn().mockResolvedValue(CANCEL_RESULT),
      listBookings: vi.fn().mockResolvedValue(LIST_RESULT),
      listCalendars: vi.fn().mockResolvedValue(CALENDARS),
      getBooking: vi.fn().mockResolvedValue(BOOKING),
      updateBooking: vi.fn().mockResolvedValue(BOOKING_RESULT),
      checkAvailability: vi.fn().mockResolvedValue(AVAILABILITY_RESULT),
      getPendingNotifications: vi.fn().mockResolvedValue(NO_NOTIFICATIONS),
    });
    ({ mcpClient } = await setupServer(client));
  });

  afterEach(async () => {
    await mcpClient.close();
  });

  // ── create-event ─────────────────────────────────────────────────────────────

  describe('create-event', () => {
    it('maps summary → title and calls client.createBooking', async () => {
      const res = await mcpClient.callTool({
        name: 'create-event',
        arguments: {
          owner_email: 'owner@example.com',
          meeting_class: 'internal_sync',
          start: '2026-07-01T09:00:00Z',
          end: '2026-07-01T10:00:00Z',
          summary: 'Sprint planning',
        },
      });

      expect(vi.mocked(client.createBooking)).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerEmail: 'owner@example.com',
          meetingClass: 'internal_sync',
          title: 'Sprint planning',
          start: '2026-07-01T09:00:00Z',
          end: '2026-07-01T10:00:00Z',
        }),
      );
      expect(res.isError).toBeFalsy();
    });
  });

  // ── list-events ───────────────────────────────────────────────────────────────

  describe('list-events', () => {
    it('maps timeMin/timeMax → start/end', async () => {
      await mcpClient.callTool({
        name: 'list-events',
        arguments: {
          owner_email: 'owner@example.com',
          timeMin: '2026-07-01T00:00:00Z',
          timeMax: '2026-07-07T23:59:59Z',
        },
      });

      expect(vi.mocked(client.listBookings)).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerEmail: 'owner@example.com',
          start: '2026-07-01T00:00:00Z',
          end: '2026-07-07T23:59:59Z',
        }),
      );
    });

    it('omits start/end when timeMin/timeMax are not provided', async () => {
      await mcpClient.callTool({
        name: 'list-events',
        arguments: { owner_email: 'owner@example.com' },
      });

      const call = vi.mocked(client.listBookings).mock.calls[0]?.[0];
      expect(call).toBeDefined();
      expect('start' in (call ?? {})).toBe(false);
      expect('end' in (call ?? {})).toBe(false);
    });
  });

  // ── delete-event ──────────────────────────────────────────────────────────────

  describe('delete-event', () => {
    it('calls client.cancelBooking with the eventId', async () => {
      const res = await mcpClient.callTool({
        name: 'delete-event',
        arguments: { eventId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' },
      });

      expect(vi.mocked(client.cancelBooking)).toHaveBeenCalledWith(
        'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      );
      expect(res.isError).toBeFalsy();
    });
  });

  // ── ArbitrationRejectedError surfaces alternatives ────────────────────────────

  describe('error handling', () => {
    it('surfaces alternatives in tool error content when ArbitrationRejectedError is thrown', async () => {
      const alternatives = [
        { start: '2026-07-02T09:00:00Z', end: '2026-07-02T10:00:00Z', reason_code: 'ALTERNATIVE' },
      ];
      vi.mocked(client.createBooking).mockRejectedValue(
        new ArbitrationRejectedError('Slot taken', [], 'NO_CAPACITY', alternatives),
      );

      const res = await mcpClient.callTool({
        name: 'create-event',
        arguments: {
          owner_email: 'owner@example.com',
          meeting_class: 'internal_sync',
          start: '2026-07-01T09:00:00Z',
          end: '2026-07-01T10:00:00Z',
          summary: 'Sprint planning',
        },
      });

      expect(res.isError).toBe(true);
      const content = res.content as { type: string; text: string }[];
      const body = JSON.parse(content[0]?.text ?? '{}') as {
        error: string;
        alternatives: typeof alternatives;
      };
      expect(body.error).toBe('ARBITRATION_REJECTED');
      expect(body.alternatives).toEqual(alternatives);
    });

    it('list-calendars returns structured response', async () => {
      const res = await mcpClient.callTool({
        name: 'list-calendars',
        arguments: { owner_email: 'owner@example.com' },
      });
      expect(res.isError).toBeFalsy();
      const content = res.content as { type: string; text: string }[];
      const body = JSON.parse(content[0]?.text ?? '[]') as OwnerCalendar[];
      expect(body[0]?.is_primary).toBe(true);
    });
  });

  // ── check-availability ────────────────────────────────────────────────────────

  describe('check-availability', () => {
    it('passes all params to client.checkAvailability', async () => {
      const res = await mcpClient.callTool({
        name: 'check-availability',
        arguments: {
          owner_email: 'owner@example.com',
          duration_minutes: 60,
          window_start: '2026-07-01T08:00:00Z',
          window_end: '2026-07-01T18:00:00Z',
          meeting_class: 'internal_sync',
        },
      });

      expect(vi.mocked(client.checkAvailability)).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerEmail: 'owner@example.com',
          durationMinutes: 60,
          window: { start: '2026-07-01T08:00:00Z', end: '2026-07-01T18:00:00Z' },
          meetingClass: 'internal_sync',
        }),
      );
      expect(res.isError).toBeFalsy();
    });
  });

  // ── get-pending-notifications ────────────────────────────────────────────────

  describe('get-pending-notifications', () => {
    it('calls client.getPendingNotifications and returns the result', async () => {
      const res = await mcpClient.callTool({ name: 'get-pending-notifications', arguments: {} });
      expect(vi.mocked(client.getPendingNotifications)).toHaveBeenCalled();
      expect(res.isError).toBeFalsy();
    });
  });
});

// ── bin.ts: OPENAVAIL_API_KEY guard ─────────────────────────────────────────

describe('bin.ts', () => {
  it('exits with code 1 when OPENAVAIL_API_KEY is not set', async () => {
    const savedKey = process.env['OPENAVAIL_API_KEY'];
    delete process.env['OPENAVAIL_API_KEY'];

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit(${code ?? 'undefined'})`);
    });

    vi.resetModules();
    await expect(import('../src/bin.js')).rejects.toThrow('process.exit(1)');

    exitSpy.mockRestore();
    if (savedKey !== undefined) process.env['OPENAVAIL_API_KEY'] = savedKey;
  });
});
