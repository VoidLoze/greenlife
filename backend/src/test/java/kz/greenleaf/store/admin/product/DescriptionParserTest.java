package kz.greenleaf.store.admin.product;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class DescriptionParserTest {

    @Test
    void splitsRawCatalogTextIntoCardFields() {
        String raw = "Глубоко очищает и удаляет стойкие пятна Легко смывается, не оставляет следов "
                + "Применение: добавьте 30 мл на 5 л воды. Состав: ПАВ, энзимы, отдушка. "
                + "⚠ Хранить в недоступном для детей месте";

        DescriptionParser.Parsed parsed = DescriptionParser.parse(raw, "iLiFE Гель для стирки, 1 кг");

        assertThat(parsed.benefits()).containsExactly(
                "Глубоко очищает и удаляет стойкие пятна", "Легко смывается, не оставляет следов");
        assertThat(parsed.usage()).startsWith("Добавьте 30 мл");
        assertThat(parsed.composition()).startsWith("ПАВ, энзимы");
        assertThat(parsed.warnings()).contains("Хранить в недоступном");
        assertThat(parsed.volume()).isEqualTo("1 кг");
        assertThat(parsed.summary()).startsWith("Глубоко очищает");
        assertThat(parsed.attributes()).anySatisfy(a -> assertThat(a.nameRu()).isEqualTo("Объём / вес"));
    }

    @Test
    void handlesEmptyInput() {
        DescriptionParser.Parsed parsed = DescriptionParser.parse("  ", null);
        assertThat(parsed.benefits()).isEmpty();
        assertThat(parsed.summary()).isNull();
        assertThat(parsed.attributes()).isEmpty();
    }
}
