package kz.greenleaf.store.config;

import jakarta.annotation.PostConstruct;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/** Refuses to run with secrets copied from examples and warns about settings that break a real HTTPS deployment. */
@Component
public class StartupSafetyCheck {

    private static final Logger log = LoggerFactory.getLogger(StartupSafetyCheck.class);

    private final AppProperties properties;

    public StartupSafetyCheck(AppProperties properties) {
        this.properties = properties;
    }

    @PostConstruct
    void check() {
        String secret = properties.jwt().secret().toLowerCase(Locale.ROOT);
        if (secret.startsWith("change-me") || secret.contains("dev-only")) {
            throw new IllegalStateException("JWT_SECRET is an example value — anyone could forge an admin token. "
                    + "Generate one with: openssl rand -base64 48");
        }
        boolean https = properties.publicUrl().toLowerCase(Locale.ROOT).startsWith("https://");
        if (https && !properties.jwt().refreshCookieSecure()) {
            log.warn("APP_PUBLIC_URL is https but REFRESH_COOKIE_SECURE=false — the session cookie may travel unencrypted. "
                    + "Set REFRESH_COOKIE_SECURE=true.");
        }
    }
}
