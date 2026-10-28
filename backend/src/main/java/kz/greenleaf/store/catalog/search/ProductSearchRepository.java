package kz.greenleaf.store.catalog.search;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import kz.greenleaf.store.catalog.dto.CatalogDtos.FacetValue;
import kz.greenleaf.store.catalog.dto.CatalogDtos.PriceBucket;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * Catalog search on PostgreSQL: full-text search with prefix matching (results appear while typing),
 * brand/SKU/type matches, trigram word similarity for typos (fuzzy mode) and weighted relevance ranking.
 */
@Repository
public class ProductSearchRepository {

    private static final Pattern TOKEN_SPLIT = Pattern.compile("[^\\p{L}\\p{N}]+");
    private static final double SIMILARITY_THRESHOLD = 0.45;
    private static final String FROM = """
             from products p
             left join brands b on b.id = p.brand_id
             left join categories c on c.id = p.category_id
             left join product_types t on t.id = p.type_id
            """;
    private static final String POPULARITY = "(p.sold_count * 5 + p.view_count)";
    /** Product name reduced to space-separated lowercase words, so "«Салонный уход»" still starts a word with "сал". */
    private static final String NAME_WORDS = "(' ' || regexp_replace(lower(p.name_ru), '[^a-zа-яё0-9]+', ' ', 'g'))";
    private static final int MAX_WORD_TOKENS = 6;

    /** Price bands of the catalog filter; bounds are inclusive, matching the minPrice/maxPrice filter. */
    public static final List<BigDecimal[]> PRICE_BANDS = List.of(
            new BigDecimal[]{null, new BigDecimal("2999")},
            new BigDecimal[]{new BigDecimal("3000"), new BigDecimal("4999")},
            new BigDecimal[]{new BigDecimal("5000"), new BigDecimal("9999")},
            new BigDecimal[]{new BigDecimal("10000"), null});

    private final NamedParameterJdbcTemplate jdbc;

    public ProductSearchRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public SearchPage search(ProductQuery query) {
        MapSqlParameterSource params = new MapSqlParameterSource();
        StringBuilder sql = new StringBuilder("select p.id, count(*) over() as total");
        sql.append(FROM);
        appendWhere(sql, params, query, EnumSet.noneOf(Dimension.class));
        sql.append(" order by ").append(orderBy(query, params)).append(", p.id desc");
        sql.append(" limit :limit offset :offset");
        params.addValue("limit", query.size());
        params.addValue("offset", (long) query.page() * query.size());

        List<long[]> rows = jdbc.query(sql.toString(), params, (rs, i) -> new long[]{rs.getLong(1), rs.getLong(2)});
        List<Long> ids = rows.stream().map(r -> r[0]).toList();
        long total = rows.isEmpty() ? (query.page() == 0 ? 0 : count(query)) : rows.getFirst()[1];
        return new SearchPage(ids, total);
    }

    public long count(ProductQuery query) {
        MapSqlParameterSource params = new MapSqlParameterSource();
        StringBuilder sql = new StringBuilder("select count(*)").append(FROM);
        appendWhere(sql, params, query, EnumSet.noneOf(Dimension.class));
        Long total = jdbc.queryForObject(sql.toString(), params, Long.class);
        return total == null ? 0 : total;
    }

    /** Category counts ignore the category and type selection, so every category shows what picking it would give. */
    public List<FacetValue> categoryFacets(ProductQuery query) {
        MapSqlParameterSource params = new MapSqlParameterSource();
        StringBuilder sql = new StringBuilder("select c.slug, count(*) as cnt").append(FROM);
        appendWhere(sql, params, query, EnumSet.of(Dimension.CATEGORY, Dimension.TYPE));
        sql.append(" and c.slug is not null group by c.slug order by cnt desc");
        return jdbc.query(sql.toString(), params, (rs, i) -> new FacetValue(rs.getString(1), rs.getLong(2)));
    }

    /** Type counts inside the selected categories (or the whole catalog when no category is chosen). */
    public List<FacetValue> typeFacets(ProductQuery query) {
        MapSqlParameterSource params = new MapSqlParameterSource();
        StringBuilder sql = new StringBuilder("select t.slug, count(*) as cnt").append(FROM);
        appendWhere(sql, params, query, EnumSet.of(Dimension.TYPE));
        sql.append(" and t.slug is not null group by t.slug order by cnt desc");
        return jdbc.query(sql.toString(), params, (rs, i) -> new FacetValue(rs.getString(1), rs.getLong(2)));
    }

