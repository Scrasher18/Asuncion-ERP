package com.asuncion.erp.domain.entity;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "complaints_book")
public class ComplaintRecordEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "sheet_number", nullable = false, unique = true, length = 40)
    private String sheetNumber;

    @Column(name = "created_at_label", nullable = false, length = 60)
    private String createdAtLabel;

    @Column(name = "doc_type", nullable = false, length = 20)
    private String docType;

    @Column(name = "doc_number", nullable = false, length = 30)
    private String docNumber;

    @Column(name = "full_name", nullable = false, length = 200)
    private String fullName;

    @Column(name = "address", nullable = false, length = 300)
    private String address;

    @Column(name = "phone", nullable = false, length = 40)
    private String phone;

    @Column(name = "email", nullable = false, length = 160)
    private String email;

    @Column(name = "good_type", nullable = false, length = 30)
    private String goodType;

    @Column(name = "claimed_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal claimedAmount = BigDecimal.ZERO;

    @Column(name = "good_description", nullable = false, length = 500)
    private String goodDescription;

    @Column(name = "claim_type", nullable = false, length = 30)
    private String claimType;

    @Column(name = "claim_detail", nullable = false, length = 2000)
    private String claimDetail;

    @Column(name = "claim_request", nullable = false, length = 2000)
    private String claimRequest;

    @Column(name = "status", nullable = false, length = 30)
    private String status = "PENDIENTE";

    @Column(name = "admin_response_note", length = 2000)
    private String adminResponseNote;

    @Column(name = "resolved_at_label", length = 60)
    private String resolvedAtLabel;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getSheetNumber() {
        return sheetNumber;
    }

    public void setSheetNumber(String sheetNumber) {
        this.sheetNumber = sheetNumber;
    }

    public String getCreatedAtLabel() {
        return createdAtLabel;
    }

    public void setCreatedAtLabel(String createdAtLabel) {
        this.createdAtLabel = createdAtLabel;
    }

    public String getDocType() {
        return docType;
    }

    public void setDocType(String docType) {
        this.docType = docType;
    }

    public String getDocNumber() {
        return docNumber;
    }

    public void setDocNumber(String docNumber) {
        this.docNumber = docNumber;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
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

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getGoodType() {
        return goodType;
    }

    public void setGoodType(String goodType) {
        this.goodType = goodType;
    }

    public BigDecimal getClaimedAmount() {
        return claimedAmount;
    }

    public void setClaimedAmount(BigDecimal claimedAmount) {
        this.claimedAmount = claimedAmount;
    }

    public String getGoodDescription() {
        return goodDescription;
    }

    public void setGoodDescription(String goodDescription) {
        this.goodDescription = goodDescription;
    }

    public String getClaimType() {
        return claimType;
    }

    public void setClaimType(String claimType) {
        this.claimType = claimType;
    }

    public String getClaimDetail() {
        return claimDetail;
    }

    public void setClaimDetail(String claimDetail) {
        this.claimDetail = claimDetail;
    }

    public String getClaimRequest() {
        return claimRequest;
    }

    public void setClaimRequest(String claimRequest) {
        this.claimRequest = claimRequest;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getAdminResponseNote() {
        return adminResponseNote;
    }

    public void setAdminResponseNote(String adminResponseNote) {
        this.adminResponseNote = adminResponseNote;
    }

    public String getResolvedAtLabel() {
        return resolvedAtLabel;
    }

    public void setResolvedAtLabel(String resolvedAtLabel) {
        this.resolvedAtLabel = resolvedAtLabel;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
