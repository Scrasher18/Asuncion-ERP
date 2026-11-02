package com.asuncion.erp.repository;

import com.asuncion.erp.domain.entity.SalesQuota;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SalesQuotaRepository extends JpaRepository<SalesQuota, Long> {

    Optional<SalesQuota> findBySalespersonIdAndPeriodYearAndPeriodMonth(Long salespersonId, Short periodYear, Short periodMonth);

    List<SalesQuota> findByPeriodYearAndPeriodMonth(Short periodYear, Short periodMonth);
}
