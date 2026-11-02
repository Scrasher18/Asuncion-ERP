package com.asuncion.erp.domain.entity;

public enum DriverStatus {
    DISPONIBLE,      // En base/tienda, listo para recibir un nuevo pedido
    EN_RUTA,         // En camino realizando la entrega al cliente (ocupado)
    RETORNANDO,      // Pedido entregado, en camino de regreso a tienda
    FUERA_DE_TURNO   // Desconectado o fuera de horario
}
