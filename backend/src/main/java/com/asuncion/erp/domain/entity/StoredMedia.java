package com.asuncion.erp.domain.entity;

import jakarta.persistence.*;

import java.time.Instant;

/**
 * Copia persistente de archivos multimedia (fotos de repuestos) en PostgreSQL.
 * Render (plan gratuito) usa disco efímero: los archivos en ./uploads se pierden
 * en cada reinicio/redeploy, por eso los bytes se guardan también en la base de datos.
 */
@Entity
@Table(name = "media_objects")
public class StoredMedia {

    @Id
    @Column(name = "object_key", nullable = false, length = 500)
    private String objectKey;

    @Column(name = "content_type", nullable = false, length = 100)
    private String contentType;

    @Column(name = "size_bytes", nullable = false)
    private long sizeBytes;

    @Column(name = "data", nullable = false, columnDefinition = "bytea")
    private byte[] data;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public StoredMedia() {
    }

    public StoredMedia(String objectKey, String contentType, byte[] data) {
        this.objectKey = objectKey;
        this.contentType = contentType;
        this.data = data;
        this.sizeBytes = data != null ? data.length : 0;
        this.createdAt = Instant.now();
    }

    public String getObjectKey() {
        return objectKey;
    }

    public String getContentType() {
        return contentType;
    }

    public long getSizeBytes() {
        return sizeBytes;
    }

    public byte[] getData() {
        return data;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
