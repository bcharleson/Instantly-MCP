import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
export class InstantlyError extends Error {
    constructor(error) {
        super(error.message);
        this.name = 'InstantlyError';
        this.status = error.status;
        this.code = error.code;
        this.details = error.details;
    }
}
export function handleInstantlyError(error, toolName) {
    // Handle different error scenarios
    if (error instanceof InstantlyError) {
        // Map Instantly API errors to MCP errors with tool-specific guidance
        switch (error.status) {
            case 400:
                // Enhanced guidance for create_campaign 400 errors
                if (toolName === 'create_campaign') {
                    throw new McpError(ErrorCode.InvalidParams, `Campaign creation failed (400): ${error.message}. ` +
                        `SOLUTION: First call list_accounts to get valid sending email addresses, then use ONLY those emails in the email_list parameter. ` +
                        `Invalid or unverified email addresses will cause this error.`);
                }
                throw new McpError(ErrorCode.InvalidParams, `Bad request (400): ${error.message}. Please check your parameters and try again.`);
            case 401:
                throw new McpError(ErrorCode.InvalidRequest, `Authentication failed (401): ${error.message}. Please check your API key is valid and has not expired.`);
            case 403:
                // Enhanced guidance for specific tools
                if (toolName === 'verify_email') {
                    throw new McpError(ErrorCode.InvalidRequest, `Email verification access forbidden (403): ${error.message}. ` +
                        `This feature requires a premium Instantly plan. Check: 1) Your plan includes email verification, 2) API key has required scopes, 3) Contact Instantly support.`);
                }
                throw new McpError(ErrorCode.InvalidRequest, `Access forbidden (403): ${error.message}. You may not have permission for this operation or it may require a premium plan.`);
            case 404:
                // Enhanced guidance for list_leads
                if (toolName === 'list_leads') {
                    throw new McpError(ErrorCode.InvalidRequest, `Leads not found (404): ${error.message}. ` +
                        `This may indicate the endpoint or parameters are incorrect. Try creating a lead first with create_lead.`);
                }
                throw new McpError(ErrorCode.InvalidRequest, `Resource not found (404): ${error.message}. The requested resource may not exist or you may not have access to it.`);
            case 422:
                throw new McpError(ErrorCode.InvalidParams, `Validation error (422): ${error.message}${error.details ? `. Details: ${JSON.stringify(error.details)}` : ''}. ` +
                    `Please check that all required fields are provided and in the correct format.`);
            case 429:
                throw new McpError(ErrorCode.InvalidRequest, `Rate limit exceeded (429): ${error.message}. Please wait before retrying. ` +
                    `Consider reducing the frequency of requests or upgrading your Instantly plan for higher limits.`);
            case 500:
            case 502:
            case 503:
            case 504:
                throw new McpError(ErrorCode.InternalError, `Instantly API server error (${error.status}): ${error.message}. ` +
                    `This is a temporary server issue. Please try again in a few moments.`);
            default:
                throw new McpError(ErrorCode.InternalError, `Instantly API error (${error.status}): ${error.message}. ` +
                    `If this persists, please check the Instantly API documentation or contact support.`);
        }
    }
    // Handle network errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        throw new McpError(ErrorCode.InternalError, `Cannot connect to Instantly API: ${error.message}`);
    }
    if (error.code === 'ETIMEDOUT') {
        throw new McpError(ErrorCode.InternalError, `Request to Instantly API timed out`);
    }
    // Handle MCP errors (re-throw them)
    if (error instanceof McpError) {
        throw error;
    }
    // Generic error handling
    throw new McpError(ErrorCode.InternalError, `Failed to execute ${toolName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
}
export async function parseInstantlyResponse(response) {
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
        }
        catch (error) {
            if (error instanceof InstantlyError) {
                throw error;
            }
            // JSON parsing error
            throw new InstantlyError({
                status: response.status,
                message: `Failed to parse response: ${error instanceof Error ? error.message : 'Invalid JSON'}`,
            });
        }
    }
    else {
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
//# sourceMappingURL=error-handler.js.map