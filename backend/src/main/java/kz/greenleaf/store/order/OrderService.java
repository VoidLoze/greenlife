package kz.greenleaf.store.order;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.Clock;
import java.time.Duration;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
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
import kz.greenleaf.store.site.StoreSettingsService;
import kz.greenleaf.store.site.StoreSettingsService.StoreSettings;
import org.springframework.context.ApplicationEventPublisher;
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
    private static final int TRACK_PER_NUMBER = 10;
    private static final String NUMBER_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    private static final int NUMBER_SUFFIX_LENGTH = 6;

    private final OrderRepository orders;
    private final ProductRepository products;
    private final PricingService pricing;
    private final CartService carts;
    private final OrderMapper mapper;
    private final RateLimiter rateLimiter;
    private final CatalogCacheEvictor cacheEvictor;
    private final AppProperties properties;
    private final StoreSettingsService settings;
    private final ApplicationEventPublisher events;
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();

    public OrderService(OrderRepository orders, ProductRepository products, PricingService pricing, CartService carts,
                        OrderMapper mapper, RateLimiter rateLimiter, CatalogCacheEvictor cacheEvictor,
                        AppProperties properties, StoreSettingsService settings, ApplicationEventPublisher events,
                        Clock clock) {
        this.orders = orders;
        this.products = products;
        this.pricing = pricing;
        this.carts = carts;
        this.mapper = mapper;
        this.rateLimiter = rateLimiter;
        this.cacheEvictor = cacheEvictor;
        this.properties = properties;
        this.settings = settings;
        this.events = events;
        this.clock = clock;
    }

    @Transactional
    public CheckoutResponse checkout(CheckoutRequest request, AuthPrincipal principal, ClientInfo client) {
        String phone = Phones.normalizeOrThrow(request.phone());
        String idempotencyKey = blankToNull(request.idempotencyKey());
        if (idempotencyKey != null) {
            var placed = orders.findByIdempotencyKey(idempotencyKey).filter(o -> o.getPhone().equals(phone));
            if (placed.isPresent()) {
                return new CheckoutResponse(mapper.toDto(placed.get(), false), whatsappUrl(placed.get()));
            }
        }
        if (!request.consent()) {
            throw ApiException.badRequest("consent_required", "Подтвердите согласие на обработку персональных данных");
        }
        if (request.deliveryMethod() == DeliveryMethod.DELIVERY
                && (isBlank(request.city()) || isBlank(request.address()))) {
            throw ApiException.badRequest("address_required", "Для доставки укажите город и адрес");
        }
        rateLimiter.acquireOrThrow("orders:ip:" + client.ip(), properties.security().ordersPerHour(), HOUR,
                "Слишком много заказов с вашего устройства. Попробуйте позже или напишите нам в WhatsApp.");
        int openLimit = properties.security().openOrdersPerPhone();
        if (orders.countOpenByPhoneSince(phone, clock.instant().minus(Duration.ofDays(3))) >= openLimit) {
            throw ApiException.tooManyRequests("По этому номеру уже есть " + openLimit
                    + " необработанных заказа. Менеджер скоро свяжется с вами — или напишите нам в WhatsApp.");
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
        if (request.expectedTotal().compareTo(quote.total()) != 0) {
            throw ApiException.conflict("price_changed",
                    "Цены обновились. Новая сумма заказа: " + money(quote.total()) + " ₸. Проверьте корзину.");
        }

        // Rows are locked in one global order (by id), so two carts with the same products cannot deadlock.
        List<QuoteLine> byProduct = quote.items().stream().sorted(Comparator.comparing(QuoteLine::productId)).toList();
        for (QuoteLine line : byProduct) {
            if (products.reserveStock(line.productId(), line.quantity()) == 0) {
                throw ApiException.conflict("out_of_stock",
                        "«" + line.nameRu() + "» только что закончился. Обновите корзину.");
            }
        }

        Order order = new Order(nextOrderNumber(), principal == null ? null : principal.id(), request.customerName().trim(),
                phone, request.deliveryMethod(), request.paymentMethod(), tier);
        order.setIdempotencyKey(idempotencyKey);
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
        // The transaction-aware cache defers this clear until the commit itself.
        cacheEvictor.evictAll();
        events.publishEvent(placedEvent(order));
        OrderDto dto = mapper.toDto(order, false);
        return new CheckoutResponse(dto, whatsappUrl(order));
    }

    /** GL-<date>-<random>: unguessable, so a number cannot be enumerated to find someone's order. */
    private String nextOrderNumber() {
        String prefix = "GL-" + NUMBER_DATE.format(clock.instant().atZone(STORE_ZONE)) + "-";
        for (int attempt = 0; ; attempt++) {
            StringBuilder suffix = new StringBuilder(NUMBER_SUFFIX_LENGTH);
            for (int i = 0; i < NUMBER_SUFFIX_LENGTH; i++) {
                suffix.append(NUMBER_ALPHABET.charAt(random.nextInt(NUMBER_ALPHABET.length())));
            }
            String number = prefix + suffix;
            if (attempt >= 5 || orders.findByNumber(number).isEmpty()) {
                return number;
            }
        }
    }

    private OrderPlacedEvent placedEvent(Order order) {
        StoreSettings s = settings.current();
        List<String> lines = order.getItems().stream()
                .map(i -> i.getProductName() + " × " + i.getQuantity() + " = " + money(i.getLineTotal()) + " ₸")
                .toList();
        String delivery = order.getDeliveryMethod() == DeliveryMethod.PICKUP
                ? "Самовывоз (" + s.address() + ")"
                : "Доставка: " + order.getCity() + ", " + order.getAddress()
                        + (order.getDeliveryFee().signum() > 0 ? " (+" + money(order.getDeliveryFee()) + " ₸)" : " (бесплатно)");
        return new OrderPlacedEvent(order.getId(), order.getNumber(), order.getCustomerName(), order.getPhone(), delivery,
                paymentLabel(order.getPaymentMethod()), order.getPriceTier() == PriceTier.PARTNER, lines,
                money(order.getTotal()), order.getComment());
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
        String normalizedNumber = number == null ? "" : number.trim().toUpperCase(Locale.ROOT);
        // Guessing phones for one known number is capped separately from the per-address limit.
        rateLimiter.acquireOrThrow("orders:track-number:" + normalizedNumber, TRACK_PER_NUMBER, Duration.ofDays(1),
                "Слишком много попыток для этого номера заказа. Напишите нам в WhatsApp.");
        String normalized = Phones.normalize(phone);
        return orders.findByNumber(normalizedNumber)
                .filter(o -> normalized != null && normalized.equals(o.getPhone()))
                .map(mapper::toTrackingDto)
                .orElseThrow(() -> ApiException.notFound("Заказ с таким номером и телефоном"));
    }

    @Transactional(readOnly = true)
    public String whatsappUrlFor(String number, AuthPrincipal principal) {
        Order order = orders.findOwned(number, principal.id()).orElseThrow(() -> ApiException.notFound("Заказ"));
        return whatsappUrl(order);
    }

    String whatsappUrl(Order order) {
        StringBuilder text = new StringBuilder();
        StoreSettings store = settings.current();
        text.append("Здравствуйте! Оформил(а) заказ ").append(order.getNumber()).append(" на сайте ")
                .append(store.storeName()).append(".\n\n");
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
                ? "самовывоз (" + store.address() + ")"
                : "доставка — " + order.getCity() + ", " + order.getAddress());
        text.append("\nОплата: ").append(paymentLabel(order.getPaymentMethod()));
        if (order.getComment() != null) {
            text.append("\nКомментарий: ").append(order.getComment());
        }
        return "https://wa.me/" + store.whatsapp() + "?text="
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
        DecimalFormat format = new DecimalFormat("#,##0", symbols);
        format.setRoundingMode(RoundingMode.HALF_UP);
        return format.format(value);
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
