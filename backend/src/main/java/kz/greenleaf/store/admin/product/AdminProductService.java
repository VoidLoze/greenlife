package kz.greenleaf.store.admin.product;

import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import kz.greenleaf.store.admin.product.AdminProductDtos.AttributeInput;
import kz.greenleaf.store.admin.product.AdminProductDtos.BenefitInput;
import kz.greenleaf.store.admin.product.AdminProductDtos.BrandRefDto;
import kz.greenleaf.store.admin.product.AdminProductDtos.CategoryRefDto;
import kz.greenleaf.store.admin.product.AdminProductDtos.ProductAdminDto;
import kz.greenleaf.store.admin.product.AdminProductDtos.ProductListItem;
import kz.greenleaf.store.admin.product.AdminProductDtos.TypeRefDto;
import kz.greenleaf.store.admin.product.AdminProductDtos.ProductUpsertRequest;
import kz.greenleaf.store.catalog.CatalogCacheEvictor;
import kz.greenleaf.store.catalog.ProductMapper;
import kz.greenleaf.store.catalog.domain.Brand;
import kz.greenleaf.store.catalog.domain.Category;
import kz.greenleaf.store.catalog.domain.Product;
import kz.greenleaf.store.catalog.domain.ProductAttribute;
import kz.greenleaf.store.catalog.domain.ProductBenefit;
import kz.greenleaf.store.catalog.domain.ProductMedia;
import kz.greenleaf.store.catalog.domain.ProductStatus;
import kz.greenleaf.store.catalog.domain.ProductType;
import kz.greenleaf.store.catalog.domain.StoredFileInfo;
import kz.greenleaf.store.catalog.repo.BrandRepository;
import kz.greenleaf.store.catalog.repo.CategoryRepository;
import kz.greenleaf.store.catalog.repo.ProductMediaRepository;
import kz.greenleaf.store.catalog.repo.ProductRepository;
import kz.greenleaf.store.catalog.repo.ProductTypeRepository;
import kz.greenleaf.store.common.ApiException;
import kz.greenleaf.store.common.PageResponse;
import kz.greenleaf.store.common.Slugify;
import kz.greenleaf.store.media.MediaUrls;
import kz.greenleaf.store.media.StorageTransactions;
import kz.greenleaf.store.site.StoreSettingsService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminProductService {

    private static final int MAX_PAGE_SIZE = 100;

    private final ProductRepository products;
    private final ProductMediaRepository mediaRepository;
    private final CategoryRepository categories;
    private final ProductTypeRepository types;
    private final BrandRepository brands;
    private final ProductMapper mapper;
    private final MediaUrls urls;
    private final StorageTransactions storageTx;
    private final CatalogCacheEvictor cacheEvictor;
    private final JdbcTemplate jdbc;
    private final StoreSettingsService settings;

    public AdminProductService(ProductRepository products, ProductMediaRepository mediaRepository,
                               CategoryRepository categories, ProductTypeRepository types, BrandRepository brands,
                               ProductMapper mapper, MediaUrls urls, StorageTransactions storageTx,
                               CatalogCacheEvictor cacheEvictor, JdbcTemplate jdbc, StoreSettingsService settings) {
        this.products = products;
        this.mediaRepository = mediaRepository;
        this.categories = categories;
        this.types = types;
        this.brands = brands;
        this.mapper = mapper;
        this.urls = urls;
        this.storageTx = storageTx;
        this.cacheEvictor = cacheEvictor;
        this.jdbc = jdbc;
        this.settings = settings;
    }

    public record ListFilter(String q, ProductStatus status, Long categoryId, Long brandId, Boolean lowStock,
                             Boolean noPhoto, String sort, int page, int size) {
    }

    @Transactional(readOnly = true)
    public PageResponse<ProductListItem> list(ListFilter filter) {
        int size = Math.clamp(filter.size(), 1, MAX_PAGE_SIZE);
        PageRequest pageable = PageRequest.of(Math.max(filter.page(), 0), size, sortOf(filter.sort()));
        Page<Product> page = products.findAll(specOf(filter), pageable);
        return PageResponse.of(page, this::toListItem);
    }

    @Transactional(readOnly = true)
    public ProductAdminDto get(Long id) {
        return toAdmin(load(id));
    }

    @Transactional
    public ProductAdminDto create(ProductUpsertRequest request, Long adminId) {
        String sku = request.sku() == null || request.sku().isBlank()
                ? "GL-" + products.nextSkuNumber()
                : request.sku().trim().toUpperCase(Locale.ROOT);
        if (products.existsBySku(sku)) {
            throw ApiException.conflict("sku_taken", "Артикул " + sku + " уже используется");
        }
        String slug = uniqueSlug(blankToNull(request.slug()) != null ? request.slug() : request.nameRu(), null);
        Product product = new Product(sku, slug, request.nameRu().trim());
        product.setCreatedBy(adminId);
        apply(product, request);
        ProductStatus status = request.status() == null ? ProductStatus.DRAFT : request.status();
        if (status == ProductStatus.PUBLISHED) {
            ProductQuality.assertPublishable(product);
        }
        product.changeStatus(status);
        products.save(product);
        cacheEvictor.evictAll();
        return toAdmin(product);
    }

    @Transactional
    public ProductAdminDto update(Long id, ProductUpsertRequest request) {
        Product product = load(id);
        if (request.version() == null) {
            throw ApiException.badRequest("version_required", "Обновите страницу товара и сохраните ещё раз");
        }
        if (request.version() != product.getVersion()) {
            throw ApiException.conflict("stale_data",
                    "Товар уже сохранили в другой вкладке или другой администратор. Обновите страницу, чтобы не затереть те правки.");
        }
        Integer stockBefore = product.getStockQuantity();
        if (blankToNull(request.sku()) != null) {
            String sku = request.sku().trim().toUpperCase(Locale.ROOT);
            if (!sku.equals(product.getSku())) {
                if (products.existsBySku(sku)) {
                    throw ApiException.conflict("sku_taken", "Артикул " + sku + " уже используется");
                }
                product.setSku(sku);
            }
        }
        if (blankToNull(request.slug()) != null && !request.slug().equals(product.getSlug())) {
            product.setSlug(uniqueSlug(request.slug(), product.getId()));
        }
        product.setNameRu(request.nameRu().trim());
        apply(product, request);
        product.setStockQuantity(mergeStock(stockBefore, request.stockBase(), request.stockQuantity()));
        if (request.status() != null && request.status() != product.getStatus()) {
            if (request.status() == ProductStatus.PUBLISHED) {
                ProductQuality.assertPublishable(product);
            }
            product.changeStatus(request.status());
        } else if (product.getStatus() == ProductStatus.PUBLISHED) {
            ProductQuality.assertPublishable(product);
        }
        products.saveAndFlush(product);
        cacheEvictor.evictAll();
        return toAdmin(product);
    }

    @Transactional
    public ProductAdminDto changeStatus(Long id, ProductStatus status) {
        Product product = load(id);
        if (status == ProductStatus.PUBLISHED) {
            ProductQuality.assertPublishable(product);
        }
        product.changeStatus(status);
        products.saveAndFlush(product);
        cacheEvictor.evictAll();
        return toAdmin(product);
    }

    public record DeleteResult(boolean archived, String message) {
    }

    /** Products referenced by orders are archived (order history must keep its images); others are removed. */
    @Transactional
    public DeleteResult delete(Long id) {
        // Locks the row first: a checkout reserving this product now either finishes before (and the product is
        // archived because it is in an order) or fails cleanly after the delete.
        jdbc.queryForList("select id from products where id = ? for update", id);
        Product product = load(id);
        Boolean ordered = jdbc.queryForObject(
                "select exists(select 1 from order_items where product_id = ?)", Boolean.class, id);
        if (Boolean.TRUE.equals(ordered)) {
            product.changeStatus(ProductStatus.ARCHIVED);
            cacheEvictor.evictAll();
            return new DeleteResult(true, "Товар есть в заказах, поэтому он перенесён в архив");
        }
        Set<String> keys = new HashSet<>();
        for (ProductMedia media : product.getMedia()) {
            keys.add(media.getStorageKey());
            keys.add(media.getThumbnailKey());
        }
        products.delete(product);
        products.flush();
        storageTx.deleteAfterCommit(keys.stream()
                .filter(Objects::nonNull)
                .filter(key -> mediaRepository.countByStorageKey(key) == 0 && !thumbnailInUse(key))
                .toList());
        cacheEvictor.evictAll();
        return new DeleteResult(false, "Товар удалён");
    }

    /** Copies the card as a draft; media rows are shared by storage key, so no files are duplicated on disk. */
    @Transactional
    public ProductAdminDto duplicate(Long id, Long adminId) {
        Product source = load(id);
        Product copy = new Product("GL-" + products.nextSkuNumber(), uniqueSlug(source.getSlug() + "-copy", null),
                source.getNameRu() + " (копия)");
        copy.setCreatedBy(adminId);
        copy.setNameKk(source.getNameKk());
        copy.setSummaryRu(source.getSummaryRu());
        copy.setSummaryKk(source.getSummaryKk());
        copy.setDescriptionRu(source.getDescriptionRu());
        copy.setDescriptionKk(source.getDescriptionKk());
        copy.setUsageRu(source.getUsageRu());
        copy.setUsageKk(source.getUsageKk());
        copy.setComposition(source.getComposition());
        copy.setWarningsRu(source.getWarningsRu());
        copy.setWarningsKk(source.getWarningsKk());
        copy.setSearchKeywords(source.getSearchKeywords());
        copy.setCategory(source.getCategory());
        copy.setType(source.getType());
        copy.setBrand(source.getBrand());
        copy.setPrice(source.getPrice());
        copy.setPartnerPrice(source.getPartnerPrice());
        copy.setOldPrice(source.getOldPrice());
        copy.setVolume(source.getVolume());
        // The shelf is not doubled by a copy: a tracked stock starts at zero.
        copy.setStockQuantity(source.getStockQuantity() == null ? null : 0);
        copy.setBadge(source.getBadge());
        copy.setCatalogPage(source.getCatalogPage());
        copy.setVideoUrl(source.getVideoUrl());
        copy.replaceBenefits(source.getBenefits().stream()
                .map(b -> new ProductBenefit(b.getTextRu(), b.getTextKk())).toList());
        copy.replaceAttributes(source.getAttributes().stream()
                .map(a -> new ProductAttribute(a.getNameRu(), a.getValueRu(), a.getNameKk(), a.getValueKk())).toList());
        for (ProductMedia media : source.getMedia()) {
            ProductMedia clone = new ProductMedia(media.getKind(), new StoredFileInfo(media.getStorageKey(),
                    media.getThumbnailKey(), media.getOriginalFilename(), media.getContentType(), media.getSizeBytes(),
                    media.getWidth(), media.getHeight()));
            clone.setTitle(media.getTitle());
            clone.setDescription(media.getDescription());
            clone.setAltText(media.getAltText());
            clone.setSortOrder(media.getSortOrder());
            clone.setCover(media.isCover());
            copy.addMedia(clone);
        }
        copy.setCover(source.getCoverKey(), source.getCoverThumbKey());
        copy.changeStatus(ProductStatus.DRAFT);
        products.save(copy);
        return toAdmin(copy);
    }

    public DescriptionParser.Parsed parseDescription(String text, String name) {
        return DescriptionParser.parse(text, name);
    }

    Product load(Long id) {
        return products.findWithRelationsById(id).orElseThrow(() -> ApiException.notFound("Товар"));
    }

    ProductAdminDto toAdmin(Product p) {
        List<ProductMedia> media = new ArrayList<>(p.getMedia());
        media.sort((a, b) -> a.getKind() != b.getKind()
                ? a.getKind().compareTo(b.getKind())
                : Integer.compare(a.getSortOrder(), b.getSortOrder()));
        return new ProductAdminDto(
                p.getId(), p.getSku(), p.getSlug(), p.getNameRu(), p.getNameKk(), p.getSummaryRu(), p.getSummaryKk(),
                p.getDescriptionRu(), p.getDescriptionKk(), p.getUsageRu(), p.getUsageKk(), p.getComposition(),
                p.getWarningsRu(), p.getWarningsKk(), p.getSearchKeywords(),
                p.getCategory() == null ? null
                        : new CategoryRefDto(p.getCategory().getId(), p.getCategory().getSlug(), p.getCategory().getNameRu()),
                p.getType() == null ? null
                        : new TypeRefDto(p.getType().getId(), p.getType().getSlug(), p.getType().getNameRu()),
                p.getBrand() == null ? null
                        : new BrandRefDto(p.getBrand().getId(), p.getBrand().getSlug(), p.getBrand().getName()),
                p.getPrice(), p.getPartnerPrice(), p.effectivePartnerPrice(settings.current().partnerDiscountPercent()), p.getOldPrice(),
                p.getCurrency(), p.getVolume(), p.getStockQuantity(), p.getStatus(), p.isFeatured(), p.getBadge(),
                p.getCatalogPage(),
                p.getVideoUrl(),
                p.getBenefits().stream().map(b -> new BenefitInput(b.getTextRu(), b.getTextKk())).toList(),
                p.getAttributes().stream()
                        .map(a -> new AttributeInput(a.getNameRu(), a.getValueRu(), a.getNameKk(), a.getValueKk()))
                        .toList(),
                media.stream().map(mapper::toMedia).toList(),
                urls.url(p.getCoverKey()),
                ProductQuality.evaluate(p),
                p.getViewCount(), p.getSoldCount(), p.getVersion(),
                p.getCreatedAt(), p.getUpdatedAt(), p.getPublishedAt());
    }

    private ProductListItem toListItem(Product p) {
        return new ProductListItem(
                p.getId(), p.getSku(), p.getSlug(), p.getNameRu(),
                p.getBrand() == null ? null : p.getBrand().getName(),
                p.getCategory() == null ? null : p.getCategory().getNameRu(),
                p.getPrice(), p.effectivePartnerPrice(settings.current().partnerDiscountPercent()), p.getStockQuantity(), p.getStatus(),
                p.isFeatured(),
                urls.url(p.getCoverThumbKey() != null ? p.getCoverThumbKey() : p.getCoverKey()),
                ProductQuality.evaluate(p).score(),
                p.getViewCount(), p.getSoldCount(), p.getUpdatedAt());
    }

    private void apply(Product product, ProductUpsertRequest r) {
        product.setNameKk(blankToNull(r.nameKk()));
        product.setSummaryRu(blankToNull(r.summaryRu()));
        product.setSummaryKk(blankToNull(r.summaryKk()));
        product.setDescriptionRu(blankToNull(r.descriptionRu()));
        product.setDescriptionKk(blankToNull(r.descriptionKk()));
        product.setUsageRu(blankToNull(r.usageRu()));
        product.setUsageKk(blankToNull(r.usageKk()));
        product.setComposition(blankToNull(r.composition()));
        product.setWarningsRu(blankToNull(r.warningsRu()));
        product.setWarningsKk(blankToNull(r.warningsKk()));
        product.setSearchKeywords(blankToNull(r.searchKeywords()));
        Category category = r.categoryId() == null ? null
                : categories.findById(r.categoryId()).orElseThrow(() -> ApiException.notFound("Категория"));
        product.setCategory(category);
        ProductType type = r.typeId() == null ? null
                : types.findById(r.typeId()).orElseThrow(() -> ApiException.notFound("Тип товара"));
        if (type != null && (category == null || !type.getCategory().getId().equals(category.getId()))) {
            throw ApiException.badRequest("type_category_mismatch",
                    "Тип «" + type.getNameRu() + "» относится к другой категории — выберите тип из выбранной категории");
        }
        product.setType(type);
        product.setBrand(resolveBrand(r));
        if (r.oldPrice() != null && r.price() != null && r.oldPrice().compareTo(r.price()) <= 0) {
            throw ApiException.badRequest("invalid_old_price", "Старая цена должна быть больше текущей цены");
        }
        if (r.partnerPrice() != null && r.price() != null && r.partnerPrice().compareTo(r.price()) > 0) {
            throw ApiException.badRequest("invalid_partner_price", "Партнёрская цена не может быть выше розничной");
        }
        product.setPrice(r.price());
        product.setPartnerPrice(r.partnerPrice());
        product.setOldPrice(r.oldPrice());
        product.setVolume(blankToNull(r.volume()));
        product.setStockQuantity(r.stockQuantity());
        product.setFeatured(Boolean.TRUE.equals(r.featured()));
        product.setBadge(blankToNull(r.badge()));
        product.setCatalogPage(r.catalogPage());
        product.setVideoUrl(blankToNull(r.videoUrl()));
        if (r.benefits() != null) {
            product.replaceBenefits(r.benefits().stream()
                    .map(b -> new ProductBenefit(b.textRu().trim(), blankToNull(b.textKk())))
                    .toList());
        }
        if (r.attributes() != null) {
            product.replaceAttributes(r.attributes().stream()
                    .map(a -> new ProductAttribute(a.nameRu().trim(), a.valueRu().trim(), blankToNull(a.nameKk()),
                            blankToNull(a.valueKk())))
                    .toList());
        }
    }

    /** An explicit id wins; otherwise a typed brand name is matched case-insensitively or created on the fly. */
    private Brand resolveBrand(ProductUpsertRequest r) {
        if (r.brandId() != null) {
            return brands.findById(r.brandId()).orElseThrow(() -> ApiException.notFound("Бренд"));
        }
        String name = blankToNull(r.brandName());
        if (name == null) {
            return null;
        }
        return brands.findByNameIgnoreCase(name.trim()).orElseGet(() -> {
            String base = Slugify.slugify(name);
            String slug = base;
            for (int i = 2; brands.existsBySlug(slug); i++) {
                slug = base + "-" + i;
            }
            return brands.save(new Brand(slug, name.trim()));
        });
    }

    private String uniqueSlug(String source, Long selfId) {
        String base = Slugify.slugify(source);
        String slug = base;
        for (int i = 2; ; i++) {
            var existing = products.findBySlug(slug);
            if (existing.isEmpty() || existing.get().getId().equals(selfId)) {
                return slug;
            }
            slug = base + "-" + i;
        }
    }

    private boolean thumbnailInUse(String key) {
        Long count = jdbc.queryForObject("select count(*) from product_media where thumbnail_key = ?", Long.class, key);
        return count != null && count > 0;
    }

    private static Specification<Product> specOf(ListFilter f) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (query != null && Long.class != query.getResultType() && long.class != query.getResultType()) {
                root.fetch("category", JoinType.LEFT);
                root.fetch("brand", JoinType.LEFT);
            }
            String q = blankToNull(f.q());
            if (q != null) {
                String like = "%" + q.toLowerCase(Locale.ROOT).replace("%", "\\%").replace("_", "\\_") + "%";
                var brand = root.join("brand", JoinType.LEFT);
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("nameRu")), like),
                        cb.like(cb.lower(cb.coalesce(root.get("nameKk"), "")), like),
                        cb.like(cb.lower(root.get("sku")), like),
                        cb.like(cb.lower(root.get("slug")), like),
                        cb.like(cb.lower(cb.coalesce(root.get("searchKeywords"), "")), like),
                        cb.like(cb.lower(cb.coalesce(brand.get("name"), "")), like)));
            }
            if (f.status() != null) {
                predicates.add(cb.equal(root.get("status"), f.status()));
            }
            if (f.categoryId() != null) {
                predicates.add(cb.equal(root.get("category").get("id"), f.categoryId()));
            }
            if (f.brandId() != null) {
                predicates.add(cb.equal(root.get("brand").get("id"), f.brandId()));
            }
            if (Boolean.TRUE.equals(f.lowStock())) {
                predicates.add(cb.isNotNull(root.get("stockQuantity")));
                predicates.add(cb.le(root.get("stockQuantity"), ProductMapper.LOW_STOCK_THRESHOLD));
            }
            if (Boolean.TRUE.equals(f.noPhoto())) {
                predicates.add(cb.isNull(root.get("coverKey")));
                predicates.add(cb.notEqual(root.get("status"), ProductStatus.ARCHIVED));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    /** Empty prices and untracked stock go last; the id keeps pages stable when values tie. */
    private static Sort sortOf(String sort) {
        Sort primary = switch (sort == null ? "" : sort) {
            case "name" -> Sort.by("nameRu");
            case "price_asc" -> Sort.by(Sort.Order.asc("price").nullsLast());
            case "price_desc" -> Sort.by(Sort.Order.desc("price").nullsLast());
            case "stock" -> Sort.by(Sort.Order.asc("stockQuantity").nullsLast());
            case "views" -> Sort.by(Sort.Direction.DESC, "viewCount");
            case "sold" -> Sort.by(Sort.Direction.DESC, "soldCount");
            case "created" -> Sort.by(Sort.Direction.DESC, "createdAt");
            default -> Sort.by(Sort.Direction.DESC, "updatedAt");
        };
        return primary.and(Sort.by(Sort.Direction.DESC, "id"));
    }

    /**
     * The editor sends the stock it was opened with: the admin's change is applied as a difference to the current
     * value, so units sold while the form was open are not written back onto the shelf.
     */
    static Integer mergeStock(Integer current, Integer base, Integer requested) {
        if (requested == null || base == null || current == null) {
            return requested;
        }
        return Math.max(0, current + (requested - base));
    }

    static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
