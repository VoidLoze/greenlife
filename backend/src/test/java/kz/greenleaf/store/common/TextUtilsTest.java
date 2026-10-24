package kz.greenleaf.store.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class TextUtilsTest {

    @ParameterizedTest
    @CsvSource({
            "'iLiFE Гель для стирки, 1 кг', ilife-gel-dlya-stirki-1-kg",
            "'Шампунь  «Жемчуг»!!', shampun-zhemchug",
            "'Қазақ тілі', kazak-tili",
            "'   ', item",
            "'---', item"
    })
    void slugifyTransliteratesAndCollapsesSeparators(String input, String expected) {
        assertThat(Slugify.slugify(input)).isEqualTo(expected);
    }

    @Test
    void slugifyCutsOnWordBoundary() {
        String slug = Slugify.slugify("очень ".repeat(40));
        assertThat(slug.length()).isLessThanOrEqualTo(120);
        assertThat(slug).doesNotEndWith("-");
    }

    @ParameterizedTest
    @CsvSource({
            "'+7 707 617 39 28', +77076173928",
            "'8 (707) 617-39-28', +77076173928",
            "'7076173928', +77076173928",
            "'77076173928', +77076173928"
    })
    void normalizesKazakhPhones(String input, String expected) {
        assertThat(Phones.normalize(input)).isEqualTo(expected);
    }

    @Test
    void rejectsInvalidPhones() {
        assertThat(Phones.normalize("12345")).isNull();
        assertThat(Phones.normalize("+1 202 555 0143")).isNull();
        assertThatThrownBy(() -> Phones.normalizeOrThrow("abc"))
                .isInstanceOf(ApiException.class)
                .hasFieldOrPropertyWithValue("code", "invalid_phone");
    }
}
