package com.example.demo.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

public class BoardCommentDTO {

    // 댓글 생성
    @Getter
    @NoArgsConstructor
    public static class BoardCommentCreateRequest {

        @NotBlank
        private String content;
    }

    // 댓글 수정
    @Getter
    @NoArgsConstructor
    public static class BoardCommentUpdateRequest {

        @NotBlank
        private String content;
    }

    @Getter
    @Builder
    public static class Response {

        private Long commentId;

        private Long postId;
        private String userId; // char(36)

        private String content;

        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
    }
}
