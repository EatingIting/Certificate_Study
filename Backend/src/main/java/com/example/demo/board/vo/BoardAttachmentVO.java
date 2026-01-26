package com.example.demo.board.vo;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
public class BoardAttachmentVO {

    private Long attachmentId;

    private Long postId;

    private String originalName;
    private String fileKey;
    private String url;

    private long sizeBytes;
    private String mimeType;

    private LocalDateTime createdAt;
}
