package kz.greenleaf.store.admin.dashboard;

import io.swagger.v3.oas.annotations.tags.Tag;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import kz.greenleaf.store.catalog.ProductMapper;
import kz.greenleaf.store.catalog.search.SearchAnalytics;
import kz.greenleaf.store.media.MediaUrls;
import kz.greenleaf.store.order.OrderDtos.OrderSummaryDto;
import kz.greenleaf.store.order.OrderMapper;
import kz.greenleaf.store.order.OrderRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/admin/dashboard")
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Admin: dashboard")
public class AdminDashboardController {

    private static final int DAYS = 30;

    private final JdbcTemplate jdbc;
    private final OrderRepository orders;
    private final OrderMapper orderMapper;
    private final SearchAnalytics searchAnalytics;
    private final MediaUrls urls;

    public AdminDashboardController(JdbcTemplate jdbc, OrderRepository orders, OrderMapper orderMapper,
                                    SearchAnalytics searchAnalytics, MediaUrls urls) {
        this.jdbc = jdbc;
        this.orders = orders;
        this.orderMapper = orderMapper;
        this.searchAnalytics = searchAnalytics;
        this.urls = urls;
    }

    public record Counters(long productsPublished, long productsDraft, long productsArchived, long productsWithoutPhoto,
                           long ordersNew, long ordersInProgress, long ordersTotal, long users, long partners) {
    }

    public record Revenue(BigDecimal revenue, long orders, BigDecimal averageCheck, BigDecimal previousRevenue,
                          long previousOrders) {
    }

    public record DayPoint(LocalDate date, long orders, BigDecimal revenue) {
    }

    public record ProductStat(Long id, String slug, String nameRu, String thumbUrl, long value, Integer stockQuantity) {
    }

    public record Dashboard(Counters counters, Revenue last30Days, List<DayPoint> daily, List<ProductStat> topSold,
                            List<ProductStat> topViewed, List<ProductStat> lowStock, List<OrderSummaryDto> recentOrders,
                            List<String> popularSearches) {
    }

    @GetMapping
    @Transactional(readOnly = true)
    public Dashboard dashboard() {
        return new Dashboard(counters(), revenue(), daily(), topSold(), topViewed(), lowStock(), recentOrders(),
                searchAnalytics.popular("", 10));
    }

    private Counters counters() {
        Map<String, Object> p = jdbc.queryForMap("""
                select count(*) filter (where status = 'PUBLISHED') as published,
                       count(*) filter (where status = 'DRAFT') as draft,
                       count(*) filter (where status = 'ARCHIVED') as archived,
                       count(*) filter (where cover_key is null and status <> 'ARCHIVED') as no_photo
                from products
                """);
        Map<String, Object> o = jdbc.queryForMap("""
                select count(*) filter (where status = 'NEW') as new_orders,
                       count(*) filter (where status in ('CONFIRMED', 'SHIPPED')) as in_progress,
                       count(*) as total
                from orders
                """);
        Map<String, Object> u = jdbc.queryForMap("""
                select count(*) filter (where role = 'USER') as users,
                       count(*) filter (where partner and role = 'USER') as partners
                from users
                """);
        return new Counters(num(p, "published"), num(p, "draft"), num(p, "archived"), num(p, "no_photo"),
                num(o, "new_orders"), num(o, "in_progress"), num(o, "total"), num(u, "users"), num(u, "partners"));
    }

    private Revenue revenue() {
        // Same calendar days (Almaty) and the same statuses as the chart, so the card equals the sum of the bars.
        // Only orders the manager confirmed count as revenue; unconfirmed NEW ones may still be cancelled.
        Map<String, Object> r = jdbc.queryForMap("""
                with bounds as (
                    select (now() at time zone 'Asia/Almaty')::date - (? - 1) as start_day
                )
                select coalesce(sum(total) filter (where local_day >= b.start_day), 0) as revenue,
                       count(*) filter (where local_day >= b.start_day) as orders,
                       coalesce(sum(total) filter (where local_day < b.start_day), 0) as prev_revenue,
                       count(*) filter (where local_day < b.start_day) as prev_orders
                from (select total, (created_at at time zone 'Asia/Almaty')::date as local_day from orders
                      where status in ('CONFIRMED', 'SHIPPED', 'COMPLETED')) o, bounds b
                where local_day >= b.start_day - ?
                """, DAYS, DAYS);
        BigDecimal revenue = (BigDecimal) r.get("revenue");
        long count = num(r, "orders");
        BigDecimal average = count == 0 ? BigDecimal.ZERO
                : revenue.divide(BigDecimal.valueOf(count), 0, java.math.RoundingMode.HALF_UP);
        return new Revenue(revenue, count, average, (BigDecimal) r.get("prev_revenue"), num(r, "prev_orders"));
    }

    /** One point per day including empty days, so the chart has no gaps. */
    private List<DayPoint> daily() {
        Map<LocalDate, DayPoint> byDay = new LinkedHashMap<>();
        jdbc.query("""
                select d::date as day, count(o.id) as orders, coalesce(sum(o.total), 0) as revenue
                from generate_series((now() at time zone 'Asia/Almaty')::date - (?::int - 1),
                                     (now() at time zone 'Asia/Almaty')::date, interval '1 day') d
                left join orders o on (o.created_at at time zone 'Asia/Almaty')::date = d::date
                                  and o.status in ('CONFIRMED', 'SHIPPED', 'COMPLETED')
                group by d
                order by d
                """, rs -> {
            LocalDate day = rs.getDate("day").toLocalDate();
            byDay.put(day, new DayPoint(day, rs.getLong("orders"), rs.getBigDecimal("revenue")));
        }, DAYS);
        return new ArrayList<>(byDay.values());
    }

    private List<ProductStat> topSold() {
        return productStats("sold_count", "sold_count > 0 and status <> 'ARCHIVED'", "sold_count desc");
    }

    private List<ProductStat> topViewed() {
        return productStats("view_count", "view_count > 0 and status = 'PUBLISHED'", "view_count desc");
    }

    private List<ProductStat> lowStock() {
        return productStats("coalesce(stock_quantity, 0)",
                "status = 'PUBLISHED' and stock_quantity is not null and stock_quantity <= " + ProductMapper.LOW_STOCK_THRESHOLD,
                "stock_quantity asc");
    }

    private List<ProductStat> productStats(String valueExpr, String where, String orderBy) {
        return jdbc.query("select id, slug, name_ru, coalesce(cover_thumb_key, cover_key) as thumb, stock_quantity, "
                        + valueExpr + " as value from products where " + where + " order by " + orderBy + " limit 8",
                (rs, i) -> new ProductStat(rs.getLong("id"), rs.getString("slug"), rs.getString("name_ru"),
                        urls.url(rs.getString("thumb")), rs.getLong("value"),
                        (Integer) rs.getObject("stock_quantity")));
    }

    private List<OrderSummaryDto> recentOrders() {
        return orders.findAll(PageRequest.of(0, 8, Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(Sort.Direction.DESC, "id"))))
                .map(orderMapper::toSummary)
                .getContent();
    }

    private static long num(Map<String, Object> row, String key) {
        Object value = row.get(key);
        return value == null ? 0 : ((Number) value).longValue();
    }
}
