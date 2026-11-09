package com.asuncion.erp.service;

import com.asuncion.erp.domain.entity.AppUser;
import com.asuncion.erp.domain.entity.CustomerOrder;
import com.asuncion.erp.domain.entity.ComplaintRecordEntity;
import com.asuncion.erp.domain.entity.EmailNotificationLog;
import com.asuncion.erp.domain.entity.SystemMailConfig;
import com.asuncion.erp.dto.auth.UserDto;
import com.asuncion.erp.dto.notification.*;
import com.asuncion.erp.dto.order.DeliveryProofDto;
import com.asuncion.erp.dto.order.OrderItemDto;
import com.asuncion.erp.dto.order.OrderResponse;
import com.asuncion.erp.repository.EmailNotificationLogRepository;
import com.asuncion.erp.repository.SystemMailConfigRepository;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Properties;
import java.util.Set;

@Service
public class EmailNotificationService {

    private static final Logger log = LoggerFactory.getLogger(EmailNotificationService.class);
    private static final Long SINGLETON_ID = 1L;
    private static final ZoneId LIMA_ZONE = ZoneId.of("America/Lima");
    private static final DateTimeFormatter PERU_DATETIME_FMT =
            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm 'hrs'", Locale.forLanguageTag("es-PE")).withZone(LIMA_ZONE);

    private final SystemMailConfigRepository configRepository;
    private final EmailNotificationLogRepository logRepository;
    private final String envMailHost;
    private final int envMailPort;
    private final String envMailUsername;
    private final String envMailPassword;
    private final String frontendBaseUrl;

    private record EffectiveMailSettings(
            boolean enabled,
            String smtpHost,
            int smtpPort,
            String username,
            String password,
            String fromName,
            String adminNotificationEmail
    ) {
        boolean hasCredentials() {
            return username != null && !username.isBlank() && password != null && !password.isBlank();
        }
    }

    public EmailNotificationService(
            SystemMailConfigRepository configRepository,
            EmailNotificationLogRepository logRepository,
            @Value("${MAIL_HOST:smtp.gmail.com}") String envMailHost,
            @Value("${MAIL_PORT:587}") int envMailPort,
            @Value("${MAIL_USERNAME:${MAIL_USER:luisoscarperez322@gmail.com}}") String envMailUsername,
            @Value("${MAIL_PASSWORD:${MAIL_APP_PASSWORD:}}") String envMailPassword,
            @Value("${app.mail.frontend-base-url:http://localhost:4200}") String frontendBaseUrl
    ) {
        this.configRepository = configRepository;
        this.logRepository = logRepository;
        this.envMailHost = envMailHost != null && !envMailHost.isBlank() ? envMailHost.trim() : "smtp.gmail.com";
        this.envMailPort = envMailPort > 0 ? envMailPort : 587;
        this.envMailUsername = envMailUsername != null && !envMailUsername.isBlank() ? envMailUsername.trim() : "luisoscarperez322@gmail.com";
        this.envMailPassword = envMailPassword != null ? envMailPassword.trim() : "";
        this.frontendBaseUrl = frontendBaseUrl != null && !frontendBaseUrl.isBlank()
                ? frontendBaseUrl.replaceAll("/+$", "")
                : "http://localhost:4200";
    }

    @Transactional(readOnly = true)
    public MailConfigDto getMailConfig() {
        EffectiveMailSettings eff = resolveEffectiveSettings();
        return new MailConfigDto(
                eff.enabled(),
                eff.smtpHost(),
                eff.smtpPort(),
                eff.username() != null ? eff.username() : "",
                eff.hasCredentials(),
                eff.fromName(),
                eff.adminNotificationEmail()
        );
    }

    @Transactional
    public MailConfigDto updateMailConfig(MailConfigUpdateRequest req) {
        SystemMailConfig cfg = configRepository.findById(SINGLETON_ID).orElseGet(() -> {
            SystemMailConfig c = new SystemMailConfig();
            c.setId(SINGLETON_ID);
            return c;
        });

        String host = req.smtpHost() != null && !req.smtpHost().isBlank() ? req.smtpHost().trim() : "smtp.gmail.com";
        cfg.setSmtpHost(host);
        cfg.setSmtpPort(req.smtpPort() != null && req.smtpPort() > 0 ? req.smtpPort() : 587);

        if (!envMailPassword.isBlank()) {
            // Render environment variable is always the authoritative credential source
            cfg.setUsername(envMailUsername);
            cfg.setPassword(null);
            cfg.setEnabled(true);
        } else {
            cfg.setUsername(req.username() != null && !req.username().isBlank() ? req.username().trim() : null);
            if (req.password() != null && !req.password().isBlank()) {
                String cleanedPass = host.toLowerCase(Locale.ROOT).contains("gmail")
                        ? normalizeGmailAppPassword(req.password())
                        : req.password().trim();
                cfg.setPassword(cleanedPass);
            }
            boolean hasAnyPassword = cfg.getPassword() != null && !cfg.getPassword().isBlank();
            cfg.setEnabled(req.enabled() || hasAnyPassword);
        }

        cfg.setFromName(req.fromName() != null && !req.fromName().isBlank() ? req.fromName().trim() : "Repuestos Asunción");
        cfg.setAdminNotificationEmail(req.adminNotificationEmail() != null && !req.adminNotificationEmail().isBlank()
                ? req.adminNotificationEmail().trim()
                : null);
        cfg.setUpdatedAt(Instant.now());

        configRepository.save(cfg);
        return getMailConfig();
    }

    @Transactional(readOnly = true)
    public List<EmailNotificationLogDto> getRecentLogs() {
        return logRepository.findTop40ByOrderByCreatedAtDescIdDesc().stream()
                .map(l -> new EmailNotificationLogDto(
                        l.getId(),
                        l.getEventType(),
                        l.getRecipientEmail(),
                        l.getSubject(),
                        l.getHtmlBody(),
                        l.getOrderNumber(),
                        l.getDeliveryStatus(),
                        l.getErrorMessage(),
                        l.getCreatedAt()
                ))
                .toList();
    }

