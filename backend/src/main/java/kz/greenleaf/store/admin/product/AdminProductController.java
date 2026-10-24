package kz.greenleaf.store.admin.product;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import kz.greenleaf.store.admin.product.AdminMediaService.UploadMeta;
import kz.greenleaf.store.admin.product.AdminProductDtos.MediaReorderRequest;
import kz.greenleaf.store.admin.product.AdminProductDtos.MediaUpdateRequest;
import kz.greenleaf.store.admin.product.AdminProductDtos.ParseDescriptionRequest;
import kz.greenleaf.store.admin.product.AdminProductDtos.ProductAdminDto;
import kz.greenleaf.store.admin.product.AdminProductDtos.ProductListItem;
import kz.greenleaf.store.admin.product.AdminProductDtos.ProductUpsertRequest;
import kz.greenleaf.store.admin.product.AdminProductDtos.StatusRequest;
import kz.greenleaf.store.admin.product.AdminProductService.DeleteResult;
import kz.greenleaf.store.admin.product.AdminProductService.ListFilter;
import kz.greenleaf.store.auth.AuthPrincipal;
import kz.greenleaf.store.catalog.domain.MediaKind;
import kz.greenleaf.store.catalog.domain.ProductStatus;
import kz.greenleaf.store.catalog.dto.CatalogDtos.MediaDto;
import kz.greenleaf.store.common.PageResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/admin/products")
@Tag(name = "Admin: products")
public class AdminProductController {

    private final AdminProductService service;
    private final AdminMediaService mediaService;

    public AdminProductController(AdminProductService service, AdminMediaService mediaService) {
        this.service = service;
        this.mediaService = mediaService;
    }

    @GetMapping
    @Operation(summary = "Список товаров с фильтрами (поиск, статус, категория, бренд, мало на складе, без фото)")
    public PageResponse<ProductListItem> list(@RequestParam(required = false) String q,
                                              @RequestParam(required = false) ProductStatus status,
                                              @RequestParam(required = false) Long categoryId,
                                              @RequestParam(required = false) Long brandId,
                                              @RequestParam(required = false) Boolean lowStock,
                                              @RequestParam(required = false) Boolean noPhoto,
                                              @RequestParam(required = false) String sort,
                                              @RequestParam(defaultValue = "0") int page,
                                              @RequestParam(defaultValue = "25") int size) {
        return service.list(new ListFilter(q, status, categoryId, brandId, lowStock, noPhoto, sort, page, size));
    }

    @GetMapping("/{id}")
    public ProductAdminDto get(@PathVariable Long id) {
        return service.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProductAdminDto create(@Valid @RequestBody ProductUpsertRequest request,
                                  @AuthenticationPrincipal AuthPrincipal principal) {
        return service.create(request, principal.id());
    }

    @PutMapping("/{id}")
    @Operation(summary = "Полное обновление карточки; передайте version, чтобы не затереть чужие правки")
    public ProductAdminDto update(@PathVariable Long id, @Valid @RequestBody ProductUpsertRequest request) {
        return service.update(id, request);
    }

    @PatchMapping("/{id}/status")
    public ProductAdminDto changeStatus(@PathVariable Long id, @Valid @RequestBody StatusRequest request) {
        return service.changeStatus(id, request.status());
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Удалить товар (если он есть в заказах — архивируется)")
    public DeleteResult delete(@PathVariable Long id) {
        return service.delete(id);
    }

    @PostMapping("/{id}/duplicate")
    @ResponseStatus(HttpStatus.CREATED)
    public ProductAdminDto duplicate(@PathVariable Long id, @AuthenticationPrincipal AuthPrincipal principal) {
        return service.duplicate(id, principal.id());
    }

    @PostMapping("/parse-description")
    @Operation(summary = "Разобрать сырой текст описания на поля карточки (преимущества, применение, состав...)")
    public DescriptionParser.Parsed parseDescription(@Valid @RequestBody ParseDescriptionRequest request) {
        return service.parseDescription(request.text(), request.name());
    }

    @PostMapping(value = "/{id}/media", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Загрузить фото, скрин или документ с подписью и описанием")
    public MediaDto upload(@PathVariable Long id,
                           @RequestPart("file") MultipartFile file,
                           @RequestParam(defaultValue = "PHOTO") MediaKind kind,
                           @RequestParam(required = false) String title,
                           @RequestParam(required = false) String description,
                           @RequestParam(required = false) String altText,
                           @RequestParam(defaultValue = "false") boolean cover) {
        return mediaService.upload(id, file, new UploadMeta(kind, limit(title, 200), limit(description, 5000),
                limit(altText, 255), cover));
    }

    @PatchMapping("/{id}/media/{mediaId}")
    public MediaDto updateMedia(@PathVariable Long id, @PathVariable Long mediaId,
                                @Valid @RequestBody MediaUpdateRequest request) {
        return mediaService.update(id, mediaId, request);
    }

    @PutMapping("/{id}/media/order")
    public List<MediaDto> reorderMedia(@PathVariable Long id, @Valid @RequestBody MediaReorderRequest request) {
        return mediaService.reorder(id, request);
    }

    @DeleteMapping("/{id}/media/{mediaId}")
    public ProductAdminDto deleteMedia(@PathVariable Long id, @PathVariable Long mediaId) {
        return mediaService.delete(id, mediaId);
    }

    private static String limit(String value, int max) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.length() > max ? trimmed.substring(0, max) : trimmed;
    }
}