    public List<PriceBucket> priceBuckets(ProductQuery query) {
        MapSqlParameterSource params = new MapSqlParameterSource();
        StringBuilder sql = new StringBuilder("select ");
        for (int i = 0; i < PRICE_BANDS.size(); i++) {
            BigDecimal[] band = PRICE_BANDS.get(i);
            List<String> conditions = new ArrayList<>();
            if (band[0] != null) {
                conditions.add("p.price >= " + band[0].toPlainString());
            }
            if (band[1] != null) {
                conditions.add("p.price <= " + band[1].toPlainString());
            }
            sql.append(i == 0 ? "" : ", ").append("count(*) filter (where ").append(String.join(" and ", conditions))
                    .append(")");
        }
        sql.append(FROM);
        appendWhere(sql, params, query, EnumSet.of(Dimension.PRICE));
        return jdbc.queryForObject(sql.toString(), params, (rs, i) -> {
            List<PriceBucket> buckets = new ArrayList<>();
            for (int b = 0; b < PRICE_BANDS.size(); b++) {
                buckets.add(new PriceBucket(PRICE_BANDS.get(b)[0], PRICE_BANDS.get(b)[1], rs.getLong(b + 1)));
            }
            return buckets;
        });
    }

    public List<FacetValue> brandFacets(ProductQuery query) {
        MapSqlParameterSource params = new MapSqlParameterSource();
        StringBuilder sql = new StringBuilder("select b.slug, count(*) as cnt").append(FROM);
        appendWhere(sql, params, query, EnumSet.of(Dimension.BRAND));
        sql.append(" and b.slug is not null group by b.slug order by cnt desc");
        return jdbc.query(sql.toString(), params, (rs, i) -> new FacetValue(rs.getString(1), rs.getLong(2)));
    }

    public PriceRange priceRange(ProductQuery query) {
        MapSqlParameterSource params = new MapSqlParameterSource();
        StringBuilder sql = new StringBuilder("select min(p.price), max(p.price), count(*)").append(FROM);
        appendWhere(sql, params, query, EnumSet.of(Dimension.PRICE));
        return jdbc.queryForObject(sql.toString(), params,
                (rs, i) -> new PriceRange(rs.getBigDecimal(1), rs.getBigDecimal(2), rs.getLong(3)));
    }

    /** Products similar to the given one: same type, then same category, same brand and close price. */
    public List<Long> similar(Long productId, Long categoryId, Long typeId, Long brandId, BigDecimal price, int limit) {
        String sql = """
                select p.id from products p
                where p.status = 'PUBLISHED' and p.price is not null and p.id <> :id
                  and (p.category_id = :categoryId or p.brand_id = :brandId)
                order by (case when p.type_id = :typeId then 0 else 1 end),
                         (case when p.category_id = :categoryId then 0 else 1 end),
                         (case when p.brand_id = :brandId then 0 else 1 end),
                         abs(p.price - :price) asc,
                         %s desc
                limit :limit
                """.formatted(POPULARITY);
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("id", productId)
                .addValue("categoryId", categoryId == null ? -1L : categoryId)
                .addValue("typeId", typeId == null ? -1L : typeId)
                .addValue("brandId", brandId == null ? -1L : brandId)
                .addValue("price", price == null ? BigDecimal.ZERO : price)
                .addValue("limit", limit);
        return jdbc.queryForList(sql, params, Long.class);
    }

    /** "Frequently bought together" — co-occurrence of products in the same orders. */
    public List<Long> boughtTogether(Long productId, int limit) {
        String sql = """
                select oi2.product_id
                from order_items oi1
                join order_items oi2 on oi2.order_id = oi1.order_id and oi2.product_id <> oi1.product_id
                join orders o on o.id = oi1.order_id and o.status <> 'CANCELLED'
                join products p on p.id = oi2.product_id and p.status = 'PUBLISHED'
                where oi1.product_id = :id
                group by oi2.product_id
                order by count(*) desc, max(o.created_at) desc
                limit :limit
                """;
        return jdbc.queryForList(sql, new MapSqlParameterSource().addValue("id", productId).addValue("limit", limit),
                Long.class);
    }

