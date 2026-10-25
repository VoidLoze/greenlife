package kz.greenleaf.store.order;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.Map;
import kz.greenleaf.store.auth.AuthPrincipal;
import kz.greenleaf.store.common.ClientInfo;
import kz.greenleaf.store.common.PageResponse;
import kz.greenleaf.store.order.OrderDtos.CheckoutRequest;
import kz.greenleaf.store.order.OrderDtos.CheckoutResponse;
import kz.greenleaf.store.order.OrderDtos.OrderDto;
import kz.greenleaf.store.order.OrderDtos.OrderSummaryDto;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/orders")
@Tag(name = "Orders")
public class OrderController {

    private final OrderService service;

    public OrderController(OrderService service) {
        this.service = service;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Оформить заказ (гость или авторизованный пользователь); цены считаются на сервере")
    public CheckoutResponse checkout(@Valid @RequestBody CheckoutRequest request,
                                     @AuthenticationPrincipal AuthPrincipal principal,
                                     HttpServletRequest http) {
        return service.checkout(request, principal, ClientInfo.from(http));
    }

    @GetMapping("/my")
    public PageResponse<OrderSummaryDto> myOrders(@AuthenticationPrincipal AuthPrincipal principal,
                                                  @RequestParam(defaultValue = "0") int page,
                                                  @RequestParam(defaultValue = "10") int size) {
        return service.myOrders(principal, page, size);
    }

    @GetMapping("/my/{number}")
    public OrderDto myOrder(@AuthenticationPrincipal AuthPrincipal principal, @PathVariable String number) {
        return service.myOrder(principal, number);
    }

    @GetMapping("/my/{number}/whatsapp")
    public Map<String, String> whatsapp(@AuthenticationPrincipal AuthPrincipal principal, @PathVariable String number) {
        return Map.of("url", service.whatsappUrlFor(number, principal));
    }

    public record TrackRequest(@NotBlank @Size(max = 32) String number, @NotBlank @Size(max = 32) String phone) {
    }

    /** POST keeps the phone number out of URLs and access logs. */
    @PostMapping("/track")
    @Operation(summary = "Отследить заказ по номеру и телефону")
    public OrderDto track(@Valid @RequestBody TrackRequest request, HttpServletRequest http) {
        return service.track(request.number(), request.phone(), ClientInfo.from(http));
    }
}
