package com.asuncion.erp.dto.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record UpdateProfileRequest(
        @NotBlank(message = "El nombre completo es obligatorio")
        String fullName,

        @Pattern(
                regexp = "^$|^9[0-9]{8}$",
                message = "El número de celular debe tener exactamente 9 dígitos y comenzar con 9"
        )
        String phone,

        String documentType,
        String documentNumber
) {
}
