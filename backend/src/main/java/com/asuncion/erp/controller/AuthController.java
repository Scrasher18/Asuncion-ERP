package com.asuncion.erp.controller;

import com.asuncion.erp.dto.auth.AuthResponse;
import com.asuncion.erp.dto.auth.ForgotPasswordRequest;
import com.asuncion.erp.dto.auth.LoginRequest;
import com.asuncion.erp.dto.auth.RegisterRequest;
import com.asuncion.erp.dto.auth.ResetPasswordRequest;
import com.asuncion.erp.dto.auth.UpdateProfileRequest;
import com.asuncion.erp.dto.auth.UserDto;
import com.asuncion.erp.service.AuthService;
import com.asuncion.erp.service.GoogleRecaptchaService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "01. Autenticación & RBAC", description = "Login JWT Stateless, registro de clientes B2C/B2B y perfil actual")
public class AuthController {

    private final AuthService authService;
    private final GoogleRecaptchaService googleRecaptchaService;

    public AuthController(AuthService authService, GoogleRecaptchaService googleRecaptchaService) {
        this.authService = authService;
        this.googleRecaptchaService = googleRecaptchaService;
    }

    @GetMapping("/recaptcha-config")
    @Operation(summary = "Obtener clave pública de Google reCAPTCHA v3 para el cliente web")
    public ResponseEntity<Map<String, Object>> getRecaptchaConfig() {
        return ResponseEntity.ok(Map.of(
                "enabled", googleRecaptchaService.isEnabled(),
                "siteKey", googleRecaptchaService.getSiteKey()
        ));
    }

    @PostMapping("/login")
    @Operation(summary = "Iniciar sesión y obtener token JWT Stateless")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @PostMapping("/register")
    @Operation(summary = "Registrar nuevo cliente B2C/B2B en el portal")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.register(request));
    }

    @PostMapping("/forgot-password")
    @Operation(summary = "Solicitar código de restablecimiento de contraseña vía correo")
    public ResponseEntity<Map<String, Object>> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        return ResponseEntity.ok(authService.requestPasswordReset(request));
    }

    @PostMapping("/reset-password")
    @Operation(summary = "Restablecer contraseña usando el código de 6 dígitos recibido por correo")
    public ResponseEntity<Map<String, Object>> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        return ResponseEntity.ok(authService.confirmPasswordReset(request));
    }

    @GetMapping("/me")
    @Operation(summary = "Obtener perfil y roles del usuario autenticado")
    public ResponseEntity<UserDto> me() {
        return ResponseEntity.ok(authService.getCurrentUserDto());
    }

    @PutMapping("/profile")
    @Operation(summary = "Actualizar datos personales o documento del cliente autenticado")
    public ResponseEntity<UserDto> updateProfile(@Valid @RequestBody UpdateProfileRequest request) {
        return ResponseEntity.ok(authService.updateProfile(request));
    }
}
