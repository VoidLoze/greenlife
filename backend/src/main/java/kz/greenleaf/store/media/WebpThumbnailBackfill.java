package kz.greenleaf.store.media;

import java.util.List;
import kz.greenleaf.store.catalog.CatalogCacheEvictor;
import kz.greenleaf.store.catalog.domain.MediaKind;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Renews display copies made by older versions, once, in the background after start: pictures without a WebP copy,
 * and product photos whose copy still has the empty background around the product.
 * Rows that are already up to date are skipped, so a restart simply continues where it stopped.
 */
@Component
class WebpThumbnailBackfill {

    private static final Logger log = LoggerFactory.getLogger(WebpThumbnailBackfill.class);

    private final JdbcTemplate jdbc;
    private final FileStorage storage;
    private final MediaProcessor processor;
    private final CatalogCacheEvictor cacheEvictor;

    WebpThumbnailBackfill(JdbcTemplate jdbc, FileStorage storage, MediaProcessor processor,
                          CatalogCacheEvictor cacheEvictor) {
        this.jdbc = jdbc;
        this.storage = storage;
        this.processor = processor;
        this.cacheEvictor = cacheEvictor;
    }

    private record Row(long id, MediaKind kind, String storageKey, String thumbnailKey) {
    }

    @EventListener(ApplicationReadyEvent.class)
    public void start() {
        if (!WebpEncoder.available()) {
            return;
        }
        Thread.ofVirtual().name("webp-thumbnails").start(this::run);
    }

    void run() {
        String trimmed = "%" + MediaProcessor.THUMB_SUFFIX.replace("_", "\\_") + "webp";
        List<Row> rows = jdbc.query("""
                        select id, kind, storage_key, thumbnail_key from product_media
                        where content_type in ('image/jpeg', 'image/png', 'image/gif')
                          and (thumbnail_key is null or thumbnail_key not like '%.webp'
                               or (kind = 'PHOTO' and thumbnail_key not like ?))
                        order by id
                        """,
                (rs, i) -> new Row(rs.getLong(1), MediaKind.valueOf(rs.getString(2)), rs.getString(3), rs.getString(4)),
                trimmed);
        if (rows.isEmpty()) {
            return;
        }
        log.info("Renewing display copies for {} pictures", rows.size());
        int done = 0;
        for (Row row : rows) {
            try {
                if (!storage.exists(row.storageKey())) {
                    continue;
                }
                String key = processor.webpThumbnail(row.storageKey(), storage.read(row.storageKey()), row.kind())
                        .orElse(null);
                if (key == null) {
                    continue;
                }
                jdbc.update("update product_media set thumbnail_key = ? where id = ?", key, row.id());
                jdbc.update("update products set cover_thumb_key = ? where cover_key = ?", key, row.storageKey());
                deleteIfUnused(row.thumbnailKey(), row.storageKey());
                done++;
            } catch (Exception ex) {
                log.warn("WebP thumbnail for media {} failed: {}", row.id(), ex.toString());
            }
        }
        cacheEvictor.evictAll();
        log.info("Display copies renewed: {} of {}", done, rows.size());
    }

    /** Old thumbnails stay while anything still points at them — order history keeps its picture keys. */
    private void deleteIfUnused(String oldKey, String storageKey) {
        if (oldKey == null || oldKey.equals(storageKey)) {
            return;
        }
        Integer refs = jdbc.queryForObject("""
                        select (select count(*) from product_media where thumbnail_key = ?)
                             + (select count(*) from products where cover_thumb_key = ?)
                             + (select count(*) from order_items where image_key = ?)
                        """,
                Integer.class, oldKey, oldKey, oldKey);
        if (refs != null && refs == 0) {
            storage.delete(oldKey);
        }
    }
}
