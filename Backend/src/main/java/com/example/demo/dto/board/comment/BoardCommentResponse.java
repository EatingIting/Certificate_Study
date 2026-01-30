package com.example.demo.dto.board.comment;

import lombok.*;

import java.sql.Timestamp;

@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BoardCommentResponse {
    private Long commentId;
    private Long postId;
    private String userId;
    private String nickname;

    private String content;

    private Timestamp createdAt;
    private Timestamp updatedAt;
}