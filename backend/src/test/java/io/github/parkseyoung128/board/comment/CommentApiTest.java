package io.github.parkseyoung128.board.comment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

import io.github.parkseyoung128.board.Concurrent;
import io.github.parkseyoung128.board.IntegrationTest;

class CommentApiTest extends IntegrationTest {

    @Autowired
    ObjectMapper mapper;

    private long newPost() {
        return insertPost("글", "author", Instant.parse("2026-01-01T00:00:00Z"), 0);
    }

    private ResultActions createComment(long postId, String user, String content) throws Exception {
        return mvc.perform(post("/api/posts/" + postId + "/comments").header("x-user-id", user)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of("content", content))));
    }

    @Test
    void 댓글을_달면_201과_요구사항_필드만_준다() throws Exception {
        long postId = newPost();
        String body = createComment(postId, "alice", "안녕").andExpect(status().isCreated())
                .andExpect(jsonPath("$.postId").value(postId))
                .andExpect(jsonPath("$.content").value("안녕"))
                .andExpect(jsonPath("$.author").value("alice"))
                .andReturn().getResponse().getContentAsString();

        JsonNode json = mapper.readTree(body);
        Set<String> keys = new TreeSet<>();
        json.fieldNames().forEachRemaining(keys::add);
        assertThat(keys).containsExactlyInAnyOrder("id", "postId", "content", "author", "createdAt");
        assertThat(json.get("createdAt").asText()).matches("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}Z");
    }

    @Test
    void 댓글을_달면_글의_commentCount가_늘어난다() throws Exception {
        long postId = newPost();
        createComment(postId, "alice", "하나").andExpect(status().isCreated());
        createComment(postId, "bob", "둘").andExpect(status().isCreated());
        mvc.perform(get("/api/posts/" + postId)).andExpect(jsonPath("$.commentCount").value(2));
    }

    @Test
    void 내용은_다듬지_않고_그대로_저장한다() throws Exception {
        long postId = newPost();
        createComment(postId, "alice", "  앞뒤 공백\n").andExpect(status().isCreated())
                .andExpect(jsonPath("$.content").value("  앞뒤 공백\n"));
    }

    @Test
    void 빈_댓글과_너무_긴_댓글은_400() throws Exception {
        long postId = newPost();
        createComment(postId, "alice", "   ").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        createComment(postId, "alice", "a".repeat(5001)).andExpect(status().isBadRequest());
        createComment(postId, "alice", "a".repeat(5000)).andExpect(status().isCreated());
        mvc.perform(post("/api/posts/" + postId + "/comments").contentType(MediaType.APPLICATION_JSON)
                .content("{}")).andExpect(status().isBadRequest());
    }

    @Test
    void 없는_글에는_404이고_404가_검증보다_먼저다() throws Exception {
        createComment(999_999, "alice", "x").andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
        createComment(999_999, "alice", "   ").andExpect(status().isNotFound());
        mvc.perform(get("/api/posts/999999/comments")).andExpect(status().isNotFound());
    }

    @Test
    void 삭제된_글의_댓글은_조회_작성_삭제_모두_404() throws Exception {
        long postId = newPost();
        long commentId = insertComment(postId, "alice", Instant.parse("2026-01-01T00:00:01Z"));
        jdbc.update("update posts set deleted_at = now() where id = ?", postId);

        mvc.perform(get("/api/posts/" + postId + "/comments")).andExpect(status().isNotFound());
        createComment(postId, "alice", "x").andExpect(status().isNotFound());
        mvc.perform(delete("/api/comments/" + commentId).header("x-user-id", "alice"))
                .andExpect(status().isNotFound());
    }

    @Test
    void 목록은_최신순이고_total은_삭제된_댓글을_뺀다() throws Exception {
        long postId = newPost();
        long a = insertComment(postId, "u", Instant.parse("2026-01-01T00:00:01Z"));
        long b = insertComment(postId, "u", Instant.parse("2026-01-01T00:00:02Z"));
        long gone = insertComment(postId, "u", Instant.parse("2026-01-01T00:00:03Z"));
        jdbc.update("update comments set deleted_at = now() where id = ?", gone);

        mvc.perform(get("/api/posts/" + postId + "/comments"))
                .andExpect(jsonPath("$.total").value(2))
                .andExpect(jsonPath("$.items", hasSize(2)))
                .andExpect(jsonPath("$.items[0].id").value(b))
                .andExpect(jsonPath("$.items[1].id").value(a))
                .andExpect(jsonPath("$.nextCursor").doesNotExist());
    }

    @Test
    void 다른_글의_댓글은_섞이지_않는다() throws Exception {
        long p1 = newPost();
        long p2 = newPost();
        insertComment(p1, "u", Instant.parse("2026-01-01T00:00:01Z"));
        insertComment(p2, "u", Instant.parse("2026-01-01T00:00:02Z"));
        insertComment(p2, "u", Instant.parse("2026-01-01T00:00:03Z"));
        mvc.perform(get("/api/posts/" + p1 + "/comments")).andExpect(jsonPath("$.total").value(1));
        mvc.perform(get("/api/posts/" + p2 + "/comments")).andExpect(jsonPath("$.total").value(2));
    }

    @Test
    void 본인_댓글만_삭제하고_삭제된_댓글은_다시_404() throws Exception {
        long postId = newPost();
        long id = insertComment(postId, "alice", Instant.parse("2026-01-01T00:00:01Z"));

        mvc.perform(delete("/api/comments/" + id).header("x-user-id", "bob"))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("FORBIDDEN"));
        mvc.perform(delete("/api/comments/" + id).header("x-user-id", "alice")).andExpect(status().isNoContent());
        mvc.perform(delete("/api/comments/" + id).header("x-user-id", "alice")).andExpect(status().isNotFound());
        mvc.perform(delete("/api/comments/99999").header("x-user-id", "alice")).andExpect(status().isNotFound());

        mvc.perform(get("/api/posts/" + postId + "/comments")).andExpect(jsonPath("$.total").value(0));
        mvc.perform(get("/api/posts/" + postId)).andExpect(jsonPath("$.commentCount").value(0));
        // 행은 지워지지 않고 deleted_at 만 채워진다
        Integer rows = jdbc.queryForObject(
                "select count(*) from comments where id = ? and deleted_at is not null", Integer.class, id);
        assertThat(rows).isEqualTo(1);
    }

    @Test
    void 동시에_댓글을_달아도_전부_저장되고_id가_겹치지_않는다() throws Exception {
        long postId = newPost();
        int count = 50;
        Concurrent.run(count, i -> createComment(postId, "user" + i, "댓글 " + i).andExpect(status().isCreated()));

        List<Long> ids = jdbc.queryForList("select id from comments where post_id = ?", Long.class, postId);
        assertThat(ids).hasSize(count).doesNotHaveDuplicates();
        mvc.perform(get("/api/posts/" + postId)).andExpect(jsonPath("$.commentCount").value(count));
        mvc.perform(get("/api/posts/" + postId + "/comments")).andExpect(jsonPath("$.total").value(count));
    }
}
