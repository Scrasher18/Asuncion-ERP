package com.asuncion.erp.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI asuncionOpenAPI() {
        final String schemeName = "bearerAuth";
        return new OpenAPI()
                .info(new Info()
                        .title("Repuestos Automotrices Asunción - Cloud ERP & E-Commerce API")
                        .version("1.0.0")
                        .description("API RESTful empresarial con Spring Security 6 JWT Stateless, Catálogo de Compatibilidad Vehicular 3FN, Compresión WebP en S3/MinIO, Logística Geoespacial PostGIS (ST_DWithin / ST_Distance), Picking de Almacén, Despacho Motorizado y Analítica Ejecutiva.")
                        .contact(new Contact()
                                .name("Arquitectura Cloud - Repuestos Automotrices Asunción")
                                .email("admin@asuncion.pe")))
                .addSecurityItem(new SecurityRequirement().addList(schemeName))
                .components(new Components()
                        .addSecuritySchemes(schemeName, new SecurityScheme()
                                .name(schemeName)
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")));
    }
}
