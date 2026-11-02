package com.asuncion.erp.dto.order;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record OrderCreateRequest(
        Long branchId,
        String deliveryType,
        String deliveryAddress,
        String deliveryReference,
        Double deliveryLatitude,
        Double deliveryLongitude,
        String recipientName,
        String recipientPhone,
        String invoiceType,
        String billingDocumentNumber,
        String customerTaxId,
        String billingBusinessName,
        String customerBusinessName,
        String paymentMethod,
        String notes,
        Long salespersonId,

        @NotEmpty(message = "El pedido debe contener al menos un repuesto")
        @Valid
        List<OrderItemRequest> items
) {
}
