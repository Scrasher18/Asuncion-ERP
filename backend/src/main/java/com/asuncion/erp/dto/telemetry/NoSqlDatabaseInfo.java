package com.asuncion.erp.dto.telemetry;

public record NoSqlDatabaseInfo(
        String engine,
        String database,
        String collection,
        boolean connected,
        long totalDocuments,
        String storagePath,
        int activeTracksCount,
        String statusMessage
) {
}
