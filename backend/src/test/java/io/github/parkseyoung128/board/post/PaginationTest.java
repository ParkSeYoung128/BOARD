package io.github.parkseyoung128.board.post;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import io.github.parkseyoung128.board.IntegrationTest;

/** keyset 페이지네이션: 무중복·무누락·정렬 유지, 같은 초(동률) 경계, limit/cursor 검증. */
class PaginationTest extends IntegrationTest {

    @Autowired
    ObjectMapper mapper;

    private JsonNode page(String url) throws Exception {
        String body = mvc.perform(get(url)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return mapper.readTree(body);
    }

    /** nextCursor 가 null 이 될 때까지 따라가며 id 를 모은다. */
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

    @Test
    void 같은_초에_만든_글이_많아도_중복과_누락_없이_순회한다() throws Exception {
        Instant same = Instant.parse("2026-03-01T00:00:00Z");
        for (int i = 0; i < 25; i++) {
            insertPost("글" + i, "a", i < 10 ? same : same.plusSeconds(i), 0);
        }
        // 정렬 기준: created_at DESC, id DESC
        List<Long> sorted = jdbc.queryForList("select id from posts order by created_at desc, id desc", Long.class);

        for (int limit : new int[] {1, 2, 3, 7, 20, 50}) {
            List<Long> ids = traverse("/api/posts", limit);
            assertThat(ids).as("limit=" + limit).containsExactlyElementsOf(sorted);
            assertThat(new LinkedHashSet<>(ids)).hasSameSizeAs(ids);
        }
    }

    @Test
    void id_순서와_시간_순서가_달라도_시간_순으로_나온다() throws Exception {
        long first = insertPost("먼저 만든 id 지만 최신", "a", Instant.parse("2026-05-01T00:00:00Z"), 0);
        long second = insertPost("나중 id 지만 오래됨", "a", Instant.parse("2026-01-01T00:00:00Z"), 0);
        assertThat(traverse("/api/posts", 1)).containsExactly(first, second);
    }

    @Test
    void 마지막_페이지의_nextCursor는_null이고_total은_전체_개수() throws Exception {
        for (int i = 0; i < 3; i++) {
            insertPost("글" + i, "a", Instant.parse("2026-01-01T00:00:00Z").plusSeconds(i), 0);
        }
        JsonNode p1 = page("/api/posts?limit=2");
        assertThat(p1.get("total").asLong()).isEqualTo(3);
        assertThat(p1.get("nextCursor").isNull()).isFalse();
        JsonNode p2 = page("/api/posts?limit=2&cursor=" + p1.get("nextCursor").asText());
        assertThat(p2.get("items")).hasSize(1);
        assertThat(p2.get("nextCursor").isNull()).isTrue();
        assertThat(p2.get("total").asLong()).isEqualTo(3);
    }

    @Test
    void limit은_기본_20_상한_50_그리고_1_미만은_400() throws Exception {
        for (int i = 0; i < 60; i++) {
            insertPost("글" + i, "a", Instant.parse("2026-01-01T00:00:00Z").plusSeconds(i), 0);
        }
        assertThat(page("/api/posts").get("items")).hasSize(20);
        assertThat(page("/api/posts?limit=50").get("items")).hasSize(50);
        assertThat(page("/api/posts?limit=999").get("items")).hasSize(50);
        mvc.perform(get("/api/posts?limit=0")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        mvc.perform(get("/api/posts?limit=abc")).andExpect(status().isBadRequest());
    }

    @Test
    void 이상한_커서는_400_INVALID_CURSOR() throws Exception {
        mvc.perform(get("/api/posts?cursor=%21%21%21")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_CURSOR"));
    }

    @Test
    void 순회_중_삭제한_글은_이후_페이지에서_빠진다() throws Exception {
        List<Long> ids = new ArrayList<>();
        for (int i = 0; i < 6; i++) {
            ids.add(insertPost("글" + i, "a", Instant.parse("2026-01-01T00:00:00Z").plusSeconds(i), 0));
        }
        JsonNode p1 = page("/api/posts?limit=2");
        jdbc.update("update posts set deleted_at = now() where id = ?", ids.get(0));

        Set<Long> rest = new LinkedHashSet<>();
        String cursor = p1.get("nextCursor").asText();
        while (cursor != null) {
            JsonNode next = page("/api/posts?limit=2&cursor=" + cursor);
            next.get("items").forEach(n -> rest.add(n.get("id").asLong()));
            cursor = next.get("nextCursor").isNull() ? null : next.get("nextCursor").asText();
        }
        assertThat(rest).doesNotContain(ids.get(0)).hasSize(3);
    }
}
