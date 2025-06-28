// COPIED FROM MCP src/pagination.ts – do not edit without syncing with original
export interface PaginationParams {
  limit?: number;
  starting_after?: string;
  offset?: number; // For offset-based pagination (get-all-campaigns)
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

// ---- FULL PAGINATION HELPERS BELOW ----

export async function getAllDataWithPagination<T>(
  apiCall: (params: any) => Promise<any>,
  initialParams: any = {},
  options: CompletePaginationOptions = {}
): Promise<T[]> {
  const {
    maxPages = 20,
    defaultLimit = 100,
    progressCallback,
    useOffsetPagination = false
  } = options;

  const allItems: T[] = [];
  let pageCount = 0;
  let startingAfter: string | undefined = undefined;
  let offset = 0;

  while (pageCount < maxPages) {
    // Prepare parameters for this page
    const pageParams = { ...initialParams };

    if (useOffsetPagination) {
      pageParams.limit = defaultLimit;
      pageParams.offset = offset;
    } else {
      pageParams.limit = defaultLimit;
      if (startingAfter) {
        pageParams.starting_after = startingAfter;
      }
    }

    // Make the API call
    const response = await apiCall(pageParams);

    // Extract items from response
    let items: T[] = [];
    let nextStartingAfter: string | undefined = undefined;

    if (response.items && Array.isArray(response.items)) {
      items = response.items;
      nextStartingAfter = response.next_starting_after;
    } else if (response.data && Array.isArray(response.data)) {
      items = response.data;
      nextStartingAfter = response.next_starting_after;
    } else if (Array.isArray(response)) {
      items = response;
    }

    if (items.length) {
      allItems.push(...items);
      if (progressCallback) progressCallback(allItems.length, allItems.length);
    }

    if (useOffsetPagination) {
      if (items.length < defaultLimit) break;
      offset += defaultLimit;
    } else {
      if (!nextStartingAfter || !items.length) break;
      startingAfter = nextStartingAfter;
    }

    pageCount += 1;
  }

  return allItems;
}

export async function getInstantlyDataWithPagination<T>(
  makeRequest: (endpoint: string, method?: string, data?: any) => Promise<any>,
  endpoint: string,
  params: any = {},
  options: CompletePaginationOptions = {}
): Promise<{ items: T[], totalRetrieved: number, pagesUsed: number }> {

  const apiCall = async (pageParams: any) => {
    const queryParams = new URLSearchParams();

    Object.entries(pageParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, String(value));
      }
    });

    const fullEndpoint = queryParams.toString()
      ? `${endpoint}?${queryParams.toString()}`
      : endpoint;

    return await makeRequest(fullEndpoint);
  };

  const allItems = await getAllDataWithPagination<T>(apiCall, params, {
    maxPages: 20,
    defaultLimit: 100,
    ...options
  });

  return {
    items: allItems,
    totalRetrieved: allItems.length,
    pagesUsed: Math.ceil(allItems.length / (options.defaultLimit || 100))
  };
}

export function validatePaginationResults<T>(
  items: T[],
  expectedCount?: number,
  context: string = 'items'
): string {
  let message = `📊 Retrieved ${items.length} ${context}`;

  if (expectedCount && expectedCount !== items.length) {
    if (items.length < expectedCount) {
      message += `\n⚠️ Expected ${expectedCount} but got ${items.length}.`;
    } else {
      message += `\n✅ Retrieved more ${context} than expected (${items.length} vs ${expectedCount}).`;
    }
  }

  return message;
} 