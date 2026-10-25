package kz.greenleaf.store.catalog.repo;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import kz.greenleaf.store.catalog.domain.Product;
import kz.greenleaf.store.catalog.domain.ProductStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProductRepository extends JpaRepository<Product, Long>, JpaSpecificationExecutor<Product> {

    @EntityGraph(attributePaths = {"category", "type", "brand"})
    Optional<Product> findBySlug(String slug);

    @EntityGraph(attributePaths = {"category", "type", "brand"})
    @Query("select p from Product p where p.id = :id")
    Optional<Product> findWithRelationsById(@Param("id") Long id);

    @EntityGraph(attributePaths = {"category", "type", "brand"})
    List<Product> findAllByIdIn(Collection<Long> ids);

    boolean existsBySlug(String slug);

    boolean existsBySku(String sku);

    long countByStatus(ProductStatus status);

    long countByCategoryId(Long categoryId);

    long countByBrandId(Long brandId);

    @Query("""
            select p.category.id, count(p) from Product p
            where p.status = kz.greenleaf.store.catalog.domain.ProductStatus.PUBLISHED and p.price is not null
              and p.category is not null
            group by p.category.id
            """)
    List<Object[]> countPublishedByCategory();

    @Query("""
            select p.brand.id, count(p) from Product p
            where p.status = kz.greenleaf.store.catalog.domain.ProductStatus.PUBLISHED and p.price is not null
              and p.brand is not null
            group by p.brand.id
            """)
    List<Object[]> countPublishedByBrand();

    @Query("""
            select p.type.id, count(p) from Product p
            where p.status = kz.greenleaf.store.catalog.domain.ProductStatus.PUBLISHED and p.price is not null
              and p.type is not null
            group by p.type.id
            """)
    List<Object[]> countPublishedByType();

    long countByTypeId(Long typeId);

    @Query(value = "select nextval('product_sku_seq')", nativeQuery = true)
    long nextSkuNumber();

    @Modifying
    @Query("""
            update Product p
               set p.stockQuantity = case when p.stockQuantity is null then null else p.stockQuantity - :qty end,
                   p.soldCount = p.soldCount + :qty
             where p.id = :id and (p.stockQuantity is null or p.stockQuantity >= :qty)
               and p.status = kz.greenleaf.store.catalog.domain.ProductStatus.PUBLISHED and p.price is not null
            """)
    int reserveStock(@Param("id") Long id, @Param("qty") int qty);

    @Modifying
    @Query("""
            update Product p
               set p.stockQuantity = case when p.stockQuantity is null then null else p.stockQuantity + :qty end,
                   p.soldCount = case when p.soldCount >= :qty then p.soldCount - :qty else 0 end
             where p.id = :id
            """)
    int releaseStock(@Param("id") Long id, @Param("qty") int qty);

    @Modifying
    @Query(value = "update products set view_count = view_count + :delta where id = :id", nativeQuery = true)
    int addViews(@Param("id") Long id, @Param("delta") long delta);

    @Query("""
            select p from Product p
            where p.status = kz.greenleaf.store.catalog.domain.ProductStatus.PUBLISHED
              and p.stockQuantity is not null and p.stockQuantity <= :threshold
            order by p.stockQuantity asc
            """)
    List<Product> findLowStock(@Param("threshold") int threshold, org.springframework.data.domain.Pageable pageable);
}
