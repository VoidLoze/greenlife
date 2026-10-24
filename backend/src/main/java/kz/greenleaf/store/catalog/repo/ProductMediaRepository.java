package kz.greenleaf.store.catalog.repo;

import java.util.List;
import java.util.Optional;
import kz.greenleaf.store.catalog.domain.MediaKind;
import kz.greenleaf.store.catalog.domain.ProductMedia;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProductMediaRepository extends JpaRepository<ProductMedia, Long> {

    @Query("select m from ProductMedia m where m.product.id = :productId order by m.kind asc, m.sortOrder asc, m.id asc")
    List<ProductMedia> findByProductId(@Param("productId") Long productId);

    @Query("select m from ProductMedia m where m.product.id = :productId and m.kind = :kind order by m.sortOrder asc, m.id asc")
    List<ProductMedia> findByProductIdAndKind(@Param("productId") Long productId, @Param("kind") MediaKind kind);

    @Query("select m from ProductMedia m where m.id = :id and m.product.id = :productId")
    Optional<ProductMedia> findByIdAndProductId(@Param("id") Long id, @Param("productId") Long productId);

    @Query("select coalesce(max(m.sortOrder), -1) from ProductMedia m where m.product.id = :productId and m.kind = :kind")
    int maxSortOrder(@Param("productId") Long productId, @Param("kind") MediaKind kind);

    long countByStorageKey(String storageKey);
}
