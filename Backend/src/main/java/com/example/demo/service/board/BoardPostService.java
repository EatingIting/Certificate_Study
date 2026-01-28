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

    long createPost(BoardPostVO post, String email);

    void updatePost(BoardPostVO post, String email);

    void deletePost(long postId, String email);

    void setPinned(long postId, String email, boolean isPinned);

    void incrementViewCount(long postId);
}