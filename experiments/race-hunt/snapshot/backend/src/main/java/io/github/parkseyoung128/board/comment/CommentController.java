package io.github.parkseyoung128.board.comment;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
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
@RequestMapping("/api")
public class CommentController {

    private final CommentService commentService;

    public CommentController(CommentService commentService) {
        this.commentService = commentService;
    }

    @GetMapping("/posts/{postId}/comments")
    public PageResponse<CommentResponse> list(@PathVariable Long postId,
                                              @RequestParam(required = false) Integer limit,
                                              @RequestParam(required = false) String cursor) {
        return commentService.list(postId, limit, cursor);
    }

    @PostMapping("/posts/{postId}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    public CommentResponse create(Requester me, @PathVariable Long postId, @RequestBody CommentRequest request) {
        return commentService.create(me, postId, request);
    }

    @DeleteMapping("/comments/{commentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(Requester me, @PathVariable Long commentId) {
        commentService.delete(me, commentId);
    }
}
