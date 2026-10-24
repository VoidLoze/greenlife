package kz.greenleaf.store.user;

import kz.greenleaf.store.config.AppProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Creates the first administrator from ADMIN_EMAIL / ADMIN_PASSWORD if the account does not exist yet. */
@Component
public class AdminBootstrap {

    private static final Logger log = LoggerFactory.getLogger(AdminBootstrap.class);

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final AppProperties.Admin admin;

    public AdminBootstrap(UserRepository users, PasswordEncoder passwordEncoder, AppProperties properties) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
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
        users.findByEmail(email).ifPresentOrElse(existing -> {
            if (existing.getRole() != Role.ADMIN) {
                log.warn("User {} exists but is not an administrator; leaving it unchanged", email);
            }
        }, () -> {
            if (admin.password().length() < 8) {
                log.error("ADMIN_PASSWORD must be at least 8 characters; administrator not created");
                return;
            }
            String name = isBlank(admin.fullName()) ? "Администратор" : admin.fullName().trim();
            users.save(new User(email, passwordEncoder.encode(admin.password()), name, null, Role.ADMIN));
            log.info("Administrator {} created", email);
        });
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
