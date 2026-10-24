package kz.greenleaf.store.cart;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.io.Serializable;
import java.math.BigDecimal;
import java.util.List;
import kz.greenleaf.store.order.OrderEnums.DeliveryMethod;
import kz.greenleaf.store.order.OrderEnums.PriceTier;

public final class CartDtos {

    private CartDtos() {
    }

    public record CartLineInput(
            @NotNull Long productId,
            @Min(value = 0, message = "Количество не может быть отрицательным") @Max(999) int quantity) implements Serializable {
    }

    public record CartUpdateRequest(@NotNull @Valid @Size(max = 100) List<CartLineInput> items) {
    }

    public record QuoteRequest(
            @NotNull @Valid @Size(max = 100) List<CartLineInput> items,
            DeliveryMethod deliveryMethod) {
    }

    public record CartWarning(Long productId, String code, String message) {
    }

    public record QuoteLine(
            Long productId,
            String slug,
            String sku,
            String nameRu,
            String nameKk,
            String volume,
            String thumbUrl,
            BigDecimal unitPrice,
            BigDecimal retailPrice,
            BigDecimal oldPrice,
            int quantity,
            int maxQuantity,
            BigDecimal lineTotal,
            BigDecimal lineSavings) {
    }

    public record Quote(
            PriceTier tier,
            List<QuoteLine> items,
            int itemsCount,
            BigDecimal itemsTotal,
            BigDecimal retailTotal,
            BigDecimal savings,
            DeliveryMethod deliveryMethod,
            BigDecimal deliveryFee,
            BigDecimal freeDeliveryThreshold,
            BigDecimal amountToFreeDelivery,
            BigDecimal total,
            String currency,
            List<CartWarning> warnings) {

        public boolean adjusted() {
            return !warnings.isEmpty();
        }
    }
}