    @Transactional
    public void clearAllLogs() {
        logRepository.deleteAll();
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public TestEmailResponse sendTestEmail(String recipientEmail) {
        String cleanRecipient = recipientEmail.trim();
        EffectiveMailSettings settings = resolveEffectiveSettings();

        String subject = "Verificación en Vivo — Repuestos Asunción";
        String bodyContent = """
                <p style="margin:0 0 14px;color:#334155;font-size:15px;line-height:1.6;">
                  Este es un correo de verificación emitido desde el módulo de <strong>Notificaciones a Clientes</strong> de <strong>Repuestos Asunción</strong>.
                </p>
                <div style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:10px;padding:16px;margin:16px 0;">
                  <p style="margin:0 0 6px;font-size:13px;color:#9A3412;font-weight:700;text-transform:uppercase;">Detalle de la Verificación</p>
                  <p style="margin:4px 0;font-size:14px;color:#1E293B;"><strong>Remitente Oficial:</strong> %s &lt;%s&gt;</p>
                  <p style="margin:4px 0;font-size:14px;color:#1E293B;"><strong>Destinatario de Prueba:</strong> %s</p>
                  <p style="margin:4px 0;font-size:14px;color:#1E293B;"><strong>Fecha / Hora (Lima):</strong> %s</p>
                </div>
                <p style="margin:14px 0 0;color:#475569;font-size:14px;">
                  Las confirmaciones automáticas de bienvenida, compra, boletas/facturas y despacho motorizado se encuentran operativas.
                </p>
                """.formatted(
                escapeHtml(settings.fromName()),
                escapeHtml(settings.username() != null ? settings.username() : "luisoscarperez322@gmail.com"),
                escapeHtml(cleanRecipient),
                PERU_DATETIME_FMT.format(Instant.now())
        );

        String html = wrapCorporateTemplate(
                "VERIFICACIÓN DE NOTIFICACIONES",
                "Servicio de Correo Conectado",
                bodyContent,
                "Ir al Panel Administrativo",
                frontendBaseUrl + "/admin"
        );

        try {
            sendRealMimeMessage(settings, cleanRecipient, subject, html);
            persistLog("PRUEBA_SMTP", cleanRecipient, subject, html, null, "SENT", null);
            return new TestEmailResponse(
                    true,
                    "SENT",
                    "Correo real enviado con éxito a " + cleanRecipient
            );
        } catch (Exception e) {
            String friendly = extractFriendlySmtpError(e);
            String status = !settings.hasCredentials() ? "SIMULATED_NO_SMTP" : "FAILED";
            persistLog("PRUEBA_SMTP", cleanRecipient, subject, html, null, status, truncate(friendly, 480));
            log.warn("No se pudo entregar correo de prueba a {}: {}", cleanRecipient, friendly);
            return new TestEmailResponse(
                    false,
                    status,
                    friendly
            );
        }
    }

    @Async("mailTaskExecutor")
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyCustomerRegistered(UserDto user) {
        try {
            if (user == null || user.email() == null || user.email().isBlank()) {
                return;
            }
            String subject = "Bienvenido a Autopartes Asunción - Confirmación de Registro";
            String docLine = (user.documentNumber() != null && !user.documentNumber().isBlank())
                    ? "<p style=\"margin:6px 0;font-size:14px;color:#1E293B;\"><strong>Documento de identidad:</strong> "
                      + escapeHtml((user.documentType() != null ? user.documentType() : "DOC") + " " + user.documentNumber()) + "</p>"
                    : "<p style=\"margin:6px 0;font-size:14px;color:#64748B;\"><strong>Documento:</strong> Puedes asociarlo en cualquier momento desde tu perfil para agilizar la emisión de comprobantes.</p>";

            String phoneLine = (user.phone() != null && !user.phone().isBlank())
                    ? "<p style=\"margin:6px 0;font-size:14px;color:#1E293B;\"><strong>Celular de contacto:</strong> " + escapeHtml(user.phone()) + "</p>"
                    : "";

            String content = """
                    <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.6;">
                      Estimado(a) <strong>%s</strong>,
                    </p>
                    <p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.6;">
                      Agradecemos tu preferencia por <strong>Repuestos Automotrices Asunción S.A.C.</strong> Tu cuenta como cliente ha quedado habilitada para consultar nuestro catálogo, solicitar cotizaciones y realizar pedidos de repuestos para camiones y vehículos automotores.
                    </p>
                    
                    <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:18px;margin:20px 0;">
                      <div style="font-size:11px;font-weight:700;color:#EA580C;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:10px;">
                        Detalle de tu cuenta
                      </div>
                      <p style="margin:6px 0;font-size:14px;color:#1E293B;"><strong>Usuario / Correo:</strong> %s</p>
                      %s
                      %s
                    </div>

                    <div style="border-top:1px solid #E2E8F0;padding-top:16px;margin-top:20px;">
                      <div style="font-size:12px;font-weight:700;color:#0F172A;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">
                        Compromiso de Atención y Garantía
                      </div>
                      <ul style="margin:0;padding-left:18px;color:#475569;font-size:13px;line-height:1.7;">
                        <li><strong>Comprobantes electrónicos autorizados:</strong> Emisión inmediata de Boleta de Venta o Factura con RUC válida para crédito fiscal SUNAT.</li>
                        <li><strong>Repuestos garantizados:</strong> Componentes originales OEM y alternativos certificados con control de calidad.</li>
                        <li><strong>Logística en Lima y Provincias:</strong> Despacho motorizado en Lima Metropolitana y envíos a todo el Perú mediante agencias de transporte terrestre.</li>
                      </ul>
                    </div>

                    <div style="background:#FFF7ED;border-left:4px solid #EA580C;padding:12px 16px;margin:20px 0;border-radius:0 8px 8px 0;">
                      <p style="margin:0;font-size:12px;color:#9A3412;line-height:1.6;">
                        <strong>Sede Central:</strong> Av. Sta. Ana 441, Santa Anita, Lima &bull; <strong>Horario:</strong> Lun - Sáb 8:00 AM - 6:00 PM<br/>
                        <strong>Central Telefónica:</strong> (01) 424-8900 &bull; <strong>WhatsApp Comercial:</strong> +51 987 654 321
                      </p>
                    </div>
                    """.formatted(
                    escapeHtml(user.fullName()),
                    escapeHtml(user.email()),
                    docLine,
                    phoneLine
            );

            String html = wrapCorporateTemplate(
                    "REGISTRO CONFIRMADO",
                    "Bienvenido a Autopartes Asunción",
                    content,
                    "Explorar Catálogo de Repuestos",
                    frontendBaseUrl + "/catalog"
            );

            dispatchOrSimulate("BIENVENIDA_REGISTRO", user.email(), subject, html, null);
        } catch (Exception e) {
            log.warn("Error procesando notificación BIENVENIDA_REGISTRO: {}", e.getMessage());
        }
    }

    @Async("mailTaskExecutor")
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyStaffAccountCreated(AppUser user, String temporaryPassword, String roleName) {
        try {
            if (user == null || user.getEmail() == null || user.getEmail().isBlank()) {
                return;
            }
            String friendlyRole = switch (roleName != null ? roleName.toUpperCase(Locale.ROOT) : "") {
                case "ADMIN" -> "Administrador del Sistema";
                case "VENDEDOR" -> "Ventas y Almacén";
                case "MOTORIZADO" -> "Repartidor Motorizado";
                default -> roleName != null ? roleName : "Personal Autorizado";
            };

            String subject = "Alta de Colaborador — Credenciales de Acceso Asunción (" + (user.getEmployeeCode() != null ? user.getEmployeeCode() : "STAFF") + ")";

            String courierSection = "";
            if ("MOTORIZADO".equalsIgnoreCase(roleName)) {
                courierSection = """
                        <div style="background:#F1F5F9;border:1px solid #CBD5E1;border-radius:8px;padding:12px;margin:12px 0;">
                          <div style="font-size:11px;font-weight:700;color:#0F172A;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Datos Operativos de Reparto</div>
                          <p style="margin:3px 0;font-size:13px;color:#334155;"><strong>N° Licencia de Conducir:</strong> %s</p>
                          <p style="margin:3px 0;font-size:13px;color:#334155;"><strong>Placa del Vehículo / Moto:</strong> %s</p>
                        </div>
                        """.formatted(
                        escapeHtml(user.getLicenseNumber() != null ? user.getLicenseNumber() : "Pendiente de registro"),
                        escapeHtml(user.getVehiclePlate() != null ? user.getVehiclePlate() : "Pendiente de asignación")
                );
            }

            String content = """
                    <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.6;">
                      Estimado(a) <strong>%s</strong>,
                    </p>
                    <p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.6;">
                      Te damos la bienvenida al equipo operativo de <strong>Repuestos Automotrices Asunción S.A.C.</strong> Tu cuenta institucional ha sido habilitada exitosamente con las credenciales adjuntas para acceder a los módulos de trabajo correspondientes a tu rol.
                    </p>
                    <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:18px;margin:16px 0;">
                      <div style="font-size:11px;font-weight:700;color:#EA580C;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:10px;">
                        Ficha de Acceso Institucional
                      </div>
                      <p style="margin:5px 0;font-size:14px;color:#1E293B;"><strong>Código de Empleado:</strong> %s</p>
                      <p style="margin:5px 0;font-size:14px;color:#1E293B;"><strong>Cargo / Rol:</strong> %s</p>
                      <p style="margin:5px 0;font-size:14px;color:#1E293B;"><strong>Correo de Acceso:</strong> %s</p>
                      <p style="margin:5px 0;font-size:14px;color:#1E293B;"><strong>Contraseña Temporal:</strong> <code style="background:#FED7AA;color:#9A3412;padding:2px 6px;border-radius:4px;font-weight:700;">%s</code></p>
                    </div>
                    %s
                    <div style="background:#FFFBEB;border-left:4px solid #F59E0B;padding:12px 16px;margin:18px 0;border-radius:0 8px 8px 0;">
                      <p style="margin:0;font-size:13px;color:#92400E;line-height:1.5;">
                        <strong>Nota de Seguridad:</strong> Por directiva de seguridad interna, utiliza este enlace para iniciar sesión por primera vez y procede a actualizar tu contraseña en el panel de usuario.
                      </p>
                    </div>
                    """.formatted(
                    escapeHtml(user.getFullName()),
                    escapeHtml(user.getEmployeeCode() != null ? user.getEmployeeCode() : "N/D"),
                    escapeHtml(friendlyRole),
                    escapeHtml(user.getEmail()),
                    escapeHtml(temporaryPassword != null ? temporaryPassword : "••••••••"),
                    courierSection
            );

            String html = wrapCorporateTemplate(
                    "ACCESO CORPORATIVO",
                    "Bienvenido(a) a Repuestos Asunción",
                    content,
                    "Iniciar Sesión en la Plataforma",
                    frontendBaseUrl + "/login"
            );

            dispatchOrSimulate("ALTA_TRABAJADOR", user.getEmail(), subject, html, user.getEmployeeCode() != null ? user.getEmployeeCode() : "STAFF");
        } catch (Exception e) {
            log.warn("Error procesando notificación de alta de colaborador {}: {}", user != null ? user.getEmail() : "", e.getMessage());
        }
    }

    @Async("mailTaskExecutor")
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyPasswordReset(String email, String fullName, String code) {
        try {
            if (email == null || email.isBlank()) {
                return;
            }
            String subject = "Código de Recuperación de Contraseña: " + code + " — Repuestos Asunción";
            String content = """
                    <p style="margin:0 0 14px;color:#334155;font-size:15px;line-height:1.6;">
                      Hola <strong>%s</strong>, hemos recibido una solicitud para restablecer la contraseña de tu cuenta en <strong>Repuestos Asunción</strong>.
                    </p>
                    <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6;">
                      Usa el siguiente código de seguridad de 6 dígitos para verificar tu identidad y asignar tu nueva contraseña:
                    </p>
                    <div style="text-align:center;margin:24px 0;">
                      <div style="display:inline-block;letter-spacing:8px;font-size:32px;font-weight:900;color:#EA580C;background:#FFF7ED;border:2px dashed #EA580C;padding:14px 28px;border-radius:12px;font-family:monospace;">
                        %s
                      </div>
                    </div>
                    <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:12px 16px;margin:20px 0;font-size:12px;color:#64748B;line-height:1.6;">
                      <strong>Importante:</strong> Este código tiene una validez de <strong>15 minutos</strong>. Si tú no realizaste esta solicitud, puedes ignorar este mensaje; tu cuenta permanece completamente segura.
                    </div>
                    """.formatted(
                    escapeHtml(fullName != null && !fullName.isBlank() ? fullName : "Cliente"),
                    escapeHtml(code)
            );

            String html = wrapCorporateTemplate(
                    "SEGURIDAD & ACCESO",
                    "Restablecimiento de Contraseña",
                    content,
                    "Ir a Iniciar Sesión",
                    frontendBaseUrl + "/login"
            );

            dispatchOrSimulate("RECUPERACION_PASSWORD", email, subject, html, null);
        } catch (Exception e) {
            log.warn("Error procesando notificación RECUPERACION_PASSWORD para {}: {}", email, e.getMessage());
        }
    }

    @Async("mailTaskExecutor")
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyOrderCreated(OrderResponse order) {
        notifyOrderCreated(order, null);
    }

    @Async("mailTaskExecutor")
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyOrderCreated(OrderResponse order, String overrideCustomerEmail) {
        try {
            if (order == null) {
                return;
            }
            EffectiveMailSettings settings = resolveEffectiveSettings();
            String trackUrl = frontendBaseUrl + "/track?code=" + order.orderNumber();
            String itemsTable = buildOrderItemsHtmlTable(order);

            // Determine recipient emails (both specified payment email and customer account email)
            Set<String> recipientEmails = new LinkedHashSet<>();
            if (overrideCustomerEmail != null && !overrideCustomerEmail.isBlank()) {
                recipientEmails.add(overrideCustomerEmail.trim().toLowerCase());
            }
            if (order.customerEmail() != null && !order.customerEmail().isBlank()) {
                recipientEmails.add(order.customerEmail().trim().toLowerCase());
            }

            // 1. Customer Purchase Confirmation & Electronic Invoice (Boleta/Factura) Email
            boolean isFactura = "FACTURA".equalsIgnoreCase(order.invoiceType());
            String voucherTitle = isFactura ? "FACTURA ELECTRÓNICA" : "BOLETA DE VENTA ELECTRÓNICA";
            String voucherSeries = (isFactura ? "F001-" : "B001-") + String.format("%06d", Math.abs(order.orderNumber().hashCode() % 1000000));
            String customerSubject = voucherTitle + " #" + order.orderNumber() + " — Autopartes Asunción (R.U.C. 20601849201)";
            String customerContent = """
                    <div style="border:2px solid #EA580C;border-radius:10px;padding:16px;margin:0 0 16px;background:#FFFBF8;text-align:center;">
                      <h2 style="margin:0 0 4px;color:#9A3412;font-size:16px;font-weight:800;letter-spacing:0.5px;">AUTOPARTES ASUNCIÓN S.A.C.</h2>
                      <p style="margin:2px 0;font-size:12px;color:#475569;">R.U.C. 20601849201 · Lima, Perú</p>
                      <div style="background:#EA580C;color:#FFFFFF;display:inline-block;padding:6px 16px;border-radius:6px;margin:8px 0;font-weight:800;font-size:14px;letter-spacing:1px;">
                        %s N° %s
                      </div>
                      <p style="margin:2px 0;font-size:12px;color:#64748B;">Pedido Relacionado: <strong>%s</strong></p>
                    </div>

                    <p style="margin:0 0 14px;color:#334155;font-size:14px;line-height:1.6;">
                      Estimado(a) <strong>%s</strong>, adjuntamos el detalle oficial de tu comprobante electrónico emitido por tu compra. Nuestro equipo técnico de almacén ya cuenta con tu orden para el despacho.
                    </p>

                    <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:14px;margin:14px 0;">
                      <table width="100%%" style="border-collapse:collapse;font-size:13px;color:#1E293B;">
                        <tr><td style="padding:4px 0;color:#64748B;"><strong>Adquiriente / Cliente:</strong></td><td style="padding:4px 0;text-align:right;"><strong>%s</strong></td></tr>
                        <tr><td style="padding:4px 0;color:#64748B;"><strong>Doc. Identidad (DNI/RUC):</strong></td><td style="padding:4px 0;text-align:right;">%s</td></tr>
                        <tr><td style="padding:4px 0;color:#64748B;"><strong>Modalidad de Entrega:</strong></td><td style="padding:4px 0;text-align:right;">%s</td></tr>
                        <tr><td style="padding:4px 0;color:#64748B;"><strong>Dirección / Sede:</strong></td><td style="padding:4px 0;text-align:right;">%s</td></tr>
                        <tr><td style="padding:4px 0;color:#64748B;"><strong>Forma de Pago:</strong></td><td style="padding:4px 0;text-align:right;">%s</td></tr>
                      </table>
                    </div>

                    <h3 style="margin:16px 0 8px;font-size:14px;color:#0F172A;font-weight:700;">Detalle de Ítems Adquiridos:</h3>
                    %s

                    <p style="margin:16px 0 0;font-size:12px;color:#64748B;line-height:1.5;text-align:center;">
                      Comprobante electrónico de venta emitido legalmente. Puedes descargar tu comprobante y hacer seguimiento de tu entrega en cualquier momento desde el botón inferior.
                    </p>
                    """.formatted(
                    voucherTitle,
                    voucherSeries,
                    escapeHtml(order.orderNumber()),
                    escapeHtml(order.customerName()),
                    escapeHtml(order.customerName()),
                    order.billingDocumentNumber() != null && !order.billingDocumentNumber().isBlank() ? escapeHtml(order.billingDocumentNumber()) : "DNI Cliente",
                    "DELIVERY".equalsIgnoreCase(order.deliveryType()) ? "Envío a Domicilio / Taller" : "Recojo en Tienda",
                    escapeHtml(order.deliveryAddress() != null ? order.deliveryAddress() : order.branchAddress()),
                    escapeHtml(order.paymentMethod()),
                    itemsTable
            );

            String customerHtml = wrapCorporateTemplate(
                    voucherTitle,
                    "Comprobante Electrónico N° " + voucherSeries,
                    customerContent,
                    "Ver Pedido & Rastrear Entrega",
                    trackUrl
            );

            for (String targetEmail : recipientEmails) {
                dispatchOrSimulateWithSettings(settings, "COMPRA_CONFIRMADA", targetEmail, customerSubject, customerHtml, order.orderNumber());
            }

            // 2. Store Admin New Order Alert Email
            String adminRecipient = firstNonBlank(settings.adminNotificationEmail(), settings.username(), "admin@asuncion.pe");
            String adminSubject = "[NUEVO PEDIDO " + order.orderNumber() + "] S/ " + formatMoney(order.totalAmount()) + " — " + order.customerName();
            String adminContent = """
                    <p style="margin:0 0 14px;color:#334155;font-size:15px;line-height:1.6;">
                      Se ha registrado una nueva venta en la plataforma E-Commerce / ERP de <strong>Repuestos Asunción</strong> lista para gestión de almacén.
                    </p>
                    <div style="background:#F8FAFC;border:1px solid #CBD5E1;border-radius:10px;padding:15px;margin:14px 0;">
                      <p style="margin:3px 0;font-size:14px;color:#0F172A;"><strong>Orden:</strong> %s | <strong>Sucursal:</strong> %s</p>
                      <p style="margin:3px 0;font-size:14px;color:#0F172A;"><strong>Cliente:</strong> %s (%s)</p>
                      <p style="margin:3px 0;font-size:14px;color:#0F172A;"><strong>Teléfono Receptor:</strong> %s</p>
                      <p style="margin:3px 0;font-size:14px;color:#0F172A;"><strong>Facturación:</strong> %s %s</p>
                      <p style="margin:3px 0;font-size:14px;color:#0F172A;"><strong>Destino:</strong> %s</p>
                    </div>
                    %s
                    """.formatted(
                    escapeHtml(order.orderNumber()),
                    escapeHtml(order.branchName()),
                    escapeHtml(order.customerName()),
                    escapeHtml(order.customerEmail()),
                    escapeHtml(order.recipientPhone() != null ? order.recipientPhone() : "No especificado"),
                    escapeHtml(order.invoiceType()),
                    order.billingDocumentNumber() != null ? "— " + escapeHtml(order.billingDocumentNumber()) + " (" + escapeHtml(nullToEmpty(order.billingBusinessName())) + ")" : "",
                    escapeHtml(order.deliveryAddress() != null ? order.deliveryAddress() : order.branchAddress()),
                    itemsTable
            );

            String adminHtml = wrapCorporateTemplate(
                    "ALERTA COMERCIAL TIENDA",
                    "Nuevo Pedido Recibido: " + order.orderNumber(),
                    adminContent,
                    "Abrir Panel ERP Administrativo",
                    frontendBaseUrl + "/admin"
            );
            dispatchOrSimulateWithSettings(settings, "NUEVO_PEDIDO_TIENDA", adminRecipient, adminSubject, adminHtml, order.orderNumber());
        } catch (Exception e) {
            log.warn("Error procesando notificaciones de nuevo pedido {}: {}", order != null ? order.orderNumber() : "", e.getMessage());
        }
    }

    @Async("mailTaskExecutor")
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyOrderInPreparation(OrderResponse order) {
        try {
            if (order == null || order.customerEmail() == null || order.customerEmail().isBlank()) {
                return;
            }
            String subject = "Tu pedido #" + order.orderNumber() + " está en preparación en almacén";
            String content = """
                    <p style="margin:0 0 14px;color:#334155;font-size:15px;line-height:1.6;">
                      Hola <strong>%s</strong>, nuestro equipo técnico de almacén ha iniciado el proceso de <strong>picking, verificación OEM y control de calidad</strong> de los repuestos de tu pedido <strong>%s</strong>.
                    </p>
                    <div style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:10px;padding:15px;margin:14px 0;">
                      <p style="margin:4px 0;font-size:14px;color:#1E293B;"><strong>Estado Actual:</strong> EN PREPARACIÓN (Almacén)</p>
                      <p style="margin:4px 0;font-size:14px;color:#1E293B;"><strong>Sede Operativa:</strong> %s</p>
                      <p style="margin:4px 0;font-size:14px;color:#1E293B;"><strong>Responsable de Picking:</strong> %s</p>
                      <p style="margin:4px 0;font-size:14px;color:#1E293B;"><strong>Ítems en preparación:</strong> %d repuesto(s)</p>
                    </div>
                    """.formatted(
                    escapeHtml(order.customerName()),
                    escapeHtml(order.orderNumber()),
                    escapeHtml(order.branchName()),
                    escapeHtml(order.warehouseOperatorName() != null ? order.warehouseOperatorName() : "Equipo de Almacén Asunción"),
                    order.items() != null ? order.items().size() : 0
            );

            String html = wrapCorporateTemplate(
                    "ALMACÉN Y PICKING",
                    "Estamos preparando tu pedido " + order.orderNumber(),
                    content,
                    "Ver Estado en Tiempo Real",
                    frontendBaseUrl + "/track?code=" + order.orderNumber()
            );
            dispatchOrSimulate("PEDIDO_EN_PREPARACION", order.customerEmail(), subject, html, order.orderNumber());
        } catch (Exception e) {
            log.warn("Error procesando notificación PEDIDO_EN_PREPARACION: {}", e.getMessage());
        }
    }

    @Async("mailTaskExecutor")
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyOrderReadyForDispatch(OrderResponse order) {
        try {
            if (order == null || order.customerEmail() == null || order.customerEmail().isBlank()) {
                return;
            }
            boolean isPickup = "PICKUP".equalsIgnoreCase(order.deliveryType());
            String subject = isPickup
                    ? "¡Tu pedido #" + order.orderNumber() + " está listo para recojo en tienda!"
                    : "Tu pedido #" + order.orderNumber() + " está embalado y listo para despacho";

            String dispatchDetail = isPickup
                    ? "Puedes acercarte a nuestro mostrador en <strong>" + escapeHtml(order.branchAddress()) + "</strong> indicando tu código de orden."
                    : (order.assignedDriverName() != null
                        ? "Unidad motorizada asignada: <strong>" + escapeHtml(order.assignedDriverName()) + "</strong>."
                        : "En zona de despacho listo para salida con nuestra flota motorizada.");

            String content = """
                    <p style="margin:0 0 14px;color:#334155;font-size:15px;line-height:1.6;">
                      Hola <strong>%s</strong>, todos los repuestos de tu pedido <strong>%s</strong> han sido verificados y embalados al 100%%.
                    </p>
                    <div style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:10px;padding:15px;margin:14px 0;">
                      <p style="margin:4px 0;font-size:14px;color:#1E293B;"><strong>Estado Actual:</strong> LISTO PARA DESPACHO</p>
                      <p style="margin:4px 0;font-size:14px;color:#1E293B;"><strong>Sucursal:</strong> %s</p>
                      <p style="margin:4px 0;font-size:14px;color:#1E293B;"><strong>Detalle Logístico:</strong> %s</p>
                      %s
                    </div>
                    """.formatted(
                    escapeHtml(order.customerName()),
                    escapeHtml(order.orderNumber()),
                    escapeHtml(order.branchName()),
                    dispatchDetail,
                    order.warehouseNotes() != null && !order.warehouseNotes().isBlank()
                            ? "<p style=\"margin:4px 0;font-size:14px;color:#1E293B;\"><strong>Nota de Almacén:</strong> " + escapeHtml(order.warehouseNotes()) + "</p>"
                            : ""
            );

            String html = wrapCorporateTemplate(
                    "LISTO PARA DESPACHO",
                    "Pedido " + order.orderNumber() + " Embalado al 100%",
                    content,
                    "Seguir mi Pedido",
                    frontendBaseUrl + "/track?code=" + order.orderNumber()
            );
            dispatchOrSimulate("PEDIDO_LISTO_DESPACHO", order.customerEmail(), subject, html, order.orderNumber());
        } catch (Exception e) {
            log.warn("Error procesando notificación PEDIDO_LISTO_DESPACHO: {}", e.getMessage());
        }
    }

    @Async("mailTaskExecutor")
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyOrderInRoute(OrderResponse order) {
        try {
            if (order == null || order.customerEmail() == null || order.customerEmail().isBlank()) {
                return;
            }
            String subject = "¡Tu pedido #" + order.orderNumber() + " va en camino! — Repuestos Asunción";
            String content = """
                    <p style="margin:0 0 14px;color:#334155;font-size:15px;line-height:1.6;">
                      Hola <strong>%s</strong>, ¡tu pedido va en camino! Nuestro motorizado ya salió de almacén en ruta GPS directa hacia tu dirección de entrega.
                    </p>
                    <div style="background:#FFF7ED;border:1px solid #FDBA74;border-radius:10px;padding:16px;margin:14px 0;">
                      <p style="margin:4px 0;font-size:14px;color:#1E293B;"><strong>Estado Actual:</strong> <span style="color:#EA580C;font-weight:700;">EN CAMINO (Ruta GPS Activa)</span></p>
                      <p style="margin:4px 0;font-size:14px;color:#1E293B;"><strong>Motorizado Asignado:</strong> %s</p>
                      <p style="margin:4px 0;font-size:14px;color:#1E293B;"><strong>Teléfono del Repartidor:</strong> %s</p>
                      <p style="margin:4px 0;font-size:14px;color:#1E293B;"><strong>Dirección de Entrega:</strong> %s</p>
                    </div>
                    <p style="margin:12px 0 0;color:#475569;font-size:14px;">
                      Por favor mantén tu teléfono disponible y ten tu documento de identidad a la mano para la conformidad de recepción.
                    </p>
                    """.formatted(
                    escapeHtml(order.customerName()),
                    escapeHtml(order.assignedDriverName() != null ? order.assignedDriverName() : "Flota Motorizada Asunción"),
                    escapeHtml(order.assignedDriverPhone() != null ? order.assignedDriverPhone() : "Disponible vía central"),
                    escapeHtml(order.deliveryAddress() != null ? order.deliveryAddress() : order.branchAddress())
            );

            String html = wrapCorporateTemplate(
                    "DESPACHO EN RUTA GPS",
                    "¡Tu pedido " + order.orderNumber() + " va en camino!",
                    content,
                    "Ver Ubicación y Estado del Pedido",
                    frontendBaseUrl + "/track?code=" + order.orderNumber()
            );
            dispatchOrSimulate("PEDIDO_EN_CAMINO", order.customerEmail(), subject, html, order.orderNumber());
        } catch (Exception e) {
            log.warn("Error procesando notificación PEDIDO_EN_CAMINO: {}", e.getMessage());
        }
    }

    @Async("mailTaskExecutor")
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyDriverApproaching(CustomerOrder order, double remainingMeters, int etaMinutes) {
        try {
            if (order == null || order.getCustomer() == null || order.getCustomer().getEmail() == null || order.getCustomer().getEmail().isBlank()) {
                return;
            }
            String customerEmail = order.getCustomer().getEmail();
            String customerName = order.getRecipientName() != null && !order.getRecipientName().isBlank()
                    ? order.getRecipientName()
                    : (order.getCustomer().getFullName() != null ? order.getCustomer().getFullName() : "Cliente");
            String driverName = order.getAssignedDriver() != null ? order.getAssignedDriver().getFullName() : "Motorizado Asunción";
            String driverPhone = order.getAssignedDriver() != null && order.getAssignedDriver().getPhone() != null
                    ? order.getAssignedDriver().getPhone() : "+51 987 654 321";
            String secCode = order.getDeliverySecurityCode() != null && !order.getDeliverySecurityCode().isBlank()
                    ? order.getDeliverySecurityCode() : "1234";

            String subject = "🛵 ¡Tu repartidor está muy cerca! Pedido #" + order.getOrderNumber() + " — Repuestos Asunción";
            String content = """
                    <p style="margin:0 0 14px;color:#334155;font-size:15px;line-height:1.6;">
                      Hola <strong>%s</strong>, ¡tu repartidor está por llegar a tu puerta!
                    </p>
                    <div style="background:#FFF7ED;border:2px solid #EA580C;border-radius:12px;padding:16px;margin:14px 0;">
                      <p style="margin:4px 0;font-size:14px;color:#1E293B;"><strong>Distancia Restante:</strong> <span style="color:#EA580C;font-weight:800;">Aprox. %.0f metros</span></p>
                      <p style="margin:4px 0;font-size:14px;color:#1E293B;"><strong>Tiempo Estimado de Llegada:</strong> <span style="color:#047857;font-weight:800;">~%d minutos</span></p>
                      <p style="margin:4px 0;font-size:14px;color:#1E293B;"><strong>Motorizado:</strong> %s (Cel: %s)</p>
                      <p style="margin:4px 0;font-size:14px;color:#1E293B;"><strong>Dirección:</strong> %s</p>
                      
                      <div style="margin-top:14px;background:#FFFFFF;border:2px dashed #EA580C;border-radius:10px;padding:14px;text-align:center;">
                        <span style="font-size:11px;font-weight:800;color:#EA580C;text-transform:uppercase;letter-spacing:1px;display:block;">Tu Código PIN de Seguridad para la Entrega</span>
                        <span style="font-family:monospace;font-size:32px;font-weight:900;color:#111827;letter-spacing:4px;display:block;margin:6px 0;">%s</span>
                        <p style="margin:4px 0 0;font-size:11px;color:#64748B;">Díctale este código de 4 dígitos al motorizado al momento de recibir tus repuestos para validar la entrega.</p>
                      </div>
                    </div>
                    """.formatted(
                    escapeHtml(customerName),
                    remainingMeters,
                    Math.max(1, etaMinutes),
                    escapeHtml(driverName),
                    escapeHtml(driverPhone),
                    escapeHtml(order.getDeliveryAddress() != null ? order.getDeliveryAddress() : "Dirección indicada"),
                    secCode
            );

            String html = wrapCorporateTemplate(
                    "REPARTIDOR MUY CERCA",
                    "¡Tu repartidor está a punto de llegar!",
                    content,
                    "Ver Seguimiento GPS en Vivo",
                    frontendBaseUrl + "/track?code=" + order.getOrderNumber()
            );
            dispatchOrSimulate("REPARTIDOR_CERCA", customerEmail, subject, html, order.getOrderNumber());
        } catch (Exception e) {
            log.warn("Error procesando notificación REPARTIDOR_CERCA: {}", e.getMessage());
        }
    }

    @Async("mailTaskExecutor")
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyOrderDelivered(OrderResponse order) {
        try {
            if (order == null || order.customerEmail() == null || order.customerEmail().isBlank()) {
                return;
            }
            DeliveryProofDto proof = order.deliveryProof();
            String receiverName = proof != null && proof.receiverName() != null
                    ? proof.receiverName()
                    : (order.recipientName() != null ? order.recipientName() : order.customerName());
            String receiverDoc = proof != null && proof.receiverDocument() != null
                    ? proof.receiverDocument()
                    : (order.billingDocumentNumber() != null ? order.billingDocumentNumber() : "Registrado");
            Instant delivTime = proof != null && proof.deliveredAt() != null
                    ? proof.deliveredAt()
                    : (order.deliveredAt() != null ? order.deliveredAt() : Instant.now());

            String subject = "Pedido #" + order.orderNumber() + " Entregado con Conformidad — Repuestos Asunción";
            String content = """
                    <p style="margin:0 0 14px;color:#334155;font-size:15px;line-height:1.6;">
                      Hola <strong>%s</strong>, te confirmamos que tu pedido <strong>%s</strong> fue entregado satisfactoriamente. ¡Gracias por confiar en <strong>Repuestos Asunción</strong>!
                    </p>
                    <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;padding:16px;margin:14px 0;">
                      <p style="margin:0 0 6px;font-size:12px;color:#166534;font-weight:700;text-transform:uppercase;">Constancia Digital de Entrega</p>
                      <p style="margin:4px 0;font-size:14px;color:#1E293B;"><strong>Recibido por:</strong> %s</p>
                      <p style="margin:4px 0;font-size:14px;color:#1E293B;"><strong>DNI / Documento Receptor:</strong> %s</p>
                      <p style="margin:4px 0;font-size:14px;color:#1E293B;"><strong>Fecha y Hora de Entrega:</strong> %s</p>
                      %s
                    </div>
                    """.formatted(
                    escapeHtml(order.customerName()),
                    escapeHtml(order.orderNumber()),
                    escapeHtml(receiverName),
                    escapeHtml(receiverDoc),
                    PERU_DATETIME_FMT.format(delivTime),
                    proof != null && proof.deliveryNotes() != null && !proof.deliveryNotes().isBlank()
                            ? "<p style=\"margin:4px 0;font-size:14px;color:#1E293B;\"><strong>Observaciones:</strong> " + escapeHtml(proof.deliveryNotes()) + "</p>"
                            : ""
            );

            String html = wrapCorporateTemplate(
                    "ENTREGA COMPLETADA",
                    "¡Pedido " + order.orderNumber() + " Entregado!",
                    content,
                    "Ver Comprobante de Entrega",
                    frontendBaseUrl + "/track?code=" + order.orderNumber()
            );
            dispatchOrSimulate("PEDIDO_ENTREGADO", order.customerEmail(), subject, html, order.orderNumber());
        } catch (Exception e) {
            log.warn("Error procesando notificación PEDIDO_ENTREGADO: {}", e.getMessage());
        }
    }

    @Async("mailTaskExecutor")
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyComplaintRegistered(ComplaintRecordEntity claim) {
        try {
            if (claim == null) {
                return;
            }
            EffectiveMailSettings settings = resolveEffectiveSettings();
            String subject = "Constancia Hoja de Reclamación " + claim.getSheetNumber() + " — Repuestos Asunción";
            String content = """
                    <p style="margin:0 0 14px;color:#334155;font-size:15px;line-height:1.6;">
                      Estimado(a) <strong>%s</strong>, confirmamos la recepción de su Hoja de Reclamación Virtual conforme al Código de Protección y Defensa del Consumidor (Ley N° 29571).
                    </p>
                    <div style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:10px;padding:16px;margin:14px 0;">
                      <p style="margin:4px 0;font-size:14px;color:#1E293B;"><strong>N° de Hoja:</strong> <span style="color:#EA580C;font-weight:700;">%s</span></p>
                      <p style="margin:4px 0;font-size:14px;color:#1E293B;"><strong>Tipo:</strong> %s (%s)</p>
                      <p style="margin:4px 0;font-size:14px;color:#1E293B;"><strong>Bien contratado:</strong> %s</p>
                      <p style="margin:4px 0;font-size:14px;color:#1E293B;"><strong>Detalle registrado:</strong> %s</p>
                    </div>
                    """.formatted(
                    escapeHtml(claim.getFullName()),
                    escapeHtml(claim.getSheetNumber()),
                    escapeHtml(claim.getClaimType()),
                    escapeHtml(claim.getGoodType()),
                    escapeHtml(claim.getGoodDescription()),
                    escapeHtml(claim.getClaimDetail())
            );
            String html = wrapCorporateTemplate(
                    "LIBRO DE RECLAMACIONES",
                    "Constancia " + claim.getSheetNumber(),
                    content,
                    "Ir a Autopartes Asunción",
                    frontendBaseUrl + "/libro-reclamaciones"
            );

            if (claim.getEmail() != null && !claim.getEmail().isBlank()) {
                dispatchOrSimulateWithSettings(settings, "RECLAMO_REGISTRADO", claim.getEmail().trim(), subject, html, claim.getSheetNumber());
            }
            String adminRecipient = firstNonBlank(settings.adminNotificationEmail(), settings.username());
            if (adminRecipient != null && !adminRecipient.equalsIgnoreCase(nullToEmpty(claim.getEmail()).trim())) {
                dispatchOrSimulateWithSettings(settings, "ALERTA_RECLAMO", adminRecipient, "[NUEVO RECLAMO " + claim.getSheetNumber() + "] " + claim.getFullName(), html, claim.getSheetNumber());
            }
        } catch (Exception e) {
            log.warn("Error procesando notificación de reclamo: {}", e.getMessage());
        }
    }

    @Async("mailTaskExecutor")
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyComplaintResolved(ComplaintRecordEntity claim) {
        try {
            if (claim == null || claim.getEmail() == null || claim.getEmail().isBlank()) {
                return;
            }
            String subject = "Respuesta Oficial a su Hoja de Reclamación " + claim.getSheetNumber() + " — Repuestos Asunción";
            String content = """
                    <p style="margin:0 0 14px;color:#334155;font-size:15px;line-height:1.6;">
                      Estimado(a) <strong>%s</strong>, le remitimos la respuesta formal de <strong>Repuestos Automotrices Asunción S.A.C.</strong> respecto a la Hoja de Reclamación <strong>%s</strong>:
                    </p>
                    <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;padding:16px;margin:14px 0;">
                      <p style="margin:0 0 6px;font-size:12px;color:#166534;font-weight:700;text-transform:uppercase;">Respuesta del Proveedor</p>
                      <p style="margin:4px 0;font-size:14px;color:#1E293B;line-height:1.6;">%s</p>
                    </div>
                    """.formatted(
                    escapeHtml(claim.getFullName()),
                    escapeHtml(claim.getSheetNumber()),
                    escapeHtml(claim.getAdminResponseNote())
            );
            String html = wrapCorporateTemplate(
                    "ATENCIÓN AL CONSUMIDOR",
                    "Hoja " + claim.getSheetNumber() + " Atendida",
                    content,
                    "Visitar Tienda Online",
                    frontendBaseUrl
            );
            dispatchOrSimulate("RECLAMO_ATENDIDO", claim.getEmail().trim(), subject, html, claim.getSheetNumber());
        } catch (Exception e) {
            log.warn("Error procesando notificación RECLAMO_ATENDIDO: {}", e.getMessage());
        }
    }

    private void dispatchOrSimulate(String eventType, String recipientEmail, String subject, String htmlBody, String orderNumber) {
        EffectiveMailSettings settings = resolveEffectiveSettings();
        dispatchOrSimulateWithSettings(settings, eventType, recipientEmail, subject, htmlBody, orderNumber);
    }

    private void dispatchOrSimulateWithSettings(
            EffectiveMailSettings settings,
            String eventType,
            String recipientEmail,
            String subject,
            String htmlBody,
            String orderNumber
    ) {
        try {
            sendRealMimeMessage(settings, recipientEmail, subject, htmlBody);
            persistLog(eventType, recipientEmail, subject, htmlBody, orderNumber, "SENT", null);
        } catch (Exception e) {
            String friendly = extractFriendlySmtpError(e);
            String status = !settings.hasCredentials() ? "SIMULATED_NO_SMTP" : "FAILED";
            log.warn("Notificación {} para {} no entregada ({}): {}", eventType, recipientEmail, status, friendly);
            persistLog(eventType, recipientEmail, subject, htmlBody, orderNumber, status, truncate(friendly, 480));
        }
    }

    private void sendRealMimeMessage(
            EffectiveMailSettings settings,
            String recipientEmail,
            String subject,
            String htmlBody
    ) throws Exception {
        try {
            attemptSendWithTransportFallback(settings, recipientEmail, subject, htmlBody);
            return;
        } catch (Exception primaryEx) {
            String msg = primaryEx.getMessage() != null ? primaryEx.getMessage() : "";
            boolean isAuthErr = msg.contains("535")
                    || msg.contains("Google rechazó la clave")
                    || msg.toLowerCase(Locale.ROOT).contains("username and password not accepted");

            if (!isAuthErr) {
                throw primaryEx;
            }

            // Recovery 1: If DB config had a stale/mismatched username or password, retry with Render env credentials
            if (!envMailUsername.isBlank() && !envMailPassword.isBlank()) {
                String cleanEnvPass = normalizeGmailAppPassword(envMailPassword);
                EffectiveMailSettings envSettings = new EffectiveMailSettings(
                        true,
                        envMailHost,
                        envMailPort,
                        envMailUsername,
                        cleanEnvPass,
                        settings.fromName(),
                        settings.adminNotificationEmail()
                );
                String currUser = settings.username() != null ? settings.username() : "";
                String currPass = settings.password() != null ? settings.password().replaceAll("\\s+", "") : "";
                if (!envMailUsername.equalsIgnoreCase(currUser) || !cleanEnvPass.equals(currPass)) {
                    log.info("Reintentando envío de correo con credenciales de entorno verificadas ({})", envMailUsername);
                    attemptSendWithTransportFallback(envSettings, recipientEmail, subject, htmlBody);
                    healStoredMailConfigToEnv();
                    return;
                }
            }

            // Recovery 2: If a Gmail App Password had accidental extra prefix characters (>16 chars), retry with trailing 16 chars
            String compactPass = settings.password() != null ? settings.password().replaceAll("\\s+", "") : "";
            if (compactPass.length() > 16 && settings.smtpHost().toLowerCase(Locale.ROOT).contains("gmail")) {
                EffectiveMailSettings trimmedSettings = new EffectiveMailSettings(
                        true,
                        settings.smtpHost(),
                        settings.smtpPort(),
                        settings.username(),
                        compactPass.substring(compactPass.length() - 16),
                        settings.fromName(),
                        settings.adminNotificationEmail()
                );
                attemptSendWithTransportFallback(trimmedSettings, recipientEmail, subject, htmlBody);
                return;
            }

            throw primaryEx;
        }
    }

    private void attemptSendWithTransportFallback(
            EffectiveMailSettings settings,
            String recipientEmail,
            String subject,
            String htmlBody
    ) throws Exception {
        if (!settings.hasCredentials()) {
            dispatchViaHttpsRelay(settings, recipientEmail, subject, htmlBody);
            return;
        }

        boolean isCloudDeployment = frontendBaseUrl != null && frontendBaseUrl.startsWith("https://");
        if (isCloudDeployment) {
            try {
                dispatchViaHttpsRelay(settings, recipientEmail, subject, htmlBody);
                return;
            } catch (Exception relayEx) {
                String msg = relayEx.getMessage() != null ? relayEx.getMessage() : "";
                if (msg.contains("535") || msg.contains("Google rechazó la clave")) {
                    throw relayEx;
                }
                log.info("HTTPS relay fallback to direct JavaMail SMTP: {}", msg);
                sendViaDirectSmtp(settings, recipientEmail, subject, htmlBody);
                return;
            }
        }

        try {
            sendViaDirectSmtp(settings, recipientEmail, subject, htmlBody);
        } catch (Exception smtpEx) {
            String msg = smtpEx.getMessage() != null ? smtpEx.getMessage() : "";
            if (msg.contains("535") || msg.toLowerCase(Locale.ROOT).contains("username and password not accepted")) {
                throw smtpEx;
            }
            log.info("Direct SMTP unavailable ({}), delegating to HTTPS relay", msg);
            dispatchViaHttpsRelay(settings, recipientEmail, subject, htmlBody);
        }
    }

    private static String normalizeGmailAppPassword(String raw) {
        if (raw == null) {
            return "";
        }
        String compact = raw.replaceAll("\\s+", "");
        if (compact.length() == 20) {
            return compact.substring(4);
        }
        return compact;
    }

    private void healStoredMailConfigToEnv() {
        try {
            configRepository.findById(SINGLETON_ID).ifPresent(cfg -> {
                cfg.setUsername(envMailUsername);
                cfg.setPassword(null);
                cfg.setEnabled(true);
                if (cfg.getAdminNotificationEmail() == null
                        || cfg.getAdminNotificationEmail().isBlank()
                        || "scrasher322@gmail.com".equalsIgnoreCase(cfg.getAdminNotificationEmail())) {
                    cfg.setAdminNotificationEmail(envMailUsername);
                }
                cfg.setUpdatedAt(Instant.now());
                configRepository.save(cfg);
            });
        } catch (Exception ignored) {
        }
    }

    private void sendViaDirectSmtp(
            EffectiveMailSettings settings,
            String recipientEmail,
            String subject,
            String htmlBody
    ) throws Exception {
        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setHost(settings.smtpHost());
        sender.setPort(settings.smtpPort());
        sender.setUsername(settings.username());

        String rawPass = settings.password() != null ? settings.password() : "";
        String sanitizedPass = settings.smtpHost().toLowerCase(Locale.ROOT).contains("gmail")
                ? rawPass.replaceAll("\\s+", "")
                : rawPass;
        sender.setPassword(sanitizedPass);
        sender.setDefaultEncoding(StandardCharsets.UTF_8.name());

        Properties props = sender.getJavaMailProperties();
        props.put("mail.transport.protocol", "smtp");
        props.put("mail.smtp.auth", "true");
        props.put("mail.smtp.starttls.enable", "true");
        props.put("mail.smtp.connectiontimeout", "5000");
        props.put("mail.smtp.timeout", "7000");
        props.put("mail.smtp.writetimeout", "7000");
        if (settings.smtpPort() == 465) {
            props.put("mail.smtp.ssl.enable", "true");
        }

        MimeMessage mimeMessage = sender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, false, StandardCharsets.UTF_8.name());
        helper.setFrom(new InternetAddress(settings.username(), settings.fromName(), StandardCharsets.UTF_8.name()));
        helper.setTo(recipientEmail);
        helper.setSubject(subject);
        helper.setText(htmlBody, true);
        sender.send(mimeMessage);
    }

