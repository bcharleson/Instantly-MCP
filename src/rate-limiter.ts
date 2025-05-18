export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
}

export class RateLimiter {
  private rateLimitInfo: RateLimitInfo | null = null;

  updateFromHeaders(headers: Headers): void {
    const limit = headers.get('x-ratelimit-limit');
    const remaining = headers.get('x-ratelimit-remaining');
    const reset = headers.get('x-ratelimit-reset');

    if (limit && remaining && reset) {
      this.rateLimitInfo = {
        limit: parseInt(limit, 10),
        remaining: parseInt(remaining, 10),
        reset: new Date(parseInt(reset, 10) * 1000), // Convert Unix timestamp to Date
      };
    }
  }

  getRateLimitInfo(): RateLimitInfo | null {
    return this.rateLimitInfo;
  }

  isRateLimited(): boolean {
    return this.rateLimitInfo ? this.rateLimitInfo.remaining === 0 : false;
  }

  getTimeUntilReset(): number {
    if (!this.rateLimitInfo) return 0;
    
    const now = new Date();
    const resetTime = this.rateLimitInfo.reset;
    return Math.max(0, resetTime.getTime() - now.getTime());
  }

  getRateLimitMessage(): string {
    if (!this.rateLimitInfo) return '';
    
    const { limit, remaining, reset } = this.rateLimitInfo;
    const timeUntilReset = this.getTimeUntilReset();
    const minutesUntilReset = Math.ceil(timeUntilReset / 60000);
    
    return `Rate limit: ${remaining}/${limit} remaining. Resets in ${minutesUntilReset} minutes.`;
  }
}

// Global rate limiter instance
export const rateLimiter = new RateLimiter();