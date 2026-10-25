package kz.greenleaf.store.cart;

import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import kz.greenleaf.store.auth.AuthPrincipal;
import kz.greenleaf.store.cart.CartDtos.CartLineInput;
import kz.greenleaf.store.cart.CartDtos.Quote;
import kz.greenleaf.store.config.AppProperties;
import kz.greenleaf.store.order.OrderEnums.DeliveryMethod;
import kz.greenleaf.store.order.OrderEnums.PriceTier;
import kz.greenleaf.store.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

/**
 * Signed-in shoppers keep their cart in Redis so it follows them across devices; guests keep it in the browser and
 * only use the stateless quote endpoint.
 */
@Service
public class CartService {

    private static final Logger log = LoggerFactory.getLogger(CartService.class);
    private static final String PREFIX = "cart:";
    private static final int MAX_LINES = 100;

    private final StringRedisTemplate redis;
    private final PricingService pricing;
    private final UserRepository users;
    private final Duration ttl;
    private final int maxQuantity;

    public CartService(StringRedisTemplate redis, PricingService pricing, UserRepository users, AppProperties properties) {
        this.redis = redis;
        this.pricing = pricing;
        this.users = users;
        this.ttl = properties.cart().ttl();
        this.maxQuantity = properties.pricing().maxQuantityPerItem();
    }

    public PriceTier tierFor(AuthPrincipal principal) {
        if (principal == null) {
            return PriceTier.RETAIL;
        }
        return users.findById(principal.id())
                .filter(u -> u.isPartner() && u.isEnabled())
                .map(u -> PriceTier.PARTNER)
                .orElse(PriceTier.RETAIL);
    }

    public Quote quote(List<CartLineInput> lines, AuthPrincipal principal, DeliveryMethod deliveryMethod) {
        return pricing.quote(lines, tierFor(principal), deliveryMethod);
    }

    /**
     * The stored cart is never trimmed by the quote: an item that is out of stock today or a quantity above today's
     * stock stays saved and comes back when the shelf is refilled; the quote itself reports the adjustments.
     */
    public Quote current(AuthPrincipal principal, DeliveryMethod deliveryMethod) {
        return pricing.quote(read(principal.id()), tierFor(principal), deliveryMethod);
    }

    /** Priced from the lines just received, not re-read from Redis — a Redis outage must not empty the cart. */
    public Quote replace(AuthPrincipal principal, List<CartLineInput> lines, DeliveryMethod deliveryMethod) {
        write(principal.id(), lines);
        return pricing.quote(lines, tierFor(principal), deliveryMethod);
    }

    /** On sign-in the browser cart is folded into the stored one; the larger quantity wins so nothing doubles up. */
    public Quote merge(AuthPrincipal principal, List<CartLineInput> incoming, DeliveryMethod deliveryMethod) {
        Map<Long, Integer> merged = toMap(read(principal.id()));
        PricingService.merge(incoming).forEach((id, qty) -> merged.merge(id, qty, Math::max));
        List<CartLineInput> lines = toLines(merged);
        write(principal.id(), lines);
        return pricing.quote(lines, tierFor(principal), deliveryMethod);
    }

    public void clear(Long userId) {
        try {
            redis.delete(PREFIX + userId);
        } catch (DataAccessException ex) {
            log.warn("Failed to clear cart for user {}: {}", userId, ex.getMessage());
        }
    }

    List<CartLineInput> read(Long userId) {
        String raw;
        try {
            raw = redis.opsForValue().get(PREFIX + userId);
        } catch (DataAccessException ex) {
            log.warn("Cart storage unavailable: {}", ex.getMessage());
            return List.of();
        }
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        List<CartLineInput> lines = new ArrayList<>();
        for (String part : raw.split(",")) {
            String[] pair = part.split(":");
            if (pair.length != 2) {
                continue;
            }
            try {
                lines.add(new CartLineInput(Long.parseLong(pair[0]), Integer.parseInt(pair[1])));
            } catch (NumberFormatException ignored) {
                // A corrupted entry is skipped rather than breaking the whole cart.
            }
        }
        return lines;
    }

    private void write(Long userId, List<CartLineInput> lines) {
        Map<Long, Integer> merged = PricingService.merge(lines);
        StringBuilder value = new StringBuilder();
        int count = 0;
        for (Map.Entry<Long, Integer> entry : merged.entrySet()) {
            if (count++ >= MAX_LINES) {
                break;
            }
            if (!value.isEmpty()) {
                value.append(',');
            }
            value.append(entry.getKey()).append(':').append(Math.min(entry.getValue(), maxQuantity));
        }
        try {
            if (value.isEmpty()) {
                redis.delete(PREFIX + userId);
            } else {
                redis.opsForValue().set(PREFIX + userId, value.toString(), ttl);
            }
        } catch (DataAccessException ex) {
            log.warn("Failed to persist cart for user {}: {}", userId, ex.getMessage());
        }
    }

    private static Map<Long, Integer> toMap(List<CartLineInput> lines) {
        return new LinkedHashMap<>(PricingService.merge(lines));
    }

    private static List<CartLineInput> toLines(Map<Long, Integer> map) {
        return map.entrySet().stream().map(e -> new CartLineInput(e.getKey(), e.getValue())).toList();
    }
}
