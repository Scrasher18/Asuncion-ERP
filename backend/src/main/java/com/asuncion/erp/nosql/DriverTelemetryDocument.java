package com.asuncion.erp.nosql;

import java.io.Serializable;
import java.time.Instant;

/**
 * NoSQL Document representing a high-velocity GPS telemetry location ping
 * from a motorizado delivery driver on route.
 * Stored in MongoDB collection "driver_telemetry_locations" and replicated
 * to the resilient local NoSQL document engine.
 */
public class DriverTelemetryDocument implements Serializable {

    private String id;
    private Long orderId;
    private String orderNumber;
    private Long driverId;
    private String driverName;
    private String driverPhone;
    private Double latitude;
    private Double longitude;
    private Double speedKmh;
    private Double headingDegrees;
    private Double accuracyMeters;
    private Integer batteryPercent;
    private Double distanceRemainingMeters;
    private Integer etaMinutes;
    private String status; // "EN_CAMINO", "LLEGANDO", "ENTREGADO"
    private Instant timestamp;
    private String recordedAt;

    public DriverTelemetryDocument() {
    }

    public DriverTelemetryDocument(
            String id,
            Long orderId,
            String orderNumber,
            Long driverId,
            String driverName,
            String driverPhone,
            Double latitude,
            Double longitude,
            Double speedKmh,
            Double headingDegrees,
            Double accuracyMeters,
            Integer batteryPercent,
            Double distanceRemainingMeters,
            Integer etaMinutes,
            String status,
            Instant timestamp,
            String recordedAt
    ) {
        this.id = id;
        this.orderId = orderId;
        this.orderNumber = orderNumber;
        this.driverId = driverId;
        this.driverName = driverName;
        this.driverPhone = driverPhone;
        this.latitude = latitude;
        this.longitude = longitude;
        this.speedKmh = speedKmh;
        this.headingDegrees = headingDegrees;
        this.accuracyMeters = accuracyMeters;
        this.batteryPercent = batteryPercent;
        this.distanceRemainingMeters = distanceRemainingMeters;
        this.etaMinutes = etaMinutes;
        this.status = status;
        this.timestamp = timestamp;
        this.recordedAt = recordedAt;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public Long getOrderId() {
        return orderId;
    }

    public void setOrderId(Long orderId) {
        this.orderId = orderId;
    }

    public String getOrderNumber() {
        return orderNumber;
    }

    public void setOrderNumber(String orderNumber) {
        this.orderNumber = orderNumber;
    }

    public Long getDriverId() {
        return driverId;
    }

    public void setDriverId(Long driverId) {
        this.driverId = driverId;
    }

    public String getDriverName() {
        return driverName;
    }

    public void setDriverName(String driverName) {
        this.driverName = driverName;
    }

    public String getDriverPhone() {
        return driverPhone;
    }

    public void setDriverPhone(String driverPhone) {
        this.driverPhone = driverPhone;
    }

    public Double getLatitude() {
        return latitude;
    }

    public void setLatitude(Double latitude) {
        this.latitude = latitude;
    }

    public Double getLongitude() {
        return longitude;
    }

    public void setLongitude(Double longitude) {
        this.longitude = longitude;
    }

    public Double getSpeedKmh() {
        return speedKmh;
    }

    public void setSpeedKmh(Double speedKmh) {
        this.speedKmh = speedKmh;
    }

    public Double getHeadingDegrees() {
        return headingDegrees;
    }

    public void setHeadingDegrees(Double headingDegrees) {
        this.headingDegrees = headingDegrees;
    }

    public Double getAccuracyMeters() {
        return accuracyMeters;
    }

    public void setAccuracyMeters(Double accuracyMeters) {
        this.accuracyMeters = accuracyMeters;
    }

    public Integer getBatteryPercent() {
        return batteryPercent;
    }

    public void setBatteryPercent(Integer batteryPercent) {
        this.batteryPercent = batteryPercent;
    }

    public Double getDistanceRemainingMeters() {
        return distanceRemainingMeters;
    }

    public void setDistanceRemainingMeters(Double distanceRemainingMeters) {
        this.distanceRemainingMeters = distanceRemainingMeters;
    }

    public Integer getEtaMinutes() {
        return etaMinutes;
    }

    public void setEtaMinutes(Integer etaMinutes) {
        this.etaMinutes = etaMinutes;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Instant getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(Instant timestamp) {
        this.timestamp = timestamp;
    }

    public String getRecordedAt() {
        return recordedAt;
    }

    public void setRecordedAt(String recordedAt) {
        this.recordedAt = recordedAt;
    }
}
