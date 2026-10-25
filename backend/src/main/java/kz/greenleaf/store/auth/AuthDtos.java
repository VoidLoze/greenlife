package kz.greenleaf.store.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import kz.greenleaf.store.auth.Passwords.FitsBcrypt;
import kz.greenleaf.store.user.UserDto;

public final class AuthDtos {

    private AuthDtos() {
    }

    public record RegisterRequest(
            @NotBlank @Email(message = "Некорректный email") @Size(max = 255) String email,
            @NotBlank @Pattern(regexp = Passwords.REGEX, message = Passwords.MESSAGE) @FitsBcrypt String password,
            @NotBlank(message = "Укажите имя") @Size(min = 2, max = 150) String fullName,
            @Size(max = 32) String phone,
            /* Consent to the processing of personal data (Law of the Republic of Kazakhstan No. 94-V). */
            boolean consent) {
    }

    public record LoginRequest(
            @NotBlank @Email(message = "Некорректный email") @Size(max = 255) String email,
            @NotBlank @Size(max = 128) String password) {
    }

    public record ChangePasswordRequest(
            @NotBlank @Size(max = 128) String currentPassword,
            @NotBlank @Pattern(regexp = Passwords.REGEX, message = Passwords.MESSAGE) @FitsBcrypt String newPassword) {
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
