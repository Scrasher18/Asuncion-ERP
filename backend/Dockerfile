# ==============================================================================
# Stage 1: Build Spring Boot 3.4.3 Executable JAR (Eclipse Temurin 21 JDK)
# ==============================================================================
FROM eclipse-temurin:21-jdk AS builder

WORKDIR /workspace

COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN sed -i 's/\r$//' mvnw && chmod +x mvnw && ./mvnw dependency:go-offline -B

COPY src/ src/
RUN ./mvnw clean package -DskipTests -B

# ==============================================================================
# Stage 2: Production Hardened Runtime (Eclipse Temurin 21 JRE)
# ==============================================================================
FROM eclipse-temurin:21-jre

LABEL maintainer="Arquitectura Cloud - Repuestos Automotrices Asunción"
LABEL org.opencontainers.image.title="asuncion-erp-backend"
LABEL org.opencontainers.image.version="1.0.0"

RUN groupadd -r asuncion && useradd -r -g asuncion asuncion

WORKDIR /app
RUN mkdir -p /app/uploads && chown -R asuncion:asuncion /app

COPY --from=builder --chown=asuncion:asuncion /workspace/target/*.jar /app/app.jar

USER asuncion

EXPOSE 8080

# Optimización de Memoria para Render Free Tier (Límite estricto 512MB RAM)
# -Xmx280m: Heap máximo controlado de 280MB
# -Xms128m: Heap inicial bajo
# -XX:MaxMetaspaceSize=112m: Metaspace acotado para Spring Boot 3 y Hibernate
# -Xss256k: Hilos ligeros (256KB por hilo en lugar del 1MB por defecto)
# -XX:+UseSerialGC: Recolector monohilo sin overhead nativo de buffers concurrentes G1
ENV JAVA_OPTS="-XX:+UseContainerSupport -Xmx280m -Xms128m -XX:MaxMetaspaceSize=112m -Xss256k -XX:+UseSerialGC -XX:+ExitOnOutOfMemoryError -Djava.security.egd=file:/dev/./urandom"
ENV JAVA_TOOL_OPTIONS="-XX:+UseContainerSupport -Xmx280m -Xms128m -XX:MaxMetaspaceSize=112m -Xss256k -XX:+UseSerialGC -XX:+ExitOnOutOfMemoryError"
ENV SPRING_PROFILES_ACTIVE=docker

HEALTHCHECK --interval=20s --timeout=5s --start-period=35s --retries=3 \
  CMD curl -fsS http://localhost:8080/actuator/health || exit 1

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar /app/app.jar"]
