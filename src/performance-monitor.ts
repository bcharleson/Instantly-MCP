/**
 * Performance monitoring utilities for pagination operations
 * Tracks timing, memory usage, and API call efficiency
 */

export interface PaginationMetrics {
  startTime: number;
  endTime?: number;
  totalDuration?: number;
  apiCallCount: number;
  totalItemsRetrieved: number;
  averageItemsPerCall: number;
  memoryUsage?: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  rateLimitHits: number;
  errorCount: number;
  largestBatchSize: number;
  smallestBatchSize: number;
}

export interface PerformanceThresholds {
  maxDurationMs: number;
  maxMemoryMB: number;
  maxApiCalls: number;
  minItemsPerCall: number;
}

export class PaginationPerformanceMonitor {
  private metrics: PaginationMetrics;
  private thresholds: PerformanceThresholds;
  private batchSizes: number[] = [];

  constructor(thresholds?: Partial<PerformanceThresholds>) {
    this.metrics = {
      startTime: Date.now(),
      apiCallCount: 0,
      totalItemsRetrieved: 0,
      averageItemsPerCall: 0,
      rateLimitHits: 0,
      errorCount: 0,
      largestBatchSize: 0,
      smallestBatchSize: Infinity
    };

    this.thresholds = {
      maxDurationMs: 60000, // 1 minute
      maxMemoryMB: 100, // 100MB
      maxApiCalls: 50,
      minItemsPerCall: 10,
      ...thresholds
    };
  }

  /**
   * Record an API call with its results
   */
  recordApiCall(itemsRetrieved: number, isRateLimited: boolean = false, hasError: boolean = false): void {
    this.metrics.apiCallCount++;
    this.metrics.totalItemsRetrieved += itemsRetrieved;
    this.batchSizes.push(itemsRetrieved);

    if (itemsRetrieved > this.metrics.largestBatchSize) {
      this.metrics.largestBatchSize = itemsRetrieved;
    }
    if (itemsRetrieved < this.metrics.smallestBatchSize && itemsRetrieved > 0) {
      this.metrics.smallestBatchSize = itemsRetrieved;
    }

    if (isRateLimited) {
      this.metrics.rateLimitHits++;
    }
    if (hasError) {
      this.metrics.errorCount++;
    }

    // Update average
    this.metrics.averageItemsPerCall = this.metrics.totalItemsRetrieved / this.metrics.apiCallCount;

    // Log progress for long operations
    if (this.metrics.apiCallCount % 5 === 0) {
      this.logProgress();
    }
  }

  /**
   * Record memory usage at current point
   */
  recordMemoryUsage(): void {
    const memUsage = process.memoryUsage();
    this.metrics.memoryUsage = {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external
    };
  }

  /**
   * Finalize metrics and return performance summary
   */
  finalize(): PaginationMetrics & { performanceWarnings: string[] } {
    this.metrics.endTime = Date.now();
    this.metrics.totalDuration = this.metrics.endTime - this.metrics.startTime;
    this.recordMemoryUsage();

    const warnings = this.checkPerformanceThresholds();

    console.error(`[Performance Monitor] Pagination completed:`);
    console.error(`  Duration: ${this.metrics.totalDuration}ms`);
    console.error(`  API Calls: ${this.metrics.apiCallCount}`);
    console.error(`  Items Retrieved: ${this.metrics.totalItemsRetrieved}`);
    console.error(`  Avg Items/Call: ${this.metrics.averageItemsPerCall.toFixed(1)}`);
    console.error(`  Memory Used: ${this.formatMemoryUsage()}`);
    
    if (warnings.length > 0) {
      console.error(`  ⚠️ Performance Warnings: ${warnings.length}`);
      warnings.forEach(warning => console.error(`    - ${warning}`));
    } else {
      console.error(`  ✅ Performance: All thresholds met`);
    }

    return {
      ...this.metrics,
      performanceWarnings: warnings
    };
  }

  /**
   * Check if performance metrics exceed thresholds
   */
  private checkPerformanceThresholds(): string[] {
    const warnings: string[] = [];

    if (this.metrics.totalDuration && this.metrics.totalDuration > this.thresholds.maxDurationMs) {
      warnings.push(`Duration exceeded threshold: ${this.metrics.totalDuration}ms > ${this.thresholds.maxDurationMs}ms`);
    }

    if (this.metrics.apiCallCount > this.thresholds.maxApiCalls) {
      warnings.push(`API calls exceeded threshold: ${this.metrics.apiCallCount} > ${this.thresholds.maxApiCalls}`);
    }

    if (this.metrics.averageItemsPerCall < this.thresholds.minItemsPerCall) {
      warnings.push(`Low efficiency: ${this.metrics.averageItemsPerCall.toFixed(1)} items/call < ${this.thresholds.minItemsPerCall}`);
    }

    if (this.metrics.memoryUsage) {
      const memoryMB = this.metrics.memoryUsage.heapUsed / 1024 / 1024;
      if (memoryMB > this.thresholds.maxMemoryMB) {
        warnings.push(`Memory usage exceeded threshold: ${memoryMB.toFixed(1)}MB > ${this.thresholds.maxMemoryMB}MB`);
      }
    }

    if (this.metrics.rateLimitHits > 0) {
      warnings.push(`Rate limit hits detected: ${this.metrics.rateLimitHits}`);
    }

    if (this.metrics.errorCount > 0) {
      warnings.push(`Errors encountered: ${this.metrics.errorCount}`);
    }

    return warnings;
  }

