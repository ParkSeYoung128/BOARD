package io.github.parkseyoung128.board.like;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * 좋아요 쓰기 경로. 엔티티를 읽어 count++ 하면 동시 요청에서 갱신이 유실되므로,
 * 유일 제약(post_id, user_id)과 원자적 UPDATE ... RETURNING 으로 처리한다.
 * JDBC 경로는 @SQLRestriction 이 적용되지 않으므로 삭제 조건(deleted_at is null)을 직접 명시한다.
 */
@Repository
public class PostLikeRepository {

    private final JdbcTemplate jdbc;

    public PostLikeRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** 이미 있으면 false, 새로 넣었으면 true. */
    public boolean insertIfAbsent(long postId, String userId) {
        return jdbc.update("""
                insert into post_likes (post_id, user_id) values (?, ?)
                on conflict (post_id, user_id) do nothing
                """, postId, userId) == 1;
    }

    /** 실제로 지웠으면 true. */
    public boolean delete(long postId, String userId) {
        return jdbc.update("delete from post_likes where post_id = ? and user_id = ?", postId, userId) == 1;
    }

    /** 증가 후 like_count. 글이 없거나 삭제되었으면 null. */
    public Integer increment(long postId) {
        return queryCount("""
                update posts set like_count = like_count + 1
                where id = ? and deleted_at is null
                returning like_count
                """, postId);
    }

    /** 감소 후 like_count(0 미만으로 내려가지 않음). 글이 없거나 삭제되었으면 null. */
    public Integer decrement(long postId) {
        return queryCount("""
                update posts set like_count = greatest(like_count - 1, 0)
                where id = ? and deleted_at is null
                returning like_count
                """, postId);
    }

    public Integer likeCount(long postId) {
        return queryCount("select like_count from posts where id = ? and deleted_at is null", postId);
    }

    public boolean exists(long postId, String userId) {
        Boolean found = jdbc.queryForObject(
                "select exists (select 1 from post_likes where post_id = ? and user_id = ?)",
                Boolean.class, postId, userId);
        return Boolean.TRUE.equals(found);
    }

    private Integer queryCount(String sql, long postId) {
        return jdbc.query(sql, rs -> rs.next() ? rs.getInt(1) : null, postId);
    }
}
