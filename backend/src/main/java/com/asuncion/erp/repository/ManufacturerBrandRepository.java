package com.asuncion.erp.repository;

import com.asuncion.erp.domain.entity.ManufacturerBrand;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ManufacturerBrandRepository extends JpaRepository<ManufacturerBrand, Long> {
    Optional<ManufacturerBrand> findByNameIgnoreCase(String name);
}
