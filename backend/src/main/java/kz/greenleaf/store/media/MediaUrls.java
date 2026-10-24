package kz.greenleaf.store.media;

import kz.greenleaf.store.config.AppProperties;
import org.springframework.stereotype.Component;

@Component
public class MediaUrls {

    private final String prefix;

    public MediaUrls(AppProperties properties) {
        String configured = properties.storage().publicPrefix();
        this.prefix = configured.endsWith("/") ? configured.substring(0, configured.length() - 1) : configured;
    }

    public String url(String key) {
        return key == null ? null : prefix + "/" + key;
    }

    public String prefix() {
        return prefix;
    }
}
