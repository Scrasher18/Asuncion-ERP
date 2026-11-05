package com.asuncion.erp.domain.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "system_payment_config")
public class SystemPaymentConfig {

    @Id
    private Long id = 1L;

    @Column(name = "culqi_enabled", nullable = false)
    private boolean culqiEnabled = true;

    @Column(name = "culqi_public_key", length = 150)
    private String culqiPublicKey = "";

    @Column(name = "culqi_secret_key", length = 150)
    private String culqiSecretKey = "";

    @Column(name = "pagoefectivo_enabled", nullable = false)
    private boolean pagoefectivoEnabled = false;

    @Column(name = "pagoefectivo_service_id", length = 100)
    private String pagoefectivoServiceId = "";

    @Column(name = "pagoefectivo_secret_key", length = 150)
    private String pagoefectivoSecretKey = "";

    @Column(name = "niubiz_enabled", nullable = false)
    private boolean niubizEnabled = false;

    @Column(name = "niubiz_merchant_id", length = 100)
    private String niubizMerchantId;

    @Column(name = "niubiz_user", length = 100)
    private String niubizUser;

    @Column(name = "niubiz_password", length = 100)
    private String niubizPassword;

    @Column(name = "environment", nullable = false, length = 20)
    private String environment = "SANDBOX"; // SANDBOX or PRODUCTION

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Column(name = "yape_phone", length = 50)
    private String yapePhone = "922779157";

    @Column(name = "yape_holder", length = 150)
    private String yapeHolder = "Repuestos Automotrices Asunción S.A.C.";

    @Column(name = "yape_qr_image_url", columnDefinition = "TEXT")
    private String yapeQrImageUrl;

    @Column(name = "plin_phone", length = 50)
    private String plinPhone = "922779157";

    @Column(name = "plin_holder", length = 150)
    private String plinHolder = "Repuestos Automotrices Asunción S.A.C.";

    @Column(name = "plin_qr_image_url", columnDefinition = "TEXT")
    private String plinQrImageUrl;

    @Column(name = "wallet_instructions", columnDefinition = "TEXT")
    private String walletInstructions = "Envía la constancia o captura de tu pago al WhatsApp +51 922779157 indicando tu N° de Pedido.";

    public SystemPaymentConfig() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public boolean isCulqiEnabled() {
        return culqiEnabled;
    }

    public void setCulqiEnabled(boolean culqiEnabled) {
        this.culqiEnabled = culqiEnabled;
    }

    public String getCulqiPublicKey() {
        return culqiPublicKey;
    }

    public void setCulqiPublicKey(String culqiPublicKey) {
        this.culqiPublicKey = culqiPublicKey;
    }

    public String getCulqiSecretKey() {
        return culqiSecretKey;
    }

    public void setCulqiSecretKey(String culqiSecretKey) {
        this.culqiSecretKey = culqiSecretKey;
    }

    public boolean isPagoefectivoEnabled() {
        return pagoefectivoEnabled;
    }

    public void setPagoefectivoEnabled(boolean pagoefectivoEnabled) {
        this.pagoefectivoEnabled = pagoefectivoEnabled;
    }

    public String getPagoefectivoServiceId() {
        return pagoefectivoServiceId;
    }

    public void setPagoefectivoServiceId(String pagoefectivoServiceId) {
        this.pagoefectivoServiceId = pagoefectivoServiceId;
    }

    public String getPagoefectivoSecretKey() {
        return pagoefectivoSecretKey;
    }

    public void setPagoefectivoSecretKey(String pagoefectivoSecretKey) {
        this.pagoefectivoSecretKey = pagoefectivoSecretKey;
    }

    public boolean isNiubizEnabled() {
        return niubizEnabled;
    }

    public void setNiubizEnabled(boolean niubizEnabled) {
        this.niubizEnabled = niubizEnabled;
    }

    public String getNiubizMerchantId() {
        return niubizMerchantId;
    }

    public void setNiubizMerchantId(String niubizMerchantId) {
        this.niubizMerchantId = niubizMerchantId;
    }

    public String getNiubizUser() {
        return niubizUser;
    }

    public void setNiubizUser(String niubizUser) {
        this.niubizUser = niubizUser;
    }

    public String getNiubizPassword() {
        return niubizPassword;
    }

    public void setNiubizPassword(String niubizPassword) {
        this.niubizPassword = niubizPassword;
    }

    public String getEnvironment() {
        return environment;
    }

    public void setEnvironment(String environment) {
        this.environment = environment;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public String getYapePhone() {
        return yapePhone;
    }

    public void setYapePhone(String yapePhone) {
        this.yapePhone = yapePhone;
    }

    public String getYapeHolder() {
        return yapeHolder;
    }

    public void setYapeHolder(String yapeHolder) {
        this.yapeHolder = yapeHolder;
    }

    public String getYapeQrImageUrl() {
        return yapeQrImageUrl;
    }

    public void setYapeQrImageUrl(String yapeQrImageUrl) {
        this.yapeQrImageUrl = yapeQrImageUrl;
    }

    public String getPlinPhone() {
        return plinPhone;
    }

    public void setPlinPhone(String plinPhone) {
        this.plinPhone = plinPhone;
    }

    public String getPlinHolder() {
        return plinHolder;
    }

    public void setPlinHolder(String plinHolder) {
        this.plinHolder = plinHolder;
    }

    public String getPlinQrImageUrl() {
        return plinQrImageUrl;
    }

    public void setPlinQrImageUrl(String plinQrImageUrl) {
        this.plinQrImageUrl = plinQrImageUrl;
    }

    public String getWalletInstructions() {
        return walletInstructions;
    }

    public void setWalletInstructions(String walletInstructions) {
        this.walletInstructions = walletInstructions;
    }
}
