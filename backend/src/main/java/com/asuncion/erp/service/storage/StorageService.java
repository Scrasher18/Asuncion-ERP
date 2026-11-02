package com.asuncion.erp.service.storage;

public interface StorageService {

    record StoredObject(
            String objectKey,
            String publicUrl,
            String mimeType,
            long sizeBytes
    ) {
    }

    StoredObject store(String folder, String baseFileName, byte[] data, String contentType, String extension);

    void delete(String objectKey);
}
