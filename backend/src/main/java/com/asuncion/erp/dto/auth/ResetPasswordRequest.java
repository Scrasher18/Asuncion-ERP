package com.asuncion.erp.dto.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ResetPasswordRequest(
        @NotBlank(message = "El correo electrónico es obligatorio")
        @Email(message = "Formato de correo electrónico inválido")
        String email,

        @Size(max = 12, message = "Código de recuperación inválido")
        String code,

        @Size(max = 25, message = "Documento inválido")
        String documentNumber,

        @Size(max = 30, message = "Celular inválido")
        String phone,

        @NotBlank(message = "La nueva contraseña es obligatoria")
        @Size(min = 8, message = "La nueva contraseña debe tener al menos 8 caracteres")
        String newPassword
) {
    public ResetPasswordRequest(String email, String code, String newPassword) {
        this(email, code, null, null, newPassword);
    }
}
