export interface InstantlyApiError {
    status: number;
    message: string;
    code?: string;
    details?: any;
}
export declare class InstantlyError extends Error {
    status: number;
    code?: string;
    details?: any;
    constructor(error: InstantlyApiError);
}
export declare function handleInstantlyError(error: any, toolName: string): never;
export declare function parseInstantlyResponse(response: Response): Promise<any>;
