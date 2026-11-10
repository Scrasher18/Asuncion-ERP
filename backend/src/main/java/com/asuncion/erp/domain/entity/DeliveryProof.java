package com.asuncion.erp.domain.entity;

import jakarta.persistence.*;
import org.locationtech.jts.geom.Point;

import java.time.Instant;

@Entity
@Table(name = "delivery_proofs")
public class DeliveryProof {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false, unique = true)
    private CustomerOrder order;

    @ManyToOne(fetch = FetchType.EAGER, optional = true)
    @JoinColumn(name = "driver_id", nullable = true)
    private AppUser driver;

    @Column(name = "evidence_object_key", length = 500)
    private String evidenceObjectKey;

    @Column(name = "evidence_image_url", length = 1000)
    private String evidenceImageUrl;

    @Column(name = "receiver_name", nullable = false, length = 150)
    private String receiverName;

    @Column(name = "receiver_document", length = 30)
    private String receiverDocument;

    @Column(name = "captured_location", columnDefinition = "geometry(Point, 4326)")
    private Point capturedLocation;

    @Column(name = "delivery_notes", length = 500)
    private String deliveryNotes;

    @Column(name = "delivered_at", nullable = false)
    private Instant deliveredAt = Instant.now();

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public CustomerOrder getOrder() {
        return order;
    }

    public void setOrder(CustomerOrder order) {
        this.order = order;
    }

    public AppUser getDriver() {
        return driver;
    }

    public void setDriver(AppUser driver) {
        this.driver = driver;
    }

    public String getEvidenceObjectKey() {
        return evidenceObjectKey;
    }

    public void setEvidenceObjectKey(String evidenceObjectKey) {
        this.evidenceObjectKey = evidenceObjectKey;
    }

    public String getEvidenceImageUrl() {
        return evidenceImageUrl;
    }

    public void setEvidenceImageUrl(String evidenceImageUrl) {
        this.evidenceImageUrl = evidenceImageUrl;
    }

    public String getReceiverName() {
        return receiverName;
    }

    public void setReceiverName(String receiverName) {
        this.receiverName = receiverName;
    }

    public String getReceiverDocument() {
        return receiverDocument;
    }

    public void setReceiverDocument(String receiverDocument) {
        this.receiverDocument = receiverDocument;
    }

    public Point getCapturedLocation() {
        return capturedLocation;
    }

    public void setCapturedLocation(Point capturedLocation) {
        this.capturedLocation = capturedLocation;
    }

    public String getDeliveryNotes() {
        return deliveryNotes;
    }

    public void setDeliveryNotes(String deliveryNotes) {
        this.deliveryNotes = deliveryNotes;
    }

    public Instant getDeliveredAt() {
        return deliveredAt;
    }

    public void setDeliveredAt(Instant deliveredAt) {
        this.deliveredAt = deliveredAt;
    }
}
