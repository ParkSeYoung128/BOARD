package io.github.parkseyoung128.board.post;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;

import jakarta.persistence.EntityManagerFactory;

import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

import io.github.parkseyoung128.board.IntegrationTest;

/** N+1 방어: 목록 한 번에 나가는 SQL 수는 페이지 크기와 무관해야 한다. */
class QueryCountTest extends IntegrationTest {

    @Autowired
    EntityManagerFactory emf;

    /**
     * 요청이 성공(200)하고 기대한 개수만큼 실제로 조회됐는지 확인한 뒤 실행된 SQL 수를 돌려준다.
     * (오류 응답이라 쿼리가 0건인 경우에 "0 == 0" 으로 공허하게 통과하는 것을 막는다.)
     */
    private long statementsFor(String url, int expectedItems) throws Exception {
        Statistics stats = emf.unwrap(SessionFactory.class).getStatistics();
        stats.setStatisticsEnabled(true);
        stats.clear();
        mvc.perform(MockMvcRequestBuilders.get(url))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(expectedItems)));
        return stats.getPrepareStatementCount();
    }

    @Test
    void 목록_쿼리_수는_건수와_무관하다() throws Exception {
        for (int i = 0; i < 50; i++) {
            long id = insertPost("글" + i, "a", Instant.parse("2026-01-01T00:00:00Z").plusSeconds(i), 0);
            insertComment(id, "c", Instant.parse("2026-01-02T00:00:00Z"));
        }
        long small = statementsFor("/api/posts?limit=1", 1);
        long large = statementsFor("/api/posts?limit=50", 50);

        assertThat(small).isPositive();
        assertThat(large).isEqualTo(small);
        assertThat(large).isLessThanOrEqualTo(3);
    }
}
