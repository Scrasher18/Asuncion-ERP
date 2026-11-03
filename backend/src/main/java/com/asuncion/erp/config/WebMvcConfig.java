package com.asuncion.erp.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Las fotos de /api/v1/media/** se sirven ahora desde {@link com.asuncion.erp.controller.MediaController},
 * que lee del disco local o, si el disco efímero de Render se reinició, desde PostgreSQL.
 */
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {
}
