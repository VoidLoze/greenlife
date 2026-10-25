package kz.greenleaf.store.user;

import kz.greenleaf.store.auth.Passwords;
import kz.greenleaf.store.auth.RefreshTokenRepository;
import kz.greenleaf.store.auth.TokenRevocationService;
import kz.greenleaf.store.config.AppProperties;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Creates the first administrator from ADMIN_EMAIL / ADMIN_PASSWORD if the account does not exist yet. With
 * ADMIN_SYNC_PASSWORD=true an existing administrator's password is reset to ADMIN_PASSWORD (all sessions end), which
 * is how a password set at first start is rotated.
 */
@Component
public class AdminBootstrap {

    private static final Logger log = LoggerFactory.getLogger(AdminBootstrap.class);

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final RefreshTokenRepository refreshTokens;
    private final TokenRevocationService revocation;
    private final AppProperties.Admin admin;

    public AdminBootstrap(UserRepository users, PasswordEncoder passwordEncoder, RefreshTokenRepository refreshTokens,
                          TokenRevocationService revocation, AppProperties properties) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.refreshTokens = refreshTokens;
        this.revocation = revocation;
        this.admin = properties.admin();
    }

    @EventListener(ApplicationReadyEvent.class)
    @Order(1)
    @Transactional
    public void ensureAdmin() {
        if (admin == null || isBlank(admin.email()) || isBlank(admin.password())) {
            if (!users.existsByRole(Role.ADMIN)) {
                log.warn("No administrator exists and ADMIN_EMAIL/ADMIN_PASSWORD are not set");
            }
            return;
        }
        String email = admin.email().trim().toLowerCase();
        String password = admin.password();
        if (!Passwords.acceptable(password) || Passwords.isKnownDefault(password)) {
            log.error("ADMIN_PASSWORD is too weak or a well-known example value — administrator {} was NOT created "
                    + "or changed. Use at least 8 characters with letters and digits, not the value from .env.example.", email);
            return;
        }
        users.findByEmail(email).ifPresentOrElse(existing -> {
            if (existing.getRole() != Role.ADMIN) {
                log.warn("User {} exists but is not an administrator; leaving it unchanged", email);
                return;
            }
            if (admin.syncPassword() && !passwordEncoder.matches(password, existing.getPasswordHash())) {
                existing.setPasswordHash(passwordEncoder.encode(password));
                refreshTokens.revokeAllForUser(existing.getId(), Instant.now());
                revocation.revokeAllIssuedBefore(existing.getId());
                log.info("Administrator {} password reset from ADMIN_PASSWORD; all sessions ended", email);
            }
        }, () -> {
            String name = isBlank(admin.fullName()) ? "Администратор" : admin.fullName().trim();
            users.save(new User(email, passwordEncoder.encode(password), name, null, Role.ADMIN));
            log.info("Administrator {} created", email);
        });
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
