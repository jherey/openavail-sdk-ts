export type PendingNotification = {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type AvailabilityWarning =
  | { code: 'CALENDAR_BUSY_STALE'; calendar_type: string | null; message: string }
  | { code: 'CALENDAR_TYPE_FALLBACK'; requested: string; resolved: string | null; message: string }
  | {
      code: 'WORKING_HOURS_NOT_CONFIGURED';
      severity: 'warning';
      message: string;
      agent_guidance: string;
    };

export type UnavailableFeature = {
  code: string;
  feature: string;
  requiredPlan: string;
  message: string;
};

export const PRIORITY_TIERS = ['critical', 'high', 'normal', 'low'] as const;
export type PriorityTier = (typeof PRIORITY_TIERS)[number];

export const PREEMPT_POLICIES = ['protected', 'reschedulable', 'replaceable'] as const;
export type PreemptPolicy = (typeof PREEMPT_POLICIES)[number];

export type AvailabilityCandidate = {
  start: string;
  end: string;
  risk: 'free' | 'preemptable';
  preemptable?: {
    occupying_class: string;
    occupying_booking_ids: string[];
    occupying_priority_tier: PriorityTier;
  };
};

export type Slot = {
  start: string;
  end: string;
};

export type RejectionReason =
  | 'NO_CAPACITY'
  | 'WORKING_HOURS'
  | 'OFF_DAY'
  | 'SACRED_MEETING'
  | 'MAX_DAILY_HOURS'
  | 'PERMISSION_DENIED_PREEMPT'
  | 'COUNTER_PROPOSED';

/**
 * Why availability search returned no slots.
 * Returned as reason_code on the NoSlotsError thrown by searchAvailability().
 *
 * - NO_FREE_SLOTS   — working day, right time of day, but the calendar is genuinely busy
 * - DAILY_HOURS_LIMIT — owner has hit their daily meeting cap
 * - OFF_DAY         — the window falls on a non-working day (e.g. Saturday)
 * - WORKING_HOURS   — working day but the window is outside the owner's configured hours
 * - HARD_BLOCK      — the window overlaps a recurring hard block (e.g. lunch break)
 */
export type NoSlotsReasonCode =
  | 'NO_FREE_SLOTS'
  | 'DAILY_HOURS_LIMIT'
  | 'OFF_DAY'
  | 'WORKING_HOURS'
  | 'HARD_BLOCK';

export type AlternativeSlot = {
  start: string;
  end: string;
  reason_code: string;
};

export type Attendee = { email: string; displayName?: string | undefined };

export type MeetingClass = {
  name: string;
  description: string | null;
  priorityTier: PriorityTier;
  preemptPolicy: PreemptPolicy;
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
  setupWarnings: AvailabilityWarning[];
  unavailableFeatures: UnavailableFeature[];
  pendingNotifications: PendingNotification[];
};

// ── Request option types ──────────────────────────────────────────────────────

export type SearchAvailabilityOptions = {
  /** Optional for user-scoped keys — resolved server-side from the API key's owner scope. */
  ownerEmail?: string;
  durationMinutes: number;
  /** Earliest time the meeting may start (ISO 8601 UTC). */
  earliestStart?: string;
  /** Latest time the meeting may END — not start (ISO 8601 UTC). For a 60-min meeting starting at 2pm, set latestEnd to at least 3pm. */
  latestEnd?: string;
  /** Legacy alias for earliestStart/latestEnd. */
  window?: { start: string; end: string };
  meetingClass: string;
  calendarType?: 'work' | 'personal' | 'other';
  nextAvailableLookaheadHours?: number;
  idempotencyKey?: string;
};

export type CreateCandidateHoldOptions = {
  ownerEmail?: string;
  calendarType?: 'work' | 'personal' | 'other';
  meetingClass: string;
  holdScope: 'candidate';
  candidate: { start: string; end: string };
  idempotencyKey?: string;
};

export type CreateWindowHoldOptions = {
  ownerEmail?: string;
  calendarType?: 'work' | 'personal' | 'other';
  meetingClass: string;
  holdScope: 'window';
  durationMinutes: number;
  window: { start: string; end: string };
  idempotencyKey?: string;
};

export type CreateHoldOptions = CreateCandidateHoldOptions | CreateWindowHoldOptions;

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

export type BookingProposalCandidate = {
  id: string;
  start: string;
  end: string;
  rank: number;
  agentPreferred: boolean;
  status: 'valid' | 'invalid';
  invalidReasons: string[];
  risk: 'free' | 'preemptable';
  preemptable: Record<string, unknown> | null;
};

export type PublicProposalContext = {
  actorSource:
    | 'owner_registered_agent'
    | 'requester_identity'
    | 'anonymous_requester'
    | 'dashboard_user'
    | 'system';
  requesterIdentityId: string | null;
  requesterIdentity: string | null;
  requesterVerifiedDomainId: string | null;
  requesterVerifiedDomain: string | null;
  requesterContact: RequesterContact | null;
  publicSchedulingBoundaryId: string | null;
  publicSchedulingBoundary: string | null;
  publicMeetingTypeId: string | null;
  publicMeetingType: string | null;
  audienceMatch: string[];
  publicRequestMessage: string | null;
  requesterContactVerifiedAt: string | null;
};

export type BookingProposal = {
  proposalId: string;
  status:
    | 'pending_owner_decision'
    | 'pending_requester_verification'
    | 'approved_executing'
    | 'booked'
    | 'needs_new_window'
    | 'needs_owner_review'
    | 'rejected'
    | 'expired'
    | 'withdrawn'
    | 'failed';
  title: string;
  description: string | null;
  meetingClass: string;
  durationMinutes: number;
  attendees: Attendee[];
  requestedWindow: { start: string; end: string };
  expiresAt: string;
  createdAt: string;
  calendarOwner: string;
  requestingAgent: string | null;
  resolvedCalendarType: string | null;
  approvedCandidateId: string | null;
  candidates: BookingProposalCandidate[];
  decision: string | null;
  rejectionReason: string | null;
  ownerNote: string | null;
  bookingId: string | null;
  publicContext: PublicProposalContext | null;
};

export type CreateBookingProposalOptions = {
  ownerEmail?: string;
  calendarType?: 'work' | 'personal' | 'other';
  title: string;
  description?: string;
  meetingClass: string;
  durationMinutes: number;
  attendees?: Attendee[];
  requestedWindow: { start: string; end: string };
  preferredTimes?: { start: string; end: string }[];
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

export type SearchAvailabilityResult = {
  requestedWindow: { start: string; end: string };
  candidates: AvailabilityCandidate[];
  pendingNotifications: PendingNotification[];
  resolvedCalendarType: string | null;
  warnings: AvailabilityWarning[];
};

export type CreateHoldResult = {
  holdId: string;
  holdScope: 'candidate' | 'window';
  heldWindow: { start: string; end: string };
  expiresAt: string;
  expiresInSeconds: number;
  resolvedCalendarType: string | null;
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
  attendees?: Attendee[];
  warnings: AvailabilityWarning[];
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
  reason?: RejectionReason | undefined;
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

export type PublicSuggestedTime = {
  start: string;
  end: string;
  rank: number;
  source: 'allocation' | 'rules';
};

export type PublicMeetingType = {
  publicMeetingType: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  suggestedTimes: PublicSuggestedTime[];
};

export type PublicSchedulingBoundary = {
  id: string;
  publicId: string;
  calendarOwnerId: string;
  aliasPath: string | null;
  status: 'active' | 'disabled';
  allowFreeText: boolean;
};

export type PublicMeetingTypeVisibility = 'everyone' | 'verified_requesters' | 'selected_audiences';

export type PublicSchedulingAdminMeetingType = {
  id: string;
  boundaryId: string;
  publicMeetingType: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  visibility: PublicMeetingTypeVisibility;
  preemptPolicy: PreemptPolicy | null;
  status: 'draft' | 'published' | 'disabled';
  attendeeLimit: number;
};

export type VerifiedDomain = {
  id: string;
  domain: string;
  status: 'pending' | 'verified' | 'failed';
  txtName: string;
  txtValue: string;
  verifiedAt: string | null;
};

export type RequesterAudienceMember = {
  id: string;
  verifiedDomainId: string | null;
  requesterIdentityId: string | null;
  pendingDomain: string | null;
};

export type RequesterAudience = {
  id: string;
  name: string;
  behavior: 'allow' | 'block';
  members: RequesterAudienceMember[];
};

export type RequesterIdentity = {
  id: string;
  displayName: string;
  verifiedDomainId: string | null;
  status: string;
};

export type IssuedRequesterCredential = {
  id: string;
  credentialRef: string | null;
  requesterCredential: string;
};

export type RequesterCredential = {
  id: string;
  requesterIdentityId: string;
  credentialRef: string | null;
  displayName: string | null;
  createdAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
};

export type BookableAllocation = {
  id: string;
  publicMeetingTypeId: string;
  label: string;
  window: Record<string, unknown>;
  bookingLimit: Record<string, unknown> | null;
  status: 'active' | 'disabled';
};

export type CreatePublicSchedulingBoundaryOptions = {
  calendarOwnerId: string;
  aliasPath?: string;
};

export type UpdatePublicSchedulingBoundaryOptions = {
  boundaryId: string;
  aliasPath?: string | null;
  allowFreeText?: boolean;
  status?: PublicSchedulingBoundary['status'];
};

export type CreatePublicSchedulingMeetingTypeOptions = {
  boundaryId: string;
  /**
   * URL/API-safe meeting type identifier. If omitted, the SDK derives one from `name`.
   */
  publicMeetingType?: string;
  name: string;
  description?: string;
  meetingClassId: string;
  durationMinutes: number;
  visibility?: PublicMeetingTypeVisibility;
  audienceIds?: string[];
  approvalMode?: 'required' | 'not_required';
  candidatePreview?: boolean;
  autoBook?: boolean;
  attendeeLimit?: number;
  preemptPolicy?: PreemptPolicy;
  status?: 'draft' | 'published';
};

export type UpdatePublicSchedulingMeetingTypeOptions = {
  meetingTypeId: string;
  name?: string;
  description?: string | null;
  durationMinutes?: number;
  visibility?: PublicMeetingTypeVisibility;
  audienceIds?: string[];
  approvalMode?: 'required' | 'not_required';
  candidatePreview?: boolean;
  autoBook?: boolean;
  attendeeLimit?: number;
  preemptPolicy?: PreemptPolicy | null;
  status?: PublicSchedulingAdminMeetingType['status'];
};

export type CreateRequesterAudienceOptions = {
  name: string;
  behavior?: 'allow' | 'block';
};

export type AddRequesterAudienceMemberOptions =
  | { audienceId: string; verifiedDomainId: string }
  | { audienceId: string; requesterIdentityId: string }
  | { audienceId: string; pendingDomain: string };

export type CreateRequesterIdentityOptions = {
  displayName: string;
  verifiedDomainId?: string;
};

export type IssueRequesterCredentialOptions = {
  requesterIdentityId: string;
  displayName?: string;
};

export type CreateBookableAllocationOptions = {
  publicMeetingTypeId: string;
  label: string;
  window: Record<string, unknown>;
  bookingLimit?: Record<string, unknown>;
};

export type UpdateBookableAllocationOptions = {
  allocationId: string;
  label?: string;
  window?: Record<string, unknown>;
  bookingLimit?: Record<string, unknown> | null;
  status?: BookableAllocation['status'];
};

export type RequesterContact = {
  email: string;
  name?: string;
};

export type PublicProposalAttendee = {
  email: string;
  name?: string;
};

export type CreatePublicBookingProposalOptions = {
  boundaryId: string;
  publicMeetingType?: string;
  durationMinutes?: number;
  requestedWindow?: { start: string; end: string };
  requesterContact: RequesterContact;
  attendees: PublicProposalAttendee[];
  reason?: string;
  message?: string;
};

export type PublicProposalStatus =
  | 'pending_review'
  | 'pending_requester_verification'
  | 'booked'
  | 'rejected'
  | 'expired'
  | 'withdrawn'
  | 'countered'
  | 'needs_more_information';

export type CreatePublicBookingProposalResult = {
  status: PublicProposalStatus;
  statusUrl: string;
  contactVerificationUrl?: string;
};

export type PublicBookingProposalStatusResult = {
  status: PublicProposalStatus;
  updatedAt: string;
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
