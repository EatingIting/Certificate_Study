package com.example.demo.board.controller;

import com.example.demo.board.converter.BoardConverter;
import com.example.demo.board.vo.BoardPostVO;
import com.example.demo.dto.board.post.BoardPostCreateRequest;
import com.example.demo.dto.board.post.BoardPostListResponse;
import com.example.demo.dto.board.post.BoardPostResponse;
import com.example.demo.dto.board.post.BoardPostUpdateRequest;
import com.example.demo.board.service.BoardPostService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/board/posts")
public class BoardPostController {

    private final BoardPostService boardPostService;

    public BoardPostController(BoardPostService boardPostService) {
        this.boardPostService = boardPostService;
    }

    // 목록: /api/board/posts?roomId=...&category=...&keyword=...&page=1&size=10
    @GetMapping
    public ResponseEntity<?> list(
            @RequestParam String roomId,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            Authentication authentication
    ) {
        String email = authentication.getName();
        Map<String, Object> res = boardPostService.getPostList(roomId, category, keyword, page, size, email);

        @SuppressWarnings("unchecked")
        List<BoardPostVO> items = (List<BoardPostVO>) res.get("items");

        BoardPostListResponse body = BoardPostListResponse.builder()
                .items(BoardConverter.toPostResponseList(items))
                .page((int) res.get("page"))
                .size((int) res.get("size"))
                .total((int) res.get("total"))
                .totalPages((int) res.get("totalPages"))
                .build();

        return ResponseEntity.ok(body);
    }

    // 단건(Post만): /api/board/posts/{postId}
    @GetMapping("/{postId}")
    public ResponseEntity<?> get(@PathVariable long postId, Authentication authentication) {
        String email = authentication.getName();
        BoardPostVO post = boardPostService.getPostById(postId, email);
        if (post == null) return ResponseEntity.notFound().build();

        BoardPostResponse body = BoardConverter.toPostResponse(post);
        return ResponseEntity.ok(body);
    }

    // 작성(Post만): /api/board/posts
    @PostMapping
    public ResponseEntity<?> create(@Valid @RequestBody BoardPostCreateRequest req, Authentication authentication) {
        String email = authentication.getName();

        BoardPostVO post = BoardConverter.toPostVO(req, email);
        long postId = boardPostService.createPost(post, email);

        return ResponseEntity.ok(Map.of("postId", postId));
    }

    // 수정(Post만): /api/board/posts/{postId}
    @PutMapping("/{postId}")
    public ResponseEntity<?> update(@PathVariable long postId,
                                    @Valid @RequestBody BoardPostUpdateRequest req,
                                    Authentication authentication) {
        String email = authentication.getName();

        BoardPostVO post = BoardConverter.toPostVO(postId, req, email);
        boardPostService.updatePost(post, email);

        return ResponseEntity.ok().build();
    }

    // 삭제(soft): /api/board/posts/{postId}
    @DeleteMapping("/{postId}")
    public ResponseEntity<?> delete(@PathVariable long postId, Authentication authentication) {
        String email = authentication.getName();
        boardPostService.deletePost(postId, email);
        return ResponseEntity.ok().build();
    }

    // 고정 토글: /api/board/posts/{postId}/pinned
    @PatchMapping("/{postId}/pinned")
    public ResponseEntity<?> pinned(@PathVariable long postId,
                                    @RequestBody Map<String, Object> body,
                                    Authentication authentication) {
        String email = authentication.getName();

        boolean pinned = false;
        Object v = body.get("pinned");
        if (v instanceof Boolean) pinned = (Boolean) v;

        boardPostService.setPinned(postId, email, pinned);
        return ResponseEntity.ok().build();
    }
}