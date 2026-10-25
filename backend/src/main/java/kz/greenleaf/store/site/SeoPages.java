package kz.greenleaf.store.site;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import kz.greenleaf.store.catalog.CatalogService;
import kz.greenleaf.store.catalog.dto.CatalogDtos.CategoryDto;
import kz.greenleaf.store.catalog.dto.CatalogDtos.MediaDto;
import kz.greenleaf.store.catalog.dto.CatalogDtos.ProductCardDto;
import kz.greenleaf.store.catalog.dto.CatalogDtos.ProductDetailDto;
import kz.greenleaf.store.catalog.dto.CatalogDtos.ProductTypeDto;
import kz.greenleaf.store.catalog.search.ProductQuery;
import kz.greenleaf.store.catalog.search.SortOption;
import kz.greenleaf.store.common.ApiException;
import kz.greenleaf.store.config.AppProperties;
import org.springframework.stereotype.Component;
import org.springframework.web.util.HtmlUtils;
import tools.jackson.databind.json.JsonMapper;

/**
 * What a search engine needs to know about a page of the single-page app before any JavaScript runs: title,
 * description, canonical address, link-preview tags, schema.org data and a plain-HTML copy of the main content.
 * nginx inserts the head and body parts into index.html (SSI), so every visitor gets the same HTML.
 */
@Component
public class SeoPages {

    static final String SITE_TITLE = "Greenleaf family — Born for Beauty";
    private static final String DEFAULT_DESCRIPTION =
            "Средства для дома, ухода и здоровья в Алматы. Партнёрские цены, доставка и заказ в WhatsApp.";
    private static final String HOME_DESCRIPTION = "Greenleaf family — Born for Beauty. " + DEFAULT_DESCRIPTION;
    private static final int CATEGORY_PRODUCTS = ProductQuery.MAX_PAGE_SIZE;
    private static final List<String> PRIVATE_PREFIXES =
            List.of("/admin", "/account", "/checkout", "/order/", "/login", "/register");

    public record Page(String title, String description, String canonical, String image, String ogType,
                       boolean noindex, List<Map<String, Object>> jsonLd, String body) {
    }

    private final CatalogService catalog;
    private final StoreSettingsService settings;
    private final JsonMapper json;
    private final String origin;

    public SeoPages(CatalogService catalog, StoreSettingsService settings, JsonMapper json, AppProperties properties) {
        this.catalog = catalog;
        this.settings = settings;
        this.json = json;
        String publicUrl = properties.publicUrl().trim();
        this.origin = publicUrl.endsWith("/") ? publicUrl.substring(0, publicUrl.length() - 1) : publicUrl;
    }

    public Page resolve(String path, Function<String, String> param) {
        if (path.isEmpty() || path.equals("/") || path.equals("/index.html")) {
            return home();
        }
        if (path.startsWith("/product/") && path.indexOf('/', 9) < 0 && path.length() > 9) {
            return product(path.substring(9));
        }
        if (path.equals("/catalog")) {
            String quickView = param.apply("product");
            if (quickView != null && !quickView.isBlank()) {
                return product(quickView);
            }
            return catalogPage(param);
        }
        switch (path) {
            case "/partner":
                return simple("Партнёрство и скидки", "/partner");
            case "/privacy":
                return simple("Политика конфиденциальности", "/privacy");
            case "/track":
                return simple("Где мой заказ?", "/track");
            default:
                break;
        }
        boolean isPrivate = PRIVATE_PREFIXES.stream().anyMatch(p -> path.equals(p) || path.startsWith(p.endsWith("/") ? p : p + "/"));
        if (isPrivate) {
            return new Page(SITE_TITLE, DEFAULT_DESCRIPTION, null, defaultImage(), "website", true, List.of(), "");
        }
        return new Page("Страница не найдена — Greenleaf", DEFAULT_DESCRIPTION, null, defaultImage(), "website", true,
                List.of(), "");
    }

    public String head(Page page) {
        String title = esc(page.title());
        String description = esc(clip(page.description(), 300));
        StringBuilder h = new StringBuilder(2048)
                .append("<title>").append(title).append("</title>\n")
                .append("    <meta name=\"description\" content=\"").append(description).append("\" />\n");
        if (page.noindex()) {
            h.append("    <meta name=\"robots\" content=\"noindex\" />\n");
        }
        if (page.canonical() != null) {
            h.append("    <link rel=\"canonical\" href=\"").append(esc(page.canonical())).append("\" />\n");
        }
        meta(h, "og:type", page.ogType());
        meta(h, "og:site_name", "Greenleaf");
        meta(h, "og:title", page.title());
        meta(h, "og:description", clip(page.description(), 300));
        if (page.canonical() != null) {
            meta(h, "og:url", page.canonical());
        }
        meta(h, "og:image", page.image());
        meta(h, "og:locale", "ru_KZ");
        h.append("    <meta name=\"twitter:card\" content=\"summary_large_image\" />\n");
        for (Map<String, Object> data : page.jsonLd()) {
            // "</" inside a string would close the script element early.
            h.append("    <script type=\"application/ld+json\">")
                    .append(json.writeValueAsString(data).replace("</", "<\\/"))
                    .append("</script>\n");
        }
        return h.toString();
    }

