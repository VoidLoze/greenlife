package kz.greenleaf.store.catalog.search;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/** Tracks successful search queries in a Redis sorted set to offer "popular searches" in the search box. */
@Service
public class SearchAnalytics {

    private static final Logger log = LoggerFactory.getLogger(SearchAnalytics.class);
    private static final String KEY = "search:popular";
    private static final int KEEP = 500;

    private final StringRedisTemplate redis;

    public SearchAnalytics(StringRedisTemplate redis) {
        this.redis = redis;
    }

    public void record(String query, long resultCount) {
        if (query == null || resultCount == 0) {
            return;
        }
        String normalized = query.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
        if (normalized.length() < 3 || normalized.length() > 60) {
            return;
        }
        try {
            redis.opsForZSet().incrementScore(KEY, normalized, 1);
        } catch (RuntimeException ex) {
            log.debug("Search analytics unavailable: {}", ex.getMessage());
        }
    }

    public List<String> popular(String prefix, int limit) {
        try {
            Set<String> top = redis.opsForZSet().reverseRange(KEY, 0, 99);
            if (top == null) {
                return List.of();
            }
            String normalizedPrefix = prefix == null ? null : prefix.trim().toLowerCase(Locale.ROOT);
            List<String> result = new ArrayList<>();
            for (String item : top) {
                if (normalizedPrefix == null || normalizedPrefix.isEmpty()
                        || (item.startsWith(normalizedPrefix) && !item.equals(normalizedPrefix))) {
                    result.add(item);
                }
                if (result.size() >= limit) {
                    break;
                }
            }
            return List.copyOf(result);
        } catch (RuntimeException ex) {
            log.debug("Search analytics unavailable: {}", ex.getMessage());
            return List.of();
        }
    }

    @Scheduled(cron = "0 0 * * * *")
    public void trim() {
        try {
            redis.opsForZSet().removeRange(KEY, 0, -(KEEP + 1));
        } catch (RuntimeException ex) {
            log.debug("Search analytics trim failed: {}", ex.getMessage());
        }
    }
}
