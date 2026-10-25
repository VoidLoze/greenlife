package kz.greenleaf.store.site;

import io.swagger.v3.oas.annotations.Hidden;
import jakarta.servlet.http.HttpServletRequest;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import kz.greenleaf.store.config.AppProperties;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.HtmlUtils;

/**
 * robots.txt, sitemap.xml and the per-page parts of index.html (see {@link SeoPages}). Search engines and link
 * previews in messengers read them without running JavaScript.
 */
@Hidden
@RestController
@RequestMapping("/api/seo")
public class SeoController {

    private static final CacheControl CACHE = CacheControl.maxAge(Duration.ofMinutes(10)).cachePublic();
    private static final MediaType XML = MediaType.parseMediaType("application/xml;charset=UTF-8");
    private static final MediaType TEXT = MediaType.parseMediaType("text/plain;charset=UTF-8");
    private static final MediaType HTML = MediaType.parseMediaType("text/html;charset=UTF-8");

    private final JdbcTemplate jdbc;
    private final SeoPages pages;
    private final String origin;

    public SeoController(JdbcTemplate jdbc, SeoPages pages, AppProperties properties) {
        this.jdbc = jdbc;
        this.pages = pages;
        String publicUrl = properties.publicUrl().trim();
        this.origin = publicUrl.endsWith("/") ? publicUrl.substring(0, publicUrl.length() - 1) : publicUrl;
    }

    @GetMapping("/robots.txt")
    public ResponseEntity<String> robots() {
        String body = """
                User-agent: *
                Allow: /
                Disallow: /admin
                Disallow: /account
                Disallow: /checkout
                Disallow: /order/
                Disallow: /api/
                Clean-param: utm_source&utm_medium&utm_campaign&utm_content&utm_term&fbclid&gclid&yclid

                Sitemap: %s/sitemap.xml
                """.formatted(origin);
        return ResponseEntity.ok().cacheControl(CACHE).contentType(TEXT).body(body);
    }

    @GetMapping("/sitemap.xml")
    public ResponseEntity<String> sitemap() {
        StringBuilder xml = new StringBuilder(64 * 1024)
                .append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n")
                .append("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n");
        for (String path : List.of("/", "/catalog", "/partner")) {
            url(xml, origin + path, null);
        }
        jdbc.query("select slug from categories order by sort_order, id",
                rs -> {
                    url(xml, origin + "/catalog?category=" + enc(rs.getString(1)), null);
                });
        jdbc.query("""
                        select c.slug, t.slug from product_types t join categories c on c.id = t.category_id
                        where exists (select 1 from products p where p.type_id = t.id and p.status = 'PUBLISHED')
                        order by c.sort_order, c.id, t.sort_order, t.id
                        """,
                rs -> {
                    url(xml, origin + "/catalog?category=" + enc(rs.getString(1)) + "&type=" + enc(rs.getString(2)),
                            null);
                });
        jdbc.query("select slug, updated_at from products where status = 'PUBLISHED' order by id",
                rs -> {
                    Timestamp updated = rs.getTimestamp(2);
                    url(xml, origin + "/product/" + enc(rs.getString(1)),
                            updated == null ? null : DateTimeFormatter.ISO_LOCAL_DATE.format(
                                    updated.toInstant().atZone(ZoneOffset.UTC)));
                });
        xml.append("</urlset>\n");
        return ResponseEntity.ok().cacheControl(CACHE).contentType(XML).body(xml.toString());
    }

    /** Tags for the head of index.html, inserted by nginx (SSI) for the page the visitor opened. */
    @GetMapping({"/head", "/head/**"})
    public ResponseEntity<String> head(HttpServletRequest request) {
        return fragment(pages.head(page(request, "/api/seo/head")));
    }

    /** Plain-HTML copy of the page content placed inside #root; React replaces it once the app starts. */
    @GetMapping({"/body", "/body/**"})
    public ResponseEntity<String> body(HttpServletRequest request) {
        return fragment(page(request, "/api/seo/body").body());
    }

    private SeoPages.Page page(HttpServletRequest request, String prefix) {
        String path = request.getRequestURI().substring(prefix.length());
        return pages.resolve(URLDecoder.decode(path, StandardCharsets.UTF_8), request::getParameter);
    }

    private static ResponseEntity<String> fragment(String html) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).contentType(HTML).body(html);
    }

    private static String enc(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private static void url(StringBuilder xml, String loc, String lastModified) {
        xml.append("  <url><loc>").append(HtmlUtils.htmlEscape(loc)).append("</loc>");
        if (lastModified != null) {
            xml.append("<lastmod>").append(lastModified).append("</lastmod>");
        }
        xml.append("</url>\n");
    }
}
