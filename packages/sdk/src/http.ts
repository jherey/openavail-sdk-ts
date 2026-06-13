import {
  ArbitrationRejectedError,
  BookingNotCancellableError,
  BookingNotFoundError,
  CalendarNotFoundError,
  HoldAlreadyPromotedError,
  HoldExpiredError,
  HoldNotFoundError,
  IdempotencyConflictError,
  IdempotencyInFlightError,
  LookaheadExceedsMaximumError,
  NoSlotsError,
  OpenavailError,
  OpenavailUnexpectedError,
  OwnerScopeDeniedError,
  PermissionDeniedError,
  SlotOutsideHoldError,
  UnknownApiKeyError,
  WorkingHoursNotConfiguredError,
} from './errors.js';
import type { AlternativeSlot, AvailabilityWarning, PendingNotification, Slot } from './types.js';

type ApiErrorBody = {
  error: { code: string; message: string; reason?: string };
  pending_notifications: PendingNotification[];
  next_available?: Slot;
  resolved_calendar_type?: string | null;
  warnings?: AvailabilityWarning[];
  alternatives?: AlternativeSlot[];
};

function throwFromErrorBody(body: ApiErrorBody, httpStatus: number): never {
  const { code, message, reason } = body.error;
  const pn = body.pending_notifications ?? [];

  switch (code) {
    case 'NO_SLOTS_AVAILABLE':
      throw new NoSlotsError(
        message,
        pn,
        body.resolved_calendar_type ?? null,
        body.warnings ?? [],
        body.next_available,
      );
    case 'WORKING_HOURS_NOT_CONFIGURED':
      throw new WorkingHoursNotConfiguredError(message, pn);
    case 'CALENDAR_NOT_FOUND':
      throw new CalendarNotFoundError(message, pn);
    case 'LOOKAHEAD_EXCEEDS_MAXIMUM':
      throw new LookaheadExceedsMaximumError(message, pn);
    case 'ARBITRATION_REJECTED':
      throw new ArbitrationRejectedError(
        message,
        pn,
        reason ?? 'UNKNOWN',
        body.alternatives ?? [],
        body.next_available,
      );
    case 'HOLD_EXPIRED':
      throw new HoldExpiredError(message, pn);
    case 'HOLD_NOT_FOUND':
      throw new HoldNotFoundError(message, pn);
    case 'HOLD_ALREADY_PROMOTED':
      throw new HoldAlreadyPromotedError(message, pn);
    case 'SLOT_OUTSIDE_HOLD':
      throw new SlotOutsideHoldError(message, pn);
    case 'BOOKING_NOT_FOUND':
      throw new BookingNotFoundError(message, pn);
    case 'BOOKING_NOT_CANCELLABLE':
      throw new BookingNotCancellableError(message, pn);
    case 'owner_scope_denied':
      throw new OwnerScopeDeniedError(message, pn);
    case 'unknown_api_key':
    case 'api_key_revoked':
    case 'agent_disabled':
      throw new UnknownApiKeyError(message);
    case 'IDEMPOTENCY_CONFLICT':
      throw new IdempotencyConflictError(message, pn);
    case 'IDEMPOTENCY_IN_FLIGHT':
      throw new IdempotencyInFlightError(message, pn);
    default:
      if (code.startsWith('permission_denied:')) {
        throw new PermissionDeniedError(message, pn);
      }
      throw new OpenavailUnexpectedError(message, code, httpStatus, pn);
  }
}

export type RequestOptions = {
  method: 'GET' | 'POST' | 'DELETE' | 'PATCH';
  path: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  idempotencyKey?: string | undefined;
  requiresIdempotency?: boolean;
};

export class HttpClient {
  readonly #apiKey: string;
  readonly #baseUrl: string;

  constructor(apiKey: string, baseUrl: string) {
    this.#apiKey = apiKey;
    this.#baseUrl = baseUrl;
  }

  async request<T>(opts: RequestOptions): Promise<T> {
    const { method, path, body, query, idempotencyKey, requiresIdempotency } = opts;

    const url = new URL(`${this.#baseUrl}/v1${path}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }

    const headers: Record<string, string> = {
      authorization: `Bearer ${this.#apiKey}`,
    };

    if (body !== undefined) {
      headers['content-type'] = 'application/json';
    }

    if (requiresIdempotency) {
      headers['idempotency-key'] = idempotencyKey ?? globalThis.crypto.randomUUID();
    }

    const res = await fetch(url.toString(), {
      method,
      headers,
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });

    const json = (await res.json()) as T | ApiErrorBody;

    if (!res.ok) {
      throwFromErrorBody(json as ApiErrorBody, res.status);
    }

    return json as T;
  }
}
