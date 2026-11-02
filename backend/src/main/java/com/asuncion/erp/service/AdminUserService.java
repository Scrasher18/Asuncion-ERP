package com.asuncion.erp.service;

import com.asuncion.erp.domain.entity.AppUser;
import com.asuncion.erp.domain.entity.Role;
import com.asuncion.erp.domain.entity.DriverStatus;
import com.asuncion.erp.domain.enums.RoleName;
import com.asuncion.erp.dto.auth.UserDto;
import com.asuncion.erp.dto.user.AdminUserResponse;
import com.asuncion.erp.dto.user.CreateStaffUserRequest;
import com.asuncion.erp.dto.user.UpdateStaffUserRequest;
import com.asuncion.erp.repository.UserRepository;
import com.asuncion.erp.repository.RoleRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public class AdminUserService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailNotificationService emailNotificationService;

    public AdminUserService(
            UserRepository userRepository,
            RoleRepository roleRepository,
            PasswordEncoder passwordEncoder,
            EmailNotificationService emailNotificationService
    ) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
        this.emailNotificationService = emailNotificationService;
    }

    @Transactional(readOnly = true)
    public List<AdminUserResponse> getAllUsers() {
        return userRepository.findAll().stream()
                .sorted((a, b) -> b.getId().compareTo(a.getId()))
                .map(this::mapToResponse)
                .toList();
    }

    @Transactional
    public AdminUserResponse createUser(CreateStaffUserRequest request) {
        String cleanEmail = request.email().trim().toLowerCase();
        if (userRepository.existsByEmailIgnoreCase(cleanEmail)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe un usuario registrado con el correo: " + cleanEmail);
        }

        RoleName targetRole;
        try {
            targetRole = RoleName.valueOf(request.role().trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Rol no reconocido: " + request.role() + ". Use: ADMIN, VENDEDOR o MOTORIZADO.");
        }

        Role role = roleRepository.findByName(targetRole)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "El rol solicitado no existe en la base de datos"));

        AppUser user = new AppUser();
        user.setFullName(request.fullName().trim());
        user.setEmail(cleanEmail);
        user.setPasswordHash(passwordEncoder.encode(request.password().trim()));
        user.setPhone(request.phone() != null ? request.phone().trim() : null);
        user.setDocumentType(request.documentType() != null ? request.documentType().trim() : "DNI");
        user.setDocumentNumber(request.documentNumber() != null ? request.documentNumber().trim() : null);
        user.setActive(true);
        user.setCreatedAt(Instant.now());
        user.setUpdatedAt(Instant.now());

        String employeeCode = resolveOrGenerateEmployeeCode(targetRole, request.employeeCode());
        user.setEmployeeCode(employeeCode);

        if (targetRole == RoleName.MOTORIZADO) {
            user.setDriverStatus(DriverStatus.DISPONIBLE);
            user.setLicenseNumber(request.licenseNumber() != null && !request.licenseNumber().isBlank() ? request.licenseNumber().trim() : null);
            user.setVehiclePlate(request.vehiclePlate() != null && !request.vehiclePlate().isBlank() ? request.vehiclePlate().trim().toUpperCase(java.util.Locale.ROOT) : null);
        } else {
            user.setLicenseNumber(request.licenseNumber() != null && !request.licenseNumber().isBlank() ? request.licenseNumber().trim() : null);
            user.setVehiclePlate(request.vehiclePlate() != null && !request.vehiclePlate().isBlank() ? request.vehiclePlate().trim().toUpperCase(java.util.Locale.ROOT) : null);
        }

        Set<Role> roles = new HashSet<>();
        roles.add(role);
        user.setRoles(roles);

        AppUser saved = userRepository.save(user);

        // Envío asíncrono institucional de bienvenida al trabajador con sus credenciales operativas
        try {
            emailNotificationService.notifyStaffAccountCreated(saved, request.password().trim(), targetRole.name());
        } catch (Exception ignored) {
        }

        return mapToResponse(saved);
    }

    @Transactional
    public AdminUserResponse updateUser(Long id, UpdateStaffUserRequest request) {
        AppUser user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario con ID " + id + " no encontrado"));

        String cleanEmail = request.email().trim().toLowerCase();
        if (!cleanEmail.equalsIgnoreCase(user.getEmail()) && userRepository.existsByEmailIgnoreCase(cleanEmail)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe otro usuario con el correo: " + cleanEmail);
        }

        RoleName targetRole;
        try {
            targetRole = RoleName.valueOf(request.role().trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Rol no válido: " + request.role());
        }

        Role role = roleRepository.findByName(targetRole)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "El rol solicitado no existe"));

        user.setFullName(request.fullName().trim());
        user.setEmail(cleanEmail);
        user.setPhone(request.phone() != null ? request.phone().trim() : null);
        user.setDocumentType(request.documentType() != null ? request.documentType().trim() : "DNI");
        user.setDocumentNumber(request.documentNumber() != null ? request.documentNumber().trim() : null);

        if (request.employeeCode() != null && !request.employeeCode().isBlank()) {
            user.setEmployeeCode(request.employeeCode().trim().toUpperCase(java.util.Locale.ROOT));
        }

        if (request.licenseNumber() != null) {
            user.setLicenseNumber(request.licenseNumber().trim().isBlank() ? null : request.licenseNumber().trim());
        }

        if (request.vehiclePlate() != null) {
            user.setVehiclePlate(request.vehiclePlate().trim().isBlank() ? null : request.vehiclePlate().trim().toUpperCase(java.util.Locale.ROOT));
        }

        if (request.active() != null) {
            user.setActive(request.active());
        }

        if (request.newPassword() != null && !request.newPassword().isBlank()) {
            if (request.newPassword().trim().length() < 6) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La nueva contraseña debe tener al menos 6 caracteres");
            }
            user.setPasswordHash(passwordEncoder.encode(request.newPassword().trim()));
        }

        Set<Role> roles = new HashSet<>();
        roles.add(role);
        user.setRoles(roles);
        user.setUpdatedAt(Instant.now());

        AppUser updated = userRepository.save(user);
        return mapToResponse(updated);
    }

    @Transactional
    public AdminUserResponse toggleUserStatus(Long id) {
        AppUser user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));

        // Impedir desactivarse a sí mismo si es el admin principal
        if ("admin@asuncion.pe".equalsIgnoreCase(user.getEmail())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No es posible desactivar al Administrador Principal del sistema");
        }

        user.setActive(!user.isActive());
        user.setUpdatedAt(Instant.now());
        return mapToResponse(userRepository.save(user));
    }

    @Transactional
    public void deleteUser(Long id) {
        AppUser user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));

        if ("admin@asuncion.pe".equalsIgnoreCase(user.getEmail())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No es posible eliminar al Administrador Principal");
        }

        try {
            userRepository.delete(user);
        } catch (Exception ex) {
            // Si tiene integridad referencial (pedidos, despachos, etc.), se desactiva de forma segura
            user.setActive(false);
            user.setUpdatedAt(Instant.now());
            userRepository.save(user);
        }
    }

    private AdminUserResponse mapToResponse(AppUser user) {
        List<String> roleNames = user.getRoles() != null
                ? user.getRoles().stream().map(r -> r.getName().name()).toList()
                : Collections.emptyList();
        String primaryRole = !roleNames.isEmpty() ? roleNames.get(0) : "CLIENTE";
        String driverStatus = user.getDriverStatus() != null ? user.getDriverStatus().name() : "DISPONIBLE";

        return new AdminUserResponse(
                user.getId(),
                user.getFullName(),
                user.getEmail(),
                user.getPhone(),
                user.getDocumentType(),
                user.getDocumentNumber(),
                primaryRole,
                roleNames,
                user.isActive(),
                driverStatus,
                user.getEmployeeCode(),
                user.getLicenseNumber(),
                user.getVehiclePlate(),
                user.getCreatedAt()
        );
    }

    private String resolveOrGenerateEmployeeCode(RoleName role, String candidateCode) {
        if (candidateCode != null && !candidateCode.trim().isBlank()) {
            return candidateCode.trim().toUpperCase(java.util.Locale.ROOT);
        }
        String prefix = switch (role) {
            case ADMIN -> "ADM";
            case VENDEDOR -> "VEN";
            case MOTORIZADO -> "MOT";
            default -> "EMP";
        };
        long nextNum = userRepository.count() + 1;
        return String.format("%s-%03d", prefix, nextNum);
    }
}
