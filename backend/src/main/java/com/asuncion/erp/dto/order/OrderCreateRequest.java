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
        String reservationSessionId,

        @NotEmpty(message = "El pedido debe contener al menos un repuesto")
        @Valid
        List<OrderItemRequest> items,

        List<CustomComboPairRequest> customCombos
) {
    public OrderCreateRequest(
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
            String reservationSessionId,
            List<OrderItemRequest> items
    ) {
        this(
                branchId, deliveryType, deliveryAddress, deliveryReference,
                deliveryLatitude, deliveryLongitude, recipientName, recipientPhone,
                invoiceType, billingDocumentNumber, customerTaxId, billingBusinessName,
                customerBusinessName, paymentMethod, notes, salespersonId, reservationSessionId, items, List.of()
        );
    }

    public OrderCreateRequest(
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
            List<OrderItemRequest> items
    ) {
        this(
                branchId, deliveryType, deliveryAddress, deliveryReference,
                deliveryLatitude, deliveryLongitude, recipientName, recipientPhone,
                invoiceType, billingDocumentNumber, customerTaxId, billingBusinessName,
                customerBusinessName, paymentMethod, notes, salespersonId, null, items, List.of()
        );
    }
}
