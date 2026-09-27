# ========================
# Build Stage
# ========================
FROM maven:3.9-eclipse-temurin-21-alpine AS build
WORKDIR /app

# Copy POM and dependencies first (cache layer)
COPY pom.xml ./
RUN mvn dependency:go-offline -B

# Copy source and build
COPY src/ src/
RUN mvn package -DskipTests -B

# ========================
# Runtime Stage
# ========================
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Copy the built JAR
COPY --from=build /app/target/*.jar app.jar

# Expose port
EXPOSE 8080

# Run
ENTRYPOINT ["java", "-jar", "app.jar"]
