package kz.greenleaf.store.admin.product;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import kz.greenleaf.store.catalog.dto.CatalogDtos.AttributeDto;

/**
 * Turns a raw marketing description (as pasted from a printed catalog) into structured product card fields:
 * a short summary, benefit bullets, usage, composition, warnings and detected attributes.
 */
public final class DescriptionParser {

    private static final Pattern SENTENCE_SPLIT =
            Pattern.compile("(?<=[а-яёa-zA-Z0-9%)»\".!°])\\s+(?=[А-ЯЁ][а-яё])|\\s+(?=⚠)|(?<=[.!?])\\s+(?=[A-ZА-ЯЁ])");
    private static final Pattern VOLUME = Pattern.compile("(\\d+(?:[.,]\\d+)?)\\s*(кг|мл|г|л)\\.?(?![а-яё])",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    private static final Pattern PIECES = Pattern.compile("(\\d+)\\s*(?:шт|штук|пакетик\\S*|капсул\\S*|таблет\\S*)",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    private static final Pattern AGE = Pattern.compile("(?:для детей|от)\\s*(\\d+(?:\\s*[-–]\\s*\\d+)?)\\s*(?:лет|года|мес)",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    private static final List<String> USAGE = List.of("применение:", "способ применения:", "рекомендация:", "рекомендация.",
            "как использовать:");
    private static final List<String> COMPOSITION = List.of("состав:", "основные ингредиенты:", "активные ингредиенты:",
            "ингредиенты:");
    private static final List<String> WARNINGS = List.of("⚠", "внимание:", "не использовать", "не смывать",
            "не подходит", "противопоказания:", "меры предосторожности:");
    private static final int MAX_BENEFITS = 12;
    private static final int SUMMARY_LIMIT = 180;

    private DescriptionParser() {
    }

    public static Parsed parse(String raw, String productName) {
        String text = raw == null ? "" : raw.replaceAll("\\s+", " ").trim();
        List<String> benefits = new ArrayList<>();
        List<String> usage = new ArrayList<>();
        List<String> composition = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        for (String sentence : SENTENCE_SPLIT.split(text)) {
            String s = sentence.strip().replaceAll("[.\\s]+$", "");
            if (s.isEmpty()) {
                continue;
            }
            String lower = s.toLowerCase(Locale.ROOT);
            if (startsWithAny(lower, USAGE)) {
                usage.add(afterColon(s));
            } else if (startsWithAny(lower, COMPOSITION)) {
                composition.add(afterColon(s));
            } else if (startsWithAny(lower, WARNINGS)) {
                warnings.add(afterColon(s.replace("⚠", "").strip()));
            } else if (benefits.size() < MAX_BENEFITS) {
                benefits.add(capitalize(s));
            }
        }

        String source = (productName == null ? "" : productName) + " " + text;
        List<AttributeDto> attributes = new ArrayList<>();
        String volume = null;
        Matcher volumeMatch = VOLUME.matcher(source);
        if (volumeMatch.find()) {
            volume = volumeMatch.group(1) + " " + volumeMatch.group(2).toLowerCase(Locale.ROOT);
            attributes.add(new AttributeDto("Объём / вес", volume, "Көлемі / салмағы", volume));
        }
        Matcher pieces = PIECES.matcher(source);
        if (pieces.find()) {
            attributes.add(new AttributeDto("Количество в упаковке", pieces.group(1) + " шт.", "Қаптамадағы саны",
                    pieces.group(1) + " дана"));
        }
        Matcher age = AGE.matcher(text);
        if (age.find()) {
            String value = age.group(1).replaceAll("\\s", "");
            attributes.add(new AttributeDto("Возраст", "от " + value + " лет", "Жасы", value + " жастан бастап"));
        }

        return new Parsed(summarize(benefits, text), List.copyOf(benefits), join(usage), join(composition),
                join(warnings), List.copyOf(attributes), volume);
    }

    private static String summarize(List<String> benefits, String fallback) {
        String source = benefits.isEmpty() ? fallback : String.join(". ", benefits.subList(0, Math.min(2, benefits.size())));
        if (source.isBlank()) {
            return null;
        }
        if (source.length() <= SUMMARY_LIMIT) {
            return source.endsWith(".") ? source : source + ".";
        }
        String cut = source.substring(0, SUMMARY_LIMIT - 1);
        int space = cut.lastIndexOf(' ');
        return (space > 40 ? cut.substring(0, space) : cut) + "…";
    }

    private static boolean startsWithAny(String value, List<String> prefixes) {
        return prefixes.stream().anyMatch(value::startsWith);
    }

    private static String afterColon(String value) {
        int idx = value.indexOf(':');
        return capitalize(idx >= 0 ? value.substring(idx + 1).strip() : value);
    }

    private static String capitalize(String value) {
        if (value.isEmpty()) {
            return value;
        }
        return Character.toUpperCase(value.charAt(0)) + value.substring(1);
    }

    private static String join(List<String> parts) {
        return parts.isEmpty() ? null : String.join(". ", parts) + ".";
    }

    public record Parsed(String summary, List<String> benefits, String usage, String composition, String warnings,
                         List<AttributeDto> attributes, String volume) {
    }
}
