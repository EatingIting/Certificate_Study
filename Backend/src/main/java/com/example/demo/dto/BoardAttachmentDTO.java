package com.example.demo.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

public class BoardAttachmentDTO {
    // ===== Request =====
    @Getter
    @NoArgsConstructor
    public static class CreateRequest {

        @NotBlank
        @Size(max = 255)
        private String originalName;

        @Size(max = 500)
        private String fileKey;

        @NotBlank
        @Size(max = 1000)
        private String url;

        private Long sizeBytes;

        @Size(max = 100)
        private String mimeType;
    }

    // ===== Response =====
    @Getter
    @Builder
    public static class Response {

        private Long attachmentId;
        private Long postId;

        private String originalName;
        private String fileKey;
        private String url;

        private long sizeBytes;
        private String mimeType;

        private LocalDateTime createdAt;
    }
}
