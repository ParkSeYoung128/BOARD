package io.github.parkseyoung128.board.post;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

import io.github.parkseyoung128.board.IntegrationTest;

class PostApiTest extends IntegrationTest {

    @Autowired
    ObjectMapper mapper;

    private ResultActions create(String user, String title, String content) throws Exception {
        return mvc.perform(post("/api/posts").header("x-user-id", user)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of("title", title, "content", content))));
    }

    private long createdId(String user, String title) throws Exception {
        String body = create(user, title, "내용").andExpect(status().isCreated()).andReturn()
                .getResponse().getContentAsString();
        return mapper.readTree(body).get("id").asLong();
    }

    @Test
    void 작성하면_201과_요구사항_그대로의_필드만_내려준다() throws Exception {
        String body = create("alice", "제목", "본문\n\n둘째 문단").andExpect(status().isCreated())
                .andExpect(jsonPath("$.author").value("alice"))
                .andExpect(jsonPath("$.likeCount").value(0))
                .andExpect(jsonPath("$.commentCount").value(0))
                .andExpect(jsonPath("$.isLiked").value(false))
                .andReturn().getResponse().getContentAsString();

        JsonNode json = mapper.readTree(body);
        Set<String> keys = new TreeSet<>();
        json.fieldNames().forEachRemaining(keys::add);
        assertThat(keys).containsExactlyInAnyOrder(
                "id", "title", "content", "likeCount", "commentCount", "isLiked", "author", "createdAt");
        assertThat(json.get("createdAt").asText()).matches("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}Z");
    }

    @Test
    void 제목과_내용은_다듬지_않고_그대로_저장한다() throws Exception {
        create("alice", " 제목 ", "  앞뒤 공백\n").andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value(" 제목 "))
                .andExpect(jsonPath("$.content").value("  앞뒤 공백\n"));
    }

    @Test
    void 검증_실패는_400_VALIDATION_ERROR() throws Exception {
        create("alice", "   ", "내용").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        create("alice", "가".repeat(21), "내용").andExpect(status().isBadRequest());
        create("alice", "😀".repeat(20), "내용").andExpect(status().isCreated());
        mvc.perform(post("/api/posts").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/posts").contentType(MediaType.APPLICATION_JSON).content("not json"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void 상세_조회와_없는_글_404() throws Exception {
        long id = createdId("alice", "제목");
        mvc.perform(get("/api/posts/" + id)).andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("제목"));
        mvc.perform(get("/api/posts/999999")).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void 본인만_수정할_수_있다() throws Exception {
        long id = createdId("alice", "원래");
        String body = "{\"title\":\"바뀜\",\"content\":\"새 내용\"}";

        mvc.perform(patch("/api/posts/" + id).header("x-user-id", "bob")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("FORBIDDEN"));
        mvc.perform(patch("/api/posts/" + id).header("x-user-id", "alice")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andExpect(jsonPath("$.title").value("바뀜"));
        mvc.perform(patch("/api/posts/" + id).header("x-user-id", "alice")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"\",\"content\":\"x\"}"))
                .andExpect(status().isBadRequest());
        // 검증에 실패한 수정은 반영되지 않는다
        mvc.perform(get("/api/posts/" + id)).andExpect(jsonPath("$.title").value("바뀜"));
    }

    @Test
    void 판정_순서는_404_403_400() throws Exception {
        long id = createdId("alice", "제목");
        String invalid = "{\"title\":\"\",\"content\":\"\"}";
        mvc.perform(patch("/api/posts/999999").contentType(MediaType.APPLICATION_JSON).content(invalid))
                .andExpect(status().isNotFound());
        mvc.perform(patch("/api/posts/" + id).header("x-user-id", "bob")
                        .contentType(MediaType.APPLICATION_JSON).content(invalid))
                .andExpect(status().isForbidden());
    }

    @Test
    void 삭제는_본인만_하고_이후에는_모든_경로에서_404다() throws Exception {
        long id = createdId("alice", "제목");

        mvc.perform(delete("/api/posts/" + id).header("x-user-id", "bob")).andExpect(status().isForbidden());
        mvc.perform(delete("/api/posts/" + id).header("x-user-id", "alice")).andExpect(status().isNoContent());

        mvc.perform(get("/api/posts/" + id)).andExpect(status().isNotFound());
        mvc.perform(patch("/api/posts/" + id).header("x-user-id", "alice")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"a\",\"content\":\"b\"}"))
                .andExpect(status().isNotFound());
        mvc.perform(delete("/api/posts/" + id).header("x-user-id", "alice")).andExpect(status().isNotFound());
        mvc.perform(get("/api/posts"))
                .andExpect(jsonPath("$.total").value(0))
                .andExpect(jsonPath("$.items", hasSize(0)));

        // 행은 지워지지 않고 deleted_at 만 채워진다
        Integer rows = jdbc.queryForObject(
                "select count(*) from posts where id = ? and deleted_at is not null", Integer.class, id);
        assertThat(rows).isEqualTo(1);
    }

    @Test
    void commentCount는_삭제된_댓글을_뺀다() throws Exception {
        long id = insertPost("글", "alice", Instant.parse("2026-01-01T00:00:00Z"), 0);
        insertComment(id, "a", Instant.parse("2026-01-01T00:00:01Z"));
        long gone = insertComment(id, "a", Instant.parse("2026-01-01T00:00:02Z"));
        jdbc.update("update comments set deleted_at = now() where id = ?", gone);

        mvc.perform(get("/api/posts/" + id)).andExpect(jsonPath("$.commentCount").value(1));
        mvc.perform(get("/api/posts")).andExpect(jsonPath("$.items[0].commentCount").value(1));
    }

    @Test
    void 목록은_최신순이고_isLiked를_요청자_기준으로_준다() throws Exception {
        long older = insertPost("오래됨", "a", Instant.parse("2026-01-01T00:00:00Z"), 5);
        long newer = insertPost("최신", "b", Instant.parse("2026-01-02T00:00:00Z"), 0);
        jdbc.update("insert into post_likes (post_id, user_id) values (?, 'me')", older);

        mvc.perform(get("/api/posts").header("x-user-id", "me"))
                .andExpect(jsonPath("$.total").value(2))
                .andExpect(jsonPath("$.nextCursor").doesNotExist())
                .andExpect(jsonPath("$.items[0].id").value(newer))
                .andExpect(jsonPath("$.items[0].isLiked").value(false))
                .andExpect(jsonPath("$.items[1].id").value(older))
                .andExpect(jsonPath("$.items[1].isLiked").value(true))
                .andExpect(jsonPath("$.items[1].likeCount").value(5));
        mvc.perform(get("/api/posts").header("x-user-id", "other"))
                .andExpect(jsonPath("$.items[1].isLiked").value(false));
    }
}
