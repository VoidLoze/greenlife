package kz.greenleaf.store.favorites;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.stream.LongStream;
import org.junit.jupiter.api.Test;

class FavoritesListsTest {

    @Test
    void normalizeDropsDuplicatesAndInvalidIdsKeepingOrder() {
        var lists = FavoritesService.normalize(List.of(5L, 3L, 5L, 0L, -1L, 7L), List.of(2L, 2L, 9L));
        assertThat(lists.favorites()).containsExactly(5L, 3L, 7L);
        assertThat(lists.viewed()).containsExactly(2L, 9L);
    }

    @Test
    void normalizeCapsBothLists() {
        List<Long> many = LongStream.rangeClosed(1, 100).boxed().toList();
        var lists = FavoritesService.normalize(many, many);
        assertThat(lists.favorites()).hasSize(FavoritesService.MAX_FAVORITES).startsWith(1L, 2L);
        assertThat(lists.viewed()).hasSize(FavoritesService.MAX_VIEWED);
    }

    @Test
    void parseSkipsCorruptedEntries() {
        assertThat(FavoritesService.parse("4,x,8, 15")).containsExactly(4L, 8L, 15L);
        assertThat(FavoritesService.parse("")).isEmpty();
        assertThat(FavoritesService.parse(null)).isEmpty();
    }
}
