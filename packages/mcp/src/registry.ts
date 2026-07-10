export type JsonSchemaObject = {
  type?: string;
  required?: readonly string[];
  properties?: Record<string, JsonSchemaObject>;
  items?: JsonSchemaObject;
  enum?: readonly string[];
  format?: string;
  minimum?: number;
  maximum?: number;
  maxItems?: number;
  additionalProperties?: boolean | JsonSchemaObject;
};

export type OpenavailMcpSurface = 'all' | 'hosted' | 'local' | 'deprecated';

export type OpenavailMcpToolDefinition = {
  name: string;
  description: string;
  inputSchema: JsonSchemaObject;
  surface: OpenavailMcpSurface;
  mutating?: boolean;
  idempotency?: 'none' | 'recommended' | 'required';
};

const emailProperty = { type: 'string', format: 'email' } as const;
const dateTimeProperty = { type: 'string', format: 'date-time' } as const;
const uuidProperty = { type: 'string', format: 'uuid' } as const;
const calendarTypeProperty = { type: 'string', enum: ['work', 'personal', 'other'] } as const;
const attendeeProperty = {
  type: 'object',
  required: ['email'],
  properties: { email: emailProperty, displayName: { type: 'string' } },
  additionalProperties: false,
} as const;
const publicAttendeeProperty = {
  type: 'object',
  required: ['email'],
  properties: { email: emailProperty, name: { type: 'string' } },
  additionalProperties: false,
} as const;
const dateTimeRangeProperty = {
  type: 'object',
  properties: { start: dateTimeProperty, end: dateTimeProperty },
  additionalProperties: false,
} as const;
const requiredDateTimeRangeProperty = {
  ...dateTimeRangeProperty,
  required: ['start', 'end'],
} as const;
const emptyObjectSchema = { type: 'object', properties: {}, additionalProperties: false } as const;

