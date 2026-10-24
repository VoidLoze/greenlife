package kz.greenleaf.store.catalog.repo;

import java.util.List;
import java.util.Optional;
import kz.greenleaf.store.catalog.domain.Brand;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BrandRepository extends JpaRepository<Brand, Long> {

    Optional<Brand> findBySlug(String slug);

    @Query("select b from Brand b where lower(b.name) = lower(:name)")
    Optional<Brand> findByNameIgnoreCase(@Param("name") String name);

    boolean existsBySlug(String slug);

    @Query("select b from Brand b order by b.name asc")
    List<Brand> findAllOrdered();
}
