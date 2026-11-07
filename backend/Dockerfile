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

# Optimización de Arranque Rápido y Memoria para Render Free Tier (0.1 vCPU / 512MB RAM)
# -XX:+TieredCompilation -XX:TieredStopAtLevel=1: Evita compilación JIT C2 pesada en 0.1 vCPU (reduce el arranque >55%)
# -Xms160m -Xmx256m: Sin pausas GC repetitivas por expansión de heap durante el arranque
# -XX:MaxMetaspaceSize=160m -Xss256k -XX:+UseSerialGC: Huella nativa mínima y determinista bajo 512MB
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:+TieredCompilation -XX:TieredStopAtLevel=1 -Xms160m -Xmx256m -XX:MaxMetaspaceSize=160m -Xss256k -XX:+UseSerialGC -Djava.security.egd=file:/dev/./urandom"
ENV SPRING_PROFILES_ACTIVE=postgres

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]
