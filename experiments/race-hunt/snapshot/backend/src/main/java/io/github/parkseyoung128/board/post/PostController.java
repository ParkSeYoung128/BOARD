package io.github.parkseyoung128.board.post;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import io.github.parkseyoung128.board.common.PageResponse;
import io.github.parkseyoung128.board.common.Requester;

@RestController
@RequestMapping("/api/posts")
public class PostController {

    private final PostService postService;

    public PostController(PostService postService) {
        this.postService = postService;
    }

    @GetMapping
    public PageResponse<PostResponse> list(Requester me,
                                           @RequestParam(required = false) Integer limit,
                                           @RequestParam(required = false) String cursor) {
        return postService.list(me, limit, cursor);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PostResponse create(Requester me, @RequestBody PostRequest request) {
        return postService.create(me, request);
    }

    @GetMapping("/{postId}")
    public PostResponse get(Requester me, @PathVariable Long postId) {
        return postService.get(me, postId);
    }

    @PatchMapping("/{postId}")
    public PostResponse update(Requester me, @PathVariable Long postId, @RequestBody PostRequest request) {
        return postService.update(me, postId, request);
    }

    @DeleteMapping("/{postId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(Requester me, @PathVariable Long postId) {
        postService.delete(me, postId);
    }
}