    // ---------------------------------------------------------------- pages

    private Page home() {
        var s = settings.current();
        Map<String, Object> store = ld("Store");
        store.put("name", "Greenleaf");
        store.put("url", origin + "/");
        store.put("logo", origin + "/logo-full.webp");
        store.put("image", defaultImage());
        store.put("description", DEFAULT_DESCRIPTION);
        putIfText(store, "telephone", s.phone());
        if (hasText(s.address()) || hasText(s.city())) {
            Map<String, Object> address = new LinkedHashMap<>();
            address.put("@type", "PostalAddress");
            putIfText(address, "streetAddress", s.address());
            putIfText(address, "addressLocality", s.city() == null ? null : s.city().replaceFirst("^г\\.\\s*", ""));
            address.put("addressCountry", "KZ");
            store.put("address", address);
        }
        List<String> sameAs = new ArrayList<>();
        if (hasText(s.instagramUrl())) {
            sameAs.add(s.instagramUrl());
        }
        if (hasText(s.telegramUrl())) {
            sameAs.add(s.telegramUrl());
        }
        if (!sameAs.isEmpty()) {
            store.put("sameAs", sameAs);
        }

        var home = catalog.home();
        StringBuilder b = new StringBuilder("<h1>").append(esc(SITE_TITLE)).append("</h1>")
                .append("<p>").append(esc(DEFAULT_DESCRIPTION)).append("</p>")
                .append("<h2><a href=\"/catalog\">Каталог</a></h2>");
        categoryLinks(b, catalog.categories());
        if (!home.bestsellers().isEmpty()) {
            b.append("<h2>Хиты продаж</h2>");
            productLinks(b, home.bestsellers());
        }
        if (!home.featured().isEmpty()) {
            b.append("<h2>Выбор Greenleaf</h2>");
            productLinks(b, home.featured());
        }
        return new Page(SITE_TITLE, HOME_DESCRIPTION, origin + "/", defaultImage(), "website", false, List.of(store),
                wrap(b));
    }

    private Page product(String rawSlug) {
        String slug = rawSlug.trim();
        ProductDetailDto p;
        try {
            p = catalog.product(slug);
        } catch (ApiException ex) {
            return new Page("Товар не найден — Greenleaf", DEFAULT_DESCRIPTION, null, defaultImage(), "website", true,
                    List.of(), "");
        }
        ProductCardDto c = p.card();
        String url = origin + "/product/" + enc(c.slug());
        String summary = firstText(c.summaryRu(), p.descriptionRu(), DEFAULT_DESCRIPTION);
        String description = (c.price() == null ? "" : money(c.price()) + " ₸ · ") + summary;
        List<String> images = p.photos().stream().map(MediaDto::url).map(this::absolute).toList();
        String image = !images.isEmpty() ? images.getFirst()
                : c.imageUrl() != null ? absolute(c.imageUrl()) : defaultImage();

        Map<String, Object> product = ld("Product");
        product.put("name", c.nameRu());
        putIfText(product, "sku", c.sku());
        product.put("description", clip(summary, 500));
        product.put("image", images.isEmpty() ? List.of(image) : images);
        product.put("url", url);
        if (c.brand() != null) {
            product.put("brand", Map.of("@type", "Brand", "name", c.brand().name()));
        }
        if (c.category() != null) {
            product.put("category", c.category().nameRu());
        }
        if (c.price() != null) {
            Map<String, Object> offer = new LinkedHashMap<>();
            offer.put("@type", "Offer");
            offer.put("url", url);
            offer.put("priceCurrency", c.currency() == null ? "KZT" : c.currency());
            offer.put("price", c.price().setScale(0, RoundingMode.HALF_UP).toPlainString());
            offer.put("availability", c.inStock() ? "https://schema.org/InStock" : "https://schema.org/OutOfStock");
            offer.put("seller", Map.of("@type", "Organization", "name", "Greenleaf"));
            product.put("offers", offer);
        }

        List<String[]> crumbs = new ArrayList<>();
        crumbs.add(new String[] {"Главная", origin + "/"});
        crumbs.add(new String[] {"Каталог", origin + "/catalog"});
        if (c.category() != null) {
            crumbs.add(new String[] {c.category().nameRu(), origin + "/catalog?category=" + enc(c.category().slug())});
        }
        crumbs.add(new String[] {c.nameRu(), url});

        StringBuilder b = new StringBuilder();
        breadcrumbs(b, crumbs);
        b.append("<h1>").append(esc(c.nameRu())).append("</h1>");
        b.append("<img src=\"").append(esc(image)).append("\" alt=\"").append(esc(c.nameRu()))
                .append("\" width=\"320\" height=\"320\" />");
        b.append("<p>");
        if (c.price() != null) {
            b.append("Розничная цена: <strong>").append(money(c.price())).append(" ₸</strong>");
        }
        if (c.partnerPrice() != null) {
            b.append(" · Партнёрская: <strong>").append(money(c.partnerPrice())).append(" ₸</strong>");
        }
        b.append(" · ").append(c.inStock() ? "В наличии" : "Нет в наличии");
        if (c.brand() != null) {
            b.append(" · ").append(esc(c.brand().name()));
        }
        if (hasText(c.volume())) {
            b.append(" · ").append(esc(c.volume()));
        }
        b.append("</p>");
        boolean summaryRepeated = hasText(c.summaryRu()) && hasText(p.descriptionRu())
                && p.descriptionRu().trim().startsWith(c.summaryRu().trim());
        if (!summaryRepeated) {
            paragraph(b, c.summaryRu());
        }
        paragraph(b, p.descriptionRu());
        if (!p.benefits().isEmpty()) {
            b.append("<h2>Преимущества</h2><ul>");
            p.benefits().forEach(x -> b.append("<li>").append(esc(x.textRu())).append("</li>"));
            b.append("</ul>");
        }
        section(b, "Способ применения", p.usageRu());
        section(b, "Состав", p.composition());
        section(b, "Предупреждения", p.warningsRu());
        return new Page(c.nameRu() + " — Greenleaf", description, url, image, "product", false,
                List.of(product, breadcrumbList(crumbs)), wrap(b));
    }

