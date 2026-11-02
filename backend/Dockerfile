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

ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -Djava.security.egd=file:/dev/./urandom"
ENV SPRING_PROFILES_ACTIVE=docker

HEALTHCHECK --interval=20s --timeout=5s --start-period=35s --retries=3 \
  CMD curl -fsS http://localhost:8080/actuator/health || exit 1

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar /app/app.jar"]
