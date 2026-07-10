import { HttpClient } from './http.js';
import type {
  AckNotificationsResult,
  AddRequesterAudienceMemberOptions,
  AlternativeSlot,
  AvailabilityWarning,
  BookableAllocation,
  Booking,
  BookingProposal,
  BookingResult,
  CancelBookingResult,
  ConfirmHoldOptions,
  CreateBookableAllocationOptions,
  CreateBookingOptions,
  CreateBookingProposalOptions,
  CreateHoldOptions,
  CreateHoldResult,
  CreatePublicBookingProposalOptions,
  CreatePublicBookingProposalResult,
  CreatePublicSchedulingBoundaryOptions,
  CreatePublicSchedulingMeetingTypeOptions,
  CreateRequesterAudienceOptions,
  CreateRequesterIdentityOptions,
  DisplacedBookingInfo,
  GetScheduleRulesOptions,
  IssuedRequesterCredential,
  IssueRequesterCredentialOptions,
  ListBookingsOptions,
  ListBookingsResult,
  MeetingClass,
  OwnerCalendar,
  OwnerContext,
  PendingNotification,
  PreemptPolicy,
  PriorityTier,
  PublicBookingProposalStatusResult,
  PublicMeetingType,
  PublicProposalStatus,
  PublicSchedulingAdminMeetingType,
  PublicSchedulingBoundary,
  RejectionReason,
  RequesterAudience,
  RequesterAudienceMember,
  RequesterCredential,
  RequesterIdentity,
  ScheduleRules,
  SearchAvailabilityOptions,
  SearchAvailabilityResult,
  SimulateOptions,
  SimulateResult,
  UpdateBookableAllocationOptions,
  UpdateBookingOptions,
  UpdatePublicSchedulingBoundaryOptions,
  UpdatePublicSchedulingMeetingTypeOptions,
  VerifiedDomain,
} from './types.js';

const DEFAULT_BASE_URL = 'https://api.openavail.com';

function slugifyPublicMeetingTypeName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

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
          occupying_booking_ids: string[];
          occupying_priority_tier: PriorityTier;
        };
      }[];
      pending_notifications: PendingNotification[];
      resolved_calendar_type: string | null;
      warnings: AvailabilityWarning[];
      candidate_limit: number | null;
      available_candidate_count: number;
      candidates_truncated: boolean;
      candidate_set: 'curated' | 'exhaustive';
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
        ...(options.maxResults !== undefined && { max_results: options.maxResults }),
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
      candidateLimit: raw.candidate_limit,
      availableCandidateCount: raw.available_candidate_count,
      candidatesTruncated: raw.candidates_truncated,
      candidateSet: raw.candidate_set,
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

  async createBookingProposal(options: CreateBookingProposalOptions): Promise<BookingProposal> {
    const raw = await this.#http.request<RawBookingProposal>({
      method: 'POST',
      path: '/booking-proposals',
      body: {
        ...(options.ownerEmail !== undefined && { owner_email: options.ownerEmail }),
        ...(options.calendarType !== undefined && { calendar_type: options.calendarType }),
        title: options.title,
        ...(options.description !== undefined && { description: options.description }),
        meeting_class: options.meetingClass,
        duration_minutes: options.durationMinutes,
        ...(options.attendees !== undefined && { attendees: options.attendees }),
        requested_window: options.requestedWindow,
        ...(options.preferredTimes !== undefined && { preferred_times: options.preferredTimes }),
      },
    });
    return mapBookingProposal(raw);
  }

  async getBookingProposal(proposalId: string): Promise<BookingProposal> {
    const raw = await this.#http.request<RawBookingProposal>({
      method: 'GET',
      path: `/booking-proposals/${encodeURIComponent(proposalId)}`,
    });
    return mapBookingProposal(raw);
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

export class OpenavailPublicSchedulingAdminClient {
  readonly #http: HttpClient;

  constructor(options: { apiKey: string; baseUrl?: string }) {
    if (!options.apiKey) throw new Error('apiKey is required');
    const base = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.#http = new HttpClient(options.apiKey, base);
  }

