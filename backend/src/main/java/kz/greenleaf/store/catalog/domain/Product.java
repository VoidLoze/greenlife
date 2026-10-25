package kz.greenleaf.store.catalog.domain;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import kz.greenleaf.store.common.AuditedEntity;
import org.hibernate.annotations.DynamicUpdate;

/**
 * Checkout changes stock and sales counters with direct UPDATEs that leave {@code version} alone, so a shopper's
 * purchase never makes an open editor stale; {@link DynamicUpdate} keeps an editor save from writing those
 * counters back.
 */
@Entity
@Table(name = "products")
@DynamicUpdate
public class Product extends AuditedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String sku;

    @Column(nullable = false, unique = true)
    private String slug;

    @Column(name = "name_ru", nullable = false)
    private String nameRu;

    @Column(name = "name_kk")
    private String nameKk;

    @Column(name = "summary_ru")
    private String summaryRu;

    @Column(name = "summary_kk")
    private String summaryKk;

    @Column(name = "description_ru")
    private String descriptionRu;

    @Column(name = "description_kk")
    private String descriptionKk;

    @Column(name = "usage_ru")
    private String usageRu;

    @Column(name = "usage_kk")
    private String usageKk;

    private String composition;

    @Column(name = "warnings_ru")
    private String warningsRu;

    @Column(name = "warnings_kk")
    private String warningsKk;

    @Column(name = "search_keywords")
    private String searchKeywords;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private Category category;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "type_id")
    private ProductType type;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "brand_id")
    private Brand brand;

    private BigDecimal price;

    @Column(name = "partner_price")
    private BigDecimal partnerPrice;

    @Column(name = "old_price")
    private BigDecimal oldPrice;

    @Column(nullable = false)
    private String currency = "KZT";

    private String volume;

    @Column(name = "stock_quantity")
    private Integer stockQuantity;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ProductStatus status = ProductStatus.DRAFT;

    @Column(nullable = false)
    private boolean featured;

    private String badge;

    @Column(name = "catalog_page")
    private Integer catalogPage;

    @Column(name = "video_url")
    private String videoUrl;

    @Column(name = "cover_key")
    private String coverKey;

    @Column(name = "cover_thumb_key")
    private String coverThumbKey;

    @Column(name = "view_count", nullable = false)
    private long viewCount;

    @Column(name = "sold_count", nullable = false)
    private long soldCount;

    @Version
    @Column(nullable = false)
    private long version;

    @Column(name = "created_by")
    private Long createdBy;

    @Column(name = "published_at")
    private Instant publishedAt;

    @ElementCollection
    @CollectionTable(name = "product_benefits", joinColumns = @JoinColumn(name = "product_id"))
    @OrderColumn(name = "position")
    private List<ProductBenefit> benefits = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "product_attributes", joinColumns = @JoinColumn(name = "product_id"))
    @OrderColumn(name = "position")
    private List<ProductAttribute> attributes = new ArrayList<>();

    @OneToMany(mappedBy = "product", cascade = jakarta.persistence.CascadeType.ALL, orphanRemoval = true)
    @OrderBy("kind ASC, sortOrder ASC, id ASC")
    private List<ProductMedia> media = new ArrayList<>();

    protected Product() {
    }

    public Product(String sku, String slug, String nameRu) {
        this.sku = sku;
        this.slug = slug;
        this.nameRu = nameRu;
    }

    public boolean isPurchasable() {
        return status == ProductStatus.PUBLISHED && price != null && (stockQuantity == null || stockQuantity > 0);
    }

    public boolean isInStock() {
        return stockQuantity == null || stockQuantity > 0;
    }

    public BigDecimal effectivePartnerPrice(int discountPercent) {
        if (partnerPrice != null) {
            return partnerPrice;
        }
        if (price == null) {
            return null;
        }
        return price.multiply(BigDecimal.valueOf(100L - discountPercent))
                .divide(BigDecimal.valueOf(100), 0, RoundingMode.HALF_UP);
    }

    public void changeStatus(ProductStatus newStatus) {
        if (newStatus == ProductStatus.PUBLISHED && publishedAt == null) {
            publishedAt = Instant.now();
        }
        this.status = newStatus;
    }

    public void replaceBenefits(List<ProductBenefit> items) {
        benefits.clear();
        benefits.addAll(items);
    }

    public void replaceAttributes(List<ProductAttribute> items) {
        attributes.clear();
        attributes.addAll(items);
    }

    public void addMedia(ProductMedia item) {
        media.add(item);
        item.attachTo(this);
    }

    public void setCover(String key, String thumbKey) {
        this.coverKey = key;
        this.coverThumbKey = thumbKey;
    }

    public Long getId() {
        return id;
    }

    public String getSku() {
        return sku;
    }

    public void setSku(String sku) {
        this.sku = sku;
    }

    public String getSlug() {
        return slug;
    }

    public void setSlug(String slug) {
        this.slug = slug;
    }

    public String getNameRu() {
        return nameRu;
    }

    public void setNameRu(String nameRu) {
        this.nameRu = nameRu;
    }

    public String getNameKk() {
        return nameKk;
    }

    public void setNameKk(String nameKk) {
        this.nameKk = nameKk;
    }

    public String getSummaryRu() {
        return summaryRu;
    }

    public void setSummaryRu(String summaryRu) {
        this.summaryRu = summaryRu;
    }

    public String getSummaryKk() {
        return summaryKk;
    }

    public void setSummaryKk(String summaryKk) {
        this.summaryKk = summaryKk;
    }

    public String getDescriptionRu() {
        return descriptionRu;
    }

    public void setDescriptionRu(String descriptionRu) {
        this.descriptionRu = descriptionRu;
    }

    public String getDescriptionKk() {
        return descriptionKk;
    }

    public void setDescriptionKk(String descriptionKk) {
        this.descriptionKk = descriptionKk;
    }

    public String getUsageRu() {
        return usageRu;
    }

    public void setUsageRu(String usageRu) {
        this.usageRu = usageRu;
    }

    public String getUsageKk() {
        return usageKk;
    }

    public void setUsageKk(String usageKk) {
        this.usageKk = usageKk;
    }

    public String getComposition() {
        return composition;
    }

    public void setComposition(String composition) {
        this.composition = composition;
    }

    public String getWarningsRu() {
        return warningsRu;
    }

    public void setWarningsRu(String warningsRu) {
        this.warningsRu = warningsRu;
    }

    public String getWarningsKk() {
        return warningsKk;
    }

    public void setWarningsKk(String warningsKk) {
        this.warningsKk = warningsKk;
    }

    public String getSearchKeywords() {
        return searchKeywords;
    }

    public void setSearchKeywords(String searchKeywords) {
        this.searchKeywords = searchKeywords;
    }

    public Category getCategory() {
        return category;
    }

    public void setCategory(Category category) {
        this.category = category;
    }

    public ProductType getType() {
        return type;
    }

    public void setType(ProductType type) {
        this.type = type;
    }

    public Brand getBrand() {
        return brand;
    }

    public void setBrand(Brand brand) {
        this.brand = brand;
    }

    public BigDecimal getPrice() {
        return price;
    }

    public void setPrice(BigDecimal price) {
        this.price = price;
    }

    public BigDecimal getPartnerPrice() {
        return partnerPrice;
    }

    public void setPartnerPrice(BigDecimal partnerPrice) {
        this.partnerPrice = partnerPrice;
    }

    public BigDecimal getOldPrice() {
        return oldPrice;
    }

    public void setOldPrice(BigDecimal oldPrice) {
        this.oldPrice = oldPrice;
    }

    public String getCurrency() {
        return currency;
    }

    public String getVolume() {
        return volume;
    }

    public void setVolume(String volume) {
        this.volume = volume;
    }

    public Integer getStockQuantity() {
        return stockQuantity;
    }

    public void setStockQuantity(Integer stockQuantity) {
        this.stockQuantity = stockQuantity;
    }

    public ProductStatus getStatus() {
        return status;
    }

    public boolean isFeatured() {
        return featured;
    }

    public void setFeatured(boolean featured) {
        this.featured = featured;
    }

    public String getBadge() {
        return badge;
    }

    public void setBadge(String badge) {
        this.badge = badge;
    }

    public Integer getCatalogPage() {
        return catalogPage;
    }

    public void setCatalogPage(Integer catalogPage) {
        this.catalogPage = catalogPage;
    }

    public String getVideoUrl() {
        return videoUrl;
    }

    public void setVideoUrl(String videoUrl) {
        this.videoUrl = videoUrl;
    }

    public String getCoverKey() {
        return coverKey;
    }

    public String getCoverThumbKey() {
        return coverThumbKey;
    }

    public long getViewCount() {
        return viewCount;
    }

    public long getSoldCount() {
        return soldCount;
    }

    public long getVersion() {
        return version;
    }

    public Long getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(Long createdBy) {
        this.createdBy = createdBy;
    }

    public Instant getPublishedAt() {
        return publishedAt;
    }

    public List<ProductBenefit> getBenefits() {
        return benefits;
    }

    public List<ProductAttribute> getAttributes() {
        return attributes;
    }

    public List<ProductMedia> getMedia() {
        return media;
    }
}
