package kz.greenleaf.store.order;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class TrackingMaskTest {

    @Test
    void nameKeepsOnlyFirstLetterOfFirstWord() {
        assertThat(OrderMapper.maskName("Айгерим Сапарова")).isEqualTo("А******");
        assertThat(OrderMapper.maskName("Ли")).isEqualTo("Л*");
        assertThat(OrderMapper.maskName("Я")).isEqualTo("Я");
        assertThat(OrderMapper.maskName(null)).isNull();
    }

    @Test
    void emailHidesLocalPart() {
        assertThat(OrderMapper.maskEmail("aigerim@mail.kz")).isEqualTo("a***@mail.kz");
        assertThat(OrderMapper.maskEmail("a@mail.kz")).isEqualTo("***@mail.kz");
        assertThat(OrderMapper.maskEmail(null)).isNull();
    }

    @Test
    void addressShowsOnlyBeginning() {
        assertThat(OrderMapper.maskTail("ул. Абая 150, кв. 12")).isEqualTo("ул. ***");
        assertThat(OrderMapper.maskTail("12")).isEqualTo("***");
    }
}
