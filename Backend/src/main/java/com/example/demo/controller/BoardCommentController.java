package com.example.demo.controller;

import com.example.demo.board.converter.BoardConverter;
import com.example.demo.board.vo.BoardCommentVO;
import com.example.demo.dto.board.comment.BoardCommentCreateRequest;
import com.example.demo.dto.board.comment.BoardCommentResponse;
import com.example.demo.dto.board.comment.BoardCommentUpdateRequest;
import com.example.demo.service.board.BoardCommentService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/board")
public class BoardCommentController {

    private final BoardCommentService boardCommentService;

    public BoardCommentController(BoardCommentService boardCommentService) {
        this.boardCommentService = boardCommentService;
    }

    // 댓글 목록: /api/board/posts/{postId}/comments
    @GetMapping("/posts/{postId}/comments")
    public ResponseEntity<?> list(@PathVariable long postId) {
        List<BoardCommentVO> vos = boardCommentService.getByPostId(postId);
        List<BoardCommentResponse> body = BoardConverter.toCommentResponseList(vos);
        return ResponseEntity.ok(body);
    }

    // 댓글 작성: /api/board/posts/{postId}/comments
    @PostMapping("/posts/{postId}/comments")
    public ResponseEntity<?> create(@PathVariable long postId,
                                    @Valid @RequestBody BoardCommentCreateRequest req,
                                    Authentication authentication) {
        String userId = authentication.getName();

        BoardCommentVO vo = BoardConverter.toCommentVO(postId, req, userId);
        long commentId = boardCommentService.addComment(vo);

        return ResponseEntity.ok(Map.of("commentId", commentId));
    }

    // 댓글 수정: /api/board/comments/{commentId}
    @PutMapping("/comments/{commentId}")
    public ResponseEntity<?> update(@PathVariable long commentId,
                                    @Valid @RequestBody BoardCommentUpdateRequest req,
                                    Authentication authentication) {
        String userId = authentication.getName();
        boardCommentService.updateComment(commentId, userId, req.getContent());
        return ResponseEntity.ok().build();
    }

    // 댓글 삭제(soft): /api/board/comments/{commentId}
    @DeleteMapping("/comments/{commentId}")
    public ResponseEntity<?> delete(@PathVariable long commentId, Authentication authentication) {
        String userId = authentication.getName();
        boardCommentService.deleteComment(commentId, userId);
        return ResponseEntity.ok().build();
    }
}