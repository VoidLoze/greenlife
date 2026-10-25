package kz.greenleaf.store.site;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import kz.greenleaf.store.common.ApiException;
import kz.greenleaf.store.notify.TelegramNotifier;
import kz.greenleaf.store.site.StoreSettingsService.StoreSettings;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/settings/store")
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Admin: settings")
public class AdminStoreSettingsController {

    private final StoreSettingsService settings;
    private final TelegramNotifier telegram;

    public AdminStoreSettingsController(StoreSettingsService settings, TelegramNotifier telegram) {
        this.settings = settings;
        this.telegram = telegram;
    }

    /** The bot token is a secret: the form only learns whether one is set and its last characters. */
    public record StoreSettingsDto(String phone, String whatsapp, String telegramUrl, String instagramUrl, String city,
                                   String address, String workingHours, BigDecimal deliveryFee,
                                   BigDecimal freeDeliveryThreshold, boolean freeDeliveryRetailOnly,
                                   int partnerDiscountPercent, boolean telegramConfigured, String telegramTokenHint,
                                   String telegramChatId) {
        static StoreSettingsDto of(StoreSettings s) {
            String token = s.telegramBotToken();
            String hint = token == null || token.length() < 8 ? null : "…" + token.substring(token.length() - 4);
            return new StoreSettingsDto(s.phone(), s.whatsapp(), s.telegramUrl(), s.instagramUrl(), s.city(),
                    s.address(), s.workingHours(), s.deliveryFee(), s.freeDeliveryThreshold(),
                    s.freeDeliveryRetailOnly(), s.partnerDiscountPercent(), s.telegramEnabled(), hint,
                    s.telegramChatId());
        }
    }

    public record UpdateRequest(
            @Size(max = 32) String phone,
            @Size(max = 20) String whatsapp,
            @Size(max = 300) String telegramUrl,
            @Size(max = 300) String instagramUrl,
            @Size(max = 100) String city,
            @Size(max = 300) String address,
            @Size(max = 120) String workingHours,
            @DecimalMin(value = "0", message = "Стоимость доставки не может быть отрицательной") BigDecimal deliveryFee,
            @DecimalMin(value = "0", message = "Порог не может быть отрицательным") BigDecimal freeDeliveryThreshold,
            Boolean freeDeliveryRetailOnly,
            @Min(0) @Max(90) Integer partnerDiscountPercent,
            @Size(max = 100) String telegramBotToken,
            @Size(max = 40) String telegramChatId) {
    }

    public record TelegramTestRequest(@Size(max = 100) String telegramBotToken, @Size(max = 40) String telegramChatId) {
    }

    @GetMapping
    public StoreSettingsDto get() {
        return StoreSettingsDto.of(settings.current());
    }

    @PutMapping
    @Operation(summary = "Контакты, доставка, партнёрская скидка и уведомления о заказах")
    public StoreSettingsDto update(@Valid @RequestBody UpdateRequest r) {
        return StoreSettingsDto.of(settings.update(new StoreSettingsService.Update(r.phone(), r.whatsapp(),
                r.telegramUrl(), r.instagramUrl(), r.city(), r.address(), r.workingHours(), r.deliveryFee(),
                r.freeDeliveryThreshold(), r.freeDeliveryRetailOnly(), r.partnerDiscountPercent(),
                r.telegramBotToken(), r.telegramChatId())));
    }

    @PostMapping("/telegram-test")
    @Operation(summary = "Отправить пробное сообщение в Telegram")
    public void telegramTest(@Valid @RequestBody TelegramTestRequest r) {
        StoreSettings current = settings.current();
        String token = r.telegramBotToken() == null || r.telegramBotToken().isBlank()
                ? current.telegramBotToken() : r.telegramBotToken();
        String chat = r.telegramChatId() == null || r.telegramChatId().isBlank()
                ? current.telegramChatId() : r.telegramChatId();
        if (token == null || token.isBlank() || chat == null || chat.isBlank()) {
            throw ApiException.badRequest("telegram_not_configured", "Укажите токен бота и ID чата");
        }
        try {
            telegram.sendTest(token, chat);
        } catch (Exception ex) {
            throw ApiException.badRequest("telegram_failed", "Не удалось отправить: " + ex.getMessage());
        }
    }
}
