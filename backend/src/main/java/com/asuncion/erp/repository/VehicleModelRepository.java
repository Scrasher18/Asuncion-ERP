package com.asuncion.erp.repository;

import com.asuncion.erp.domain.entity.VehicleModel;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface VehicleModelRepository extends JpaRepository<VehicleModel, Long> {
    List<VehicleModel> findAllByOrderByMakeNameAscNameAsc();
    List<VehicleModel> findByMakeIdOrderByNameAsc(Long makeId);
    Optional<VehicleModel> findByMakeIdAndNameIgnoreCase(Long makeId, String name);
}
