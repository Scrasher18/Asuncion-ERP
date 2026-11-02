package com.asuncion.erp.exception;

public class OutOfCoverageException extends RuntimeException {

    private final double distanceMeters;
    private final double allowedRadiusMeters;

    public OutOfCoverageException(String message, double distanceMeters, double allowedRadiusMeters) {
        super(message);
        this.distanceMeters = distanceMeters;
        this.allowedRadiusMeters = allowedRadiusMeters;
    }

    public double getDistanceMeters() {
        return distanceMeters;
    }

    public double getAllowedRadiusMeters() {
        return allowedRadiusMeters;
    }
}
