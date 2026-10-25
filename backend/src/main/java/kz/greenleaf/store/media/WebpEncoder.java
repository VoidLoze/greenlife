package kz.greenleaf.store.media;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.Iterator;
import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageOutputStream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Lossy WebP with transparency kept. The encoder is a native library; where it cannot load, callers fall back to
 * PNG/JPEG and the site keeps working, only with heavier pictures.
 */
final class WebpEncoder {

    private static final Logger log = LoggerFactory.getLogger(WebpEncoder.class);
    private static volatile Boolean available;

    private WebpEncoder() {
    }

    static boolean available() {
        Boolean known = available;
        if (known == null) {
            known = encode(new BufferedImage(2, 2, BufferedImage.TYPE_INT_ARGB), 0.8f, false) != null;
            available = known;
            if (!known) {
                log.warn("WebP encoder is not available; thumbnails are stored as PNG/JPEG");
            }
        }
        return known;
    }

    /** Null when WebP cannot be written here. */
    static byte[] encode(BufferedImage image, float quality) {
        return available() ? encode(image, quality, true) : null;
    }

    private static byte[] encode(BufferedImage image, float quality, boolean logFailure) {
        try {
            Iterator<ImageWriter> writers = ImageIO.getImageWritersByMIMEType("image/webp");
            if (!writers.hasNext()) {
                return null;
            }
            ImageWriter writer = writers.next();
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            try (ImageOutputStream ios = ImageIO.createImageOutputStream(out)) {
                writer.setOutput(ios);
                ImageWriteParam param = writer.getDefaultWriteParam();
                param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
                for (String type : param.getCompressionTypes()) {
                    if (type.toLowerCase(java.util.Locale.ROOT).startsWith("lossy")) {
                        param.setCompressionType(type);
                    }
                }
                param.setCompressionQuality(quality);
                writer.write(null, new IIOImage(image, null, null), param);
            } finally {
                writer.dispose();
            }
            return out.toByteArray();
        } catch (Exception | LinkageError ex) {
            if (logFailure) {
                log.warn("WebP encoding failed: {}", ex.toString());
            }
            return null;
        }
    }
}
