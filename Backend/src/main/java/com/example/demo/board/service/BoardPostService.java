package com.example.demo.board.service;

import com.example.demo.board.vo.BoardPostVO;

import java.util.Map;

public interface BoardPostService {

    Map<String, Object> getPostList(
            String roomId,
            String category,
            String keyword,
            int page,
            int size,
            String email
    );

    BoardPostVO getPostById(long postId, String email);

    long createPost(BoardPostVO post, String email);

    void updatePost(BoardPostVO post, String email);

    void deletePost(long postId, String email);

    void setPinned(long postId, String email, boolean isPinned);

    void incrementViewCount(long postId);

    String getWriterIdByPostId(long postId);
}
