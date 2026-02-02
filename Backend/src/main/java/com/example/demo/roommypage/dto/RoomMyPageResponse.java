package com.example.demo.roommypage.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.sql.Timestamp;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoomMyPageResponse {

    private String roomNickname;
    private String profileImg;

    // =======================
    // 내 활동(게시글/댓글)
    // =======================
    private long postCount;
    private long commentCount;

    private List<RecentPost> recentPosts;
    private List<RecentComment> recentComments;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RecentPost {
        private long postId;
        private String category;
        private String title;
        private Timestamp createdAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RecentComment {
        private long commentId;
        private long postId;
        private String postTitle;
        private String content;
        private Timestamp createdAt;
    }
}
