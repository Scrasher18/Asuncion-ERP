package com.asuncion.erp.repository;

import com.asuncion.erp.domain.entity.ComplaintRecordEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ComplaintRepository extends JpaRepository<ComplaintRecordEntity, Long> {

    List<ComplaintRecordEntity> findAllByOrderByCreatedAtDesc();

    Optional<ComplaintRecordEntity> findBySheetNumberIgnoreCase(String sheetNumber);
}
