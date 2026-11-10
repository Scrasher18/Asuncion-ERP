package com.asuncion.erp.dto.order;

/**
 * Solicitud para actualizar el estado operativo de un pedido desde el panel de administración o caja,
 * soportando tanto envíos a domicilio (DELIVERY) como entregas/cobros en mostrador (PICKUP).
 */
public record UpdateOrderStatusRequest(
        String status,
        Long assignedDriverId,
        String paymentMethod,
        String receiverName,
        String receiverDocument,
        String notes
) {
}
