package com.asuncion.erp.domain.entity;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(
        name = "sales_quotas",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_salesperson_period",
                columnNames = {"salesperson_id", "period_year", "period_month"}
        )
)
public class SalesQuota {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "salesperson_id", nullable = false)
    private AppUser salesperson;

    @Column(name = "period_year", nullable = false)
    private Short periodYear;

    @Column(name = "period_month", nullable = false)
    private Short periodMonth;

    @Column(name = "target_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal targetAmount;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public SalesQuota() {
    }

    public SalesQuota(AppUser salesperson, Short periodYear, Short periodMonth, BigDecimal targetAmount) {
        this.salesperson = salesperson;
        this.periodYear = periodYear;
        this.periodMonth = periodMonth;
        this.targetAmount = targetAmount;
        this.createdAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public AppUser getSalesperson() {
        return salesperson;
    }

    public void setSalesperson(AppUser salesperson) {
        this.salesperson = salesperson;
    }

    public Short getPeriodYear() {
        return periodYear;
    }

    public void setPeriodYear(Short periodYear) {
        this.periodYear = periodYear;
    }

    public Short getPeriodMonth() {
        return periodMonth;
    }

    public void setPeriodMonth(Short periodMonth) {
        this.periodMonth = periodMonth;
    }

    public BigDecimal getTargetAmount() {
        return targetAmount;
    }

    public void setTargetAmount(BigDecimal targetAmount) {
        this.targetAmount = targetAmount;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
