package kz.greenleaf.store.order;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import kz.greenleaf.store.cart.CartDtos.CartLineInput;
import kz.greenleaf.store.order.OrderEnums.DeliveryMethod;
import kz.greenleaf.store.order.OrderEnums.OrderStatus;
import kz.greenleaf.store.order.OrderEnums.PaymentMethod;
import kz.greenleaf.store.order.OrderEnums.PriceTier;

public final class OrderDtos {

    private OrderDtos() {
    }

    public record CheckoutRequest(
            @NotBlank(message = "Укажите имя") @Size(min = 2, max = 150, message = "Имя: от 2 до 150 символов") String customerName,
            @NotBlank(message = "Укажите телефон") @Size(max = 32) String phone,
            @Email(message = "Некорректный email") @Size(max = 255) String email,
            @Size(max = 100) String city,
            @Size(max = 300) String address,
            @Size(max = 1000) String comment,
            @NotNull(message = "Выберите способ получения") DeliveryMethod deliveryMethod,
            @NotNull(message = "Выберите способ оплаты") PaymentMethod paymentMethod,
            @NotEmpty(message = "Корзина пуста") @Valid @Size(max = 100) List<CartLineInput> items,
            @NotNull(message = "Сумма заказа ещё не рассчитана — подождите секунду") BigDecimal expectedTotal,
            @Size(max = 0) String website,
            @Size(max = 64) String idempotencyKey,
            /* Consent to the processing of personal data (Law of the Republic of Kazakhstan No. 94-V). */
            boolean consent) {
    }

    public record OrderItemDto(Long productId, String sku, String productName, String imageUrl, BigDecimal unitPrice,
                               BigDecimal retailPrice, int quantity, BigDecimal lineTotal) {
    }

    public record StatusChangeDto(OrderStatus status, String label, String note, Instant createdAt) {
    }

    public record OrderDto(
            Long id,
            String number,
            OrderStatus status,
            String statusLabel,
            List<OrderStatus> nextStatuses,
            Long userId,
            String customerName,
            String phone,
            String email,
            String city,
            String address,
            String comment,
            DeliveryMethod deliveryMethod,
            PaymentMethod paymentMethod,
            PriceTier priceTier,
            BigDecimal itemsTotal,
            BigDecimal savingsTotal,
            BigDecimal deliveryFee,
            BigDecimal total,
            String currency,
            int itemsCount,
            List<OrderItemDto> items,
            List<StatusChangeDto> history,
            String adminNote,
            Instant createdAt,
            Instant updatedAt) {
    }

    public record OrderSummaryDto(Long id, String number, OrderStatus status, String statusLabel, String customerName,
                                  String phone, DeliveryMethod deliveryMethod, PriceTier priceTier, BigDecimal total,
                                  int itemsCount, Instant createdAt) {
    }

    public record CheckoutResponse(OrderDto order, String whatsappUrl) {
    }

    /** {@code restock} matters only for a cancellation: a parcel that already left may not come back to the shelf. */
    public record StatusUpdateRequest(@NotNull OrderStatus status, @Size(max = 1000) String note, Boolean restock) {
    }

    public record AdminNoteRequest(@Size(max = 5000) String adminNote) {
    }
}
