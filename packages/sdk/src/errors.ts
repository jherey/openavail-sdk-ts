import type {
  AlternativeSlot,
  AvailabilityWarning,
  PendingNotification,
  RejectionReason,
  Slot,
} from './types.js';

export class OpenavailError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly pendingNotifications: PendingNotification[];

  constructor(
    message: string,
    code: string,
    httpStatus: number,
    pendingNotifications: PendingNotification[] = [],
  ) {
    super(message);
    this.name = 'OpenavailError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.pendingNotifications = pendingNotifications;
  }
}

// ── Availability errors ───────────────────────────────────────────────────────

export class NoSlotsError extends OpenavailError {
  readonly nextAvailable: Slot | undefined;
  readonly resolvedCalendarType: string | null;
  readonly warnings: AvailabilityWarning[];

  constructor(
    message: string,
    pendingNotifications: PendingNotification[],
    resolvedCalendarType: string | null,
    warnings: AvailabilityWarning[],
    nextAvailable?: Slot,
  ) {
    super(message, 'NO_SLOTS_AVAILABLE', 409, pendingNotifications);
    this.name = 'NoSlotsError';
    this.nextAvailable = nextAvailable;
    this.resolvedCalendarType = resolvedCalendarType;
    this.warnings = warnings;
  }
}

export class WorkingHoursNotConfiguredError extends OpenavailError {
  constructor(message: string, pendingNotifications: PendingNotification[]) {
    super(message, 'WORKING_HOURS_NOT_CONFIGURED', 409, pendingNotifications);
    this.name = 'WorkingHoursNotConfiguredError';
  }
}

export class CalendarNotFoundError extends OpenavailError {
  constructor(message: string, pendingNotifications: PendingNotification[]) {
    super(message, 'CALENDAR_NOT_FOUND', 404, pendingNotifications);
    this.name = 'CalendarNotFoundError';
  }
}

export class LookaheadExceedsMaximumError extends OpenavailError {
  constructor(message: string, pendingNotifications: PendingNotification[]) {
    super(message, 'LOOKAHEAD_EXCEEDS_MAXIMUM', 400, pendingNotifications);
    this.name = 'LookaheadExceedsMaximumError';
  }
}

// ── Booking errors ────────────────────────────────────────────────────────────

export class ArbitrationRejectedError extends OpenavailError {
  readonly reason: RejectionReason;
  readonly alternatives: AlternativeSlot[];
  readonly nextAvailable: Slot | undefined;

  constructor(
    message: string,
    pendingNotifications: PendingNotification[],
    reason: RejectionReason,
    alternatives: AlternativeSlot[],
    nextAvailable?: Slot,
  ) {
    super(message, 'ARBITRATION_REJECTED', 409, pendingNotifications);
    this.name = 'ArbitrationRejectedError';
    this.reason = reason;
    this.alternatives = alternatives;
    this.nextAvailable = nextAvailable;
  }
}

export class HoldExpiredError extends OpenavailError {
  constructor(message: string, pendingNotifications: PendingNotification[]) {
    super(message, 'HOLD_EXPIRED', 410, pendingNotifications);
    this.name = 'HoldExpiredError';
  }
}

export class HoldNotFoundError extends OpenavailError {
  constructor(message: string, pendingNotifications: PendingNotification[]) {
    super(message, 'HOLD_NOT_FOUND', 404, pendingNotifications);
    this.name = 'HoldNotFoundError';
  }
}

export class HoldAlreadyPromotedError extends OpenavailError {
  constructor(message: string, pendingNotifications: PendingNotification[]) {
    super(message, 'HOLD_ALREADY_PROMOTED', 409, pendingNotifications);
    this.name = 'HoldAlreadyPromotedError';
  }
}

export class SlotOutsideHoldError extends OpenavailError {
  constructor(message: string, pendingNotifications: PendingNotification[]) {
    super(message, 'SLOT_OUTSIDE_HOLD', 422, pendingNotifications);
    this.name = 'SlotOutsideHoldError';
  }
}

// ── Booking management errors ─────────────────────────────────────────────────

export class BookingNotFoundError extends OpenavailError {
  constructor(message: string, pendingNotifications: PendingNotification[]) {
    super(message, 'BOOKING_NOT_FOUND', 404, pendingNotifications);
    this.name = 'BookingNotFoundError';
  }
}

export class BookingNotCancellableError extends OpenavailError {
  constructor(message: string, pendingNotifications: PendingNotification[]) {
    super(message, 'BOOKING_NOT_CANCELLABLE', 409, pendingNotifications);
    this.name = 'BookingNotCancellableError';
  }
}

// ── Auth errors ───────────────────────────────────────────────────────────────

export class PermissionDeniedError extends OpenavailError {
  constructor(message: string, pendingNotifications: PendingNotification[]) {
    super(message, 'PERMISSION_DENIED', 403, pendingNotifications);
    this.name = 'PermissionDeniedError';
  }
}

export class OwnerScopeDeniedError extends OpenavailError {
  constructor(message: string, pendingNotifications: PendingNotification[]) {
    super(message, 'owner_scope_denied', 403, pendingNotifications);
    this.name = 'OwnerScopeDeniedError';
  }
}

export class UnknownApiKeyError extends OpenavailError {
  constructor(message: string) {
    super(message, 'unknown_api_key', 401, []);
    this.name = 'UnknownApiKeyError';
  }
}

// ── Idempotency errors ────────────────────────────────────────────────────────

export class IdempotencyConflictError extends OpenavailError {
  constructor(message: string, pendingNotifications: PendingNotification[]) {
    super(message, 'IDEMPOTENCY_CONFLICT', 422, pendingNotifications);
    this.name = 'IdempotencyConflictError';
  }
}

export class IdempotencyInFlightError extends OpenavailError {
  constructor(message: string, pendingNotifications: PendingNotification[]) {
    super(message, 'IDEMPOTENCY_IN_FLIGHT', 409, pendingNotifications);
    this.name = 'IdempotencyInFlightError';
  }
}

// ── Internal ──────────────────────────────────────────────────────────────────

export class OpenavailUnexpectedError extends OpenavailError {
  constructor(
    message: string,
    code: string,
    httpStatus: number,
    pendingNotifications: PendingNotification[],
  ) {
    super(message, code, httpStatus, pendingNotifications);
    this.name = 'OpenavailUnexpectedError';
  }
}
