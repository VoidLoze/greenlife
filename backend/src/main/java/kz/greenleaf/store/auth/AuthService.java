package kz.greenleaf.store.auth;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;
import java.util.UUID;
import kz.greenleaf.store.auth.AuthDtos.AuthResponse;
import kz.greenleaf.store.auth.AuthDtos.AuthResult;
import kz.greenleaf.store.auth.AuthDtos.ChangePasswordRequest;
import kz.greenleaf.store.auth.AuthDtos.LoginRequest;
import kz.greenleaf.store.auth.AuthDtos.RegisterRequest;
import kz.greenleaf.store.auth.AuthDtos.UpdateProfileRequest;
import kz.greenleaf.store.common.ApiException;
import kz.greenleaf.store.common.ClientInfo;
import kz.greenleaf.store.common.Phones;
import kz.greenleaf.store.common.RateLimiter;
import kz.greenleaf.store.config.AppProperties;
import kz.greenleaf.store.user.Role;
import kz.greenleaf.store.user.User;
import kz.greenleaf.store.user.UserDto;
import kz.greenleaf.store.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);
    /** Concurrent refreshes from several tabs may present an already-rotated token for a short moment. */
    private static final Duration ROTATION_GRACE = Duration.ofSeconds(20);
    private static final Duration LOGIN_IP_WINDOW = Duration.ofMinutes(15);
    private static final int LOGIN_IP_LIMIT = 40;
    /** Caps password spraying at one account from many addresses without letting a stranger lock its owner out. */
    private static final int LOGIN_EMAIL_LIMIT = 100;

    private final UserRepository users;
    private final RefreshTokenRepository refreshTokens;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final TokenRevocationService revocation;
    private final RateLimiter rateLimiter;
    private final AppProperties props;
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();
    /** Used to equalize timing when the email does not exist. */
    private final String dummyHash;

    public AuthService(UserRepository users, RefreshTokenRepository refreshTokens, PasswordEncoder passwordEncoder,
                       JwtService jwtService, TokenRevocationService revocation, RateLimiter rateLimiter,
                       AppProperties props, Clock clock) {
        this.users = users;
        this.refreshTokens = refreshTokens;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.revocation = revocation;
        this.rateLimiter = rateLimiter;
        this.props = props;
        this.clock = clock;
        this.dummyHash = passwordEncoder.encode("dummy-password-for-timing");
    }

    @Transactional
    public AuthResult register(RegisterRequest request, ClientInfo client) {
        rateLimiter.acquireOrThrow("register:" + client.ip(), props.security().registerPerHour(), Duration.ofHours(1),
                "Слишком много регистраций с вашего адреса. Попробуйте позже.");
        if (!request.consent()) {
            throw ApiException.badRequest("consent_required", "Подтвердите согласие на обработку персональных данных");
        }
        String email = normalizeEmail(request.email());
        if (users.existsByEmail(email)) {
            throw ApiException.conflict("email_taken", "Пользователь с таким email уже зарегистрирован");
        }
        String phone = request.phone() == null || request.phone().isBlank() ? null : Phones.normalizeOrThrow(request.phone());
        User user = new User(email, passwordEncoder.encode(request.password()), request.fullName().trim(), phone, Role.USER);
        user.setLastLoginAt(clock.instant());
        users.save(user);
        log.info("New user registered: id={}", user.getId());
        return issueTokens(user, UUID.randomUUID(), client);
    }

    @Transactional
    public AuthResult login(LoginRequest request, ClientInfo client) {
        String email = normalizeEmail(request.email());
        // The lockout is per email *and* address: a stranger's wrong guesses cannot lock the owner out.
        String attemptBucket = "login:" + email + ":" + client.ip();
        rateLimiter.acquireOrThrow("login-ip:" + client.ip(), LOGIN_IP_LIMIT, LOGIN_IP_WINDOW,
                "Слишком много попыток входа. Попробуйте позже.");
        rateLimiter.acquireOrThrow("login-email:" + email, LOGIN_EMAIL_LIMIT, LOGIN_IP_WINDOW,
                "Слишком много попыток входа в этот аккаунт. Попробуйте позже.");
        // Counted before the password check, so parallel guesses cannot all slip under the limit.
        if (!rateLimiter.tryAcquire(attemptBucket, props.security().loginMaxAttempts(), props.security().loginLockDuration())) {
            long minutes = Math.max(1, rateLimiter.ttl(attemptBucket).toMinutes());
            throw ApiException.tooManyRequests("Слишком много неудачных попыток входа. Повторите через " + minutes + " мин.");
        }

        User user = users.findByEmail(email).orElse(null);
        boolean passwordOk = passwordEncoder.matches(request.password(), user == null ? dummyHash : user.getPasswordHash());
        if (user == null || !passwordOk) {
            throw ApiException.unauthorized("invalid_credentials", "Неверный email или пароль");
        }
        if (!user.isEnabled()) {
            throw ApiException.forbidden("Аккаунт заблокирован. Свяжитесь с поддержкой.");
        }
        rateLimiter.reset(attemptBucket);
        user.setLastLoginAt(clock.instant());
        return issueTokens(user, UUID.randomUUID(), client);
    }

    @Transactional(noRollbackFor = ApiException.class)
    public AuthResult refresh(String rawRefreshToken, ClientInfo client) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            throw ApiException.unauthorized("refresh_missing", "Сессия истекла, войдите снова");
        }
        Instant now = clock.instant();
        RefreshToken token = refreshTokens.findByHashForUpdate(hash(rawRefreshToken))
                .orElseThrow(() -> ApiException.unauthorized("refresh_invalid", "Сессия истекла, войдите снова"));

        if (token.getRevokedAt() != null) {
            boolean recentlyRotated = token.getReplacedByHash() != null
                    && token.getRevokedAt().plus(ROTATION_GRACE).isAfter(now);
            if (!recentlyRotated) {
                refreshTokens.revokeFamily(token.getFamilyId(), now);
                log.warn("Refresh token reuse detected for user {} — session family revoked", token.getUser().getId());
                throw ApiException.unauthorized("refresh_reused", "Сессия завершена из соображений безопасности. Войдите снова.");
            }
        } else if (!token.getExpiresAt().isAfter(now)) {
            throw ApiException.unauthorized("refresh_expired", "Сессия истекла, войдите снова");
        }

        User user = token.getUser();
        if (!user.isEnabled()) {
            refreshTokens.revokeAllForUser(user.getId(), now);
            throw ApiException.forbidden("Аккаунт заблокирован");
        }
        AuthResult result = issueTokens(user, token.getFamilyId(), client);
        if (token.getRevokedAt() == null) {
            token.revoke(now, hash(result.refreshToken()));
        }
        return result;
    }

    @Transactional
    public void logout(String rawRefreshToken, JwtService.ParsedToken accessToken) {
        Instant now = clock.instant();
        if (rawRefreshToken != null && !rawRefreshToken.isBlank()) {
            refreshTokens.findByHashForUpdate(hash(rawRefreshToken))
                    .ifPresent(token -> refreshTokens.revokeFamily(token.getFamilyId(), now));
        }
        if (accessToken != null) {
            revocation.blacklist(accessToken.jti(), accessToken.expiresAt());
        }
    }

    @Transactional
    public void logoutEverywhere(Long userId) {
        refreshTokens.revokeAllForUser(userId, clock.instant());
        revocation.revokeAllIssuedBefore(userId);
    }

    @Transactional(readOnly = true)
    public UserDto me(Long userId) {
        return UserDto.from(loadUser(userId));
    }

    @Transactional
    public UserDto updateProfile(Long userId, UpdateProfileRequest request) {
        User user = loadUser(userId);
        user.setFullName(request.fullName().trim());
        user.setPhone(request.phone() == null || request.phone().isBlank() ? null : Phones.normalizeOrThrow(request.phone()));
        return UserDto.from(user);
    }

    @Transactional
    public AuthResult changePassword(Long userId, ChangePasswordRequest request, ClientInfo client) {
        User user = loadUser(userId);
        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "wrong_password", "Текущий пароль указан неверно");
        }
        if (passwordEncoder.matches(request.newPassword(), user.getPasswordHash())) {
            throw ApiException.badRequest("same_password", "Новый пароль должен отличаться от текущего");
        }
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        logoutEverywhere(userId);
        return issueTokens(user, UUID.randomUUID(), client);
    }

    @Scheduled(cron = "0 30 3 * * *")
    @Transactional
    public void purgeExpiredRefreshTokens() {
        int removed = refreshTokens.deleteExpiredBefore(clock.instant().minus(Duration.ofDays(7)));
        if (removed > 0) {
            log.info("Purged {} expired refresh tokens", removed);
        }
    }

    private AuthResult issueTokens(User user, UUID familyId, ClientInfo client) {
        Instant now = clock.instant();
        String rawRefresh = generateRefreshToken();
        refreshTokens.save(new RefreshToken(user, hash(rawRefresh), familyId,
                now.plus(props.jwt().refreshTokenTtl()), client.userAgent(), client.ip(), now));
        JwtService.IssuedAccessToken access = jwtService.issue(user);
        AuthResponse response = new AuthResponse(access.token(), "Bearer", access.expiresAt(), UserDto.from(user));
        return new AuthResult(response, rawRefresh);
    }

    private User loadUser(Long userId) {
        return users.findById(userId).orElseThrow(() -> ApiException.notFound("Пользователь"));
    }

    private String generateRefreshToken() {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    static String hash(String raw) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(raw.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException(ex);
        }
    }

    private static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
