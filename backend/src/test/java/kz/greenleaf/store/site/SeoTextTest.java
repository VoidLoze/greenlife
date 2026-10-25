package kz.greenleaf.store.site;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class SeoTextTest {

    @Test
    void moneyGroupsThousandsWithNonBreakingSpace() {
        assertThat(SeoPages.money(new BigDecimal("7600"))).isEqualTo("7\u00a0600");
        assertThat(SeoPages.money(new BigDecimal("800.00"))).isEqualTo("800");
        assertThat(SeoPages.money(new BigDecimal("1234567.5"))).isEqualTo("1\u00a0234\u00a0568");
    }

    @Test
    void russianPlural() {
        assertThat(SeoPages.plural(1, "товар", "товара", "товаров")).isEqualTo("товар");
        assertThat(SeoPages.plural(3, "товар", "товара", "товаров")).isEqualTo("товара");
        assertThat(SeoPages.plural(11, "товар", "товара", "товаров")).isEqualTo("товаров");
        assertThat(SeoPages.plural(21, "товар", "товара", "товаров")).isEqualTo("товар");
        assertThat(SeoPages.plural(30, "товар", "товара", "товаров")).isEqualTo("товаров");
    }

    @Test
    void clipFlattensWhitespaceAndShortens() {
        assertThat(SeoPages.clip("  Мягко\n\nочищает  ", 100)).isEqualTo("Мягко очищает");
        assertThat(SeoPages.clip("абвгдежзик", 5)).isEqualTo("абвг…");
    }
}
