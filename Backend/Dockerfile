# Backend (Spring Boot) - multi-stage
# 빌드: Gradle로 JAR 생성 → 실행: Eclipse Temurin JRE 17

FROM eclipse-temurin:17-jdk-alpine AS builder
WORKDIR /app

# Gradle wrapper + 설정만 먼저 복사 (캐시 활용)
COPY gradlew .
COPY gradle gradle
COPY build.gradle .
COPY settings.gradle .
RUN chmod +x gradlew

# 의존성만 다운로드 (소스 변경 시 재다운로드 방지)
RUN ./gradlew dependencies --no-daemon || true

COPY src src
RUN ./gradlew bootJar --no-daemon -x test

# 실행 스테이지
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

RUN adduser -D -u 1000 appuser
USER appuser

COPY --from=builder /app/build/libs/*.jar app.jar

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
