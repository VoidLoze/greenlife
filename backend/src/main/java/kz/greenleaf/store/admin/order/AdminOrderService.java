package kz.greenleaf.store.admin.order;

import jakarta.persistence.criteria.Predicate;
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
import kz.greenleaf.store.order.Order;
import kz.greenleaf.store.order.OrderDtos.OrderDto;
import kz.greenleaf.store.order.OrderDtos.OrderSummaryDto;
import kz.greenleaf.store.order.OrderEnums.OrderStatus;
import kz.greenleaf.store.order.OrderItem;
import kz.greenleaf.store.order.OrderMapper;
import kz.greenleaf.store.order.OrderRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminOrderService {

    private static final ZoneId STORE_ZONE = ZoneId.of("Asia/Almaty");

    private final OrderRepository orders;
    private final ProductRepository products;
    private final OrderMapper mapper;
    private final CatalogCacheEvictor cacheEvictor;

    public AdminOrderService(OrderRepository orders, ProductRepository products, OrderMapper mapper,
                             CatalogCacheEvictor cacheEvictor) {
        this.orders = orders;
        this.products = products;
        this.mapper = mapper;
        this.cacheEvictor = cacheEvictor;
    }

    public record Filter(String q, OrderStatus status, LocalDate from, LocalDate to, int page, int size) {
    }

    @Transactional(readOnly = true)
    public PageResponse<OrderSummaryDto> list(Filter filter) {
        var pageable = PageRequest.of(Math.max(filter.page(), 0), Math.clamp(filter.size(), 1, 100),
                Sort.by(Sort.Direction.DESC, "createdAt"));
        return PageResponse.of(orders.findAll(specOf(filter), pageable), mapper::toSummary);
    }

    @Transactional(readOnly = true)
    public OrderDto get(Long id) {
        return mapper.toDto(load(id), true);
    }

    /** Moves along the allowed lifecycle only; cancelling returns the reserved stock to the shelf. */
    @Transactional
    public OrderDto changeStatus(Long id, OrderStatus target, String note, Long adminId) {
        Order order = load(id);
        if (order.getStatus() == target) {
            return mapper.toDto(order, true);
        }
        if (!order.getStatus().canMoveTo(target)) {
            throw ApiException.conflict("invalid_transition",
                    "Нельзя перевести заказ из статуса «" + order.getStatus().labelRu() + "» в «" + target.labelRu() + "»");
        }
        if (target == OrderStatus.CANCELLED) {
            for (OrderItem item : order.getItems()) {
                if (item.getProductId() != null) {
                    products.releaseStock(item.getProductId(), item.getQuantity());
                }
            }
            cacheEvictor.evictAll();
        }
        order.recordStatus(target, note == null || note.isBlank() ? null : note.trim(), adminId);
        orders.save(order);
        return mapper.toDto(order, true);
    }

    @Transactional
    public OrderDto updateNote(Long id, String note) {
        Order order = load(id);
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
