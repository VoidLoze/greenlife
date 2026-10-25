package kz.greenleaf.store.media;

import java.awt.Graphics2D;
import java.awt.geom.AffineTransform;
import java.awt.image.BufferedImage;

/**
 * Phones store photos sideways and only mark the intended rotation in EXIF; Java's image decoder ignores that mark,
 * so without this a portrait product photo would be shown lying on its side.
 */
final class ExifOrientation {

    private ExifOrientation() {
    }

    /** The EXIF orientation (1–8) of a JPEG, or 1 when absent or unreadable. */
    static int read(byte[] jpeg) {
        try {
            if (jpeg.length < 4 || (jpeg[0] & 0xFF) != 0xFF || (jpeg[1] & 0xFF) != 0xD8) {
                return 1;
            }
            int pos = 2;
            while (pos + 4 < jpeg.length) {
                if ((jpeg[pos] & 0xFF) != 0xFF) {
                    return 1;
                }
                int marker = jpeg[pos + 1] & 0xFF;
                int length = ((jpeg[pos + 2] & 0xFF) << 8) | (jpeg[pos + 3] & 0xFF);
                if (marker == 0xDA || length < 2) {
                    return 1;
                }
                if (marker == 0xE1 && pos + 10 < jpeg.length && jpeg[pos + 4] == 'E' && jpeg[pos + 5] == 'x'
                        && jpeg[pos + 6] == 'i' && jpeg[pos + 7] == 'f') {
                    return fromTiff(jpeg, pos + 10, Math.min(jpeg.length, pos + 2 + length));
                }
                pos += 2 + length;
            }
        } catch (RuntimeException ignored) {
            // A malformed header simply means "no rotation".
        }
        return 1;
    }

    private static int fromTiff(byte[] b, int tiff, int end) {
        boolean little = b[tiff] == 'I' && b[tiff + 1] == 'I';
        int ifd = tiff + (int) u32(b, tiff + 4, little);
        if (ifd + 2 > end) {
            return 1;
        }
        int entries = u16(b, ifd, little);
        for (int i = 0; i < entries; i++) {
            int entry = ifd + 2 + i * 12;
            if (entry + 12 > end) {
                return 1;
            }
            if (u16(b, entry, little) == 0x0112) {
                int value = u16(b, entry + 8, little);
                return value >= 1 && value <= 8 ? value : 1;
            }
        }
        return 1;
    }

    private static int u16(byte[] b, int i, boolean little) {
        return little ? (b[i] & 0xFF) | ((b[i + 1] & 0xFF) << 8) : ((b[i] & 0xFF) << 8) | (b[i + 1] & 0xFF);
    }

    private static long u32(byte[] b, int i, boolean little) {
        return little
                ? (b[i] & 0xFFL) | ((b[i + 1] & 0xFFL) << 8) | ((b[i + 2] & 0xFFL) << 16) | ((b[i + 3] & 0xFFL) << 24)
                : ((b[i] & 0xFFL) << 24) | ((b[i + 1] & 0xFFL) << 16) | ((b[i + 2] & 0xFFL) << 8) | (b[i + 3] & 0xFFL);
    }

    /** Returns the image turned upright; the same instance when no rotation is needed. */
    static BufferedImage apply(BufferedImage src, int orientation) {
        if (orientation <= 1 || orientation > 8) {
            return src;
        }
        int w = src.getWidth();
        int h = src.getHeight();
        boolean swap = orientation >= 5;
        AffineTransform t = new AffineTransform();
        switch (orientation) {
            case 2 -> { t.translate(w, 0); t.scale(-1, 1); }
            case 3 -> { t.translate(w, h); t.rotate(Math.PI); }
            case 4 -> { t.translate(0, h); t.scale(1, -1); }
            case 5 -> { t.rotate(Math.PI / 2); t.scale(1, -1); }
            case 6 -> { t.translate(h, 0); t.rotate(Math.PI / 2); }
            case 7 -> { t.scale(-1, 1); t.translate(-h, 0); t.translate(0, w); t.rotate(3 * Math.PI / 2); }
            case 8 -> { t.translate(0, w); t.rotate(3 * Math.PI / 2); }
            default -> { }
        }
        BufferedImage out = new BufferedImage(swap ? h : w, swap ? w : h,
                src.getColorModel().hasAlpha() ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics();
        try {
            g.drawImage(src, t, null);
        } finally {
            g.dispose();
        }
        return out;
    }
}
