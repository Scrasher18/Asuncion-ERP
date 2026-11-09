package com.asuncion.erp.dto;

import java.util.List;

public record DriverReviewDto(
        String id,
        String orderNumber,
        String driverName,
        String driverEmail,
        String customerName,
        int stars,
        List<String> tags,
        String comment,
        String createdAt
) {}
