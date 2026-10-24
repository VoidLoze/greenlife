package kz.greenleaf.store.cart;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import kz.greenleaf.store.cart.CartDtos.CartLineInput;
import kz.greenleaf.store.cart.CartDtos.CartWarning;
import kz.greenleaf.store.cart.CartDtos.Quote;
import kz.greenleaf.store.cart.CartDtos.QuoteLine;
import kz.greenleaf.store.catalog.domain.Product;
import kz.greenleaf.store.catalog.domain.ProductStatus;
import kz.greenleaf.store.catalog.repo.ProductRepository;
import kz.greenleaf.store.config.AppProperties;
import kz.greenleaf.store.media.MediaUrls;
import kz.greenleaf.store.order.OrderEnums.DeliveryMethod;
import kz.greenleaf.store.order.OrderEnums.PriceTier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The single source of truth for money: the browser only sends product ids and quantities, every price, discount,
 * stock limit and delivery fee is recomputed here from the current catalog.
 */
@Service
public class PricingService {

    private final ProductRepository products;
    private final MediaUrls urls;
    private final AppProperties.Pricing pricing;

    public PricingService(ProductRepository products, MediaUrls urls, AppProperties properties) {
        this.products = products;
        this.urls = urls;
        this.pricing = properties.pricing();
    }

    public record PricedCart(Quote quote, Map<Long, Product> products) {
    }

    @Transactional(readOnly = true)
    public Quote quote(List<CartLineInput> lines, PriceTier tier, DeliveryMethod deliveryMethod) {
        return price(lines, tier, deliveryMethod).quote();
    }

    @Transactional(readOnly = true)
    public PricedCart price(List<CartLineInput> lines, PriceTier tier, DeliveryMethod deliveryMethod) {
        Map<Long, Integer> requested = merge(lines);
        Map<Long, Product> byId = requested.isEmpty() ? Map.of()
                : products.findAllByIdIn(requested.keySet()).stream()
                        .collect(Collectors.toMap(Product::getId, Function.identity()));

        List<QuoteLine> items = new ArrayList<>();
        List<CartWarning> warnings = new ArrayList<>();
        BigDecimal itemsTotal = BigDecimal.ZERO;
        BigDecimal retailTotal = BigDecimal.ZERO;
        BigDecimal savings = BigDecimal.ZERO;
        int count = 0;

        for (Map.Entry<Long, Integer> entry : requested.entrySet()) {
            Product product = byId.get(entry.getKey());
            if (product == null || product.getStatus() != ProductStatus.PUBLISHED || product.getPrice() == null) {
                String name = product == null ? "Товар" : "«" + product.getNameRu() + "»";
                warnings.add(new CartWarning(entry.getKey(), "unavailable", name + " больше не продаётся и убран из корзины"));
                continue;
            }
            int max = maxQuantity(product);
            if (max == 0) {
                warnings.add(new CartWarning(product.getId(), "out_of_stock",
                        "«" + product.getNameRu() + "» закончился и убран из корзины"));
                continue;
            }
            int quantity = entry.getValue();
            if (quantity > max) {
                quantity = max;
                String reason = product.getStockQuantity() != null && product.getStockQuantity() <= pricing.maxQuantityPerItem()
                        ? "в наличии только " + max + " шт."
                        : "максимум " + max + " шт. в одном заказе";
                warnings.add(new CartWarning(product.getId(), "quantity_reduced",
                        "«" + product.getNameRu() + "»: " + reason));
            }

            BigDecimal retail = product.getPrice();
            BigDecimal unit = tier == PriceTier.PARTNER
                    ? product.effectivePartnerPrice(pricing.partnerDiscountPercent())
                    : retail;
            BigDecimal reference = product.getOldPrice() != null && product.getOldPrice().compareTo(retail) > 0
                    ? product.getOldPrice()
                    : retail;
            BigDecimal qty = BigDecimal.valueOf(quantity);
            BigDecimal lineTotal = unit.multiply(qty);
            BigDecimal lineSavings = reference.subtract(unit).max(BigDecimal.ZERO).multiply(qty);

            items.add(new QuoteLine(product.getId(), product.getSlug(), product.getSku(), product.getNameRu(),
                    product.getNameKk(), product.getVolume(),
                    urls.url(product.getCoverThumbKey() != null ? product.getCoverThumbKey() : product.getCoverKey()),
                    unit, retail, product.getOldPrice(), quantity, max, lineTotal, lineSavings));
            itemsTotal = itemsTotal.add(lineTotal);
            retailTotal = retailTotal.add(reference.multiply(qty));
            savings = savings.add(lineSavings);
            count += quantity;
        }

        DeliveryMethod method = deliveryMethod == null ? DeliveryMethod.PICKUP : deliveryMethod;
        BigDecimal threshold = pricing.freeDeliveryThreshold();
        BigDecimal deliveryFee = BigDecimal.ZERO;
        BigDecimal toFree = threshold.subtract(itemsTotal).max(BigDecimal.ZERO);
        if (method == DeliveryMethod.DELIVERY && !items.isEmpty() && itemsTotal.compareTo(threshold) < 0) {
            deliveryFee = pricing.deliveryFee();
        }

        Quote quote = new Quote(tier, List.copyOf(items), count, itemsTotal, retailTotal, savings, method, deliveryFee,
                threshold, toFree, itemsTotal.add(deliveryFee), "KZT", List.copyOf(warnings));
        return new PricedCart(quote, byId);
    }

    private int maxQuantity(Product product) {
        int cap = pricing.maxQuantityPerItem();
        Integer stock = product.getStockQuantity();
        return stock == null ? cap : Math.max(0, Math.min(cap, stock));
    }

    /** Duplicate lines are summed and zero quantities dropped, keeping the shopper's order. */
    public static Map<Long, Integer> merge(List<CartLineInput> lines) {
        Map<Long, Integer> merged = new LinkedHashMap<>();
        if (lines == null) {
            return merged;
        }
        for (CartLineInput line : lines) {
            if (line != null && line.productId() != null && line.quantity() > 0) {
                merged.merge(line.productId(), line.quantity(), Integer::sum);
            }
        }
        return merged;
    }
}