    /**
     * What a shopper may like next, from their own non-cancelled orders: products other customers bought together
     * with theirs weigh most, then the same type, then the same category. Already bought products are left out.
     */
    public List<Long> recommendedFor(Long userId, int limit) {
        String sql = """
                with bought as (
                    select distinct oi.product_id
                    from order_items oi
                    join orders o on o.id = oi.order_id and o.status <> 'CANCELLED'
                    where o.user_id = :userId and oi.product_id is not null
                ),
                candidates as (
                    select oi2.product_id, 3 as score
                    from order_items oi1
                    join order_items oi2 on oi2.order_id = oi1.order_id and oi2.product_id <> oi1.product_id
                    join orders o on o.id = oi1.order_id and o.status <> 'CANCELLED'
                    where oi1.product_id in (select product_id from bought)
                    union all
                    select p.id, case when p.type_id in (select bp.type_id from products bp
                                                         where bp.id in (select product_id from bought)) then 2 else 1 end
                    from products p
                    where p.category_id in (select bp.category_id from products bp
                                            where bp.id in (select product_id from bought))
                )
                select c.product_id
                from candidates c
                join products p on p.id = c.product_id
                where p.status = 'PUBLISHED' and p.price is not null and p.cover_key is not null
                  and (p.stock_quantity is null or p.stock_quantity > 0)
                  and c.product_id not in (select product_id from bought)
                group by c.product_id
                order by sum(c.score) desc, random()
                limit :limit
                """;
        return jdbc.queryForList(sql, new MapSqlParameterSource().addValue("userId", userId).addValue("limit", limit),
                Long.class);
    }

    /** A random product with a photo that can be bought now; limited to the given categories when they are set. */
    public Long randomAvailable(List<String> categorySlugs) {
        MapSqlParameterSource params = new MapSqlParameterSource();
        StringBuilder sql = new StringBuilder("""
                select p.id
                from products p
                join categories c on c.id = p.category_id
                where p.status = 'PUBLISHED' and p.price is not null and p.cover_key is not null
                  and (p.stock_quantity is null or p.stock_quantity > 0)
                """);
        if (!categorySlugs.isEmpty()) {
            sql.append(" and c.slug in (:slugs)");
            params.addValue("slugs", categorySlugs);
        }
        sql.append(" order by random() limit 1");
        return jdbc.queryForList(sql.toString(), params, Long.class).stream().findFirst().orElse(null);
    }

    private void appendWhere(StringBuilder sql, MapSqlParameterSource params, ProductQuery query, Set<Dimension> exclude) {
        sql.append(" where p.status = 'PUBLISHED' and p.price is not null");
        if (query.text() != null) {
            String text = query.text().toLowerCase(Locale.ROOT);
            params.addValue("q", text);
            params.addValue("qLike", "%" + escapeLike(text) + "%");
            String prefixQuery = prefixTsQuery(text);
            List<String> conditions = new ArrayList<>();
            if (prefixQuery != null) {
                params.addValue("tsq", prefixQuery);
                conditions.add("p.search_vector @@ to_tsquery('russian', :tsq)");
                conditions.add("p.search_vector @@ to_tsquery('simple', :tsq)");
                conditions.add("lower(p.name_ru) like :qLike");
                conditions.add("lower(b.name) like :qLike");
                conditions.add("lower(p.sku) like :qLike");
                conditions.add("lower(t.name_ru) like :qLike");
            } else {
                // A single typed letter: products whose name (or brand) has a word starting with it.
                List<String> tokens = wordStartTokens(text);
                if (tokens.isEmpty()) {
                    conditions.add("lower(p.name_ru) like :qLike");
                } else {
                    params.addValue("wordStart", "% " + escapeLike(tokens.getFirst()) + "%");
                    params.addValue("brandStart", escapeLike(tokens.getFirst()) + "%");
                    conditions.add(NAME_WORDS + " like :wordStart");
                    conditions.add("lower(b.name) like :brandStart");
                }
            }
            if (query.fuzzy()) {
                conditions.add("word_similarity(:q, lower(p.name_ru)) >= " + SIMILARITY_THRESHOLD);
            }
            sql.append(" and (").append(String.join(" or ", conditions)).append(")");
        }
        if (!exclude.contains(Dimension.CATEGORY) && !query.categories().isEmpty()) {
            sql.append(" and c.slug in (:categories)");
            params.addValue("categories", query.categories());
        }
        if (!exclude.contains(Dimension.TYPE) && !query.types().isEmpty()) {
            params.addValue("types", query.types());
            if (exclude.contains(Dimension.CATEGORY) || query.categories().isEmpty()) {
                sql.append(" and t.slug in (:types)");
            } else {
                // A type narrows only its own category: "shampoos" + the whole "body-care" category is a valid mix.
                sql.append(" and (t.slug in (:types) or not exists (select 1 from product_types st")
                        .append(" where st.slug in (:types) and st.category_id = p.category_id))");
            }
        }
        if (!exclude.contains(Dimension.BRAND) && !query.brands().isEmpty()) {
            sql.append(" and b.slug in (:brands)");
            params.addValue("brands", query.brands());
        }
        if (!exclude.contains(Dimension.PRICE)) {
            if (query.minPrice() != null) {
                sql.append(" and p.price >= :minPrice");
                params.addValue("minPrice", query.minPrice());
            }
            if (query.maxPrice() != null) {
                sql.append(" and p.price <= :maxPrice");
                params.addValue("maxPrice", query.maxPrice());
            }
        }
        if (query.inStockOnly()) {
            sql.append(" and (p.stock_quantity is null or p.stock_quantity > 0)");
        }
        if (query.featuredOnly()) {
            sql.append(" and p.featured");
        }
    }

