package com.asuncion.erp.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Corrige al iniciar las URLs de fotos que quedaron guardadas con "http://localhost:8080",
 * reemplazándolas por la ruta relativa /api/v1/media que funciona en producción.
 */
@Component
public class MediaUrlFixer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(MediaUrlFixer.class);

    private final JdbcTemplate jdbcTemplate;

    public MediaUrlFixer(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(ApplicationArguments args) {
        try {
            int updated = jdbcTemplate.update(
                    "UPDATE part_images SET image_url = regexp_replace(image_url, '^https?://(localhost|127\\.0\\.0\\.1)(:[0-9]+)?/api/v1/media', '/api/v1/media') "
                            + "WHERE image_url ~ '^https?://(localhost|127\\.0\\.0\\.1)'"
            );
            if (updated > 0) {
                log.info("URLs de fotos corregidas a ruta relativa: {}", updated);
            }
        } catch (Exception e) {
            log.debug("No se pudieron normalizar URLs de fotos: {}", e.getMessage());
        }
    }
}
