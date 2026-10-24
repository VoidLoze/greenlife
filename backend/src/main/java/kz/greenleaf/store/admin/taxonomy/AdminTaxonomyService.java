package kz.greenleaf.store.admin.taxonomy;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import kz.greenleaf.store.catalog.CatalogCacheEvictor;
import kz.greenleaf.store.catalog.domain.Brand;
import kz.greenleaf.store.catalog.domain.Category;
import kz.greenleaf.store.catalog.domain.ProductType;
import kz.greenleaf.store.catalog.repo.BrandRepository;
import kz.greenleaf.store.catalog.repo.CategoryRepository;
import kz.greenleaf.store.catalog.repo.ProductRepository;
import kz.greenleaf.store.catalog.repo.ProductTypeRepository;
import kz.greenleaf.store.common.ApiException;
import kz.greenleaf.store.common.Slugify;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminTaxonomyService {

    private final CategoryRepository categories;
    private final ProductTypeRepository types;
    private final BrandRepository brands;
    private final ProductRepository products;
    private final CatalogCacheEvictor cacheEvictor;
    private final JdbcTemplate jdbc;

    public AdminTaxonomyService(CategoryRepository categories, ProductTypeRepository types, BrandRepository brands,
                                ProductRepository products, CatalogCacheEvictor cacheEvictor, JdbcTemplate jdbc) {
        this.categories = categories;
        this.types = types;
        this.brands = brands;
        this.products = products;
        this.cacheEvictor = cacheEvictor;
        this.jdbc = jdbc;
    }

    public record CategoryRequest(
            @Size(max = 120) @Pattern(regexp = "^[a-z0-9-]*$", message = "Slug: строчная латиница, цифры и дефис") String slug,
            @NotBlank(message = "Укажите название") @Size(max = 120) String nameRu,
            @Size(max = 120) String nameKk,
            @Size(max = 2000) String descriptionRu,
            @Size(max = 2000) String descriptionKk,
            @Size(max = 16) String icon,
            Integer sortOrder) {
    }

    public record BrandRequest(
            @Size(max = 120) @Pattern(regexp = "^[a-z0-9-]*$", message = "Slug: строчная латиница, цифры и дефис") String slug,
            @NotBlank(message = "Укажите название") @Size(max = 120) String name,
            @Size(max = 2000) String description) {
    }

    public record TypeRequest(
            @Size(max = 80) @Pattern(regexp = "^[a-z0-9-]*$", message = "Slug: строчная латиница, цифры и дефис") String slug,
            @NotBlank(message = "Укажите название") @Size(max = 150) String nameRu,
            @Size(max = 150) String nameKk,
            Integer sortOrder) {
    }

    public record TypeAdminDto(Long id, Long categoryId, String slug, String nameRu, String nameKk, int sortOrder,
                               long productCount) {
    }

    public record CategoryAdminDto(Long id, String slug, String nameRu, String nameKk, String descriptionRu,
                                   String descriptionKk, String icon, int sortOrder, long productCount,
                                   List<TypeAdminDto> types) {
    }

    public record BrandAdminDto(Long id, String slug, String name, String description, long productCount) {
    }

    @Transactional(readOnly = true)
    public List<CategoryAdminDto> listCategories() {
        Map<Long, Long> counts = countBy("category_id");
        Map<Long, Long> typeCounts = countBy("type_id");
        Map<Long, List<TypeAdminDto>> typesByCategory = types.findAllOrdered().stream()
                .map(t -> toDto(t, typeCounts.getOrDefault(t.getId(), 0L)))
                .collect(Collectors.groupingBy(TypeAdminDto::categoryId));
        return categories.findAllOrdered().stream()
                .map(c -> toDto(c, counts.getOrDefault(c.getId(), 0L),
                        typesByCategory.getOrDefault(c.getId(), List.of())))
                .toList();
    }

    @Transactional
    public TypeAdminDto createType(Long categoryId, TypeRequest r) {
        Category category = categories.findById(categoryId).orElseThrow(() -> ApiException.notFound("Категория"));
        ProductType type = new ProductType(category, uniqueTypeSlug(blank(r.slug()) ? r.nameRu() : r.slug(), null),
                r.nameRu().trim());
        type.setNameKk(blank(r.nameKk()) ? null : r.nameKk().trim());
        type.setSortOrder(r.sortOrder() != null ? r.sortOrder()
                : types.findByCategoryOrdered(categoryId).stream().mapToInt(ProductType::getSortOrder).max().orElse(0) + 10);
        types.save(type);
        cacheEvictor.evictAll();
        return toDto(type, 0);
    }

    @Transactional
    public TypeAdminDto updateType(Long id, TypeRequest r) {
        ProductType type = types.findById(id).orElseThrow(() -> ApiException.notFound("Тип товара"));
        if (!blank(r.slug()) && !r.slug().equals(type.getSlug())) {
            type.setSlug(uniqueTypeSlug(r.slug(), id));
        }
        type.setNameRu(r.nameRu().trim());
        type.setNameKk(blank(r.nameKk()) ? null : r.nameKk().trim());
        if (r.sortOrder() != null) {
            type.setSortOrder(r.sortOrder());
        }
        cacheEvictor.evictAll();
        return toDto(type, products.countByTypeId(id));
    }

    /** Products of a deleted type stay in their category, they only lose the type (FK is "on delete set null"). */
    @Transactional
    public void deleteType(Long id) {
        ProductType type = types.findById(id).orElseThrow(() -> ApiException.notFound("Тип товара"));
        types.delete(type);
        cacheEvictor.evictAll();
    }

    @Transactional
    public CategoryAdminDto createCategory(CategoryRequest r) {
        String slug = uniqueCategorySlug(blank(r.slug()) ? r.nameRu() : r.slug(), null);
        Category category = new Category(slug, r.nameRu().trim());
        apply(category, r);
        if (r.sortOrder() == null) {
            category.setSortOrder(categories.findAllOrdered().stream().mapToInt(Category::getSortOrder).max().orElse(0) + 10);
        }
        categories.save(category);
        cacheEvictor.evictAll();
        return toDto(category, 0, List.of());
    }

    @Transactional
    public CategoryAdminDto updateCategory(Long id, CategoryRequest r) {
        Category category = categories.findById(id).orElseThrow(() -> ApiException.notFound("Категория"));
        if (!blank(r.slug()) && !r.slug().equals(category.getSlug())) {
            category.setSlug(uniqueCategorySlug(r.slug(), id));
        }
        category.setNameRu(r.nameRu().trim());
        apply(category, r);
        cacheEvictor.evictAll();
        Map<Long, Long> typeCounts = countBy("type_id");
        return toDto(category, products.countByCategoryId(id), types.findByCategoryOrdered(id).stream()
                .map(t -> toDto(t, typeCounts.getOrDefault(t.getId(), 0L))).toList());
    }

    @Transactional
    public void deleteCategory(Long id) {
        Category category = categories.findById(id).orElseThrow(() -> ApiException.notFound("Категория"));
        long used = products.countByCategoryId(id);
        if (used > 0) {
            throw ApiException.conflict("category_in_use",
                    "В категории " + used + " товар(ов). Перенесите их в другую категорию перед удалением.");
        }
        categories.delete(category);
        cacheEvictor.evictAll();
    }

    @Transactional(readOnly = true)
    public List<BrandAdminDto> listBrands() {
        Map<Long, Long> counts = countBy("brand_id");
        return brands.findAllOrdered().stream().map(b -> toDto(b, counts.getOrDefault(b.getId(), 0L))).toList();
    }

    @Transactional
    public BrandAdminDto createBrand(BrandRequest r) {
        brands.findByNameIgnoreCase(r.name().trim()).ifPresent(existing -> {
            throw ApiException.conflict("brand_exists", "Бренд «" + existing.getName() + "» уже существует");
        });
        Brand brand = new Brand(uniqueBrandSlug(blank(r.slug()) ? r.name() : r.slug(), null), r.name().trim());
        brand.setDescription(blank(r.description()) ? null : r.description().trim());
        brands.save(brand);
        cacheEvictor.evictAll();
        return toDto(brand, 0);
    }

    @Transactional
    public BrandAdminDto updateBrand(Long id, BrandRequest r) {
        Brand brand = brands.findById(id).orElseThrow(() -> ApiException.notFound("Бренд"));
        brands.findByNameIgnoreCase(r.name().trim())
                .filter(other -> !other.getId().equals(id))
                .ifPresent(other -> {
                    throw ApiException.conflict("brand_exists", "Бренд с таким названием уже существует");
                });
        if (!blank(r.slug()) && !r.slug().equals(brand.getSlug())) {
            brand.setSlug(uniqueBrandSlug(r.slug(), id));
        }
        brand.setName(r.name().trim());
        brand.setDescription(blank(r.description()) ? null : r.description().trim());
        cacheEvictor.evictAll();
        return toDto(brand, products.countByBrandId(id));
    }

    @Transactional
    public void deleteBrand(Long id) {
        Brand brand = brands.findById(id).orElseThrow(() -> ApiException.notFound("Бренд"));
        long used = products.countByBrandId(id);
        if (used > 0) {
            throw ApiException.conflict("brand_in_use", "У бренда " + used + " товар(ов). Сначала смените им бренд.");
        }
        brands.delete(brand);
        cacheEvictor.evictAll();
    }

    private void apply(Category category, CategoryRequest r) {
        category.setNameKk(blank(r.nameKk()) ? null : r.nameKk().trim());
        category.setDescriptionRu(blank(r.descriptionRu()) ? null : r.descriptionRu().trim());
        category.setDescriptionKk(blank(r.descriptionKk()) ? null : r.descriptionKk().trim());
        category.setIcon(blank(r.icon()) ? null : r.icon().trim());
        if (r.sortOrder() != null) {
            category.setSortOrder(r.sortOrder());
        }
    }

    private Map<Long, Long> countBy(String column) {
        return jdbc.queryForList("select " + column + " as id, count(*) as cnt from products where " + column
                        + " is not null group by " + column)
                .stream()
                .collect(Collectors.toMap(row -> ((Number) row.get("id")).longValue(),
                        row -> ((Number) row.get("cnt")).longValue()));
    }

    private String uniqueCategorySlug(String source, Long selfId) {
        String base = Slugify.slugify(source);
        String slug = base;
        for (int i = 2; ; i++) {
            var existing = categories.findBySlug(slug);
            if (existing.isEmpty() || existing.get().getId().equals(selfId)) {
                return slug;
            }
            slug = base + "-" + i;
        }
    }

    private String uniqueBrandSlug(String source, Long selfId) {
        String base = Slugify.slugify(source);
        String slug = base;
        for (int i = 2; ; i++) {
            var existing = brands.findBySlug(slug);
            if (existing.isEmpty() || existing.get().getId().equals(selfId)) {
                return slug;
            }
            slug = base + "-" + i;
        }
    }

    private String uniqueTypeSlug(String source, Long selfId) {
        String base = Slugify.slugify(source);
        String slug = base;
        for (int i = 2; ; i++) {
            var existing = types.findBySlug(slug);
            if (existing.isEmpty() || existing.get().getId().equals(selfId)) {
                return slug;
            }
            slug = base + "-" + i;
        }
    }

    private static CategoryAdminDto toDto(Category c, long count, List<TypeAdminDto> typeList) {
        return new CategoryAdminDto(c.getId(), c.getSlug(), c.getNameRu(), c.getNameKk(), c.getDescriptionRu(),
                c.getDescriptionKk(), c.getIcon(), c.getSortOrder(), count, typeList);
    }

    private static TypeAdminDto toDto(ProductType t, long count) {
        return new TypeAdminDto(t.getId(), t.getCategory().getId(), t.getSlug(), t.getNameRu(), t.getNameKk(),
                t.getSortOrder(), count);
    }

    private static BrandAdminDto toDto(Brand b, long count) {
        return new BrandAdminDto(b.getId(), b.getSlug(), b.getName(), b.getDescription(), count);
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }
}
