package kz.greenleaf.store.admin.product;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class StockMergeTest {

    @Test
    void salesWhileEditingAreNotWrittenBack() {
        // Opened with 10, two units sold meanwhile (8 left), admin typed 15 (+5).
        assertThat(AdminProductService.mergeStock(8, 10, 15)).isEqualTo(13);
    }

    @Test
    void untouchedStockKeepsCurrentValue() {
        assertThat(AdminProductService.mergeStock(7, 10, 10)).isEqualTo(7);
    }

    @Test
    void neverGoesBelowZero() {
        assertThat(AdminProductService.mergeStock(1, 10, 0)).isZero();
    }

    @Test
    void withoutBaseTheRequestedValueWins() {
        assertThat(AdminProductService.mergeStock(8, null, 15)).isEqualTo(15);
        assertThat(AdminProductService.mergeStock(null, 10, 15)).isEqualTo(15);
    }

    @Test
    void clearingStockMeansNotTracked() {
        assertThat(AdminProductService.mergeStock(8, 10, null)).isNull();
    }
}
