package com.asuncion.erp.dto.user;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateStaffUserRequest(
        @NotBlank(message = "El nombre completo es obligatorio")
        @Size(max = 150, message = "El nombre no puede exceder 150 caracteres")
        String fullName,

        @NotBlank(message = "El correo electrónico es obligatorio")
        @Email(message = "Formato de correo electrónico inválido")
        String email,

        @NotBlank(message = "La contraseña es obligatoria")
        @Size(min = 6, message = "La contraseña debe tener al menos 6 caracteres")
        String password,

        String phone,
        String documentType,
        String documentNumber,

        @NotBlank(message = "El rol es obligatorio (ADMIN, VENDEDOR, MOTORIZADO)")
        String role,

        String employeeCode,
        String licenseNumber,
        String vehiclePlate
) {
}
