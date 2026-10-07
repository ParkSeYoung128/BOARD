package io.github.parkseyoung128.board;

import java.util.Map;

import javax.sql.DataSource;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {

    private final DataSource dataSource;

    public HealthController(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        try (var connection = dataSource.getConnection()) {
            connection.getMetaData().getDatabaseProductVersion();
            return ResponseEntity.ok(Map.of("status", "ok", "db", "up"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("status", "down", "db", "unreachable"));
        }
    }
}