    private void dispatchViaHttpsRelay(
            EffectiveMailSettings settings,
            String recipientEmail,
            String subject,
            String htmlBody
    ) throws Exception {
        String relayBase = (frontendBaseUrl != null && frontendBaseUrl.startsWith("https://"))
                ? frontendBaseUrl
                : "https://asucionfrontend.vercel.app";

        java.net.http.HttpClient client = java.net.http.HttpClient.newBuilder()
                .connectTimeout(java.time.Duration.ofSeconds(6))
                .build();

        com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        java.util.Map<String, String> payload = new java.util.HashMap<>();
        payload.put("to", recipientEmail);
        payload.put("subject", subject);
        payload.put("html", htmlBody);
        payload.put("fromName", settings.fromName() != null ? settings.fromName() : "Repuestos Asunción");
        payload.put("username", settings.username() != null ? settings.username() : "");
        payload.put("pass", settings.password() != null ? settings.password().replaceAll("\\s+", "") : "");

        String json = mapper.writeValueAsString(payload);

        java.net.http.HttpRequest req = java.net.http.HttpRequest.newBuilder()
                .uri(java.net.URI.create(relayBase + "/mail-service/send"))
                .header("Content-Type", "application/json; charset=utf-8")
                .timeout(java.time.Duration.ofSeconds(14))
                .POST(java.net.http.HttpRequest.BodyPublishers.ofString(json, java.nio.charset.StandardCharsets.UTF_8))
                .build();

        java.net.http.HttpResponse<String> resp = client.send(req, java.net.http.HttpResponse.BodyHandlers.ofString());
        String body = resp.body() != null ? resp.body() : "";
        log.info("HTTPS mail relay status HTTP {}: {}", resp.statusCode(), body);

        if (resp.statusCode() < 200 || resp.statusCode() >= 300 || !body.contains("\"success\":true")) {
            String relayErr = "No se pudo enviar el correo (HTTP " + resp.statusCode() + ")";
            try {
                com.fasterxml.jackson.databind.JsonNode node = mapper.readTree(body);
                if (node.hasNonNull("error")) {
                    relayErr = node.get("error").asText();
                }
            } catch (Exception ignored) {
            }
            throw new java.io.IOException(relayErr);
        }
    }

