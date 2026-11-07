package com.asuncion.erp.controller;

import com.asuncion.erp.domain.entity.ComplaintRecordEntity;
import com.asuncion.erp.exception.ResourceNotFoundException;
import com.asuncion.erp.repository.ComplaintRepository;
import com.asuncion.erp.service.EmailNotificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.annotation.PostConstruct;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;

@RestController
@RequestMapping("/api/v1/complaints")
@Tag(name = "09. Libro de Reclamaciones Virtual (INDECOPI)", description = "Registro público y gestión administrativa de Hojas de Reclamación conforme a Ley N° 29571")
public class ComplaintController {

    private static final DateTimeFormatter LIMA_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")
            .withZone(ZoneId.of("America/Lima"));

    public record ComplaintDto(
            String id,
            String sheetNumber,
            String createdAt,
            String docType,
            String docNumber,
            String fullName,
            String address,
            String phone,
            String email,
            String goodType,
            BigDecimal claimedAmount,
            String goodDescription,
            String claimType,
            String claimDetail,
            String claimRequest,
            String status,
            String adminResponseNote,
            String resolvedAt
    ) {
    }

    public record CreateComplaintRequest(
            String docType,
            String docNumber,
            String fullName,
            String address,
            String phone,
            String email,
            String goodType,
            BigDecimal claimedAmount,
            String goodDescription,
            String claimType,
            String claimDetail,
            String claimRequest
    ) {
    }

    public record ResolveComplaintRequest(
            String responseNote
    ) {
    }

    private final ComplaintRepository complaintRepository;
    private final EmailNotificationService emailNotificationService;

    public ComplaintController(
            ComplaintRepository complaintRepository,
            EmailNotificationService emailNotificationService
    ) {
        this.complaintRepository = complaintRepository;
        this.emailNotificationService = emailNotificationService;
    }

    @PostConstruct
    @Transactional
    public void seedInitialComplaintsIfEmpty() {
        if (complaintRepository.count() > 0) {
            return;
        }
        ComplaintRecordEntity c1 = new ComplaintRecordEntity();
        c1.setSheetNumber("LR-2026-0001");
        c1.setCreatedAtLabel("04/11/2026 16:40");
        c1.setDocType("DNI");
        c1.setDocNumber("45892104");
        c1.setFullName("Roberto Carlos Quispe Huamán");
        c1.setAddress("Av. Los Chancas 420, Santa Anita, Lima");
        c1.setPhone("987654312");
        c1.setEmail("rquispe.taller@gmail.com");
        c1.setGoodType("PRODUCTO");
        c1.setClaimedAmount(new BigDecimal("185.00"));
        c1.setGoodDescription("Kit de Pastillas de Freno Delanteras Cerámicas — Pedido #ASN-2026-0009");
        c1.setClaimType("RECLAMO");
        c1.setClaimDetail("Solicité pastillas para Toyota Hilux 2021 2.8L, pero el empaque recibido corresponde a la versión 2015 y los pines de sujeción no coinciden con el cáliper.");
        c1.setClaimRequest("Solicito el cambio inmediato por el código OEM exacto para Hilux 2021 sin costo adicional de envío.");
        c1.setStatus("PENDIENTE");
        c1.setCreatedAt(Instant.now().minusSeconds(7200));
        complaintRepository.save(c1);

        ComplaintRecordEntity c2 = new ComplaintRecordEntity();
        c2.setSheetNumber("LR-2026-0002");
        c2.setCreatedAtLabel("03/11/2026 11:15");
        c2.setDocType("RUC");
        c2.setDocNumber("20608912345");
        c2.setFullName("Flotas Andinas S.A.C. — Martín Torres");
        c2.setAddress("Av. Nicolás Ayllón 3150, Ate, Lima");
        c2.setPhone("945112233");
        c2.setEmail("logistica@flotasandinas.pe");
        c2.setGoodType("SERVICIO");
        c2.setClaimedAmount(new BigDecimal("420.00"));
        c2.setGoodDescription("Despacho Express de Filtros Denso y Lubricantes — Pedido #ASN-2026-0004");
        c2.setClaimType("QUEJA");
        c2.setClaimDetail("El motorizado llegó 25 minutos después del rango estimado debido al tráfico en Carretera Central y requeríamos la factura impresa además del PDF.");
        c2.setClaimRequest("Mejorar la coordinación telefónica previa cuando exista congestión vial en la ruta de reparto.");
        c2.setStatus("ATENDIDO");
        c2.setAdminResponseNote("Estimado Ing. Martín Torres, agradecemos su observación. Hemos activado las alertas preventivas de ruta y le otorgamos prioridad de despacho sin costo de envío en su próximo pedido corporativo.");
        c2.setResolvedAtLabel("03/11/2026 17:30");
        c2.setCreatedAt(Instant.now().minusSeconds(86400));
        complaintRepository.save(c2);
    }

