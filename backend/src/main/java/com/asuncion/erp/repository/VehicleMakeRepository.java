package com.asuncion.erp.repository;

import com.asuncion.erp.domain.entity.VehicleMake;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface VehicleMakeRepository extends JpaRepository<VehicleMake, Long> {
    List<VehicleMake> findAllByOrderByNameAsc();
    Optional<VehicleMake> findByNameIgnoreCase(String name);
}
