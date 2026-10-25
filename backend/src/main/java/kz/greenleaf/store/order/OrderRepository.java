package kz.greenleaf.store.order;

import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrderRepository extends JpaRepository<Order, Long>, JpaSpecificationExecutor<Order> {

    Optional<Order> findByNumber(String number);

    Optional<Order> findByIdempotencyKey(String idempotencyKey);

    Page<Order> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);

    long countByStatus(OrderEnums.OrderStatus status);

    @Query(value = "select nextval('order_number_seq')", nativeQuery = true)
    long nextNumber();

    @Query("select o from CustomerOrder o where o.number = :number and o.userId = :userId")
    Optional<Order> findOwned(@Param("number") String number, @Param("userId") Long userId);

    /** Serializes status changes of one order, so a repeated "cancel" sees the first one and does nothing. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from CustomerOrder o where o.id = :id")
    Optional<Order> findByIdForUpdate(@Param("id") Long id);

    @Query("""
            select count(o) from CustomerOrder o
             where o.phone = :phone and o.status = kz.greenleaf.store.order.OrderEnums.OrderStatus.NEW
               and o.createdAt >= :since
            """)
    long countOpenByPhoneSince(@Param("phone") String phone, @Param("since") Instant since);

    @Query("""
            select o.id from CustomerOrder o
             where o.status = kz.greenleaf.store.order.OrderEnums.OrderStatus.NEW and o.createdAt < :before
            """)
    List<Long> findStaleNewIds(@Param("before") Instant before);
}
