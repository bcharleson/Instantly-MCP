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

export interface InstantlyAPICall {
  (endpoint: string, method?: string, data?: any): Promise<any>;
}

export interface ReusablePaginationOptions {
  maxPages?: number;
  batchSize?: number;
  additionalParams?: string[];
  progressCallback?: (pageCount: number, totalItems: number) => void;
  enablePerformanceMonitoring?: boolean;
  operationType?: 'accounts' | 'campaigns' | 'emails' | 'leads';
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

/**
 * Complete pagination function that retrieves ALL data following Instantly API pagination rules
 *
 * @param apiCall Function that makes the API request
 * @param initialParams Initial parameters for the first request
 * @param options Pagination options including max pages and progress callback
 * @returns Promise<T[]> All items retrieved through pagination
 */
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

  console.log(`🔄 Starting complete pagination retrieval (max ${maxPages} pages, limit ${defaultLimit})...`);

  while (pageCount < maxPages) {
    try {
      // Prepare parameters for this page
      const pageParams = { ...initialParams };

      if (useOffsetPagination) {
        // Offset-based pagination (for get-all-campaigns)
        pageParams.limit = defaultLimit;
        pageParams.offset = offset;
      } else {
        // Token-based pagination (standard Instantly API)
        pageParams.limit = defaultLimit;
        if (startingAfter) {
          pageParams.starting_after = startingAfter;
        }
      }

      console.log(`📄 Fetching page ${pageCount + 1}...`, pageParams);

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
        nextStartingAfter = undefined;
      } else {
        console.warn(`⚠️ Unexpected response format on page ${pageCount + 1}:`, typeof response);
        break;
      }

      // Add items to our collection
      if (items.length > 0) {
        allItems.push(...items);
        console.log(`✅ Retrieved ${items.length} items (total: ${allItems.length})`);

        // Call progress callback if provided
        if (progressCallback) {
          progressCallback(allItems.length, allItems.length);
        }
      }

      // Check termination conditions
      if (useOffsetPagination) {
        // For offset pagination: stop if we got fewer items than requested
        if (items.length < defaultLimit) {
          console.log(`🏁 Reached end of data (got ${items.length} < ${defaultLimit})`);
          break;
        }
        offset += defaultLimit;
      } else {
        // For token pagination: stop if no next_starting_after or empty items
        if (!nextStartingAfter || items.length === 0) {
          console.log(`🏁 Reached end of data (next_starting_after: ${nextStartingAfter}, items: ${items.length})`);
          break;
        }
        startingAfter = nextStartingAfter;
      }

      pageCount++;

      // Safety check for infinite loops
      if (pageCount >= maxPages) {
        console.warn(`⚠️ Reached maximum page limit (${maxPages}). Total items: ${allItems.length}`);
        break;
      }

    } catch (error) {
      console.error(`❌ Error during pagination on page ${pageCount + 1}:`, error);
      throw error;
    }
  }

  console.log(`✅ Pagination complete: ${allItems.length} total items retrieved in ${pageCount} pages`);
  return allItems;
}

/**
 * Instantly API specific pagination helper
 * Handles the specific patterns used by Instantly API endpoints
 */
export async function getInstantlyDataWithPagination<T>(
  makeRequest: (endpoint: string, method?: string, data?: any) => Promise<any>,
  endpoint: string,
  params: any = {},
  options: CompletePaginationOptions = {}
): Promise<{ items: T[], totalRetrieved: number, pagesUsed: number }> {

  const apiCall = async (pageParams: any) => {
    // Build query string for GET requests
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
    progressCallback: (current, total) => {
      console.log(`📊 Progress: ${current} items retrieved...`);
    },
    ...options
  });

  return {
    items: allItems,
    totalRetrieved: allItems.length,
    pagesUsed: Math.ceil(allItems.length / (options.defaultLimit || 100))
  };
}

/**
 * Validates pagination results and reports discrepancies
 */
export function validatePaginationResults<T>(
  items: T[],
  expectedCount?: number,
  context: string = 'items'
): string {
  let message = `📊 Retrieved ${items.length} ${context}`;

  if (expectedCount && expectedCount !== items.length) {
    if (items.length < expectedCount) {
      message += `\n⚠️ Note: Expected ${expectedCount} ${context} but retrieved ${items.length}. `;
      message += `This may be due to API pagination limitations or access restrictions.`;
    } else {
      message += `\n✅ Retrieved more ${context} than expected (${items.length} vs ${expectedCount}).`;
    }
  } else if (expectedCount) {
    message += `\n✅ Count matches expectation (${expectedCount}).`;
  }

  return message;
}

/**
 * Reusable pagination function for Instantly API endpoints
 * Handles the complete pagination flow with proper termination logic
 */