    private String orderBy(ProductQuery query, MapSqlParameterSource params) {
        return switch (query.sort()) {
            case RELEVANCE -> relevance(query, params) + " desc, " + POPULARITY + " desc";
            case POPULAR -> POPULARITY + " desc, p.featured desc";
            case PRICE_ASC -> "p.price asc";
            case PRICE_DESC -> "p.price desc";
            case NEWEST -> "coalesce(p.published_at, p.created_at) desc";
            case NAME -> "p.name_ru asc";
        };
    }

    /**
     * Name hits dominate: every typed word that starts a word of the product name adds a point, all of them together
     * add another one, so "шам" puts shampoos above products that only mention it in the description.
     */
    private String relevance(ProductQuery query, MapSqlParameterSource params) {
        String text = query.text().toLowerCase(Locale.ROOT);
        StringBuilder score = new StringBuilder("(word_similarity(:q, lower(p.name_ru))")
                .append(" + case when lower(p.name_ru) like :qLike then 0.6 else 0 end")
                .append(" + case when lower(b.name) like :qLike then 0.4 else 0 end")
                .append(" + case when lower(t.name_ru) like :qLike then 0.5 else 0 end");
        List<String> tokens = wordStartTokens(text);
        List<String> hits = new ArrayList<>();
        for (int i = 0; i < tokens.size(); i++) {
            String name = "ws" + i;
            params.addValue(name, "% " + escapeLike(tokens.get(i)) + "%");
            hits.add(NAME_WORDS + " like :" + name);
            score.append(" + case when ").append(NAME_WORDS).append(" like :").append(name).append(" then 1 else 0 end");
        }
        if (hits.size() > 1) {
            score.append(" + case when ").append(String.join(" and ", hits)).append(" then 1 else 0 end");
        }
        if (prefixTsQuery(text) != null) {
            score.append(" + ts_rank_cd(p.search_vector, to_tsquery('russian', :tsq)) * 4")
                    .append(" + ts_rank_cd(p.search_vector, to_tsquery('simple', :tsq)) * 2");
        }
        return score.append(")").toString();
    }

    /**
     * Lowercase words of at least two letters/digits, the same tokens the prefix tsquery is built from.
     * When nothing that long was typed yet, the first single letter is used so results appear from the first key.
     */
    static List<String> wordStartTokens(String text) {
        List<String> tokens = new ArrayList<>();
        String firstLetter = null;
        for (String token : TOKEN_SPLIT.split(text.toLowerCase(Locale.ROOT))) {
            if (token.length() >= 2 && !tokens.contains(token)) {
                tokens.add(token);
            } else if (token.length() == 1 && firstLetter == null) {
                firstLetter = token;
            }
        }
        if (tokens.isEmpty() && firstLetter != null) {
            return List.of(firstLetter);
        }
        return tokens.size() > MAX_WORD_TOKENS ? tokens.subList(0, MAX_WORD_TOKENS) : tokens;
    }

    /** "гель стир" → "гель:* & стир:*" — only letters/digits survive, so the tsquery syntax cannot be broken. */
    static String prefixTsQuery(String text) {
        List<String> tokens = new ArrayList<>();
        for (String token : TOKEN_SPLIT.split(text)) {
            if (token.length() >= 2) {
                tokens.add(token + ":*");
            }
        }
        return tokens.isEmpty() ? null : tokens.stream().limit(8).collect(Collectors.joining(" & "));
    }

    private static String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    private enum Dimension {CATEGORY, TYPE, BRAND, PRICE}

    public record SearchPage(List<Long> ids, long total) {
    }

    public record PriceRange(BigDecimal min, BigDecimal max, long count) {
    }
}
