package kz.greenleaf.store.order;

import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.Clock;
import java.time.Duration;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import kz.greenleaf.store.auth.AuthPrincipal;
import kz.greenleaf.store.cart.CartDtos.CartWarning;
import kz.greenleaf.store.cart.CartDtos.QuoteLine;
import kz.greenleaf.store.cart.CartService;
import kz.greenleaf.store.cart.PricingService;
import kz.greenleaf.store.cart.PricingService.PricedCart;
import kz.greenleaf.store.catalog.CatalogCacheEvictor;
import kz.greenleaf.store.catalog.domain.Product;
import kz.greenleaf.store.catalog.repo.ProductRepository;
import kz.greenleaf.store.common.ApiException;
import kz.greenleaf.store.common.ClientInfo;
import kz.greenleaf.store.common.PageResponse;
import kz.greenleaf.store.common.Phones;
import kz.greenleaf.store.common.RateLimiter;
import kz.greenleaf.store.config.AppProperties;
import kz.greenleaf.store.order.OrderDtos.CheckoutRequest;
import kz.greenleaf.store.order.OrderDtos.CheckoutResponse;
import kz.greenleaf.store.order.OrderDtos.OrderDto;
import kz.greenleaf.store.order.OrderDtos.OrderSummaryDto;
import kz.greenleaf.store.order.OrderEnums.DeliveryMethod;
import kz.greenleaf.store.order.OrderEnums.OrderStatus;
import kz.greenleaf.store.order.OrderEnums.PaymentMethod;
import kz.greenleaf.store.order.OrderEnums.PriceTier;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
public class OrderService {

    private static final ZoneId STORE_ZONE = ZoneId.of("Asia/Almaty");
    private static final DateTimeFormatter NUMBER_DATE = DateTimeFormatter.ofPattern("yyMMdd");
    private static final Duration HOUR = Duration.ofHours(1);
    private static final int TRACK_PER_HOUR = 30;

    private final OrderRepository orders;
    private final ProductRepository products;
    private final PricingService pricing;
    private final CartService carts;
    private final OrderMapper mapper;
    private final RateLimiter rateLimiter;
    private final CatalogCacheEvictor cacheEvictor;
    private final AppProperties properties;
    private final Clock clock;

    public OrderService(OrderRepository orders, ProductRepository products, PricingService pricing, CartService carts,
                        OrderMapper mapper, RateLimiter rateLimiter, CatalogCacheEvictor cacheEvictor,
                        AppProperties properties, Clock clock) {
        this.orders = orders;
        this.products = products;
        this.pricing = pricing;
        this.carts = carts;
        this.mapper = mapper;
        this.rateLimiter = rateLimiter;
        this.cacheEvictor = cacheEvictor;
        this.properties = properties;
        this.clock = clock;
    }

    @Transactional
    public CheckoutResponse checkout(CheckoutRequest request, AuthPrincipal principal, ClientInfo client) {
        rateLimiter.acquireOrThrow("orders:ip:" + client.ip(), properties.security().ordersPerHour(), HOUR,
                "Слишком много заказов с вашего устройства. Попробуйте позже или напишите нам в WhatsApp.");
        String phone = Phones.normalizeOrThrow(request.phone());
        if (request.deliveryMethod() == DeliveryMethod.DELIVERY
                && (isBlank(request.city()) || isBlank(request.address()))) {
            throw ApiException.badRequest("address_required", "Для доставки укажите город и адрес");
        }

        PriceTier tier = carts.tierFor(principal);
        PricedCart priced = pricing.price(request.items(), tier, request.deliveryMethod());
        var quote = priced.quote();
        if (quote.items().isEmpty()) {
            throw ApiException.badRequest("empty_cart", "В корзине нет доступных товаров");
        }
        if (quote.adjusted()) {
            throw new ApiException(org.springframework.http.HttpStatus.CONFLICT, "cart_changed",
                    "Корзина изменилась — проверьте её перед оформлением",
                    quote.warnings().stream().map(CartWarning::message).toList());
        }
        if (request.expectedTotal() != null && request.expectedTotal().compareTo(quote.total()) != 0) {
            throw ApiException.conflict("price_changed",
                    "Цены обновились. Новая сумма заказа: " + money(quote.total()) + " ₸. Проверьте корзину.");
        }

        for (QuoteLine line : quote.items()) {
            if (products.reserveStock(line.productId(), line.quantity()) == 0) {
                throw ApiException.conflict("out_of_stock",
                        "«" + line.nameRu() + "» только что закончился. Обновите корзину.");
            }
        }

        String number = "GL-" + NUMBER_DATE.format(clock.instant().atZone(STORE_ZONE)) + "-"
                + String.format("%04d", orders.nextNumber());
        Order order = new Order(number, principal == null ? null : principal.id(), request.customerName().trim(), phone,
                request.deliveryMethod(), request.paymentMethod(), tier);
        order.setEmail(blankToNull(request.email()));
        order.setCity(blankToNull(request.city()));
        order.setAddress(request.deliveryMethod() == DeliveryMethod.DELIVERY ? blankToNull(request.address()) : null);
        order.setComment(blankToNull(request.comment()));
        for (QuoteLine line : quote.items()) {
            Product product = priced.products().get(line.productId());
            String image = product.getCoverThumbKey() != null ? product.getCoverThumbKey() : product.getCoverKey();
            order.addItem(new OrderItem(product.getId(), product.getSku(), product.getNameRu(), image,
                    line.unitPrice(), line.retailPrice(), line.quantity()));
        }
        order.setTotals(quote.itemsTotal(), quote.savings(), quote.deliveryFee(), quote.total());
        order.recordStatus(OrderStatus.NEW, null, principal == null ? null : principal.id());
        orders.save(order);

        if (principal != null) {
            afterCommit(() -> carts.clear(principal.id()));
        }
        afterCommit(cacheEvictor::evictAll);
        OrderDto dto = mapper.toDto(order, false);
        return new CheckoutResponse(dto, whatsappUrl(order));
    }

