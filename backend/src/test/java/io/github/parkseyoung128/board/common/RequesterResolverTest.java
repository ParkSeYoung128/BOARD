package io.github.parkseyoung128.board.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

import jakarta.servlet.http.Cookie;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.ServletWebRequest;

class RequesterResolverTest {

    private final RequesterResolver resolver = new RequesterResolver();

    private String resolve(MockHttpServletRequest request) {
        return ((Requester) resolver.resolveArgument(null, null, new ServletWebRequest(request), null)).userId();
    }

    @Test
    void 아무것도_없으면_demo_user() {
        assertThat(resolve(new MockHttpServletRequest())).isEqualTo("demo_user");
    }

    @Test
    void 헤더를_사용한다() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("x-user-id", "alice");
        assertThat(resolve(request)).isEqualTo("alice");
    }

    @Test
    void 쿠키는_URL_디코딩해서_사용한다() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new Cookie("x-user-id", "%EA%B9%80%ED%95%98%EB%8A%98"));
        assertThat(resolve(request)).isEqualTo("김하늘");
    }

    @Test
    void 헤더가_쿠키보다_우선한다() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("x-user-id", "header_user");
        request.setCookies(new Cookie("x-user-id", "cookie_user"));
        assertThat(resolve(request)).isEqualTo("header_user");
    }

    @Test
    void 공백_헤더는_없는_것으로_보고_쿠키로_넘어간다() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("x-user-id", "   ");
        request.setCookies(new Cookie("x-user-id", "cookie_user"));
        assertThat(resolve(request)).isEqualTo("cookie_user");
    }

    @Test
    void 쿠키가_잘못된_인코딩이어도_원문으로_처리한다() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new Cookie("x-user-id", "100%"));
        assertThat(resolve(request)).isEqualTo("100%");
    }

    @Test
    void 쉰_자를_넘으면_검증_오류() {
        MockHttpServletRequest tooLong = new MockHttpServletRequest();
        tooLong.addHeader("x-user-id", "a".repeat(51));
        assertThrows(ApiException.class, () -> resolve(tooLong));

        MockHttpServletRequest ok = new MockHttpServletRequest();
        ok.addHeader("x-user-id", "a".repeat(50));
        assertThat(resolve(ok)).hasSize(50);
    }

    @Test
    void 길이는_코드포인트_기준으로_센다() {
        // "😀" 는 UTF-16 으로 2칸이지만 1자다. DB VARCHAR(50) 도 문자 수 기준이다.
        MockHttpServletRequest ok = new MockHttpServletRequest();
        ok.addHeader("x-user-id", "😀".repeat(50));
        assertThat(resolve(ok).codePointCount(0, resolve(ok).length())).isEqualTo(50);

        MockHttpServletRequest tooLong = new MockHttpServletRequest();
        tooLong.addHeader("x-user-id", "😀".repeat(51));
        assertThrows(ApiException.class, () -> resolve(tooLong));
    }
}