    private Page catalogPage(Function<String, String> param) {
        List<CategoryDto> categories = catalog.categories();
        boolean search = hasText(param.apply("q"));
        Optional<CategoryDto> category = Optional.ofNullable(param.apply("category"))
                .filter(v -> !v.contains(","))
                .flatMap(slug -> categories.stream().filter(x -> x.slug().equals(slug)).findFirst());
        if (category.isEmpty()) {
            StringBuilder b = new StringBuilder("<h1>Каталог</h1>");
            categoryLinks(b, categories);
            return new Page("Каталог — Greenleaf", DEFAULT_DESCRIPTION, origin + "/catalog", defaultImage(), "website",
                    search, List.of(breadcrumbList(List.of(new String[] {"Главная", origin + "/"},
                            new String[] {"Каталог", origin + "/catalog"}))), wrap(b));
        }
        CategoryDto cat = category.get();
        String typeSlug = param.apply("type");
        Optional<ProductTypeDto> type = typeSlug == null || typeSlug.contains(",") ? Optional.empty()
                : cat.types().stream().filter(t -> t.slug().equals(typeSlug)).findFirst();
        String categoryUrl = origin + "/catalog?category=" + enc(cat.slug());
        String url = type.map(t -> categoryUrl + "&type=" + enc(t.slug())).orElse(categoryUrl);
        String name = type.map(ProductTypeDto::nameRu).orElse(cat.nameRu());
        long count = type.map(ProductTypeDto::productCount).orElse(cat.productCount());
        String description = type.isEmpty() && hasText(cat.descriptionRu()) ? cat.descriptionRu()
                : name + " — " + count + " " + plural(count, "товар", "товара", "товаров")
                        + " в магазине Greenleaf. Партнёрские цены, доставка и заказ в WhatsApp.";

        List<String[]> crumbs = new ArrayList<>();
        crumbs.add(new String[] {"Главная", origin + "/"});
        crumbs.add(new String[] {"Каталог", origin + "/catalog"});
        crumbs.add(new String[] {cat.nameRu(), categoryUrl});
        type.ifPresent(t -> crumbs.add(new String[] {t.nameRu(), url}));

        var products = catalog.search(new ProductQuery(null, List.of(cat.slug()),
                type.map(t -> List.of(t.slug())).orElse(null), null, null, null, false, false, SortOption.POPULAR, 0,
                CATEGORY_PRODUCTS));
        StringBuilder b = new StringBuilder();
        breadcrumbs(b, crumbs);
        b.append("<h1>").append(esc(name)).append("</h1>");
        b.append("<p>").append(esc(description)).append("</p>");
        if (type.isEmpty() && !cat.types().isEmpty()) {
            b.append("<ul>");
            cat.types().stream().filter(t -> t.productCount() > 0).forEach(t -> b.append("<li><a href=\"")
                    .append(esc("/catalog?category=" + enc(cat.slug()) + "&type=" + enc(t.slug()))).append("\">")
                    .append(esc(t.nameRu())).append("</a></li>"));
            b.append("</ul>");
        }
        productLinks(b, products.items());
        return new Page(name + " — Greenleaf", description, url, defaultImage(), "website", search,
                List.of(breadcrumbList(crumbs)), wrap(b));
    }

