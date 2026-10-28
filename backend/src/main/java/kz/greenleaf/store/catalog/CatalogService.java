package kz.greenleaf.store.catalog;

import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;
import java.util.function.Function;
import java.util.stream.Collectors;
import kz.greenleaf.store.catalog.domain.Category;
import kz.greenleaf.store.catalog.domain.Product;
import kz.greenleaf.store.catalog.domain.ProductStatus;
import kz.greenleaf.store.catalog.domain.ProductType;
import kz.greenleaf.store.catalog.dto.CatalogDtos.BrandDto;
import kz.greenleaf.store.catalog.dto.CatalogDtos.BrandRef;
import kz.greenleaf.store.catalog.dto.CatalogDtos.CategoryDto;
import kz.greenleaf.store.catalog.dto.CatalogDtos.CategoryRef;
import kz.greenleaf.store.catalog.dto.CatalogDtos.FacetsDto;
import kz.greenleaf.store.catalog.dto.CatalogDtos.GiftPickDto;
import kz.greenleaf.store.catalog.dto.CatalogDtos.HomeDto;
import kz.greenleaf.store.catalog.dto.CatalogDtos.ProductCardDto;
import kz.greenleaf.store.catalog.dto.CatalogDtos.ProductDetailDto;
import kz.greenleaf.store.catalog.dto.CatalogDtos.ProductSearchResponse;
import kz.greenleaf.store.catalog.dto.CatalogDtos.ProductTypeDto;
import kz.greenleaf.store.catalog.dto.CatalogDtos.RelatedDto;
import kz.greenleaf.store.catalog.dto.CatalogDtos.SuggestItem;
import kz.greenleaf.store.catalog.dto.CatalogDtos.SuggestionsDto;
import kz.greenleaf.store.catalog.dto.CatalogDtos.TypeRef;
import kz.greenleaf.store.catalog.repo.BrandRepository;
import kz.greenleaf.store.catalog.repo.CategoryRepository;
import kz.greenleaf.store.catalog.repo.ProductMediaRepository;
import kz.greenleaf.store.catalog.repo.ProductRepository;
import kz.greenleaf.store.catalog.repo.ProductTypeRepository;
import kz.greenleaf.store.catalog.search.KeyboardLayout;
import kz.greenleaf.store.catalog.search.ProductQuery;
import kz.greenleaf.store.catalog.search.ProductSearchRepository;
import kz.greenleaf.store.catalog.search.ProductSearchRepository.PriceRange;
import kz.greenleaf.store.catalog.search.ProductSearchRepository.SearchPage;
import kz.greenleaf.store.catalog.search.SearchAnalytics;
import kz.greenleaf.store.catalog.search.SortOption;
import kz.greenleaf.store.common.ApiException;
import kz.greenleaf.store.config.CacheConfig;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class CatalogService {

    private static final int RELATED_LIMIT = 8;
    private static final int HOME_SECTION_SIZE = 8;
    private static final int SUGGEST_PRODUCTS = 8;
    private static final int GIFT_CANDIDATES = 8;
    /** Without purchases to go on, the gift idea comes from perfume, cosmetics and home fragrances. */
    private static final List<String> GIFT_CATEGORIES = List.of("makeup", "face-care", "home-fragrance");

    private final ProductRepository products;
    private final ProductMediaRepository media;
    private final CategoryRepository categories;
    private final ProductTypeRepository types;
    private final BrandRepository brands;
    private final ProductSearchRepository search;
    private final SearchAnalytics analytics;
    private final ProductMapper mapper;

    public CatalogService(ProductRepository products, ProductMediaRepository media, CategoryRepository categories,
                          ProductTypeRepository types, BrandRepository brands, ProductSearchRepository search,
                          SearchAnalytics analytics, ProductMapper mapper) {
        this.products = products;
        this.media = media;
        this.categories = categories;
        this.types = types;
        this.brands = brands;
        this.search = search;
        this.analytics = analytics;
        this.mapper = mapper;
    }

    @Cacheable(CacheConfig.CATEGORIES)
    public List<CategoryDto> categories() {
        Map<Long, Long> counts = toCountMap(products.countPublishedByCategory());
        Map<Long, Long> typeCounts = toCountMap(products.countPublishedByType());
        Map<Long, List<ProductTypeDto>> typesByCategory = types.findAllOrdered().stream()
                .collect(Collectors.groupingBy(t -> t.getCategory().getId(), Collectors.mapping(
                        t -> new ProductTypeDto(t.getSlug(), t.getNameRu(), t.getNameKk(),
                                typeCounts.getOrDefault(t.getId(), 0L)),
                        Collectors.toList())));
        Map<Long, String> covers = new HashMap<>();
        for (Object[] row : products.categoryCovers()) {
            covers.put(((Number) row[0]).longValue(), mapper.mediaUrl((String) row[1]));
        }
        return categories.findAllOrdered().stream()
                .map(c -> new CategoryDto(c.getId(), c.getSlug(), c.getNameRu(), c.getNameKk(), c.getDescriptionRu(),
                        c.getDescriptionKk(), c.getIcon(), c.getSortOrder(), counts.getOrDefault(c.getId(), 0L),
                        List.copyOf(typesByCategory.getOrDefault(c.getId(), List.of())), covers.get(c.getId())))
                .toList();
    }

    @Cacheable(CacheConfig.BRANDS)
    public List<BrandDto> brands() {
        Map<Long, Long> counts = toCountMap(products.countPublishedByBrand());
        return brands.findAllOrdered().stream()
                .map(b -> new BrandDto(b.getId(), b.getSlug(), b.getName(), b.getDescription(),
                        counts.getOrDefault(b.getId(), 0L)))
                .toList();
    }

    @Cacheable(cacheNames = CacheConfig.SEARCH, key = "#query.cacheKey()")
    public ProductSearchResponse search(ProductQuery query) {
        Resolved resolved = resolve(query);
        SearchPage page = search.search(resolved.query());
        int totalPages = (int) Math.ceil((double) page.total() / query.size());
        return new ProductSearchResponse(loadCards(page.ids()), query.page(), query.size(), page.total(), totalPages,
                resolved.corrected());
    }

    @Cacheable(cacheNames = CacheConfig.FACETS, key = "#query.facetCacheKey()")
    public FacetsDto facets(ProductQuery query) {
        ProductQuery effective = resolve(query).query();
        PriceRange range = search.priceRange(effective);
        return new FacetsDto(search.categoryFacets(effective), search.typeFacets(effective),
                search.brandFacets(effective), search.priceBuckets(effective), range.min(), range.max(),
                search.count(effective));
    }

    @Cacheable(cacheNames = CacheConfig.SUGGEST, key = "#text.toLowerCase()")
    public SuggestionsDto suggest(String text) {
        String normalized = text.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
        Resolved resolved = resolve(new ProductQuery(normalized, null, null, null, null, null, false, false,
                SortOption.RELEVANCE, 0, SUGGEST_PRODUCTS));
        SearchPage page = search.search(resolved.query());
        String corrected = resolved.corrected();
        String needle = corrected != null ? corrected : normalized;
        List<SuggestItem> items = loadCards(page.ids()).stream()
                .map(c -> new SuggestItem(c.slug(), c.nameRu(), c.nameKk(), c.thumbUrl(), c.price(), c.partnerPrice(),
                        c.brand() == null ? null : c.brand().name(), c.volume(),
                        c.category() == null ? null : c.category().nameRu(),
                        c.category() == null ? null : c.category().nameKk()))
                .toList();
        List<Category> allCategories = categories.findAllOrdered();
        List<ProductType> allTypes = types.findAllOrdered();
        List<Category> categoryHits = matchNames(allCategories, Category::getNameRu, needle, 3);
        List<ProductType> typeHits = matchNames(allTypes, ProductType::getNameRu, needle, 4);
        if (categoryHits.isEmpty() && typeHits.isEmpty()) {
            // Nothing fits in Russian, so the shopper is probably typing in Kazakh ("шаш" — hair).
            categoryHits = matchNames(allCategories, Category::getNameKk, needle, 3);
            typeHits = matchNames(allTypes, ProductType::getNameKk, needle, 4);
        }
        List<CategoryRef> matchedCategories = categoryHits.stream().map(mapper::categoryRef).toList();
        List<TypeRef> matchedTypes = typeHits.stream().map(mapper::typeRef).toList();
        List<BrandRef> matchedBrands = brands.findAllOrdered().stream()
                .filter(b -> matchesWords(b.getName(), needle))
                .limit(3)
                .map(mapper::brandRef)
                .toList();
        return new SuggestionsDto(items, page.total(), matchedCategories, matchedTypes, matchedBrands,
                analytics.popular(needle, 5), corrected);
    }

    @Cacheable(cacheNames = CacheConfig.PRODUCT, key = "#slug")
    public ProductDetailDto product(String slug) {
        Product product = products.findBySlug(slug)
                .filter(p -> p.getStatus() == ProductStatus.PUBLISHED)
                .orElseThrow(() -> ApiException.notFound("Товар"));
        product.getBenefits().size();
        product.getAttributes().size();
        return mapper.toDetail(product, media.findByProductId(product.getId()));
    }

    @Cacheable(cacheNames = CacheConfig.RELATED, key = "#slug")
    public RelatedDto related(String slug) {
        Product product = products.findBySlug(slug)
                .filter(p -> p.getStatus() == ProductStatus.PUBLISHED)
                .orElseThrow(() -> ApiException.notFound("Товар"));
        List<Long> together = search.boughtTogether(product.getId(), 6);
        List<Long> similar = search.similar(product.getId(),
                product.getCategory() == null ? null : product.getCategory().getId(),
                product.getType() == null ? null : product.getType().getId(),
                product.getBrand() == null ? null : product.getBrand().getId(),
                product.getPrice(), RELATED_LIMIT + together.size()).stream()
                .filter(id -> !together.contains(id))
                .limit(RELATED_LIMIT)
                .toList();
        return new RelatedDto(loadCards(together), loadCards(similar));
    }

    @Cacheable(CacheConfig.HOME)
    public HomeDto home() {
        List<Long> featured = search.search(ProductQuery.all(true, true, SortOption.POPULAR, HOME_SECTION_SIZE)).ids();
        List<Long> bestsellers = search.search(ProductQuery.all(true, false, SortOption.POPULAR,
                        HOME_SECTION_SIZE + featured.size())).ids().stream()
                .filter(id -> !featured.contains(id)).limit(HOME_SECTION_SIZE).toList();
        List<Long> newest = search.search(ProductQuery.all(true, false, SortOption.NEWEST, HOME_SECTION_SIZE)).ids();
        long total = search.count(ProductQuery.all(false, false, null, 1));
        List<CategoryDto> categoryList = categories();
        return new HomeDto(loadCards(featured), loadCards(bestsellers), loadCards(newest), categoryList, total);
    }

    /** Not cached: a fresh pick on every visit. */
    public GiftPickDto giftPick(Long userId) {
        if (userId != null) {
            List<Long> recommended = search.recommendedFor(userId, GIFT_CANDIDATES);
            if (!recommended.isEmpty()) {
                Long id = recommended.get(ThreadLocalRandom.current().nextInt(recommended.size()));
                List<ProductCardDto> cards = loadCards(List.of(id));
                if (!cards.isEmpty()) {
                    return new GiftPickDto(cards.getFirst(), true);
                }
            }
        }
        Long id = search.randomAvailable(GIFT_CATEGORIES);
        if (id == null) {
            id = search.randomAvailable(List.of());
        }
        List<ProductCardDto> cards = id == null ? List.of() : loadCards(List.of(id));
        return new GiftPickDto(cards.isEmpty() ? null : cards.getFirst(), false);
    }

    /** Favorites and recently viewed live in the browser as ids; hidden or deleted products simply drop out. */
    public List<ProductCardDto> publishedCards(List<Long> ids) {
        List<Long> wanted = ids.stream().filter(Objects::nonNull).distinct().limit(ProductQuery.MAX_PAGE_SIZE).toList();
        return loadCards(wanted).stream().filter(c -> c.status() == ProductStatus.PUBLISHED).toList();
    }

    public Long publishedIdBySlug(String slug) {
        return products.findBySlug(slug)
                .filter(p -> p.getStatus() == ProductStatus.PUBLISHED)
                .map(Product::getId)
                .orElseThrow(() -> ApiException.notFound("Товар"));
    }

    List<ProductCardDto> loadCards(Collection<Long> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        Set<Long> ordered = new LinkedHashSet<>(ids);
        Map<Long, Product> byId = products.findAllByIdIn(ordered).stream()
                .collect(Collectors.toMap(Product::getId, Function.identity()));
        return ordered.stream().map(byId::get).filter(Objects::nonNull).map(mapper::toCard).toList();
    }

    /**
     * Picks the narrowest text interpretation that finds something: exact prefix search, then the same text typed in
     * the wrong keyboard layout, then typo-tolerant search. Facets use the same choice, so counts match the results.
     */
    private Resolved resolve(ProductQuery query) {
        if (query.text() == null || search.count(query) > 0) {
            return new Resolved(query, null);
        }
        String converted = KeyboardLayout.latinToCyrillic(query.text());
        ProductQuery convertedQuery = converted == null ? null : query.withText(converted);
        if (convertedQuery != null && search.count(convertedQuery) > 0) {
            return new Resolved(convertedQuery, converted);
        }
        ProductQuery fuzzy = query.withFuzzy(true);
        if (search.count(fuzzy) > 0) {
            return new Resolved(fuzzy, null);
        }
        if (convertedQuery != null && search.count(convertedQuery.withFuzzy(true)) > 0) {
            return new Resolved(convertedQuery.withFuzzy(true), converted);
        }
        return new Resolved(query, null);
    }

    static <T> List<T> matchNames(List<T> all, Function<T, String> name, String needle, int limit) {
        return all.stream().filter(x -> matchesWords(name.apply(x), needle)).limit(limit).toList();
    }

    private record Resolved(ProductQuery query, String corrected) {
    }

    private static Map<Long, Long> toCountMap(List<Object[]> rows) {
        Map<Long, Long> counts = new HashMap<>();
        for (Object[] row : rows) {
            counts.put((Long) row[0], (Long) row[1]);
        }
        return counts;
    }

    /** Every typed word must start a word of the name: "шам" → «Шампуни», "уход вол" → «Уход за волосами». */
    static boolean matchesWords(String haystack, String needle) {
        if (haystack == null || needle == null || needle.length() < 2) {
            return false;
        }
        List<String> words = List.of(haystack.toLowerCase(Locale.ROOT).split("[^\\p{L}\\p{N}]+"));
        for (String token : needle.split("[^\\p{L}\\p{N}]+")) {
            if (!token.isEmpty() && words.stream().noneMatch(w -> w.startsWith(token))) {
                return false;
            }
        }
        return true;
    }
}
