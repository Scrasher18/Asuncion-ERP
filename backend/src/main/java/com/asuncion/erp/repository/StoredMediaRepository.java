package com.asuncion.erp.repository;

import com.asuncion.erp.domain.entity.StoredMedia;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StoredMediaRepository extends JpaRepository<StoredMedia, String> {
}