    private void persistLog(
            String eventType,
            String recipientEmail,
            String subject,
            String htmlBody,
            String orderNumber,
            String deliveryStatus,
            String errorMessage
    ) {
        try {
            // Auto-purge notification logs older than 30 days to prevent unbounded table growth
            logRepository.deleteByCreatedAtBefore(Instant.now().minus(java.time.Duration.ofDays(30)));
        } catch (Exception ignored) {
        }
        EmailNotificationLog entry = new EmailNotificationLog();
        entry.setEventType(eventType);
        entry.setRecipientEmail(recipientEmail);
        entry.setSubject(subject);
        entry.setHtmlBody(htmlBody);
        entry.setOrderNumber(orderNumber);
        entry.setDeliveryStatus(deliveryStatus);
        entry.setErrorMessage(errorMessage);
        entry.setCreatedAt(Instant.now());
        logRepository.save(entry);
    }

    private EffectiveMailSettings resolveEffectiveSettings() {
        SystemMailConfig cfg = configRepository.findById(SINGLETON_ID).orElse(null);
        boolean hasRenderEnvPassword = !envMailPassword.isBlank();
        String cleanEnvPass = envMailHost.toLowerCase(Locale.ROOT).contains("gmail")
                ? normalizeGmailAppPassword(envMailPassword)
                : envMailPassword;

        if (cfg == null) {
            boolean envReady = !envMailUsername.isBlank() && hasRenderEnvPassword;
            String adminMail = !envMailUsername.isBlank() ? envMailUsername : "admin@asuncion.pe";
            return new EffectiveMailSettings(
                    envReady,
                    envMailHost,
                    envMailPort,
                    envMailUsername,
                    cleanEnvPass,
                    "Repuestos Asunción",
                    adminMail
            );
        }

        String fromName = firstNonBlank(cfg.getFromName(), "Repuestos Asunción");
        String rawAdminEmail = cfg.getAdminNotificationEmail();
        if ("scrasher322@gmail.com".equalsIgnoreCase(rawAdminEmail)) {
            rawAdminEmail = null;
        }

        // Always prioritize Render environment variable (MAIL_APP_PASSWORD) when configured
        if (hasRenderEnvPassword) {
            String user = !envMailUsername.isBlank() ? envMailUsername : firstNonBlank(cfg.getUsername(), "luisoscarperez322@gmail.com");
            String adminEmail = firstNonBlank(rawAdminEmail, user, "admin@asuncion.pe");
            return new EffectiveMailSettings(
                    true,
                    envMailHost,
                    envMailPort,
                    user,
                    cleanEnvPass,
                    fromName,
                    adminEmail
            );
        }

        String host = firstNonBlank(cfg.getSmtpHost(), envMailHost, "smtp.gmail.com");
        int port = (cfg.getSmtpPort() != null && cfg.getSmtpPort() > 0) ? cfg.getSmtpPort() : envMailPort;
        String user = firstNonBlank(cfg.getUsername(), envMailUsername);
        String pass = host.toLowerCase(Locale.ROOT).contains("gmail")
                ? normalizeGmailAppPassword(cfg.getPassword())
                : nullToEmpty(cfg.getPassword());
        String adminEmail = firstNonBlank(rawAdminEmail, user, "admin@asuncion.pe");

        return new EffectiveMailSettings(
                cfg.isEnabled() || !pass.isBlank(),
                host,
                port,
                user,
                pass,
                fromName,
                adminEmail
        );
    }

