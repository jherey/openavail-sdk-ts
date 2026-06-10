import { Server } from '@modelcontextprotocol/sdk/server/index.js';
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
import { registerSimulate } from './tools/native/simulate.js';

export function buildServer(client: OpenavailClient): Server {
  const server = new Server(
    { name: '@openavail/mcp', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  registerListCalendars(server, client);
  registerListEvents(server, client);
  registerGetEvent(server, client);
  registerCreateEvent(server, client);
  registerUpdateEvent(server, client);
  registerDeleteEvent(server, client);
  registerSearchEvents(server, client);

  registerCheckAvailability(server, client);
  registerConfirmHold(server, client);
  registerSimulate(server, client);
  registerGetPendingNotifications(server, client);

  return server;
}
