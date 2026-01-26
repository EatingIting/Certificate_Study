package com.example.demo.dto.board.attachment;

import lombok.*;

@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BoardAttachmentRequest {
    private String originalName;
    private String fileKey;   // nullable
    private String url;
    private Long sizeBytes;
    private String mimeType;  // nullable
}