package com.asuncion.erp.repository;

import com.asuncion.erp.domain.entity.AppUser;
import com.asuncion.erp.domain.enums.RoleName;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<AppUser, Long> {

    Optional<AppUser> findByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCase(String email);

    Optional<AppUser> findFirstByDocumentNumberOrderByIdAsc(String documentNumber);

    @Query("SELECT DISTINCT u FROM AppUser u JOIN u.roles r WHERE r.name = :roleName AND u.active = true ORDER BY u.fullName ASC")
    List<AppUser> findActiveByRole(@Param("roleName") RoleName roleName);
}
