package com.asuncion.erp.controller;

import com.asuncion.erp.dto.user.AdminUserResponse;
import com.asuncion.erp.dto.user.CreateStaffUserRequest;
import com.asuncion.erp.dto.user.UpdateStaffUserRequest;
import com.asuncion.erp.service.AdminUserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/users")
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "09. ERP Gestión de Personal y Trabajadores", description = "Creación, edición, activación y eliminación de personal de ventas, repartidores y administradores")
public class AdminUserController {

    private final AdminUserService adminUserService;

    public AdminUserController(AdminUserService adminUserService) {
        this.adminUserService = adminUserService;
    }

    @GetMapping
    @Operation(summary = "Listar todo el personal y usuarios registrados en el sistema")
    public ResponseEntity<List<AdminUserResponse>> getAllUsers() {
        return ResponseEntity.ok(adminUserService.getAllUsers());
    }

    @PostMapping
    @Operation(summary = "Registrar nuevo trabajador o empleado asignando rol y credenciales")
    public ResponseEntity<AdminUserResponse> createUser(@Valid @RequestBody CreateStaffUserRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(adminUserService.createUser(request));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Actualizar información, rol o contraseña de un trabajador")
    public ResponseEntity<AdminUserResponse> updateUser(
            @PathVariable Long id,
            @Valid @RequestBody UpdateStaffUserRequest request
    ) {
        return ResponseEntity.ok(adminUserService.updateUser(id, request));
    }

    @PatchMapping("/{id}/toggle-status")
    @Operation(summary = "Activar o suspender/desactivar acceso a un trabajador")
    public ResponseEntity<AdminUserResponse> toggleStatus(@PathVariable Long id) {
        return ResponseEntity.ok(adminUserService.toggleUserStatus(id));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Eliminar trabajador o desactivarlo con seguridad si tiene historial")
    public ResponseEntity<Void> deleteUser(@PathVariable Long id) {
        adminUserService.deleteUser(id);
        return ResponseEntity.noContent().build();
    }
}
