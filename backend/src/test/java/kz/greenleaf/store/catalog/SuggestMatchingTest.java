package kz.greenleaf.store.catalog;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

class SuggestMatchingTest {

    @Test
    void everyTypedWordMustStartAWord() {
        assertThat(CatalogService.matchesWords("Шампуни", "шам")).isTrue();
        assertThat(CatalogService.matchesWords("Уход за волосами", "уход вол")).isTrue();
        assertThat(CatalogService.matchesWords("Гели и муссы для душа", "душ гел")).isTrue();
    }

    @Test
    void ignoresMatchesInsideWordsAndTooShortInput() {
        assertThat(CatalogService.matchesWords("Шампуни", "мпун")).isFalse();
        assertThat(CatalogService.matchesWords("Уход за волосами", "уход лицо")).isFalse();
        assertThat(CatalogService.matchesWords("Мыло", "м")).isFalse();
        assertThat(CatalogService.matchesWords(null, "мыло")).isFalse();
    }

    @Test
    void matchNamesKeepsCatalogOrderAndLimit() {
        record Named(String ru) {
        }
        List<Named> all = List.of(new Named("Шампуни"), new Named("Маски для волос"), new Named("Шампуни детские"),
                new Named("Шариковые дезодоранты"));

        assertThat(CatalogService.matchNames(all, Named::ru, "шам", 4))
                .extracting(Named::ru).containsExactly("Шампуни", "Шампуни детские");
        assertThat(CatalogService.matchNames(all, Named::ru, "ша", 2))
                .extracting(Named::ru).containsExactly("Шампуни", "Шампуни детские");
    }
}
