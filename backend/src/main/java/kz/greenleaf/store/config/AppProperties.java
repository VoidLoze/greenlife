package kz.greenleaf.store.config;

import jakarta.validation.Valid;
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
        @Valid @NotNull Seed seed) {

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
            @Min(1) int ordersPerHour) {
    }

    public record Storage(@NotBlank String root, @NotBlank String publicPrefix, @Min(64) int thumbnailWidth) {
    }

    public record Pricing(
            @Min(0) int partnerDiscountPercent,
            @NotNull BigDecimal deliveryFee,
            @NotNull BigDecimal freeDeliveryThreshold,
            @Min(1) int maxQuantityPerItem) {
    }

    public record Cart(@NotNull Duration ttl) {
    }

    public record Views(@NotNull Duration dedupeWindow, @NotNull Duration flushInterval) {
    }

    public record Admin(String email, String password, String fullName) {
    }

    public record Seed(boolean enabled, String dir) {
    }
}
