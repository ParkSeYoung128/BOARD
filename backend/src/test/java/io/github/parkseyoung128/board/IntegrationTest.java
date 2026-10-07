package io.github.parkseyoung128.board;

import java.sql.Timestamp;
import java.time.Instant;

import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;

/** 실제 PostgreSQL 16(Testcontainers) 위에서 도는 통합 테스트 공통 베이스. 컨테이너는 JVM 당 1개. */
@SpringBootTest(properties = "app.seed-enabled=false")
@AutoConfigureMockMvc
public abstract class IntegrationTest {

    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    static {
        POSTGRES.start();
    }

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired
    protected MockMvc mvc;

    @Autowired
    protected JdbcTemplate jdbc;

    @BeforeEach
    void cleanDatabase() {
        jdbc.execute("truncate table post_likes, comments, posts restart identity cascade");
    }

    /** 게시글 직접 삽입(작성 시각 지정). 새로 생긴 id 반환. */
    protected long insertPost(String title, String author, Instant createdAt, int likeCount) {
        return jdbc.queryForObject("""
                insert into posts (title, content, author, like_count, created_at)
                values (?, 'content', ?, ?, ?) returning id
                """, Long.class, title, author, likeCount, Timestamp.from(createdAt));
    }

    protected long insertComment(long postId, String author, Instant createdAt) {
        return jdbc.queryForObject("""
                insert into comments (post_id, content, author, created_at)
                values (?, 'comment', ?, ?) returning id
                """, Long.class, postId, author, Timestamp.from(createdAt));
    }
}
