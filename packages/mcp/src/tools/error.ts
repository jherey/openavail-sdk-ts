import { ArbitrationRejectedError, NoSlotsError, type OpenavailError } from '@openavail/sdk';

type ToolErrorContent = {
  error: string;
  message: string;
  pendingNotifications: unknown[];
  [key: string]: unknown;
};

export function toolError(err: OpenavailError) {
  const body: ToolErrorContent = {
    error: err.code,
    message: err.message,
    pendingNotifications: err.pendingNotifications,
  };

  if (err instanceof ArbitrationRejectedError) {
    body['reason'] = err.reason;
    body['alternatives'] = err.alternatives;
  }

  if (err instanceof NoSlotsError) {
    body['resolvedCalendarType'] = err.resolvedCalendarType;
    body['warnings'] = err.warnings;
    if (err.nextAvailable !== undefined) body['nextAvailable'] = err.nextAvailable;
  }

  return {
    isError: true as const,
    content: [{ type: 'text' as const, text: JSON.stringify(body) }],
  };
}

export function ok(result: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
}

export function missingOwnerEmail() {
  return {
    isError: true as const,
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({
          error: 'MISSING_OWNER_EMAIL',
          message:
            'owner_email is required. Pass it explicitly or set OPENAVAIL_OWNER_EMAIL when starting the server.',
        }),
      },
    ],
  };
}
