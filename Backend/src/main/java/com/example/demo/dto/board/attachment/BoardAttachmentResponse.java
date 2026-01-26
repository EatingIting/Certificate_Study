package com.example.demo.dto.board.attachment;

import lombok.*;

import java.sql.Timestamp;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BoardAttachmentResponse {
    private Long attachmentId;
    private Long postId;

    private String originalName;
    private String fileKey;
    private String url;

    private Long sizeBytes;
    private String mimeType;

    private Timestamp createdAt;
}