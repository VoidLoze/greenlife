package kz.greenleaf.store.auth;

import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.regex.Pattern;

/** One password policy for registration, password change, admin resets and the bootstrap administrator. */
public final class Passwords {

    public static final String REGEX = "^(?=.*[A-Za-zА-Яа-яЁё])(?=.*\\d).{8,72}$";
    public static final String MESSAGE = "Пароль: от 8 символов, минимум одна буква и одна цифра";
    /** BCrypt ignores (Spring Security rejects) anything past 72 bytes; a Cyrillic letter takes two. */
    public static final int MAX_BYTES = 72;

    private static final Pattern PATTERN = Pattern.compile(REGEX);
    private static final Set<String> KNOWN_DEFAULTS = Set.of("admin12345", "admin123", "password1", "12345678a",
            "change-me", "changeme1", "qwerty123");

    private Passwords() {
    }

    public static boolean acceptable(String password) {
        return password != null && PATTERN.matcher(password).matches() && fitsBcrypt(password);
    }

    public static boolean fitsBcrypt(String password) {
        return password.getBytes(StandardCharsets.UTF_8).length <= MAX_BYTES;
    }

    /** Values that ship in examples or are tried first by anyone guessing. */
    public static boolean isKnownDefault(String password) {
        String lower = password.toLowerCase();
        return KNOWN_DEFAULTS.contains(lower) || lower.startsWith("change-me");
    }

    @Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
    @Retention(RetentionPolicy.RUNTIME)
    @Constraint(validatedBy = BcryptLengthValidator.class)
    public @interface FitsBcrypt {
        String message() default "Пароль слишком длинный: максимум 72 латинских или 36 русских символов";

        Class<?>[] groups() default {};

        Class<? extends Payload>[] payload() default {};
    }

    public static class BcryptLengthValidator implements ConstraintValidator<FitsBcrypt, String> {
        @Override
        public boolean isValid(String value, ConstraintValidatorContext context) {
            return value == null || fitsBcrypt(value);
        }
    }
}
