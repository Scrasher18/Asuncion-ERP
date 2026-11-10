package com.asuncion.erp.domain.entity;

import com.asuncion.erp.domain.enums.OrderStatus;
import jakarta.persistence.*;
import org.locationtech.jts.geom.Point;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "orders")
public class CustomerOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_number", nullable = false, unique = true, length = 30)
    private String orderNumber;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "customer_id", nullable = false)
    private AppUser customer;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "salesperson_id")
    private AppUser salesperson;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "warehouse_operator_id")
    private AppUser warehouseOperator;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "driver_id")
    private AppUser assignedDriver;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "branch_id", nullable = false)
    private Branch branch;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private OrderStatus status = OrderStatus.CONFIRMADO;

    @Column(name = "delivery_type", nullable = false, length = 20)
    private String deliveryType = "DELIVERY";

    @Column(name = "delivery_address", length = 500)
    private String deliveryAddress;

    @Column(name = "delivery_reference", length = 255)
    private String deliveryReference;

    @Column(name = "delivery_security_code", length = 10)
    private String deliverySecurityCode;

    @Column(name = "proximity_alert_sent")
    private Boolean proximityAlertSent = false;

    @Column(name = "delivery_location", columnDefinition = "geometry(Point, 4326)")
    private Point deliveryLocation;

    @Column(name = "calculated_distance_meters")
    private Double calculatedDistanceMeters;

    @Column(name = "invoice_type", length = 20)
    private String invoiceType;

    @Column(name = "customer_tax_id", length = 20)
    private String customerTaxId;

    @Column(name = "customer_business_name", length = 200)
    private String customerBusinessName;

    @Column(name = "billing_address", length = 300)
    private String billingAddress;

    @Column(name = "recipient_name", length = 150)
    private String recipientName;

    @Column(name = "recipient_phone", length = 30)
    private String recipientPhone;

    @Column(name = "payment_method", length = 30)
    private String paymentMethod;

    @Column(name = "subtotal", nullable = false, precision = 12, scale = 2)
    private BigDecimal subtotal = BigDecimal.ZERO;

    @Column(name = "tax_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal taxAmount = BigDecimal.ZERO;

    @Column(name = "delivery_fee", nullable = false, precision = 12, scale = 2)
    private BigDecimal deliveryFee = BigDecimal.ZERO;

    @Column(name = "total_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalAmount = BigDecimal.ZERO;

    @Column(name = "warehouse_notes", length = 1000)
    private String warehouseNotes;

    @Column(name = "notes", length = 1000)
    private String notes;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id ASC")
    private List<OrderItem> items = new ArrayList<>();

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("changedAt ASC, id ASC")
    private List<OrderStatusHistory> statusHistory = new ArrayList<>();

    @OneToOne(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    private DeliveryProof deliveryProof;

    @PrePersist
    public void onCreate() {
        Instant now = Instant.now();
        if (this.createdAt == null) {
            this.createdAt = now;
        }
        if (this.updatedAt == null) {
            this.updatedAt = this.createdAt;
        }
    }

    @PreUpdate
    public void onUpdate() {
        this.updatedAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getOrderNumber() {
        return orderNumber;
    }

    public void setOrderNumber(String orderNumber) {
        this.orderNumber = orderNumber;
    }

    public AppUser getCustomer() {
        return customer;
    }

    public void setCustomer(AppUser customer) {
        this.customer = customer;
    }

    public AppUser getSalesperson() {
        return salesperson;
    }

    public void setSalesperson(AppUser salesperson) {
        this.salesperson = salesperson;
    }

    public AppUser getWarehouseOperator() {
        return warehouseOperator;
    }

    public void setWarehouseOperator(AppUser warehouseOperator) {
        this.warehouseOperator = warehouseOperator;
    }

    public AppUser getAssignedDriver() {
        return assignedDriver;
    }

    public void setAssignedDriver(AppUser assignedDriver) {
        this.assignedDriver = assignedDriver;
    }

    public Branch getBranch() {
        return branch;
    }

    public void setBranch(Branch branch) {
        this.branch = branch;
    }

    public OrderStatus getStatus() {
        return status;
    }

    public void setStatus(OrderStatus status) {
        this.status = status;
    }

    public String getDeliveryType() {
        return deliveryType;
    }

    public void setDeliveryType(String deliveryType) {
        this.deliveryType = deliveryType;
    }

    public String getDeliveryAddress() {
        return deliveryAddress;
    }

    public void setDeliveryAddress(String deliveryAddress) {
        this.deliveryAddress = deliveryAddress;
    }

    public String getDeliveryReference() {
        return deliveryReference;
    }

    public void setDeliveryReference(String deliveryReference) {
        this.deliveryReference = deliveryReference;
    }

    public Point getDeliveryLocation() {
        return deliveryLocation;
    }

    public Double getDeliveryLatitude() {
        return deliveryLocation != null ? deliveryLocation.getY() : null;
    }

    public Double getDeliveryLongitude() {
        return deliveryLocation != null ? deliveryLocation.getX() : null;
    }

    public void setDeliveryLocation(Point deliveryLocation) {
        this.deliveryLocation = deliveryLocation;
    }

    public Double getCalculatedDistanceMeters() {
        return calculatedDistanceMeters;
    }

    public void setCalculatedDistanceMeters(Double calculatedDistanceMeters) {
        this.calculatedDistanceMeters = calculatedDistanceMeters;
    }

    public String getInvoiceType() {
        return invoiceType;
    }

    public void setInvoiceType(String invoiceType) {
        this.invoiceType = invoiceType;
    }

    public String getCustomerTaxId() {
        return customerTaxId;
    }

    public void setCustomerTaxId(String customerTaxId) {
        this.customerTaxId = customerTaxId;
    }

    public String getCustomerBusinessName() {
        return customerBusinessName;
    }

    public void setCustomerBusinessName(String customerBusinessName) {
        this.customerBusinessName = customerBusinessName;
    }

    public String getBillingAddress() {
        return billingAddress;
    }

    public void setBillingAddress(String billingAddress) {
        this.billingAddress = billingAddress;
    }

    public String getRecipientName() {
        return recipientName;
    }

    public void setRecipientName(String recipientName) {
        this.recipientName = recipientName;
    }

    public String getRecipientPhone() {
        return recipientPhone;
    }

    public void setRecipientPhone(String recipientPhone) {
        this.recipientPhone = recipientPhone;
    }

    public String getPaymentMethod() {
        return paymentMethod;
    }

    public void setPaymentMethod(String paymentMethod) {
        this.paymentMethod = paymentMethod;
    }

    public BigDecimal getSubtotal() {
        return subtotal;
    }

    public void setSubtotal(BigDecimal subtotal) {
        this.subtotal = subtotal;
    }

    public BigDecimal getTaxAmount() {
        return taxAmount;
    }

    public void setTaxAmount(BigDecimal taxAmount) {
        this.taxAmount = taxAmount;
    }

    public BigDecimal getDeliveryFee() {
        return deliveryFee;
    }

    public void setDeliveryFee(BigDecimal deliveryFee) {
        this.deliveryFee = deliveryFee;
    }

    public BigDecimal getTotalAmount() {
        return totalAmount;
    }

    public void setTotalAmount(BigDecimal totalAmount) {
        this.totalAmount = totalAmount;
    }

    public String getWarehouseNotes() {
        return warehouseNotes;
    }

    public void setWarehouseNotes(String warehouseNotes) {
        this.warehouseNotes = warehouseNotes;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public List<OrderItem> getItems() {
        return items;
    }

    public void setItems(List<OrderItem> items) {
        this.items = items;
    }

    public List<OrderStatusHistory> getStatusHistory() {
        return statusHistory;
    }

    public void setStatusHistory(List<OrderStatusHistory> statusHistory) {
        this.statusHistory = statusHistory;
    }

    public DeliveryProof getDeliveryProof() {
        return deliveryProof;
    }

    public void setDeliveryProof(DeliveryProof deliveryProof) {
        this.deliveryProof = deliveryProof;
    }

    public String getDeliverySecurityCode() {
        return deliverySecurityCode;
    }

    public void setDeliverySecurityCode(String deliverySecurityCode) {
        this.deliverySecurityCode = deliverySecurityCode;
    }

    public Boolean getProximityAlertSent() {
        return proximityAlertSent;
    }

    public void setProximityAlertSent(Boolean proximityAlertSent) {
        this.proximityAlertSent = proximityAlertSent;
    }
}
