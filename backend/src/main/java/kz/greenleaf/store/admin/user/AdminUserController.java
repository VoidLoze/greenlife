package kz.greenleaf.store.admin.user;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
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
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/users")
@Tag(name = "Admin: users")
public class AdminUserController {

    private final UserRepository users;
    private final RefreshTokenRepository refreshTokens;
    private final TokenRevocationService revocation;
    private final Clock clock;

    public AdminUserController(UserRepository users, RefreshTokenRepository refreshTokens,
                               TokenRevocationService revocation, Clock clock) {
        this.users = users;
        this.refreshTokens = refreshTokens;
        this.revocation = revocation;
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
            if (user.getRole() == Role.ADMIN && users.countByRole(Role.ADMIN) <= 1) {
                throw ApiException.conflict("last_admin", "Нельзя убрать последнего администратора");
            }
            user.setRole(request.role());
            sessionsAffected = true;
        }
        if (request.enabled() != null && request.enabled() != user.isEnabled()) {
            if (self) {
                throw ApiException.forbidden("Нельзя заблокировать самого себя");
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
}
