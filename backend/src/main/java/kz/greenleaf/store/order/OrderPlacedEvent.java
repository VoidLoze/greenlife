package kz.greenleaf.store.order;

import java.util.List;

/** Published inside the checkout transaction; listeners act only after it commits. */
public record OrderPlacedEvent(Long orderId, String number, String customerName, String phone, String delivery,
                               String payment, boolean partner, List<String> lines, String total, String comment) {
}
