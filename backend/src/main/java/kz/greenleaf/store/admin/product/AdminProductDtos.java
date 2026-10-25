package kz.greenleaf.store.admin.product;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import kz.greenleaf.store.catalog.domain.MediaKind;
import kz.greenleaf.store.catalog.domain.ProductStatus;
import kz.greenleaf.store.catalog.dto.CatalogDtos.MediaDto;

public final class AdminProductDtos {

    private AdminProductDtos() {
    }

    public record BenefitInput(
            @NotBlank(message = "Текст преимущества не может быть пустым") @Size(max = 500) String textRu,
            @Size(max = 500) String textKk) {
    }

    public record AttributeInput(
            @NotBlank(message = "Укажите название характеристики") @Size(max = 120) String nameRu,
            @NotBlank(message = "Укажите значение характеристики") @Size(max = 500) String valueRu,
            @Size(max = 120) String nameKk,
            @Size(max = 500) String valueKk) {
    }

    public record ProductUpsertRequest(
            @Size(max = 40) @Pattern(regexp = "^[A-Za-z0-9._-]*$", message = "Артикул: латиница, цифры, точка, дефис") String sku,
            @Size(max = 200) @Pattern(regexp = "^[a-z0-9-]*$", message = "Slug: строчная латиница, цифры и дефис") String slug,
            @NotBlank(message = "Укажите название товара") @Size(max = 255) String nameRu,
            @Size(max = 255) String nameKk,
            @Size(max = 600) String summaryRu,
            @Size(max = 600) String summaryKk,
            @Size(max = 20000) String descriptionRu,
            @Size(max = 20000) String descriptionKk,
            @Size(max = 5000) String usageRu,
            @Size(max = 5000) String usageKk,
            @Size(max = 5000) String composition,
            @Size(max = 3000) String warningsRu,
            @Size(max = 3000) String warningsKk,
            @Size(max = 1000) String searchKeywords,
            Long categoryId,
            Long typeId,
            Long brandId,
            @Size(max = 120) String brandName,
            @DecimalMin(value = "0", inclusive = false, message = "Цена должна быть больше нуля") @Digits(integer = 10, fraction = 0, message = "Цена указывается в целых тенге") BigDecimal price,
            @DecimalMin(value = "0", inclusive = false, message = "Партнёрская цена должна быть больше нуля — иначе товар уйдёт бесплатно") @Digits(integer = 10, fraction = 0, message = "Цена указывается в целых тенге") BigDecimal partnerPrice,
            @DecimalMin(value = "0", inclusive = false, message = "Старая цена должна быть больше нуля") @Digits(integer = 10, fraction = 0, message = "Цена указывается в целых тенге") BigDecimal oldPrice,
            @Size(max = 60) String volume,
            @Min(value = 0, message = "Остаток не может быть отрицательным") @Max(1_000_000) Integer stockQuantity,
            /* The stock value the form was opened with: the admin's change is applied as a difference, so orders placed meanwhile are not lost. */
            @Min(0) @Max(1_000_000) Integer stockBase,
            ProductStatus status,
            Boolean featured,
            @Size(max = 60) String badge,
            @Min(1) @Max(1000) Integer catalogPage,
            @Size(max = 500) @Pattern(regexp = "^(https?://\\S+)?$", message = "Ссылка на видео должна начинаться с http:// или https://") String videoUrl,
            @Valid @Size(max = 20) List<BenefitInput> benefits,
            @Valid @Size(max = 40) List<AttributeInput> attributes,
            Long version) {
    }

    public record StatusRequest(@NotNull ProductStatus status) {
    }

    public record ParseDescriptionRequest(@NotBlank @Size(max = 20000) String text, @Size(max = 255) String name) {
    }

    public record MediaUpdateRequest(
            @Size(max = 200) String title,
            @Size(max = 5000) String description,
            @Size(max = 255) String altText,
            MediaKind kind,
            Boolean cover) {
    }

    public record MediaReorderRequest(@NotNull MediaKind kind, @NotNull @Size(max = 200) List<Long> ids) {
    }

    public record CategoryRefDto(Long id, String slug, String nameRu) {
    }

    public record TypeRefDto(Long id, String slug, String nameRu) {
    }

    public record BrandRefDto(Long id, String slug, String name) {
    }

    public record Completeness(int score, List<String> missing) {
    }

    public record ProductListItem(
            Long id,
            String sku,
            String slug,
            String nameRu,
            String brandName,
            String categoryNameRu,
            BigDecimal price,
            BigDecimal partnerPrice,
            Integer stockQuantity,
            ProductStatus status,
            boolean featured,
            String thumbUrl,
            int completeness,
            long viewCount,
            long soldCount,
            Instant updatedAt) {
    }

    public record ProductAdminDto(
            Long id,
            String sku,
            String slug,
            String nameRu,
            String nameKk,
            String summaryRu,
            String summaryKk,
            String descriptionRu,
            String descriptionKk,
            String usageRu,
            String usageKk,
            String composition,
            String warningsRu,
            String warningsKk,
            String searchKeywords,
            CategoryRefDto category,
            TypeRefDto type,
            BrandRefDto brand,
            BigDecimal price,
            BigDecimal partnerPrice,
            BigDecimal effectivePartnerPrice,
            BigDecimal oldPrice,
            String currency,
            String volume,
            Integer stockQuantity,
            ProductStatus status,
            boolean featured,
            String badge,
            Integer catalogPage,
            String videoUrl,
            List<BenefitInput> benefits,
            List<AttributeInput> attributes,
            List<MediaDto> media,
            String coverUrl,
            Completeness completeness,
            long viewCount,
            long soldCount,
            long version,
            Instant createdAt,
            Instant updatedAt,
            Instant publishedAt) {
    }
}
