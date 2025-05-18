export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
  cursor?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  nextCursor?: string;
}

export function buildPaginationQuery(params: PaginationParams): URLSearchParams {
  const query = new URLSearchParams();
  
  if (params.page !== undefined) {
    query.append('page', params.page.toString());
  }
  
  if (params.limit !== undefined) {
    query.append('limit', params.limit.toString());
  }
  
  if (params.offset !== undefined) {
    query.append('offset', params.offset.toString());
  }
  
  if (params.cursor !== undefined) {
    query.append('cursor', params.cursor);
  }
  
  return query;
}

export function parsePaginatedResponse<T>(response: any): PaginatedResponse<T> {
  // Handle different pagination response formats
  if (response.data && Array.isArray(response.data)) {
    return {
      data: response.data as T[],
      total: response.total || response.count || response.data.length,
      page: response.page || 1,
      limit: response.limit || response.per_page || response.data.length,
      hasMore: response.has_more || response.hasMore || false,
      nextCursor: response.next_cursor || response.nextCursor,
    };
  }
  
  // Handle array response with pagination info in headers
  if (Array.isArray(response)) {
    return {
      data: response as T[],
      total: response.length,
      page: 1,
      limit: response.length,
      hasMore: false,
    };
  }
  
  // Default case
  return {
    data: [],
    total: 0,
    page: 1,
    limit: 0,
    hasMore: false,
  };
}

export function createPaginationInfo(
  currentPage: number,
  totalItems: number,
  itemsPerPage: number
): string {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);
  
  return `Page ${currentPage} of ${totalPages} (${startItem}-${endItem} of ${totalItems} items)`;
}