  /**
   * Log current progress
   */
  private logProgress(): void {
    const elapsed = Date.now() - this.metrics.startTime;
    console.error(`[Performance Monitor] Progress: ${this.metrics.apiCallCount} calls, ${this.metrics.totalItemsRetrieved} items, ${elapsed}ms elapsed`);
  }

  /**
   * Format memory usage for display
   */
  private formatMemoryUsage(): string {
    if (!this.metrics.memoryUsage) return 'N/A';
    
    const heapMB = (this.metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(1);
    const totalMB = (this.metrics.memoryUsage.heapTotal / 1024 / 1024).toFixed(1);
    return `${heapMB}MB / ${totalMB}MB heap`;
  }

  /**
   * Get current metrics without finalizing
   */
  getCurrentMetrics(): PaginationMetrics {
    return { ...this.metrics };
  }

  /**
   * Check if operation should be aborted due to performance issues
   */
  shouldAbort(): { abort: boolean; reason?: string } {
    const elapsed = Date.now() - this.metrics.startTime;
    
    if (elapsed > this.thresholds.maxDurationMs) {
      return { abort: true, reason: `Duration exceeded ${this.thresholds.maxDurationMs}ms` };
    }

    if (this.metrics.apiCallCount > this.thresholds.maxApiCalls) {
      return { abort: true, reason: `API calls exceeded ${this.thresholds.maxApiCalls}` };
    }

    if (this.metrics.memoryUsage) {
      const memoryMB = this.metrics.memoryUsage.heapUsed / 1024 / 1024;
      if (memoryMB > this.thresholds.maxMemoryMB) {
        return { abort: true, reason: `Memory usage exceeded ${this.thresholds.maxMemoryMB}MB` };
      }
    }

    return { abort: false };
  }

  /**
   * Get performance recommendations based on current metrics
   */
  getRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.metrics.averageItemsPerCall < 50 && this.metrics.apiCallCount > 10) {
      recommendations.push('Consider increasing batch size to improve efficiency');
    }

    if (this.metrics.rateLimitHits > 0) {
      recommendations.push('Add delays between API calls to avoid rate limiting');
    }

    if (this.batchSizes.length > 0) {
      const variance = this.calculateBatchSizeVariance();
      if (variance > 0.5) {
        recommendations.push('Batch sizes vary significantly - consider consistent sizing');
      }
    }

    const elapsed = Date.now() - this.metrics.startTime;
    if (elapsed > 30000 && this.metrics.totalItemsRetrieved < 1000) {
      recommendations.push('Operation taking long time for small dataset - check API performance');
    }

    return recommendations;
  }

  /**
   * Calculate variance in batch sizes
   */
  private calculateBatchSizeVariance(): number {
    if (this.batchSizes.length < 2) return 0;

    const mean = this.batchSizes.reduce((sum, size) => sum + size, 0) / this.batchSizes.length;
    const variance = this.batchSizes.reduce((sum, size) => sum + Math.pow(size - mean, 2), 0) / this.batchSizes.length;
    return Math.sqrt(variance) / mean; // Coefficient of variation
  }
}

/**
 * Create a performance monitor with default thresholds for different operation types
 */
export function createPerformanceMonitor(operationType: 'accounts' | 'campaigns' | 'emails' | 'leads'): PaginationPerformanceMonitor {
  const thresholds: Partial<PerformanceThresholds> = {};

  switch (operationType) {
    case 'accounts':
      // Accounts are typically smaller datasets
      thresholds.maxDurationMs = 30000; // 30 seconds
      thresholds.maxApiCalls = 20;
      thresholds.minItemsPerCall = 20;
      break;
    case 'campaigns':
      // Campaigns can be moderate size
      thresholds.maxDurationMs = 45000; // 45 seconds
      thresholds.maxApiCalls = 30;
      thresholds.minItemsPerCall = 15;
      break;
    case 'emails':
      // Emails can be very large datasets
      thresholds.maxDurationMs = 120000; // 2 minutes
      thresholds.maxApiCalls = 100;
      thresholds.minItemsPerCall = 50;
      thresholds.maxMemoryMB = 200;
      break;
    case 'leads':
      // Leads can be very large datasets
      thresholds.maxDurationMs = 180000; // 3 minutes
      thresholds.maxApiCalls = 150;
      thresholds.minItemsPerCall = 100;
      thresholds.maxMemoryMB = 300;
      break;
  }

  return new PaginationPerformanceMonitor(thresholds);
}
