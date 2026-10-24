package kz.greenleaf.store.common;

public final class Phones {

    private Phones() {
    }

    /** Normalizes Kazakhstan/Russia numbers to +7XXXXXXXXXX; returns null for invalid input. */
    public static String normalize(String raw) {
        if (raw == null) {
            return null;
        }
        String digits = raw.replaceAll("\\D", "");
        if (digits.length() == 11 && digits.startsWith("8")) {
            digits = "7" + digits.substring(1);
        } else if (digits.length() == 10) {
            digits = "7" + digits;
        }
        if (digits.length() != 11 || !digits.startsWith("7")) {
            return null;
        }
        return "+" + digits;
    }

    public static String normalizeOrThrow(String raw) {
        String normalized = normalize(raw);
        if (normalized == null) {
            throw ApiException.badRequest("invalid_phone", "Укажите номер телефона в формате +7 XXX XXX XX XX");
        }
        return normalized;
    }
}
