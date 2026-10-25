package kz.greenleaf.store.admin.order;

import jakarta.persistence.criteria.Predicate;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import kz.greenleaf.store.catalog.CatalogCacheEvictor;
import kz.greenleaf.store.catalog.repo.ProductRepository;
import kz.greenleaf.store.common.ApiException;
import kz.greenleaf.store.common.PageResponse;
import kz.greenleaf.store.config.AppProperties;
import kz.greenleaf.store.order.Order;
import kz.greenleaf.store.order.OrderDtos.OrderDto;
import kz.greenleaf.store.order.OrderDtos.OrderSummaryDto;
import kz.greenleaf.store.order.OrderEnums.OrderStatus;
import kz.greenleaf.store.order.OrderItem;
import kz.greenleaf.store.order.OrderMapper;
import kz.greenleaf.store.order.OrderRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminOrderService {

    private static final ZoneId STORE_ZONE = ZoneId.of("Asia/Almaty");
    private static final Logger log = LoggerFactory.getLogger(AdminOrderService.class);

    private final OrderRepository orders;
    private final ProductRepository products;
    private final OrderMapper mapper;
    private final CatalogCacheEvictor cacheEvictor;
    private final AppProperties properties;

    public AdminOrderService(OrderRepository orders, ProductRepository products, OrderMapper mapper,
                             CatalogCacheEvictor cacheEvictor, AppProperties properties) {
        this.orders = orders;
        this.products = products;
        this.mapper = mapper;
        this.cacheEvictor = cacheEvictor;
        this.properties = properties;
    }

    public record Filter(String q, OrderStatus status, LocalDate from, LocalDate to, int page, int size) {
    }

    @Transactional(readOnly = true)
    public PageResponse<OrderSummaryDto> list(Filter filter) {
        var pageable = PageRequest.of(Math.max(filter.page(), 0), Math.clamp(filter.size(), 1, 100),
                Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(Sort.Direction.DESC, "id")));
        return PageResponse.of(orders.findAll(specOf(filter), pageable), mapper::toSummary);
    }

    @Transactional(readOnly = true)
    public OrderDto get(Long id) {
        return mapper.toDto(load(id), true);
    }

    /**
     * Moves along the allowed lifecycle only. Cancelling returns the reserved stock to the shelf unless
     * {@code restock} is false (a parcel that already left and did not come back). The row lock makes a repeated
     * click or a second admin see the first change and do nothing, so stock is never returned twice.
     */
    @Transactional
    public OrderDto changeStatus(Long id, OrderStatus target, String note, Long adminId, Boolean restock) {
        Order order = orders.findByIdForUpdate(id).orElseThrow(() -> ApiException.notFound("Заказ"));
        if (order.getStatus() == target) {
            return mapper.toDto(order, true);
        }
        if (!order.getStatus().canMoveTo(target, order.getDeliveryMethod())) {
            throw ApiException.conflict("invalid_transition",
                    "Нельзя перевести заказ из статуса «" + order.getStatus().labelRu() + "» в «" + target.labelRu() + "»");
        }
        if (target == OrderStatus.CANCELLED && !Boolean.FALSE.equals(restock)) {
            releaseStock(order);
        }
        order.recordStatus(target, note == null || note.isBlank() ? null : note.trim(), adminId);
        orders.save(order);
        return mapper.toDto(order, true);
    }

    /** Unconfirmed orders older than AUTO_CANCEL_NEW_AFTER_HOURS give their stock back (off when 0). */
    @Scheduled(cron = "0 15 * * * *")
    @Transactional
    public void cancelStaleNewOrders() {
        int hours = properties.security().autoCancelNewAfterHours();
        if (hours <= 0) {
            return;
        }
        for (Long id : orders.findStaleNewIds(Instant.now().minus(Duration.ofHours(hours)))) {
            Order order = orders.findByIdForUpdate(id).orElse(null);
            if (order == null || order.getStatus() != OrderStatus.NEW) {
                continue;
            }
            releaseStock(order);
            order.recordStatus(OrderStatus.CANCELLED, "Отменён автоматически: не подтверждён за " + hours + " ч.", null);
            log.info("Order {} auto-cancelled after {} h without confirmation", order.getNumber(), hours);
        }
    }

    private void releaseStock(Order order) {
        for (OrderItem item : order.getItems()) {
            if (item.getProductId() != null) {
                products.releaseStock(item.getProductId(), item.getQuantity());
            }
        }
        cacheEvictor.evictAll();
    }

    @Transactional
    public OrderDto updateNote(Long id, String note) {
        Order order = orders.findByIdForUpdate(id).orElseThrow(() -> ApiException.notFound("Заказ"));
        order.setAdminNote(note == null || note.isBlank() ? null : note.trim());
        return mapper.toDto(order, true);
    }

    private Order load(Long id) {
        return orders.findById(id).orElseThrow(() -> ApiException.notFound("Заказ"));
    }

    private static Specification<Order> specOf(Filter f) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (f.status() != null) {
                predicates.add(cb.equal(root.get("status"), f.status()));
            }
            if (f.q() != null && !f.q().isBlank()) {
                String raw = f.q().trim().toLowerCase(Locale.ROOT);
                String like = "%" + raw.replace("%", "\\%").replace("_", "\\_") + "%";
                String digits = raw.replaceAll("\\D", "");
                // "8 707…" and "+7 707…" are the same number: stored phones are +7XXXXXXXXXX.
                if (digits.length() == 11 && digits.startsWith("8")) {
                    digits = "7" + digits.substring(1);
                }
                List<Predicate> any = new ArrayList<>();
                any.add(cb.like(cb.lower(root.get("number")), like));
                any.add(cb.like(cb.lower(root.get("customerName")), like));
                any.add(cb.like(cb.lower(root.get("email")), like));
                if (digits.length() >= 4) {
                    any.add(cb.like(root.get("phone"), "%" + digits + "%"));
                }
                predicates.add(cb.or(any.toArray(Predicate[]::new)));
            }
            if (f.from() != null) {
                Instant from = f.from().atStartOfDay(STORE_ZONE).toInstant();
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), from));
            }
            if (f.to() != null) {
                Instant to = f.to().plusDays(1).atStartOfDay(STORE_ZONE).toInstant();
                predicates.add(cb.lessThan(root.get("createdAt"), to));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }
}
