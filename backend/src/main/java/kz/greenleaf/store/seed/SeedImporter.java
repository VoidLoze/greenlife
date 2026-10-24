package kz.greenleaf.store.seed;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import kz.greenleaf.store.catalog.CatalogCacheEvictor;
import kz.greenleaf.store.catalog.domain.Brand;
import kz.greenleaf.store.catalog.domain.Category;
import kz.greenleaf.store.catalog.domain.MediaKind;
import kz.greenleaf.store.catalog.domain.Product;
import kz.greenleaf.store.catalog.domain.ProductAttribute;
import kz.greenleaf.store.catalog.domain.ProductBenefit;
import kz.greenleaf.store.catalog.domain.ProductMedia;
import kz.greenleaf.store.catalog.domain.ProductStatus;
import kz.greenleaf.store.catalog.domain.ProductType;
import kz.greenleaf.store.catalog.domain.StoredFileInfo;
import kz.greenleaf.store.catalog.repo.BrandRepository;
import kz.greenleaf.store.catalog.repo.CategoryRepository;
import kz.greenleaf.store.catalog.repo.ProductRepository;
import kz.greenleaf.store.catalog.repo.ProductTypeRepository;
import kz.greenleaf.store.common.Slugify;
import kz.greenleaf.store.config.AppProperties;
import kz.greenleaf.store.media.MediaProcessor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.json.JsonMapper;

/**
 * Fills an empty database with the printed catalog (categories, brands, products, photos and catalog page
 * screenshots). Runs once: as soon as any product exists the import is skipped.
 */
@Component
public class SeedImporter {

    private static final Logger log = LoggerFactory.getLogger(SeedImporter.class);
    private static final Map<String, String> ATTRIBUTE_KK = Map.of(
            "Объём / вес", "Көлемі / салмағы",
            "Количество в упаковке", "Қаптамадағы саны",
            "Возраст", "Жасы");

    private final AppProperties.Seed config;
    private final CategoryRepository categories;
    private final ProductTypeRepository types;
    private final BrandRepository brands;
    private final ProductRepository products;
    private final MediaProcessor mediaProcessor;
    private final TransactionTemplate tx;
    private final CatalogCacheEvictor cacheEvictor;
    private final JsonMapper jsonMapper = JsonMapper.builder().build();

    public SeedImporter(AppProperties properties, CategoryRepository categories, ProductTypeRepository types,
                        BrandRepository brands, ProductRepository products, MediaProcessor mediaProcessor,
                        TransactionTemplate tx, CatalogCacheEvictor cacheEvictor) {
        this.config = properties.seed();
        this.categories = categories;
        this.types = types;
        this.brands = brands;
        this.products = products;
        this.mediaProcessor = mediaProcessor;
        this.tx = tx;
        this.cacheEvictor = cacheEvictor;
    }

    record SeedType(String slug, String nameRu, String nameKk) {
    }

    record SeedCategory(String slug, String nameRu, String nameKk, String icon, List<SeedType> types) {
    }

    record SeedAttribute(String name, String value) {
    }

    record SeedProduct(String sku, String name, String brand, String category, String type, BigDecimal price,
                       String volume,
                       String summary, String description, List<String> benefits, String usage, String composition,
                       String warnings, List<SeedAttribute> attributes, String image, Integer catalogPage,
                       String screenshot, String status, boolean featured) {
    }

    record SeedFile(List<SeedCategory> categories, List<SeedProduct> products) {
    }

    @EventListener(ApplicationReadyEvent.class)
    @Order(10)
    public void onReady() {
        if (!config.enabled()) {
            return;
        }
        if (products.count() > 0) {
            log.info("Seed skipped: catalog already has products");
            return;
        }
        Path dir = Path.of(config.dir()).toAbsolutePath().normalize();
        Path file = dir.resolve("products.json");
        if (!Files.isRegularFile(file)) {
            log.warn("Seed skipped: {} not found", file);
            return;
        }
        Thread.ofVirtual().name("seed-import").start(() -> runImport(dir, file));
    }

    private void runImport(Path dir, Path file) {
        long started = System.currentTimeMillis();
        try {
            SeedFile seed = jsonMapper.readValue(file.toFile(), SeedFile.class);
            Map<String, Long> categoryIds = new HashMap<>();
            Map<String, Long> typeIds = new HashMap<>();
            importCategories(seed.categories(), categoryIds, typeIds);
            Map<String, StoredFileInfo> screenshots = new HashMap<>();
            int imported = 0;
            for (SeedProduct item : seed.products()) {
                try {
                    StoredFileInfo photo = storeOnce(dir.resolve("images"), item.image(), "seed/products",
                            MediaKind.PHOTO, null);
                    StoredFileInfo screenshot = storeOnce(dir.resolve("screenshots"), item.screenshot(),
                            "seed/catalog-pages", MediaKind.SCREENSHOT, screenshots);
                    tx.executeWithoutResult(status -> importProduct(item, categoryIds, typeIds, photo, screenshot));
                    imported++;
                } catch (RuntimeException | IOException ex) {
                    log.warn("Seed product {} skipped: {}", item.sku(), ex.getMessage());
                }
            }
            cacheEvictor.evictAll();
            log.info("Seed import finished: {} products in {} ms", imported, System.currentTimeMillis() - started);
        } catch (RuntimeException ex) {
            log.error("Seed import failed", ex);
        }
    }

