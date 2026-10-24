package kz.greenleaf.store.user;

import java.time.Instant;

public record UserDto(
        Long id,
        String email,
        String fullName,
        String phone,
        Role role,
        boolean partner,
        boolean enabled,
        Instant createdAt,
        Instant lastLoginAt) {

    public static UserDto from(User user) {
        return new UserDto(user.getId(), user.getEmail(), user.getFullName(), user.getPhone(), user.getRole(),
                user.isPartner(), user.isEnabled(), user.getCreatedAt(), user.getLastLoginAt());
    }
}
