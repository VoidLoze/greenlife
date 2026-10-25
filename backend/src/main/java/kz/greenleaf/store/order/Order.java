package kz.greenleaf.store.order;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import kz.greenleaf.store.common.AuditedEntity;
import kz.greenleaf.store.order.OrderEnums.DeliveryMethod;
import kz.greenleaf.store.order.OrderEnums.OrderStatus;
import kz.greenleaf.store.order.OrderEnums.PaymentMethod;
import kz.greenleaf.store.order.OrderEnums.PriceTier;

@Entity(name = "CustomerOrder")
@Table(name = "orders")
public class Order extends AuditedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String number;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "customer_name", nullable = false)
    private String customerName;

    @Column(nullable = false)
    private String phone;

    private String email;

    private String city;

    private String address;

    private String comment;

    @Enumerated(EnumType.STRING)
    @Column(name = "delivery_method", nullable = false)
    private DeliveryMethod deliveryMethod;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method", nullable = false)
    private PaymentMethod paymentMethod;

    @Enumerated(EnumType.STRING)
    @Column(name = "price_tier", nullable = false)
    private PriceTier priceTier;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OrderStatus status = OrderStatus.NEW;

    @Column(name = "items_total", nullable = false)
    private BigDecimal itemsTotal;

    @Column(name = "savings_total", nullable = false)
    private BigDecimal savingsTotal = BigDecimal.ZERO;

    @Column(name = "delivery_fee", nullable = false)
    private BigDecimal deliveryFee = BigDecimal.ZERO;

    @Column(nullable = false)
    private BigDecimal total;

    @Column(nullable = false)
    private String currency = "KZT";

    @Column(name = "admin_note")
    private String adminNote;

    @Version
    private long version;

    @Column(name = "idempotency_key", updatable = false)
    private String idempotencyKey;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id ASC")
    private List<OrderItem> items = new ArrayList<>();

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("createdAt ASC, id ASC")
    private List<OrderStatusChange> history = new ArrayList<>();

    protected Order() {
    }

    public Order(String number, Long userId, String customerName, String phone, DeliveryMethod deliveryMethod,
                 PaymentMethod paymentMethod, PriceTier priceTier) {
        this.number = number;
        this.userId = userId;
        this.customerName = customerName;
        this.phone = phone;
        this.deliveryMethod = deliveryMethod;
        this.paymentMethod = paymentMethod;
        this.priceTier = priceTier;
    }

    public void addItem(OrderItem item) {
        items.add(item);
        item.attachTo(this);
    }

    public void recordStatus(OrderStatus newStatus, String note, Long changedBy) {
        this.status = newStatus;
        OrderStatusChange change = new OrderStatusChange(newStatus, note, changedBy);
        history.add(change);
        change.attachTo(this);
    }

    public void setTotals(BigDecimal itemsTotal, BigDecimal savingsTotal, BigDecimal deliveryFee, BigDecimal total) {
        this.itemsTotal = itemsTotal;
        this.savingsTotal = savingsTotal;
        this.deliveryFee = deliveryFee;
        this.total = total;
    }

    public Long getId() {
        return id;
    }

    public String getNumber() {
        return number;
    }

    public Long getUserId() {
        return userId;
    }

    public String getCustomerName() {
        return customerName;
    }

    public String getPhone() {
        return phone;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getCity() {
        return city;
    }

    public void setCity(String city) {
        this.city = city;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public String getComment() {
        return comment;
    }

    public void setComment(String comment) {
        this.comment = comment;
    }

    public DeliveryMethod getDeliveryMethod() {
        return deliveryMethod;
    }

    public PaymentMethod getPaymentMethod() {
        return paymentMethod;
    }

    public PriceTier getPriceTier() {
        return priceTier;
    }

    public OrderStatus getStatus() {
        return status;
    }

    public BigDecimal getItemsTotal() {
        return itemsTotal;
    }

    public BigDecimal getSavingsTotal() {
        return savingsTotal;
    }

    public BigDecimal getDeliveryFee() {
        return deliveryFee;
    }

    public BigDecimal getTotal() {
        return total;
    }

    public String getCurrency() {
        return currency;
    }

    public String getAdminNote() {
        return adminNote;
    }

    public void setAdminNote(String adminNote) {
        this.adminNote = adminNote;
    }

    public String getIdempotencyKey() {
        return idempotencyKey;
    }

    public void setIdempotencyKey(String idempotencyKey) {
        this.idempotencyKey = idempotencyKey;
    }

    public List<OrderItem> getItems() {
        return items;
    }

    public List<OrderStatusChange> getHistory() {
        return history;
    }
}
