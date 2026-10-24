package kz.greenleaf.store.catalog.repo;

import java.util.List;
import java.util.Optional;
import kz.greenleaf.store.catalog.domain.Category;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface CategoryRepository extends JpaRepository<Category, Long> {

    Optional<Category> findBySlug(String slug);

    boolean existsBySlug(String slug);

    @Query("select c from Category c order by c.sortOrder asc, c.nameRu asc")
    List<Category> findAllOrdered();
}
