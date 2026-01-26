package com.example.demo.board.vo;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.apache.ibatis.type.Alias;

import java.sql.Timestamp;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Alias("BoardPostAttachmentVO")
public class BoardPostAttachmentVO {

    private Long attachmentId;
    private Long postId;

    private String originalName;
    private String fileKey;     // nullable
    private String url;

    private Long sizeBytes;     // bigint unsigned
    private String mimeType;    // nullable

    private Timestamp createdAt;
}