    private void importCategories(List<SeedCategory> seedCategories, Map<String, Long> categoryIds,
                                  Map<String, Long> typeIds) {
        tx.executeWithoutResult(status -> {
            int order = 10;
            for (SeedCategory c : seedCategories) {
                Category category = categories.findBySlug(c.slug()).orElseGet(() -> new Category(c.slug(), c.nameRu()));
                category.setNameKk(c.nameKk());
                category.setIcon(c.icon());
                category.setSortOrder(order);
                order += 10;
                Category saved = categories.save(category);
                categoryIds.put(c.slug(), saved.getId());
                int typeOrder = 10;
                for (SeedType t : c.types() == null ? List.<SeedType>of() : c.types()) {
                    ProductType type = types.findBySlug(t.slug()).orElseGet(() -> new ProductType(saved, t.slug(), t.nameRu()));
                    type.setCategory(saved);
                    type.setNameRu(t.nameRu());
                    type.setNameKk(t.nameKk());
                    type.setSortOrder(typeOrder);
                    typeOrder += 10;
                    typeIds.put(t.slug(), types.save(type).getId());
                }
            }
        });
    }

    private void importProduct(SeedProduct item, Map<String, Long> categoryIds, Map<String, Long> typeIds,
                               StoredFileInfo photo, StoredFileInfo screenshot) {
        if (products.existsBySku(item.sku())) {
            return;
        }
        String base = Slugify.slugify(item.name());
        String slug = base;
        for (int i = 2; products.existsBySlug(slug); i++) {
            slug = base + "-" + i;
        }
        Product product = new Product(item.sku(), slug, item.name());
        product.setSummaryRu(item.summary());
        product.setDescriptionRu(item.description());
        product.setUsageRu(item.usage());
        product.setComposition(item.composition());
        product.setWarningsRu(item.warnings());
        product.setPrice(item.price());
        product.setVolume(item.volume());
        product.setFeatured(item.featured());
        product.setCatalogPage(item.catalogPage());
        Long categoryId = categoryIds.get(item.category());
        if (categoryId != null) {
            product.setCategory(categories.getReferenceById(categoryId));
        }
        Long typeId = item.type() == null ? null : typeIds.get(item.type());
        if (typeId != null) {
            product.setType(types.getReferenceById(typeId));
        }
        if (item.brand() != null && !item.brand().isBlank()) {
            product.setBrand(brands.findByNameIgnoreCase(item.brand())
                    .orElseGet(() -> brands.save(new Brand(Slugify.slugify(item.brand()), item.brand()))));
        }
        if (item.benefits() != null) {
            product.replaceBenefits(item.benefits().stream().map(b -> new ProductBenefit(b, null)).toList());
        }
        if (item.attributes() != null) {
            product.replaceAttributes(item.attributes().stream()
                    .map(a -> new ProductAttribute(a.name(), a.value(), ATTRIBUTE_KK.get(a.name()), null))
                    .toList());
        }
        if (photo != null) {
            ProductMedia media = new ProductMedia(MediaKind.PHOTO, photo);
            media.setAltText(item.name());
            media.setCover(true);
            product.addMedia(media);
            product.setCover(photo.storageKey(), photo.thumbnailKey());
        }
        if (screenshot != null) {
            ProductMedia media = new ProductMedia(MediaKind.SCREENSHOT, screenshot);
            media.setTitle(item.catalogPage() != null ? "Страница каталога №" + item.catalogPage() : "Страница каталога");
            media.setDescription("Оригинальная страница печатного каталога с этим товаром");
            media.setAltText(item.name() + " — страница каталога");
            product.addMedia(media);
        }
        boolean publishable = "PUBLISHED".equals(item.status()) && item.price() != null && photo != null;
        product.changeStatus(publishable ? ProductStatus.PUBLISHED : ProductStatus.DRAFT);
        products.save(product);
    }

    /** Catalog pages are shared by several products, so each file is stored once and referenced by key. */
    private StoredFileInfo storeOnce(Path folder, String name, String targetFolder, MediaKind kind,
                                     Map<String, StoredFileInfo> cache) throws IOException {
        if (name == null || name.isBlank()) {
            return null;
        }
        if (cache != null && cache.containsKey(name)) {
            return cache.get(name);
        }
        Path source = folder.resolve(name).normalize();
        if (!source.startsWith(folder) || !Files.isRegularFile(source)) {
            log.debug("Seed file missing: {}", source);
            return null;
        }
        StoredFileInfo stored = mediaProcessor.store(targetFolder, Files.readAllBytes(source), name, kind);
        if (cache != null) {
            cache.put(name, stored);
        }
        return stored;
    }
}