    @Transactional(readOnly = true)
    public PageResponse<OrderSummaryDto> myOrders(AuthPrincipal principal, int page, int size) {
        var result = orders.findByUserIdOrderByCreatedAtDesc(principal.id(),
                PageRequest.of(Math.max(page, 0), Math.clamp(size, 1, 50)));
        return PageResponse.of(result, mapper::toSummary);
    }

    @Transactional(readOnly = true)
    public OrderDto myOrder(AuthPrincipal principal, String number) {
        return orders.findOwned(number, principal.id())
                .map(o -> mapper.toDto(o, false))
                .orElseThrow(() -> ApiException.notFound("Заказ"));
    }

    /** Guests track by number + phone; both must match so order numbers alone cannot be enumerated. */
    @Transactional(readOnly = true)
    public OrderDto track(String number, String phone, ClientInfo client) {
        rateLimiter.acquireOrThrow("orders:track:" + client.ip(), TRACK_PER_HOUR, HOUR,
                "Слишком много запросов. Попробуйте через час.");
        String normalized = Phones.normalize(phone);
        return orders.findByNumber(number == null ? "" : number.trim().toUpperCase(Locale.ROOT))
                .filter(o -> normalized != null && normalized.equals(o.getPhone()))
                .map(o -> mapper.toDto(o, false))
                .orElseThrow(() -> ApiException.notFound("Заказ с таким номером и телефоном"));
    }

    @Transactional(readOnly = true)
    public String whatsappUrlFor(String number, AuthPrincipal principal) {
        Order order = orders.findOwned(number, principal.id()).orElseThrow(() -> ApiException.notFound("Заказ"));
        return whatsappUrl(order);
    }

    String whatsappUrl(Order order) {
        StringBuilder text = new StringBuilder();
        text.append("Здравствуйте! Оформил(а) заказ ").append(order.getNumber()).append(" на сайте ")
                .append(properties.store().name()).append(".\n\n");
        List<OrderItem> items = order.getItems();
        for (int i = 0; i < items.size(); i++) {
            OrderItem item = items.get(i);
            text.append(i + 1).append(". ").append(item.getProductName()).append(" (").append(item.getSku()).append(") — ")
                    .append(item.getQuantity()).append(" шт. × ").append(money(item.getUnitPrice())).append(" ₸\n");
        }
        text.append("\nТовары: ").append(money(order.getItemsTotal())).append(" ₸");
        if (order.getDeliveryFee().signum() > 0) {
            text.append("\nДоставка: ").append(money(order.getDeliveryFee())).append(" ₸");
        }
        text.append("\nИтого: ").append(money(order.getTotal())).append(" ₸");
        if (order.getPriceTier() == PriceTier.PARTNER) {
            text.append(" (партнёрские цены)");
        }
        text.append("\n\nИмя: ").append(order.getCustomerName());
        text.append("\nТелефон: ").append(order.getPhone());
        text.append("\nПолучение: ").append(order.getDeliveryMethod() == DeliveryMethod.PICKUP
                ? "самовывоз (" + properties.store().address() + ")"
                : "доставка — " + order.getCity() + ", " + order.getAddress());
        text.append("\nОплата: ").append(paymentLabel(order.getPaymentMethod()));
        if (order.getComment() != null) {
            text.append("\nКомментарий: ").append(order.getComment());
        }
        return "https://wa.me/" + properties.store().whatsapp() + "?text="
                + URLEncoder.encode(text.toString(), StandardCharsets.UTF_8).replace("+", "%20");
    }

    static String paymentLabel(PaymentMethod method) {
        return switch (method) {
            case CASH -> "наличными при получении";
            case KASPI -> "Kaspi";
            case CARD_TRANSFER -> "перевод на карту";
        };
    }

    static String money(BigDecimal value) {
        DecimalFormatSymbols symbols = new DecimalFormatSymbols(Locale.ROOT);
        symbols.setGroupingSeparator(' ');
        return new DecimalFormat("#,##0", symbols).format(value);
    }

    private static void afterCommit(Runnable action) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    action.run();
                }
            });
        } else {
            action.run();
        }
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static String blankToNull(String value) {
        return isBlank(value) ? null : value.trim();
    }
}
