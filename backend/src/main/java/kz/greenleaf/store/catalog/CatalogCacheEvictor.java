package kz.greenleaf.store.catalog;

import kz.greenleaf.store.config.CacheConfig;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/** Any catalog mutation invalidates every catalog read model; with a small catalog this is cheap and always correct. */
@Component
public class CatalogCacheEvictor {

    private final CacheManager cacheManager;

    public CatalogCacheEvictor(CacheManager cacheManager) {
        this.cacheManager = cacheManager;
    }

    /** Cached read models are Java-serialized, so entries written by a previous release must not survive a deploy. */
    @EventListener(ApplicationReadyEvent.class)
    public void evictOnStartup() {
        try {
            evictAll();
        } catch (RuntimeException ignored) {
            // Redis being down at startup only means there is nothing to evict.
        }
    }

    public void evictAll() {
        for (String name : CacheConfig.CATALOG_CACHES) {
            Cache cache = cacheManager.getCache(name);
            if (cache != null) {
                cache.clear();
            }
        }
    }
}
