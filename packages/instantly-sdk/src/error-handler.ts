// COPIED FROM MCP src/error-handler.ts – do not edit without syncing with original
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';

export interface InstantlyApiError {
  status: number;
  message: string;
  code?: string;
  details?: any;
}

export class InstantlyError extends Error {
  status: number;
  code?: string;
  details?: any;

  constructor(error: InstantlyApiError) {
    super(error.message);
    this.name = 'InstantlyError';
    this.status = error.status;
    this.code = error.code;
    this.details = error.details;
  }
}

export function handleInstantlyError(error: any, toolName: string): never {
  if (error instanceof InstantlyError) {
    switch (error.status) {
      case 400:
        if (toolName === 'create_campaign') {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Campaign creation failed (400): ${error.message}. First call list_accounts to get valid sending addresses.`
          );
        }
        throw new McpError(ErrorCode.InvalidParams, `Bad request (400): ${error.message}.`);
      case 401:
        throw new McpError(ErrorCode.InvalidRequest, `Authentication failed (401): ${error.message}.`);
      case 403:
        throw new McpError(ErrorCode.InvalidRequest, `Access forbidden (403): ${error.message}.`);
      case 404:
        throw new McpError(ErrorCode.InvalidRequest, `Resource not found (404): ${error.message}.`);
      case 422:
        throw new McpError(ErrorCode.InvalidParams, `Validation error (422): ${error.message}.`);
      case 429:
        throw new McpError(ErrorCode.InvalidRequest, `Rate limit exceeded (429): ${error.message}.`);
      case 500:
      case 502:
      case 503:
      case 504:
        throw new McpError(ErrorCode.InternalError, `Instantly API server error (${error.status}): ${error.message}.`);
      default:
        throw new McpError(ErrorCode.InternalError, `Instantly API error (${error.status}): ${error.message}.`);
    }
  }

  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    throw new McpError(ErrorCode.InternalError, `Cannot connect to Instantly API: ${error.message}`);
  }
  if (error.code === 'ETIMEDOUT') {
    throw new McpError(ErrorCode.InternalError, `Request to Instantly API timed out`);
  }
  if (error instanceof McpError) {
    throw error;
  }
  throw new McpError(ErrorCode.InternalError, `Failed to execute ${toolName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
}

export async function parseInstantlyResponse(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    try {
      const data = await response.json();
      if (!response.ok) {
        throw new InstantlyError({ status: response.status, message: data.error || data.message || response.statusText, code: data.code, details: data.details || data.errors });
      }
      return data;
    } catch (error) {
      if (error instanceof InstantlyError) throw error;
      throw new InstantlyError({ status: response.status, message: `Failed to parse response: ${error instanceof Error ? error.message : 'Invalid JSON'}` });
    }
  } else {
    const text = await response.text();
    if (!response.ok) {
      throw new InstantlyError({ status: response.status, message: text || response.statusText });
    }
    return text;
  }
} 