package com.asuncion.erp.dto.user;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateStaffUserRequest(
        @NotBlank(message = "El nombre completo es obligatorio")
        @Size(max = 150, message = "El nombre no puede exceder 150 caracteres")
        String fullName,

        @NotBlank(message = "El correo electrónico es obligatorio")
        @Email(message = "Formato de correo electrónico inválido")
        String email,

        String phone,
        String documentType,
        String documentNumber,

        @NotBlank(message = "El rol es obligatorio")
        String role,

        Boolean active,

        String newPassword,

        String employeeCode,
        String licenseNumber,
        String vehiclePlate
) {
}
