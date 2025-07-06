/**
 * Smart pagination configuration system
 * Allows users to control pagination behavior based on their needs
 */

export interface PaginationStrategy {
  name: string;
  description: string;
  maxPages: number;
  batchSize: number;
  enablePerformanceMonitoring: boolean;
  timeoutMs: number;
  retryAttempts: number;
  useCase: string;
}

export interface SmartPaginationConfig {
  strategy: 'fast' | 'balanced' | 'complete' | 'enterprise' | 'custom';
  customStrategy?: Partial<PaginationStrategy>;
  enableAdaptive?: boolean;
  workspaceSize?: 'small' | 'medium' | 'large' | 'enterprise';
}

/**
 * Predefined pagination strategies
 */
export const PAGINATION_STRATEGIES: Record<string, PaginationStrategy> = {
  fast: {
    name: 'Fast',
    description: 'Quick results with limited pagination - good for previews',
    maxPages: 5,
    batchSize: 50,
    enablePerformanceMonitoring: false,
    timeoutMs: 15000,
    retryAttempts: 1,
    useCase: 'Quick previews, small workspaces, development testing'
  },
  
  balanced: {
    name: 'Balanced',
    description: 'Good balance of speed and completeness - recommended default',
    maxPages: 20,
    batchSize: 100,
    enablePerformanceMonitoring: true,
    timeoutMs: 60000,
    retryAttempts: 2,
    useCase: 'Most production use cases, medium workspaces'
  },
  
  complete: {
    name: 'Complete',
    description: 'Ensures complete data retrieval - bulletproof pagination',
    maxPages: 50,
    batchSize: 100,
    enablePerformanceMonitoring: true,
    timeoutMs: 120000,
    retryAttempts: 3,
    useCase: 'Large workspaces, critical operations, campaign creation'
  },
  
  enterprise: {
    name: 'Enterprise',
    description: 'Maximum reliability for enterprise-scale operations',
    maxPages: 100,
    batchSize: 100,
    enablePerformanceMonitoring: true,
    timeoutMs: 300000,
    retryAttempts: 5,
    useCase: 'Enterprise workspaces, bulk operations, data migration'
  }
};

/**
 * Adaptive pagination that adjusts strategy based on workspace characteristics
 */
export class AdaptivePaginationManager {
  private workspaceMetrics: {
    accountCount?: number;
    campaignCount?: number;
    emailCount?: number;
    avgResponseTime?: number;
    errorRate?: number;
  } = {};

  /**
   * Update workspace metrics for adaptive decisions
   */
  updateWorkspaceMetrics(metrics: Partial<typeof this.workspaceMetrics>): void {
    this.workspaceMetrics = { ...this.workspaceMetrics, ...metrics };
  }

  /**
   * Get recommended strategy based on workspace characteristics
   */
  getRecommendedStrategy(operationType: 'accounts' | 'campaigns' | 'emails' | 'leads'): PaginationStrategy {
    // Determine workspace size
    const workspaceSize = this.determineWorkspaceSize(operationType);
    
    // Determine performance characteristics
    const performanceLevel = this.determinePerformanceLevel();
    
    // Select strategy based on analysis
    if (workspaceSize === 'enterprise' || performanceLevel === 'slow') {
      return PAGINATION_STRATEGIES.enterprise;
    } else if (workspaceSize === 'large') {
      return PAGINATION_STRATEGIES.complete;
    } else if (workspaceSize === 'medium') {
      return PAGINATION_STRATEGIES.balanced;
    } else {
      return PAGINATION_STRATEGIES.fast;
    }
  }

  /**
   * Determine workspace size based on known metrics
   */
  private determineWorkspaceSize(operationType: string): 'small' | 'medium' | 'large' | 'enterprise' {
    let itemCount = 0;
    
    switch (operationType) {
      case 'accounts':
        itemCount = this.workspaceMetrics.accountCount || 0;
        break;
      case 'campaigns':
        itemCount = this.workspaceMetrics.campaignCount || 0;
        break;
      case 'emails':
        itemCount = this.workspaceMetrics.emailCount || 0;
        break;
      default:
        itemCount = 0;
    }

    if (itemCount > 1000) return 'enterprise';
    if (itemCount > 500) return 'large';
    if (itemCount > 100) return 'medium';
    return 'small';
  }

  /**
   * Determine performance level based on response times and error rates
   */
  private determinePerformanceLevel(): 'fast' | 'normal' | 'slow' {
    const avgResponseTime = this.workspaceMetrics.avgResponseTime || 1000;
    const errorRate = this.workspaceMetrics.errorRate || 0;

    if (avgResponseTime > 3000 || errorRate > 0.1) return 'slow';
    if (avgResponseTime > 1500 || errorRate > 0.05) return 'normal';
    return 'fast';
  }

