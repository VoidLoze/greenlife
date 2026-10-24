package kz.greenleaf.store.catalog.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

@Embeddable
public class ProductAttribute {

    @Column(name = "name_ru", nullable = false)
    private String nameRu;

    @Column(name = "value_ru", nullable = false)
    private String valueRu;

    @Column(name = "name_kk")
    private String nameKk;

    @Column(name = "value_kk")
    private String valueKk;

    protected ProductAttribute() {
    }

    public ProductAttribute(String nameRu, String valueRu, String nameKk, String valueKk) {
        this.nameRu = nameRu;
        this.valueRu = valueRu;
        this.nameKk = nameKk;
        this.valueKk = valueKk;
    }

    public String getNameRu() {
        return nameRu;
    }

    public String getValueRu() {
        return valueRu;
    }

    public String getNameKk() {
        return nameKk;
    }

    public String getValueKk() {
        return valueKk;
    }
}
