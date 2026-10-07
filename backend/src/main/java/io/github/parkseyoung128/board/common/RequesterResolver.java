package io.github.parkseyoung128.board.common;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;

import org.springframework.core.MethodParameter;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

/**
 * 컨트롤러 파라미터 {@link Requester}를 채운다.
 * 로그인은 없으며, x-user-id 헤더 또는 쿠키 값을 그대로 사용자로 본다. 둘 다 없으면 demo_user.
 * 쿠키 값은 dev-user 화면이 URL 인코딩해서 저장하므로 디코딩해서 읽는다.
 */
@Component
public class RequesterResolver implements HandlerMethodArgumentResolver {

    static final String NAME = "x-user-id";
    static final String DEFAULT_USER = "demo_user";
    static final int MAX_LENGTH = 50;

    @Override
    public boolean supportsParameter(MethodParameter parameter) {
        return Requester.class.equals(parameter.getParameterType());
    }

    @Override
    public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer mavContainer,
                                  NativeWebRequest webRequest, WebDataBinderFactory binderFactory) {
        HttpServletRequest request = webRequest.getNativeRequest(HttpServletRequest.class);
        String userId = null;
        if (request != null) {
            userId = clean(request.getHeader(NAME));
            if (userId == null) {
                userId = clean(fromCookie(request));
            }
        }
        if (userId == null) {
            userId = DEFAULT_USER;
        }
        // DB VARCHAR(50) 과 같은 기준(코드포인트)으로 센다. length() 는 이모지를 2로 세어 과하게 거부한다.
        if (userId.codePointCount(0, userId.length()) > MAX_LENGTH) {
            throw ApiException.validation("x-user-id 는 " + MAX_LENGTH + "자 이하여야 합니다.");
        }
        return new Requester(userId);
    }

    private static String fromCookie(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }
        for (Cookie cookie : cookies) {
            if (NAME.equals(cookie.getName())) {
                return decode(cookie.getValue());
            }
        }
        return null;
    }

    private static String decode(String raw) {
        if (raw == null) {
            return null;
        }
        try {
            return URLDecoder.decode(raw, StandardCharsets.UTF_8);
        } catch (IllegalArgumentException e) {
            return raw;
        }
    }

    private static String clean(String value) {
        if (value == null) {
            return null;
        }
        String stripped = value.strip();
        return stripped.isEmpty() ? null : stripped;
    }
}
