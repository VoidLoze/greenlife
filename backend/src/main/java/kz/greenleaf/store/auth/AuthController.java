package kz.greenleaf.store.auth;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import kz.greenleaf.store.auth.AuthDtos.AuthResponse;
import kz.greenleaf.store.auth.AuthDtos.AuthResult;
import kz.greenleaf.store.auth.AuthDtos.ChangePasswordRequest;
import kz.greenleaf.store.auth.AuthDtos.LoginRequest;
import kz.greenleaf.store.auth.AuthDtos.RegisterRequest;
import kz.greenleaf.store.auth.AuthDtos.UpdateProfileRequest;
import kz.greenleaf.store.common.ClientInfo;
import kz.greenleaf.store.user.UserDto;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Tag(name = "Auth", description = "Регистрация, вход, обновление и отзыв токенов")
public class AuthController {

    private final AuthService authService;
    private final RefreshCookies cookies;
    private final JwtAuthenticationFilter jwtFilter;

    public AuthController(AuthService authService, RefreshCookies cookies, JwtAuthenticationFilter jwtFilter) {
        this.authService = authService;
        this.cookies = cookies;
        this.jwtFilter = jwtFilter;
    }

    @PostMapping("/api/auth/register")
    @Operation(summary = "Регистрация покупателя")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request, HttpServletRequest http) {
        return withCookie(HttpStatus.CREATED, authService.register(request, ClientInfo.from(http)));
    }

    @PostMapping("/api/auth/login")
    @Operation(summary = "Вход по email и паролю")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request, HttpServletRequest http) {
        return withCookie(HttpStatus.OK, authService.login(request, ClientInfo.from(http)));
    }

    @PostMapping("/api/auth/refresh")
    @Operation(summary = "Обновить access-токен по refresh-cookie (с ротацией)")
    public ResponseEntity<AuthResponse> refresh(HttpServletRequest http) {
        try {
            return withCookie(HttpStatus.OK, authService.refresh(cookies.read(http), ClientInfo.from(http)));
        } catch (RuntimeException ex) {
            throw new CookieClearingException(ex);
        }
    }

    @PostMapping("/api/auth/logout")
    @Operation(summary = "Выход из текущей сессии")
    public ResponseEntity<Void> logout(HttpServletRequest http) {
        authService.logout(cookies.read(http), jwtFilter.parseFromRequest(http).orElse(null));
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, cookies.clear().toString()).build();
    }

    @PostMapping("/api/auth/logout-all")
    @Operation(summary = "Выйти со всех устройств")
    public ResponseEntity<Void> logoutAll(@AuthenticationPrincipal AuthPrincipal principal) {
        authService.logoutEverywhere(principal.id());
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, cookies.clear().toString()).build();
    }

    @GetMapping("/api/auth/me")
    @Operation(summary = "Текущий пользователь")
    public UserDto me(@AuthenticationPrincipal AuthPrincipal principal) {
        return authService.me(principal.id());
    }

    @PatchMapping("/api/account/profile")
    @Operation(summary = "Обновить профиль")
    public UserDto updateProfile(@AuthenticationPrincipal AuthPrincipal principal,
                                 @Valid @RequestBody UpdateProfileRequest request) {
        return authService.updateProfile(principal.id(), request);
    }

    @PostMapping("/api/account/password")
    @Operation(summary = "Сменить пароль (все прочие сессии будут завершены)")
    public ResponseEntity<AuthResponse> changePassword(@AuthenticationPrincipal AuthPrincipal principal,
                                                       @Valid @RequestBody ChangePasswordRequest request,
                                                       HttpServletRequest http) {
        return withCookie(HttpStatus.OK, authService.changePassword(principal.id(), request, ClientInfo.from(http)));
    }

    private ResponseEntity<AuthResponse> withCookie(HttpStatus status, AuthResult result) {
        return ResponseEntity.status(status)
                .header(HttpHeaders.SET_COOKIE, cookies.issue(result.refreshToken()).toString())
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(result.response());
    }

    /** Wraps refresh failures so the advice can clear the stale cookie. */
    public static class CookieClearingException extends RuntimeException {
        public CookieClearingException(RuntimeException cause) {
            super(cause);
        }

        @Override
        public synchronized RuntimeException getCause() {
            return (RuntimeException) super.getCause();
        }
    }
}
