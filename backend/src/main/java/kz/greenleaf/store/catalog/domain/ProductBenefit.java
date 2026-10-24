package kz.greenleaf.store.catalog.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

@Embeddable
public class ProductBenefit {

    @Column(name = "text_ru", nullable = false)
    private String textRu;

    @Column(name = "text_kk")
    private String textKk;

    protected ProductBenefit() {
    }

    public ProductBenefit(String textRu, String textKk) {
        this.textRu = textRu;
        this.textKk = textKk;
    }

    public String getTextRu() {
        return textRu;
    }

    public String getTextKk() {
        return textKk;
    }
}
