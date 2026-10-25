package kz.greenleaf.store.catalog;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import kz.greenleaf.store.auth.AuthPrincipal;
import kz.greenleaf.store.catalog.dto.CatalogDtos.BrandDto;
import kz.greenleaf.store.catalog.dto.CatalogDtos.CategoryDto;
import kz.greenleaf.store.catalog.dto.CatalogDtos.FacetsDto;
import kz.greenleaf.store.catalog.dto.CatalogDtos.HomeDto;
import kz.greenleaf.store.catalog.dto.CatalogDtos.ProductCardDto;
import kz.greenleaf.store.catalog.dto.CatalogDtos.ProductDetailDto;
import kz.greenleaf.store.catalog.dto.CatalogDtos.ProductSearchResponse;
import kz.greenleaf.store.catalog.dto.CatalogDtos.RelatedDto;
import kz.greenleaf.store.catalog.dto.CatalogDtos.SuggestionsDto;
import kz.greenleaf.store.catalog.search.ProductQuery;
import kz.greenleaf.store.catalog.search.SearchAnalytics;
import kz.greenleaf.store.catalog.search.SortOption;
import kz.greenleaf.store.common.ClientInfo;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/catalog")
@Tag(name = "Catalog", description = "Публичный каталог: поиск, фильтры, карточки товаров")
public class CatalogController {

    private static final CacheControl SHORT_CACHE = CacheControl.maxAge(Duration.ofSeconds(30)).cachePublic();

    private final CatalogService catalog;
    private final ViewCounterService views;
    private final SearchAnalytics analytics;

    public CatalogController(CatalogService catalog, ViewCounterService views, SearchAnalytics analytics) {
        this.catalog = catalog;
        this.views = views;
        this.analytics = analytics;
    }

    @GetMapping("/home")
    @Operation(summary = "Данные главной страницы: хиты, новинки, категории")
    public ResponseEntity<HomeDto> home() {
        return ResponseEntity.ok().cacheControl(SHORT_CACHE).body(catalog.home());
    }

    @GetMapping("/categories")
    @Operation(summary = "Категории с количеством товаров")
    public ResponseEntity<List<CategoryDto>> categories() {
        return ResponseEntity.ok().cacheControl(SHORT_CACHE).body(catalog.categories());
    }

    @GetMapping("/brands")
    @Operation(summary = "Бренды с количеством товаров")
    public ResponseEntity<List<BrandDto>> brands() {
        return ResponseEntity.ok().cacheControl(SHORT_CACHE).body(catalog.brands());
    }

    @GetMapping("/products")
    @Operation(summary = "Поиск и фильтрация товаров",
            description = "q — полнотекстовый поиск с опечатками и исправлением раскладки; "
                    + "category/type/brand — slug, можно несколько через запятую; "
                    + "type (подкатегория) сужает только свою категорию; "
                    + "sort: relevance, popular, price_asc, price_desc, newest, name")
    public ProductSearchResponse products(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) List<String> category,
            @RequestParam(required = false) List<String> type,
            @RequestParam(required = false) List<String> brand,
            @RequestParam(required = false) BigDecimal minPrice,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(defaultValue = "false") boolean inStock,
            @RequestParam(defaultValue = "false") boolean featured,
            @RequestParam(required = false) String sort,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "24") int size) {
        ProductQuery query = new ProductQuery(q, category, type, brand, minPrice, maxPrice, inStock, featured,
                SortOption.parse(sort), page, size);
        ProductSearchResponse response = catalog.search(query);
        if (query.page() == 0) {
            analytics.record(response.correctedQuery() != null ? response.correctedQuery() : query.text(),
                    response.totalItems());
        }
        return response;
    }

    @GetMapping("/facets")
    @Operation(summary = "Фасеты для фильтров с учётом текущего поиска")
    public FacetsDto facets(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) List<String> category,
            @RequestParam(required = false) List<String> type,
            @RequestParam(required = false) List<String> brand,
            @RequestParam(required = false) BigDecimal minPrice,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(defaultValue = "false") boolean inStock,
            @RequestParam(defaultValue = "false") boolean featured) {
        return catalog.facets(new ProductQuery(q, category, type, brand, minPrice, maxPrice, inStock, featured, null,
                0, 1));
    }

    @GetMapping("/suggest")
    @Operation(summary = "Подсказки для строки поиска")
    public SuggestionsDto suggest(@RequestParam(defaultValue = "") String q) {
        String text = q.trim();
        if (text.isEmpty()) {
            return new SuggestionsDto(List.of(), 0, List.of(), List.of(), List.of(), analytics.popular(null, 6), null);
        }
        return catalog.suggest(text.length() > 60 ? text.substring(0, 60) : text);
    }

    @GetMapping("/cards")
    @Operation(summary = "Карточки опубликованных товаров по id в заданном порядке (избранное, недавно просмотренные)")
    public List<ProductCardDto> cards(@RequestParam(defaultValue = "") List<Long> ids) {
        return catalog.publishedCards(ids);
    }

    @GetMapping("/products/{slug}")
    @Operation(summary = "Полная карточка товара: фото, скрины, документы, характеристики")
    public ProductDetailDto product(@PathVariable String slug) {
        return catalog.product(slug);
    }

    @GetMapping("/products/{slug}/related")
    @Operation(summary = "Похожие товары и «часто покупают вместе»")
    public RelatedDto related(@PathVariable String slug) {
        return catalog.related(slug);
    }

    @PostMapping("/products/{slug}/view")
    @Operation(summary = "Зарегистрировать просмотр карточки (учитывается раз в 30 минут на посетителя)")
    public ResponseEntity<Void> view(@PathVariable String slug, HttpServletRequest request,
                                     @AuthenticationPrincipal AuthPrincipal principal) {
        Long productId = catalog.publishedIdBySlug(slug);
        views.register(productId, visitorKey(request, principal));
        return ResponseEntity.accepted().build();
    }

    private static String visitorKey(HttpServletRequest request, AuthPrincipal principal) {
        if (principal != null) {
            return "u" + principal.id();
        }
        ClientInfo client = ClientInfo.from(request);
        String raw = client.ip() + "|" + (client.userAgent() == null ? "" : client.userAgent());
        return UUID.nameUUIDFromBytes(raw.getBytes(StandardCharsets.UTF_8)).toString();
    }
}
