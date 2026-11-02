package com.asuncion.erp.domain.entity;

import jakarta.persistence.*;
import org.locationtech.jts.geom.Point;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "branches")
public class Branch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "code", nullable = false, unique = true, length = 20)
    private String code;

    @Column(name = "name", nullable = false, length = 150)
    private String name;

    @Column(name = "address", nullable = false, length = 255)
    private String address;

    @Column(name = "phone", length = 30)
    private String phone;

    @Column(name = "location", nullable = false, columnDefinition = "geometry(Point, 4326)")
    private Point location;

    @Column(name = "coverage_radius_meters", nullable = false)
    private Double coverageRadiusMeters;

    @Column(name = "base_delivery_fee", nullable = false, precision = 10, scale = 2)
    private BigDecimal baseDeliveryFee = BigDecimal.ZERO;

    @Column(name = "per_km_fee", nullable = false, precision = 10, scale = 2)
    private BigDecimal perKmFee = BigDecimal.ZERO;

    @Column(name = "active", nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @PrePersist
    public void onCreate() {
        Instant now = Instant.now();
        if (this.createdAt == null) {
            this.createdAt = now;
        }
        this.updatedAt = now;
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

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public Point getLocation() {
        return location;
    }

    public Double getLatitude() {
        return location != null ? location.getY() : null;
    }

    public Double getLongitude() {
        return location != null ? location.getX() : null;
    }

    public void setLocation(Point location) {
        this.location = location;
    }

    public Double getCoverageRadiusMeters() {
        return coverageRadiusMeters;
    }

    public void setCoverageRadiusMeters(Double coverageRadiusMeters) {
        this.coverageRadiusMeters = coverageRadiusMeters;
    }

    public BigDecimal getBaseDeliveryFee() {
        return baseDeliveryFee;
    }

    public void setBaseDeliveryFee(BigDecimal baseDeliveryFee) {
        this.baseDeliveryFee = baseDeliveryFee;
    }

    public BigDecimal getPerKmFee() {
        return perKmFee;
    }

    public void setPerKmFee(BigDecimal perKmFee) {
        this.perKmFee = perKmFee;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
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
}
