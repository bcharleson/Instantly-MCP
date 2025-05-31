export interface PaginationParams {
  limit?: number;
  starting_after?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total?: number;
  limit: number;
  hasMore: boolean;
  next_starting_after?: string;
}

export function buildInstantlyPaginationQuery(params: PaginationParams): URLSearchParams {
  const query = new URLSearchParams();
  
  if (params.limit !== undefined) {
    query.append('limit', params.limit.toString());
  }
  
  if (params.starting_after !== undefined) {
    query.append('starting_after', params.starting_after);
  }
  
  return query;
}

export function buildQueryParams(args: any, additionalParams: string[] = []): URLSearchParams {
  const query = new URLSearchParams();
  
  // Add pagination parameters
  if (args?.limit) query.append('limit', String(args.limit));
  if (args?.starting_after) query.append('starting_after', String(args.starting_after));
  
  // Add additional parameters
  additionalParams.forEach(param => {
    if (args?.[param]) {
      query.append(param, String(args[param]));
    }
  });
  
  return query;
}

export function parsePaginatedResponse<T>(response: any, requestedLimit?: number): PaginatedResponse<T> {
  // Handle Instantly API response format - check for both 'data' and 'items' arrays
  if (response.data && Array.isArray(response.data)) {
    return {
      data: response.data as T[],
      total: response.total,
      limit: response.limit || requestedLimit || response.data.length,
      hasMore: !!response.next_starting_after,
      next_starting_after: response.next_starting_after,
    };
  }
  
  // Handle Instantly API 'items' format (used by campaigns, accounts, etc.)
  if (response.items && Array.isArray(response.items)) {
    return {
      data: response.items as T[],
      total: response.total,
      limit: response.limit || requestedLimit || response.items.length,
      hasMore: !!response.next_starting_after,
      next_starting_after: response.next_starting_after,
    };
  }
  
  // Handle array response
  if (Array.isArray(response)) {
    return {
      data: response as T[],
      limit: requestedLimit || response.length,
      hasMore: false,
    };
  }
  
  // Default case - preserve requested limit even if no data
  return {
    data: [],
    limit: requestedLimit || 0,
    hasMore: false,
  };
}

export function createPaginationInfo(
  currentLimit: number,
  totalItems?: number,
  hasMore?: boolean,
  nextStartingAfter?: string
): string {
  let info = `Showing ${currentLimit} items`;
  
  if (totalItems !== undefined) {
    info += ` of ${totalItems} total`;
  }
  
  if (hasMore) {
    info += ` (more available)`;
  }
  
  if (nextStartingAfter) {
    info += ` - Next page token: ${nextStartingAfter}`;
  }
  
  return info;
}