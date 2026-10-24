package kz.greenleaf.store.auth;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import kz.greenleaf.store.config.AppProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

/**
 * Keeps access tokens revocable despite being stateless JWTs: individual tokens are blacklisted by jti
 * (logout) and all tokens of a user issued before a timestamp can be invalidated (password change, ban).
 */
@Service
public class TokenRevocationService {

    private static final Logger log = LoggerFactory.getLogger(TokenRevocationService.class);
    private static final String BLACKLIST_PREFIX = "auth:blacklist:";
    private static final String REVOKED_BEFORE_PREFIX = "auth:revoked-before:";

    private final StringRedisTemplate redis;
    private final Duration accessTtl;
    private final Clock clock;

    public TokenRevocationService(StringRedisTemplate redis, AppProperties properties, Clock clock) {
        this.redis = redis;
        this.accessTtl = properties.jwt().accessTokenTtl();
        this.clock = clock;
    }

    public void blacklist(String jti, Instant expiresAt) {
        Duration ttl = Duration.between(clock.instant(), expiresAt);
        if (ttl.isNegative() || ttl.isZero()) {
            return;
        }
        redis.opsForValue().set(BLACKLIST_PREFIX + jti, "1", ttl);
    }

    public void revokeAllIssuedBefore(Long userId) {
        long nowSeconds = clock.instant().getEpochSecond();
        redis.opsForValue().set(REVOKED_BEFORE_PREFIX + userId, Long.toString(nowSeconds), accessTtl.plusMinutes(1));
    }

    public boolean isRevoked(JwtService.ParsedToken token) {
        try {
            if (Boolean.TRUE.equals(redis.hasKey(BLACKLIST_PREFIX + token.jti()))) {
                return true;
            }
            String revokedBefore = redis.opsForValue().get(REVOKED_BEFORE_PREFIX + token.principal().id());
            return revokedBefore != null && token.issuedAt().getEpochSecond() < Long.parseLong(revokedBefore);
        } catch (RuntimeException ex) {
            log.warn("Token revocation check unavailable, allowing request: {}", ex.getMessage());
            return false;
        }
    }
}
