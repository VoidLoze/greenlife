package kz.greenleaf.store.auth;

import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from RefreshToken t join fetch t.user where t.tokenHash = :hash")
    Optional<RefreshToken> findByHashForUpdate(@Param("hash") String hash);

    /** Clearing replacedByHash also ends the short rotation grace window of tokens rotated just before. */
    @Modifying
    @Query("""
            update RefreshToken t set t.revokedAt = coalesce(t.revokedAt, :now), t.replacedByHash = null
             where t.familyId = :familyId and (t.revokedAt is null or t.replacedByHash is not null)
            """)
    int revokeFamily(@Param("familyId") UUID familyId, @Param("now") Instant now);

    @Modifying
    @Query("""
            update RefreshToken t set t.revokedAt = coalesce(t.revokedAt, :now), t.replacedByHash = null
             where t.user.id = :userId and (t.revokedAt is null or t.replacedByHash is not null)
            """)
    int revokeAllForUser(@Param("userId") Long userId, @Param("now") Instant now);

    @Modifying
    @Query("delete from RefreshToken t where t.expiresAt < :threshold")
    int deleteExpiredBefore(@Param("threshold") Instant threshold);
}