  async listBoundaries(): Promise<PublicSchedulingBoundary[]> {
    const raw = await this.#http.request<{ boundaries: RawPublicSchedulingBoundary[] }>({
      method: 'GET',
      path: '/public-scheduling/boundaries',
    });
    return raw.boundaries.map(mapPublicSchedulingBoundary);
  }

  async createBoundary(
    options: CreatePublicSchedulingBoundaryOptions,
  ): Promise<PublicSchedulingBoundary> {
    const raw = await this.#http.request<RawPublicSchedulingBoundary>({
      method: 'POST',
      path: '/public-scheduling/boundaries',
      body: {
        calendar_owner_id: options.calendarOwnerId,
        ...(options.aliasPath !== undefined && { alias_path: options.aliasPath }),
      },
    });
    return mapPublicSchedulingBoundary(raw);
  }

  async updateBoundary(
    options: UpdatePublicSchedulingBoundaryOptions,
  ): Promise<PublicSchedulingBoundary> {
    const raw = await this.#http.request<RawPublicSchedulingBoundary>({
      method: 'PATCH',
      path: `/public-scheduling/boundaries/${encodeURIComponent(options.boundaryId)}`,
      body: {
        ...(options.aliasPath !== undefined && { alias_path: options.aliasPath }),
        ...(options.allowFreeText !== undefined && { allow_free_text: options.allowFreeText }),
        ...(options.status !== undefined && { status: options.status }),
      },
    });
    return mapPublicSchedulingBoundary(raw);
  }

  async createMeetingType(
    options: CreatePublicSchedulingMeetingTypeOptions,
  ): Promise<PublicSchedulingAdminMeetingType> {
    const publicMeetingType =
      options.publicMeetingType ?? slugifyPublicMeetingTypeName(options.name);
    if (!publicMeetingType) {
      throw new Error('Meeting type name must contain at least one URL-safe character');
    }
    const raw = await this.#http.request<RawPublicSchedulingMeetingType>({
      method: 'POST',
      path: `/public-scheduling/boundaries/${encodeURIComponent(options.boundaryId)}/meeting-types`,
      body: {
        public_meeting_type: publicMeetingType,
        name: options.name,
        ...(options.description !== undefined && { description: options.description }),
        meeting_class_id: options.meetingClassId,
        duration_minutes: options.durationMinutes,
        ...(options.visibility !== undefined && { visibility: options.visibility }),
        ...(options.audienceIds !== undefined && { audience_ids: options.audienceIds }),
        ...(options.approvalMode !== undefined && { approval_mode: options.approvalMode }),
        ...(options.candidatePreview !== undefined && {
          candidate_preview: options.candidatePreview,
        }),
        ...(options.autoBook !== undefined && { auto_book: options.autoBook }),
        ...(options.attendeeLimit !== undefined && { attendee_limit: options.attendeeLimit }),
        ...(options.preemptPolicy !== undefined && { preempt_policy: options.preemptPolicy }),
        ...(options.status !== undefined && { status: options.status }),
      },
    });
    return mapPublicSchedulingMeetingType(raw);
  }

  async listMeetingTypes(boundaryId: string): Promise<PublicSchedulingAdminMeetingType[]> {
    const raw = await this.#http.request<{ meeting_types: RawPublicSchedulingMeetingType[] }>({
      method: 'GET',
      path: `/public-scheduling/boundaries/${encodeURIComponent(boundaryId)}/meeting-types`,
    });
    return raw.meeting_types.map(mapPublicSchedulingMeetingType);
  }

  async updateMeetingType(
    options: UpdatePublicSchedulingMeetingTypeOptions,
  ): Promise<PublicSchedulingAdminMeetingType> {
    const raw = await this.#http.request<RawPublicSchedulingMeetingType>({
      method: 'PATCH',
      path: `/public-scheduling/meeting-types/${encodeURIComponent(options.meetingTypeId)}`,
      body: {
        ...(options.name !== undefined && { name: options.name }),
        ...(options.description !== undefined && { description: options.description }),
        ...(options.durationMinutes !== undefined && { duration_minutes: options.durationMinutes }),
        ...(options.visibility !== undefined && { visibility: options.visibility }),
        ...(options.audienceIds !== undefined && { audience_ids: options.audienceIds }),
        ...(options.approvalMode !== undefined && { approval_mode: options.approvalMode }),
        ...(options.candidatePreview !== undefined && {
          candidate_preview: options.candidatePreview,
        }),
        ...(options.autoBook !== undefined && { auto_book: options.autoBook }),
        ...(options.attendeeLimit !== undefined && { attendee_limit: options.attendeeLimit }),
        ...(options.preemptPolicy !== undefined && { preempt_policy: options.preemptPolicy }),
        ...(options.status !== undefined && { status: options.status }),
      },
    });
    return mapPublicSchedulingMeetingType(raw);
  }

  async createVerifiedDomain(domain: string): Promise<VerifiedDomain> {
    const raw = await this.#http.request<RawVerifiedDomain>({
      method: 'POST',
      path: '/public-scheduling/verified-domains',
      body: { domain },
    });
    return mapVerifiedDomain(raw);
  }

  async listVerifiedDomains(): Promise<VerifiedDomain[]> {
    const raw = await this.#http.request<{ verified_domains: RawVerifiedDomain[] }>({
      method: 'GET',
      path: '/public-scheduling/verified-domains',
    });
    return raw.verified_domains.map(mapVerifiedDomain);
  }

  async checkVerifiedDomain(id: string): Promise<VerifiedDomain> {
    const raw = await this.#http.request<RawVerifiedDomain>({
      method: 'POST',
      path: `/public-scheduling/verified-domains/${encodeURIComponent(id)}/check`,
    });
    return mapVerifiedDomain(raw);
  }

  async deleteVerifiedDomain(id: string): Promise<void> {
    await this.#http.request<void>({
      method: 'DELETE',
      path: `/public-scheduling/verified-domains/${encodeURIComponent(id)}`,
    });
  }

  async listRequesterAudiences(): Promise<RequesterAudience[]> {
    const raw = await this.#http.request<{ audiences: RawRequesterAudience[] }>({
      method: 'GET',
      path: '/public-scheduling/requester-audiences',
    });
    return raw.audiences.map(mapRequesterAudience);
  }

  async createRequesterAudience(
    options: CreateRequesterAudienceOptions,
  ): Promise<RequesterAudience> {
    const raw = await this.#http.request<RawRequesterAudience>({
      method: 'POST',
      path: '/public-scheduling/requester-audiences',
      body: {
        name: options.name,
        ...(options.behavior !== undefined && { behavior: options.behavior }),
      },
    });
    return mapRequesterAudience(raw);
  }

  async addRequesterAudienceMember(
    options: AddRequesterAudienceMemberOptions,
  ): Promise<RequesterAudienceMember> {
    const raw = await this.#http.request<RawRequesterAudienceMember>({
      method: 'POST',
      path: `/public-scheduling/requester-audiences/${encodeURIComponent(options.audienceId)}/members`,
      body: {
        ...('verifiedDomainId' in options && { verified_domain_id: options.verifiedDomainId }),
        ...('requesterIdentityId' in options && {
          requester_identity_id: options.requesterIdentityId,
        }),
        ...('pendingDomain' in options && { pending_domain: options.pendingDomain }),
      },
    });
    return mapRequesterAudienceMember(raw);
  }

  async createRequesterIdentity(
    options: CreateRequesterIdentityOptions,
  ): Promise<RequesterIdentity> {
    const raw = await this.#http.request<RawRequesterIdentity>({
      method: 'POST',
      path: '/public-scheduling/requester-identities',
      body: {
        display_name: options.displayName,
        ...(options.verifiedDomainId !== undefined && {
          verified_domain_id: options.verifiedDomainId,
        }),
      },
    });
    return mapRequesterIdentity(raw);
  }

  async listRequesterIdentities(): Promise<RequesterIdentity[]> {
    const raw = await this.#http.request<{ requester_identities: RawRequesterIdentity[] }>({
      method: 'GET',
      path: '/public-scheduling/requester-identities',
    });
    return raw.requester_identities.map(mapRequesterIdentity);
  }

  async listRequesterCredentials(requesterIdentityId: string): Promise<RequesterCredential[]> {
    const raw = await this.#http.request<{
      requester_credentials: RawRequesterCredential[];
    }>({
      method: 'GET',
      path: `/public-scheduling/requester-identities/${encodeURIComponent(requesterIdentityId)}/credentials`,
    });
    return raw.requester_credentials.map(mapRequesterCredential);
  }

  async issueRequesterCredential(
    options: IssueRequesterCredentialOptions,
  ): Promise<IssuedRequesterCredential> {
    const raw = await this.#http.request<RawIssuedRequesterCredential>({
      method: 'POST',
      path: `/public-scheduling/requester-identities/${encodeURIComponent(options.requesterIdentityId)}/credentials`,
      body: {
        ...(options.displayName !== undefined && { display_name: options.displayName }),
      },
    });
    return {
      id: raw.id,
      credentialRef: raw.credential_ref,
      requesterCredential: raw.requester_credential,
    };
  }

  async revokeRequesterCredential(requesterCredentialId: string): Promise<RequesterCredential> {
    const raw = await this.#http.request<RawRequesterCredential>({
      method: 'POST',
      path: `/public-scheduling/requester-credentials/${encodeURIComponent(requesterCredentialId)}/revoke`,
    });
    return mapRequesterCredential(raw);
  }

  async createBookableAllocation(
    options: CreateBookableAllocationOptions,
  ): Promise<BookableAllocation> {
    const raw = await this.#http.request<RawBookableAllocation>({
      method: 'POST',
      path: `/public-scheduling/meeting-types/${encodeURIComponent(options.publicMeetingTypeId)}/allocations`,
      body: {
        label: options.label,
        window: options.window,
        ...(options.bookingLimit !== undefined && { booking_limit: options.bookingLimit }),
      },
    });
    return mapBookableAllocation(raw);
  }

  async listBookableAllocations(publicMeetingTypeId: string): Promise<BookableAllocation[]> {
    const raw = await this.#http.request<{ allocations: RawBookableAllocation[] }>({
      method: 'GET',
      path: `/public-scheduling/meeting-types/${encodeURIComponent(publicMeetingTypeId)}/allocations`,
    });
    return raw.allocations.map(mapBookableAllocation);
  }

  async updateBookableAllocation(
    options: UpdateBookableAllocationOptions,
  ): Promise<BookableAllocation> {
    const raw = await this.#http.request<RawBookableAllocation>({
      method: 'PATCH',
      path: `/public-scheduling/allocations/${encodeURIComponent(options.allocationId)}`,
      body: {
        ...(options.label !== undefined && { label: options.label }),
        ...(options.window !== undefined && { window: options.window }),
        ...(options.bookingLimit !== undefined && { booking_limit: options.bookingLimit }),
        ...(options.status !== undefined && { status: options.status }),
      },
    });
    return mapBookableAllocation(raw);
  }
}

