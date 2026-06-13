import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { OpenavailClient } from '@openavail/sdk';
import { registerCreateEvent } from './tools/compatibility/create-event.js';
import { registerDeleteEvent } from './tools/compatibility/delete-event.js';
import { registerGetEvent } from './tools/compatibility/get-event.js';
import { registerListCalendars } from './tools/compatibility/list-calendars.js';
import { registerListEvents } from './tools/compatibility/list-events.js';
import { registerSearchEvents } from './tools/compatibility/search-events.js';
import { registerUpdateEvent } from './tools/compatibility/update-event.js';
import { registerCheckAvailability } from './tools/native/check-availability.js';
import { registerConfirmHold } from './tools/native/confirm-hold.js';
import { registerGetPendingNotifications } from './tools/native/get-pending-notifications.js';
import { registerGetScheduleRules } from './tools/native/get-schedule-rules.js';
import { registerListMeetingClasses } from './tools/native/list-meeting-classes.js';
import { registerSimulate } from './tools/native/simulate.js';

export function buildServer(
  client: OpenavailClient,
  opts: { defaultOwnerEmail?: string } = {},
): McpServer {
  const server = new McpServer({ name: '@openavail/mcp', version: '0.1.0' });
  const { defaultOwnerEmail } = opts;

  registerListCalendars(server, client, defaultOwnerEmail);
  registerListEvents(server, client, defaultOwnerEmail);
  registerGetEvent(server, client);
  registerCreateEvent(server, client, defaultOwnerEmail);
  registerUpdateEvent(server, client);
  registerDeleteEvent(server, client);
  registerSearchEvents(server, client, defaultOwnerEmail);

  registerListMeetingClasses(server, client);
  registerCheckAvailability(server, client, defaultOwnerEmail);
  registerConfirmHold(server, client);
  registerSimulate(server, client, defaultOwnerEmail);
  registerGetPendingNotifications(server, client);
  registerGetScheduleRules(server, client, defaultOwnerEmail);

  return server;
}
