package kz.greenleaf.store.catalog.search;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

class SearchTextTest {

    @Test
    void fixesWrongKeyboardLayout() {
        assertThat(KeyboardLayout.latinToCyrillic("ifvgeym")).isEqualTo("шампунь");
        assertThat(KeyboardLayout.latinToCyrillic("utkm")).isEqualTo("гель");
    }

    @Test
    void leavesCyrillicAndEmptyInputAlone() {
        assertThat(KeyboardLayout.latinToCyrillic("шампунь")).isNull();
        assertThat(KeyboardLayout.latinToCyrillic("  ")).isNull();
        assertThat(KeyboardLayout.latinToCyrillic("123")).isNull();
    }

    @Test
    void buildsSafePrefixTsQuery() {
        assertThat(ProductSearchRepository.prefixTsQuery("гель стир")).isEqualTo("гель:* & стир:*");
        assertThat(ProductSearchRepository.prefixTsQuery("a & b | !c")).isNull();
        assertThat(ProductSearchRepository.prefixTsQuery("порошок') or 1=1 --")).doesNotContain("'", ")", "=");
    }

    @Test
    void productQueryNormalizesInput() {
        ProductQuery query = new ProductQuery("  гель   для   стирки ", List.of("laundry", " ", "laundry"),
                List.of("Laundry-Gels,laundry-powders", "laundry-gels"), null, null, null, false, false, null, -3, 500);
        assertThat(query.text()).isEqualTo("гель для стирки");
        assertThat(query.types()).containsExactly("laundry-gels", "laundry-powders");
        assertThat(query.page()).isZero();
        assertThat(query.size()).isLessThanOrEqualTo(ProductQuery.MAX_PAGE_SIZE);
        assertThat(query.cacheKey()).isEqualTo(new ProductQuery("гель для стирки", List.of("laundry"),
                List.of("laundry-powders", "laundry-gels"), null, null, null, false, false, null, 0, 500).cacheKey());
    }

    @Test
    void typeFilterChangesCacheKey() {
        ProductQuery plain = new ProductQuery(null, List.of("hair-care"), null, null, null, null, false, false, null, 0, 24);
        ProductQuery typed = new ProductQuery(null, List.of("hair-care"), List.of("shampoos"), null, null, null, false,
                false, null, 0, 24);
        assertThat(plain.cacheKey()).isNotEqualTo(typed.cacheKey());
    }

    @Test
    void wordStartPatternsFollowTokens() {
        assertThat(ProductSearchRepository.wordStartTokens("Шам  крем-маска"))
                .containsExactly("шам", "крем", "маска");
        assertThat(ProductSearchRepository.wordStartTokens("% _")).isEmpty();
        assertThat(ProductSearchRepository.wordStartTokens("Ш")).containsExactly("ш");
        assertThat(ProductSearchRepository.wordStartTokens("ш крем")).containsExactly("крем");
    }

    @Test
    void parsesSortOptions() {
        assertThat(SortOption.parse("price_asc")).isEqualTo(SortOption.PRICE_ASC);
        assertThat(SortOption.parse(null)).isNull();
    }
}
