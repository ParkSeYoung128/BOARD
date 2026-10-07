FROM gradle:8.14-jdk17 AS build
WORKDIR /src
COPY settings.gradle build.gradle ./
RUN gradle dependencies --no-daemon > /dev/null 2>&1 || true
COPY src ./src
RUN gradle bootJar --no-daemon

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /src/build/libs/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
