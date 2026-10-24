package kz.greenleaf.store.cart;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import kz.greenleaf.store.auth.AuthPrincipal;
import kz.greenleaf.store.cart.CartDtos.CartUpdateRequest;
import kz.greenleaf.store.cart.CartDtos.Quote;
import kz.greenleaf.store.cart.CartDtos.QuoteRequest;
import kz.greenleaf.store.order.OrderEnums.DeliveryMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/cart")
@Tag(name = "Cart")
public class CartController {

    private final CartService service;

    public CartController(CartService service) {
        this.service = service;
    }

    @PostMapping("/quote")
    @Operation(summary = "Пересчитать корзину (цены, наличие, доставка) — доступно и гостям")
    public Quote quote(@Valid @RequestBody QuoteRequest request, @AuthenticationPrincipal AuthPrincipal principal) {
        return service.quote(request.items(), principal, request.deliveryMethod());
    }

    @GetMapping
    public Quote get(@AuthenticationPrincipal AuthPrincipal principal,
                     @RequestParam(required = false) DeliveryMethod deliveryMethod) {
        return service.current(principal, deliveryMethod);
    }

    @PutMapping
    public Quote replace(@AuthenticationPrincipal AuthPrincipal principal,
                         @Valid @RequestBody CartUpdateRequest request,
                         @RequestParam(required = false) DeliveryMethod deliveryMethod) {
        return service.replace(principal, request.items(), deliveryMethod);
    }

    @PostMapping("/merge")
    @Operation(summary = "Слить гостевую корзину из браузера с сохранённой после входа")
    public Quote merge(@AuthenticationPrincipal AuthPrincipal principal,
                       @Valid @RequestBody CartUpdateRequest request,
                       @RequestParam(required = false) DeliveryMethod deliveryMethod) {
        return service.merge(principal, request.items(), deliveryMethod);
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void clear(@AuthenticationPrincipal AuthPrincipal principal) {
        service.clear(principal.id());
    }
}
