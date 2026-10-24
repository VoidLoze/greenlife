package kz.greenleaf.store.config;

import java.time.Duration;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.Cache;
import org.springframework.cache.annotation.CachingConfigurer;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.interceptor.CacheErrorHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.BatchStrategies;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.cache.RedisCacheWriter;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.JdkSerializationRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext.SerializationPair;
import org.springframework.data.redis.serializer.StringRedisSerializer;

@Configuration
@EnableCaching
public class CacheConfig implements CachingConfigurer {

    public static final String CATEGORIES = "catalog:categories";
    public static final String BRANDS = "catalog:brands";
    public static final String SEARCH = "catalog:search";
    public static final String FACETS = "catalog:facets";
    public static final String PRODUCT = "catalog:product";
    public static final String RELATED = "catalog:related";
    public static final String HOME = "catalog:home";
    public static final String SUGGEST = "catalog:suggest";
    public static final String SITE_SETTINGS = "site:settings";

    public static final String[] CATALOG_CACHES = {CATEGORIES, BRANDS, SEARCH, FACETS, PRODUCT, RELATED, HOME, SUGGEST};

    private static final Logger log = LoggerFactory.getLogger(CacheConfig.class);

    @Bean
    public RedisCacheManager cacheManager(RedisConnectionFactory connectionFactory) {
        RedisCacheConfiguration defaults = RedisCacheConfiguration.defaultCacheConfig()
                .prefixCacheNameWith("gl:")
                .serializeKeysWith(SerializationPair.fromSerializer(new StringRedisSerializer()))
                .serializeValuesWith(SerializationPair.fromSerializer(
                        new JdkSerializationRedisSerializer(getClass().getClassLoader())))
                .disableCachingNullValues()
                .entryTtl(Duration.ofMinutes(10));

        Map<String, RedisCacheConfiguration> perCache = Map.of(
                CATEGORIES, defaults.entryTtl(Duration.ofHours(1)),
                BRANDS, defaults.entryTtl(Duration.ofHours(1)),
                SEARCH, defaults.entryTtl(Duration.ofMinutes(5)),
                FACETS, defaults.entryTtl(Duration.ofMinutes(5)),
                PRODUCT, defaults.entryTtl(Duration.ofMinutes(30)),
                RELATED, defaults.entryTtl(Duration.ofMinutes(30)),
                HOME, defaults.entryTtl(Duration.ofMinutes(10)),
                SUGGEST, defaults.entryTtl(Duration.ofMinutes(5)),
                SITE_SETTINGS, defaults.entryTtl(Duration.ofHours(1)));

        RedisCacheWriter writer = RedisCacheWriter.nonLockingRedisCacheWriter(connectionFactory, BatchStrategies.scan(500));
        return RedisCacheManager.builder(writer)
                .cacheDefaults(defaults)
                .withInitialCacheConfigurations(perCache)
                .transactionAware()
                .build();
    }

    /** A Redis outage degrades to uncached reads instead of failing requests. */
    @Override
    public CacheErrorHandler errorHandler() {
        return new CacheErrorHandler() {
            @Override
            public void handleCacheGetError(RuntimeException ex, Cache cache, Object key) {
                log.warn("Cache get failed [{}]: {}", cache.getName(), ex.getMessage());
            }

            @Override
            public void handleCachePutError(RuntimeException ex, Cache cache, Object key, Object value) {
                log.warn("Cache put failed [{}]: {}", cache.getName(), ex.getMessage());
            }

            @Override
            public void handleCacheEvictError(RuntimeException ex, Cache cache, Object key) {
                log.warn("Cache evict failed [{}]: {}", cache.getName(), ex.getMessage());
            }

            @Override
            public void handleCacheClearError(RuntimeException ex, Cache cache) {
                log.warn("Cache clear failed [{}]: {}", cache.getName(), ex.getMessage());
            }
        };
    }
}
