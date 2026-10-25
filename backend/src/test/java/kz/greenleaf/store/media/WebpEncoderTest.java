package kz.greenleaf.store.media;

import static org.assertj.core.api.Assertions.assertThat;

import java.awt.Color;
import java.awt.image.BufferedImage;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class WebpEncoderTest {

    @Test
    void encodesTransparentPictureAsWebp() {
        BufferedImage image = new BufferedImage(64, 48, BufferedImage.TYPE_INT_ARGB);
        image.setRGB(10, 10, Color.GREEN.getRGB());
        assertThat(WebpEncoder.available()).isTrue();
        byte[] webp = WebpEncoder.encode(image, 0.8f);
        assertThat(webp).isNotNull();
        assertThat(new String(webp, 0, 4, StandardCharsets.US_ASCII)).isEqualTo("RIFF");
        assertThat(new String(webp, 8, 4, StandardCharsets.US_ASCII)).isEqualTo("WEBP");
    }
}
