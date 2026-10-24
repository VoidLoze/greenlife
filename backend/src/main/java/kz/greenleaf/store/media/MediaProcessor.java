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
import java.util.Set;
import java.util.UUID;
import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
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
            if (image != null) {
                width = image.getWidth();
                height = image.getHeight();
                if (THUMBNAILABLE.contains(contentType) && width > thumbnailWidth) {
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

    private String extensionFor(String contentType, String originalFilename) {
        String ext = EXTENSIONS.get(contentType);
        if (ext != null) {
            return ext;
        }
        if (originalFilename != null && originalFilename.contains(".")) {
            String candidate = originalFilename.substring(originalFilename.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
            if (candidate.matches("[a-z0-9]{1,5}")) {
                return candidate;
            }
        }
        return "bin";
    }

    private BufferedImage readImage(byte[] content) {
        try {
            return ImageIO.read(new ByteArrayInputStream(content));
        } catch (IOException | RuntimeException ex) {
            log.debug("Could not decode image: {}", ex.getMessage());
            return null;
        }
    }

    private Thumbnail renderThumbnail(BufferedImage source) throws IOException {
        int targetWidth = thumbnailWidth;
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
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        if (alpha) {
            ImageIO.write(target, "png", out);
            return new Thumbnail(out.toByteArray(), "png");
        }
        writeJpeg(target, out);
        return new Thumbnail(out.toByteArray(), "jpg");
    }

    private static void writeJpeg(BufferedImage image, ByteArrayOutputStream out) throws IOException {
        Iterator<ImageWriter> writers = ImageIO.getImageWritersByFormatName("jpeg");
        ImageWriter writer = writers.next();
        try (ImageOutputStream ios = ImageIO.createImageOutputStream(out)) {
            writer.setOutput(ios);
            ImageWriteParam param = writer.getDefaultWriteParam();
            param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            param.setCompressionQuality(0.85f);
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
