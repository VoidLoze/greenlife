package kz.greenleaf.store.catalog;

import java.util.Map;
import java.util.UUID;
import kz.greenleaf.store.catalog.repo.ProductRepository;
import kz.greenleaf.store.config.AppProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Counts product views in Redis (one view per visitor per window) and periodically flushes
 * the aggregated deltas to PostgreSQL in one batch, so product pages never write to the DB.
 */
@Service
public class ViewCounterService {

    private static final Logger log = LoggerFactory.getLogger(ViewCounterService.class);
    private static final String PENDING_KEY = "views:pending";
    private static final String SEEN_PREFIX = "views:seen:";

    private final StringRedisTemplate redis;
    private final ProductRepository products;
    private final TransactionTemplate tx;
    private final AppProperties.Views props;

    public ViewCounterService(StringRedisTemplate redis, ProductRepository products, TransactionTemplate tx,
                              AppProperties properties) {
        this.redis = redis;
        this.products = products;
        this.tx = tx;
        this.props = properties.views();
    }

    public void register(Long productId, String visitorKey) {
        try {
            Boolean first = redis.opsForValue()
                    .setIfAbsent(SEEN_PREFIX + productId + ":" + visitorKey, "1", props.dedupeWindow());
            if (Boolean.TRUE.equals(first)) {
                redis.opsForHash().increment(PENDING_KEY, productId.toString(), 1);
            }
        } catch (RuntimeException ex) {
            log.debug("View counter unavailable: {}", ex.getMessage());
        }
    }

    @Scheduled(fixedDelayString = "${app.views.flush-interval}", initialDelayString = "PT30S")
    public void flush() {
        String batchKey = PENDING_KEY + ":flush:" + UUID.randomUUID();
        Map<Object, Object> pending;
        try {
            if (!Boolean.TRUE.equals(redis.hasKey(PENDING_KEY))) {
                return;
            }
            redis.rename(PENDING_KEY, batchKey);
            pending = redis.opsForHash().entries(batchKey);
        } catch (RuntimeException ex) {
            log.debug("View flush skipped: {}", ex.getMessage());
            return;
        }
        try {
            tx.executeWithoutResult(status -> pending.forEach((id, delta) ->
                    products.addViews(Long.valueOf(id.toString()), Long.parseLong(delta.toString()))));
            redis.delete(batchKey);
            log.debug("Flushed views for {} products", pending.size());
        } catch (RuntimeException ex) {
            log.warn("Failed to flush product views, will retry: {}", ex.getMessage());
            pending.forEach((id, delta) ->
                    redis.opsForHash().increment(PENDING_KEY, id.toString(), Long.parseLong(delta.toString())));
            redis.delete(batchKey);
        }
    }
}
