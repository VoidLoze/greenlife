package kz.greenleaf.store.catalog;

import java.util.List;
import kz.greenleaf.store.catalog.domain.Brand;
import kz.greenleaf.store.catalog.domain.Category;
import kz.greenleaf.store.catalog.domain.MediaKind;
import kz.greenleaf.store.catalog.domain.Product;
import kz.greenleaf.store.catalog.domain.ProductMedia;
import kz.greenleaf.store.catalog.domain.ProductType;
import kz.greenleaf.store.catalog.dto.CatalogDtos.AttributeDto;
import kz.greenleaf.store.catalog.dto.CatalogDtos.BenefitDto;
import kz.greenleaf.store.catalog.dto.CatalogDtos.BrandRef;
import kz.greenleaf.store.catalog.dto.CatalogDtos.CategoryRef;
import kz.greenleaf.store.catalog.dto.CatalogDtos.MediaDto;
import kz.greenleaf.store.catalog.dto.CatalogDtos.ProductCardDto;
import kz.greenleaf.store.catalog.dto.CatalogDtos.ProductDetailDto;
import kz.greenleaf.store.catalog.dto.CatalogDtos.TypeRef;
import kz.greenleaf.store.config.AppProperties;
import kz.greenleaf.store.media.MediaUrls;
import org.springframework.stereotype.Component;

@Component
public class ProductMapper {

    public static final int LOW_STOCK_THRESHOLD = 5;

    private final MediaUrls urls;
    private final int partnerDiscountPercent;

    public ProductMapper(MediaUrls urls, AppProperties properties) {
        this.urls = urls;
        this.partnerDiscountPercent = properties.pricing().partnerDiscountPercent();
    }

    public ProductCardDto toCard(Product p) {
        Integer stock = p.getStockQuantity();
        return new ProductCardDto(
                p.getId(), p.getSlug(), p.getSku(), p.getNameRu(), p.getNameKk(), p.getSummaryRu(), p.getSummaryKk(),
                brandRef(p.getBrand()), categoryRef(p.getCategory()), typeRef(p.getType()),
                p.getPrice(), p.effectivePartnerPrice(partnerDiscountPercent), p.getOldPrice(), p.getCurrency(),
                p.getVolume(), p.getBadge(),
                urls.url(p.getCoverKey()), urls.url(p.getCoverThumbKey() != null ? p.getCoverThumbKey() : p.getCoverKey()),
                p.isInStock(), stock != null && stock > 0 && stock <= LOW_STOCK_THRESHOLD, p.isFeatured(), p.getStatus());
    }

    public ProductDetailDto toDetail(Product p, List<ProductMedia> media) {
        return new ProductDetailDto(
                toCard(p),
                p.getDescriptionRu(), p.getDescriptionKk(),
                p.getUsageRu(), p.getUsageKk(),
                p.getComposition(),
                p.getWarningsRu(), p.getWarningsKk(),
                p.getBenefits().stream().map(b -> new BenefitDto(b.getTextRu(), b.getTextKk())).toList(),
                p.getAttributes().stream()
                        .map(a -> new AttributeDto(a.getNameRu(), a.getValueRu(), a.getNameKk(), a.getValueKk()))
                        .toList(),
                mediaOf(media, MediaKind.PHOTO),
                mediaOf(media, MediaKind.SCREENSHOT),
                mediaOf(media, MediaKind.DOCUMENT),
                mediaOf(media, MediaKind.VIDEO),
                p.getVideoUrl(),
                p.getCatalogPage(),
                p.getStockQuantity(),
                p.getUpdatedAt());
    }

    public MediaDto toMedia(ProductMedia m) {
        String thumb = m.getThumbnailKey() != null ? m.getThumbnailKey() : (m.isImage() ? m.getStorageKey() : null);
        return new MediaDto(m.getId(), m.getKind(), urls.url(m.getStorageKey()), urls.url(thumb), m.getTitle(),
                m.getDescription(), m.getAltText(), m.getContentType(), m.getSizeBytes(), m.getWidth(), m.getHeight(),
                m.getOriginalFilename(), m.isCover(), m.getSortOrder());
    }

    public BrandRef brandRef(Brand brand) {
        return brand == null ? null : new BrandRef(brand.getSlug(), brand.getName());
    }

    public CategoryRef categoryRef(Category category) {
        return category == null ? null : new CategoryRef(category.getSlug(), category.getNameRu(), category.getNameKk());
    }

    public TypeRef typeRef(ProductType type) {
        return type == null ? null
                : new TypeRef(type.getSlug(), type.getNameRu(), type.getNameKk(), type.getCategory().getSlug());
    }

    private List<MediaDto> mediaOf(List<ProductMedia> media, MediaKind kind) {
        return media.stream().filter(m -> m.getKind() == kind).map(this::toMedia).toList();
    }
}
