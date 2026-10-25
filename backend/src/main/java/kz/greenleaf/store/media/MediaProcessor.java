package kz.greenleaf.store.media;

import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Iterator;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageReader;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageInputStream;
import javax.imageio.stream.ImageOutputStream;
import kz.greenleaf.store.catalog.domain.MediaKind;
import kz.greenleaf.store.catalog.domain.StoredFileInfo;
import kz.greenleaf.store.common.ApiException;
import kz.greenleaf.store.config.AppProperties;
import org.apache.tika.Tika;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.InputStreamSource;
import org.springframework.stereotype.Component;

/**
 * Validates uploads by their real content (not the client-declared type), extracts image dimensions and
 * renders thumbnails, then writes everything to {@link FileStorage}.
 */
@Component
public class MediaProcessor {

    private static final Logger log = LoggerFactory.getLogger(MediaProcessor.class);

    private static final Set<String> IMAGE_TYPES = Set.of("image/jpeg", "image/png", "image/webp", "image/gif");
    private static final Set<String> DOCUMENT_TYPES = Set.of(
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/x-tika-ooxml",
            "application/x-tika-msoffice",
            "text/plain");
    private static final Set<String> VIDEO_TYPES = Set.of("video/mp4", "video/webm", "video/quicktime", "video/x-m4v");
    public static final long MAX_FILE_BYTES = 25L * 1024 * 1024;
    public static final long MAX_VIDEO_BYTES = 200L * 1024 * 1024;
    private static final int SNIFF_BYTES = 64 * 1024;
    private static final Map<String, String> EXTENSIONS = Map.ofEntries(
            Map.entry("video/mp4", "mp4"), Map.entry("video/webm", "webm"), Map.entry("video/quicktime", "mov"),
            Map.entry("video/x-m4v", "m4v"),
            Map.entry("image/jpeg", "jpg"), Map.entry("image/png", "png"), Map.entry("image/webp", "webp"),
            Map.entry("image/gif", "gif"), Map.entry("application/pdf", "pdf"), Map.entry("application/msword", "doc"),
            Map.entry("application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"),
            Map.entry("application/vnd.ms-excel", "xls"),
            Map.entry("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"),
            Map.entry("text/plain", "txt"));
    private static final Set<String> THUMBNAILABLE = Set.of("image/jpeg", "image/png", "image/gif");
    /** Office containers Tika recognises only generically: the extension must still be an office one. */
    private static final Set<String> OFFICE_EXTENSIONS = Set.of("doc", "docx", "xls", "xlsx", "ppt", "pptx");
    /** Larger photos are scaled down on upload: shoppers' phones never need more, and pages load faster. */
    private static final int MAX_DISPLAY_SIDE = 2400;
    /** Refuses "decompression bombs": a tiny file that claims to be a gigantic picture. */
    private static final long MAX_PIXELS = 60_000_000L;

    private final FileStorage storage;
    private final int thumbnailWidth;
    private final Tika tika = new Tika();

    public MediaProcessor(FileStorage storage, AppProperties properties) {
        this.storage = storage;
        this.thumbnailWidth = properties.storage().thumbnailWidth();
    }

    public StoredFileInfo store(String folder, byte[] content, String originalFilename, MediaKind kind) throws IOException {
        if (content.length == 0) {
            throw ApiException.badRequest("empty_file", "Файл пустой");
        }
        if (content.length > MAX_FILE_BYTES) {
            throw ApiException.badRequest("file_too_large", "Файл больше 25 МБ — уменьшите его и загрузите снова");
        }
        String contentType = detect(content, originalFilename);
        validate(kind, contentType);

        String base = folder + "/" + UUID.randomUUID();
        String key = base + "." + extensionFor(contentType, originalFilename);
        Integer width = null;
        Integer height = null;
        String thumbnailKey = null;

        if (contentType.startsWith("image/")) {
            BufferedImage image = readImage(content);
            if (image != null && ("image/jpeg".equals(contentType) || "image/png".equals(contentType))) {
                int orientation = "image/jpeg".equals(contentType) ? ExifOrientation.read(content) : 1;
                BufferedImage upright = ExifOrientation.apply(image, orientation);
                BufferedImage display = scaleDown(upright, MAX_DISPLAY_SIDE);
                if (display != image) {
                    boolean png = "image/png".equals(contentType);
                    ByteArrayOutputStream out = new ByteArrayOutputStream();
                    if (png) {
                        ImageIO.write(display, "png", out);
                    } else {
                        writeJpeg(toRgb(display), out, 0.88f);
                    }
                    content = out.toByteArray();
                    image = display;
                }
            }
            if (image != null) {
                width = image.getWidth();
                height = image.getHeight();
                // With WebP even a small picture gets a lighter copy for the catalog grid.
                if (THUMBNAILABLE.contains(contentType) && (width > thumbnailWidth || WebpEncoder.available())) {
                    Thumbnail thumbnail = renderThumbnail(image);
                    thumbnailKey = base + "_thumb." + thumbnail.extension();
                    storage.write(thumbnailKey, thumbnail.bytes());
                }
            }
        }
        storage.write(key, content);
        return new StoredFileInfo(key, thumbnailKey, sanitizeFilename(originalFilename), contentType, content.length,
                width, height);
    }

