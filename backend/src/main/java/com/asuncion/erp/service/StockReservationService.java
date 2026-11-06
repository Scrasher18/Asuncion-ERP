package com.asuncion.erp.service;

import com.asuncion.erp.domain.entity.Part;
import com.asuncion.erp.dto.order.OrderItemRequest;
import com.asuncion.erp.repository.PartRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class StockReservationService {

    public static final long RESERVATION_TTL_SECONDS = 600L; // 10 minutes hold

    public record ReservedItemStatusDto(
            Long partId,
            String sku,
            String name,
            int requestedQuantity,
            int reservedQuantity,
            int physicalStock,
            int reservedByOthers,
            int availableForYou,
            String status,
            String message
    ) {
    }

    public record ReservationSyncRequest(
            String sessionId,
            List<OrderItemRequest> items
    ) {
    }

    public record ReservationSyncResponse(
            String sessionId,
            Instant expiresAt,
            long ttlSeconds,
            List<ReservedItemStatusDto> items
    ) {
    }

    private static class SessionHold {
        final String sessionId;
        final Map<Long, Integer> quantities;
        Instant expiresAt;

        SessionHold(String sessionId, Map<Long, Integer> quantities, Instant expiresAt) {
            this.sessionId = sessionId;
            this.quantities = new ConcurrentHashMap<>(quantities);
            this.expiresAt = expiresAt;
        }
    }

    private final Map<String, SessionHold> activeHolds = new ConcurrentHashMap<>();
    private final PartRepository partRepository;

    public StockReservationService(PartRepository partRepository) {
        this.partRepository = partRepository;
    }

    public synchronized void purgeExpired() {
        Instant now = Instant.now();
        activeHolds.entrySet().removeIf(entry -> entry.getValue().expiresAt.isBefore(now));
    }

    public synchronized int getReservedQuantity(Long partId) {
        if (partId == null) return 0;
        purgeExpired();
        int total = 0;
        for (SessionHold hold : activeHolds.values()) {
            total += hold.quantities.getOrDefault(partId, 0);
        }
        return total;
    }

    public synchronized int getReservedQuantityExcludingSession(Long partId, String sessionId) {
        if (partId == null) return 0;
        purgeExpired();
        String cleanSession = sessionId != null ? sessionId.trim() : "";
        int total = 0;
        for (Map.Entry<String, SessionHold> entry : activeHolds.entrySet()) {
            if (!cleanSession.isEmpty() && cleanSession.equals(entry.getKey())) {
                continue;
            }
            total += entry.getValue().quantities.getOrDefault(partId, 0);
        }
        return total;
    }

    public synchronized ReservationSyncResponse syncReservation(String rawSessionId, List<OrderItemRequest> items) {
        purgeExpired();
        String sessionId = (rawSessionId != null && !rawSessionId.isBlank())
                ? rawSessionId.trim()
                : UUID.randomUUID().toString();

        if (items == null || items.isEmpty()) {
            activeHolds.remove(sessionId);
            return new ReservationSyncResponse(sessionId, Instant.now(), 0L, List.of());
        }

        Map<Long, Integer> consolidated = new LinkedHashMap<>();
        for (OrderItemRequest req : items) {
            if (req != null && req.partId() != null && req.quantity() != null && req.quantity() > 0) {
                consolidated.merge(req.partId(), req.quantity(), Integer::sum);
            }
        }

        if (consolidated.isEmpty()) {
            activeHolds.remove(sessionId);
            return new ReservationSyncResponse(sessionId, Instant.now(), 0L, List.of());
        }

        Map<Long, Integer> grantedMap = new LinkedHashMap<>();
        List<ReservedItemStatusDto> statusList = new ArrayList<>();

        for (Map.Entry<Long, Integer> entry : consolidated.entrySet()) {
            Long partId = entry.getKey();
            int requested = entry.getValue();

            Optional<Part> partOpt = partRepository.findById(partId);
            if (partOpt.isEmpty() || !partOpt.get().isActive()) {
                statusList.add(new ReservedItemStatusDto(
                        partId,
                        "N/A",
                        "Repuesto no disponible",
                        requested,
                        0,
                        0,
                        0,
                        0,
                        "AGOTADO",
                        "Este repuesto ya no se encuentra disponible."
                ));
                continue;
            }

            Part part = partOpt.get();
            int physicalStock = Math.max(0, part.getStockQuantity() != null ? part.getStockQuantity() : 0);
            int reservedByOthers = getReservedQuantityExcludingSession(partId, sessionId);
            int availableForYou = Math.max(0, physicalStock - reservedByOthers);
            int granted = Math.min(requested, availableForYou);

            if (granted > 0) {
                grantedMap.put(partId, granted);
            }

            String status;
            String message;
            if (granted == requested && granted > 0) {
                status = "RESERVADO";
                message = "Stock reservado temporalmente para tu compra.";
            } else if (granted > 0) {
                status = "AJUSTADO_POR_RESERVA";
                message = reservedByOthers > 0
                        ? String.format("De las %d und. físicas de '%s', %d están en estado RESERVADO por otro cliente. Se reservaron %d und. para ti.",
                        physicalStock, part.getName(), reservedByOthers, granted)
                        : String.format("Solo quedan %d und. disponibles de '%s'.", granted, part.getName());
            } else {
                status = "AGOTADO_EN_RESERVA";
                message = reservedByOthers > 0
                        ? String.format("Las %d und. de '%s' están actualmente en estado RESERVADO por otro cliente en proceso de pago.",
                        physicalStock, part.getName())
                        : String.format("El repuesto '%s' se ha agotado.", part.getName());
            }

            statusList.add(new ReservedItemStatusDto(
                    partId,
                    part.getSku(),
                    part.getName(),
                    requested,
                    granted,
                    physicalStock,
                    reservedByOthers,
                    availableForYou,
                    status,
                    message
            ));
        }

        Instant expiresAt = Instant.now().plusSeconds(RESERVATION_TTL_SECONDS);
        if (grantedMap.isEmpty()) {
            activeHolds.remove(sessionId);
        } else {
            activeHolds.put(sessionId, new SessionHold(sessionId, grantedMap, expiresAt));
        }

        return new ReservationSyncResponse(sessionId, expiresAt, RESERVATION_TTL_SECONDS, statusList);
    }

    public synchronized void releaseSession(String sessionId) {
        if (sessionId != null && !sessionId.isBlank()) {
            activeHolds.remove(sessionId.trim());
        }
    }

    public synchronized Map<Long, Integer> getAllReservedQuantities() {
        purgeExpired();
        Map<Long, Integer> totals = new HashMap<>();
        for (SessionHold hold : activeHolds.values()) {
            for (Map.Entry<Long, Integer> e : hold.quantities.entrySet()) {
                totals.merge(e.getKey(), e.getValue(), Integer::sum);
            }
        }
        return totals;
    }
}