export class OpenavailPublicSchedulingClient {
  readonly #baseUrl: string;
  readonly #requesterCredential: string | undefined;

  constructor(options: { requesterCredential?: string; baseUrl?: string } = {}) {
    this.#baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.#requesterCredential = options.requesterCredential;
  }

  async listMeetingTypes(boundaryId: string): Promise<PublicMeetingType[]> {
    type Raw = {
      meeting_types: {
        public_meeting_type: string;
        name: string;
        description: string | null;
        duration_minutes: number;
        suggested_times?: {
          start: string;
          end: string;
          rank: number;
          source: 'allocation' | 'rules';
        }[];
      }[];
    };
    const raw = await this.#request<Raw>({
      method: 'GET',
      path: `/schedules/${encodeURIComponent(boundaryId)}/meeting-types`,
    });
    return raw.meeting_types.map((type) => ({
      publicMeetingType: type.public_meeting_type,
      name: type.name,
      description: type.description,
      durationMinutes: type.duration_minutes,
      suggestedTimes: type.suggested_times ?? [],
    }));
  }

  async createBookingProposal(
    options: CreatePublicBookingProposalOptions,
  ): Promise<CreatePublicBookingProposalResult> {
    type Raw = {
      status: PublicProposalStatus;
      status_url: string;
      contact_verification_url?: string;
    };
    const raw = await this.#request<Raw>({
      method: 'POST',
      path: `/schedules/${encodeURIComponent(options.boundaryId)}/booking-proposals`,
      body: {
        ...(options.publicMeetingType !== undefined && {
          public_meeting_type: options.publicMeetingType,
        }),
        ...(options.durationMinutes !== undefined && { duration_minutes: options.durationMinutes }),
        ...(options.requestedWindow !== undefined && { requested_window: options.requestedWindow }),
        requester_contact: options.requesterContact,
        attendees: options.attendees,
        ...(options.reason !== undefined && { reason: options.reason }),
        ...(options.message !== undefined && { message: options.message }),
      },
    });
    return {
      status: raw.status,
      statusUrl: raw.status_url,
      ...(raw.contact_verification_url !== undefined && {
        contactVerificationUrl: raw.contact_verification_url,
      }),
    };
  }

  async confirmRequesterContact(contactVerificationToken: string): Promise<{ status: string }> {
    type Raw = { status: string };
    return this.#request<Raw>({
      method: 'POST',
      path: `/contact-verifications/${encodeURIComponent(contactVerificationToken)}/confirm`,
    });
  }

  async getBookingProposalStatus(
    publicProposalAccessToken: string,
  ): Promise<PublicBookingProposalStatusResult> {
    type Raw = { status: PublicProposalStatus; updated_at: string };
    const raw = await this.#request<Raw>({
      method: 'GET',
      path: `/booking-proposals/${encodeURIComponent(publicProposalAccessToken)}`,
    });
    return { status: raw.status, updatedAt: raw.updated_at };
  }

  async withdrawBookingProposal(
    publicProposalAccessToken: string,
  ): Promise<PublicBookingProposalStatusResult> {
    type Raw = { status: PublicProposalStatus; updated_at: string };
    const raw = await this.#request<Raw>({
      method: 'POST',
      path: `/booking-proposals/${encodeURIComponent(publicProposalAccessToken)}/withdraw`,
    });
    return { status: raw.status, updatedAt: raw.updated_at };
  }

  async #request<T>(opts: { method: 'GET' | 'POST'; path: string; body?: unknown }): Promise<T> {
    const headers: Record<string, string> = {};
    if (this.#requesterCredential) {
      headers.authorization = `Bearer ${this.#requesterCredential}`;
    }
    if (opts.body !== undefined) {
      headers['content-type'] = 'application/json';
    }
    const response = await fetch(`${this.#baseUrl}/public${opts.path}`, {
      method: opts.method,
      headers,
      ...(opts.body !== undefined && { body: JSON.stringify(opts.body) }),
    });
    const json = (await response.json()) as T | { error?: { code: string; message: string } };
    if (!response.ok) {
      const error = (json as { error?: { code: string; message: string } }).error;
      throw new Error(error?.message ?? `Openavail public scheduling request failed`);
    }
    return json as T;
  }
}

