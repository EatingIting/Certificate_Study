package com.example.demo.dto.board.post;

import lombok.*;

import java.sql.Timestamp;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BoardPostResponse {
    private Long postId;
    private String roomId;
    private String userId;
    private String nickname;

    private String category;
    private String title;
    private String content;

    private Boolean isPinned;
    private Integer viewCount;

    private Timestamp createdAt;
    private Timestamp updatedAt;
}