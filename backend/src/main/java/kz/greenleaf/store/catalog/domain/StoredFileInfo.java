package kz.greenleaf.store.catalog.domain;

public record StoredFileInfo(
        String storageKey,
        String thumbnailKey,
        String originalFilename,
        String contentType,
        long sizeBytes,
        Integer width,
        Integer height) {
}
