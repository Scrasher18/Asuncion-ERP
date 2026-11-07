package com.asuncion.erp.domain.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "part_promotions")
public class PartPromotionEntity {

    @Id
    @Column(name = "sku", length = 50, nullable = false)
    private String sku;

    @Column(name = "part_id")
    private Long partId;

    @Column(name = "part_name", length = 200, nullable = false)
    private String partName;

    @Column(name = "category_name", length = 120)
    private String categoryName;

    @Column(name = "original_price", precision = 12, scale = 2, nullable = false)
    private BigDecimal originalPrice;

    @Column(name = "purchase_price", precision = 12, scale = 2, nullable = false)
    private BigDecimal purchasePrice;

    @Column(name = "promo_price", precision = 12, scale = 2, nullable = false)
    private BigDecimal promoPrice;

    @Column(name = "discount_percentage", nullable = false)
    private Integer discountPercentage;

    @Column(name = "badge_label", length = 60, nullable = false)
    private String badgeLabel;

    @Column(name = "promo_type", length = 30, nullable = false)
    private String promoType;

    @Column(name = "combo_complement_sku", length = 50)
    private String comboComplementSku;

    @Column(name = "combo_complement_name", length = 200)
    private String comboComplementName;

    @Column(name = "combo_complement_price", precision = 12, scale = 2)
    private BigDecimal comboComplementPrice;

    @Column(name = "combo_complement_promo_price", precision = 12, scale = 2)
    private BigDecimal comboComplementPromoPrice;

    @Column(name = "combo_total_promo_price", precision = 12, scale = 2)
    private BigDecimal comboTotalPromoPrice;

    @Column(name = "units_quota", nullable = false)
    private Integer unitsQuota = 10;

    @Column(name = "units_sold_in_promo", nullable = false)
    private Integer unitsSoldInPromo = 0;

    @Column(name = "active", nullable = false)
    private boolean active = true;

    @Column(name = "start_date", length = 30)
    private String startDate;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public String getSku() {
        return sku;
    }

    public void setSku(String sku) {
        this.sku = sku;
    }

    public Long getPartId() {
        return partId;
    }

    public void setPartId(Long partId) {
        this.partId = partId;
    }

    public String getPartName() {
        return partName;
    }

    public void setPartName(String partName) {
        this.partName = partName;
    }

    public String getCategoryName() {
        return categoryName;
    }

    public void setCategoryName(String categoryName) {
        this.categoryName = categoryName;
    }

    public BigDecimal getOriginalPrice() {
        return originalPrice;
    }

    public void setOriginalPrice(BigDecimal originalPrice) {
        this.originalPrice = originalPrice;
    }

    public BigDecimal getPurchasePrice() {
        return purchasePrice;
    }

    public void setPurchasePrice(BigDecimal purchasePrice) {
        this.purchasePrice = purchasePrice;
    }

    public BigDecimal getPromoPrice() {
        return promoPrice;
    }

    public void setPromoPrice(BigDecimal promoPrice) {
        this.promoPrice = promoPrice;
    }

    public Integer getDiscountPercentage() {
        return discountPercentage;
    }

    public void setDiscountPercentage(Integer discountPercentage) {
        this.discountPercentage = discountPercentage;
    }

    public String getBadgeLabel() {
        return badgeLabel;
    }

    public void setBadgeLabel(String badgeLabel) {
        this.badgeLabel = badgeLabel;
    }

    public String getPromoType() {
        return promoType;
    }

    public void setPromoType(String promoType) {
        this.promoType = promoType;
    }

    public String getComboComplementSku() {
        return comboComplementSku;
    }

    public void setComboComplementSku(String comboComplementSku) {
        this.comboComplementSku = comboComplementSku;
    }

    public String getComboComplementName() {
        return comboComplementName;
    }

    public void setComboComplementName(String comboComplementName) {
        this.comboComplementName = comboComplementName;
    }

    public BigDecimal getComboComplementPrice() {
        return comboComplementPrice;
    }

    public void setComboComplementPrice(BigDecimal comboComplementPrice) {
        this.comboComplementPrice = comboComplementPrice;
    }

    public BigDecimal getComboComplementPromoPrice() {
        return comboComplementPromoPrice;
    }

    public void setComboComplementPromoPrice(BigDecimal comboComplementPromoPrice) {
        this.comboComplementPromoPrice = comboComplementPromoPrice;
    }

    public BigDecimal getComboTotalPromoPrice() {
        return comboTotalPromoPrice;
    }

    public void setComboTotalPromoPrice(BigDecimal comboTotalPromoPrice) {
        this.comboTotalPromoPrice = comboTotalPromoPrice;
    }

    public Integer getUnitsQuota() {
        return unitsQuota;
    }

    public void setUnitsQuota(Integer unitsQuota) {
        this.unitsQuota = unitsQuota;
    }

    public Integer getUnitsSoldInPromo() {
        return unitsSoldInPromo;
    }

    public void setUnitsSoldInPromo(Integer unitsSoldInPromo) {
        this.unitsSoldInPromo = unitsSoldInPromo;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public String getStartDate() {
        return startDate;
    }

    public void setStartDate(String startDate) {
        this.startDate = startDate;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