type RawBookingProposal = {
  proposal_id: string;
  status: BookingProposal['status'];
  title: string;
  description: string | null;
  meeting_class: string;
  duration_minutes: number;
  attendees: { email: string; displayName?: string }[];
  requested_window: { start: string; end: string };
  expires_at: string;
  created_at: string;
  calendar_owner: string;
  requesting_agent: string | null;
  resolved_calendar_type: string | null;
  candidate_limit: number;
  available_valid_candidate_count: number;
  valid_candidate_count: number;
  candidates_truncated: boolean;
  candidate_set: 'curated' | 'exhaustive';
  approved_candidate_id: string | null;
  candidates: {
    id: string;
    start: string;
    end: string;
    rank: number;
    agent_preferred: boolean;
    status: 'valid' | 'invalid';
    invalid_reasons: string[];
    risk: 'free' | 'preemptable';
    preemptable: Record<string, unknown> | null;
  }[];
  decision: string | null;
  rejection_reason: string | null;
  owner_note: string | null;
  booking_id: string | null;
  public_context?: RawPublicProposalContext | null;
};

type RawPublicProposalContext = {
  actor_source: BookingProposal['publicContext'] extends infer Context
    ? Context extends { actorSource: infer Source }
      ? Source
      : never
    : never;
  requester_identity_id: string | null;
  requester_identity: string | null;
  requester_verified_domain_id: string | null;
  requester_verified_domain: string | null;
  requester_contact: { email: string; name?: string } | null;
  public_scheduling_boundary_id: string | null;
  public_scheduling_boundary: string | null;
  public_meeting_type_id: string | null;
  public_meeting_type: string | null;
  audience_match: string[];
  public_request_message: string | null;
  requester_contact_verified_at: string | null;
};

