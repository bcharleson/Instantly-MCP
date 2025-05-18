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
  // Handle different error scenarios
  
  if (error instanceof InstantlyError) {
    // Map Instantly API errors to MCP errors
    switch (error.status) {
      case 401:
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Authentication failed: ${error.message}. Please check your API key.`
        );
      
      case 403:
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Access forbidden: ${error.message}. You may not have permission for this operation.`
        );
      
      case 404:
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Resource not found: ${error.message}`
        );
      
      case 422:
        throw new McpError(
          ErrorCode.InvalidParams,
          `Validation error: ${error.message}${error.details ? `. Details: ${JSON.stringify(error.details)}` : ''}`
        );
      
      case 429:
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Rate limit exceeded: ${error.message}. Please try again later.`
        );
      
      case 500:
      case 502:
      case 503:
      case 504:
        throw new McpError(
          ErrorCode.InternalError,
          `Instantly API server error (${error.status}): ${error.message}`
        );
      
      default:
        throw new McpError(
          ErrorCode.InternalError,
          `Instantly API error (${error.status}): ${error.message}`
        );
    }
  }
  
  // Handle network errors
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    throw new McpError(
      ErrorCode.InternalError,
      `Cannot connect to Instantly API: ${error.message}`
    );
  }
  
  if (error.code === 'ETIMEDOUT') {
    throw new McpError(
      ErrorCode.InternalError,
      `Request to Instantly API timed out`
    );
  }
  
  // Handle MCP errors (re-throw them)
  if (error instanceof McpError) {
    throw error;
  }
  
  // Generic error handling
  throw new McpError(
    ErrorCode.InternalError,
    `Failed to execute ${toolName}: ${error instanceof Error ? error.message : 'Unknown error'}`
  );
}

export async function parseInstantlyResponse(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type');
  
  if (contentType?.includes('application/json')) {
    try {
      const data = await response.json();
      
      if (!response.ok) {
        throw new InstantlyError({
          status: response.status,
          message: data.error || data.message || response.statusText,
          code: data.code,
          details: data.details || data.errors,
        });
      }
      
      return data;
    } catch (error) {
      if (error instanceof InstantlyError) {
        throw error;
      }
      
      // JSON parsing error
      throw new InstantlyError({
        status: response.status,
        message: `Failed to parse response: ${error instanceof Error ? error.message : 'Invalid JSON'}`,
      });
    }
  } else {
    // Non-JSON response
    const text = await response.text();
    
    if (!response.ok) {
      throw new InstantlyError({
        status: response.status,
        message: text || response.statusText,
      });
    }
    
    return text;
  }
}