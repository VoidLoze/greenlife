package kz.greenleaf.store.config;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.math.BigDecimal;
import kz.greenleaf.store.site.SiteSettingsService;
import kz.greenleaf.store.site.SiteSettingsService.CompanyVideo;
import kz.greenleaf.store.site.StoreSettingsService;
import kz.greenleaf.store.site.StoreSettingsService.StoreSettings;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Tag(name = "Settings")
public class PublicSettingsController {

    private final StoreSettingsService storeSettings;
    private final SiteSettingsService siteSettings;

    public PublicSettingsController(StoreSettingsService storeSettings, SiteSettingsService siteSettings) {
        this.storeSettings = storeSettings;
        this.siteSettings = siteSettings;
    }

    @GetMapping("/api/settings/public")
    @Operation(summary = "Контакты магазина, условия доставки и видео о компании для витрины")
    public PublicSettings settings() {
        StoreSettings s = storeSettings.current();
        CompanyVideo video = siteSettings.companyVideo();
        return new PublicSettings(s.storeName(), s.phone(), s.whatsapp(), s.telegramUrl(), s.instagramUrl(), s.city(),
                s.address(), s.workingHours(), s.deliveryFee(), s.freeDeliveryThreshold(), s.freeDeliveryRetailOnly(),
                s.partnerDiscountPercent(), s.maxQuantityPerItem(), video.url(), video.title());
    }

    public record PublicSettings(String storeName, String phone, String whatsapp, String telegramUrl,
                                 String instagramUrl, String city, String address, String workingHours,
                                 BigDecimal deliveryFee, BigDecimal freeDeliveryThreshold,
                                 boolean freeDeliveryRetailOnly,
                                 int partnerDiscountPercent, int maxQuantityPerItem,
                                 String companyVideoUrl, String companyVideoTitle) {
    }
}
