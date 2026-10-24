package kz.greenleaf.store.catalog.search;

import java.util.Locale;

public enum SortOption {
    RELEVANCE,
    POPULAR,
    PRICE_ASC,
    PRICE_DESC,
    NEWEST,
    NAME;

    public static SortOption parse(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return SortOption.valueOf(value.trim().toUpperCase(Locale.ROOT).replace('-', '_'));
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }
}
