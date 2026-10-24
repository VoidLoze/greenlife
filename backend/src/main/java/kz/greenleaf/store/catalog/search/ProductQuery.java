package kz.greenleaf.store.catalog.search;

import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

public record ProductQuery(
        String text,
        List<String> categories,
        List<String> types,
        List<String> brands,
        BigDecimal minPrice,
        BigDecimal maxPrice,
        boolean inStockOnly,
        boolean featuredOnly,
        SortOption sort,
        int page,
        int size,
        /* Also accept typo-similar names; used only when the exact (prefix) search finds nothing. */
        boolean fuzzy) {

    public static final int MAX_PAGE_SIZE = 60;

    public ProductQuery(String text, List<String> categories, List<String> types, List<String> brands,
                        BigDecimal minPrice, BigDecimal maxPrice, boolean inStockOnly, boolean featuredOnly,
                        SortOption sort, int page, int size) {
        this(text, categories, types, brands, minPrice, maxPrice, inStockOnly, featuredOnly, sort, page, size, false);
    }

    public ProductQuery {
        text = text == null || text.isBlank() ? null : text.trim().replaceAll("\\s+", " ");
        if (text != null && text.length() > 100) {
            text = text.substring(0, 100);
        }
        categories = normalize(categories);
        types = normalize(types);
        brands = normalize(brands);
        page = Math.max(0, page);
        size = Math.min(Math.max(1, size), MAX_PAGE_SIZE);
        if (sort == null) {
            sort = text != null ? SortOption.RELEVANCE : SortOption.POPULAR;
        }
        if (sort == SortOption.RELEVANCE && text == null) {
            sort = SortOption.POPULAR;
        }
        if (minPrice != null && maxPrice != null && minPrice.compareTo(maxPrice) > 0) {
            BigDecimal swap = minPrice;
            minPrice = maxPrice;
            maxPrice = swap;
        }
    }

    /** Catalog-wide query without filters (home page sections, totals). */
    public static ProductQuery all(boolean inStockOnly, boolean featuredOnly, SortOption sort, int size) {
        return new ProductQuery(null, null, null, null, null, null, inStockOnly, featuredOnly, sort, 0, size, false);
    }

    public ProductQuery withText(String newText) {
        return new ProductQuery(newText, categories, types, brands, minPrice, maxPrice, inStockOnly, featuredOnly,
                text != null && sort == SortOption.RELEVANCE ? null : sort, page, size, fuzzy);
    }

    public ProductQuery withPage(int newPage, int newSize) {
        return new ProductQuery(text, categories, types, brands, minPrice, maxPrice, inStockOnly, featuredOnly, sort,
                newPage, newSize, fuzzy);
    }

    public ProductQuery withFuzzy(boolean newFuzzy) {
        return new ProductQuery(text, categories, types, brands, minPrice, maxPrice, inStockOnly, featuredOnly, sort,
                page, size, newFuzzy);
    }

    /** Stable cache key: the same filters in any order produce the same key. */
    public String cacheKey() {
        return String.join("|",
                text == null ? "" : text.toLowerCase(Locale.ROOT),
                String.join(",", categories),
                String.join(",", types),
                String.join(",", brands),
                minPrice == null ? "" : minPrice.stripTrailingZeros().toPlainString(),
                maxPrice == null ? "" : maxPrice.stripTrailingZeros().toPlainString(),
                Boolean.toString(inStockOnly),
                Boolean.toString(featuredOnly),
                sort.name(),
                Integer.toString(page),
                Integer.toString(size),
                fuzzy ? "fuzzy" : "");
    }

    public String facetCacheKey() {
        return withPage(0, 1).cacheKey();
    }

    private static List<String> normalize(List<String> values) {
        if (values == null) {
            return List.of();
        }
        return values.stream()
                .flatMap(v -> List.of(v.split(",")).stream())
                .map(String::trim)
                .filter(v -> !v.isEmpty() && v.length() <= 80)
                .map(v -> v.toLowerCase(Locale.ROOT))
                .distinct()
                .sorted()
                .limit(30)
                .collect(Collectors.toUnmodifiableList());
    }
}