    private String buildOrderItemsHtmlTable(OrderResponse order) {
        StringBuilder rows = new StringBuilder();
        if (order.items() != null) {
            for (OrderItemDto item : order.items()) {
                rows.append("""
                        <tr>
                          <td style="padding:10px 8px;border-bottom:1px solid #E2E8F0;font-size:13px;color:#0F172A;">
                            <strong>%s</strong><br/>
                            <span style="color:#64748B;font-size:11px;">SKU: %s%s</span>
                          </td>
                          <td style="padding:10px 8px;border-bottom:1px solid #E2E8F0;font-size:13px;color:#334155;text-align:center;">%d</td>
                          <td style="padding:10px 8px;border-bottom:1px solid #E2E8F0;font-size:13px;color:#334155;text-align:right;">S/ %s</td>
                          <td style="padding:10px 8px;border-bottom:1px solid #E2E8F0;font-size:13px;color:#0F172A;font-weight:600;text-align:right;">S/ %s</td>
                        </tr>
                        """.formatted(
                        escapeHtml(item.partName()),
                        escapeHtml(item.partSku()),
                        item.partOemCode() != null && !item.partOemCode().isBlank() ? " | OEM: " + escapeHtml(item.partOemCode()) : "",
                        item.quantity(),
                        formatMoney(item.unitPrice()),
                        formatMoney(item.subtotal())
                ));
            }
        }

        return """
                <table width="100%%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:16px 0;border:1px solid #E2E8F0;border-radius:8px;overflow:hidden;">
                  <thead>
                    <tr style="background:#F8FAFC;">
                      <th style="padding:10px 8px;text-align:left;font-size:12px;color:#475569;border-bottom:2px solid #EA580C;">Repuesto</th>
                      <th style="padding:10px 8px;text-align:center;font-size:12px;color:#475569;border-bottom:2px solid #EA580C;">Cant.</th>
                      <th style="padding:10px 8px;text-align:right;font-size:12px;color:#475569;border-bottom:2px solid #EA580C;">P. Unit.</th>
                      <th style="padding:10px 8px;text-align:right;font-size:12px;color:#475569;border-bottom:2px solid #EA580C;">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    %s
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colspan="3" style="padding:8px 10px 4px;text-align:right;font-size:13px;color:#64748B;">Subtotal Neto:</td>
                      <td style="padding:8px 10px 4px;text-align:right;font-size:13px;color:#1E293B;">S/ %s</td>
                    </tr>
                    <tr>
                      <td colspan="3" style="padding:4px 10px;text-align:right;font-size:13px;color:#64748B;">IGV (18%%):</td>
                      <td style="padding:4px 10px;text-align:right;font-size:13px;color:#1E293B;">S/ %s</td>
                    </tr>
                    <tr>
                      <td colspan="3" style="padding:4px 10px 8px;text-align:right;font-size:13px;color:#64748B;">Costo de Envío:</td>
                      <td style="padding:4px 10px 8px;text-align:right;font-size:13px;color:#1E293B;">S/ %s</td>
                    </tr>
                    <tr style="background:#FFF7ED;">
                      <td colspan="3" style="padding:10px;text-align:right;font-size:15px;font-weight:700;color:#9A3412;border-top:1px solid #FED7AA;">TOTAL PAGADO:</td>
                      <td style="padding:10px;text-align:right;font-size:16px;font-weight:800;color:#EA580C;border-top:1px solid #FED7AA;">S/ %s</td>
                    </tr>
                  </tfoot>
                </table>
                """.formatted(
                rows.toString(),
                formatMoney(order.subtotal()),
                formatMoney(order.taxAmount()),
                formatMoney(order.deliveryFee()),
                formatMoney(order.totalAmount())
        );
    }

