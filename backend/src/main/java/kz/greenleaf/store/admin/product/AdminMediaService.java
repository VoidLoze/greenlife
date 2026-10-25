package kz.greenleaf.store.admin.product;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import kz.greenleaf.store.admin.product.AdminProductDtos.MediaReorderRequest;
import kz.greenleaf.store.admin.product.AdminProductDtos.MediaUpdateRequest;
import kz.greenleaf.store.admin.product.AdminProductDtos.ProductAdminDto;
import kz.greenleaf.store.catalog.CatalogCacheEvictor;
import kz.greenleaf.store.catalog.ProductMapper;
import kz.greenleaf.store.catalog.domain.MediaKind;
import kz.greenleaf.store.catalog.domain.Product;
import kz.greenleaf.store.catalog.domain.ProductMedia;
import kz.greenleaf.store.catalog.domain.ProductStatus;
import kz.greenleaf.store.catalog.domain.StoredFileInfo;
import kz.greenleaf.store.catalog.dto.CatalogDtos.MediaDto;
import kz.greenleaf.store.catalog.repo.ProductMediaRepository;
import kz.greenleaf.store.common.ApiException;
import kz.greenleaf.store.media.MediaProcessor;
import kz.greenleaf.store.media.StorageTransactions;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class AdminMediaService {

    private static final int MAX_MEDIA_PER_PRODUCT = 60;

    private final AdminProductService productService;
    private final ProductMediaRepository mediaRepository;
    private final MediaProcessor processor;
    private final StorageTransactions storageTx;
    private final ProductMapper mapper;
    private final CatalogCacheEvictor cacheEvictor;
    private final JdbcTemplate jdbc;

    public AdminMediaService(AdminProductService productService, ProductMediaRepository mediaRepository,
                             MediaProcessor processor, StorageTransactions storageTx, ProductMapper mapper,
                             CatalogCacheEvictor cacheEvictor, JdbcTemplate jdbc) {
        this.productService = productService;
        this.mediaRepository = mediaRepository;
        this.processor = processor;
        this.storageTx = storageTx;
        this.mapper = mapper;
        this.cacheEvictor = cacheEvictor;
        this.jdbc = jdbc;
    }

    public record UploadMeta(MediaKind kind, String title, String description, String altText, boolean cover) {
    }

    @Transactional
    public MediaDto upload(Long productId, MultipartFile file, UploadMeta meta) {
        Product product = productService.load(productId);
        if (product.getMedia().size() >= MAX_MEDIA_PER_PRODUCT) {
            throw ApiException.badRequest("media_limit", "У товара уже " + MAX_MEDIA_PER_PRODUCT + " файлов — удалите лишние");
        }
        if (file == null || file.isEmpty()) {
            throw ApiException.badRequest("empty_file", "Файл не выбран или пустой");
        }
        if (meta.kind() != MediaKind.VIDEO && file.getSize() > MediaProcessor.MAX_FILE_BYTES) {
            throw ApiException.badRequest("file_too_large", "Файл больше 25 МБ — уменьшите его и загрузите снова");
        }
        StoredFileInfo stored;
        try {
            String folder = "products/" + productId;
            stored = meta.kind() == MediaKind.VIDEO
                    ? processor.storeVideo(folder, file, file.getSize(), file.getOriginalFilename())
                    : processor.store(folder, file.getBytes(), file.getOriginalFilename(), meta.kind());
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to store upload", ex);
        }
        storageTx.deleteOnRollback(stored.storageKey(), stored.thumbnailKey());

        ProductMedia media = new ProductMedia(meta.kind(), stored);
        media.setTitle(AdminProductService.blankToNull(meta.title()));
        media.setDescription(AdminProductService.blankToNull(meta.description()));
        media.setAltText(AdminProductService.blankToNull(meta.altText()) != null
                ? meta.altText().trim()
                : defaultAlt(product, meta));
        media.setSortOrder(mediaRepository.maxSortOrder(productId, meta.kind()) + 1);
        product.addMedia(media);
        mediaRepository.save(media);

        boolean firstPhoto = meta.kind() == MediaKind.PHOTO && product.getCoverKey() == null;
        if (media.isImage() && meta.kind() == MediaKind.PHOTO && (meta.cover() || firstPhoto)) {
            makeCover(product, media);
        }
        cacheEvictor.evictAll();
        return mapper.toMedia(media);
    }

    @Transactional
    public MediaDto update(Long productId, Long mediaId, MediaUpdateRequest request) {
        Product product = productService.load(productId);
        ProductMedia media = find(product, mediaId);
        if (request.title() != null) {
            media.setTitle(AdminProductService.blankToNull(request.title()));
        }
        if (request.description() != null) {
            media.setDescription(AdminProductService.blankToNull(request.description()));
        }
        if (request.altText() != null) {
            media.setAltText(AdminProductService.blankToNull(request.altText()));
        }
        if (request.kind() != null && request.kind() != media.getKind()) {
            if ((request.kind() == MediaKind.VIDEO) != (media.getKind() == MediaKind.VIDEO)) {
                throw ApiException.badRequest("video_kind_locked", "Видео нельзя перенести в другой раздел, а другой файл — в видео");
            }
            if (request.kind() != MediaKind.DOCUMENT && !media.isImage()) {
                throw ApiException.badRequest("not_an_image", "Документ нельзя перенести в фото или скрины");
            }
            media.setKind(request.kind());
            media.setSortOrder(mediaRepository.maxSortOrder(productId, request.kind()) + 1);
            if (media.isCover() && request.kind() != MediaKind.PHOTO) {
                media.setCover(false);
                mediaRepository.flush();
                promoteNextCover(product, media.getId());
            }
        }
        if (Boolean.TRUE.equals(request.cover())) {
            if (media.getKind() != MediaKind.PHOTO || !media.isImage()) {
                throw ApiException.badRequest("cover_must_be_photo", "Обложкой может быть только фото");
            }
            makeCover(product, media);
        }
        ensureStillPublishable(product);
        cacheEvictor.evictAll();
        return mapper.toMedia(media);
    }

    @Transactional
    public List<MediaDto> reorder(Long productId, MediaReorderRequest request) {
        Product product = productService.load(productId);
        Map<Long, ProductMedia> byId = product.getMedia().stream()
                .filter(m -> m.getKind() == request.kind())
                .collect(Collectors.toMap(ProductMedia::getId, Function.identity()));
        if (!byId.keySet().equals(new HashSet<>(request.ids())) || request.ids().size() != byId.size()) {
            throw ApiException.badRequest("invalid_order", "Список должен содержать все файлы этого раздела ровно по одному разу");
        }
        for (int i = 0; i < request.ids().size(); i++) {
            byId.get(request.ids().get(i)).setSortOrder(i);
        }
        // "The first photo is the cover": dragging a photo to the front makes it the cover.
        if (request.kind() == MediaKind.PHOTO) {
            request.ids().stream().map(byId::get).filter(ProductMedia::isImage).findFirst()
                    .filter(first -> !first.isCover())
                    .ifPresent(first -> makeCover(product, first));
        }
        cacheEvictor.evictAll();
        return request.ids().stream().map(byId::get).map(mapper::toMedia).toList();
    }

    @Transactional
    public ProductAdminDto delete(Long productId, Long mediaId) {
        Product product = productService.load(productId);
        ProductMedia media = find(product, mediaId);
        boolean wasCover = media.isCover();
        String key = media.getStorageKey();
        String thumb = media.getThumbnailKey();

        product.getMedia().remove(media);
        mediaRepository.flush();
        if (wasCover || key.equals(product.getCoverKey())) {
            product.setCover(null, null);
            promoteNextCover(product, null);
        }
        ensureStillPublishable(product);

        List<String> orphaned = new ArrayList<>();
        if (mediaRepository.countByStorageKey(key) == 0 && !referencedByOrders(key)) {
            orphaned.add(key);
        }
        if (thumb != null && !thumbnailInUse(thumb) && !referencedByOrders(thumb)) {
            orphaned.add(thumb);
        }
        storageTx.deleteAfterCommit(orphaned);
        cacheEvictor.evictAll();
        return productService.toAdmin(product);
    }

    private void makeCover(Product product, ProductMedia media) {
        for (ProductMedia other : product.getMedia()) {
            if (other.isCover() && !other.getId().equals(media.getId())) {
                other.setCover(false);
            }
        }
        // The partial unique index allows a single cover per product, so the old flag must hit the DB first.
        mediaRepository.flush();
        media.setCover(true);
        product.setCover(media.getStorageKey(), media.getThumbnailKey());
    }

    private void promoteNextCover(Product product, Long excludeId) {
        product.getMedia().stream()
                .filter(m -> m.getKind() == MediaKind.PHOTO && m.isImage())
                .filter(m -> excludeId == null || !m.getId().equals(excludeId))
                .min(Comparator.comparingInt(ProductMedia::getSortOrder))
                .ifPresentOrElse(next -> makeCover(product, next), () -> product.setCover(null, null));
    }

    /** Removing the last photo of a live product would leave a broken card, so it is moved back to drafts. */
    private void ensureStillPublishable(Product product) {
        if (product.getStatus() == ProductStatus.PUBLISHED && product.getCoverKey() == null) {
            product.changeStatus(ProductStatus.DRAFT);
        }
    }

    private ProductMedia find(Product product, Long mediaId) {
        return product.getMedia().stream()
                .filter(m -> m.getId().equals(mediaId))
                .findFirst()
                .orElseThrow(() -> ApiException.notFound("Файл"));
    }

    private boolean thumbnailInUse(String key) {
        Long count = jdbc.queryForObject("select count(*) from product_media where thumbnail_key = ? or storage_key = ?",
                Long.class, key, key);
        return count != null && count > 0;
    }

    private boolean referencedByOrders(String key) {
        Boolean used = jdbc.queryForObject("select exists(select 1 from order_items where image_key = ?)",
                Boolean.class, key);
        return Boolean.TRUE.equals(used);
    }

    private static String defaultAlt(Product product, UploadMeta meta) {
        return switch (meta.kind()) {
            case PHOTO -> product.getNameRu();
            case SCREENSHOT -> product.getNameRu() + " — страница каталога";
            case DOCUMENT -> meta.title() != null ? meta.title() : product.getNameRu() + " — документ";
            case VIDEO -> product.getNameRu() + " — видео";
        };
    }
}
