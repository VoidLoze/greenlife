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
                includeAdminFields ? List.copyOf(o.getStatus().next()) : List.of(),
                includeAdminFields ? o.getUserId() : null,
                o.getCustomerName(), o.getPhone(), o.getEmail(), o.getCity(), o.getAddress(), o.getComment(),
                o.getDeliveryMethod(), o.getPaymentMethod(), o.getPriceTier(),
                o.getItemsTotal(), o.getSavingsTotal(), o.getDeliveryFee(), o.getTotal(), o.getCurrency(),
                itemsCount(o), items, history, includeAdminFields ? o.getAdminNote() : null,
                o.getCreatedAt(), o.getUpdatedAt());
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
