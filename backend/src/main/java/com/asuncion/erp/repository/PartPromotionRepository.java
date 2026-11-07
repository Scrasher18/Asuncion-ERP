package com.asuncion.erp.repository;

import com.asuncion.erp.domain.entity.PartPromotionEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PartPromotionRepository extends JpaRepository<PartPromotionEntity, String> {
    List<PartPromotionEntity> findByActiveTrueOrderByUpdatedAtDesc();
}