    private String wrapCorporateTemplate(
            String badgeLabel,
            String headline,
            String innerHtml,
            String ctaText,
            String ctaUrl
    ) {
        return """
                <!DOCTYPE html>
                <html lang="es">
                <head>
                  <meta charset="UTF-8"/>
                  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
                </head>
                <body style="margin:0;padding:24px 12px;background-color:#F8FAFC;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                  <div style="max-width:620px;margin:0 auto;background:#FFFFFF;border-radius:14px;overflow:hidden;border:1px solid #E2E8F0;box-shadow:0 4px 16px rgba(15,23,42,0.06);">
                    <div style="background:linear-gradient(135deg,#EA580C 0%%,#C2410C 100%%);padding:22px 28px;color:#FFFFFF;">
                      <div style="font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;opacity:0.92;">%s</div>
                      <div style="font-size:21px;font-weight:800;margin-top:4px;letter-spacing:-0.3px;">REPUESTOS ASUNCIÓN</div>
                      <div style="font-size:12px;opacity:0.9;margin-top:2px;">Autopartes OEM &amp; Aftermarket Certificado — Lima, Perú</div>
                    </div>
                    <div style="padding:28px;">
                      <h2 style="margin:0 0 16px;font-size:19px;color:#0F172A;font-weight:700;">%s</h2>
                      %s
                      <div style="margin:26px 0 10px;text-align:center;">
                        <a href="%s" style="display:inline-block;background-color:#EA580C;color:#FFFFFF;text-decoration:none;font-weight:700;font-size:14px;padding:12px 26px;border-radius:8px;">%s</a>
                      </div>
                    </div>
                    <div style="background:#F8FAFC;border-top:1px solid #E2E8F0;padding:16px 28px;text-align:center;font-size:12px;color:#64748B;">
                      <strong>Autopartes Asunción</strong> • Av. Sta. Ana 441, Lima 15011 (Santa Anita) - Perú<br/>
                      Atención Comercial y Despacho Geoespacial • Notificación Automática ERP
                    </div>
                  </div>
                </body>
                </html>
                """.formatted(
                escapeHtml(badgeLabel),
                escapeHtml(headline),
                innerHtml,
                ctaUrl,
                escapeHtml(ctaText)
        );
    }

    private static String extractFriendlySmtpError(Exception e) {
        String msg = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
        if (msg.contains("535") || msg.toLowerCase(Locale.ROOT).contains("authentication")
                || msg.toLowerCase(Locale.ROOT).contains("username and password not accepted")) {
            return "Credenciales rechazadas por el servidor SMTP (535). Verifique que esté usando una Contraseña de Aplicación de Google de 16 caracteres (no su clave normal de Gmail). Detalle: " + msg;
        }
        return msg;
    }

    private static String formatMoney(BigDecimal val) {
        if (val == null) {
            return "0.00";
        }
        return String.format(Locale.US, "%.2f", val);
    }

    private static String escapeHtml(String s) {
        if (s == null) {
            return "";
        }
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }

    private static String nullToEmpty(String s) {
        return s != null ? s : "";
    }

    private static String truncate(String s, int maxLen) {
        if (s == null) {
            return null;
        }
        return s.length() <= maxLen ? s : s.substring(0, maxLen);
    }

    private static String firstNonBlank(String... values) {
        for (String v : values) {
            if (v != null && !v.isBlank()) {
                return v.trim();
            }
        }
        return null;
    }
}
