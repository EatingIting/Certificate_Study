package com.example.demo.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

public class BoardPostDTO {

    // 게시물 생성
    @Getter
    @NoArgsConstructor
    public static class BoardPostCreateRequest {

        @NotNull
        private BoardCategory category;

        @NotBlank
        @Size(max = 200)
        private String title;

        @NotBlank
        private String content;

    }

    // 게시물 수정
    @Getter
    @NoArgsConstructor
    public static class BoardPostUpdateRequest {

        private BoardCategory category;

        @Size(max = 200)
        private String title;

        private String content;

        private Boolean isPinned;
    }

    // 응답
    @Getter
    @Builder
    public static class BoardPostResponse {

        private Long postId;

        private String roomId; // char(36)
        private String userId; // char(36)

        private BoardCategory category;
        private String title;
        private String content;

        private boolean isPinned;
        private long viewCount;

        private long commentCount;
        private long attachmentCount;

        private List<BoardAttachmentDTO.Response> attachments;

        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
    }

    @Getter
    @Builder
    public static class ListResponse {

        private Long postId;

        private String roomId;
        private String userId;

        private BoardCategory category;
        private String title;

        private boolean isPinned;
        private long viewCount;

        private long commentCount;
        private long attachmentCount;

        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
    }

    @Getter
    @Builder
    public static class DetailResponse {

        private Long postId;

        private String roomId;
        private String userId;

        private BoardCategory category;
        private String title;
        private String content;

        private boolean isPinned;
        private long viewCount;

        private List<BoardAttachmentDTO.Response> attachments;
        private List<BoardCommentDTO.Response> comments;

        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
    }
}
