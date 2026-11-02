package com.asuncion.erp.domain.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "system_mail_config")
public class SystemMailConfig {

    @Id
    private Long id = 1L;

    @Column(name = "enabled", nullable = false)
    private boolean enabled = false;

    @Column(name = "smtp_host", nullable = false, length = 150)
    private String smtpHost = "smtp.gmail.com";

    @Column(name = "smtp_port", nullable = false)
    private Integer smtpPort = 587;

    @Column(name = "username", length = 180)
    private String username;

    @Column(name = "password", length = 255)
    private String password;

    @Column(name = "from_name", nullable = false, length = 150)
    private String fromName = "Repuestos Asunción";

    @Column(name = "admin_notification_email", length = 180)
    private String adminNotificationEmail;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getSmtpHost() {
        return smtpHost;
    }

    public void setSmtpHost(String smtpHost) {
        this.smtpHost = smtpHost;
    }

    public Integer getSmtpPort() {
        return smtpPort;
    }

    public void setSmtpPort(Integer smtpPort) {
        this.smtpPort = smtpPort;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getFromName() {
        return fromName;
    }

    public void setFromName(String fromName) {
        this.fromName = fromName;
    }

    public String getAdminNotificationEmail() {
        return adminNotificationEmail;
    }

    public void setAdminNotificationEmail(String adminNotificationEmail) {
        this.adminNotificationEmail = adminNotificationEmail;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
