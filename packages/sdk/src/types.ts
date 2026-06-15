export type PendingNotification = {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type AvailabilityWarning =
  | { code: 'CALENDAR_BUSY_STALE'; calendar_type: string | null; message: string }
  | { code: 'CALENDAR_TYPE_FALLBACK'; requested: string; resolved: string | null; message: string };

export type Slot = {
  start: string;
  end: string;
  preemptable?: { occupying_class: string; occupying_priority: number };
};

export type AlternativeSlot = {
  start: string;
  end: string;
  reason_code: string;
};

export type Attendee = { email: string; displayName?: string | undefined };

export type MeetingClass = {
  name: string;
  description: string | null;
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
  /** 'committed' for active bookings; 'needs_reschedule' when displaced by a higher-priority event. */
  status?: string;
  title?: string | undefined;
  description?: string | null | undefined;
  attendees?: Attendee[] | undefined;
};

export type OwnerContext = {
  calendars: OwnerCalendar[];
  scheduleRules: {
    workingHours: { days: number[]; startTime: string; endTime: string; timezone: string }[];
    slotIntervalMinutes: number;
    maxDailyMeetingHours: number | null;
  };
  meetingClasses: MeetingClass[];
  pendingNotifications: PendingNotification[];
};

// ── Request option types ──────────────────────────────────────────────────────

export type CheckAvailabilityOptions = {
  /** Optional for user-scoped keys — resolved server-side from the API key's owner scope. */
  ownerEmail?: string;
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
  /** Optional for user-scoped keys — resolved server-side from the API key's owner scope. */
  ownerEmail?: string;
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
  /** Optional for user-scoped keys — resolved server-side from the API key's owner scope. */
  ownerEmail?: string;
  start: string;
  end: string;
  meetingClass: string;
  calendarType?: 'work' | 'personal' | 'other';
};

export type ListBookingsOptions = {
  /** Optional for user-scoped keys — resolved server-side from the API key's owner scope. */
  ownerEmail?: string;
  start?: string;
  end?: string;
  calendarType?: 'work' | 'personal' | 'other';
  query?: string;
  attendeeEmail?: string;
  limit?: number;
  cursor?: string;
};

export type UpdateBookingOptions = {
  title?: string;
  description?: string;
  attendees?: Attendee[];
};

// ── Result types ──────────────────────────────────────────────────────────────

export type CheckAvailabilityResult = {
  holdId: string;
  expiresAt: string;
  /** Seconds until the hold expires. Use this for TTL checks instead of comparing expiresAt against local time. */
  expiresInSeconds: number;
  slots: Slot[];
  pendingNotifications: PendingNotification[];
  resolvedCalendarType: string | null;
  warnings: AvailabilityWarning[];
};

export type DisplacedBookingInfo = {
  bookingId: string;
  title: string | null;
  start: string;
  end: string;
  meetingClass: string | null;
};

export type BookingResult = {
  bookingId: string;
  correlationId: string;
  displacedCount: number;
  /** Details of bookings displaced by this preemption. Owner has been notified by email. */
  displacedBookings: DisplacedBookingInfo[];
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

export type AckNotificationsResult = {
  ackedCount: number;
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

export type WorkingHoursRule = {
  days: number[];
  startTime: string;
  endTime: string;
  timezone: string;
};

export type ScheduleRules = {
  workingHours: WorkingHoursRule[];
  slotIntervalMinutes: number;
  maxDailyMeetingHours: number | null;
};

export type GetScheduleRulesOptions = {
  /** Optional for user-scoped keys — resolved server-side from the API key's owner scope. */
  ownerEmail?: string;
};
