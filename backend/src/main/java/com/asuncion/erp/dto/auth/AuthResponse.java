package com.asuncion.erp.dto.auth;

public record AuthResponse(
        String token,
        String tokenType,
        long expiresIn,
        UserDto user
) {
}
