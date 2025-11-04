declare module 'telegraf-ratelimit' {
  import { Middleware } from 'telegraf';

  interface RateLimitConfig {
    in: number;
    out: number;
    unique?: boolean;
  }

  function rateLimit(config: RateLimitConfig): Middleware<any>;

  export default rateLimit;
}