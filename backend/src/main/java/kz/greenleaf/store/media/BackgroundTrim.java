package kz.greenleaf.store.media;

import java.awt.image.BufferedImage;

/**
 * Cuts the empty background around a product photo, so the product fills its card instead of floating in margins.
 * The background is taken from the corners: either transparent, or one plain light colour. A photo whose corners
 * disagree (a real scene) is left as it is.
 */
final class BackgroundTrim {

    private static final int ALPHA_SOLID = 24;
    /** Sum of |ΔR|+|ΔG|+|ΔB| a pixel must differ from a plain background by to count as the product. */
    private static final int COLOR_DISTANCE = 42;
    private static final int CORNER_TOLERANCE = 30;
    private static final int LIGHT_BACKGROUND = 200;
    /** Breathing room kept around the product, as a share of its longer side. */
    private static final double PADDING = 0.04;
    /** Not worth a new picture when the margins are thinner than this share of the area. */
    private static final double MIN_GAIN = 0.1;

    private BackgroundTrim() {
    }

    static BufferedImage trim(BufferedImage image) {
        int w = image.getWidth();
        int h = image.getHeight();
        if (w < 16 || h < 16) {
            return image;
        }
        int[] px = image.getRGB(0, 0, w, h, null, 0, w);
        int[] corners = {px[0], px[w - 1], px[(h - 1) * w], px[h * w - 1]};
        boolean transparent = true;
        for (int c : corners) {
            transparent &= (c >>> 24) < ALPHA_SOLID;
        }
        int bg = corners[0];
        if (!transparent) {
            for (int c : corners) {
                if ((c >>> 24) < ALPHA_SOLID || distance(c, bg) > CORNER_TOLERANCE) {
                    return image;
                }
            }
            if (brightness(bg) < LIGHT_BACKGROUND) {
                return image;
            }
        }

        int[] rows = new int[h];
        int[] cols = new int[w];
        for (int y = 0; y < h; y++) {
            int offset = y * w;
            for (int x = 0; x < w; x++) {
                int p = px[offset + x];
                boolean product = (p >>> 24) >= ALPHA_SOLID && (transparent || distance(p, bg) > COLOR_DISTANCE);
                if (product) {
                    rows[y]++;
                    cols[x]++;
                }
            }
        }
        // A few stray specks (dust, compression noise) must not hold the frame open.
        int minRow = Math.max(1, w / 200);
        int minCol = Math.max(1, h / 200);
        int top = first(rows, minRow);
        int left = first(cols, minCol);
        if (top < 0 || left < 0) {
            return image;
        }
        int bottom = last(rows, minRow);
        int right = last(cols, minCol);

        int pad = (int) Math.round(Math.max(right - left + 1, bottom - top + 1) * PADDING);
        left = Math.max(0, left - pad);
        top = Math.max(0, top - pad);
        right = Math.min(w - 1, right + pad);
        bottom = Math.min(h - 1, bottom + pad);
        int cw = right - left + 1;
        int ch = bottom - top + 1;
        if ((double) cw * ch > (1 - MIN_GAIN) * w * h) {
            return image;
        }
        return image.getSubimage(left, top, cw, ch);
    }

    private static int first(int[] counts, int min) {
        for (int i = 0; i < counts.length; i++) {
            if (counts[i] >= min) {
                return i;
            }
        }
        return -1;
    }

    private static int last(int[] counts, int min) {
        for (int i = counts.length - 1; i >= 0; i--) {
            if (counts[i] >= min) {
                return i;
            }
        }
        return -1;
    }

    private static int distance(int a, int b) {
        return Math.abs(((a >> 16) & 0xff) - ((b >> 16) & 0xff))
                + Math.abs(((a >> 8) & 0xff) - ((b >> 8) & 0xff))
                + Math.abs((a & 0xff) - (b & 0xff));
    }

    private static int brightness(int c) {
        return (((c >> 16) & 0xff) + ((c >> 8) & 0xff) + (c & 0xff)) / 3;
    }
}
