package com.asuncion.erp.config;

import com.asuncion.erp.security.JwtAuthenticationFilter;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.annotation.web.configurers.HeadersConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final List<String> allowedOrigins;

    public SecurityConfig(
            JwtAuthenticationFilter jwtAuthenticationFilter,
            @Value("${app.cors.allowed-origins:http://localhost:4200,http://127.0.0.1:4200,http://localhost,http://localhost:80}") String originsCsv
    ) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.allowedOrigins = Arrays.stream(originsCsv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(AbstractHttpConfigurer::disable)
                .headers(headers -> headers.frameOptions(HeadersConfigurer.FrameOptionsConfig::sameOrigin))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint((request, response, authException) -> {
                            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
                            response.getWriter().write("{\"status\":401,\"error\":\"UNAUTHORIZED\",\"message\":\"Autenticación JWT requerida o sesión expirada.\"}");
                        })
                        .accessDeniedHandler((request, response, accessDeniedException) -> {
                            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
                            response.getWriter().write("{\"status\":403,\"error\":\"FORBIDDEN\",\"message\":\"Su rol no tiene autorización para acceder a este recurso.\"}");
                        })
                )
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        // Public Auth & Google reCAPTCHA Config
                        .requestMatchers(HttpMethod.POST, "/api/v1/auth/login", "/api/v1/auth/register", "/api/v1/auth/forgot-password", "/api/v1/auth/reset-password").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/auth/recaptcha-config").permitAll()
                        // Public Catalog, Stock Reservations & Media
                        .requestMatchers(HttpMethod.GET, "/api/v1/catalog/**").permitAll()
                        .requestMatchers("/api/v1/catalog/reservations/**").permitAll()
                        .requestMatchers("/api/v1/complaints/**").permitAll()
                        .requestMatchers("/api/v1/media/**").permitAll()
                        // Public Logistics & Coverage Validation
                        .requestMatchers(HttpMethod.GET, "/api/v1/logistics/branches").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/logistics/validate-coverage").permitAll()
                        // Public Order Tracking, RENIEC/SUNAT/Address Lookup & Hybrid Chatbot
                        .requestMatchers(HttpMethod.GET, "/api/v1/orders/track/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/lookup/**").permitAll()
                        .requestMatchers("/api/v1/chatbot/**").permitAll()
                        .requestMatchers("/api/v1/driver-reviews/**").permitAll()
                        // Public Payment Gateway Endpoints (Config, Webhook, CIP Status, Card Analyzer)
                        .requestMatchers(HttpMethod.GET, "/api/v1/payments/config").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/payments/analyze-card").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/payments/pagoefectivo/status/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/payments/webhook/**").permitAll()
                        // Real-Time GPS Driver Telemetry & NoSQL Tracking (Customer & Public SSE)
                        .requestMatchers(HttpMethod.GET, "/api/v1/telemetry/orders/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/telemetry/nosql/**").permitAll()
                        // Simulation step restricted to ADMIN
                        .requestMatchers(HttpMethod.POST, "/api/v1/telemetry/orders/*/simulate-step").hasRole("ADMIN")
                        // Real motorizado GPS ping restricted to MOTORIZADO or ADMIN
                        .requestMatchers(HttpMethod.POST, "/api/v1/telemetry/driver/ping").hasAnyRole("MOTORIZADO", "ADMIN")
                        // Admin Payments -> ADMIN
                        .requestMatchers("/api/v1/admin/payments/**").hasRole("ADMIN")
                        // OpenAPI / Actuator / H2 Dev Console
                        .requestMatchers(
                                "/",
                                "/favicon.ico",
                                "/swagger-ui.html",
                                "/swagger-ui/**",
                                "/v3/api-docs/**",
                                "/actuator/health",
                                "/actuator/health/**",
                                "/actuator/info",
                                "/h2-console/**"
                        ).permitAll()
                        // Admin Branches, Notifications & Staff Users -> ADMIN
                        .requestMatchers("/api/v1/admin/branches/**").hasRole("ADMIN")
                        .requestMatchers("/api/v1/admin/notifications/**").hasRole("ADMIN")
                        .requestMatchers("/api/v1/admin/users/**").hasRole("ADMIN")
                        // Admin ERP Parts, Promotions/Combos, Autocomplete, Vehicles & Analytics -> ADMIN, VENDEDOR
                        .requestMatchers(
                                "/api/v1/admin/parts/**",
                                "/api/v1/admin/promotions/**",
                                "/api/v1/admin/autocomplete/**",
                                "/api/v1/admin/vehicles/**",
                                "/api/v1/admin/analytics/**"
                        ).hasAnyRole("ADMIN", "VENDEDOR")
                        // Order preparation & Picking -> ADMIN, VENDEDOR
                        .requestMatchers("/api/v1/warehouse/**").hasAnyRole("ADMIN", "VENDEDOR")
                        // Delivery Drivers list -> MOTORIZADO, ADMIN, VENDEDOR
                        .requestMatchers(HttpMethod.GET, "/api/v1/delivery/drivers").hasAnyRole("MOTORIZADO", "ADMIN", "VENDEDOR")
                        // Delivery Motorizado Panel -> MOTORIZADO, ADMIN
                        .requestMatchers("/api/v1/delivery/**").hasAnyRole("MOTORIZADO", "ADMIN")
                        // Orders management list -> ADMIN, VENDEDOR
                        .requestMatchers(HttpMethod.GET, "/api/v1/orders").hasAnyRole("ADMIN", "VENDEDOR")
                        // Authenticated Customer/User endpoints
                        .anyRequest().authenticated()
                )
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOriginPatterns(List.of(
                "http://localhost:*",
                "http://127.0.0.1:*",
                "https://*.ngrok-free.app",
                "https://*.ngrok.app",
                "https://*.ngrok.io",
                "https://*.loca.lt",
                "*"
        ));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"));
        config.setExposedHeaders(List.of("Authorization", "Content-Disposition"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration configuration) throws Exception {
        return configuration.getAuthenticationManager();
    }
}
