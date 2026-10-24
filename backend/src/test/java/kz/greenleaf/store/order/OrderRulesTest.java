package kz.greenleaf.store.order;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import kz.greenleaf.store.cart.CartDtos.CartLineInput;
import kz.greenleaf.store.cart.PricingService;
import kz.greenleaf.store.order.OrderEnums.OrderStatus;
import org.junit.jupiter.api.Test;

class OrderRulesTest {

    @Test
    void orderLifecycleOnlyMovesForward() {
        assertThat(OrderStatus.NEW.canMoveTo(OrderStatus.CONFIRMED)).isTrue();
        assertThat(OrderStatus.NEW.canMoveTo(OrderStatus.SHIPPED)).isFalse();
        assertThat(OrderStatus.SHIPPED.canMoveTo(OrderStatus.CANCELLED)).isTrue();
        assertThat(OrderStatus.COMPLETED.next()).isEmpty();
        assertThat(OrderStatus.CANCELLED.next()).isEmpty();
    }

    @Test
    void cartLinesAreMergedAndZeroQuantitiesDropped() {
        var merged = PricingService.merge(List.of(
                new CartLineInput(1L, 2), new CartLineInput(2L, 0), new CartLineInput(1L, 3), new CartLineInput(3L, 1)));
        assertThat(merged).containsExactly(Map.entry(1L, 5), Map.entry(3L, 1));
    }

    @Test
    void moneyIsFormattedWithSpaces() {
        assertThat(OrderService.money(new BigDecimal("1234567"))).isEqualTo("1 234 567");
        assertThat(OrderService.money(new BigDecimal("950"))).isEqualTo("950");
    }
}