type RawPublicSchedulingBoundary = {
  id: string;
  public_id: string;
  calendar_owner_id: string;
  alias_path: string | null;
  status: PublicSchedulingBoundary['status'];
  allow_free_text: boolean;
};

type RawPublicSchedulingMeetingType = {
  id: string;
  boundary_id: string;
  public_meeting_type: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  visibility: PublicSchedulingAdminMeetingType['visibility'];
  preempt_policy: PublicSchedulingAdminMeetingType['preemptPolicy'];
  status: PublicSchedulingAdminMeetingType['status'];
  attendee_limit: number;
};

type RawVerifiedDomain = {
  id: string;
  domain: string;
  status: VerifiedDomain['status'];
  txt_name: string;
  txt_value: string;
  verified_at?: string | null;
};

type RawRequesterAudienceMember = {
  id: string;
  verified_domain_id: string | null;
  requester_identity_id: string | null;
  pending_domain: string | null;
};

type RawRequesterAudience = {
  id: string;
  name: string;
  behavior: RequesterAudience['behavior'];
  members: RawRequesterAudienceMember[];
};

type RawRequesterIdentity = {
  id: string;
  display_name: string;
  verified_domain_id: string | null;
  status: string;
};

type RawIssuedRequesterCredential = {
  id: string;
  credential_ref: string | null;
  requester_credential: string;
};

