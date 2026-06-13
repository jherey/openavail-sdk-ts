export type PendingNotification = {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type AvailabilityWarning = {
  code: 'CALENDAR_BUSY_STALE';
  calendar_type: string | null;
  message: string;
};

export type Slot = { start: string; end: string };

export type AlternativeSlot = {
  start: string;
  end: string;
  reason_code: string;
};

export type Attendee = { email: string; displayName?: string | undefined };

export type MeetingClass = {
  name: string;
  priority: number;
  preemptPolicy: 'strict' | 'soft' | 'hard';
};

export type OwnerCalendar = {
  calendar_type: 'work' | 'personal' | 'other' | null;
  is_primary: boolean;
  timezone: string | null;
};

export type Booking = {
  bookingId: string;
  correlationId: string;
  start: string;
  end: string;
  meetingClass: string | null;
  calendarType: string | null;
  createdAt: string;
  title?: string | undefined;
  attendees?: Attendee[] | undefined;
};

// ── Request option types ──────────────────────────────────────────────────────

export type CheckAvailabilityOptions = {
  ownerEmail: string;
  durationMinutes: number;
  window: { start: string; end: string };
  meetingClass: string;
  calendarType?: 'work' | 'personal' | 'other';
  nextAvailableLookaheadHours?: number;
  idempotencyKey?: string;
};

export type ConfirmHoldOptions = {
  holdId: string;
  start: string;
  end: string;
  title: string;
  description?: string;
  attendees?: Attendee[];
  idempotencyKey?: string;
};

export type CreateBookingOptions = {
  ownerEmail: string;
  start: string;
  end: string;
  meetingClass: string;
  title: string;
  description?: string;
  calendarType?: 'work' | 'personal' | 'other';
  attendees?: Attendee[];
  idempotencyKey?: string;
};

export type SimulateOptions = {
  ownerEmail: string;
  start: string;
  end: string;
  meetingClass: string;
  calendarType?: 'work' | 'personal' | 'other';
};

export type ListBookingsOptions = {
  ownerEmail: string;
  start?: string;
  end?: string;
  calendarType?: 'work' | 'personal' | 'other';
  query?: string;
  limit?: number;
  cursor?: string;
};

export type UpdateBookingOptions = {
  title?: string;
  attendees?: Attendee[];
};

// ── Result types ──────────────────────────────────────────────────────────────

export type CheckAvailabilityResult = {
  holdId: string;
  expiresAt: string;
  slots: Slot[];
  pendingNotifications: PendingNotification[];
  resolvedCalendarType: string | null;
  warnings: AvailabilityWarning[];
};

export type BookingResult = {
  bookingId: string;
  correlationId: string;
  displacedCount: number;
  pendingNotifications: PendingNotification[];
  start: string;
  end: string;
  title: string | null;
  description: string | null;
  calendarType: string | null;
  status: 'committed';
};

export type CancelBookingResult = {
  bookingId: string;
  correlationId: string;
  pendingNotifications: PendingNotification[];
};

export type ListBookingsResult = {
  bookings: Booking[];
  nextCursor: string | null;
  pendingNotifications: PendingNotification[];
};

export type SimulateResult = {
  decision: 'Accept' | 'Reject' | 'Preempt' | 'CounterPropose';
  reason?: string | undefined;
  alternatives?: AlternativeSlot[] | undefined;
  engineTrace: unknown;
  pendingNotifications: PendingNotification[];
};
