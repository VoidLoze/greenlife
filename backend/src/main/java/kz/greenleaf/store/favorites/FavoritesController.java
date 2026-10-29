package kz.greenleaf.store.favorites;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import kz.greenleaf.store.auth.AuthPrincipal;
import kz.greenleaf.store.favorites.FavoritesService.Lists;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/favorites")
@Tag(name = "Favorites")
public class FavoritesController {

    private final FavoritesService service;

    public FavoritesController(FavoritesService service) {
        this.service = service;
    }

    public record ListsRequest(
            @NotNull @Size(max = 200) List<@NotNull Long> favorites,
            @NotNull @Size(max = 200) List<@NotNull Long> viewed) {

        Lists toLists() {
            return new Lists(favorites, viewed);
        }
    }

    @GetMapping
    public Lists get(@AuthenticationPrincipal AuthPrincipal principal) {
        return service.read(principal.id());
    }

    @PutMapping
    public Lists replace(@AuthenticationPrincipal AuthPrincipal principal, @Valid @RequestBody ListsRequest request) {
        return service.replace(principal.id(), request.toLists());
    }

    @PostMapping("/merge")
    @Operation(summary = "Слить избранное и просмотренное из браузера с сохранёнными после входа")
    public Lists merge(@AuthenticationPrincipal AuthPrincipal principal, @Valid @RequestBody ListsRequest request) {
        return service.merge(principal.id(), request.toLists());
    }
}
