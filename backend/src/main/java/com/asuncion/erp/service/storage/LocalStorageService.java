package com.asuncion.erp.service.storage;

import com.asuncion.erp.domain.entity.StoredMedia;
import com.asuncion.erp.repository.StoredMediaRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Optional;
import java.util.UUID;

@Service
@ConditionalOnProperty(name = "app.storage.type", havingValue = "local", matchIfMissing = true)
public class LocalStorageService implements StorageService {

    private static final Logger log = LoggerFactory.getLogger(LocalStorageService.class);

    private final Path rootDir;
    private final String publicBaseUrl;
    private final StoredMediaRepository storedMediaRepository;

    public LocalStorageService(
            @Value("${app.storage.local.base-dir:./uploads}") String baseDir,
            @Value("${app.storage.local.public-url:/api/v1/media}") String publicBaseUrl,
            StoredMediaRepository storedMediaRepository
    ) {
        this.rootDir = Paths.get(baseDir).toAbsolutePath().normalize();
        this.storedMediaRepository = storedMediaRepository;
        String base = normalizePublicBase(publicBaseUrl);
        this.publicBaseUrl = base.endsWith("/") ? base.substring(0, base.length() - 1) : base;
        try {
            Files.createDirectories(this.rootDir);
        } catch (IOException e) {
            throw new IllegalStateException("No se pudo inicializar el directorio local de almacenamiento multimedia: " + this.rootDir, e);
        }
    }

    /**
     * Las URLs con localhost no sirven en producción (Vercel/Render). Se usa una ruta relativa
     * que el frontend resuelve contra su propio dominio (proxy /api -> backend).
     */
    private static String normalizePublicBase(String configured) {
        if (configured == null || configured.isBlank()
                || configured.contains("localhost") || configured.contains("127.0.0.1")) {
            return "/api/v1/media";
        }
        return configured.trim();
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

        // 1. Copia persistente en base de datos (sobrevive reinicios del servidor)
        storedMediaRepository.save(new StoredMedia(objectKey, contentType, data));

        // 2. Copia en disco local como caché de lectura rápida
        try {
            Files.createDirectories(targetPath.getParent());
            Files.write(targetPath, data);
        } catch (IOException e) {
            log.warn("No se pudo escribir caché local {}: {}", objectKey, e.getMessage());
        }

        String publicUrl = publicBaseUrl + "/" + objectKey;
        return new StoredObject(objectKey, publicUrl, contentType, data.length);
    }

    /**
     * Lee un objeto multimedia desde el disco local o, si no existe (disco efímero), desde la base de datos.
     */
    public Optional<StoredMedia> load(String objectKey) {
        if (objectKey == null || objectKey.isBlank()) {
            return Optional.empty();
        }
        Path targetPath = rootDir.resolve(objectKey).normalize();
        if (!targetPath.startsWith(rootDir)) {
            return Optional.empty();
        }
        if (Files.isRegularFile(targetPath)) {
            try {
                byte[] bytes = Files.readAllBytes(targetPath);
                String type = Files.probeContentType(targetPath);
                return Optional.of(new StoredMedia(objectKey, type != null ? type : guessType(objectKey), bytes));
            } catch (IOException e) {
                log.warn("No se pudo leer caché local {}: {}", objectKey, e.getMessage());
            }
        }
        Optional<StoredMedia> fromDb = storedMediaRepository.findById(objectKey);
        fromDb.ifPresent(m -> {
            try {
                Files.createDirectories(targetPath.getParent());
                Files.write(targetPath, m.getData());
            } catch (IOException ignored) {
                // la caché local es opcional
            }
        });
        return fromDb;
    }

    @Override
    public void delete(String objectKey) {
        if (objectKey == null || objectKey.isBlank()) {
            return;
        }
        try {
            storedMediaRepository.deleteById(objectKey);
        } catch (Exception e) {
            log.debug("Objeto {} no estaba en base de datos: {}", objectKey, e.getMessage());
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

    private static String guessType(String key) {
        String k = key.toLowerCase();
        if (k.endsWith(".webp")) return "image/webp";
        if (k.endsWith(".png")) return "image/png";
        if (k.endsWith(".jpg") || k.endsWith(".jpeg")) return "image/jpeg";
        return "application/octet-stream";
    }

    private String sanitize(String input) {
        if (input == null || input.isBlank()) {
            return "media";
        }
        String cleaned = input.toLowerCase().replaceAll("[^a-z0-9-_]", "-").replaceAll("-+", "-");
        return cleaned.length() > 40 ? cleaned.substring(0, 40) : cleaned;
    }
}
