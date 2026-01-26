package com.example.demo.controller;

import com.example.demo.board.service.BoardPostService;
import com.example.demo.dto.BoardCategory;
import com.example.demo.dto.BoardPostDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/rooms/{roomId}/posts")
public class BoardPostController {

    private final BoardPostService postService;

    @GetMapping
    public List<BoardPostDTO.ListResponse> list(
            @PathVariable String roomId,
            @RequestParam(required = false) BoardCategory category,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) Long cursor
    ) {
        return postService.getPostList(roomId, category, size, cursor);
    }
}