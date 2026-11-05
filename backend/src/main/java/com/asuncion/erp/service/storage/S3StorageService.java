package com.asuncion.erp.service.storage;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;

import java.net.URI;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;

@Service
@ConditionalOnProperty(name = "app.storage.type", havingValue = "s3")
public class S3StorageService implements StorageService {

    private static final Logger log = LoggerFactory.getLogger(S3StorageService.class);

    private final S3Client s3Client;
    private final String bucket;
    private final String publicBaseUrl;
    private final AtomicBoolean bucketChecked = new AtomicBoolean(false);

    public S3StorageService(
            @Value("${app.storage.s3.endpoint:http://minio:9000}") String endpoint,
            @Value("${app.storage.s3.region:us-east-1}") String region,
            @Value("${app.storage.s3.bucket:asuncion-media}") String bucket,
            @Value("${app.storage.s3.public-url:http://localhost:9000/asuncion-media}") String publicUrl,
            @Value("${app.storage.s3.access-key:minioadmin}") String accessKey,
            @Value("${app.storage.s3.secret-key:}") String secretKey
    ) {
        this.bucket = bucket;
        this.publicBaseUrl = publicUrl.endsWith("/")
                ? publicUrl.substring(0, publicUrl.length() - 1)
                : publicUrl;

        this.s3Client = S3Client.builder()
                .endpointOverride(URI.create(endpoint))
                .region(Region.of(region))
                .credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKey, secretKey)))
                .forcePathStyle(true)
                .build();
    }

    @Override
    public StoredObject store(String folder, String baseFileName, byte[] data, String contentType, String extension) {
        ensureBucketInitialized();

        String safeBase = sanitize(baseFileName);
        String ext = extension.startsWith(".") ? extension : "." + extension;
        String fileName = safeBase + "-" + UUID.randomUUID().toString().substring(0, 8) + ext;
        String cleanFolder = folder.replace("\\", "/").replaceAll("^/+|/+$", "");
        String objectKey = cleanFolder.isEmpty() ? fileName : cleanFolder + "/" + fileName;

        PutObjectRequest putReq = PutObjectRequest.builder()
                .bucket(bucket)
                .key(objectKey)
                .contentType(contentType)
                .cacheControl("public, max-age=604800")
                .build();

        s3Client.putObject(putReq, RequestBody.fromBytes(data));

        String publicUrl = publicBaseUrl + "/" + objectKey;
        return new StoredObject(objectKey, publicUrl, contentType, data.length);
    }

    @Override
    public void delete(String objectKey) {
        if (objectKey == null || objectKey.isBlank()) {
            return;
        }
        try {
            s3Client.deleteObject(DeleteObjectRequest.builder()
                    .bucket(bucket)
                    .key(objectKey)
                    .build());
        } catch (Exception e) {
            log.warn("No se pudo eliminar objeto S3/MinIO {}: {}", objectKey, e.getMessage());
        }
    }

    private void ensureBucketInitialized() {
        if (bucketChecked.get()) {
            return;
        }
        synchronized (this) {
            if (bucketChecked.get()) {
                return;
            }
            try {
                s3Client.headBucket(HeadBucketRequest.builder().bucket(bucket).build());
                bucketChecked.set(true);
            } catch (NoSuchBucketException e) {
                try {
                    s3Client.createBucket(CreateBucketRequest.builder().bucket(bucket).build());
                    String policy = """
                            {
                              "Version": "2012-10-17",
                              "Statement": [
                                {
                                  "Effect": "Allow",
                                  "Principal": "*",
                                  "Action": ["s3:GetObject"],
                                  "Resource": ["arn:aws:s3:::%s/*"]
                                }
                              ]
                            }
                            """.formatted(bucket);
                    s3Client.putBucketPolicy(PutBucketPolicyRequest.builder()
                            .bucket(bucket)
                            .policy(policy)
                            .build());
                    bucketChecked.set(true);
                    log.info("S3/MinIO bucket '{}' creado y configurado para lectura pública multimedia.", bucket);
                } catch (Exception createEx) {
                    log.warn("No se pudo inicializar bucket S3/MinIO '{}': {}", bucket, createEx.getMessage());
                }
            } catch (Exception e) {
                log.warn("Verificación de bucket S3/MinIO '{}': {}", bucket, e.getMessage());
            }
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
