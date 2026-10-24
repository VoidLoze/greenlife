package kz.greenleaf.store.catalog.repo;

import java.util.List;
import java.util.Optional;
import kz.greenleaf.store.catalog.domain.ProductType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProductTypeRepository extends JpaRepository<ProductType, Long> {

    Optional<ProductType> findBySlug(String slug);

    @EntityGraph(attributePaths = "category")
    @Query("select t from ProductType t order by t.category.sortOrder asc, t.sortOrder asc, t.nameRu asc")
    List<ProductType> findAllOrdered();

    @Query("select t from ProductType t where t.category.id = :categoryId order by t.sortOrder asc, t.nameRu asc")
    List<ProductType> findByCategoryOrdered(@Param("categoryId") Long categoryId);

    long countByCategoryId(Long categoryId);
}
