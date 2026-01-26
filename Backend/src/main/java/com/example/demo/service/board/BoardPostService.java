package com.example.demo.service.board;

import com.example.demo.board.vo.BoardPostVO;

import java.util.Map;

public interface BoardPostService {

    Map<String, Object> getPostList(
            String roomId,
            String category,
            String keyword,
            int page,
            int size
    );

    BoardPostVO getPostById(long postId);

    long createPost(BoardPostVO post);

    void updatePost(BoardPostVO post);

    void deletePost(long postId, String userId);

    void setPinned(long postId, String userId, boolean isPinned);

    void incrementViewCount(long postId);
}