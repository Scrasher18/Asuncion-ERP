package com.asuncion.erp.config;

import com.asuncion.erp.service.CatalogService;
import com.asuncion.erp.service.PromotionCatalogService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Lazy;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Coordina en segundo plano la conexión inicial a PostgreSQL/Neon, parches idempotentes,
 * matriz combinable (<= 100 repuestos) y precarga de caché en RAM DESPUÉS de que Tomcat
 * ya abrió el puerto HTTP 8080, evitando cualquier "Port scan timeout" en Render Free Tier.
 */
@Component
@Lazy(false)
public class CloudStartupWarmupCoordinator {

    private static final Logger log = LoggerFactory.getLogger(CloudStartupWarmupCoordinator.class);

    private final boolean asyncWarmup;
    private final DatabaseSchemaPatcher schemaPatcher;
    private final DataSeeder dataSeeder;
    private final MediaUrlFixer mediaUrlFixer;
    private final CatalogMatrixSeeder catalogMatrixSeeder;
    private final CatalogService catalogService;
    private final PromotionCatalogService promotionCatalogService;

    public CloudStartupWarmupCoordinator(
            @Value("${app.startup.async-warmup:false}") boolean asyncWarmup,
            @Lazy DatabaseSchemaPatcher schemaPatcher,
            @Lazy DataSeeder dataSeeder,
            @Lazy MediaUrlFixer mediaUrlFixer,
            @Lazy CatalogMatrixSeeder catalogMatrixSeeder,
            @Lazy CatalogService catalogService,
            @Lazy PromotionCatalogService promotionCatalogService
    ) {
        this.asyncWarmup = asyncWarmup;
        this.schemaPatcher = schemaPatcher;
        this.dataSeeder = dataSeeder;
        this.mediaUrlFixer = mediaUrlFixer;
        this.catalogMatrixSeeder = catalogMatrixSeeder;
        this.catalogService = catalogService;
        this.promotionCatalogService = promotionCatalogService;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        if (!asyncWarmup) {
            return;
        }
        Thread warmupThread = new Thread(() -> {
            try {
                Thread.sleep(1500L);
                log.info("Iniciando calentamiento asíncrono post-arranque (PostgreSQL + Caché Catálogo)...");
                try {
                    schemaPatcher.executePatch();
                } catch (Exception e) {
                    log.warn("Aviso en parche de esquema post-arranque: {}", e.getMessage());
                }
                try {
                    dataSeeder.executeSeed();
                } catch (Exception e) {
                    log.warn("Aviso en verificación inicial de datos: {}", e.getMessage());
                }
                try {
                    mediaUrlFixer.executeFix();
                } catch (Exception e) {
                    log.debug("Aviso en normalización de URLs multimedia: {}", e.getMessage());
                }
                try {
                    catalogMatrixSeeder.executeMatrixSeed();
                } catch (Exception e) {
                    log.warn("Aviso en verificación de matriz combinable: {}", e.getMessage());
                }
                try {
                    promotionCatalogService.seedDefaultPromotionsIfEmpty();
                    promotionCatalogService.getActivePromotions();
                } catch (Exception e) {
                    log.warn("Aviso en precarga de ofertas y combos: {}", e.getMessage());
                }
                try {
                    catalogService.getCategories();
                    log.info("Calentamiento asíncrono completado: catálogo precargado en RAM y listo.");
                } catch (Exception e) {
                    log.warn("Aviso al precargar caché de catálogo en RAM: {}", e.getMessage());
                }
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
            }
        }, "asuncion-cloud-warmup");
        warmupThread.setDaemon(true);
        warmupThread.start();
    }
}
