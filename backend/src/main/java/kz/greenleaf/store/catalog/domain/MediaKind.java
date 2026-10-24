package kz.greenleaf.store.catalog.domain;

/** How a file is presented on the product page. */
public enum MediaKind {
    /** Product photos — the main gallery. */
    PHOTO,
    /** Screenshots: catalog pages, instructions, infographics. */
    SCREENSHOT,
    /** Downloadable documents: certificates, instructions, specifications. */
    DOCUMENT,
    /**
     * Uploaded product videos,
     * shown before the photos.
     * */
    VIDEO
}
