package kz.greenleaf.store.auth;

import kz.greenleaf.store.user.Role;

public record AuthPrincipal(Long id, String email, Role role) {

    public boolean isAdmin() {
        return role == Role.ADMIN;
    }
}
