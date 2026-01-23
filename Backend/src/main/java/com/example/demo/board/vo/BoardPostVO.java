package com.example.demo.board.vo;

import com.example.demo.dto.BoardCategory;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
public class BoardPostVO {

    private Long postId;

    private String roomId; // char(36)
    private String userId; // char(36)

    private BoardCategory category;

    private String title;
    private String content;

    private boolean isPinned;
    private long viewCount;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime deletedAt;
}