    /** Videos are streamed to storage instead of being buffered in memory; only the header is read for detection. */
    public StoredFileInfo storeVideo(String folder, InputStreamSource source, long size, String originalFilename)
            throws IOException {
        if (size <= 0) {
            throw ApiException.badRequest("empty_file", "Файл пустой");
        }
        if (size > MAX_VIDEO_BYTES) {
            throw ApiException.badRequest("file_too_large", "Видео больше 200 МБ — сожмите его или загрузите на YouTube и вставьте ссылку");
        }
        byte[] head;
        try (InputStream in = source.getInputStream()) {
            head = in.readNBytes(SNIFF_BYTES);
        }
        String contentType = detect(head, originalFilename);
        validate(MediaKind.VIDEO, contentType);
        String key = folder + "/" + UUID.randomUUID() + "." + extensionFor(contentType, originalFilename);
        try (InputStream in = source.getInputStream()) {
            storage.copyFrom(key, in);
        }
        return new StoredFileInfo(key, null, sanitizeFilename(originalFilename), contentType, size, null, null);
    }

    public String detect(byte[] content, String originalFilename) {
        String detected = tika.detect(content, originalFilename);
        if ("application/x-tika-ooxml".equals(detected) && originalFilename != null) {
            String lower = originalFilename.toLowerCase(Locale.ROOT);
            if (lower.endsWith(".docx")) {
                return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            }
            if (lower.endsWith(".xlsx")) {
                return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            }
        }
        return detected;
    }

    private void validate(MediaKind kind, String contentType) {
        boolean image = IMAGE_TYPES.contains(contentType);
        boolean ok = switch (kind) {
            case PHOTO, SCREENSHOT -> image;
            case DOCUMENT -> image || DOCUMENT_TYPES.contains(contentType);
            case VIDEO -> VIDEO_TYPES.contains(contentType);
        };
        if (!ok) {
            String allowed = switch (kind) {
                case DOCUMENT -> "PDF, DOC/DOCX, XLS/XLSX, TXT или изображения";
                case VIDEO -> "MP4, WEBM или MOV";
                default -> "JPG, PNG, WEBP или GIF";
            };
            throw ApiException.badRequest("unsupported_file_type",
                    "Неподдерживаемый тип файла (" + contentType + "). Допустимо: " + allowed);
        }
    }

    /**
     * The extension decides how the file is served (its Content-Type), so it never comes from the client's file name
     * except for office files, and then only an office extension — a "document" can never be served as HTML or SVG.
     */
    private String extensionFor(String contentType, String originalFilename) {
        String ext = EXTENSIONS.get(contentType);
        if (ext != null) {
            return ext;
        }
        if (contentType.startsWith("application/x-tika-") && originalFilename != null && originalFilename.contains(".")) {
            String candidate = originalFilename.substring(originalFilename.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
            if (OFFICE_EXTENSIONS.contains(candidate)) {
                return candidate;
            }
        }
        return "bin";
    }

    private BufferedImage readImage(byte[] content) {
        try (ImageInputStream in = ImageIO.createImageInputStream(new ByteArrayInputStream(content))) {
            Iterator<ImageReader> readers = in == null ? null : ImageIO.getImageReaders(in);
            if (readers == null || !readers.hasNext()) {
                return null;
            }
            ImageReader reader = readers.next();
            try {
                reader.setInput(in, true, true);
                long pixels = (long) reader.getWidth(0) * reader.getHeight(0);
                if (pixels > MAX_PIXELS) {
                    throw ApiException.badRequest("image_too_large",
                            "Слишком большое изображение (больше 60 мегапикселей) — уменьшите его и загрузите снова");
                }
                return reader.read(0);
            } finally {
                reader.dispose();
            }
        } catch (IOException | IllegalArgumentException | IllegalStateException ex) {
            log.debug("Could not decode image: {}", ex.getMessage());
            return null;
        }
    }

    private static BufferedImage scaleDown(BufferedImage source, int maxSide) {
        int w = source.getWidth();
        int h = source.getHeight();
        if (Math.max(w, h) <= maxSide) {
            return source;
        }
        double ratio = maxSide / (double) Math.max(w, h);
        int tw = Math.max(1, (int) Math.round(w * ratio));
        int th = Math.max(1, (int) Math.round(h * ratio));
        boolean alpha = source.getColorModel().hasAlpha();
        BufferedImage target = new BufferedImage(tw, th, alpha ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB);
        Graphics2D g = target.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g.drawImage(source, 0, 0, tw, th, null);
        } finally {
            g.dispose();
        }
        return target;
    }