type RawRequesterCredential = {
  id: string;
  requester_identity_id: string;
  credential_ref: string | null;
  display_name: string | null;
  created_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
};

type RawBookableAllocation = {
  id: string;
  public_meeting_type_id: string;
  label: string;
  window: Record<string, unknown>;
  booking_limit: Record<string, unknown> | null;
  status: BookableAllocation['status'];
};

function mapPublicSchedulingBoundary(raw: RawPublicSchedulingBoundary): PublicSchedulingBoundary {
  return {
    id: raw.id,
    publicId: raw.public_id,
    calendarOwnerId: raw.calendar_owner_id,
    aliasPath: raw.alias_path,
    status: raw.status,
    allowFreeText: raw.allow_free_text,
  };
}

function mapPublicSchedulingMeetingType(
  raw: RawPublicSchedulingMeetingType,
): PublicSchedulingAdminMeetingType {
  return {
    id: raw.id,
    boundaryId: raw.boundary_id,
    publicMeetingType: raw.public_meeting_type,
    name: raw.name,
    description: raw.description,
    durationMinutes: raw.duration_minutes,
    visibility: raw.visibility,
    preemptPolicy: raw.preempt_policy,
    status: raw.status,
    attendeeLimit: raw.attendee_limit,
  };
}

function mapVerifiedDomain(raw: RawVerifiedDomain): VerifiedDomain {
  return {
    id: raw.id,
    domain: raw.domain,
    status: raw.status,
    txtName: raw.txt_name,
    txtValue: raw.txt_value,
    verifiedAt: raw.verified_at ?? null,
  };
}

