# ========================
# Build Stage
# ========================
FROM maven:3.9-eclipse-temurin-21-alpine AS build
WORKDIR /app

# Copy POM and dependencies first (cache layer)
COPY pom.xml ./
# dependency:resolve theo dependencyManagement của Spring Boot; go-offline thì không
# (thư viện Yubico WebAuthn kéo theo Jackson và go-offline chọn nhầm bản SNAPSHOT không tồn tại)
RUN mvn dependency:resolve dependency:resolve-plugins -B

# Copy source and build
COPY src/ src/
RUN mvn package -DskipTests -B

# ========================
# Runtime Stage
# ========================
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

RUN addgroup -S -g 10001 app && adduser -S -u 10001 -G app app

COPY --from=build --chown=app:app /app/target/*.jar app.jar

USER app
EXPOSE 8080

# JVM theo giới hạn RAM của container thay vì RAM của máy host
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75.0 -XX:+ExitOnOutOfMemoryError"

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD wget -qO- http://localhost:8080/actuator/health | grep -q '"status":"UP"' || exit 1

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
