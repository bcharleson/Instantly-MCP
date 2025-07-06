export class RateLimiter {
    constructor() {
        this.rateLimitInfo = null;
    }
    updateFromHeaders(headers) {
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
    getRateLimitInfo() {
        return this.rateLimitInfo;
    }
    isRateLimited() {
        return this.rateLimitInfo ? this.rateLimitInfo.remaining === 0 : false;
    }
    getTimeUntilReset() {
        if (!this.rateLimitInfo)
            return 0;
        const now = new Date();
        const resetTime = this.rateLimitInfo.reset;
        return Math.max(0, resetTime.getTime() - now.getTime());
    }
    getRateLimitMessage() {
        if (!this.rateLimitInfo)
            return '';
        const { limit, remaining, reset } = this.rateLimitInfo;
        const timeUntilReset = this.getTimeUntilReset();
        const minutesUntilReset = Math.ceil(timeUntilReset / 60000);
        return `Rate limit: ${remaining}/${limit} remaining. Resets in ${minutesUntilReset} minutes.`;
    }
}
// Global rate limiter instance
export const rateLimiter = new RateLimiter();
//# sourceMappingURL=rate-limiter.js.map