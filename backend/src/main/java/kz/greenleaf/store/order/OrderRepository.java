package kz.greenleaf.store.order;

import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrderRepository extends JpaRepository<Order, Long>, JpaSpecificationExecutor<Order> {

    Optional<Order> findByNumber(String number);

    Page<Order> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);

    long countByStatus(OrderEnums.OrderStatus status);

    @Query(value = "select nextval('order_number_seq')", nativeQuery = true)
    long nextNumber();

    @Query("select o from CustomerOrder o where o.number = :number and o.userId = :userId")
    Optional<Order> findOwned(@Param("number") String number, @Param("userId") Long userId);
}
