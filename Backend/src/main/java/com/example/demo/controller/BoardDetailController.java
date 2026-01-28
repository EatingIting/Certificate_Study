package com.example.demo.controller;

import com.example.demo.board.converter.BoardConverter;
import com.example.demo.board.vo.BoardPostDetailVO;
import com.example.demo.dto.board.detail.BoardPostDetailCreateRequest;
import com.example.demo.dto.board.detail.BoardPostDetailResponse;
import com.example.demo.dto.board.detail.BoardPostDetailUpdateRequest;
import com.example.demo.service.board.BoardDetailService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/board/detail")
public class BoardDetailController {

    private final BoardDetailService boardDetailService;

    public BoardDetailController(BoardDetailService boardDetailService) {
        this.boardDetailService = boardDetailService;
    }

    // 상세(조합): /api/board/detail/posts/{postId}?incView=true
    @GetMapping("/posts/{postId}")
    public ResponseEntity<?> detail(@PathVariable long postId,
                                    @RequestParam(defaultValue = "true") boolean incView) {
        BoardPostDetailVO vo = boardDetailService.getDetail(postId, incView);
        if (vo == null) return ResponseEntity.notFound().build();

        BoardPostDetailResponse body = BoardConverter.toPostDetailResponse(vo);
        return ResponseEntity.ok(body);
    }

    // 첨부 포함 작성: /api/board/detail/posts
    @PostMapping("/posts")
    public ResponseEntity<?> create(@Valid @RequestBody BoardPostDetailCreateRequest req,
                                    Authentication authentication) {
        String email = authentication.getName();

        BoardPostDetailVO vo = BoardConverter.toDetailVO(req, email);
        long postId = boardDetailService.createPostWithAttachments(vo, email);

        return ResponseEntity.ok(Map.of("postId", postId));
    }

    // 첨부 포함 수정(첨부 replaceAll): /api/board/detail/posts/{postId}
    @PutMapping("/posts/{postId}")
    public ResponseEntity<?> update(@PathVariable long postId,
                                    @Valid @RequestBody BoardPostDetailUpdateRequest req,
                                    Authentication authentication) {
        String email = authentication.getName();

        BoardPostDetailVO vo = BoardConverter.toDetailVO(postId, req, email);
        boardDetailService.updatePostAndReplaceAttachments(vo, email);

        return ResponseEntity.ok().build();
    }
}