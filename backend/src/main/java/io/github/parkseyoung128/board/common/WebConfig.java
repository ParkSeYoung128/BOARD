package io.github.parkseyoung128.board.common;

import java.util.List;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final RequesterResolver requesterResolver;

    public WebConfig(RequesterResolver requesterResolver) {
        this.requesterResolver = requesterResolver;
    }

    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
        resolvers.add(requesterResolver);
    }
}
