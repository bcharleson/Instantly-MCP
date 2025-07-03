export interface PaginationParams {
    limit?: number;
    starting_after?: string;
    offset?: number;
}
export interface PaginatedResponse<T> {
    data: T[];
    total?: number;
    limit: number;
    hasMore: boolean;
    next_starting_after?: string;
    pagination_info?: string;
}
export interface CompletePaginationOptions {
    maxPages?: number;
    defaultLimit?: number;
    progressCallback?: (current: number, total: number) => void;
    useOffsetPagination?: boolean;
}
export declare function buildInstantlyPaginationQuery(params: PaginationParams): URLSearchParams;
export declare function buildQueryParams(args: any, additionalParams?: string[]): URLSearchParams;
export declare function parsePaginatedResponse<T>(response: any, requestedLimit?: number): PaginatedResponse<T>;
export declare function createPaginationInfo(currentLimit: number, totalItems?: number, hasMore?: boolean, nextStartingAfter?: string): string;
/**
 * Complete pagination function that retrieves ALL data following Instantly API pagination rules
 *
 * @param apiCall Function that makes the API request
 * @param initialParams Initial parameters for the first request
 * @param options Pagination options including max pages and progress callback
 * @returns Promise<T[]> All items retrieved through pagination
 */
export declare function getAllDataWithPagination<T>(apiCall: (params: any) => Promise<any>, initialParams?: any, options?: CompletePaginationOptions): Promise<T[]>;
/**
 * Instantly API specific pagination helper
 * Handles the specific patterns used by Instantly API endpoints
 */
export declare function getInstantlyDataWithPagination<T>(makeRequest: (endpoint: string, method?: string, data?: any) => Promise<any>, endpoint: string, params?: any, options?: CompletePaginationOptions): Promise<{
    items: T[];
    totalRetrieved: number;
    pagesUsed: number;
}>;
/**
 * Validates pagination results and reports discrepancies
 */
export declare function validatePaginationResults<T>(items: T[], expectedCount?: number, context?: string): string;
