package com.asuncion.erp.dto.auth;

import java.util.List;

public record UserDto(
        Long id,
        String fullName,
        String email,
        String phone,
        String documentType,
        String documentNumber,
        List<String> roles
) {
}
