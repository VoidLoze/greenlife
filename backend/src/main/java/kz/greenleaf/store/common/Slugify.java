package kz.greenleaf.store.common;

import java.util.Locale;
import java.util.Map;

public final class Slugify {

    private static final Map<Character, String> CYRILLIC = Map.ofEntries(
            Map.entry('а', "a"), Map.entry('б', "b"), Map.entry('в', "v"), Map.entry('г', "g"), Map.entry('д', "d"),
            Map.entry('е', "e"), Map.entry('ё', "e"), Map.entry('ж', "zh"), Map.entry('з', "z"), Map.entry('и', "i"),
            Map.entry('й', "y"), Map.entry('к', "k"), Map.entry('л', "l"), Map.entry('м', "m"), Map.entry('н', "n"),
            Map.entry('о', "o"), Map.entry('п', "p"), Map.entry('р', "r"), Map.entry('с', "s"), Map.entry('т', "t"),
            Map.entry('у', "u"), Map.entry('ф', "f"), Map.entry('х', "h"), Map.entry('ц', "ts"), Map.entry('ч', "ch"),
            Map.entry('ш', "sh"), Map.entry('щ', "sch"), Map.entry('ъ', ""), Map.entry('ы', "y"), Map.entry('ь', ""),
            Map.entry('э', "e"), Map.entry('ю', "yu"), Map.entry('я', "ya"),
            Map.entry('ә', "a"), Map.entry('ғ', "g"), Map.entry('қ', "k"), Map.entry('ң', "n"), Map.entry('ө', "o"),
            Map.entry('ұ', "u"), Map.entry('ү', "u"), Map.entry('һ', "h"), Map.entry('і', "i"));

    private static final int MAX_LENGTH = 120;

    private Slugify() {
    }

    public static String slugify(String input) {
        if (input == null || input.isBlank()) {
            return "item";
        }
        StringBuilder out = new StringBuilder(input.length());
        for (char ch : input.toLowerCase(Locale.ROOT).toCharArray()) {
            String mapped = CYRILLIC.get(ch);
            if (mapped != null) {
                out.append(mapped);
            } else if ((ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9')) {
                out.append(ch);
            } else {
                out.append('-');
            }
        }
        String slug = out.toString().replaceAll("-{2,}", "-").replaceAll("^-|-$", "");
        if (slug.length() > MAX_LENGTH) {
            slug = slug.substring(0, MAX_LENGTH).replaceAll("-[^-]*$", "");
        }
        return slug.isEmpty() ? "item" : slug;
    }
}
