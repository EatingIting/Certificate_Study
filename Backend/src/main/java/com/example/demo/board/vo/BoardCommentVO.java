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
@Alias("BoardCommentVO")
public class BoardCommentVO {

    private Long commentId;
    private Long postId;
    private String userId;
    private Long parentId;

    private String nickname;

    private String content;

    private Timestamp createdAt;
    private Timestamp updatedAt;
    private Timestamp deletedAt;
}