    private Page simple(String title, String path) {
        return new Page(title + " — Greenleaf", DEFAULT_DESCRIPTION, origin + path, defaultImage(), "website", false,
                List.of(), "");
    }

    // ---------------------------------------------------------------- html pieces

    private void categoryLinks(StringBuilder b, List<CategoryDto> categories) {
        b.append("<ul>");
        categories.stream().filter(c -> c.productCount() > 0).forEach(c -> b.append("<li><a href=\"")
                .append(esc("/catalog?category=" + enc(c.slug()))).append("\">").append(esc(c.nameRu()))
                .append("</a> (").append(c.productCount()).append(")</li>"));
        b.append("</ul>");
    }

    private void productLinks(StringBuilder b, List<ProductCardDto> cards) {
        b.append("<ul>");
        for (ProductCardDto c : cards) {
            b.append("<li><a href=\"/product/").append(esc(enc(c.slug()))).append("\">").append(esc(c.nameRu()))
                    .append("</a>");
            if (c.price() != null) {
                b.append(" — ").append(money(c.price())).append(" ₸");
            }
            b.append("</li>");
        }
        b.append("</ul>");
    }

    private static void breadcrumbs(StringBuilder b, List<String[]> crumbs) {
        b.append("<nav aria-label=\"breadcrumbs\">");
        for (int i = 0; i < crumbs.size(); i++) {
            if (i > 0) {
                b.append(" / ");
            }
            if (i == crumbs.size() - 1) {
                b.append(esc(crumbs.get(i)[0]));
            } else {
                b.append("<a href=\"").append(esc(crumbs.get(i)[1])).append("\">").append(esc(crumbs.get(i)[0]))
                        .append("</a>");
            }
        }
        b.append("</nav>");
    }

    private static void paragraph(StringBuilder b, String text) {
        if (hasText(text)) {
            b.append("<p>").append(esc(text.trim()).replace("\n", "<br />")).append("</p>");
        }
    }

    private static void section(StringBuilder b, String title, String text) {
        if (hasText(text)) {
            b.append("<h2>").append(esc(title)).append("</h2>");
            paragraph(b, text);
        }
    }

    private static String wrap(StringBuilder content) {
        return "<div class=\"prerender\">" + content + "</div>";
    }

    private static void meta(StringBuilder h, String property, String value) {
        if (value != null) {
            h.append("    <meta property=\"").append(property).append("\" content=\"").append(esc(value))
                    .append("\" />\n");
        }
    }

    private Map<String, Object> breadcrumbList(List<String[]> crumbs) {
        Map<String, Object> list = ld("BreadcrumbList");
        List<Map<String, Object>> items = new ArrayList<>();
        for (int i = 0; i < crumbs.size(); i++) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("@type", "ListItem");
            item.put("position", i + 1);
            item.put("name", crumbs.get(i)[0]);
            item.put("item", crumbs.get(i)[1]);
            items.add(item);
        }
        list.put("itemListElement", items);
        return list;
    }

    private static Map<String, Object> ld(String type) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("@context", "https://schema.org");
        data.put("@type", type);
        return data;
    }

    // ---------------------------------------------------------------- helpers

    private String defaultImage() {
        return origin + "/og-image.jpg";
    }

    private String absolute(String url) {
        return url.startsWith("http://") || url.startsWith("https://") ? url : origin + url;
    }

    static String money(BigDecimal amount) {
        return String.format(Locale.ROOT, "%,d", amount.setScale(0, RoundingMode.HALF_UP).longValue())
                .replace(',', '\u00a0');
    }

    static String plural(long n, String one, String few, String many) {
        long mod10 = n % 10;
        long mod100 = n % 100;
        if (mod10 == 1 && mod100 != 11) {
            return one;
        }
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
            return few;
        }
        return many;
    }

    static String clip(String text, int max) {
        String flat = text.replaceAll("\\s+", " ").trim();
        return flat.length() > max ? flat.substring(0, max - 1).trim() + "…" : flat;
    }

    private static String firstText(String... values) {
        for (String v : values) {
            if (hasText(v)) {
                return clip(v, 250);
            }
        }
        return "";
    }

    private static void putIfText(Map<String, Object> map, String key, String value) {
        if (hasText(value)) {
            map.put(key, value.trim());
        }
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private static String esc(String text) {
        return HtmlUtils.htmlEscape(text, "UTF-8");
    }

    private static String enc(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
