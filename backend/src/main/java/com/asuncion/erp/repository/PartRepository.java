package com.asuncion.erp.repository;

import com.asuncion.erp.domain.entity.Part;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PartRepository extends JpaRepository<Part, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Part p WHERE p.id = :id")
    Optional<Part> findByIdForUpdate(@Param("id") Long id);

    Optional<Part> findBySkuIgnoreCase(String sku);

    boolean existsBySkuIgnoreCase(String sku);

    List<Part> findByActiveTrueOrderByIdAsc();

    List<Part> findAllByOrderByIdAsc();

    @Query("SELECT COUNT(p) FROM Part p WHERE p.active = true AND p.stockQuantity <= p.minStockLevel")
    long countActiveLowStockParts();
}