const OPENAVAIL_MCP_TOOLS: readonly OpenavailMcpToolDefinition[] = [
  {
    name: 'get-agent-context',
    description:
      'Requires read_freebusy. Start here. Returns backing agent, granted permissions, derived capabilities, calendars, schedule rules, meeting classes, setup warnings, unavailable features, and pending notifications.',
    inputSchema: {
      type: 'object',
      properties: { owner_email: emailProperty },
      additionalProperties: false,
    },
    surface: 'all',
    idempotency: 'none',
  },
  {
    name: 'list-calendars',
    description:
      'Requires read_freebusy. List calendar owners or calendars for a specific owner visible to this agent.',
    inputSchema: {
      type: 'object',
      properties: { owner_email: emailProperty },
      additionalProperties: false,
    },
    surface: 'all',
    idempotency: 'none',
  },
  {
    name: 'get-schedule-rules',
    description:
      'Requires read_freebusy. Get working hours, slot interval, and daily meeting limits for a calendar owner.',
    inputSchema: {
      type: 'object',
      properties: { owner_email: emailProperty },
      additionalProperties: false,
    },
    surface: 'all',
    idempotency: 'none',
  },
  {
    name: 'list-meeting-classes',
    description: 'Requires read_freebusy. List active meeting classes available to this agent.',
    inputSchema: emptyObjectSchema,
    surface: 'all',
    idempotency: 'none',
  },
  {
    name: 'search-availability',
    description:
      'Requires read_freebusy. Find capped candidate time slots without creating a hold. Defaults to 50 candidates; max_results may request up to 100. latest_end is the latest time the meeting may end. All times must be ISO 8601 UTC.',
    inputSchema: {
      type: 'object',
      required: ['duration_minutes', 'earliest_start', 'latest_end', 'meeting_class'],
      properties: {
        owner_email: emailProperty,
        calendar_type: calendarTypeProperty,
        duration_minutes: { type: 'integer', minimum: 5, maximum: 480 },
        earliest_start: dateTimeProperty,
        latest_end: dateTimeProperty,
        meeting_class: { type: 'string' },
        next_available_lookahead_hours: { type: 'integer', minimum: 1, maximum: 72 },
        max_results: { type: 'integer', minimum: 1, maximum: 100 },
      },
      additionalProperties: false,
    },
    surface: 'all',
    idempotency: 'none',
  },
  {
    name: 'create-hold',
    description:
      'Requires create_holds. Create a candidate or window hold before booking. Use an idempotency_key when retrying.',
    inputSchema: {
      type: 'object',
      required: ['meeting_class', 'hold_scope'],
      properties: {
        idempotency_key: { type: 'string' },
        owner_email: emailProperty,
        calendar_type: calendarTypeProperty,
        meeting_class: { type: 'string' },
        hold_scope: { type: 'string', enum: ['candidate', 'window'] },
        candidate: dateTimeRangeProperty,
        duration_minutes: { type: 'integer', minimum: 5, maximum: 480 },
        window: dateTimeRangeProperty,
      },
      additionalProperties: false,
    },
    surface: 'all',
    mutating: true,
    idempotency: 'recommended',
  },
  {
    name: 'confirm-hold',
    description:
      'Requires create_bookings. Confirm a hold into a committed booking. Use an idempotency_key when retrying.',
    inputSchema: {
      type: 'object',
      required: ['hold_id', 'start', 'end', 'title'],
      properties: {
        idempotency_key: { type: 'string' },
        hold_id: uuidProperty,
        start: dateTimeProperty,
        end: dateTimeProperty,
        title: { type: 'string' },
        description: { type: 'string' },
        attendees: { type: 'array', items: { type: 'object' } },
      },
      additionalProperties: false,
    },
    surface: 'all',
    mutating: true,
    idempotency: 'recommended',
  },
  {
    name: 'create-booking-proposal',
    description:
      'Requires create_booking_proposals. Create a durable booking proposal for calendar-owner approval without creating a hold or calendar event. Broad requested_window values produce a curated review set, not exhaustive availability; pass up to 3 preferred_times to preserve specific choices first.',
    inputSchema: {
      type: 'object',
      required: ['title', 'meeting_class', 'duration_minutes', 'requested_window'],
      properties: {
        owner_email: emailProperty,
        calendar_type: calendarTypeProperty,
        title: { type: 'string' },
        description: { type: 'string' },
        meeting_class: { type: 'string' },
        duration_minutes: { type: 'integer', minimum: 5, maximum: 480 },
        attendees: { type: 'array', items: attendeeProperty },
        requested_window: requiredDateTimeRangeProperty,
        preferred_times: { type: 'array', maxItems: 3, items: requiredDateTimeRangeProperty },
      },
      additionalProperties: false,
    },
    surface: 'all',
    mutating: true,
    idempotency: 'none',
  },
  {
    name: 'simulate',
    description:
      'Requires read_freebusy and a plan with simulation access. Preview scheduling/arbitration outcomes without creating holds or calendar events.',
    inputSchema: {
      type: 'object',
      required: ['start', 'end', 'meeting_class'],
      properties: {
        owner_email: emailProperty,
        calendar_type: calendarTypeProperty,
        start: dateTimeProperty,
        end: dateTimeProperty,
        meeting_class: { type: 'string' },
        title: { type: 'string' },
        attendees: { type: 'array', items: { type: 'object' } },
      },
      additionalProperties: true,
    },
    surface: 'all',
    idempotency: 'none',
  },
  {
    name: 'get-pending-notifications',
    description:
      'Requires read_freebusy. Fetch unacknowledged notifications for the authenticated backing agent.',
    inputSchema: emptyObjectSchema,
    surface: 'all',
    idempotency: 'none',
  },
  {
    name: 'ack-notifications',
    description: 'Requires read_freebusy. Acknowledge pending notification IDs.',
    inputSchema: {
      type: 'object',
      required: ['ids'],
      properties: { ids: { type: 'array', items: uuidProperty } },
      additionalProperties: false,
    },
    surface: 'all',
    mutating: true,
    idempotency: 'none',
  },
  {
    name: 'list-events',
    description:
      'Requires read_events. List committed events for a calendar owner with optional time, query, attendee, and cursor filters.',
    inputSchema: {
      type: 'object',
      properties: {
        owner_email: emailProperty,
        calendar_type: calendarTypeProperty,
        timeMin: dateTimeProperty,
        timeMax: dateTimeProperty,
        maxResults: { type: 'integer', minimum: 1, maximum: 100 },
        cursor: { type: 'string' },
        attendee_email: emailProperty,
        query: { type: 'string' },
      },
      additionalProperties: false,
    },
    surface: 'all',
    idempotency: 'none',
  },
  {
    name: 'search-events',
    description:
      'Requires read_events. Search committed events by title/query, time window, attendee, and owner.',
    inputSchema: {
      type: 'object',
      properties: {
        owner_email: emailProperty,
        calendar_type: calendarTypeProperty,
        q: { type: 'string' },
        query: { type: 'string' },
        timeMin: dateTimeProperty,
        timeMax: dateTimeProperty,
        maxResults: { type: 'integer', minimum: 1, maximum: 100 },
        cursor: { type: 'string' },
        attendee_email: emailProperty,
      },
      additionalProperties: false,
    },
    surface: 'all',
    idempotency: 'none',
  },
  {
    name: 'get-event',
    description: 'Requires read_events. Fetch a committed event by booking/event ID.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: uuidProperty },
      additionalProperties: false,
    },
    surface: 'all',
    idempotency: 'none',
  },
  {
    name: 'create-event',
    description:
      'Requires create_bookings. Create a committed booking directly. Use an idempotency_key when retrying.',
    inputSchema: {
      type: 'object',
      required: ['start', 'end', 'meeting_class', 'title'],
      properties: {
        idempotency_key: { type: 'string' },
        owner_email: emailProperty,
        calendar_type: calendarTypeProperty,
        start: dateTimeProperty,
        end: dateTimeProperty,
        meeting_class: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        attendees: { type: 'array', items: { type: 'object' } },
      },
      additionalProperties: false,
    },
    surface: 'all',
    mutating: true,
    idempotency: 'recommended',
  },
  {
    name: 'update-event',
    description:
      'Requires create_bookings. Update title, description, or attendees for a committed booking.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: uuidProperty,
        title: { type: 'string' },
        description: { type: 'string' },
        attendees: { type: 'array', items: { type: 'object' } },
      },
      additionalProperties: false,
    },
    surface: 'all',
    mutating: true,
    idempotency: 'none',
  },
  {
    name: 'delete-event',
    description:
      'Requires create_bookings. Cancel a committed booking. Use an idempotency_key when retrying.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: uuidProperty,
        idempotency_key: { type: 'string' },
      },
      additionalProperties: false,
    },
    surface: 'all',
    mutating: true,
    idempotency: 'recommended',
  },
  {
    name: 'list-public-meeting-types',
    description:
      "Public scheduling tool. List public meeting types visible on another owner's public scheduling boundary. Uses anonymous or requester-credential identity, not owner-calendar authority.",
    inputSchema: {
      type: 'object',
      required: ['public_scheduling_boundary_id'],
      properties: {
        public_scheduling_boundary_id: { type: 'string' },
        requester_credential: { type: 'string' },
      },
      additionalProperties: false,
    },
    surface: 'all',
    idempotency: 'none',
  },
  {
    name: 'create-public-booking-proposal',
    description:
      'Public scheduling tool. Ask another owner for time through their public scheduling boundary. requester_contact is the submitter and attendees should include the requester.',
    inputSchema: {
      type: 'object',
      required: ['public_scheduling_boundary_id', 'requester_contact', 'attendees'],
      properties: {
        public_scheduling_boundary_id: { type: 'string' },
        requester_credential: { type: 'string' },
        public_meeting_type: { type: 'string' },
        duration_minutes: { type: 'integer', minimum: 5, maximum: 480 },
        requested_window: dateTimeRangeProperty,
        requester_contact: {
          type: 'object',
          required: ['email'],
          properties: { email: emailProperty, name: { type: 'string' } },
          additionalProperties: false,
        },
        attendees: { type: 'array', items: publicAttendeeProperty },
        reason: { type: 'string' },
        message: { type: 'string' },
      },
      additionalProperties: false,
    },
    surface: 'all',
    mutating: true,
    idempotency: 'none',
  },
  {
    name: 'confirm-public-requester-contact',
    description:
      'Public scheduling tool. Confirm the requester-contact email for an anonymous public booking proposal using the token from the contact verification URL.',
    inputSchema: {
      type: 'object',
      required: ['contact_verification_token'],
      properties: { contact_verification_token: { type: 'string' } },
      additionalProperties: false,
    },
    surface: 'all',
    mutating: true,
    idempotency: 'none',
  },
  {
    name: 'get-public-booking-proposal-status',
    description:
      'Public scheduling tool. Poll safe public status by public proposal access token. Does not expose internal proposal IDs, conflicts, or owner availability.',
    inputSchema: {
      type: 'object',
      required: ['public_proposal_access_token'],
      properties: { public_proposal_access_token: { type: 'string' } },
      additionalProperties: false,
    },
    surface: 'all',
    idempotency: 'none',
  },
  {
    name: 'withdraw-public-booking-proposal',
    description:
      'Public scheduling tool. Withdraw a pending public proposal by public proposal access token. Does not cancel or reschedule booked meetings.',
    inputSchema: {
      type: 'object',
      required: ['public_proposal_access_token'],
      properties: { public_proposal_access_token: { type: 'string' } },
      additionalProperties: false,
    },
    surface: 'all',
    mutating: true,
    idempotency: 'none',
  },
] as const satisfies readonly OpenavailMcpToolDefinition[];

export function listOpenavailMcpTools(options: { surface?: 'hosted' | 'local' } = {}) {
  const surface = options.surface;
  return OPENAVAIL_MCP_TOOLS.filter(
    (tool) => tool.surface === 'all' || (surface !== undefined && tool.surface === surface),
  ).map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    surface: tool.surface,
    ...(tool.mutating !== undefined && { mutating: tool.mutating }),
    ...(tool.idempotency !== undefined && { idempotency: tool.idempotency }),
  }));
}

export function listPublicOpenavailMcpToolNames(): string[] {
  return OPENAVAIL_MCP_TOOLS.filter((tool) => tool.name.includes('-public-')).map(
    (tool) => tool.name,
  );
}
