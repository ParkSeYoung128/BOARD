package io.github.parkseyoung128.board.seed;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashSet;
import java.util.Set;

import com.fasterxml.jackson.databind.ObjectMapper;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.SmartInitializingSingleton;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 앱 기동 시 seed.json 을 적재한다.
 *
 * <ul>
 *   <li>시점: 모든 빈이 만들어진 뒤, 웹 서버가 연결을 받기 전({@link SmartInitializingSingleton}).
 *       따라서 /health 가 200 이면 적재가 끝난 상태다.</li>
 *   <li>멱등: {@code INSERT ... ON CONFLICT (id) DO NOTHING}. 재기동해도 중복되지 않고,
 *       삭제 표시(deleted_at)는 행을 처음 넣을 때만 채우므로 삭제된 글이 되살아나지도 않는다.</li>
 *   <li>동시 기동 보호: 한 트랜잭션 안에서 advisory lock 을 잡는다. 동시에 뜬 인스턴스는 순서를 기다렸다가
 *       이미 들어간 행을 건너뛴다.</li>
 *   <li>id 유지 + 시퀀스 보정: 시드의 id 를 그대로 넣고, IDENTITY 시퀀스를 max(id)로 맞춰 새 글·댓글의 PK 충돌을 막는다.</li>
 * </ul>
 */
@Component
public class SeedLoader implements SmartInitializingSingleton {

    private static final Logger log = LoggerFactory.getLogger(SeedLoader.class);

    /** 시드 적재 전용 advisory lock 키(다른 용도의 lock 과 겹치지 않는 임의 상수). */
    static final long LOCK_KEY = 4_815_162_342L;
    private static final int BATCH_SIZE = 500;

    private static final String INSERT_POST = """
            insert into posts (id, title, content, like_count, author, created_at, deleted_at)
            values (?, ?, ?, ?, ?, ?, ?)
            on conflict (id) do nothing
            """;

    private static final String INSERT_COMMENT = """
            insert into comments (id, post_id, content, author, created_at, deleted_at)
            values (?, ?, ?, ?, ?, ?)
            on conflict (id) do nothing
            """;

    private final JdbcTemplate jdbc;
    private final TransactionTemplate transaction;
    private final ObjectMapper mapper;
    private final boolean enabled;
    private final String seedPath;

    public SeedLoader(JdbcTemplate jdbc,
                      PlatformTransactionManager transactionManager,
                      ObjectMapper mapper,
                      @Value("${app.seed-enabled}") boolean enabled,
                      @Value("${app.seed-path}") String seedPath) {
        this.jdbc = jdbc;
        this.transaction = new TransactionTemplate(transactionManager);
        this.mapper = mapper;
        this.enabled = enabled;
        this.seedPath = seedPath;
    }

    @Override
    public void afterSingletonsInstantiated() {
        if (!enabled) {
            log.info("시드 적재를 건너뜁니다(app.seed-enabled=false)");
            return;
        }
        load(Path.of(seedPath));
    }

    /** 파일을 읽어 적재한다. 파일이 없거나 읽을 수 없으면 기동을 실패시킨다(시드 없는 서비스는 정상이 아니다). */
    public void load(Path path) {
        if (!Files.isRegularFile(path)) {
            throw new IllegalStateException("시드 파일을 찾을 수 없습니다: " + path.toAbsolutePath().normalize());
        }
        SeedData data;
        try {
            data = mapper.readValue(path.toFile(), SeedData.class);
        } catch (IOException e) {
            throw new IllegalStateException("시드 파일을 읽을 수 없습니다: " + path, e);
        }
        load(data);
    }

    public void load(SeedData data) {
        transaction.executeWithoutResult(status -> {
            jdbc.query("select pg_advisory_xact_lock(?)", rs -> {
                rs.next();
                return null;
            }, LOCK_KEY);

            Instant now = Instant.now();
            Set<Long> deletedPosts = new HashSet<>(data.deletedPostIds());
            Set<Long> deletedComments = new HashSet<>(data.deletedCommentIds());

            int posts = inserted(jdbc.batchUpdate(INSERT_POST, data.posts(), BATCH_SIZE, (ps, p) -> {
                ps.setLong(1, p.id());
                ps.setString(2, p.title());
                ps.setString(3, p.content());
                ps.setInt(4, p.likeCount());
                ps.setString(5, p.author());
                ps.setTimestamp(6, seconds(p.createdAt()));
                ps.setTimestamp(7, deletedPosts.contains(p.id()) ? seconds(now) : null);
            }));

            int comments = inserted(jdbc.batchUpdate(INSERT_COMMENT, data.comments(), BATCH_SIZE, (ps, c) -> {
                ps.setLong(1, c.id());
                ps.setLong(2, c.postId());
                ps.setString(3, c.content());
                ps.setString(4, c.author());
                ps.setTimestamp(5, seconds(c.createdAt()));
                ps.setTimestamp(6, deletedComments.contains(c.id()) ? seconds(now) : null);
            }));

            syncSequence("posts");
            syncSequence("comments");

            log.info("시드 적재 완료: 게시글 {}건 추가(전체 {}), 댓글 {}건 추가(전체 {})",
                    posts, count("posts"), comments, count("comments"));
        });
    }

    /**
     * 시각은 초 단위로 절삭해 저장한다. 서비스의 작성 경로와 같은 규칙이며, 커서가 epochSecond 만 담기 때문에
     * DB 에 소수 초가 있으면 같은 초의 항목이 다음 페이지에서 누락될 수 있다.
     */
    private static Timestamp seconds(Instant instant) {
        return Timestamp.from(instant.truncatedTo(ChronoUnit.SECONDS));
    }

    private static int inserted(int[][] results) {
        int sum = 0;
        for (int[] batch : results) {
            for (int result : batch) {
                if (result > 0) {
                    sum += result;
                }
            }
        }
        return sum;
    }

    /** 다음에 발급될 id 가 max(id)+1 이 되도록 시퀀스를 맞춘다(행이 없으면 1부터). */
    private void syncSequence(String table) {
        jdbc.query("select setval(pg_get_serial_sequence('" + table + "', 'id'), coalesce(max(id), 1), count(*) > 0) from "
                + table, rs -> {
            rs.next();
            return null;
        });
    }

    private long count(String table) {
        Long total = jdbc.queryForObject("select count(*) from " + table, Long.class);
        return total == null ? 0 : total;
    }
}
