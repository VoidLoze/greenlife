package kz.greenleaf.store.config;

import java.time.Duration;
import kz.greenleaf.store.media.LocalFileStorage;
import kz.greenleaf.store.media.MediaUrls;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final LocalFileStorage storage;
    private final MediaUrls urls;

    public WebConfig(LocalFileStorage storage, MediaUrls urls) {
        this.storage = storage;
        this.urls = urls;
    }

    /** Stored files have random immutable keys, so they can be cached forever by browsers and the proxy. */
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler(urls.prefix() + "/**")
                .addResourceLocations(storage.root().toUri().toString())
                .setCacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable());
    }
}
