package kz.greenleaf.store.common;

import java.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/** Fixed-window counters in Redis, shared across all backend instances. */
@Component
public class RateLimiter {

    private static final Logger log = LoggerFactory.getLogger(RateLimiter.class);
    private static final String PREFIX = "ratelimit:";

    private final StringRedisTemplate redis;

    public RateLimiter(StringRedisTemplate redis) {
        this.redis = redis;
    }

    public void acquireOrThrow(String bucket, int limit, Duration window, String message) {
        if (!tryAcquire(bucket, limit, window)) {
            throw ApiException.tooManyRequests(message);
        }
    }

    public boolean tryAcquire(String bucket, int limit, Duration window) {
        try {
            String key = PREFIX + bucket;
            Long count = redis.opsForValue().increment(key);
            if (count != null && count == 1L) {
                redis.expire(key, window);
            }
            return count == null || count <= limit;
        } catch (RuntimeException ex) {
            log.warn("Rate limiter unavailable for {}: {}", bucket, ex.getMessage());
            return true;
        }
    }

    public long count(String bucket) {
        try {
            String value = redis.opsForValue().get(PREFIX + bucket);
            return value == null ? 0 : Long.parseLong(value);
        } catch (RuntimeException ex) {
            return 0;
        }
    }

    public Duration ttl(String bucket) {
        try {
            Long seconds = redis.getExpire(PREFIX + bucket);
            return seconds == null || seconds < 0 ? Duration.ZERO : Duration.ofSeconds(seconds);
        } catch (RuntimeException ex) {
            return Duration.ZERO;
        }
    }

    public void reset(String bucket) {
        try {
            redis.delete(PREFIX + bucket);
        } catch (RuntimeException ex) {
            log.warn("Rate limiter reset failed for {}: {}", bucket, ex.getMessage());
        }
    }
}
