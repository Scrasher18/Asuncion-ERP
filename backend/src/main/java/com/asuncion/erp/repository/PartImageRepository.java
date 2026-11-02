package com.asuncion.erp.repository;

import com.asuncion.erp.domain.entity.PartImage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PartImageRepository extends JpaRepository<PartImage, Long> {
    Optional<PartImage> findByIdAndPartId(Long id, Long partId);
}
