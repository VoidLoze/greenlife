package kz.greenleaf.store.media;

import static org.assertj.core.api.Assertions.assertThat;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import org.junit.jupiter.api.Test;

class BackgroundTrimTest {

    private static BufferedImage withProduct(int type, Color background) {
        BufferedImage image = new BufferedImage(400, 400, type);
        Graphics2D g = image.createGraphics();
        try {
            if (background != null) {
                g.setColor(background);
                g.fillRect(0, 0, 400, 400);
            }
            g.setColor(new Color(220, 120, 160));
            g.fillRect(150, 80, 100, 240);
        } finally {
            g.dispose();
        }
        return image;
    }

    @Test
    void cutsTransparentMarginsKeepingSomeRoom() {
        BufferedImage trimmed = BackgroundTrim.trim(withProduct(BufferedImage.TYPE_INT_ARGB, null));
        // 240 px tall product plus 4% of it on each side.
        assertThat(trimmed.getHeight()).isEqualTo(240 + 2 * 10);
        assertThat(trimmed.getWidth()).isEqualTo(100 + 2 * 10);
    }

    @Test
    void cutsPlainWhiteBackground() {
        BufferedImage trimmed = BackgroundTrim.trim(withProduct(BufferedImage.TYPE_INT_RGB, Color.WHITE));
        assertThat(trimmed.getWidth()).isEqualTo(120);
        assertThat(trimmed.getHeight()).isEqualTo(260);
    }

    @Test
    void leavesRealScenesAlone() {
        BufferedImage scene = withProduct(BufferedImage.TYPE_INT_RGB, Color.WHITE);
        scene.setRGB(0, 0, Color.DARK_GRAY.getRGB());
        assertThat(BackgroundTrim.trim(scene)).isSameAs(scene);

        BufferedImage dark = withProduct(BufferedImage.TYPE_INT_RGB, new Color(30, 60, 40));
        assertThat(BackgroundTrim.trim(dark)).isSameAs(dark);
    }

    @Test
    void ignoresStraySpecks() {
        BufferedImage image = withProduct(BufferedImage.TYPE_INT_ARGB, null);
        image.setRGB(5, 390, Color.BLACK.getRGB());
        assertThat(BackgroundTrim.trim(image).getHeight()).isEqualTo(260);
    }
}
