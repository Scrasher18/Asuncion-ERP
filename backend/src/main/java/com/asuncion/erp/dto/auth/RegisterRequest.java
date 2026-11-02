package com.asuncion.erp.dto.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank(message = "El nombre completo es obligatorio")
        String fullName,

        @NotBlank(message = "El correo electrónico es obligatorio")
        @Email(message = "Formato de correo electrónico inválido")
        String email,

        @NotBlank(message = "La contraseña es obligatoria")
        @Size(min = 8, message = "La contraseña debe tener al menos 8 caracteres")
        @Pattern(
                regexp = "^(?=.*[0-9])(?=.*[^a-zA-Z0-9]).{8,}$",
                message = "La contraseña debe contener al menos 8 caracteres, incluyendo al menos un número y un caracter especial (ej: @, #, $, !, %, *, etc.)."
        )
        String password,

        @Pattern(
                regexp = "^$|^9[0-9]{8}$",
                message = "El número de celular debe tener exactamente 9 dígitos y comenzar con 9 (ej: 987654321)"
        )
        String phone,
        String documentType,
        String documentNumber,
        String recaptchaToken
) {
}