function mapRequesterAudienceMember(raw: RawRequesterAudienceMember): RequesterAudienceMember {
  return {
    id: raw.id,
    verifiedDomainId: raw.verified_domain_id,
    requesterIdentityId: raw.requester_identity_id,
    pendingDomain: raw.pending_domain,
  };
}

function mapRequesterAudience(raw: RawRequesterAudience): RequesterAudience {
  return {
    id: raw.id,
    name: raw.name,
    behavior: raw.behavior,
    members: raw.members.map(mapRequesterAudienceMember),
  };
}

function mapRequesterIdentity(raw: RawRequesterIdentity): RequesterIdentity {
  return {
    id: raw.id,
    displayName: raw.display_name,
    verifiedDomainId: raw.verified_domain_id,
    status: raw.status,
  };
}

function mapRequesterCredential(raw: RawRequesterCredential): RequesterCredential {
  return {
    id: raw.id,
    requesterIdentityId: raw.requester_identity_id,
    credentialRef: raw.credential_ref,
    displayName: raw.display_name,
    createdAt: raw.created_at,
    revokedAt: raw.revoked_at,
    lastUsedAt: raw.last_used_at,
  };
}

function mapBookableAllocation(raw: RawBookableAllocation): BookableAllocation {
  return {
    id: raw.id,
    publicMeetingTypeId: raw.public_meeting_type_id,
    label: raw.label,
    window: raw.window,
    bookingLimit: raw.booking_limit,
    status: raw.status,
  };
}

function mapPublicProposalContext(
  raw: RawPublicProposalContext,
): NonNullable<BookingProposal['publicContext']> {
  return {
    actorSource: raw.actor_source,
    requesterIdentityId: raw.requester_identity_id,
    requesterIdentity: raw.requester_identity,
    requesterVerifiedDomainId: raw.requester_verified_domain_id,
    requesterVerifiedDomain: raw.requester_verified_domain,
    requesterContact: raw.requester_contact,
    publicSchedulingBoundaryId: raw.public_scheduling_boundary_id,
    publicSchedulingBoundary: raw.public_scheduling_boundary,
    publicMeetingTypeId: raw.public_meeting_type_id,
    publicMeetingType: raw.public_meeting_type,
    audienceMatch: raw.audience_match,
    publicRequestMessage: raw.public_request_message,
    requesterContactVerifiedAt: raw.requester_contact_verified_at,
  };
}

function mapBookingProposal(raw: RawBookingProposal): BookingProposal {
  return {
    proposalId: raw.proposal_id,
    status: raw.status,
    title: raw.title,
    description: raw.description,
    meetingClass: raw.meeting_class,
    durationMinutes: raw.duration_minutes,
    attendees: raw.attendees,
    requestedWindow: raw.requested_window,
    expiresAt: raw.expires_at,
    createdAt: raw.created_at,
    calendarOwner: raw.calendar_owner,
    requestingAgent: raw.requesting_agent,
    resolvedCalendarType: raw.resolved_calendar_type,
    candidateLimit: raw.candidate_limit,
    availableValidCandidateCount: raw.available_valid_candidate_count,
    validCandidateCount: raw.valid_candidate_count,
    candidatesTruncated: raw.candidates_truncated,
    candidateSet: raw.candidate_set,
    approvedCandidateId: raw.approved_candidate_id,
    candidates: raw.candidates.map((candidate) => ({
      id: candidate.id,
      start: candidate.start,
      end: candidate.end,
      rank: candidate.rank,
      agentPreferred: candidate.agent_preferred,
      status: candidate.status,
      invalidReasons: candidate.invalid_reasons,
      risk: candidate.risk,
      preemptable: candidate.preemptable,
    })),
    decision: raw.decision,
    rejectionReason: raw.rejection_reason,
    ownerNote: raw.owner_note,
    bookingId: raw.booking_id,
    publicContext: raw.public_context ? mapPublicProposalContext(raw.public_context) : null,
  };
}
