package kz.greenleaf.store.cart;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import kz.greenleaf.store.config.AppProperties;
import kz.greenleaf.store.order.OrderEnums.DeliveryMethod;
import kz.greenleaf.store.order.OrderEnums.PriceTier;
import org.junit.jupiter.api.Test;

class DeliveryRulesTest {

    private static AppProperties.Pricing pricing(boolean retailOnly) {
        return new AppProperties.Pricing(50, new BigDecimal("1500"), new BigDecimal("7000"), retailOnly, 99);
    }

    @Test
    void retailOrderBelowThresholdPaysDelivery() {
        var d = PricingService.delivery(pricing(true), PriceTier.RETAIL, DeliveryMethod.DELIVERY, true, new BigDecimal("6999"));
        assertThat(d.fee()).isEqualByComparingTo("1500");
        assertThat(d.amountToFree()).isEqualByComparingTo("1");
    }

    @Test
    void retailOrderFromThresholdDeliversFree() {
        var d = PricingService.delivery(pricing(true), PriceTier.RETAIL, DeliveryMethod.DELIVERY, true, new BigDecimal("7000"));
        assertThat(d.fee()).isEqualByComparingTo("0");
        assertThat(d.freeThreshold()).isEqualByComparingTo("7000");
    }

    @Test
    void partnerPricesDoNotEarnFreeDeliveryByAmount() {
        var d = PricingService.delivery(pricing(true), PriceTier.PARTNER, DeliveryMethod.DELIVERY, true, new BigDecimal("20000"));
        assertThat(d.fee()).isEqualByComparingTo("1500");
        assertThat(d.freeThreshold()).isNull();
        assertThat(d.amountToFree()).isEqualByComparingTo("0");
    }

    @Test
    void partnersEarnFreeDeliveryWhenRuleIsSwitchedOff() {
        var d = PricingService.delivery(pricing(false), PriceTier.PARTNER, DeliveryMethod.DELIVERY, true, new BigDecimal("7000"));
        assertThat(d.fee()).isEqualByComparingTo("0");
    }

    @Test
    void pickupAndEmptyCartsAreNeverCharged() {
        assertThat(PricingService.delivery(pricing(true), PriceTier.RETAIL, DeliveryMethod.PICKUP, true, BigDecimal.TEN).fee())
                .isEqualByComparingTo("0");
        assertThat(PricingService.delivery(pricing(true), PriceTier.PARTNER, DeliveryMethod.DELIVERY, false, BigDecimal.ZERO).fee())
                .isEqualByComparingTo("0");
    }
}
