package kz.greenleaf.store.catalog.search;

import java.util.HashMap;
import java.util.Map;

/** Fixes text typed with the wrong keyboard layout: "ifvgeym" → "шампунь". */
public final class KeyboardLayout {

    private static final String LATIN = "qwertyuiop[]asdfghjkl;'zxcvbnm,.`";
    private static final String CYRILLIC = "йцукенгшщзхъфывапролджэячсмитьбюё";
    private static final Map<Character, Character> LATIN_TO_CYRILLIC = new HashMap<>();

    static {
        for (int i = 0; i < LATIN.length(); i++) {
            LATIN_TO_CYRILLIC.put(LATIN.charAt(i), CYRILLIC.charAt(i));
            LATIN_TO_CYRILLIC.put(Character.toUpperCase(LATIN.charAt(i)), Character.toUpperCase(CYRILLIC.charAt(i)));
        }
    }

    private KeyboardLayout() {
    }

    /** Returns the converted text, or null when the input does not look like mistyped Russian. */
    public static String latinToCyrillic(String input) {
        if (input == null || input.isBlank()) {
            return null;
        }
        int letters = 0;
        int latin = 0;
        StringBuilder out = new StringBuilder(input.length());
        for (char ch : input.toCharArray()) {
            if (Character.isLetter(ch)) {
                letters++;
                if (ch < 128) {
                    latin++;
                }
            }
            Character mapped = LATIN_TO_CYRILLIC.get(ch);
            out.append(mapped != null ? mapped : ch);
        }
        if (letters == 0 || latin < letters) {
            return null;
        }
        String converted = out.toString();
        return converted.equals(input) ? null : converted;
    }
}
