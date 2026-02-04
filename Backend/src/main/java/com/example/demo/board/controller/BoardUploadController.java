package com.example.demo.board.controller;


import com.example.demo.board.service.BoardUploadService;
import com.example.demo.dto.board.attachment.BoardAttachmentRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/board")
public class BoardUploadController {

    private final BoardUploadService boardUploadService;

    public BoardUploadController(BoardUploadService boardUploadService) {
        this.boardUploadService = boardUploadService;
    }

    @PostMapping("/uploads")
    public ResponseEntity<List<BoardAttachmentRequest>> upload(
            @RequestParam("roomId") String roomId,
            @RequestParam("postId") Long postId,
            @RequestPart("files") List<MultipartFile> files
    ) {
        return ResponseEntity.ok(boardUploadService.upload(roomId, postId, files));
    }
}