    @GetMapping
    @Operation(summary = "Listar todas las hojas de reclamación registradas")
    public ResponseEntity<List<ComplaintDto>> getAllComplaints() {
        List<ComplaintDto> list = complaintRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(this::toDto)
                .toList();
        return ResponseEntity.ok(list);
    }

    @PostMapping
    @Transactional
    @Operation(summary = "Registrar una nueva Hoja de Reclamación en el Libro de Reclamaciones Virtual")
    public ResponseEntity<ComplaintDto> createComplaint(@RequestBody CreateComplaintRequest req) {
        long seq = complaintRepository.count() + 1;
        String sheetNumber = String.format("LR-2026-%04d", seq);
        while (complaintRepository.findBySheetNumberIgnoreCase(sheetNumber).isPresent()) {
            seq++;
            sheetNumber = String.format("LR-2026-%04d", seq);
        }

        Instant now = Instant.now();
        ComplaintRecordEntity entity = new ComplaintRecordEntity();
        entity.setSheetNumber(sheetNumber);
        entity.setCreatedAtLabel(LIMA_FMT.format(now));
        entity.setDocType(req.docType() != null && !req.docType().isBlank() ? req.docType().trim().toUpperCase() : "DNI");
        entity.setDocNumber(req.docNumber() != null ? req.docNumber().trim() : "");
        entity.setFullName(req.fullName() != null ? req.fullName().trim() : "Consumidor");
        entity.setAddress(req.address() != null ? req.address().trim() : "");
        entity.setPhone(req.phone() != null ? req.phone().trim() : "");
        entity.setEmail(req.email() != null ? req.email().trim() : "");
        entity.setGoodType(req.goodType() != null && !req.goodType().isBlank() ? req.goodType().trim().toUpperCase() : "PRODUCTO");
        entity.setClaimedAmount(req.claimedAmount() != null ? req.claimedAmount() : BigDecimal.ZERO);
        entity.setGoodDescription(req.goodDescription() != null ? req.goodDescription().trim() : "");
        entity.setClaimType(req.claimType() != null && !req.claimType().isBlank() ? req.claimType().trim().toUpperCase() : "RECLAMO");
        entity.setClaimDetail(req.claimDetail() != null ? req.claimDetail().trim() : "");
        entity.setClaimRequest(req.claimRequest() != null ? req.claimRequest().trim() : "");
        entity.setStatus("PENDIENTE");
        entity.setCreatedAt(now);

        ComplaintRecordEntity saved = complaintRepository.save(entity);
        emailNotificationService.notifyComplaintRegistered(saved);
        return ResponseEntity.status(HttpStatus.CREATED).body(toDto(saved));
    }

    @PutMapping("/{sheetNumber}/resolve")
    @Transactional
    @Operation(summary = "Emitir respuesta formal del proveedor y marcar Hoja de Reclamación como ATENDIDO")
    public ResponseEntity<ComplaintDto> resolveComplaint(
            @PathVariable String sheetNumber,
            @RequestBody ResolveComplaintRequest req
    ) {
        ComplaintRecordEntity entity = complaintRepository.findBySheetNumberIgnoreCase(sheetNumber.trim())
                .orElseThrow(() -> new ResourceNotFoundException("Hoja de reclamación no encontrada: " + sheetNumber));

        entity.setStatus("ATENDIDO");
        entity.setAdminResponseNote(req != null && req.responseNote() != null ? req.responseNote().trim() : "Reclamación atendida conforme a ley.");
        entity.setResolvedAtLabel(LIMA_FMT.format(Instant.now()));

        ComplaintRecordEntity saved = complaintRepository.save(entity);
        emailNotificationService.notifyComplaintResolved(saved);
        return ResponseEntity.ok(toDto(saved));
    }

    private ComplaintDto toDto(ComplaintRecordEntity e) {
        return new ComplaintDto(
                "rec-" + e.getId(),
                e.getSheetNumber(),
                e.getCreatedAtLabel(),
                e.getDocType(),
                e.getDocNumber(),
                e.getFullName(),
                e.getAddress(),
                e.getPhone(),
                e.getEmail(),
                e.getGoodType(),
                e.getClaimedAmount(),
                e.getGoodDescription(),
                e.getClaimType(),
                e.getClaimDetail(),
                e.getClaimRequest(),
                e.getStatus(),
                e.getAdminResponseNote(),
                e.getResolvedAtLabel()
        );
    }
}
