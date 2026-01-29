package com.example.demo.board.controller;

import com.example.demo.board.converter.BoardConverter;
import com.example.demo.board.vo.BoardPostAttachmentVO;
import com.example.demo.dto.board.attachment.BoardAttachmentRequest;
import com.example.demo.dto.board.attachment.BoardAttachmentResponse;
import com.example.demo.board.service.BoardAttachmentService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/board/posts/{postId}/attachments")
public class BoardAttachmentController {

    private final BoardAttachmentService boardAttachmentService;

    public BoardAttachmentController(BoardAttachmentService boardAttachmentService) {
        this.boardAttachmentService = boardAttachmentService;
    }

    // 목록: /api/board/posts/{postId}/attachments
    @GetMapping
    public ResponseEntity<?> list(@PathVariable long postId) {
        List<BoardPostAttachmentVO> vos = boardAttachmentService.getByPostId(postId);
        List<BoardAttachmentResponse> body = BoardConverter.toAttachmentResponseList(vos);
        return ResponseEntity.ok(body);
    }

    // 추가(메타 등록): /api/board/posts/{postId}/attachments
    @PostMapping
    public ResponseEntity<?> add(@PathVariable long postId, @RequestBody List<BoardAttachmentRequest> req) {
        List<BoardPostAttachmentVO> vos = BoardConverter.toAttachmentVOList(req);
        boardAttachmentService.addAll(postId, vos);
        return ResponseEntity.ok().build();
    }

    // 전체 교체: /api/board/posts/{postId}/attachments
    @PutMapping
    public ResponseEntity<?> replace(@PathVariable long postId, @RequestBody List<BoardAttachmentRequest> req) {
        List<BoardPostAttachmentVO> vos = BoardConverter.toAttachmentVOList(req);
        boardAttachmentService.replaceAll(postId, vos);
        return ResponseEntity.ok().build();
    }

    // 전체 삭제
    @DeleteMapping
    public ResponseEntity<?> delete(@PathVariable long postId) {
        boardAttachmentService.deleteByPostId(postId);
        return ResponseEntity.ok().build();
    }
}