package kz.greenleaf.store.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import kz.greenleaf.store.user.UserDto;

public final class AuthDtos {

    private static final String PASSWORD_REGEX = "^(?=.*[A-Za-zА-Яа-яЁё])(?=.*\\d).{8,72}$";
    private static final String PASSWORD_MESSAGE = "Пароль: от 8 символов, минимум одна буква и одна цифра";

    private AuthDtos() {
    }

    public record RegisterRequest(
            @NotBlank @Email(message = "Некорректный email") @Size(max = 255) String email,
            @NotBlank @Pattern(regexp = PASSWORD_REGEX, message = PASSWORD_MESSAGE) String password,
            @NotBlank(message = "Укажите имя") @Size(min = 2, max = 150) String fullName,
            @Size(max = 32) String phone) {
    }

    public record LoginRequest(
            @NotBlank @Email(message = "Некорректный email") String email,
            @NotBlank String password) {
    }

    public record ChangePasswordRequest(
            @NotBlank String currentPassword,
            @NotBlank @Pattern(regexp = PASSWORD_REGEX, message = PASSWORD_MESSAGE) String newPassword) {
    }

    public record UpdateProfileRequest(
            @NotBlank(message = "Укажите имя") @Size(min = 2, max = 150) String fullName,
            @Size(max = 32) String phone) {
    }

    public record AuthResponse(String accessToken, String tokenType, Instant expiresAt, UserDto user) {
    }

    /** Internal result carrying the raw refresh token that goes into the httpOnly cookie. */
    public record AuthResult(AuthResponse response, String refreshToken) {
    }
}
