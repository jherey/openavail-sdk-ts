import { pathToFileURL } from 'node:url';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { OpenavailClient, OpenavailPublicSchedulingClient } from '@openavail/sdk';
import { buildServer } from './server.js';

export function createServerFromEnv(env: NodeJS.ProcessEnv = process.env) {
  const apiKey = env.OPENAVAIL_API_KEY;
  const requesterCredential = env.OPENAVAIL_REQUESTER_CREDENTIAL;
  const baseUrl = env.OPENAVAIL_BASE_URL;
  const client = apiKey
    ? new OpenavailClient({
        apiKey,
        ...(baseUrl !== undefined && { baseUrl }),
      })
    : undefined;
  const publicSchedulingClient = new OpenavailPublicSchedulingClient({
    ...(requesterCredential !== undefined && { requesterCredential }),
    ...(baseUrl !== undefined && { baseUrl }),
  });

  const defaultOwnerEmail = env.OPENAVAIL_OWNER_EMAIL;
  return buildServer(client, {
    ...(defaultOwnerEmail !== undefined && { defaultOwnerEmail }),
    publicSchedulingClient,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createServerFromEnv();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
