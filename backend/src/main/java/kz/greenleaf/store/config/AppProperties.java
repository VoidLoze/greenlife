package kz.greenleaf.store.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "app")
public record AppProperties(
        @NotBlank String publicUrl,
        @Valid @NotNull Store store,
        @Valid @NotNull Cors cors,
        @Valid @NotNull Jwt jwt,
        @Valid @NotNull Security security,
        @Valid @NotNull Storage storage,
        @Valid @NotNull Pricing pricing,
        @Valid @NotNull Cart cart,
        @Valid @NotNull Views views,
        @Valid @NotNull Admin admin,
        @Valid @NotNull Seed seed,
        @Valid @NotNull Alerts alerts) {

    public record Store(
            @NotBlank String name,
            @NotBlank String phone,
            @NotBlank String whatsapp,
            String telegramUrl,
            String instagramUrl,
            String city,
            String address,
            String workingHours,
            String companyVideoUrl,
            String companyVideoTitle) {
    }

    public record Cors(List<String> allowedOrigins) {
    }

    public record Jwt(
            @NotBlank @Size(min = 32, message = "JWT secret must be at least 32 characters") String secret,
            @NotBlank String issuer,
            @NotNull Duration accessTokenTtl,
            @NotNull Duration refreshTokenTtl,
            @NotBlank String refreshCookieName,
            boolean refreshCookieSecure) {
    }

    public record Security(
            @Min(1) int loginMaxAttempts,
            @NotNull Duration loginLockDuration,
            @Min(1) int registerPerHour,
            @Min(1) int ordersPerHour,
            /* Unconfirmed (NEW) orders one phone number may have open at once — fake orders cannot drain the stock. */
            @Min(1) int openOrdersPerPhone,
            /* NEW orders nobody confirmed within this many hours are cancelled and their stock released; 0 = never. */
            @Min(0) int autoCancelNewAfterHours) {
    }

    public record Storage(@NotBlank String root, @NotBlank String publicPrefix, @Min(64) int thumbnailWidth) {
    }

    public record Pricing(
            @Min(0) @Max(100) int partnerDiscountPercent,
            @NotNull BigDecimal deliveryFee,
            @NotNull BigDecimal freeDeliveryThreshold,
            /* Free delivery is earned only by retail-price orders; partners get it on the day they buy the card. */
            boolean freeDeliveryRetailOnly,
            @Min(1) int maxQuantityPerItem) {
    }

    public record Cart(@NotNull Duration ttl) {
    }

    public record Views(@NotNull Duration dedupeWindow, @NotNull Duration flushInterval) {
    }

    /* With syncPassword the administrator's password is reset to ADMIN_PASSWORD on every start (to rotate it). */
    public record Admin(String email, String password, String fullName, boolean syncPassword) {
    }

    /* New-order alerts to a Telegram chat; both values empty = alerts off. */
    public record Alerts(String telegramBotToken, String telegramChatId) {
        public boolean telegramEnabled() {
            return telegramBotToken != null && !telegramBotToken.isBlank()
                    && telegramChatId != null && !telegramChatId.isBlank();
        }
    }

    public record Seed(boolean enabled, String dir) {
    }
}