  /**
   * Get adaptive configuration for pagination
   */
  getAdaptiveConfig(
    operationType: 'accounts' | 'campaigns' | 'emails' | 'leads',
    userConfig?: SmartPaginationConfig
  ): PaginationStrategy {
    // Start with user preference or recommended strategy
    let strategy: PaginationStrategy;
    
    if (userConfig?.strategy === 'custom' && userConfig.customStrategy) {
      strategy = { ...PAGINATION_STRATEGIES.balanced, ...userConfig.customStrategy };
    } else if (userConfig?.strategy && PAGINATION_STRATEGIES[userConfig.strategy]) {
      strategy = PAGINATION_STRATEGIES[userConfig.strategy];
    } else if (userConfig?.enableAdaptive !== false) {
      strategy = this.getRecommendedStrategy(operationType);
    } else {
      strategy = PAGINATION_STRATEGIES.balanced;
    }

    // Apply adaptive adjustments
    if (userConfig?.enableAdaptive !== false) {
      strategy = this.applyAdaptiveAdjustments(strategy, operationType);
    }

    return strategy;
  }

  /**
   * Apply adaptive adjustments to strategy
   */
  private applyAdaptiveAdjustments(
    strategy: PaginationStrategy,
    operationType: string
  ): PaginationStrategy {
    const adjusted = { ...strategy };

    // Adjust batch size based on operation type
    switch (operationType) {
      case 'emails':
        // Emails can be large datasets, use larger batches
        adjusted.batchSize = Math.min(adjusted.batchSize * 1.5, 150);
        break;
      case 'leads':
        // Leads can be very large, use maximum batch size
        adjusted.batchSize = Math.min(adjusted.batchSize * 2, 200);
        break;
      case 'accounts':
        // Accounts are typically smaller, standard batch size is fine
        break;
      case 'campaigns':
        // Campaigns are usually small datasets
        adjusted.batchSize = Math.max(adjusted.batchSize * 0.8, 50);
        break;
    }

    // Adjust timeouts based on performance
    const performanceLevel = this.determinePerformanceLevel();
    if (performanceLevel === 'slow') {
      adjusted.timeoutMs *= 2;
      adjusted.retryAttempts += 1;
    } else if (performanceLevel === 'fast') {
      adjusted.timeoutMs *= 0.7;
    }

    return adjusted;
  }
}

/**
 * Create pagination configuration from user preferences
 */
export function createPaginationConfig(
  operationType: 'accounts' | 'campaigns' | 'emails' | 'leads',
  userConfig?: SmartPaginationConfig,
  adaptiveManager?: AdaptivePaginationManager
): PaginationStrategy {
  if (adaptiveManager) {
    return adaptiveManager.getAdaptiveConfig(operationType, userConfig);
  }

  // Fallback to static configuration
  if (userConfig?.strategy === 'custom' && userConfig.customStrategy) {
    return { ...PAGINATION_STRATEGIES.balanced, ...userConfig.customStrategy };
  }

  const strategyName = userConfig?.strategy || 'balanced';
  return PAGINATION_STRATEGIES[strategyName] || PAGINATION_STRATEGIES.balanced;
}

/**
 * Get pagination strategy recommendations for different scenarios
 */
export function getPaginationRecommendations(): Record<string, string> {
  return {
    'Development/Testing': 'Use "fast" strategy for quick iterations',
    'Production (Small Team)': 'Use "balanced" strategy for good performance',
    'Production (Large Team)': 'Use "complete" strategy for reliability',
    'Enterprise/Bulk Operations': 'Use "enterprise" strategy for maximum reliability',
    'Campaign Creation': 'Use "complete" strategy to see all available accounts',
    'Quick Previews': 'Use "fast" strategy for immediate results',
    'Data Migration': 'Use "enterprise" strategy with custom timeouts',
    'API Exploration': 'Use "fast" strategy to avoid long waits'
  };
}

/**
 * Validate pagination configuration
 */
export function validatePaginationConfig(config: SmartPaginationConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (config.strategy === 'custom') {
    if (!config.customStrategy) {
      errors.push('Custom strategy requires customStrategy configuration');
    } else {
      const custom = config.customStrategy;
      if (custom.maxPages && (custom.maxPages < 1 || custom.maxPages > 200)) {
        errors.push('maxPages must be between 1 and 200');
      }
      if (custom.batchSize && (custom.batchSize < 1 || custom.batchSize > 500)) {
        errors.push('batchSize must be between 1 and 500');
      }
      if (custom.timeoutMs && (custom.timeoutMs < 1000 || custom.timeoutMs > 600000)) {
        errors.push('timeoutMs must be between 1000 and 600000 (10 minutes)');
      }
      if (custom.retryAttempts && (custom.retryAttempts < 0 || custom.retryAttempts > 10)) {
        errors.push('retryAttempts must be between 0 and 10');
      }
    }
  } else if (config.strategy && !PAGINATION_STRATEGIES[config.strategy]) {
    errors.push(`Unknown strategy: ${config.strategy}. Available: ${Object.keys(PAGINATION_STRATEGIES).join(', ')}`);
  }

  return { valid: errors.length === 0, errors };
}
