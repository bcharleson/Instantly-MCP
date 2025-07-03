export function buildInstantlyPaginationQuery(params) {
    const query = new URLSearchParams();
    if (params.limit !== undefined) {
        query.append('limit', params.limit.toString());
    }
    if (params.starting_after !== undefined) {
        query.append('starting_after', params.starting_after);
    }
    return query;
}
export function buildQueryParams(args, additionalParams = []) {
    const query = new URLSearchParams();
    // Add pagination parameters
    if (args?.limit)
        query.append('limit', String(args.limit));
    if (args?.starting_after)
        query.append('starting_after', String(args.starting_after));
    // Add additional parameters
    additionalParams.forEach(param => {
        if (args?.[param]) {
            query.append(param, String(args[param]));
        }
    });
    return query;
}
export function parsePaginatedResponse(response, requestedLimit) {
    // Handle Instantly API response format - check for both 'data' and 'items' arrays
    if (response.data && Array.isArray(response.data)) {
        return {
            data: response.data,
            total: response.total,
            limit: response.limit || requestedLimit || response.data.length,
            hasMore: !!response.next_starting_after,
            next_starting_after: response.next_starting_after,
        };
    }
    // Handle Instantly API 'items' format (used by campaigns, accounts, etc.)
    if (response.items && Array.isArray(response.items)) {
        return {
            data: response.items,
            total: response.total,
            limit: response.limit || requestedLimit || response.items.length,
            hasMore: !!response.next_starting_after,
            next_starting_after: response.next_starting_after,
        };
    }
    // Handle array response
    if (Array.isArray(response)) {
        return {
            data: response,
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
export function createPaginationInfo(currentLimit, totalItems, hasMore, nextStartingAfter) {
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
export async function getAllDataWithPagination(apiCall, initialParams = {}, options = {}) {
    const { maxPages = 20, defaultLimit = 100, progressCallback, useOffsetPagination = false } = options;
    const allItems = [];
    let pageCount = 0;
    let startingAfter = undefined;
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
            }
            else {
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
            let items = [];
            let nextStartingAfter = undefined;
            if (response.items && Array.isArray(response.items)) {
                items = response.items;
                nextStartingAfter = response.next_starting_after;
            }
            else if (response.data && Array.isArray(response.data)) {
                items = response.data;
                nextStartingAfter = response.next_starting_after;
            }
            else if (Array.isArray(response)) {
                items = response;
                nextStartingAfter = undefined;
            }
            else {
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
            }
            else {
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
        }
        catch (error) {
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
export async function getInstantlyDataWithPagination(makeRequest, endpoint, params = {}, options = {}) {
    const apiCall = async (pageParams) => {
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
    const allItems = await getAllDataWithPagination(apiCall, params, {
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
export function validatePaginationResults(items, expectedCount, context = 'items') {
    let message = `📊 Retrieved ${items.length} ${context}`;
    if (expectedCount && expectedCount !== items.length) {
        if (items.length < expectedCount) {
            message += `\n⚠️ Note: Expected ${expectedCount} ${context} but retrieved ${items.length}. `;
            message += `This may be due to API pagination limitations or access restrictions.`;
        }
        else {
            message += `\n✅ Retrieved more ${context} than expected (${items.length} vs ${expectedCount}).`;
        }
    }
    else if (expectedCount) {
        message += `\n✅ Count matches expectation (${expectedCount}).`;
    }
    return message;
}
//# sourceMappingURL=pagination.js.map