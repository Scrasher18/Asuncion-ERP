package com.asuncion.erp.service;

import com.asuncion.erp.domain.entity.AppUser;
import com.asuncion.erp.domain.entity.Role;
import com.asuncion.erp.domain.enums.RoleName;
import com.asuncion.erp.dto.auth.AuthResponse;
import com.asuncion.erp.dto.auth.ForgotPasswordRequest;
import com.asuncion.erp.dto.auth.LoginRequest;
import com.asuncion.erp.dto.auth.RegisterRequest;
import com.asuncion.erp.dto.auth.ResetPasswordRequest;
import com.asuncion.erp.dto.auth.UpdateProfileRequest;
import com.asuncion.erp.dto.auth.UserDto;
import com.asuncion.erp.exception.BadRequestException;
import com.asuncion.erp.exception.ResourceNotFoundException;
import com.asuncion.erp.repository.RoleRepository;
import com.asuncion.erp.repository.UserRepository;
import com.asuncion.erp.security.JwtService;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Service
public class AuthService {

    private static final Set<String> ALLOWED_DOC_TYPES = Set.of("DNI", "RUC", "CE", "PASAPORTE");

    private record ResetCodeEntry(String code, Instant expiresAt) {}
    private final ConcurrentMap<String, ResetCodeEntry> resetCodeMap = new ConcurrentHashMap<>();
    private final SecureRandom secureRandom = new SecureRandom();

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final EmailNotificationService emailNotificationService;
    private final GoogleRecaptchaService googleRecaptchaService;

