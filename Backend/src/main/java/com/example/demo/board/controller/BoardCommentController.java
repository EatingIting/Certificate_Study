package com.example.demo.board.controller;

import com.example.demo.board.converter.BoardConverter;
import com.example.demo.board.service.BoardCommentService;
import com.example.demo.board.service.BoardPostService;
import com.example.demo.board.vo.BoardCommentVO;
import com.example.demo.dto.board.comment.BoardCommentCreateRequest;
import com.example.demo.dto.board.comment.BoardCommentResponse;
import com.example.demo.dto.board.comment.BoardCommentUpdateRequest;
import com.example.demo.모집.handler.NotificationWebSocketHandler;
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
    private final BoardPostService boardPostService;
    private final NotificationWebSocketHandler notificationHandler;

    public BoardCommentController(
            BoardCommentService boardCommentService,
            BoardPostService boardPostService,
            NotificationWebSocketHandler notificationHandler
    ) {
        this.boardCommentService = boardCommentService;
        this.boardPostService = boardPostService;
        this.notificationHandler = notificationHandler;
    }

    // 댓글 목록
    @GetMapping("/posts/{postId}/comments")
    public ResponseEntity<?> list(@PathVariable long postId) {

        List<BoardCommentVO> vos = boardCommentService.getByPostId(postId);
        List<BoardCommentResponse> body = BoardConverter.toCommentResponseList(vos);

        return ResponseEntity.ok(body);
    }

    // 댓글 작성 + 게시글 작성자에게 알림 전송
    @PostMapping("/posts/{postId}/comments")
    public ResponseEntity<?> create(
            @PathVariable long postId,
            @Valid @RequestBody BoardCommentCreateRequest req,
            Authentication authentication
    ) {

        // 댓글 작성자 이메일
        String writerEmail = authentication.getName();

        // 댓글 저장 + 알림 전송은 Service에서 처리됨
        BoardCommentVO vo = BoardConverter.toCommentVO(postId, req, writerEmail);
        long commentId = boardCommentService.addComment(vo, writerEmail);

        return ResponseEntity.ok(Map.of("commentId", commentId));
    }


    // 댓글 수정
    @PutMapping("/comments/{commentId}")
    public ResponseEntity<?> update(
            @PathVariable long commentId,
            @Valid @RequestBody BoardCommentUpdateRequest req,
            Authentication authentication
    ) {

        String email = authentication.getName();
        boardCommentService.updateComment(commentId, email, req.getContent());

        return ResponseEntity.ok().build();
    }

    // 댓글 삭제(soft)
    @DeleteMapping("/comments/{commentId}")
    public ResponseEntity<?> delete(
            @PathVariable long commentId,
            Authentication authentication
    ) {

        String email = authentication.getName();
        boardCommentService.deleteComment(commentId, email);

        return ResponseEntity.ok().build();
    }
}
