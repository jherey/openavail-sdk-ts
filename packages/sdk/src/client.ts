import { HttpClient } from './http.js';
import type {
  AckNotificationsResult,
  AlternativeSlot,
  AvailabilityWarning,
  Booking,
  BookingResult,
  CancelBookingResult,
  ConfirmHoldOptions,
  CreateBookingOptions,
  CreateHoldOptions,
  CreateHoldResult,
  DisplacedBookingInfo,
  GetScheduleRulesOptions,
  ListBookingsOptions,
  ListBookingsResult,
  MeetingClass,
  OwnerCalendar,
  OwnerContext,
  PendingNotification,
  PreemptPolicy,
  PriorityTier,
  RejectionReason,
  ScheduleRules,
  SearchAvailabilityOptions,
  SearchAvailabilityResult,
  SimulateOptions,
  SimulateResult,
  UpdateBookingOptions,
} from './types.js';

const DEFAULT_BASE_URL = 'https://api.openavail.com';

export class OpenavailClient {
  readonly #http: HttpClient;

  constructor(options: { apiKey: string; baseUrl?: string }) {
    if (!options.apiKey) throw new Error('apiKey is required');
    const base = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.#http = new HttpClient(options.apiKey, base);
  }

  async searchAvailability(options: SearchAvailabilityOptions): Promise<SearchAvailabilityResult> {
    const earliestStart = options.earliestStart ?? options.window?.start;
    const latestEnd = options.latestEnd ?? options.window?.end;
    type Raw = {
      requested_window: { start: string; end: string };
      candidates: {
        start: string;
        end: string;
        risk: 'free' | 'preemptable';
        preemptable?: {
          occupying_class: string;
          occupying_priority_tier: PriorityTier;
        };
      }[];
      pending_notifications: PendingNotification[];
      resolved_calendar_type: string | null;
      warnings: AvailabilityWarning[];
    };
    const raw = await this.#http.request<Raw>({
      method: 'POST',
      path: '/availability/search',
      body: {
        ...(options.ownerEmail !== undefined && { owner_email: options.ownerEmail }),
        duration_minutes: options.durationMinutes,
        earliest_start: earliestStart,
        latest_end: latestEnd,
        meeting_class: options.meetingClass,
        ...(options.calendarType !== undefined && { calendar_type: options.calendarType }),
        ...(options.nextAvailableLookaheadHours !== undefined && {
          next_available_lookahead_hours: options.nextAvailableLookaheadHours,
        }),
      },
      requiresIdempotency: true,
      idempotencyKey: options.idempotencyKey,
    });
    return {
      requestedWindow: raw.requested_window,
      candidates: raw.candidates,
      pendingNotifications: raw.pending_notifications,
      resolvedCalendarType: raw.resolved_calendar_type,
      warnings: raw.warnings,
    };
  }

  async createHold(options: CreateHoldOptions): Promise<CreateHoldResult> {
    type Raw = {
      hold_id: string;
      hold_scope: 'candidate' | 'window';
      held_window: { start: string; end: string };
      expires_at: string;
      expires_in_seconds: number;
      resolved_calendar_type: string | null;
    };
    const raw = await this.#http.request<Raw>({
      method: 'POST',
      path: '/holds',
      body: {
        ...(options.ownerEmail !== undefined && { owner_email: options.ownerEmail }),
        ...(options.calendarType !== undefined && { calendar_type: options.calendarType }),
        meeting_class: options.meetingClass,
        hold_scope: options.holdScope,
        ...(options.holdScope === 'candidate'
          ? { candidate: options.candidate }
          : { duration_minutes: options.durationMinutes, window: options.window }),
      },
      requiresIdempotency: true,
      idempotencyKey: options.idempotencyKey,
    });
    return {
      holdId: raw.hold_id,
      holdScope: raw.hold_scope,
      heldWindow: raw.held_window,
      expiresAt: raw.expires_at,
      expiresInSeconds: raw.expires_in_seconds,
      resolvedCalendarType: raw.resolved_calendar_type,
    };
  }

  async confirmHold(options: ConfirmHoldOptions): Promise<BookingResult> {
    type Raw = {
      booking_id: string;
      correlation_id: string;
      displaced_count?: number;
      displaced_bookings?: {
        booking_id: string;
        title: string | null;
        start: string;
        end: string;
        meeting_class: string | null;
      }[];
      pending_notifications: PendingNotification[];
      start: string;
      end: string;
      title: string | null;
      description?: string | null;
      calendar_type: string | null;
      attendees?: { email: string; displayName?: string }[];
      warnings?: AvailabilityWarning[];
      status: 'committed';
    };
    const raw = await this.#http.request<Raw>({
      method: 'POST',
      path: `/bookings/${options.holdId}/confirm`,
      body: {
        start: options.start,
        end: options.end,
        title: options.title,
        ...(options.description !== undefined && { description: options.description }),
        ...(options.attendees !== undefined && { attendees: options.attendees }),
      },
      requiresIdempotency: true,
      idempotencyKey: options.idempotencyKey,
    });
    return {
      bookingId: raw.booking_id,
      correlationId: raw.correlation_id,
      displacedCount: raw.displaced_count ?? 0,
      displacedBookings: (raw.displaced_bookings ?? []).map(
        (d): DisplacedBookingInfo => ({
          bookingId: d.booking_id,
          title: d.title,
          start: d.start,
          end: d.end,
          meetingClass: d.meeting_class,
        }),
      ),
      pendingNotifications: raw.pending_notifications,
      start: raw.start,
      end: raw.end,
      title: raw.title,
      description: raw.description ?? null,
      calendarType: raw.calendar_type,
      attendees: raw.attendees ?? [],
      warnings: raw.warnings ?? [],
      status: raw.status,
    };
  }

  async createBooking(options: CreateBookingOptions): Promise<BookingResult> {
    type Raw = {
      booking_id: string;
      correlation_id: string;
      displaced_count?: number;
      displaced_bookings?: {
        booking_id: string;
        title: string | null;
        start: string;
        end: string;
        meeting_class: string | null;
      }[];
      pending_notifications: PendingNotification[];
      start: string;
      end: string;
      title: string | null;
      description?: string | null;
      calendar_type: string | null;
      attendees?: { email: string; displayName?: string }[];
      warnings?: AvailabilityWarning[];
      status: 'committed';
    };
    const raw = await this.#http.request<Raw>({
      method: 'POST',
      path: '/bookings',
      body: {
        ...(options.ownerEmail !== undefined && { owner_email: options.ownerEmail }),
        start: options.start,
        end: options.end,
        meeting_class: options.meetingClass,
        title: options.title,
        ...(options.description !== undefined && { description: options.description }),
        ...(options.calendarType !== undefined && { calendar_type: options.calendarType }),
        ...(options.attendees !== undefined && { attendees: options.attendees }),
      },
      requiresIdempotency: true,
      idempotencyKey: options.idempotencyKey,
    });
    return {
      bookingId: raw.booking_id,
      correlationId: raw.correlation_id,
      displacedCount: raw.displaced_count ?? 0,
      displacedBookings: (raw.displaced_bookings ?? []).map(
        (d): DisplacedBookingInfo => ({
          bookingId: d.booking_id,
          title: d.title,
          start: d.start,
          end: d.end,
          meetingClass: d.meeting_class,
        }),
      ),
      pendingNotifications: raw.pending_notifications,
      start: raw.start,
      end: raw.end,
      title: raw.title,
      description: raw.description ?? null,
      calendarType: raw.calendar_type,
      attendees: raw.attendees ?? [],
      warnings: raw.warnings ?? [],
      status: raw.status,
    };
  }

  async simulate(options: SimulateOptions): Promise<SimulateResult> {
    type Raw = {
      decision: 'Accept' | 'Reject' | 'Preempt' | 'CounterPropose';
      reason?: string;
      alternatives?: { start: string; end: string; reason_code: string }[];
      engine_trace: unknown;
      pending_notifications: PendingNotification[];
    };
    const raw = await this.#http.request<Raw>({
      method: 'POST',
      path: '/simulate',
      body: {
        ...(options.ownerEmail !== undefined && { owner_email: options.ownerEmail }),
        start: options.start,
        end: options.end,
        meeting_class: options.meetingClass,
        ...(options.calendarType !== undefined && { calendar_type: options.calendarType }),
      },
    });
    return {
      decision: raw.decision,
      reason: raw.reason as RejectionReason | undefined,
      alternatives: raw.alternatives as AlternativeSlot[] | undefined,
      engineTrace: raw.engine_trace,
      pendingNotifications: raw.pending_notifications,
    };
  }

  async getPendingNotifications(): Promise<PendingNotification[]> {
    type Raw = {
      notifications: PendingNotification[];
      pending_notifications: PendingNotification[];
    };
    const raw = await this.#http.request<Raw>({ method: 'GET', path: '/notifications/pending' });
    return raw.notifications;
  }

  async ackNotifications(ids: string[]): Promise<AckNotificationsResult> {
    type Raw = { acked_count: number };
    const raw = await this.#http.request<Raw>({
      method: 'POST',
      path: '/notifications/ack',
      body: { ids },
    });
    return { ackedCount: raw.acked_count };
  }

  async listCalendars(ownerEmail: string): Promise<OwnerCalendar[]> {
    type Raw = {
      calendars: {
        calendar_type: 'work' | 'personal' | 'other' | null;
        is_primary: boolean;
        timezone: string | null;
      }[];
      pending_notifications: PendingNotification[];
    };
    const raw = await this.#http.request<Raw>({
      method: 'GET',
      path: `/calendar-owners/${encodeURIComponent(ownerEmail)}/calendars`,
    });
    return raw.calendars;
  }

  async getOwnerContext(ownerEmail?: string): Promise<OwnerContext> {
    type Raw = {
      calendars: {
        calendar_type: 'work' | 'personal' | 'other' | null;
        is_primary: boolean;
        timezone: string | null;
      }[];
      schedule_rules: {
        working_hours: { days: number[]; start_time: string; end_time: string; timezone: string }[];
        slot_interval_minutes: number;
        max_daily_meeting_hours: number | null;
      };
      meeting_classes: {
        name: string;
        description: string | null;
        priority_tier: PriorityTier;
        preempt_policy: PreemptPolicy;
      }[];
      setup_warnings?: AvailabilityWarning[];
      unavailable_features?: {
        code: string;
        feature: string;
        required_plan: string;
        message: string;
      }[];
      pending_notifications: PendingNotification[];
    };
    const raw = await this.#http.request<Raw>({
      method: 'GET',
      path: `/owner-context${ownerEmail !== undefined ? `?owner_email=${encodeURIComponent(ownerEmail)}` : ''}`,
    });
    return {
      calendars: raw.calendars,
      scheduleRules: {
        workingHours: raw.schedule_rules.working_hours.map((wh) => ({
          days: wh.days,
          startTime: wh.start_time,
          endTime: wh.end_time,
          timezone: wh.timezone,
        })),
        slotIntervalMinutes: raw.schedule_rules.slot_interval_minutes,
        maxDailyMeetingHours: raw.schedule_rules.max_daily_meeting_hours,
      },
      meetingClasses: raw.meeting_classes.map((c) => ({
        name: c.name,
        description: c.description,
        priorityTier: c.priority_tier,
        preemptPolicy: c.preempt_policy,
      })),
      setupWarnings: raw.setup_warnings ?? [],
      unavailableFeatures: (raw.unavailable_features ?? []).map((f) => ({
        code: f.code,
        feature: f.feature,
        requiredPlan: f.required_plan,
        message: f.message,
      })),
      pendingNotifications: raw.pending_notifications,
    };
  }

  async listMeetingClasses(): Promise<MeetingClass[]> {
    type Raw = {
      meeting_classes: {
        name: string;
        description: string | null;
        priority_tier: PriorityTier;
        preempt_policy: PreemptPolicy;
      }[];
    };
    const raw = await this.#http.request<Raw>({
      method: 'GET',
      path: '/meeting-classes/available',
    });
    return raw.meeting_classes.map((c) => ({
      name: c.name,
      description: c.description,
      priorityTier: c.priority_tier,
      preemptPolicy: c.preempt_policy,
    }));
  }

  async listBookings(options: ListBookingsOptions): Promise<ListBookingsResult> {
    type RawBooking = {
      booking_id: string;
      correlation_id: string;
      start: string;
      end: string;
      meeting_class: string | null;
      calendar_type: string | null;
      created_at: string;
      title?: string | null;
      description?: string | null;
      attendees?: { email: string; displayName?: string }[];
    };
    type Raw = {
      bookings: RawBooking[];
      next_cursor: string | null;
      pending_notifications: PendingNotification[];
    };
    const raw = await this.#http.request<Raw>({
      method: 'GET',
      path: '/bookings',
      query: {
        ...(options.ownerEmail !== undefined && { owner_email: options.ownerEmail }),
        ...(options.start !== undefined && { start: options.start }),
        ...(options.end !== undefined && { end: options.end }),
        ...(options.calendarType !== undefined && { calendar_type: options.calendarType }),
        ...(options.query !== undefined && { query: options.query }),
        ...(options.attendeeEmail !== undefined && { attendee_email: options.attendeeEmail }),
        ...(options.limit !== undefined && { limit: options.limit }),
        ...(options.cursor !== undefined && { cursor: options.cursor }),
      },
    });
    return {
      bookings: raw.bookings.map((b) => {
        const booking: Booking = {
          bookingId: b.booking_id,
          correlationId: b.correlation_id,
          start: b.start,
          end: b.end,
          meetingClass: b.meeting_class,
          calendarType: b.calendar_type,
          createdAt: b.created_at,
        };
        if (b.title !== undefined) booking.title = b.title ?? undefined;
        if (b.description !== undefined) booking.description = b.description ?? null;
        if (b.attendees !== undefined) booking.attendees = b.attendees;
        return booking;
      }),
      nextCursor: raw.next_cursor,
      pendingNotifications: raw.pending_notifications,
    };
  }

  async getBooking(bookingId: string): Promise<Booking> {
    type RawBooking = {
      booking_id: string;
      correlation_id: string;
      start: string;
      end: string;
      meeting_class: string | null;
      calendar_type: string | null;
      created_at: string;
      status: string;
      title?: string | null;
      description?: string | null;
      attendees?: { email: string; displayName?: string }[];
    };
    type Raw = { booking: RawBooking; pending_notifications: PendingNotification[] };
    const raw = await this.#http.request<Raw>({
      method: 'GET',
      path: `/bookings/${bookingId}`,
    });
    const b = raw.booking;
    const booking: Booking = {
      bookingId: b.booking_id,
      correlationId: b.correlation_id,
      start: b.start,
      end: b.end,
      meetingClass: b.meeting_class,
      calendarType: b.calendar_type,
      createdAt: b.created_at,
      status: b.status,
    };
    if (b.title !== undefined) booking.title = b.title ?? undefined;
    if (b.description !== undefined) booking.description = b.description ?? null;
    if (b.attendees !== undefined) booking.attendees = b.attendees;
    return booking;
  }

  async cancelBooking(
    bookingId: string,
    options?: { idempotencyKey?: string },
  ): Promise<CancelBookingResult> {
    type Raw = {
      booking_id: string;
      correlation_id: string;
      pending_notifications: PendingNotification[];
    };
    const raw = await this.#http.request<Raw>({
      method: 'DELETE',
      path: `/bookings/${bookingId}`,
      requiresIdempotency: true,
      idempotencyKey: options?.idempotencyKey,
    });
    return {
      bookingId: raw.booking_id,
      correlationId: raw.correlation_id,
      pendingNotifications: raw.pending_notifications,
    };
  }

  async updateBooking(bookingId: string, options: UpdateBookingOptions): Promise<BookingResult> {
    type Raw = {
      booking_id: string;
      correlation_id: string;
      pending_notifications: PendingNotification[];
      start: string;
      end: string;
      title: string | null;
      description?: string | null;
      calendar_type: string | null;
      status: 'committed';
    };
    const raw = await this.#http.request<Raw>({
      method: 'PATCH',
      path: `/bookings/${bookingId}`,
      body: options,
    });
    return {
      bookingId: raw.booking_id,
      correlationId: raw.correlation_id,
      displacedCount: 0,
      displacedBookings: [],
      pendingNotifications: raw.pending_notifications,
      start: raw.start,
      end: raw.end,
      title: raw.title,
      description: raw.description ?? null,
      calendarType: raw.calendar_type,
      warnings: [],
      status: raw.status,
    };
  }

  async getScheduleRules(options: GetScheduleRulesOptions): Promise<ScheduleRules> {
    type Raw = {
      working_hours: { days: number[]; start_time: string; end_time: string; timezone: string }[];
      slot_interval_minutes: number;
      max_daily_meeting_hours: number | null;
      pending_notifications: PendingNotification[];
    };
    const raw = await this.#http.request<Raw>({
      method: 'GET',
      path: '/schedule-rules',
      query: { ...(options.ownerEmail !== undefined && { owner_email: options.ownerEmail }) },
    });
    return {
      workingHours: raw.working_hours.map((wh) => ({
        days: wh.days,
        startTime: wh.start_time,
        endTime: wh.end_time,
        timezone: wh.timezone,
      })),
      slotIntervalMinutes: raw.slot_interval_minutes,
      maxDailyMeetingHours: raw.max_daily_meeting_hours,
    };
  }
}