    public AuthService(
            UserRepository userRepository,
            RoleRepository roleRepository,
            PasswordEncoder passwordEncoder,
            AuthenticationManager authenticationManager,
            JwtService jwtService,
            EmailNotificationService emailNotificationService,
            GoogleRecaptchaService googleRecaptchaService
    ) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
        this.emailNotificationService = emailNotificationService;
        this.googleRecaptchaService = googleRecaptchaService;
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        String normalizedEmail = request.email().trim().toLowerCase();
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(normalizedEmail, request.password())
        );

        AppUser user = userRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(() -> new BadCredentialsException("Credenciales inválidas"));

        String token = jwtService.generateToken(user);
        return new AuthResponse(token, "Bearer", jwtService.getExpirationSeconds(), toUserDto(user));
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (!googleRecaptchaService.verifyToken(request.recaptchaToken(), "register", null)) {
            throw new BadRequestException("Verificación de seguridad Google reCAPTCHA v3 fallida. Por favor intenta nuevamente.");
        }

        String normalizedEmail = request.email().trim().toLowerCase();
        if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new BadRequestException("Ya existe una cuenta registrada con el correo: " + normalizedEmail);
        }

        if (request.password() == null || request.password().length() < 8) {
            throw new BadRequestException("La contraseña debe tener un mínimo de 8 caracteres.");
        }
        if (!request.password().matches(".*[0-9].*")) {
            throw new BadRequestException("La contraseña debe contener al menos un número (0-9).");
        }
        if (!request.password().matches(".*[!@#$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>\\/?~`].*")) {
            throw new BadRequestException("La contraseña debe contener al menos un caracter especial (ej: @, #, $, !, %, *, etc.).");
        }

        Role clientRole = roleRepository.findByName(RoleName.CLIENTE)
                .orElseGet(() -> roleRepository.save(new Role(RoleName.CLIENTE, "Cliente B2C / B2B del portal E-Commerce")));

        String docType = normalizeDocType(request.documentType(), request.documentNumber());

        AppUser user = new AppUser();
        user.setFullName(request.fullName().trim());
        user.setEmail(normalizedEmail);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setPhone(request.phone() != null ? request.phone().trim() : null);
        user.setDocumentType(docType);
        user.setDocumentNumber(request.documentNumber() != null ? request.documentNumber().trim() : null);
        user.setActive(true);
        user.getRoles().add(clientRole);

        AppUser saved = userRepository.save(user);
        String token = jwtService.generateToken(saved);
        UserDto userDto = toUserDto(saved);
        emailNotificationService.notifyCustomerRegistered(userDto);
        return new AuthResponse(token, "Bearer", jwtService.getExpirationSeconds(), userDto);
    }

    @Transactional(readOnly = true)
    public AppUser getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            throw new BadCredentialsException("Sesión no autenticada");
        }
        String email = auth.getName();
        return userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario autenticado no encontrado: " + email));
    }

    @Transactional(readOnly = true)
    public AppUser getCurrentUserOrNull() {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
                return null;
            }
            String email = auth.getName();
            return userRepository.findByEmailIgnoreCase(email).orElse(null);
        } catch (Exception e) {
            return null;
        }
    }

    @Transactional(readOnly = true)
    public UserDto getCurrentUserDto() {
        return toUserDto(getCurrentUser());
    }

    @Transactional
    public UserDto updateProfile(UpdateProfileRequest request) {
        AppUser user = getCurrentUser();
        if (request.fullName() != null && !request.fullName().isBlank()) {
            user.setFullName(request.fullName().trim());
        }
        if (request.phone() != null) {
            String trimmedPhone = request.phone().trim();
            user.setPhone(trimmedPhone.isEmpty() ? null : trimmedPhone);
        }
        if (request.documentNumber() != null) {
            String trimmedDoc = request.documentNumber().trim();
            user.setDocumentNumber(trimmedDoc.isEmpty() ? null : trimmedDoc);
            user.setDocumentType(normalizeDocType(request.documentType(), trimmedDoc));
        } else if (request.documentType() != null && !request.documentType().isBlank()) {
            user.setDocumentType(normalizeDocType(request.documentType(), user.getDocumentNumber()));
        }

        AppUser saved = userRepository.save(user);
        return toUserDto(saved);
    }

    public Map<String, Object> requestPasswordReset(ForgotPasswordRequest request) {
        String normalizedEmail = request.email().trim().toLowerCase();
        var userOpt = userRepository.findByEmailIgnoreCase(normalizedEmail);

        if (userOpt.isPresent()) {
            AppUser user = userOpt.get();
            String code = String.format("%06d", secureRandom.nextInt(1_000_000));
            resetCodeMap.put(normalizedEmail, new ResetCodeEntry(code, Instant.now().plus(15, ChronoUnit.MINUTES)));
            emailNotificationService.notifyPasswordReset(user.getEmail(), user.getFullName(), code);
        }

        return Map.of(
                "success", true,
                "message", "Si tu correo está registrado, recibirás un código de 6 dígitos en tu bandeja de entrada en breve."
        );
    }

    @Transactional
    public Map<String, Object> confirmPasswordReset(ResetPasswordRequest request) {
        String normalizedEmail = request.email().trim().toLowerCase();
        ResetCodeEntry entry = resetCodeMap.get(normalizedEmail);

        if (entry == null || entry.expiresAt().isBefore(Instant.now())) {
            resetCodeMap.remove(normalizedEmail);
            throw new BadRequestException("El código de recuperación ha expirado o no es válido. Por favor solicita uno nuevo.");
        }

        if (!entry.code().equals(request.code().trim())) {
            throw new BadRequestException("El código de 6 dígitos ingresado es incorrecto.");
        }

        String newPassword = request.newPassword();
        if (newPassword == null || newPassword.length() < 8) {
            throw new BadRequestException("La nueva contraseña debe tener un mínimo de 8 caracteres.");
        }
        if (!newPassword.matches(".*[0-9].*")) {
            throw new BadRequestException("La nueva contraseña debe contener al menos un número (0-9).");
        }
        if (!newPassword.matches(".*[^A-Za-z0-9].*")) {
            throw new BadRequestException("La nueva contraseña debe contener al menos un caracter especial (ej: @, #, $, !, %, *, etc.).");
        }

        AppUser user = userRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado con el correo: " + normalizedEmail));

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);
        resetCodeMap.remove(normalizedEmail);

        return Map.of(
                "success", true,
                "message", "Tu contraseña ha sido actualizada exitosamente. Ahora puedes iniciar sesión con tu nueva clave."
        );
    }

    public UserDto toUserDto(AppUser user) {
        List<String> roles = user.getRoles().stream()
                .map(r -> r.getName().name())
                .sorted()
                .toList();
        return new UserDto(
                user.getId(),
                user.getFullName(),
                user.getEmail(),
                user.getPhone(),
                user.getDocumentType(),
                user.getDocumentNumber(),
                roles
        );
    }

    private String normalizeDocType(String rawDocType, String docNumber) {
        if (rawDocType != null && !rawDocType.isBlank()) {
            String upper = rawDocType.trim().toUpperCase();
            if (ALLOWED_DOC_TYPES.contains(upper)) {
                return upper;
            }
        }
        if (docNumber != null && docNumber.trim().length() == 11) {
            return "RUC";
        }
        return "DNI";
    }
}
