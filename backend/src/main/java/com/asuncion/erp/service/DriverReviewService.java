package com.asuncion.erp.service;

import com.asuncion.erp.domain.entity.DriverReviewEntity;
import com.asuncion.erp.dto.DriverReviewDto;
import com.asuncion.erp.repository.DriverReviewRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

@Service
public class DriverReviewService {

    private static final Logger log = LoggerFactory.getLogger(DriverReviewService.class);
    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")
            .withZone(ZoneId.of("America/Lima"));

    private final DriverReviewRepository reviewRepository;

    public DriverReviewService(DriverReviewRepository reviewRepository) {
        this.reviewRepository = reviewRepository;
    }

    @Transactional(readOnly = true)
    public List<DriverReviewDto> getAllReviews() {
        return reviewRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional
    public DriverReviewDto submitReview(DriverReviewDto dto) {
        if (dto == null || dto.orderNumber() == null || dto.orderNumber().isBlank()) {
            throw new IllegalArgumentException("El número de pedido es obligatorio para calificar.");
        }

        DriverReviewEntity entity = reviewRepository.findByOrderNumber(dto.orderNumber().trim())
                .orElseGet(DriverReviewEntity::new);

        entity.setOrderNumber(dto.orderNumber().trim());
        entity.setDriverName(dto.driverName() != null && !dto.driverName().isBlank() ? dto.driverName().trim() : "Miguel Ángel Flores");
        entity.setDriverEmail(dto.driverEmail() != null ? dto.driverEmail().trim() : "motorizado@asuncion.pe");
        entity.setCustomerName(dto.customerName() != null && !dto.customerName().isBlank() ? dto.customerName().trim() : "Cliente Asunción");
        entity.setStars(Math.max(1, Math.min(5, dto.stars())));
        entity.setTags(dto.tags() != null ? String.join(",", dto.tags()) : "");
        entity.setCustomerComment(dto.comment() != null ? dto.comment().trim() : null);
        entity.setCreatedAt(Instant.now());

        DriverReviewEntity saved = reviewRepository.save(entity);
        log.info("Calificación guardada para motorizado {} en orden {}: {} estrellas", saved.getDriverName(), saved.getOrderNumber(), saved.getStars());
        return toDto(saved);
    }

    private DriverReviewDto toDto(DriverReviewEntity entity) {
        List<String> tagList = Collections.emptyList();
        if (entity.getTags() != null && !entity.getTags().isBlank()) {
            tagList = Arrays.stream(entity.getTags().split(","))
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .toList();
        }

        String formattedDate = FORMATTER.format(entity.getCreatedAt() != null ? entity.getCreatedAt() : Instant.now());
        return new DriverReviewDto(
                "rev-" + entity.getId(),
                entity.getOrderNumber(),
                entity.getDriverName(),
                entity.getDriverEmail(),
                entity.getCustomerName(),
                entity.getStars() != null ? entity.getStars() : 5,
                tagList,
                entity.getCustomerComment(),
                formattedDate
        );
    }
}
