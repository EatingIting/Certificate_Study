package com.example.demo.service.board;

import com.example.demo.board.vo.BoardCommentVO;

import java.util.List;

public interface BoardCommentService {

    List<BoardCommentVO> getByPostId(long postId);

    long addComment(BoardCommentVO comment);

    void updateComment(long commentId, String userId, String content);

    void deleteComment(long commentId, String userId);
}