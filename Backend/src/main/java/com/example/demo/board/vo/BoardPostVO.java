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
@Alias("BoardPostVO")
public class BoardPostVO {

    private Long postId;
    private String roomId;      // char(36)
    private String userId;      // char(36)
    private String nickname;

    private String category;    // NOTICE, GENERAL, QNA, RESOURCE
    private String title;       // varchar(200)
    private String content;     // mediumtext

    private Boolean isPinned;   // tinyint(1)
    private Integer viewCount;  // int unsigned

    private Timestamp createdAt;
    private Timestamp updatedAt;
    private Timestamp deletedAt;

    private Integer commentCount;
    private Integer attachmentCount;
}