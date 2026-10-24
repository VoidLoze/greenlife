package kz.greenleaf.store.admin.taxonomy;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import kz.greenleaf.store.admin.taxonomy.AdminTaxonomyService.BrandAdminDto;
import kz.greenleaf.store.admin.taxonomy.AdminTaxonomyService.BrandRequest;
import kz.greenleaf.store.admin.taxonomy.AdminTaxonomyService.CategoryAdminDto;
import kz.greenleaf.store.admin.taxonomy.AdminTaxonomyService.CategoryRequest;
import kz.greenleaf.store.admin.taxonomy.AdminTaxonomyService.TypeAdminDto;
import kz.greenleaf.store.admin.taxonomy.AdminTaxonomyService.TypeRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin")
@Tag(name = "Admin: categories & brands")
public class AdminTaxonomyController {

    private final AdminTaxonomyService service;

    public AdminTaxonomyController(AdminTaxonomyService service) {
        this.service = service;
    }

    @GetMapping("/categories")
    public List<CategoryAdminDto> categories() {
        return service.listCategories();
    }

    @PostMapping("/categories")
    @ResponseStatus(HttpStatus.CREATED)
    public CategoryAdminDto createCategory(@Valid @RequestBody CategoryRequest request) {
        return service.createCategory(request);
    }

    @PutMapping("/categories/{id}")
    public CategoryAdminDto updateCategory(@PathVariable Long id, @Valid @RequestBody CategoryRequest request) {
        return service.updateCategory(id, request);
    }

    @DeleteMapping("/categories/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteCategory(@PathVariable Long id) {
        service.deleteCategory(id);
    }

    @PostMapping("/categories/{categoryId}/types")
    @ResponseStatus(HttpStatus.CREATED)
    public TypeAdminDto createType(@PathVariable Long categoryId, @Valid @RequestBody TypeRequest request) {
        return service.createType(categoryId, request);
    }

    @PutMapping("/types/{id}")
    public TypeAdminDto updateType(@PathVariable Long id, @Valid @RequestBody TypeRequest request) {
        return service.updateType(id, request);
    }

    @DeleteMapping("/types/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteType(@PathVariable Long id) {
        service.deleteType(id);
    }

    @GetMapping("/brands")
    public List<BrandAdminDto> brands() {
        return service.listBrands();
    }

    @PostMapping("/brands")
    @ResponseStatus(HttpStatus.CREATED)
    public BrandAdminDto createBrand(@Valid @RequestBody BrandRequest request) {
        return service.createBrand(request);
    }

    @PutMapping("/brands/{id}")
    public BrandAdminDto updateBrand(@PathVariable Long id, @Valid @RequestBody BrandRequest request) {
        return service.updateBrand(id, request);
    }

    @DeleteMapping("/brands/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteBrand(@PathVariable Long id) {
        service.deleteBrand(id);
    }
}