export async function paginateInstantlyAPI(
  endpoint: string,
  apiCall: InstantlyAPICall,
  params: any = {},
  options: ReusablePaginationOptions = {}
): Promise<any[]> {
  const {
    maxPages = 50,
    batchSize = 100,
    additionalParams = [],
    progressCallback,
    enablePerformanceMonitoring = true,
    operationType = 'accounts'
  } = options;

  // Initialize performance monitoring if enabled
  let performanceMonitor: any = null;
  if (enablePerformanceMonitoring) {
    try {
      const { createPerformanceMonitor } = await import('./performance-monitor.js');
      performanceMonitor = createPerformanceMonitor(operationType);
    } catch (error) {
      console.error('[Instantly MCP] Performance monitoring unavailable:', error);
    }
  }

  console.error(`[Instantly MCP] Starting reusable pagination for ${endpoint}...`);

  // Support starting_after parameter from params
  if (params?.starting_after) {
    console.error(`[Instantly MCP] Starting pagination from: ${params.starting_after}`);
  }

  const allItems: any[] = [];
  let pageCount = 0;
  let startingAfter: string | undefined = params?.starting_after;
  let hasMore = true;

  try {
    while (hasMore && pageCount < maxPages) {
      pageCount++;

      // Build query parameters for this page
      const queryParams = new URLSearchParams();
      queryParams.append('limit', batchSize.toString());

      if (startingAfter) {
        queryParams.append('starting_after', startingAfter);
      }

      // Add additional parameters
      additionalParams.forEach(param => {
        if (params?.[param]) {
          queryParams.append(param, String(params[param]));
        }
      });

      const fullEndpoint = `${endpoint}${queryParams.toString() ? `?${queryParams}` : ''}`;
      console.error(`[Instantly MCP] Page ${pageCount}: Fetching up to ${batchSize} items...`);

      // Make the API call for this page
      let response: any;
      let hasError = false;
      let isRateLimited = false;

      try {
        response = await apiCall(fullEndpoint);
      } catch (error: any) {
        hasError = true;
        // Check if it's a rate limit error
        if (error.message?.includes('rate limit') || error.status === 429) {
          isRateLimited = true;
          console.error(`[Instantly MCP] Rate limit hit on page ${pageCount}, retrying...`);
          // Wait and retry once
          await new Promise(resolve => setTimeout(resolve, 2000));
          try {
            response = await apiCall(fullEndpoint);
            hasError = false;
          } catch (retryError) {
            throw retryError;
          }
        } else {
          throw error;
        }
      }

      // Extract items from response (handle different response formats)
      let pageItems: any[] = [];
      let nextStartingAfter: string | undefined = undefined;

      if (Array.isArray(response)) {
        // Direct array response
        pageItems = response;
        hasMore = false; // Array response means no pagination
      } else if (response && response.data && Array.isArray(response.data)) {
        // Standard paginated response with data array
        pageItems = response.data;
        nextStartingAfter = response.next_starting_after;
      } else if (response && response.items && Array.isArray(response.items)) {
        // Alternative response format with items array (official API format)
        pageItems = response.items;
        nextStartingAfter = response.next_starting_after;
      } else {
        console.error(`[Instantly MCP] Unexpected response format in page ${pageCount}:`, typeof response);
        throw new Error(`Unexpected API response format in page ${pageCount}`);
      }

      // Record performance metrics
      if (performanceMonitor) {
        performanceMonitor.recordApiCall(pageItems.length, isRateLimited, hasError);

        // Check if we should abort due to performance issues
        const abortCheck = performanceMonitor.shouldAbort();
        if (abortCheck.abort) {
          console.error(`[Instantly MCP] Aborting pagination: ${abortCheck.reason}`);
          break;
        }
      }

      // Add this page to our accumulated results
      if (pageItems.length > 0) {
        allItems.push(...pageItems);
        console.error(`[Instantly MCP] Page ${pageCount}: Retrieved ${pageItems.length} items (total: ${allItems.length})`);

        // Call progress callback if provided
        if (progressCallback) {
          progressCallback(pageCount, allItems.length);
        }
      } else {
        console.error(`[Instantly MCP] Page ${pageCount}: No items returned, ending pagination`);
        hasMore = false;
      }

      // Check termination conditions
      if (!nextStartingAfter || pageItems.length < batchSize) {
        console.error(`[Instantly MCP] Pagination complete: ${nextStartingAfter ? 'Fewer results than batch size' : 'No next_starting_after token'}`);
        hasMore = false;
      } else {
        startingAfter = nextStartingAfter;
      }

      // Safety check to prevent infinite loops
      if (pageCount >= maxPages) {
        console.error(`[Instantly MCP] Reached maximum page limit (${maxPages}), stopping pagination`);
        break;
      }
    }

    console.error(`[Instantly MCP] Reusable pagination complete: ${allItems.length} total items retrieved in ${pageCount} pages`);

    // Finalize performance monitoring
    if (performanceMonitor) {
      performanceMonitor.finalize();
      const recommendations = performanceMonitor.getRecommendations();

      if (recommendations.length > 0) {
        console.error(`[Instantly MCP] Performance recommendations:`);
        recommendations.forEach((rec: string) => console.error(`  - ${rec}`));
      }
    }

    // Validate results
    if (allItems.length === 0) {
      console.error(`[Instantly MCP] Warning: No items found for ${endpoint}`);
    } else {
      console.error(`[Instantly MCP] ✅ Successfully retrieved complete dataset: ${allItems.length} items`);
    }

    return allItems;
  } catch (error) {
    console.error(`[Instantly MCP] Error during reusable pagination at page ${pageCount}:`, error);

    // Finalize performance monitoring even on error
    if (performanceMonitor) {
      performanceMonitor.finalize();
    }

    throw error;
  }
}