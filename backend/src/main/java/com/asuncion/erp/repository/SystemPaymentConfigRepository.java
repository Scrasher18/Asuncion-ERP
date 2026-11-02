package com.asuncion.erp.repository;

import com.asuncion.erp.domain.entity.SystemPaymentConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SystemPaymentConfigRepository extends JpaRepository<SystemPaymentConfig, Long> {
}
