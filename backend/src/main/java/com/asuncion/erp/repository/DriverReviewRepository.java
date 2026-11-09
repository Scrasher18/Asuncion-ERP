package com.asuncion.erp.repository;

import com.asuncion.erp.domain.entity.DriverReviewEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DriverReviewRepository extends JpaRepository<DriverReviewEntity, Long> {
    Optional<DriverReviewEntity> findByOrderNumber(String orderNumber);
    List<DriverReviewEntity> findAllByOrderByCreatedAtDesc();
    List<DriverReviewEntity> findByDriverNameIgnoreCaseOrderByCreatedAtDesc(String driverName);
}
