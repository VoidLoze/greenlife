package kz.greenleaf.store.favorites;

import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

/**
 * A signed-in shopper's favourites and recently viewed products live in Redis, so they leave the browser on sign-out
 * and come back on the next sign-in (on any device). Guests keep both lists in the browser only.
 */
@Service
public class FavoritesService {

    static final int MAX_FAVORITES = 60;
    static final int MAX_VIEWED = 12;

    private static final Logger log = LoggerFactory.getLogger(FavoritesService.class);
    private static final String PREFIX = "favorites:";
    private static final String FAVORITES = "favorites";
    private static final String VIEWED = "viewed";
    /** Refreshed on every sign-in and change, so only lists of long-gone accounts expire. */
    private static final Duration TTL = Duration.ofDays(365);

    private final StringRedisTemplate redis;

    public FavoritesService(StringRedisTemplate redis) {
        this.redis = redis;
    }

    public record Lists(List<Long> favorites, List<Long> viewed) {
    }

    public Lists read(Long userId) {
        Map<Object, Object> raw;
        try {
            raw = redis.opsForHash().entries(PREFIX + userId);
        } catch (DataAccessException ex) {
            log.warn("Favourites storage unavailable: {}", ex.getMessage());
            return new Lists(List.of(), List.of());
        }
        return new Lists(parse(raw.get(FAVORITES)), parse(raw.get(VIEWED)));
    }

    /** Written as received — a Redis outage must not empty the lists the browser still holds. */
    public Lists replace(Long userId, Lists incoming) {
        Lists lists = normalize(incoming.favorites(), incoming.viewed());
        write(userId, lists);
        return lists;
    }

    /** On sign-in the browser's lists go in front of the saved ones; nothing appears twice. */
    public Lists merge(Long userId, Lists incoming) {
        Lists saved = read(userId);
        Lists lists = normalize(concat(incoming.favorites(), saved.favorites()), concat(incoming.viewed(), saved.viewed()));
        write(userId, lists);
        return lists;
    }

    static Lists normalize(List<Long> favorites, List<Long> viewed) {
        return new Lists(distinct(favorites, MAX_FAVORITES), distinct(viewed, MAX_VIEWED));
    }

    private void write(Long userId, Lists lists) {
        String key = PREFIX + userId;
        try {
            if (lists.favorites().isEmpty() && lists.viewed().isEmpty()) {
                redis.delete(key);
                return;
            }
            redis.opsForHash().putAll(key, Map.of(FAVORITES, join(lists.favorites()), VIEWED, join(lists.viewed())));
            redis.expire(key, TTL);
        } catch (DataAccessException ex) {
            log.warn("Failed to persist favourites for user {}: {}", userId, ex.getMessage());
        }
    }

    private static List<Long> concat(List<Long> first, List<Long> second) {
        List<Long> all = new ArrayList<>(first);
        all.addAll(second);
        return all;
    }

    private static List<Long> distinct(List<Long> ids, int max) {
        Set<Long> unique = new LinkedHashSet<>();
        for (Long id : ids) {
            if (id != null && id > 0) {
                unique.add(id);
            }
            if (unique.size() >= max) {
                break;
            }
        }
        return List.copyOf(unique);
    }

    private static String join(List<Long> ids) {
        return String.join(",", ids.stream().map(String::valueOf).toList());
    }

    static List<Long> parse(Object raw) {
        if (!(raw instanceof String text) || text.isBlank()) {
            return List.of();
        }
        List<Long> ids = new ArrayList<>();
        for (String part : text.split(",")) {
            try {
                ids.add(Long.parseLong(part.trim()));
            } catch (NumberFormatException ignored) {
                // A corrupted entry is skipped rather than breaking the whole list.
            }
        }
        return ids;
    }
}
