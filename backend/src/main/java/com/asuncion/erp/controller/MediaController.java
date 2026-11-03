package com.asuncion.erp.controller;

import com.asuncion.erp.domain.entity.StoredMedia;
import com.asuncion.erp.service.storage.LocalStorageService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Optional;
import java.util.concurrent.TimeUnit;

/**
 * Sirve fotos de repuestos subidas desde el panel. Primero busca en disco (caché) y
 * luego en PostgreSQL, de modo que las imágenes no se pierden cuando el servidor se reinicia.
 */
@RestController
public class MediaController {

    private static final String PREFIX = "/api/v1/media/";

    private final ObjectProvider<LocalStorageService> localStorage;

    public MediaController(ObjectProvider<LocalStorageService> localStorage) {
        this.localStorage = localStorage;
    }

    @GetMapping("/api/v1/media/**")
    public ResponseEntity<byte[]> serve(HttpServletRequest request) {
        String uri = request.getRequestURI();
        int idx = uri.indexOf(PREFIX);
        if (idx < 0) {
            return ResponseEntity.notFound().build();
        }
        String objectKey = uri.substring(idx + PREFIX.length());
        if (objectKey.isBlank() || objectKey.contains("..")) {
            return ResponseEntity.notFound().build();
        }

        LocalStorageService storage = localStorage.getIfAvailable();
        if (storage == null) {
            return ResponseEntity.notFound().build();
        }

        Optional<StoredMedia> media = storage.load(objectKey);
        if (media.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        StoredMedia m = media.get();
        MediaType type;
        try {
            type = MediaType.parseMediaType(m.getContentType());
        } catch (Exception e) {
            type = MediaType.APPLICATION_OCTET_STREAM;
        }
        return ResponseEntity.ok()
                .contentType(type)
                .cacheControl(CacheControl.maxAge(30, TimeUnit.DAYS).cachePublic())
                .body(m.getData());
    }
}
