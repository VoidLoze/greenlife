package kz.greenleaf.store.admin.user;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.security.SecureRandom;
import java.time.Clock;
import kz.greenleaf.store.auth.AuthPrincipal;
import kz.greenleaf.store.auth.RefreshTokenRepository;
import kz.greenleaf.store.auth.TokenRevocationService;
import kz.greenleaf.store.common.ApiException;
import kz.greenleaf.store.common.PageResponse;
import kz.greenleaf.store.user.Role;
import kz.greenleaf.store.user.User;
import kz.greenleaf.store.user.UserDto;
import kz.greenleaf.store.user.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/admin/users")
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Admin: users")
public class AdminUserController {

    private final UserRepository users;
    private final RefreshTokenRepository refreshTokens;
    private final TokenRevocationService revocation;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();

    public AdminUserController(UserRepository users, RefreshTokenRepository refreshTokens,
                               TokenRevocationService revocation, PasswordEncoder passwordEncoder, Clock clock) {
        this.users = users;
        this.refreshTokens = refreshTokens;
        this.revocation = revocation;
        this.passwordEncoder = passwordEncoder;
        this.clock = clock;
    }

    public record UserUpdateRequest(Role role, Boolean partner, Boolean enabled) {
    }

    @GetMapping
    @Transactional(readOnly = true)
    public PageResponse<UserDto> list(@RequestParam(required = false) String q,
                                      @RequestParam(required = false) Role role,
                                      @RequestParam(defaultValue = "0") int page,
                                      @RequestParam(defaultValue = "25") int size) {
        var pageable = PageRequest.of(Math.max(page, 0), Math.clamp(size, 1, 100), Sort.by(Sort.Direction.DESC, "createdAt"));
        String query = q == null ? "" : q.trim();
        String digits = query.replaceAll("[\\s()+-]", "");
        if (digits.matches("\\d{4,}")) {
            // Phones are stored as +7XXXXXXXXXX; "8 707 …" is the same number.
            query = digits.length() == 11 && digits.startsWith("8") ? "7" + digits.substring(1) : digits;
        }
        return PageResponse.of(users.search(query, role, pageable), UserDto::from);
    }

    @PatchMapping("/{id}")
    @Transactional
    @Operation(summary = "Сменить роль, партнёрский статус или заблокировать пользователя")
    public UserDto update(@PathVariable Long id, @RequestBody UserUpdateRequest request,
                          @AuthenticationPrincipal AuthPrincipal principal) {
        User user = users.findById(id).orElseThrow(() -> ApiException.notFound("Пользователь"));
        boolean self = user.getId().equals(principal.id());
        boolean sessionsAffected = false;

        if (request.role() != null && request.role() != user.getRole()) {
            if (self) {
                throw ApiException.forbidden("Нельзя изменить собственную роль");
            }
            if (user.getRole() == Role.ADMIN && user.isEnabled() && users.countByRoleAndEnabled(Role.ADMIN, true) <= 1) {
                throw ApiException.conflict("last_admin", "Нельзя убрать последнего администратора");
            }
            user.setRole(request.role());
            sessionsAffected = true;
        }
        if (request.enabled() != null && request.enabled() != user.isEnabled()) {
            if (self) {
                throw ApiException.forbidden("Нельзя заблокировать самого себя");
            }
            if (!request.enabled() && user.getRole() == Role.ADMIN && users.countByRoleAndEnabled(Role.ADMIN, true) <= 1) {
                throw ApiException.conflict("last_admin", "Нельзя заблокировать последнего администратора");
            }
            user.setEnabled(request.enabled());
            sessionsAffected = !request.enabled() || sessionsAffected;
        }
        if (request.partner() != null) {
            user.setPartner(request.partner());
        }
        if (sessionsAffected) {
            // Role is embedded in the access token, so existing sessions must re-authenticate to pick it up.
            refreshTokens.revokeAllForUser(user.getId(), clock.instant());
            revocation.revokeAllIssuedBefore(user.getId());
        }
        return UserDto.from(user);
    }

    public record PasswordResetResponse(String temporaryPassword) {
    }

    /**
     * For a shopper who forgot the password (the store sends no email): the admin hands over a one-time password by
     * phone or WhatsApp, every session of that user ends, and the user changes it in the account afterwards.
     */
    @PostMapping("/{id}/password-reset")
    @Transactional
    @Operation(summary = "Выдать пользователю временный пароль")
    public PasswordResetResponse resetPassword(@PathVariable Long id, @AuthenticationPrincipal AuthPrincipal principal) {
        User user = users.findById(id).orElseThrow(() -> ApiException.notFound("Пользователь"));
        if (user.getId().equals(principal.id())) {
            throw ApiException.badRequest("self_reset", "Свой пароль меняйте в кабинете → «Пароль»");
        }
        String temporary = temporaryPassword();
        user.setPasswordHash(passwordEncoder.encode(temporary));
        refreshTokens.revokeAllForUser(user.getId(), clock.instant());
        revocation.revokeAllIssuedBefore(user.getId());
        return new PasswordResetResponse(temporary);
    }

    private String temporaryPassword() {
        String letters = "abcdefghjkmnpqrstuvwxyz";
        String digits = "23456789";
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < 6; i++) {
            out.append(letters.charAt(random.nextInt(letters.length())));
        }
        for (int i = 0; i < 4; i++) {
            out.append(digits.charAt(random.nextInt(digits.length())));
        }
        return out.toString();
    }
}
