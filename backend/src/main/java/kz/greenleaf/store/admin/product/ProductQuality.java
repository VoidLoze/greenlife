package kz.greenleaf.store.admin.product;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Predicate;
import kz.greenleaf.store.admin.product.AdminProductDtos.Completeness;
import kz.greenleaf.store.catalog.domain.MediaKind;
import kz.greenleaf.store.catalog.domain.Product;
import kz.greenleaf.store.common.ApiException;

/**
 * Scores how complete a product card is (what a shopper would miss) and enforces the hard minimum for publishing.
 */
public final class ProductQuality {

    private record Check(int weight, String hint, Predicate<Product> passes) {
    }

    private static final List<Check> CHECKS = List.of(
            new Check(15, "Добавьте цену", p -> p.getPrice() != null),
            new Check(15, "Загрузите хотя бы одно фото", p -> hasMedia(p, MediaKind.PHOTO)),
            new Check(10, "Выберите категорию", p -> p.getCategory() != null),
            new Check(5, "Укажите бренд", p -> p.getBrand() != null),
            new Check(10, "Напишите краткое описание", p -> notBlank(p.getSummaryRu())),
            new Check(10, "Добавьте подробное описание", p -> notBlank(p.getDescriptionRu())),
            new Check(10, "Добавьте минимум 3 преимущества", p -> p.getBenefits().size() >= 3),
            new Check(5, "Опишите способ применения", p -> notBlank(p.getUsageRu())),
            new Check(5, "Заполните характеристики", p -> !p.getAttributes().isEmpty()),
            new Check(3, "Укажите объём или вес", p -> notBlank(p.getVolume())),
            new Check(3, "Добавьте ещё фото (лучше 3+)", p -> countMedia(p, MediaKind.PHOTO) >= 3),
            new Check(2, "Добавьте скрин из каталога", p -> hasMedia(p, MediaKind.SCREENSHOT)),
            new Check(5, "Переведите название на казахский", p -> notBlank(p.getNameKk())),
            new Check(2, "Переведите краткое описание на казахский", p -> notBlank(p.getSummaryKk())));

    private static final int TOTAL = CHECKS.stream().mapToInt(Check::weight).sum();

    private ProductQuality() {
    }

    public static Completeness evaluate(Product product) {
        int score = 0;
        List<String> missing = new ArrayList<>();
        for (Check check : CHECKS) {
            if (check.passes().test(product)) {
                score += check.weight();
            } else {
                missing.add(check.hint());
            }
        }
        return new Completeness(Math.round(score * 100f / TOTAL), missing);
    }

    public static void assertPublishable(Product product) {
        List<String> problems = new ArrayList<>();
        if (product.getPrice() == null || product.getPrice().signum() <= 0) {
            problems.add("Не указана цена");
        }
        if (product.getCategory() == null) {
            problems.add("Не выбрана категория");
        }
        if (product.getCoverKey() == null) {
            problems.add("Нет обложки — загрузите хотя бы одно фото");
        }
        if (product.getOldPrice() != null && product.getPrice() != null
                && product.getOldPrice().compareTo(product.getPrice()) <= 0) {
            problems.add("Старая цена должна быть больше текущей");
        }
        if (!problems.isEmpty()) {
            throw ApiException.unprocessable("not_ready_to_publish", "Товар нельзя опубликовать", problems);
        }
    }

    private static boolean hasMedia(Product p, MediaKind kind) {
        return p.getMedia().stream().anyMatch(m -> m.getKind() == kind);
    }

    private static long countMedia(Product p, MediaKind kind) {
        return p.getMedia().stream().filter(m -> m.getKind() == kind).count();
    }

    private static boolean notBlank(String value) {
        return value != null && !value.isBlank();
    }
}
