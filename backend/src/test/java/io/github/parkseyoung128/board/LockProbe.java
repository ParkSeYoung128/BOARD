package io.github.parkseyoung128.board;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.time.Duration;
import java.time.Instant;

import javax.sql.DataSource;

import org.springframework.jdbc.core.JdbcTemplate;

/**
 * 락 경합을 타이밍이 아니라 "상태"로 재현하는 도구.
 * <ul>
 *   <li>{@link #hold}: 별도 커넥션에서 트랜잭션을 열고 SQL 을 실행한 채 커밋하지 않는다. (행 락을 쥐고 있는 다른 트랜잭션 역할)</li>
 *   <li>{@link #awaitLockWait}: 어떤 세션이 락 때문에 기다리는 상태가 될 때까지 pg_stat_activity 를 폴링한다.
 *       sleep 으로 "충분히 기다렸겠지" 하고 넘어가면 느린 환경에서 대기 시작 전에 검증이 끝나 거짓 통과가 나온다.</li>
 * </ul>
 */
public final class LockProbe implements AutoCloseable {

    private static final Duration WAIT_TIMEOUT = Duration.ofSeconds(10);

    private final Connection connection;
    private boolean finished;

    private LockProbe(Connection connection) {
        this.connection = connection;
    }

    /** 새 커넥션에서 트랜잭션을 열고 sql 을 실행한다. 커밋/롤백은 호출자가 한다. */
    public static LockProbe hold(DataSource dataSource, String sql, Object... params) throws SQLException {
        Connection connection = dataSource.getConnection();
        connection.setAutoCommit(false);
        LockProbe probe = new LockProbe(connection);
        try {
            probe.execute(sql, params);
        } catch (SQLException | RuntimeException e) {
            probe.close();
            throw e;
        }
        return probe;
    }

    /** 같은 트랜잭션에서 SQL 을 더 실행한다. */
    public void execute(String sql, Object... params) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            for (int i = 0; i < params.length; i++) {
                statement.setObject(i + 1, params[i]);
            }
            statement.execute();
        }
    }

    public void commit() throws SQLException {
        connection.commit();
        finished = true;
    }

    public void rollback() throws SQLException {
        connection.rollback();
        finished = true;
    }

    /** 끝내지 않은 트랜잭션은 롤백한다. 테스트가 중간에 실패해도 락이 다음 테스트로 새지 않는다. */
    @Override
    public void close() throws SQLException {
        try {
            if (!finished) {
                connection.rollback();
            }
        } finally {
            connection.close();
        }
    }

    /** 락 대기 중인 세션이 나타날 때까지 기다린다. 제한 시간 안에 나타나지 않으면 false. */
    public static boolean awaitLockWait(JdbcTemplate jdbc) throws InterruptedException {
        Instant deadline = Instant.now().plus(WAIT_TIMEOUT);
        while (Instant.now().isBefore(deadline)) {
            Integer waiting = jdbc.queryForObject("""
                    select count(*) from pg_stat_activity
                    where datname = current_database() and wait_event_type = 'Lock'
                    """, Integer.class);
            if (waiting != null && waiting > 0) {
                return true;
            }
            Thread.sleep(20);
        }
        return false;
    }
}
