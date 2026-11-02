package com.asuncion.erp.service.storage;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;

@Service
@ConditionalOnProperty(name = "app.storage.type", havingValue = "local", matchIfMissing = true)
public class LocalStorageService implements StorageService {

    private static final Logger log = LoggerFactory.getLogger(LocalStorageService.class);

    private final Path rootDir;
    private final String publicBaseUrl;

    public LocalStorageService(
            @Value("${app.storage.local.base-dir:./uploads}") String baseDir,
            @Value("${app.storage.local.public-url:http://localhost:8080/api/v1/media}") String publicBaseUrl
    ) {
        this.rootDir = Paths.get(baseDir).toAbsolutePath().normalize();
        this.publicBaseUrl = publicBaseUrl.endsWith("/")
                ? publicBaseUrl.substring(0, publicBaseUrl.length() - 1)
                : publicBaseUrl;
        try {
            Files.createDirectories(this.rootDir);
        } catch (IOException e) {
            throw new IllegalStateException("No se pudo inicializar el directorio local de almacenamiento multimedia: " + this.rootDir, e);
        }
    }

    @Override
    public StoredObject store(String folder, String baseFileName, byte[] data, String contentType, String extension) {
        String safeBase = sanitize(baseFileName);
        String ext = extension.startsWith(".") ? extension : "." + extension;
        String fileName = safeBase + "-" + UUID.randomUUID().toString().substring(0, 8) + ext;
        String cleanFolder = folder.replace("\\", "/").replaceAll("^/+|/+$", "");
        String objectKey = cleanFolder.isEmpty() ? fileName : cleanFolder + "/" + fileName;

        Path targetPath = rootDir.resolve(objectKey).normalize();
        if (!targetPath.startsWith(rootDir)) {
            throw new IllegalArgumentException("Ruta de almacenamiento inválida: " + objectKey);
        }

        try {
            Files.createDirectories(targetPath.getParent());
            Files.write(targetPath, data);
        } catch (IOException e) {
            throw new IllegalStateException("Error guardando objeto multimedia local: " + objectKey, e);
        }

        String publicUrl = publicBaseUrl + "/" + objectKey;
        return new StoredObject(objectKey, publicUrl, contentType, data.length);
    }

    @Override
    public void delete(String objectKey) {
        if (objectKey == null || objectKey.isBlank()) {
            return;
        }
        try {
            Path targetPath = rootDir.resolve(objectKey).normalize();
            if (targetPath.startsWith(rootDir)) {
                Files.deleteIfExists(targetPath);
            }
        } catch (IOException e) {
            log.warn("No se pudo eliminar archivo local {}: {}", objectKey, e.getMessage());
        }
    }

    private String sanitize(String input) {
        if (input == null || input.isBlank()) {
            return "media";
        }
        String cleaned = input.toLowerCase().replaceAll("[^a-z0-9-_]", "-").replaceAll("-+", "-");
        return cleaned.length() > 40 ? cleaned.substring(0, 40) : cleaned;
    }
}
