package com.asuncion.erp.repository;

import com.asuncion.erp.domain.entity.Category;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CategoryRepository extends JpaRepository<Category, Long> {
    List<Category> findByActiveTrueOrderByIdAsc();
    Optional<Category> findByCodeIgnoreCase(String code);
}
