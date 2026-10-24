package kz.greenleaf.store.order;

import java.util.EnumSet;
import java.util.Set;

public final class OrderEnums {

    private OrderEnums() {
    }

    public enum DeliveryMethod {
        PICKUP, DELIVERY
    }

    public enum PaymentMethod {
        CASH, KASPI, CARD_TRANSFER
    }

    public enum PriceTier {
        RETAIL, PARTNER
    }

    public enum OrderStatus {
        NEW, CONFIRMED, SHIPPED, COMPLETED, CANCELLED;

        public Set<OrderStatus> next() {
            return switch (this) {
                case NEW -> EnumSet.of(CONFIRMED, CANCELLED);
                case CONFIRMED -> EnumSet.of(SHIPPED, COMPLETED, CANCELLED);
                case SHIPPED -> EnumSet.of(COMPLETED, CANCELLED);
                case COMPLETED, CANCELLED -> EnumSet.noneOf(OrderStatus.class);
            };
        }

        public boolean canMoveTo(OrderStatus target) {
            return next().contains(target);
        }

        public String labelRu() {
            return switch (this) {
                case NEW -> "Новый";
                case CONFIRMED -> "Подтверждён";
                case SHIPPED -> "Передан в доставку";
                case COMPLETED -> "Выполнен";
                case CANCELLED -> "Отменён";
            };
        }
    }
}
