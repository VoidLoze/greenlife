package kz.greenleaf.store.catalog.dto;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import kz.greenleaf.store.catalog.domain.MediaKind;
import kz.greenleaf.store.catalog.domain.ProductStatus;

/** Read models of the public catalog. All of them are cached in Redis, hence Serializable. */
public final class CatalogDtos {

    private CatalogDtos() {
    }

    public record CategoryDto(Long id, String slug, String nameRu, String nameKk, String descriptionRu,
                              String descriptionKk, String icon, int sortOrder, long productCount,
                              List<ProductTypeDto> types, String imageUrl)
            implements Serializable {
    }

    public record ProductTypeDto(String slug, String nameRu, String nameKk, long productCount) implements Serializable {
    }

    public record TypeRef(String slug, String nameRu, String nameKk, String categorySlug) implements Serializable {
    }

    public record BrandDto(Long id, String slug, String name, String description, long productCount)
            implements Serializable {
    }

    public record CategoryRef(String slug, String nameRu, String nameKk) implements Serializable {
    }

    public record BrandRef(String slug, String name) implements Serializable {
    }

    public record ProductCardDto(
            Long id,
            String slug,
            String sku,
            String nameRu,
            String nameKk,
            String summaryRu,
            String summaryKk,
            BrandRef brand,
            CategoryRef category,
            TypeRef type,
            BigDecimal price,
            BigDecimal partnerPrice,
            BigDecimal oldPrice,
            String currency,
            String volume,
            String badge,
            String imageUrl,
            String thumbUrl,
            boolean inStock,
            boolean lowStock,
            boolean featured,
            ProductStatus status) implements Serializable {
    }

    public record MediaDto(
            Long id,
            MediaKind kind,
            String url,
            String thumbUrl,
            String title,
            String description,
            String altText,
            String contentType,
            long sizeBytes,
            Integer width,
            Integer height,
            String originalFilename,
            boolean cover,
            int sortOrder) implements Serializable {
    }

    public record BenefitDto(String textRu, String textKk) implements Serializable {
    }

    public record AttributeDto(String nameRu, String valueRu, String nameKk, String valueKk) implements Serializable {
    }

    public record ProductDetailDto(
            ProductCardDto card,
            String descriptionRu,
            String descriptionKk,
            String usageRu,
            String usageKk,
            String composition,
            String warningsRu,
            String warningsKk,
            List<BenefitDto> benefits,
            List<AttributeDto> attributes,
            List<MediaDto> photos,
            List<MediaDto> screenshots,
            List<MediaDto> documents,
            List<MediaDto> videos,
            String videoUrl,
            Integer catalogPage,
            Integer stockQuantity,
            Instant updatedAt) implements Serializable {
    }

    public record ProductSearchResponse(
            List<ProductCardDto> items,
            int page,
            int size,
            long totalItems,
            int totalPages,
            String correctedQuery) implements Serializable {
    }

    public record FacetValue(String slug, long count) implements Serializable {
    }

    /** A fixed price band of the catalog with the number of products that fall into it under the current filters. */
    public record PriceBucket(BigDecimal min, BigDecimal max, long count) implements Serializable {
    }

    public record FacetsDto(List<FacetValue> categories, List<FacetValue> types, List<FacetValue> brands,
                            List<PriceBucket> priceBuckets, BigDecimal priceMin, BigDecimal priceMax, long total)
            implements Serializable {
    }

    public record SuggestItem(String slug, String nameRu, String nameKk, String thumbUrl, BigDecimal price,
                              BigDecimal partnerPrice, String brand, String volume, String categoryNameRu,
                              String categoryNameKk) implements Serializable {
    }

    public record SuggestionsDto(List<SuggestItem> products, long total, List<CategoryRef> categories,
                                 List<TypeRef> types, List<BrandRef> brands, List<String> popularQueries,
                                 String correctedQuery) implements Serializable {
    }

    public record RelatedDto(List<ProductCardDto> boughtTogether, List<ProductCardDto> similar)
            implements Serializable {
    }

    /** One product for the home-page gift block; {@code personal} — picked from the shopper's own purchases. */
    public record GiftPickDto(ProductCardDto product, boolean personal) {
    }

    public record HomeDto(List<ProductCardDto> featured, List<ProductCardDto> bestsellers,
                          List<ProductCardDto> newest, List<CategoryDto> categories, long productCount)
            implements Serializable {
    }
}
