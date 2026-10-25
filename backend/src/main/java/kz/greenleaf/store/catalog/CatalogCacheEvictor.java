package kz.greenleaf.store.catalog;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import kz.greenleaf.store.config.CacheConfig;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.cache.transaction.TransactionAwareCacheDecorator;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/** Any catalog mutation invalidates every catalog read model; with a small catalog this is cheap and always correct. */
@Component
public class CatalogCacheEvictor {

    /**
     * A reader that loaded the old data just before a change can still write it into the cache right after the
     * clear; a second clear a moment later removes that stale entry.
     */
    private static final Executor LATER = CompletableFuture.delayedExecutor(3, TimeUnit.SECONDS);

    private final CacheManager cacheManager;
    private final AtomicBoolean followUpPending = new AtomicBoolean();

    public CatalogCacheEvictor(CacheManager cacheManager) {
        this.cacheManager = cacheManager;
    }

    /** Cached read models are Java-serialized, so entries written by a previous release must not survive a deploy. */
    @EventListener(ApplicationReadyEvent.class)
    public void evictOnStartup() {
        try {
            clearNow(CacheConfig.CATALOG_CACHES);
            clearNow(CacheConfig.SITE_SETTINGS);
        } catch (RuntimeException ignored) {
            // Redis being down at startup only means there is nothing to evict.
        }
    }

    /** Inside a transaction the clear happens after the commit (the cache manager is transaction-aware). */
    public void evictAll() {
        for (String name : CacheConfig.CATALOG_CACHES) {
            Cache cache = cacheManager.getCache(name);
            if (cache != null) {
                cache.clear();
            }
        }
        if (followUpPending.compareAndSet(false, true)) {
            LATER.execute(() -> {
                followUpPending.set(false);
                try {
                    clearNow(CacheConfig.CATALOG_CACHES);
                } catch (RuntimeException ignored) {
                    // Best effort: entries expire by TTL anyway.
                }
            });
        }
    }

    private void clearNow(String... names) {
        for (String name : names) {
            Cache cache = cacheManager.getCache(name);
            if (cache instanceof TransactionAwareCacheDecorator decorator) {
                decorator.getTargetCache().clear();
            } else if (cache != null) {
                cache.clear();
            }
        }
    }
}