    private static BufferedImage toRgb(BufferedImage image) {
        if (image.getType() == BufferedImage.TYPE_INT_RGB) {
            return image;
        }
        BufferedImage rgb = new BufferedImage(image.getWidth(), image.getHeight(), BufferedImage.TYPE_INT_RGB);
        Graphics2D g = rgb.createGraphics();
        try {
            g.drawImage(image, 0, 0, java.awt.Color.WHITE, null);
        } finally {
            g.dispose();
        }
        return rgb;
    }

    /**
     * A WebP catalog copy of an already stored picture (pictures uploaded before WebP thumbnails existed);
     * empty when the encoder is unavailable or the bytes are not a readable image.
     */
    public Optional<String> webpThumbnail(String storageKey, byte[] content) throws IOException {
        if (!WebpEncoder.available()) {
            return Optional.empty();
        }
        BufferedImage image = readImage(content);
        if (image == null) {
            return Optional.empty();
        }
        Thumbnail thumbnail = renderThumbnail(image);
        if (!"webp".equals(thumbnail.extension())) {
            return Optional.empty();
        }
        int dot = storageKey.lastIndexOf('.');
        String key = (dot > storageKey.lastIndexOf('/') ? storageKey.substring(0, dot) : storageKey) + "_thumb.webp";
        storage.write(key, thumbnail.bytes());
        return Optional.of(key);
    }

    private Thumbnail renderThumbnail(BufferedImage source) throws IOException {
        int targetWidth = Math.min(thumbnailWidth, source.getWidth());
        int targetHeight = Math.max(1, (int) Math.round(source.getHeight() * (targetWidth / (double) source.getWidth())));
        boolean alpha = source.getColorModel().hasAlpha();
        BufferedImage target = new BufferedImage(targetWidth, targetHeight,
                alpha ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB);
        Graphics2D g = target.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g.drawImage(source, 0, 0, targetWidth, targetHeight, null);
        } finally {
            g.dispose();
        }
        byte[] webp = WebpEncoder.encode(target, 0.82f);
        if (webp != null) {
            return new Thumbnail(webp, "webp");
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        if (alpha) {
            ImageIO.write(target, "png", out);
            return new Thumbnail(out.toByteArray(), "png");
        }
        writeJpeg(target, out, 0.85f);
        return new Thumbnail(out.toByteArray(), "jpg");
    }

    private static void writeJpeg(BufferedImage image, ByteArrayOutputStream out, float quality) throws IOException {
        Iterator<ImageWriter> writers = ImageIO.getImageWritersByFormatName("jpeg");
        ImageWriter writer = writers.next();
        try (ImageOutputStream ios = ImageIO.createImageOutputStream(out)) {
            writer.setOutput(ios);
            ImageWriteParam param = writer.getDefaultWriteParam();
            param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            param.setCompressionQuality(quality);
            writer.write(null, new IIOImage(image, null, null), param);
        } finally {
            writer.dispose();
        }
    }

    private static String sanitizeFilename(String filename) {
        if (filename == null || filename.isBlank()) {
            return null;
        }
        String name = filename.replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1).replaceAll("[\\r\\n\\t]", "_");
        return name.length() > 255 ? name.substring(name.length() - 255) : name;
    }

    private record Thumbnail(byte[] bytes, String extension) {
    }
}
