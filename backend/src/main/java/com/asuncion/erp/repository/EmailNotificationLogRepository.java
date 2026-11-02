package com.asuncion.erp.repository;

import com.asuncion.erp.domain.entity.EmailNotificationLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EmailNotificationLogRepository extends JpaRepository<EmailNotificationLog, Long> {

    List<EmailNotificationLog> findTop40ByOrderByCreatedAtDescIdDesc();
}
