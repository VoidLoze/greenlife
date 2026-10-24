package kz.greenleaf.store.admin.order;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.time.LocalDate;
import kz.greenleaf.store.admin.order.AdminOrderService.Filter;
import kz.greenleaf.store.auth.AuthPrincipal;
import kz.greenleaf.store.common.PageResponse;
import kz.greenleaf.store.order.OrderDtos.AdminNoteRequest;
import kz.greenleaf.store.order.OrderDtos.OrderDto;
import kz.greenleaf.store.order.OrderDtos.OrderSummaryDto;
import kz.greenleaf.store.order.OrderDtos.StatusUpdateRequest;
import kz.greenleaf.store.order.OrderEnums.OrderStatus;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/orders")
@Tag(name = "Admin: orders")
public class AdminOrderController {

    private final AdminOrderService service;

    public AdminOrderController(AdminOrderService service) {
        this.service = service;
    }

    @GetMapping
    public PageResponse<OrderSummaryDto> list(@RequestParam(required = false) String q,
                                              @RequestParam(required = false) OrderStatus status,
                                              @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                              @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                              @RequestParam(defaultValue = "0") int page,
                                              @RequestParam(defaultValue = "25") int size) {
        return service.list(new Filter(q, status, from, to, page, size));
    }

    @GetMapping("/{id}")
    public OrderDto get(@PathVariable Long id) {
        return service.get(id);
    }

    @PatchMapping("/{id}/status")
    public OrderDto changeStatus(@PathVariable Long id, @Valid @RequestBody StatusUpdateRequest request,
                                 @AuthenticationPrincipal AuthPrincipal principal) {
        return service.changeStatus(id, request.status(), request.note(), principal.id());
    }

    @PatchMapping("/{id}/note")
    public OrderDto updateNote(@PathVariable Long id, @Valid @RequestBody AdminNoteRequest request) {
        return service.updateNote(id, request.adminNote());
    }
}
