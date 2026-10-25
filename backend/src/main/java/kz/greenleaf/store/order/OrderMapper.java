package kz.greenleaf.store.order;

import java.util.List;
import kz.greenleaf.store.media.MediaUrls;
import kz.greenleaf.store.order.OrderDtos.OrderDto;
import kz.greenleaf.store.order.OrderDtos.OrderItemDto;
import kz.greenleaf.store.order.OrderDtos.OrderSummaryDto;
import kz.greenleaf.store.order.OrderDtos.StatusChangeDto;
import org.springframework.stereotype.Component;

@Component
public class OrderMapper {

    private final MediaUrls urls;

    public OrderMapper(MediaUrls urls) {
        this.urls = urls;
    }

    public OrderDto toDto(Order o, boolean includeAdminFields) {
        List<OrderItemDto> items = o.getItems().stream()
                .map(i -> new OrderItemDto(i.getProductId(), i.getSku(), i.getProductName(), urls.url(i.getImageKey()),
                        i.getUnitPrice(), i.getRetailPrice(), i.getQuantity(), i.getLineTotal()))
                .toList();
        List<StatusChangeDto> history = o.getHistory().stream()
                .map(h -> new StatusChangeDto(h.getStatus(), h.getStatus().labelRu(),
                        includeAdminFields ? h.getNote() : null, h.getCreatedAt()))
                .toList();
        return new OrderDto(o.getId(), o.getNumber(), o.getStatus(), o.getStatus().labelRu(),
                includeAdminFields ? List.copyOf(o.getStatus().nextFor(o.getDeliveryMethod())) : List.of(),
                includeAdminFields ? o.getUserId() : null,
                o.getCustomerName(), o.getPhone(), o.getEmail(), o.getCity(), o.getAddress(), o.getComment(),
                o.getDeliveryMethod(), o.getPaymentMethod(), o.getPriceTier(),
                o.getItemsTotal(), o.getSavingsTotal(), o.getDeliveryFee(), o.getTotal(), o.getCurrency(),
                itemsCount(o), items, history, includeAdminFields ? o.getAdminNote() : null,
                o.getCreatedAt(), o.getUpdatedAt());
    }

    /**
     * For tracking by number + phone without an account: whoever knows both learns the status and contents, but not
     * the full name, email, home address or comment.
     */
    public OrderDto toTrackingDto(Order o) {
        OrderDto full = toDto(o, false);
        return new OrderDto(full.id(), full.number(), full.status(), full.statusLabel(), full.nextStatuses(), null,
                maskName(full.customerName()), full.phone(), maskEmail(full.email()), full.city(),
                full.address() == null ? null : maskTail(full.address()), null,
                full.deliveryMethod(), full.paymentMethod(), full.priceTier(), full.itemsTotal(), full.savingsTotal(),
                full.deliveryFee(), full.total(), full.currency(), full.itemsCount(), full.items(), full.history(), null,
                full.createdAt(), full.updatedAt());
    }

    static String maskName(String name) {
        if (name == null || name.isBlank()) {
            return name;
        }
        String first = name.trim().split("\\s+")[0];
        return first.length() <= 1 ? first : first.charAt(0) + "*".repeat(Math.min(first.length() - 1, 6));
    }

    static String maskEmail(String email) {
        if (email == null) {
            return null;
        }
        int at = email.indexOf('@');
        return at <= 1 ? "***" + email.substring(Math.max(at, 0)) : email.charAt(0) + "***" + email.substring(at);
    }

    static String maskTail(String text) {
        String trimmed = text.trim();
        int keep = Math.min(4, trimmed.length() / 3);
        return trimmed.substring(0, keep) + "***";
    }

    public OrderSummaryDto toSummary(Order o) {
        return new OrderSummaryDto(o.getId(), o.getNumber(), o.getStatus(), o.getStatus().labelRu(),
                o.getCustomerName(), o.getPhone(), o.getDeliveryMethod(), o.getPriceTier(), o.getTotal(),
                itemsCount(o), o.getCreatedAt());
    }

    private static int itemsCount(Order o) {
        return o.getItems().stream().mapToInt(OrderItem::getQuantity).sum();
    }
}
