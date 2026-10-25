package kz.greenleaf.store.site;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;
import kz.greenleaf.store.catalog.CatalogCacheEvictor;
import kz.greenleaf.store.common.ApiException;
import kz.greenleaf.store.common.Phones;
import kz.greenleaf.store.config.AppProperties;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Contacts, delivery terms, the partner discount and order alerts that the owner edits in the admin panel. Every value
 * not set there falls back to the environment (.env), so a fresh install works without touching the admin panel.
 */
@Service
public class StoreSettingsService {

    private static final String PREFIX = "store.";

    private final JdbcTemplate jdbc;
    private final AppProperties properties;
    private final CatalogCacheEvictor cacheEvictor;
    private volatile StoreSettings cached;

    public StoreSettingsService(JdbcTemplate jdbc, AppProperties properties, CatalogCacheEvictor cacheEvictor) {
        this.jdbc = jdbc;
        this.properties = properties;
        this.cacheEvictor = cacheEvictor;
    }

    public record StoreSettings(
            String storeName,
            String phone,
            String whatsapp,
            String telegramUrl,
            String instagramUrl,
            String city,
            String address,
            String workingHours,
            BigDecimal deliveryFee,
            BigDecimal freeDeliveryThreshold,
            boolean freeDeliveryRetailOnly,
            int partnerDiscountPercent,
            int maxQuantityPerItem,
            String telegramBotToken,
            String telegramChatId) {

        public AppProperties.Pricing pricing() {
            return new AppProperties.Pricing(partnerDiscountPercent, deliveryFee, freeDeliveryThreshold,
                    freeDeliveryRetailOnly, maxQuantityPerItem);
        }

        public boolean telegramEnabled() {
            return telegramBotToken != null && !telegramBotToken.isBlank()
                    && telegramChatId != null && !telegramChatId.isBlank();
        }
    }

    /** What the admin form sends; null keeps the current value, an empty string returns to the .env default. */
    public record Update(String phone, String whatsapp, String telegramUrl, String instagramUrl, String city,
                         String address, String workingHours, BigDecimal deliveryFee, BigDecimal freeDeliveryThreshold,
                         Boolean freeDeliveryRetailOnly, Integer partnerDiscountPercent, String telegramBotToken,
                         String telegramChatId) {
    }

    public StoreSettings current() {
        StoreSettings value = cached;
        if (value == null) {
            value = load();
            cached = value;
        }
        return value;
    }

    @Transactional
    public StoreSettings update(Update u) {
        if (u.whatsapp() != null && !u.whatsapp().isBlank() && u.whatsapp().replaceAll("\\D", "").length() < 10) {
            throw ApiException.badRequest("invalid_whatsapp", "WhatsApp: номер целиком, например 77071234567");
        }
        int discountBefore = current().partnerDiscountPercent();
        putText("phone", u.phone(), true);
        putText("whatsapp", u.whatsapp() == null ? null : u.whatsapp().replaceAll("\\D", ""), false);
        putUrl("telegram_url", u.telegramUrl());
        putUrl("instagram_url", u.instagramUrl());
        putText("city", u.city(), false);
        putText("address", u.address(), false);
        putText("working_hours", u.workingHours(), false);
        putMoney("delivery_fee", u.deliveryFee());
        putMoney("free_delivery_threshold", u.freeDeliveryThreshold());
        if (u.freeDeliveryRetailOnly() != null) {
            put("free_delivery_retail_only", u.freeDeliveryRetailOnly().toString());
        }
        if (u.partnerDiscountPercent() != null) {
            if (u.partnerDiscountPercent() < 0 || u.partnerDiscountPercent() > 90) {
                throw ApiException.badRequest("invalid_discount", "Партнёрская скидка: от 0 до 90%");
            }
            put("partner_discount_percent", u.partnerDiscountPercent().toString());
        }
        putText("telegram_bot_token", u.telegramBotToken(), false);
        putText("telegram_chat_id", u.telegramChatId(), false);
        StoreSettings next = load();
        if (next.partnerDiscountPercent() != discountBefore) {
            cacheEvictor.evictAll();
        }
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCompletion(int status) {
                    cached = null;
                }
            });
        } else {
            cached = null;
        }
        return next;
    }

    private StoreSettings load() {
        Map<String, String> v = new HashMap<>();
        jdbc.query("select key, value from site_settings where key like 'store.%' and value is not null",
                rs -> {
                    v.put(rs.getString(1).substring(PREFIX.length()), rs.getString(2));
                });
        AppProperties.Store store = properties.store();
        AppProperties.Pricing pricing = properties.pricing();
        AppProperties.Alerts alerts = properties.alerts();
        return new StoreSettings(
                store.name(),
                v.getOrDefault("phone", store.phone()),
                v.getOrDefault("whatsapp", store.whatsapp()),
                v.getOrDefault("telegram_url", store.telegramUrl()),
                v.getOrDefault("instagram_url", store.instagramUrl()),
                v.getOrDefault("city", store.city()),
                v.getOrDefault("address", store.address()),
                v.getOrDefault("working_hours", store.workingHours()),
                money(v.get("delivery_fee"), pricing.deliveryFee()),
                money(v.get("free_delivery_threshold"), pricing.freeDeliveryThreshold()),
                v.containsKey("free_delivery_retail_only")
                        ? Boolean.parseBoolean(v.get("free_delivery_retail_only"))
                        : pricing.freeDeliveryRetailOnly(),
                v.containsKey("partner_discount_percent")
                        ? Integer.parseInt(v.get("partner_discount_percent"))
                        : pricing.partnerDiscountPercent(),
                pricing.maxQuantityPerItem(),
                v.getOrDefault("telegram_bot_token", alerts == null ? null : alerts.telegramBotToken()),
                v.getOrDefault("telegram_chat_id", alerts == null ? null : alerts.telegramChatId()));
    }

    private void putText(String key, String value, boolean phone) {
        if (value == null) {
            return;
        }
        String trimmed = value.trim();
        if (phone && !trimmed.isEmpty()) {
            trimmed = Phones.normalizeOrThrow(trimmed);
        }
        put(key, trimmed.isEmpty() ? null : trimmed);
    }

    private void putUrl(String key, String value) {
        if (value != null && !value.isBlank() && !value.trim().matches("^https?://\\S+$")) {
            throw ApiException.badRequest("invalid_url", "Ссылка должна начинаться с https://");
        }
        putText(key, value, false);
    }

    private void putMoney(String key, BigDecimal value) {
        if (value == null) {
            return;
        }
        if (value.signum() < 0 || value.scale() > 0 && value.stripTrailingZeros().scale() > 0) {
            throw ApiException.badRequest("invalid_amount", "Сумма — целое число тенге, не меньше нуля");
        }
        put(key, value.stripTrailingZeros().toPlainString());
    }

    private void put(String key, String value) {
        if (value == null) {
            jdbc.update("delete from site_settings where key = ?", PREFIX + key);
            return;
        }
        jdbc.update("""
                insert into site_settings (key, value, updated_at) values (?, ?, now())
                on conflict (key) do update set value = excluded.value, updated_at = now()
                """, PREFIX + key, value);
    }

    private static BigDecimal money(String raw, BigDecimal fallback) {
        if (raw == null) {
            return fallback;
        }
        try {
            return new BigDecimal(raw);
        } catch (NumberFormatException ex) {
            return fallback;
        }
    }
}
