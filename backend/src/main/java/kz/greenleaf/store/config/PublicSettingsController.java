package kz.greenleaf.store.config;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.math.BigDecimal;
import kz.greenleaf.store.site.SiteSettingsService;
import kz.greenleaf.store.site.SiteSettingsService.CompanyVideo;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Tag(name = "Settings")
public class PublicSettingsController {

    private final AppProperties props;
    private final SiteSettingsService siteSettings;

    public PublicSettingsController(AppProperties props, SiteSettingsService siteSettings) {
        this.props = props;
        this.siteSettings = siteSettings;
    }

    @GetMapping("/api/settings/public")
    @Operation(summary = "Контакты магазина, условия доставки и видео о компании для витрины")
    public PublicSettings settings() {
        AppProperties.Store store = props.store();
        AppProperties.Pricing pricing = props.pricing();
        CompanyVideo video = siteSettings.companyVideo();
        return new PublicSettings(store.name(), store.phone(), store.whatsapp(), store.telegramUrl(),
                store.instagramUrl(), store.city(), store.address(), store.workingHours(), pricing.deliveryFee(),
                pricing.freeDeliveryThreshold(), pricing.partnerDiscountPercent(), pricing.maxQuantityPerItem(),
                video.url(), video.title());
    }

    public record PublicSettings(String storeName, String phone, String whatsapp, String telegramUrl,
                                 String instagramUrl, String city, String address, String workingHours,
                                 BigDecimal deliveryFee, BigDecimal freeDeliveryThreshold,
                                 int partnerDiscountPercent, int maxQuantityPerItem,
                                 String companyVideoUrl, String companyVideoTitle) {
    }
}
