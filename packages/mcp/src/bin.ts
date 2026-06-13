import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { OpenavailClient } from '@openavail/sdk';
import { buildServer } from './server.js';

const apiKey = process.env.OPENAVAIL_API_KEY;
if (!apiKey) {
  console.error('OPENAVAIL_API_KEY is required');
  process.exit(1);
}

const baseUrl = process.env.OPENAVAIL_BASE_URL;
const client = new OpenavailClient({
  apiKey,
  ...(baseUrl !== undefined && { baseUrl }),
});

const defaultOwnerEmail = process.env.OPENAVAIL_OWNER_EMAIL;
const server = buildServer(client, {
  ...(defaultOwnerEmail !== undefined && { defaultOwnerEmail }),
});
const transport = new StdioServerTransport();
await server.connect(transport);
