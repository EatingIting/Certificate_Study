package com.example.demo.board.service;

import com.example.demo.board.vo.BoardCommentVO;

import java.util.List;

public interface BoardCommentService {

    List<BoardCommentVO> getByPostId(long postId);

    long addComment(BoardCommentVO comment, String email);

    void updateComment(long commentId, String email, String content);

    void deleteComment(long commentId, String email);
}