package io.github.parkseyoung128.board.comment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.stream.IntStream;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import io.github.parkseyoung128.board.IntegrationTest;

/** 댓글이 1,411개인 글(시드의 2번 글과 같은 규모)에서도 무한 스크롤이 중복·누락 없이 끝까지 가는지 검증한다. */
class CommentPaginationTest extends IntegrationTest {

    private static final int BIG = 1411;

    @Autowired
    ObjectMapper mapper;

    private JsonNode page(String url) throws Exception {
        String body = mvc.perform(get(url)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return mapper.readTree(body);
    }

    private List<Long> traverse(String base, int limit) throws Exception {
        List<Long> ids = new ArrayList<>();
        String cursor = null;
        int guard = 0;
        do {
            JsonNode json = page(base + "?limit=" + limit + (cursor == null ? "" : "&cursor=" + cursor));
            json.get("items").forEach(n -> ids.add(n.get("id").asLong()));
            cursor = json.get("nextCursor").isNull() ? null : json.get("nextCursor").asText();
            assertThat(guard++).isLessThan(10_000);
        } while (cursor != null);
        return ids;
    }

    private long bigPost() {
        long postId = insertPost("글", "a", Instant.parse("2026-01-01T00:00:00Z"), 0);
        Instant base = Instant.parse("2026-02-01T00:00:00Z");
        List<Integer> indexes = IntStream.range(0, BIG).boxed().toList();
        jdbc.batchUpdate("insert into comments (post_id, content, author, created_at) values (?, 'c', 'u', ?)",
                indexes, 500, (ps, i) -> {
                    ps.setLong(1, postId);
                    // 일부러 같은 초가 여러 번 나오게 한다(3건씩 동률)
                    ps.setTimestamp(2, Timestamp.from(base.plusSeconds(i / 3)));
                });
        return postId;
    }

    @Test
    void 처음_두_개와_total() throws Exception {
        long postId = bigPost();
        JsonNode first = page("/api/posts/" + postId + "/comments?limit=2");
        assertThat(first.get("total").asLong()).isEqualTo(BIG);
        assertThat(first.get("items")).hasSize(2);
        assertThat(first.get("nextCursor").isNull()).isFalse();
    }

    @Test
    void 천사백십일개를_한_건도_빠짐없이_순회한다() throws Exception {
        long postId = bigPost();
        List<Long> sorted = jdbc.queryForList(
                "select id from comments where post_id = ? order by created_at desc, id desc", Long.class, postId);

        for (int limit : new int[] {2, 20, 50}) {
            List<Long> ids = traverse("/api/posts/" + postId + "/comments", limit);
            assertThat(ids).as("limit=" + limit).hasSize(BIG).containsExactlyElementsOf(sorted);
            assertThat(new LinkedHashSet<>(ids)).hasSize(BIG);
        }
    }

    @Test
    void 첫_두_개_다음_더보기는_이어서_나온다() throws Exception {
        long postId = bigPost();
        JsonNode first = page("/api/posts/" + postId + "/comments?limit=2");
        JsonNode second = page("/api/posts/" + postId + "/comments?limit=20&cursor="
                + first.get("nextCursor").asText());

        List<Long> all = new ArrayList<>();
        first.get("items").forEach(n -> all.add(n.get("id").asLong()));
        second.get("items").forEach(n -> all.add(n.get("id").asLong()));
        List<Long> expected = jdbc.queryForList(
                "select id from comments where post_id = ? order by created_at desc, id desc limit 22",
                Long.class, postId);
        assertThat(all).containsExactlyElementsOf(expected);
    }

    @Test
    void limit_상한과_이상한_커서() throws Exception {
        long postId = bigPost();
        assertThat(page("/api/posts/" + postId + "/comments?limit=999").get("items")).hasSize(50);
        mvc.perform(get("/api/posts/" + postId + "/comments?limit=0")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/posts/" + postId + "/comments?cursor=%21%21%21")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_CURSOR"));
    }
}
