export interface RateLimitInfo {
    limit: number;
    remaining: number;
    reset: Date;
}
export declare class RateLimiter {
    private rateLimitInfo;
    updateFromHeaders(headers: Headers): void;
    getRateLimitInfo(): RateLimitInfo | null;
    isRateLimited(): boolean;
    getTimeUntilReset(): number;
    getRateLimitMessage(): string;
}
export declare const rateLimiter: RateLimiter;
